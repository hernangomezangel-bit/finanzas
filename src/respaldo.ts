import { db, type Categoria, type Movimiento, type Tipo } from './db'
import { hoy } from './fechas'

/** Súbelo cuando cambie la forma de la copia; así una app vieja no malinterpreta una copia nueva. */
export const VERSION_RESPALDO = 1
const TAMANO_MAXIMO = 20 * 1024 * 1024

export interface Respaldo {
  app: 'mis-finanzas'
  version: number
  exportadoEn: string
  categorias: Categoria[]
  movimientos: Movimiento[]
}

export async function crearRespaldo(): Promise<Respaldo> {
  // Una sola lectura para que categorías y movimientos queden coherentes entre sí.
  return db.transaction('r', db.categorias, db.movimientos, async () => ({
    app: 'mis-finanzas' as const,
    version: VERSION_RESPALDO,
    exportadoEn: new Date().toISOString(),
    categorias: await db.categorias.toArray(),
    movimientos: await db.movimientos.toArray(),
  }))
}

export function nombreArchivo(): string {
  return `finanzas-respaldo-${hoy()}.json`
}

export function aArchivo(respaldo: Respaldo, tipo = 'application/json'): File {
  return new File([JSON.stringify(respaldo, null, 2)], nombreArchivo(), { type: tipo })
}

// ---------- Validación ----------

type Objeto = Record<string, unknown>

function falla(mensaje: string): never {
  throw new Error(mensaje)
}

const esObjeto = (x: unknown): x is Objeto => typeof x === 'object' && x !== null && !Array.isArray(x)
const esEntero = (x: unknown): x is number => typeof x === 'number' && Number.isSafeInteger(x)
const esTipo = (x: unknown): x is Tipo => x === 'gasto' || x === 'ingreso'

function esFechaValida(x: unknown): x is string {
  if (typeof x !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(x)) return false
  const [a, m, d] = x.split('-').map(Number)
  const f = new Date(a, m - 1, d)
  return f.getFullYear() === a && f.getMonth() === m - 1 && f.getDate() === d
}

function validarCategoria(c: unknown, i: number): Categoria {
  if (!esObjeto(c)) return falla(`La categoría ${i + 1} no tiene el formato esperado.`)
  if (!esEntero(c.id) || c.id <= 0) return falla(`La categoría ${i + 1} no tiene un identificador válido.`)
  if (typeof c.nombre !== 'string' || !c.nombre.trim() || c.nombre.length > 40) return falla(`La categoría ${i + 1} tiene un nombre no válido.`)
  if (!esTipo(c.tipo)) return falla(`La categoría "${c.nombre}" tiene un tipo no válido.`)
  if (typeof c.icono !== 'string' || c.icono.length > 8) return falla(`La categoría "${c.nombre}" tiene un ícono no válido.`)
  if (c.oculta !== undefined && typeof c.oculta !== 'boolean') return falla(`La categoría "${c.nombre}" tiene un dato no válido.`)
  return { id: c.id, nombre: c.nombre, tipo: c.tipo, icono: c.icono, ...(c.oculta ? { oculta: true } : {}) }
}

function validarMovimiento(m: unknown, i: number, categoriasPorId: Map<number, Categoria>): Movimiento {
  if (!esObjeto(m)) return falla(`El movimiento ${i + 1} no tiene el formato esperado.`)
  if (!esEntero(m.id) || m.id <= 0) return falla(`El movimiento ${i + 1} no tiene un identificador válido.`)
  if (!esTipo(m.tipo)) return falla(`El movimiento ${i + 1} tiene un tipo no válido.`)
  if (!esEntero(m.monto) || m.monto <= 0) return falla(`El movimiento ${i + 1} tiene un monto no válido.`)
  if (!esEntero(m.categoriaId) || !categoriasPorId.has(m.categoriaId)) return falla(`El movimiento ${i + 1} usa una categoría que no existe en la copia.`)
  if (!esFechaValida(m.fecha)) return falla(`El movimiento ${i + 1} tiene una fecha no válida.`)
  if (typeof m.nota !== 'string' || m.nota.length > 200) return falla(`El movimiento ${i + 1} tiene una nota no válida.`)
  return { id: m.id, tipo: m.tipo, monto: m.monto, categoriaId: m.categoriaId, fecha: m.fecha, nota: m.nota }
}

