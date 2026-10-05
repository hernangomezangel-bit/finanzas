import { db, type Movimiento, type Recurrente } from './db'
import { claveOcurrencia, montoDelVencimiento, pendientes, type PatronFijo, type Vencimiento } from './recurrencia'
import { hoy } from './fechas'
import { buscarProgramado } from './programadosBase'
import { esOcurrencia, textoPatron, textoPorDia } from './repeticion'

export interface PendienteConDatos extends Vencimiento {
  recurrente: Recurrente
  /** Lo que se propone: el monto del movimiento programado de esa fecha (por si lo editaste) o el habitual. */
  monto: number
}

/** Los vencimientos de hoy hacia atrás que aún esperan que la persona los registre u omita. */
export async function leerPendientes(): Promise<PendienteConDatos[]> {
  const [recurrentes, ocurrencias, programados] = await Promise.all([
    db.recurrentes.toArray(),
    db.ocurrencias.toArray(),
    db.movimientos.filter((m) => m.programado?.origen === 'recurrente').toArray(),
  ])
  const resueltas = new Set(ocurrencias.map((o) => claveOcurrencia(o.recurrenteId, o.fecha)))
  const lista = pendientes(
    recurrentes.map((r) => ({ id: r.id!, frecuencia: r.frecuencia, dias: r.dias, creado: r.creado, activo: r.activo })),
    resueltas,
    hoy(),
  )
  const porId = new Map(recurrentes.map((r) => [r.id!, r]))
  const montos = new Map(programados.map((m) => [claveOcurrencia(m.programado!.refId, m.programado!.fechaCuota), m.monto]))
  return lista.map((v) => {
    const recurrente = porId.get(v.recurrenteId)!
    return { ...v, recurrente, monto: montos.get(claveOcurrencia(v.recurrenteId, v.fecha)) ?? montoDelVencimiento(recurrente, v.fecha) }
  })
}

/** Registra el vencimiento (con la fecha en que tocaba) y lo da por atendido. */
export async function registrarVencimiento(
  recurrente: Recurrente,
  fecha: string,
  monto: number,
  recordarMonto = false,
): Promise<void> {
  await db.transaction('rw', db.movimientos, db.ocurrencias, db.recurrentes, async () => {
    // La app ya creó este movimiento (programado): se confirma ese mismo, sin crear uno segundo.
    const programado = await buscarProgramado('recurrente', recurrente.id!, fecha)
    // Si se paga antes de su día, el movimiento queda con la fecha de hoy (con fecha futura seguiría «por pagar»).
    // El vencimiento que se da por atendido sigue siendo el original.
    const fechaMovimiento = fecha > hoy() ? hoy() : fecha
    let movimientoId: number
    if (programado) {
      await db.movimientos.update(programado.id!, { monto, fecha: fechaMovimiento, programado: undefined })
      movimientoId = programado.id!
    } else {
      movimientoId = await db.movimientos.add({
        tipo: recurrente.tipo,
        monto,
        categoriaId: recurrente.categoriaId,
        fecha: fechaMovimiento,
        nota: recurrente.nota || recurrente.nombre,
      })
    }
    await db.ocurrencias.add({ recurrenteId: recurrente.id!, fecha, estado: 'registrada', movimientoId })
    // En un recurrente por día, el monto de una vez es el total del mes, no el de cada día: no se recuerda.
    if (recordarMonto && recurrente.diasLibres === undefined) await db.recurrentes.update(recurrente.id!, { monto })
  })
}

export async function omitirVencimiento(recurrente: Recurrente, fecha: string): Promise<void> {
  await db.transaction('rw', db.movimientos, db.ocurrencias, async () => {
    await db.ocurrencias.add({ recurrenteId: recurrente.id!, fecha, estado: 'omitida' })
    // El movimiento programado de esa fecha ya no corresponde.
    const programado = await buscarProgramado('recurrente', recurrente.id!, fecha)
    if (programado) await db.movimientos.delete(programado.id!)
  })
}

/** Los datos del recurrente que nace de un movimiento: empieza en la fecha del movimiento y se repite según el patrón. */
function recurrenteDe(
  movimiento: Omit<Movimiento, 'id'>,
  patron: PatronFijo,
  nombreCategoria: string | undefined,
): Omit<Recurrente, 'id'> {
  return {
    nombre: (movimiento.nota || nombreCategoria || 'Recurrente').slice(0, 40),
    tipo: movimiento.tipo,
    monto: movimiento.monto,
    categoriaId: movimiento.categoriaId,
    nota: movimiento.nota,
    // Mensual se guarda sin "frecuencia", como siempre; diaria y semanal sí la llevan.
    ...(patron.frecuencia && patron.frecuencia !== 'mensual' ? { frecuencia: patron.frecuencia } : {}),
    dias: patron.dias,
    creado: movimiento.fecha,
    activo: true,
  }
}

/**
 * Guarda un movimiento nuevo y lo deja repitiéndose según el patrón elegido (todos los días, cada semana, cada
 * quincena o cada mes), desde su fecha. Si esa fecha ya llegó y es una de las del patrón, queda registrada como hecha
 * (no se propone otra vez); si todavía no llega, la app la programa sola como las demás.
 */
