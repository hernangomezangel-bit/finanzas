import { db, type Movimiento, type Recurrente } from './db'
import { claveOcurrencia, pendientes, type Vencimiento } from './recurrencia'
import { hoy } from './fechas'
import { buscarProgramado } from './programadosBase'

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
    recurrentes.map((r) => ({ id: r.id!, dias: r.dias, creado: r.creado, activo: r.activo })),
    resueltas,
    hoy(),
  )
  const porId = new Map(recurrentes.map((r) => [r.id!, r]))
  const montos = new Map(programados.map((m) => [claveOcurrencia(m.programado!.refId, m.programado!.fechaCuota), m.monto]))
  return lista.map((v) => {
    const recurrente = porId.get(v.recurrenteId)!
    return { ...v, recurrente, monto: montos.get(claveOcurrencia(v.recurrenteId, v.fecha)) ?? recurrente.monto }
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
    let movimientoId: number
    if (programado) {
      await db.movimientos.update(programado.id!, { monto, programado: undefined })
      movimientoId = programado.id!
    } else {
      movimientoId = await db.movimientos.add({
        tipo: recurrente.tipo,
        monto,
        categoriaId: recurrente.categoriaId,
        fecha,
        nota: recurrente.nota || recurrente.nombre,
      })
    }
    await db.ocurrencias.add({ recurrenteId: recurrente.id!, fecha, estado: 'registrada', movimientoId })
    if (recordarMonto) await db.recurrentes.update(recurrente.id!, { monto })
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
  await db.transaction('rw', db.recurrentes, db.ocurrencias, db.movimientos, async () => {
    await db.ocurrencias.where('recurrenteId').equals(id).delete()
    await db.recurrentes.delete(id)
    // Los programados de los meses que vienen dejan de tener sentido; los ya confirmados se conservan.
    await db.movimientos.filter((m) => m.programado?.origen === 'recurrente' && m.programado.refId === id).delete()
  })
}

export function textoDias(dias: number[]): string {
  const ordenados = [...dias].sort((a, b) => a - b)
  return ordenados.length === 1
    ? `Cada mes, el día ${ordenados[0]}`
    : `Cada mes, los días ${ordenados.slice(0, -1).join(', ')} y ${ordenados[ordenados.length - 1]}`
}
