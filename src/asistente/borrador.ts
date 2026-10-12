// El progreso del asistente. Se guarda en el teléfono después de cada respuesta, para poder salir y retomar, y no
// sale de ahí. Si el dato guardado está dañado o es de otra versión, se ignora y se empieza de cero.
import type { IngresoBorrador } from './ingresos.ts'

/** Cada pantalla del asistente. Los pasos 1 a 3 son los únicos hechos por ahora. */
export type Pantalla =
  | 'BIE'
  | 'QUI'
  | 'QUI_FAM'
  | 'ING_TIPO'
  | 'ING_MONTO'
  | 'ING_FREC'
  | 'ING_QUIEN'
  | 'ING_VAR'
  | 'ING_CONSEJO'
  | 'ING_OTRO'
  | 'ING_TOTAL'
  | 'PRONTO'

const PANTALLAS: Pantalla[] = [
  'BIE', 'QUI', 'QUI_FAM', 'ING_TIPO', 'ING_MONTO', 'ING_FREC', 'ING_QUIEN', 'ING_VAR', 'ING_CONSEJO', 'ING_OTRO', 'ING_TOTAL', 'PRONTO',
]

/** A qué paso (1 a 9) pertenece cada pantalla, para la barra de progreso. */
export const PASO_DE: Record<Pantalla, number> = {
  BIE: 1,
  QUI: 2,
  QUI_FAM: 2,
  ING_TIPO: 3,
  ING_MONTO: 3,
  ING_FREC: 3,
  ING_QUIEN: 3,
  ING_VAR: 3,
  ING_CONSEJO: 3,
  ING_OTRO: 3,
  ING_TOTAL: 3,
  PRONTO: 3,
}

export type TipoPresupuesto = 'personal' | 'familiar'

export interface Borrador {
  version: 1
  pantalla: Pantalla
  /** Las pantallas por las que pasó, para poder volver atrás sin perder lo escrito. */
  historial: Pantalla[]
  para: TipoPresupuesto | null
  /** Los ingresos anotados; el último es el que se está respondiendo. */
  ingresos: IngresoBorrador[]
  /** Cuál de los ingresos se está respondiendo ahora. */
  indice: number
}

const CLAVE = 'tico-borrador'

/** Los ingresos que cuentan: hasta el que se está respondiendo. Si volvió atrás, los siguientes quedan guardados pero no suman. */
export function ingresosActivos(borrador: Borrador): IngresoBorrador[] {
  return borrador.ingresos.slice(0, borrador.indice + 1)
}

export function borradorNuevo(): Borrador {
  return { version: 1, pantalla: 'BIE', historial: [], para: null, ingresos: [{}], indice: 0 }
}

function esPantalla(valor: unknown): valor is Pantalla {
  return typeof valor === 'string' && (PANTALLAS as string[]).includes(valor)
}

/** Lee lo guardado y comprueba que tenga la forma esperada; si no, null. */
export function validarBorrador(dato: unknown): Borrador | null {
  if (typeof dato !== 'object' || dato === null) return null
  const d = dato as Record<string, unknown>
  if (d.version !== 1 || !esPantalla(d.pantalla)) return null
  if (!Array.isArray(d.historial) || !d.historial.every(esPantalla)) return null
  if (d.para !== null && d.para !== 'personal' && d.para !== 'familiar') return null
  if (!Array.isArray(d.ingresos) || d.ingresos.length === 0 || !d.ingresos.every((i) => typeof i === 'object' && i !== null)) return null
  if (typeof d.indice !== 'number' || !Number.isInteger(d.indice) || d.indice < 0 || d.indice >= d.ingresos.length) return null
  return d as unknown as Borrador
}

export function leerBorrador(): Borrador | null {
  try {
    const texto = localStorage.getItem(CLAVE)
    return texto ? validarBorrador(JSON.parse(texto)) : null
  } catch {
    return null
  }
}

export function guardarBorrador(borrador: Borrador): void {
  try {
    localStorage.setItem(CLAVE, JSON.stringify(borrador))
  } catch {
    // Sin espacio o sin permiso: el asistente sigue funcionando, solo que no recordará dónde iba.
  }
}

export function borrarBorrador(): void {
  try {
    localStorage.removeItem(CLAVE)
  } catch {
    // Nada que borrar.
  }
}

/** ¿Hay un asistente a medias? (Que pasó de la bienvenida.) */
export function hayBorradorEnCurso(): boolean {
  const b = leerBorrador()
  return b !== null && b.pantalla !== 'BIE'
}
