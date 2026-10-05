import { db, type Movimiento } from './db'
import { claveProgramado, type OrigenProgramado } from './programadosPuro'

/** El gasto programado que representa una cuota concreta, si existe. */
export async function buscarProgramado(
  origen: OrigenProgramado,
  refId: number,
  fechaCuota: string,
): Promise<Movimiento | undefined> {
  const clave = claveProgramado(origen, refId, fechaCuota)
  return db.movimientos
    .filter((m) => m.programado !== undefined && claveProgramado(m.programado.origen, m.programado.refId, m.programado.fechaCuota) === clave)
    .first()
}
