import { db, type Movimiento, type Recurrente } from './db'
import { claveOcurrencia, pendientes, type Vencimiento } from './recurrencia'
import { hoy } from './fechas'

export interface PendienteConDatos extends Vencimiento {
  recurrente: Recurrente
}

/** Los vencimientos de hoy hacia atrás que aún esperan que la persona los registre u omita. */
export async function leerPendientes(): Promise<PendienteConDatos[]> {
  const [recurrentes, ocurrencias] = await Promise.all([db.recurrentes.toArray(), db.ocurrencias.toArray()])
  const resueltas = new Set(ocurrencias.map((o) => claveOcurrencia(o.recurrenteId, o.fecha)))
  const lista = pendientes(
    recurrentes.map((r) => ({ id: r.id!, dias: r.dias, creado: r.creado, activo: r.activo })),
    resueltas,
    hoy(),
  )
  const porId = new Map(recurrentes.map((r) => [r.id!, r]))
  return lista.map((v) => ({ ...v, recurrente: porId.get(v.recurrenteId)! }))
}

/** Registra el vencimiento como movimiento (con la fecha en que tocaba) y lo da por atendido. */
export async function registrarVencimiento(
  recurrente: Recurrente,
  fecha: string,
  monto: number,
  recordarMonto = false,
): Promise<void> {
  await db.transaction('rw', db.movimientos, db.ocurrencias, db.recurrentes, async () => {
    const movimientoId = await db.movimientos.add({
      tipo: recurrente.tipo,
      monto,
      categoriaId: recurrente.categoriaId,
      fecha,
      nota: recurrente.nota || recurrente.nombre,
    })
    await db.ocurrencias.add({ recurrenteId: recurrente.id!, fecha, estado: 'registrada', movimientoId })
    if (recordarMonto) await db.recurrentes.update(recurrente.id!, { monto })
  })
}

export async function omitirVencimiento(recurrente: Recurrente, fecha: string): Promise<void> {
  await db.ocurrencias.add({ recurrenteId: recurrente.id!, fecha, estado: 'omitida' })
}

/**
 * Guarda un movimiento nuevo y lo deja programado para repetirse cada mes ese mismo día.
 * El vencimiento de hoy queda como ya registrado, para que no se proponga otra vez.
 */
export async function crearMovimientoRecurrente(movimiento: Omit<Movimiento, 'id'>): Promise<void> {
  await db.transaction('rw', db.movimientos, db.recurrentes, db.ocurrencias, db.categorias, async () => {
    const categoria = await db.categorias.get(movimiento.categoriaId)
    const movimientoId = await db.movimientos.add(movimiento)
    const recurrenteId = await db.recurrentes.add({
      nombre: (movimiento.nota || categoria?.nombre || 'Recurrente').slice(0, 40),
      tipo: movimiento.tipo,
      monto: movimiento.monto,
      categoriaId: movimiento.categoriaId,
      nota: movimiento.nota,
      dias: [Number(movimiento.fecha.slice(8, 10))],
      creado: movimiento.fecha,
      activo: true,
    })
    await db.ocurrencias.add({ recurrenteId, fecha: movimiento.fecha, estado: 'registrada', movimientoId })
  })
}

/** Borra el recurrente y su historial de vencimientos. Los movimientos ya registrados se conservan. */
export async function eliminarRecurrente(id: number): Promise<void> {
  await db.transaction('rw', db.recurrentes, db.ocurrencias, async () => {
    await db.ocurrencias.where('recurrenteId').equals(id).delete()
    await db.recurrentes.delete(id)
  })
}

export function textoDias(dias: number[]): string {
  const ordenados = [...dias].sort((a, b) => a - b)
  return ordenados.length === 1
    ? `Cada mes, el día ${ordenados[0]}`
    : `Cada mes, los días ${ordenados.slice(0, -1).join(', ')} y ${ordenados[ordenados.length - 1]}`
}
