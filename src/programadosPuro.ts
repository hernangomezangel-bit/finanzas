// Cómo se mantienen al día los movimientos programados: las cuotas de deudas y de ahorros y los movimientos
// recurrentes (gastos e ingresos fijos) que la app crea sola para los próximos meses.
// Es código puro (sin pantalla ni base de datos), así se puede probar solo.

export type OrigenProgramado = 'deuda' | 'ahorro' | 'recurrente'
export type TipoProgramado = 'gasto' | 'ingreso'

/** Un movimiento programado que debería existir según las deudas, ahorros y recurrentes de hoy. */
export interface Deseada {
  clave: string
  origen: OrigenProgramado
  refId: number
  fechaCuota: string
  tipo: TipoProgramado
  monto: number
  nota: string
  /** Solo los recurrentes traen su categoría; las cuotas de deudas y ahorros usan la categoría propia de cada una. */
  categoriaId?: number
}

/** Un movimiento programado que ya existe en los movimientos. */
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
 *  - Lo que sobra (la deuda se pagó, la meta se cerró, cambió el día, se pausó el recurrente…) se borra.
 *  - Si el plan cambió el monto, se actualiza, salvo que la persona ya lo haya editado a mano (su monto es distinto
 *    del que puso el plan): entonces se respeta lo que escribió.
 *  - Nunca hay dos movimientos programados para la misma cuota.
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

/** Cuántos meses hacia adelante se crean los movimientos programados (además del mes en curso). */
export const MESES_POR_ADELANTADO = 24

/** Último día del mes que queda `meses` meses después de la fecha dada (AAAA-MM-DD). */
export function limiteDeProgramacion(hoy: string, meses: number): string {
  const [a, m] = hoy.split('-').map(Number)
  const total = a * 12 + (m - 1) + meses
  const anio = Math.floor(total / 12)
  const mes = (total % 12) + 1
  const ultimo = new Date(anio, mes, 0).getDate()
  return `${anio}-${String(mes).padStart(2, '0')}-${String(ultimo).padStart(2, '0')}`
}

/**
 * ¿Sigue pendiente un movimiento? Lo está si es un programado sin confirmar o si su fecha todavía no llega.
 * Así, un gasto con fecha futura no cuenta como pagado (ni un ingreso con fecha futura, como recibido).
 */
export function estaPendiente(movimiento: { fecha: string; programado?: unknown }, hoy: string): boolean {
  return movimiento.programado !== undefined || movimiento.fecha > hoy
}
