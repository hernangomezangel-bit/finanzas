// Los ingresos que va anotando el asistente y cómo se pasan a valor mensual. Código puro, sin pantalla.

export type FrecuenciaIngreso = 'mensual' | 'quincenal' | 'semanal'

/** Un ingreso a medida que se va respondiendo: puede estar incompleto. */
export interface IngresoBorrador {
  /** Id de la opción elegida (`salario`, `negocio`… u `otro`). */
  tipo?: string
  /** El nombre que se muestra: el de la opción, o el texto libre si eligió «Otro». */
  etiqueta?: string
  /** Lo que recibe cada vez, en pesos. */
  monto?: number
  frecuencia?: FrecuenciaIngreso
  /** Quién lo recibe (solo en presupuestos familiares); opcional. */
  quien?: string
  /** Si cambia de un mes a otro. */
  variable?: boolean
}

/** Pasa lo que se recibe cada vez a valor mensual: quincenal × 2, semanal × 52 ÷ 12 (redondeado). */
export function mensualDe(monto: number, frecuencia: FrecuenciaIngreso): number {
  if (frecuencia === 'quincenal') return monto * 2
  if (frecuencia === 'semanal') return Math.round((monto * 52) / 12)
  return monto
}

/** ¿Ya respondió todo lo necesario? (Quién lo recibe es opcional.) */
export function esIngresoCompleto(i: IngresoBorrador): i is IngresoBorrador & { etiqueta: string; monto: number; frecuencia: FrecuenciaIngreso } {
  return (
    !!i.etiqueta?.trim() &&
    typeof i.monto === 'number' &&
    i.monto > 0 &&
    i.frecuencia !== undefined &&
    i.variable !== undefined
  )
}

/** Cuánto entra al mes en total, sumando solo los ingresos completos. */
export function totalIngresosMensual(ingresos: IngresoBorrador[]): number {
  return ingresos.reduce((suma, i) => (esIngresoCompleto(i) ? suma + mensualDe(i.monto, i.frecuencia) : suma), 0)
}

/** El nombre del ingreso para usarlo dentro de una frase: «salario», pero un texto libre se deja como lo escribió. */
export function nombreEnFrase(i: IngresoBorrador): string {
  const etiqueta = (i.etiqueta ?? '').trim()
  if (i.tipo === 'otro' || etiqueta === '') return etiqueta
  return etiqueta.charAt(0).toLowerCase() + etiqueta.slice(1)
}
