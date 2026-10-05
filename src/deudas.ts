import { CATEGORIA_DEUDAS, db, type Ajuste, type Deuda, type PagoDeuda } from './db'
import { diaSiguiente, fechaDeCuota, hoy } from './fechas'
import { simular, tasaMensual, type DeudaPlan, type Estrategia, type ResultadoPlan } from './plan'
import { claveOcurrencia, pendientes } from './recurrencia'

/** Lo que se debe hoy: el saldo inicial menos lo que los pagos han bajado de capital. */
export function saldoActual(deuda: Deuda, pagos: PagoDeuda[]): number {
  const bajado = pagos.reduce((s, p) => s + p.aCapital, 0)
  return Math.max(0, deuda.saldoInicial - bajado)
}

export function tasaMensualDe(deuda: Deuda): number {
  return tasaMensual(deuda.tasa, deuda.tipoTasa)
}

const porcentaje = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 2 })

/** La tasa tal como la escribió la persona: «28,5 % E.A.» o «2,1 % mensual». */
export function textoTasa(deuda: Deuda): string {
  return `${porcentaje.format(deuda.tasa)} % ${deuda.tipoTasa === 'ea' ? 'E.A.' : 'mensual'}`
}

/** Interés estimado del mes sobre el saldo de hoy. */
export function interesDelMes(deuda: Deuda, saldo: number): number {
  return Math.round(saldo * tasaMensualDe(deuda))
}

export function aDeudaPlan(deuda: Deuda, pagos: PagoDeuda[]): DeudaPlan {
  return {
    id: deuda.id!,
    nombre: deuda.nombre,
    saldo: saldoActual(deuda, pagos),
    tm: tasaMensualDe(deuda),
    minimo: deuda.pagoMinimo,
  }
}

/**
 * Cuotas que ya vencieron (hasta hoy) y todavía no se pagaron ni se omitieron, de la más vieja a la más
 * nueva. Solo hay si la deuda tiene día de pago y aún se debe algo.
 */
export function cuotasPendientes(deuda: Deuda, pagos: PagoDeuda[]): string[] {
  if (deuda.diaPago === undefined || saldoActual(deuda, pagos) === 0) return []
  const resueltas = new Set(
    pagos.flatMap((p) => (p.fechaCuota ? [claveOcurrencia(deuda.id!, p.fechaCuota)] : [])),
  )
  return pendientes(
    [{ id: deuda.id!, dias: [deuda.diaPago], creado: deuda.propuestasDesde ?? deuda.creada, activo: true }],
    resueltas,
    hoy(),
  ).map((v) => v.fecha)
}

/**
 * Fecha de la cuota número `numero` (1 = la que toca ahora). Si hay cuotas vencidas sin atender, la primera
 * es la más vieja de ellas; si no, la próxima: se cuenta desde el día siguiente a la última cuota marcada,
 * o desde hoy. Sin día de pago devuelve undefined.
 */
export function fechaCuota(deuda: Deuda, pagos: PagoDeuda[], numero = 1): string | undefined {
  if (deuda.diaPago === undefined) return undefined
  const vencida = cuotasPendientes(deuda, pagos)[0]
  if (vencida) return fechaDeCuota(deuda.diaPago, numero, vencida)
  const ultima = pagos.map((p) => p.fechaCuota).filter((f): f is string => !!f).sort().at(-1)
  const desde = ultima && diaSiguiente(ultima) > hoy() ? diaSiguiente(ultima) : hoy()
  return fechaDeCuota(deuda.diaPago, numero, desde)
}

export interface PlanCalculado {
  activas: DeudaPlan[]
  bola: ResultadoPlan
  avalancha: ResultadoPlan
  /** El método que paga menos intereses. */
  recomendada: Estrategia
  /** El método que se está siguiendo: el elegido, o el recomendado si no se eligió. */
  siguiendo: Estrategia
  resultado: ResultadoPlan
}

/** El plan de pago con el dinero extra y el método elegidos; es el mismo que ve la pantalla del plan. */
export function calcularPlan(deudas: Deuda[], pagos: PagoDeuda[], extra: number, elegida?: Estrategia): PlanCalculado {
  const activas = deudas
    .map((d) => aDeudaPlan(d, pagos.filter((p) => p.deudaId === d.id)))
    .filter((d) => d.saldo > 0)
  const bola = simular(activas, extra, 'bola')
  const avalancha = simular(activas, extra, 'avalancha')
  const recomendada: Estrategia = avalancha.interesTotal <= bola.interesTotal ? 'avalancha' : 'bola'
  const siguiendo = elegida ?? recomendada
  return { activas, bola, avalancha, recomendada, siguiendo, resultado: siguiendo === 'bola' ? bola : avalancha }
}

