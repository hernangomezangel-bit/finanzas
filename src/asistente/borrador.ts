// El progreso del asistente. Se guarda en el teléfono después de cada respuesta, para poder salir y retomar, y no
// sale de ahí. Si el dato guardado está dañado o es de otra versión, se ignora y se empieza de cero.
import { ahorroVacio, esDatosAhorro, type DatosAhorro } from './ahorro.ts'
import { esListaGastos, listaVacia, type ListaGastos } from './gastos.ts'
import type { IngresoBorrador } from './ingresos.ts'

/** Cada pantalla del asistente. Los pasos 1 a 6 están hechos; la revisión, los recordatorios y el cierre vienen después. */
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
  | 'FIJ_LISTA'
  | 'FIJ_MONTO'
  | 'FIJ_DIA'
  | 'FIJ_TOTAL'
  | 'VAR_LISTA'
  | 'VAR_MONTO'
  | 'VAR_SUGIERE'
  | 'VAR_TOTAL'
  | 'AHO_LISTA'
  | 'AHO_META'
  | 'AHO_CUOTA'
  | 'AHO_NOSE'
  | 'PRONTO'

const PANTALLAS: Pantalla[] = [
  'BIE', 'QUI', 'QUI_FAM', 'ING_TIPO', 'ING_MONTO', 'ING_FREC', 'ING_QUIEN', 'ING_VAR', 'ING_CONSEJO', 'ING_OTRO', 'ING_TOTAL',
  'FIJ_LISTA', 'FIJ_MONTO', 'FIJ_DIA', 'FIJ_TOTAL', 'VAR_LISTA', 'VAR_MONTO', 'VAR_SUGIERE', 'VAR_TOTAL',
  'AHO_LISTA', 'AHO_META', 'AHO_CUOTA', 'AHO_NOSE', 'PRONTO',
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
  FIJ_LISTA: 4,
  FIJ_MONTO: 4,
  FIJ_DIA: 4,
  FIJ_TOTAL: 4,
  VAR_LISTA: 5,
  VAR_MONTO: 5,
  VAR_SUGIERE: 5,
  VAR_TOTAL: 5,
  AHO_LISTA: 6,
  AHO_META: 6,
  AHO_CUOTA: 6,
  AHO_NOSE: 6,
  PRONTO: 6,
}

export type TipoPresupuesto = 'personal' | 'familiar'

export interface Borrador {
  version: 1
  pantalla: Pantalla
  /** Las pantallas por las que pasó, para poder volver atrás sin perder lo escrito. */
  historial: Pantalla[]
  /** Por cada pantalla del historial, en qué pregunta de su lista iba (gastos o metas); se restaura al volver. */
  posiciones: number[]
  /** Qué pregunta de la lista (gastos fijos, variables o metas) se está respondiendo ahora. */
  posicion: number
  para: TipoPresupuesto | null
  /** Los ingresos anotados; el último es el que se está respondiendo. */
  ingresos: IngresoBorrador[]
  /** Cuál de los ingresos se está respondiendo ahora. */
  indice: number
  fijos: ListaGastos
  variables: ListaGastos
  ahorro: DatosAhorro
}

const CLAVE = 'tico-borrador'

/** Los ingresos que cuentan: hasta el que se está respondiendo. Si volvió atrás, los siguientes quedan guardados pero no suman. */
export function ingresosActivos(borrador: Borrador): IngresoBorrador[] {
  return borrador.ingresos.slice(0, borrador.indice + 1)
}

export function borradorNuevo(): Borrador {
  return {
    version: 1,
    pantalla: 'BIE',
    historial: [],
    posiciones: [],
    posicion: 0,
    para: null,
    ingresos: [{}],
    indice: 0,
    fijos: listaVacia(),
    variables: listaVacia(),
    ahorro: ahorroVacio(),
  }
}

function esPantalla(valor: unknown): valor is Pantalla {
  return typeof valor === 'string' && (PANTALLAS as string[]).includes(valor)
}

function esEnteroNoNegativo(valor: unknown): valor is number {
  return typeof valor === 'number' && Number.isInteger(valor) && valor >= 0
}

/**
 * Lee lo guardado y comprueba que tenga la forma esperada; si no, null. Lo que falte de versiones anteriores del
 * asistente (por ejemplo, un borrador que solo llegó al Paso 3) se completa con valores vacíos.
 */
export function validarBorrador(dato: unknown): Borrador | null {
  if (typeof dato !== 'object' || dato === null) return null
  const d = dato as Record<string, unknown>
  if (d.version !== 1 || !esPantalla(d.pantalla)) return null
  if (!Array.isArray(d.historial) || !d.historial.every(esPantalla)) return null
  if (d.para !== null && d.para !== 'personal' && d.para !== 'familiar') return null
  if (!Array.isArray(d.ingresos) || d.ingresos.length === 0 || !d.ingresos.every((i) => typeof i === 'object' && i !== null)) return null
  if (!esEnteroNoNegativo(d.indice) || d.indice >= d.ingresos.length) return null

  const posiciones = d.posiciones === undefined ? d.historial.map(() => 0) : d.posiciones
  if (!Array.isArray(posiciones) || posiciones.length !== d.historial.length || !posiciones.every(esEnteroNoNegativo)) return null
  const posicion = d.posicion === undefined ? 0 : d.posicion
  if (!esEnteroNoNegativo(posicion)) return null

  const fijos = d.fijos === undefined ? listaVacia() : d.fijos
  const variables = d.variables === undefined ? listaVacia() : d.variables
  const ahorro = d.ahorro === undefined ? ahorroVacio() : d.ahorro
  if (!esListaGastos(fijos) || !esListaGastos(variables) || !esDatosAhorro(ahorro)) return null

  return { ...(d as unknown as Borrador), posiciones, posicion, fijos, variables, ahorro }
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
