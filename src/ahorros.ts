import { CATEGORIA_AHORRO, db, type Aporte, type Meta, type ProgramaAhorro } from './db'
import { hoy, numeroDeDia } from './fechas'
import { buscarProgramado } from './programadosBase'
import { cuotasPendientes, fechasCuotas } from './recurrencia'

export interface Punto {
  dia: number
  valor: number
  /** Los puntos reales son aportes; los demás solo marcan el inicio y el día de hoy. */
  real: boolean
}

/** Ahorro acumulado a lo largo del tiempo, a partir de los aportes (las cuotas omitidas no suman nada). */
export function serieAcumulada(todos: Aporte[], inicio: string): Punto[] {
  const aportes = todos.filter((a) => !a.omitida)
  if (aportes.length === 0) return []
  const orden = [...aportes].sort((a, b) => a.fecha.localeCompare(b.fecha) || a.id! - b.id!)
  const puntos: Punto[] = []
  if (inicio < orden[0].fecha) puntos.push({ dia: numeroDeDia(inicio), valor: 0, real: false })
  let total = 0
  for (const a of orden) {
    total += a.monto
    puntos.push({ dia: numeroDeDia(a.fecha), valor: total, real: true })
  }
  const hoyDia = numeroDeDia(hoy())
  if (hoyDia > puntos[puntos.length - 1].dia) puntos.push({ dia: hoyDia, valor: total, real: false })
  return puntos
}

export interface DatosAporte {
  metaId: number
  monto: number
  fecha: string
  nota: string
  /** Si es true, el aporte también aparece como gasto en el Presupuesto. */
  comoGasto: boolean
  /** Cuota del ahorro programado que cubre este aporte. */
  fechaCuota?: string
}

async function categoriaAhorroId(): Promise<number> {
  const existente = await db.categorias.filter((c) => c.clave === 'ahorro').first()
  return existente?.id ?? db.categorias.add({ ...CATEGORIA_AHORRO })
}

/**
 * Cuotas del ahorro programado que ya vencieron y todavía no se registraron ni se omitieron,
 * de la más vieja a la más nueva. Vacío si la meta no tiene programa o está cerrada.
 */
export function cuotasPendientesAhorro(meta: Meta, aportes: Aporte[]): string[] {
  if (!meta.programa || meta.archivada) return []
  const resueltas = new Set(aportes.flatMap((a) => (a.fechaCuota ? [a.fechaCuota] : [])))
  return cuotasPendientes(meta.programa, meta.fechaMeta, resueltas, hoy())
}

/** Crea o actualiza un aporte y mantiene sincronizado su gasto en el Presupuesto. */
export async function guardarAporte(datos: DatosAporte, existente?: Aporte): Promise<void> {
  await db.transaction('rw', db.categorias, db.movimientos, db.aportes, db.metas, async () => {
    const meta = await db.metas.get(datos.metaId)
    const nota = `Aporte a ${meta?.nombre ?? 'meta'}${datos.nota ? `: ${datos.nota}` : ''}`.slice(0, 200)
    const gastoActual = existente?.movimientoId ? await db.movimientos.get(existente.movimientoId) : undefined

    // Un aporte nuevo que alcanza para una cuota vencida la cubre (la más vieja), para que no se proponga otra vez.
    // Uno menor que la cuota se toma como un aporte extra.
    let fechaCuota = datos.fechaCuota ?? existente?.fechaCuota
    if (!existente && fechaCuota === undefined && meta?.programa && datos.monto >= meta.programa.cuota) {
      const delMeta = await db.aportes.where('metaId').equals(meta.id!).toArray()
      fechaCuota = cuotasPendientesAhorro(meta, delMeta)[0]
    }

    // La app ya creó el gasto de esa cuota (programado): se confirma ese mismo, sin crear uno segundo.
    const programado = !existente && fechaCuota ? await buscarProgramado('ahorro', datos.metaId, fechaCuota) : undefined

    let movimientoId: number | undefined
    if (datos.comoGasto) {
      const gasto = { tipo: 'gasto' as const, monto: datos.monto, fecha: datos.fecha, nota }
      if (gastoActual) {
        // Se respeta la categoría si la persona la cambió en el Presupuesto.
        await db.movimientos.update(gastoActual.id!, gasto)
        movimientoId = gastoActual.id
      } else if (programado) {
        await db.movimientos.update(programado.id!, { ...gasto, programado: undefined })
        movimientoId = programado.id
      } else {
        movimientoId = await db.movimientos.add({ ...gasto, categoriaId: await categoriaAhorroId() })
      }
    } else {
      if (gastoActual) await db.movimientos.delete(gastoActual.id!)
      // Si el gasto ya se registró por otro lado, el programado sobra.
      if (programado) await db.movimientos.delete(programado.id!)
    }

    const registro = {
      metaId: datos.metaId,
      monto: datos.monto,
      fecha: datos.fecha,
      nota: datos.nota,
      ...(movimientoId !== undefined ? { movimientoId } : {}),
      ...(fechaCuota ? { fechaCuota } : {}),
    }
    if (existente) await db.aportes.put({ ...registro, id: existente.id })
    else await db.aportes.add(registro)
  })
}