export interface CuotaPropuesta {
  deuda: Deuda
  /** Fecha en que vencía la cuota. */
  fecha: string
  /** Lo que propone el plan: el pago mínimo, o más si el método elegido le asigna dinero extra. */
  monto: number
  /** Cuánto de ese monto excede el pago mínimo (dinero extra del plan). */
  extra: number
  saldo: number
}

/** Las cuotas vencidas de todas las deudas, con el monto que indica el plan de pago actual. */
export async function leerCuotasPropuestas(): Promise<CuotaPropuesta[]> {
  const [deudas, pagos, ajustes] = await Promise.all([db.deudas.toArray(), db.pagosDeuda.toArray(), db.ajustes.toArray()])
  const extra = ajustes.find((a): a is Extract<Ajuste, { clave: 'deudaExtra' }> => a.clave === 'deudaExtra')?.valor ?? 0
  const elegida = ajustes.find((a): a is Extract<Ajuste, { clave: 'deudaEstrategia' }> => a.clave === 'deudaEstrategia')?.valor
  const { resultado } = calcularPlan(deudas, pagos, extra, elegida)
  const delPlan = new Map((resultado.plan[0]?.lineas ?? []).map((l) => [l.deudaId, l.pago]))

  return deudas.flatMap((deuda) => {
    const propios = pagos.filter((p) => p.deudaId === deuda.id)
    const saldo = saldoActual(deuda, propios)
    const monto = delPlan.get(deuda.id!) ?? deuda.pagoMinimo
    return cuotasPendientes(deuda, propios).map((fecha) => ({
      deuda,
      fecha,
      monto,
      extra: Math.max(0, monto - deuda.pagoMinimo),
      saldo,
    }))
  })
}

/** Deja pasar una cuota sin registrarla (por ejemplo, ya se pagó por otro lado): no se vuelve a proponer. */
export async function omitirCuota(deuda: Deuda, fechaCuota: string): Promise<void> {
  await db.pagosDeuda.add({
    deudaId: deuda.id!,
    monto: 0,
    interes: 0,
    aCapital: 0,
    fecha: hoy(),
    fechaCuota,
    omitida: true,
  })
}

export interface DatosPago {
  monto: number
  fecha: string
  /** Cuota del plan que cubre este pago (para saber cuál toca después). */
  fechaCuota?: string
  /** Si es true, el pago también aparece como gasto en el Presupuesto. */
  comoGasto: boolean
}

async function categoriaDeudasId(): Promise<number> {
  const existente = await db.categorias.filter((c) => c.clave === 'deudas').first()
  return existente?.id ?? db.categorias.add({ ...CATEGORIA_DEUDAS })
}

/** Registra un pago: calcula cuánto fue interés y cuánto bajó el saldo, y opcionalmente crea el gasto. */
export async function registrarPago(deuda: Deuda, datos: DatosPago): Promise<void> {
  await db.transaction('rw', db.categorias, db.movimientos, db.pagosDeuda, async () => {
    const pagos = await db.pagosDeuda.where('deudaId').equals(deuda.id!).toArray()
    const saldo = saldoActual(deuda, pagos)
    const interes = interesDelMes(deuda, saldo)
    // Nadie paga más de lo que debe: se limita a saldo + interés (liquidar la deuda).
    const monto = Math.min(datos.monto, saldo + interes)
    if (monto <= 0) return
    // Un pago suelto cubre la cuota vencida más vieja, para que no se vuelva a proponer esa misma.
    const fechaCuota = datos.fechaCuota ?? cuotasPendientes(deuda, pagos)[0]

    let movimientoId: number | undefined
    if (datos.comoGasto) {
      movimientoId = await db.movimientos.add({
        tipo: 'gasto',
        monto,
        categoriaId: await categoriaDeudasId(),
        fecha: datos.fecha,
        nota: `Pago de ${deuda.nombre}`.slice(0, 200),
      })
    }
    await db.pagosDeuda.add({
      deudaId: deuda.id!,
      monto,
      interes,
      aCapital: monto - interes,
      fecha: datos.fecha,
      ...(fechaCuota ? { fechaCuota } : {}),
      ...(movimientoId !== undefined ? { movimientoId } : {}),
    })
  })
}

export async function eliminarPago(pago: PagoDeuda): Promise<void> {
  await db.transaction('rw', db.movimientos, db.pagosDeuda, async () => {
    if (pago.movimientoId !== undefined) await db.movimientos.delete(pago.movimientoId)
    await db.pagosDeuda.delete(pago.id!)
  })
}

/** Borra la deuda y su historial de pagos. Los gastos que ya contaron en el Presupuesto se conservan. */
export async function eliminarDeuda(deudaId: number): Promise<void> {
  await db.transaction('rw', db.deudas, db.pagosDeuda, async () => {
    await db.pagosDeuda.where('deudaId').equals(deudaId).delete()
    await db.deudas.delete(deudaId)
  })
}

export async function guardarAjuste(ajuste: Ajuste): Promise<void> {
  await db.ajustes.put(ajuste)
}
