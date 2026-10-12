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
  | 'ING_DIA_NOMBRE'
  | 'ING_DIA_META'
  | 'ING_DIA_LIBRES'
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
  | 'REV_PIENSA'
  | 'REV_RESUMEN'
  | 'REV_META'
  | 'REC_PREGUNTA'
  | 'REC_CUANDO'
  | 'FIN'
  | 'REP'

const PANTALLAS: Pantalla[] = [
  'BIE', 'REP', 'QUI', 'QUI_FAM', 'ING_TIPO', 'ING_MONTO', 'ING_FREC', 'ING_QUIEN', 'ING_VAR', 'ING_CONSEJO', 'ING_OTRO', 'ING_TOTAL',
  'ING_DIA_NOMBRE', 'ING_DIA_META', 'ING_DIA_LIBRES', 'FIJ_LISTA', 'FIJ_MONTO', 'FIJ_DIA', 'FIJ_TOTAL', 'VAR_LISTA', 'VAR_MONTO', 'VAR_SUGIERE', 'VAR_TOTAL',
  'AHO_LISTA', 'AHO_META', 'AHO_CUOTA', 'AHO_NOSE', 'REV_PIENSA', 'REV_RESUMEN', 'REV_META', 'REC_PREGUNTA', 'REC_CUANDO', 'FIN',
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
  ING_DIA_NOMBRE: 3,
  ING_DIA_META: 3,
  ING_DIA_LIBRES: 3,
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
  REV_PIENSA: 7,
  REV_RESUMEN: 7,
  REV_META: 7,
  REC_PREGUNTA: 8,
  REC_CUANDO: 8,
  FIN: 9,
  REP: 1,
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
  /** Si decidió sumar lo que sobra a una de sus metas: a cuál y cuánto. */
  extraAhorro: { meta: string; monto: number } | null
  /** Si quiere recordatorios de sus pagos fijos y con cuánta anticipación (0 = el mismo día). */
  recordatorio: { activo: boolean; diasAntes: 0 | 1 | 3 } | null
}

const CLAVE = 'tico-borrador'

/** Marca que, la primera vez que se abra Presupuesto después de crearlo, Tico explique qué se ve ahí (FIN_02). */
export const CLAVE_FIN_02 = 'tico-fin02'

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
    extraAhorro: null,
    recordatorio: null,
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
  // Antes de la revisión había una pantalla provisional («PRONTO»): se sigue desde la revisión.
  const actualizar = (p: unknown) => (p === 'PRONTO' ? 'REV_PIENSA' : p)
  const pantalla = actualizar(d.pantalla)
  if (!esPantalla(pantalla) || d.version !== 1) return null
  if (!Array.isArray(d.historial)) return null
  const historial: unknown[] = d.historial.map(actualizar)
  if (!historial.every(esPantalla)) return null
  if (d.para !== null && d.para !== 'personal' && d.para !== 'familiar') return null
  if (!Array.isArray(d.ingresos) || d.ingresos.length === 0 || !d.ingresos.every((i) => typeof i === 'object' && i !== null)) return null
  if (!esEnteroNoNegativo(d.indice) || d.indice >= d.ingresos.length) return null

  const posiciones = d.posiciones === undefined ? historial.map(() => 0) : d.posiciones
  if (!Array.isArray(posiciones) || posiciones.length !== historial.length || !posiciones.every(esEnteroNoNegativo)) return null
  const posicion = d.posicion === undefined ? 0 : d.posicion
  if (!esEnteroNoNegativo(posicion)) return null

  const fijos = d.fijos === undefined ? listaVacia() : d.fijos
  const variables = d.variables === undefined ? listaVacia() : d.variables
  const ahorro = d.ahorro === undefined ? ahorroVacio() : d.ahorro
  if (!esListaGastos(fijos) || !esListaGastos(variables) || !esDatosAhorro(ahorro)) return null

  const extra = d.extraAhorro === undefined ? null : d.extraAhorro
  if (extra !== null) {
    const e = extra as Record<string, unknown>
    if (typeof extra !== 'object' || typeof e.meta !== 'string' || typeof e.monto !== 'number' || !Number.isInteger(e.monto) || e.monto <= 0) return null
  }
  const recordatorio = d.recordatorio === undefined ? null : d.recordatorio
  if (recordatorio !== null) {
    const r = recordatorio as Record<string, unknown>
    if (typeof recordatorio !== 'object' || typeof r.activo !== 'boolean' || (r.diasAntes !== 0 && r.diasAntes !== 1 && r.diasAntes !== 3)) return null
  }

  return { ...(d as unknown as Borrador), pantalla, historial: historial as Pantalla[], posiciones, posicion, fijos, variables, ahorro, extraAhorro: extra as Borrador['extraAhorro'], recordatorio: recordatorio as Borrador['recordatorio'] }
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