export async function eliminarAporte(aporte: Aporte): Promise<void> {
  await db.transaction('rw', db.movimientos, db.aportes, async () => {
    if (aporte.movimientoId !== undefined) await db.movimientos.delete(aporte.movimientoId)
    await db.aportes.delete(aporte.id!)
  })
}

/** Deja pasar una cuota sin registrarla: no suma ahorro, no crea gasto y no se vuelve a proponer. */
export async function omitirCuotaAhorro(meta: Meta, fechaCuota: string): Promise<void> {
  await db.transaction('rw', db.movimientos, db.aportes, async () => {
    await db.aportes.add({ metaId: meta.id!, monto: 0, fecha: hoy(), nota: '', fechaCuota, omitida: true })
    // El gasto programado de esa cuota ya no corresponde.
    const programado = await buscarProgramado('ahorro', meta.id!, fechaCuota)
    if (programado) await db.movimientos.delete(programado.id!)
  })
}

export interface CuotaAhorro {
  meta: Meta
  /** Fecha en que vencía la cuota. */
  fecha: string
  monto: number
}

/** Las cuotas vencidas de todos los ahorros programados, con su monto fijo. */
export async function leerCuotasAhorro(): Promise<CuotaAhorro[]> {
  const [metas, aportes, programados] = await Promise.all([
    db.metas.toArray(),
    db.aportes.toArray(),
    db.movimientos.filter((m) => m.programado?.origen === 'ahorro').toArray(),
  ])
  // Si la cuota ya tiene su gasto programado, el monto es el de ese gasto (por si lo editaste en Presupuesto).
  const montos = new Map(programados.map((m) => [`${m.programado!.refId}|${m.programado!.fechaCuota}`, m.monto]))
  return metas.flatMap((meta) =>
    meta.programa
      ? cuotasPendientesAhorro(meta, aportes.filter((a) => a.metaId === meta.id)).map((fecha) => ({
          meta,
          fecha,
          monto: montos.get(`${meta.id}|${fecha}`) ?? meta.programa!.cuota,
        }))
      : [],
  )
}

/** Cuántas cuotas tiene el plan desde su inicio hasta la fecha final, y cuánto se habrá ahorrado al terminar. */
export function totalProgramado(programa: ProgramaAhorro, fin: string): { cuotas: number; total: number } {
  const cuotas = fechasCuotas(programa, fin).length
  return { cuotas, total: cuotas * programa.cuota }
}

const NOMBRES_DIAS = ['domingos', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábados']

/** «Cada día», «Los viernes» o «El día 15 de cada mes», según la frecuencia. */
export function textoFrecuencia(programa: ProgramaAhorro): string {
  if (programa.frecuencia === 'diaria') return 'cada día'
  if (programa.frecuencia === 'semanal') return `los ${NOMBRES_DIAS[programa.dia]}`
  return `el día ${programa.dia} de cada mes`
}

/** La cuota que toca ahora: la vencida más vieja sin atender, o si no hay, la próxima. Undefined si el plan terminó. */
export function proximaCuotaAhorro(meta: Meta, aportes: Aporte[]): string | undefined {
  if (!meta.programa || !meta.fechaMeta || meta.archivada) return undefined
  const vencida = cuotasPendientesAhorro(meta, aportes)[0]
  if (vencida) return vencida
  const resueltas = new Set(aportes.flatMap((a) => (a.fechaCuota ? [a.fechaCuota] : [])))
  return fechasCuotas(meta.programa, meta.fechaMeta, hoy()).find((f) => !resueltas.has(f))
}

/** Cuántas cuotas se han cubierto (registradas) del total que tiene el plan. */
export function progresoCuotas(meta: Meta, aportes: Aporte[]): { hechas: number; total: number } | null {
  if (!meta.programa || !meta.fechaMeta) return null
  const todas = new Set(fechasCuotas(meta.programa, meta.fechaMeta))
  const hechas = new Set(aportes.flatMap((a) => (a.fechaCuota && !a.omitida && todas.has(a.fechaCuota) ? [a.fechaCuota] : [])))
  return { hechas: hechas.size, total: todas.size }
}

/** Borra la meta y sus aportes. Los gastos que ya contaron en el Presupuesto se conservan. */
export async function eliminarMeta(metaId: number): Promise<void> {
  await db.transaction('rw', db.metas, db.aportes, db.movimientos, async () => {
    await db.aportes.where('metaId').equals(metaId).delete()
    await db.metas.delete(metaId)
    // Los gastos programados que aún no se confirmaron dejan de tener sentido; los ya pagados se conservan.
    await db.movimientos.filter((m) => m.programado?.origen === 'ahorro' && m.programado.refId === metaId).delete()
  })
}