function sinRepetidos(ids: number[], que: string) {
  if (new Set(ids).size !== ids.length) falla(`La copia tiene ${que} repetidos.`)
}

/** Lee un archivo y devuelve la copia ya comprobada, o lanza un Error con un mensaje en español. */
export async function leerRespaldo(archivo: File): Promise<Respaldo> {
  if (archivo.size > TAMANO_MAXIMO) falla('El archivo es demasiado grande para ser una copia de esta app.')

  let datos: unknown
  try {
    datos = JSON.parse(await archivo.text())
  } catch {
    return falla('El archivo no se pudo leer. ¿Es una copia de seguridad de esta app?')
  }

  if (!esObjeto(datos) || datos.app !== 'mis-finanzas') falla('Este archivo no es una copia de seguridad de Mis Finanzas.')
  if (!esEntero(datos.version) || datos.version < 1) falla('La copia no indica su versión.')
  if (datos.version > VERSION_RESPALDO) falla('Esta copia es de una versión más nueva de la app. Actualiza la app e inténtalo de nuevo.')
  if (typeof datos.exportadoEn !== 'string' || Number.isNaN(Date.parse(datos.exportadoEn))) falla('La copia no tiene una fecha válida.')
  if (!Array.isArray(datos.categorias) || !Array.isArray(datos.movimientos)) falla('A la copia le faltan datos.')

  const categorias = datos.categorias.map(validarCategoria)
  sinRepetidos(categorias.map((c) => c.id!), 'identificadores de categoría')
  const categoriasPorId = new Map(categorias.map((c) => [c.id!, c]))
  const movimientos = datos.movimientos.map((m, i) => validarMovimiento(m, i, categoriasPorId))
  sinRepetidos(movimientos.map((m) => m.id!), 'identificadores de movimiento')

  return { app: 'mis-finanzas', version: datos.version, exportadoEn: datos.exportadoEn, categorias, movimientos }
}

/** Reemplaza todo lo que hay en el teléfono por el contenido de la copia (todo o nada). */
export async function restaurarRespaldo(respaldo: Respaldo): Promise<void> {
  await db.transaction('rw', db.categorias, db.movimientos, async () => {
    await db.categorias.clear()
    await db.movimientos.clear()
    await db.categorias.bulkAdd(respaldo.categorias)
    await db.movimientos.bulkAdd(respaldo.movimientos)
  })
}

// ---------- Recordatorio ----------

const CLAVE_ULTIMO = 'ultimoRespaldo'
const CLAVE_POSPUESTO = 'avisoRespaldoHasta'
export const DIAS_ENTRE_AVISOS = 7
const DIA_MS = 24 * 60 * 60 * 1000

function leer(clave: string): string | null {
  try {
    return localStorage.getItem(clave)
  } catch {
    return null
  }
}

function guardar(clave: string, valor: string) {
  try {
    localStorage.setItem(clave, valor)
  } catch {
    // Sin almacenamiento simple, solo se pierde el recordatorio; los datos no se tocan.
  }
}

export function ultimoRespaldo(): Date | null {
  const texto = leer(CLAVE_ULTIMO)
  const fecha = texto ? new Date(texto) : null
  return fecha && !Number.isNaN(fecha.getTime()) ? fecha : null
}

export function marcarRespaldoHecho() {
  guardar(CLAVE_ULTIMO, new Date().toISOString())
}

export function posponerAviso(dias = 2) {
  guardar(CLAVE_POSPUESTO, new Date(Date.now() + dias * DIA_MS).toISOString())
}

export function diasDesde(fecha: Date): number {
  return Math.floor((Date.now() - fecha.getTime()) / DIA_MS)
}

export function debeAvisar(): boolean {
  const hasta = leer(CLAVE_POSPUESTO)
  if (hasta && Date.now() < Date.parse(hasta)) return false
  const ultimo = ultimoRespaldo()
  return ultimo === null || diasDesde(ultimo) >= DIAS_ENTRE_AVISOS
}