export async function crearMovimientoConPatron(movimiento: Omit<Movimiento, 'id'>, patron: PatronFijo): Promise<void> {
  await db.transaction('rw', db.movimientos, db.recurrentes, db.ocurrencias, db.categorias, async () => {
    const categoria = await db.categorias.get(movimiento.categoriaId)
    const recurrenteId = await db.recurrentes.add(recurrenteDe(movimiento, patron, categoria?.nombre))
    if (movimiento.fecha <= hoy() && esOcurrencia(patron, movimiento.fecha)) {
      const movimientoId = await db.movimientos.add(movimiento)
      await db.ocurrencias.add({ recurrenteId, fecha: movimiento.fecha, estado: 'registrada', movimientoId })
    }
  })
}

/**
 * Crea el recurrente que corresponde a un movimiento que ya existe (por defecto, mensual el mismo día). Si la fecha del
 * movimiento es una de las del patrón, queda como su vencimiento ya registrado; si no, el movimiento queda aparte.
 */
async function volverRecurrente(movimiento: Movimiento & { id: number }, patron?: PatronFijo): Promise<void> {
  const elegido: PatronFijo = patron ?? { dias: [Number(movimiento.fecha.slice(8, 10))] }
  const categoria = await db.categorias.get(movimiento.categoriaId)
  const recurrenteId = await db.recurrentes.add(recurrenteDe(movimiento, elegido, categoria?.nombre))
  if (esOcurrencia(elegido, movimiento.fecha)) {
    await db.ocurrencias.add({ recurrenteId, fecha: movimiento.fecha, estado: 'registrada', movimientoId: movimiento.id })
  }
}

/** Vuelve fijo un movimiento que ya existe, con el patrón elegido. Devuelve false si ya no se puede (borrado, programado o atado). */
export async function volverFijo(id: number, patron: PatronFijo): Promise<boolean> {
  return db.transaction('rw', [db.movimientos, db.recurrentes, db.ocurrencias, db.categorias, db.pagosDeuda, db.aportes, db.jornadas], async () => {
    const movimiento = await db.movimientos.get(id)
    if (!movimiento || movimiento.programado !== undefined || (await idsVinculados()).has(id)) return false
    await volverRecurrente({ ...movimiento, id }, patron)
    return true
  })
}

/** Los movimientos que ya están atados a algo (un recurrente, un pago de deuda, un aporte o un trabajo por días). */
export async function idsVinculados(): Promise<Set<number>> {
  const [ocurrencias, pagos, aportes, jornadas] = await Promise.all([
    db.ocurrencias.toArray(),
    db.pagosDeuda.toArray(),
    db.aportes.toArray(),
    db.jornadas.toArray(),
  ])
  const ids = new Set<number>()
  for (const x of [...ocurrencias, ...pagos, ...aportes, ...jornadas]) if (x.movimientoId !== undefined) ids.add(x.movimientoId)
  return ids
}

/**
 * Los movimientos de un mes que se pueden volver fijos (que se repiten cada mes): los registrados a mano, que no son
 * programados ni están atados a un recurrente, pago, aporte o trabajo por días.
 */
export async function candidatosAFijos(mes: string): Promise<Movimiento[]> {
  const [movimientos, vinculados] = await Promise.all([
    db.movimientos.where('fecha').between(`${mes}-01`, `${mes}-32`).toArray(),
    idsVinculados(),
  ])
  return movimientos
    .filter((m) => m.programado === undefined && !vinculados.has(m.id!))
    .sort((a, b) => a.tipo.localeCompare(b.tipo) || a.fecha.localeCompare(b.fecha) || a.id! - b.id!)
}

/**
 * Vuelve fijos los movimientos elegidos: cada uno se repetirá cada mes, el mismo día, y aparecerá ya en los meses
 * siguientes. Devuelve cuántos se volvieron fijos (se saltan los que ya no se pueden: borrados, programados o atados).
 */
export async function repetirMovimientos(ids: number[]): Promise<number> {
  return db.transaction('rw', [db.movimientos, db.recurrentes, db.ocurrencias, db.categorias, db.pagosDeuda, db.aportes, db.jornadas], async () => {
    const vinculados = await idsVinculados()
    let hechos = 0
    for (const id of ids) {
      const movimiento = await db.movimientos.get(id)
      if (!movimiento || movimiento.programado !== undefined || vinculados.has(id)) continue
      await volverRecurrente({ ...movimiento, id })
      hechos++
    }
    return hechos
  })
}

/** Borra el recurrente y su historial de vencimientos. Los movimientos ya registrados se conservan. */
export async function eliminarRecurrente(id: number): Promise<void> {
  await db.transaction('rw', db.recurrentes, db.ocurrencias, db.movimientos, async () => {
    await db.ocurrencias.where('recurrenteId').equals(id).delete()
    await db.recurrentes.delete(id)
    // Los programados de los meses que vienen dejan de tener sentido; los ya confirmados se conservan.
    await db.movimientos.filter((m) => m.programado?.origen === 'recurrente' && m.programado.refId === id).delete()
  })
}

/** Cómo se repite un recurrente, en palabras: «Todos los días», «Cada semana: lunes y viernes», «Cada quincena: días 15 y 30»… */
export function textoDias(recurrente: Pick<Recurrente, 'frecuencia' | 'dias' | 'diasLibres'>): string {
  if (recurrente.diasLibres !== undefined) return textoPorDia(recurrente.diasLibres)
  return textoPatron(recurrente)
}
