// Los ingresos que va anotando el asistente y cómo se pasan a valor mensual. Código puro, sin pantalla.

/** `diaria` es un trabajo por días (Didi, domicilios…): lo que se gana cada día trabajado, con días de descanso. */
export type FrecuenciaIngreso = 'mensual' | 'quincenal' | 'semanal' | 'diaria'

/** Un ingreso a medida que se va respondiendo: puede estar incompleto. */
export interface IngresoBorrador {
  /** Id de la opción elegida (`salario`, `negocio`… `dia` u `otro`). */
  tipo?: string
  /** El nombre que se muestra: el de la opción, el texto libre si eligió «Otro», o el nombre del trabajo por días. */
  etiqueta?: string
  /** Lo que recibe cada vez, en pesos. En un trabajo por días, la meta de cada día trabajado. */
  monto?: number
  frecuencia?: FrecuenciaIngreso
  /** Solo en trabajos por días: días de la semana en que no trabaja (0 = domingo … 6 = sábado). Puede ir vacío. */
  diasLibres?: number[]
  /** Quién lo recibe (solo en presupuestos familiares); opcional. */
  quien?: string
  /** Si cambia de un mes a otro. */
  variable?: boolean
}

/** Pasa lo que se recibe cada vez a valor mensual: quincenal × 2, semanal × 52 ÷ 12, por día × días trabajados por semana × 52 ÷ 12. */
export function mensualDe(monto: number, frecuencia: FrecuenciaIngreso, diasLibres: number[] = []): number {
  if (frecuencia === 'quincenal') return monto * 2
  if (frecuencia === 'semanal') return Math.round((monto * 52) / 12)
  if (frecuencia === 'diaria') {
    const trabajados = 7 - new Set(diasLibres).size
    return Math.round((monto * trabajados * 52) / 12)
  }
  return monto
}

/** ¿Es un trabajo por días (con meta diaria)? */
export function esPorDia(i: IngresoBorrador): boolean {
  return i.frecuencia === 'diaria'
}

/** ¿Ya respondió todo lo necesario? (Quién lo recibe es opcional; un trabajo por días necesita dejar al menos un día de trabajo.) */
export function esIngresoCompleto(i: IngresoBorrador): i is IngresoBorrador & { etiqueta: string; monto: number; frecuencia: FrecuenciaIngreso } {
  const base =
    !!i.etiqueta?.trim() &&
    typeof i.monto === 'number' &&
    i.monto > 0 &&
    i.frecuencia !== undefined &&
    i.variable !== undefined
  if (!base) return false
  return i.frecuencia !== 'diaria' || (Array.isArray(i.diasLibres) && new Set(i.diasLibres).size < 7)
}

/** Cuánto entra al mes en total, sumando solo los ingresos completos. */
export function totalIngresosMensual(ingresos: IngresoBorrador[]): number {
  return ingresos.reduce((suma, i) => (esIngresoCompleto(i) ? suma + mensualDe(i.monto, i.frecuencia, i.diasLibres) : suma), 0)
}

/** El nombre del ingreso para usarlo dentro de una frase: «salario», pero un texto libre se deja como lo escribió. */
export function nombreEnFrase(i: IngresoBorrador): string {
  const etiqueta = (i.etiqueta ?? '').trim()
  if (i.tipo === 'otro' || i.tipo === 'dia' || etiqueta === '') return etiqueta
  return etiqueta.charAt(0).toLowerCase() + etiqueta.slice(1)
}
