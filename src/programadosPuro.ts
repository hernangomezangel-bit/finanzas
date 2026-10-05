// Cómo se mantienen al día los gastos programados (cuotas de deudas y de ahorros que la app crea sola).
// Es código puro (sin pantalla ni base de datos), así se puede probar solo.

export type OrigenProgramado = 'deuda' | 'ahorro'

/** Un gasto programado que debería existir según las deudas y ahorros de hoy. */
export interface Deseada {
  clave: string
  origen: OrigenProgramado
  refId: number
  fechaCuota: string
  monto: number
  nota: string
}

/** Un gasto programado que ya existe en los movimientos. */
export interface Existente {
  id: number
  clave: string
  monto: number
  /** El monto que tenía el plan cuando se creó o se actualizó por última vez. */
  montoPlan: number
  nota: string
}

export interface Cambios {
  crear: Deseada[]
  actualizar: { id: number; monto?: number; montoPlan?: number; nota?: string }[]
  borrar: number[]
}

export function claveProgramado(origen: OrigenProgramado, refId: number, fechaCuota: string): string {
  return `${origen}|${refId}|${fechaCuota}`
}

/**
 * Compara lo que debería existir con lo que existe y dice qué crear, actualizar y borrar.
 *  - Lo que falta se crea.
 *  - Lo que sobra (la deuda se pagó, la meta se cerró, cambió el día…) se borra.
 *  - Si el plan cambió el monto, se actualiza, salvo que la persona ya lo haya editado a mano (su monto es distinto
 *    del que puso el plan): entonces se respeta lo que escribió.
 *  - Nunca hay dos gastos programados para la misma cuota.
 */
export function planificarCambios(deseadas: Deseada[], existentes: Existente[]): Cambios {
  const cambios: Cambios = { crear: [], actualizar: [], borrar: [] }
  const porClave = new Map<string, Existente>()
  for (const e of existentes) {
    if (porClave.has(e.clave)) cambios.borrar.push(e.id) // repetido
    else porClave.set(e.clave, e)
  }
  const vistas = new Set<string>()
  for (const d of deseadas) {
    if (vistas.has(d.clave)) continue
    vistas.add(d.clave)
    const ex = porClave.get(d.clave)
    if (!ex) {
      cambios.crear.push(d)
      continue
    }
    const cambio: Cambios['actualizar'][number] = { id: ex.id }
    const editadoAMano = ex.monto !== ex.montoPlan
    if (!editadoAMano && ex.monto !== d.monto) {
      cambio.monto = d.monto
      cambio.montoPlan = d.monto
    } else if (editadoAMano && ex.montoPlan !== d.monto) {
      cambio.montoPlan = d.monto
    }
    if (ex.nota !== d.nota) cambio.nota = d.nota
    if (cambio.monto !== undefined || cambio.montoPlan !== undefined || cambio.nota !== undefined) cambios.actualizar.push(cambio)
  }
  for (const [clave, e] of porClave) if (!vistas.has(clave)) cambios.borrar.push(e.id)
  return cambios
}
