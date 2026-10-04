import { CATEGORIA_DEUDAS, db, type Ajuste, type Deuda, type PagoDeuda } from './db'
import { diaSiguiente, fechaDeCuota, hoy } from './fechas'
import { tasaMensual, type DeudaPlan } from './plan'

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
 * Fecha de la cuota número `numero` (1 = la próxima). Si ya se marcó como pagada una cuota,
 * se cuenta desde el día siguiente a esa; si no, desde hoy. Sin día de pago devuelve undefined.
 */
export function fechaCuota(deuda: Deuda, pagos: PagoDeuda[], numero = 1): string | undefined {
  if (deuda.diaPago === undefined) return undefined
  const ultima = pagos.map((p) => p.fechaCuota).filter((f): f is string => !!f).sort().at(-1)
  const desde = ultima && diaSiguiente(ultima) > hoy() ? diaSiguiente(ultima) : hoy()
  return fechaDeCuota(deuda.diaPago, numero, desde)
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
      ...(datos.fechaCuota ? { fechaCuota: datos.fechaCuota } : {}),
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
