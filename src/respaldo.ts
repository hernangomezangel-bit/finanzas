import {
  db,
  type Ajuste,
  type Aporte,
  type Categoria,
  type Deuda,
  type Fuente,
  type Jornada,
  type Meta,
  type Movimiento,
  type Ocurrencia,
  type PagoDeuda,
  type Programado,
  type ProgramaAhorro,
  type Recurrente,
  type Tipo,
  type TipoMeta,
} from './db'
import { hoy } from './fechas'
import type { TipoTasa } from './plan'

/**
 * Súbelo cuando cambie la forma de la copia; así una app vieja no malinterpreta una copia nueva.
 * Versión 1: categorías y movimientos. Versión 2: agrega metas y aportes de ahorro.
 * Versión 3: agrega deudas, pagos de deudas y las preferencias del plan.
 * Versión 4: agrega movimientos recurrentes y sus vencimientos, y marca los ingresos variables.
 * Versión 5: agrega los trabajos por días con meta diaria y sus jornadas.
 * Versión 6: las deudas guardan desde cuándo se proponen sus cuotas, y los pagos pueden ser cuotas omitidas.
 * Versión 7: las metas de ahorro pueden ser un ahorro programado (cuota fija), y los aportes pueden ser cuotas omitidas.
 * Versión 8: los gastos pueden ser cuotas programadas de deudas o ahorros que la app creó sola.
 * Versión 9: también los movimientos recurrentes (gastos e ingresos fijos) se programan por adelantado.
 */
export const VERSION_RESPALDO = 9
const TAMANO_MAXIMO = 20 * 1024 * 1024

export interface Respaldo {
  app: 'mis-finanzas'
  version: number
  exportadoEn: string
  categorias: Categoria[]
  movimientos: Movimiento[]
  metas: Meta[]
  aportes: Aporte[]
  deudas: Deuda[]
  pagosDeuda: PagoDeuda[]
  ajustes: Ajuste[]
  recurrentes: Recurrente[]
  ocurrencias: Ocurrencia[]
  fuentes: Fuente[]
  jornadas: Jornada[]
}

export async function crearRespaldo(): Promise<Respaldo> {
  // Una sola lectura para que todas las tablas queden coherentes entre sí.
  return db.transaction(
    'r',
    [
      db.categorias, db.movimientos, db.metas, db.aportes, db.deudas, db.pagosDeuda, db.ajustes,
      db.recurrentes, db.ocurrencias, db.fuentes, db.jornadas,
    ],
    async () => ({
      app: 'mis-finanzas' as const,
      version: VERSION_RESPALDO,
      exportadoEn: new Date().toISOString(),
      categorias: await db.categorias.toArray(),
      movimientos: await db.movimientos.toArray(),
      metas: await db.metas.toArray(),
      aportes: await db.aportes.toArray(),
      deudas: await db.deudas.toArray(),
      pagosDeuda: await db.pagosDeuda.toArray(),
      ajustes: await db.ajustes.toArray(),
      recurrentes: await db.recurrentes.toArray(),
      ocurrencias: await db.ocurrencias.toArray(),
      fuentes: await db.fuentes.toArray(),
      jornadas: await db.jornadas.toArray(),
    }),
  )
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
  if (c.clave !== undefined && c.clave !== 'ahorro' && c.clave !== 'deudas') return falla(`La categoría "${c.nombre}" tiene un dato no válido.`)
  if (c.variable !== undefined && typeof c.variable !== 'boolean') return falla(`La categoría "${c.nombre}" tiene un dato no válido.`)
  return {
    id: c.id,
    nombre: c.nombre,
    tipo: c.tipo,
    icono: c.icono,
    ...(c.oculta ? { oculta: true } : {}),
    ...(c.clave ? { clave: c.clave } : {}),
    ...(c.variable ? { variable: true } : {}),
  }
}

function validarRecurrente(r: unknown, i: number, categoriasPorId: Map<number, Categoria>): Recurrente {
  if (!esObjeto(r)) return falla(`El recurrente ${i + 1} no tiene el formato esperado.`)
  if (!esEntero(r.id) || r.id <= 0) return falla(`El recurrente ${i + 1} no tiene un identificador válido.`)
  if (typeof r.nombre !== 'string' || !r.nombre.trim() || r.nombre.length > 40) return falla(`El recurrente ${i + 1} tiene un nombre no válido.`)
  if (!esTipo(r.tipo)) return falla(`El recurrente "${r.nombre}" tiene un tipo no válido.`)
  if (!esEntero(r.monto) || r.monto <= 0) return falla(`El recurrente "${r.nombre}" tiene un monto no válido.`)
  if (!esEntero(r.categoriaId) || !categoriasPorId.has(r.categoriaId)) return falla(`El recurrente "${r.nombre}" usa una categoría que no existe en la copia.`)
  if (typeof r.nota !== 'string' || r.nota.length > 200) return falla(`El recurrente "${r.nombre}" tiene una nota no válida.`)
  if (!Array.isArray(r.dias) || r.dias.length < 1 || r.dias.length > 4 || !r.dias.every((d) => esEntero(d) && d >= 1 && d <= 31)) {
    return falla(`El recurrente "${r.nombre}" tiene días no válidos.`)
  }
  if (!esFechaValida(r.creado)) return falla(`El recurrente "${r.nombre}" tiene una fecha de inicio no válida.`)
  if (typeof r.activo !== 'boolean') return falla(`El recurrente "${r.nombre}" tiene un dato no válido.`)
  return {
    id: r.id,
    nombre: r.nombre,
    tipo: r.tipo,
    monto: r.monto,
    categoriaId: r.categoriaId,
    nota: r.nota,
    dias: [...new Set(r.dias as number[])].sort((a, b) => a - b),
    creado: r.creado,
    activo: r.activo,
  }
}

function validarFuente(f: unknown, i: number, categoriasPorId: Map<number, Categoria>): Fuente {
  if (!esObjeto(f)) return falla(`El trabajo por días ${i + 1} no tiene el formato esperado.`)
  if (!esEntero(f.id) || f.id <= 0) return falla(`El trabajo por días ${i + 1} no tiene un identificador válido.`)
  if (typeof f.nombre !== 'string' || !f.nombre.trim() || f.nombre.length > 40) return falla(`El trabajo por días ${i + 1} tiene un nombre no válido.`)
  if (!esEntero(f.metaDiaria) || f.metaDiaria <= 0) return falla(`"${f.nombre}" tiene una meta diaria no válida.`)
  if (!esEntero(f.categoriaId) || !categoriasPorId.has(f.categoriaId)) return falla(`"${f.nombre}" usa una categoría que no existe en la copia.`)
  if (!Array.isArray(f.diasLibres) || f.diasLibres.length > 6 || !f.diasLibres.every((d) => esEntero(d) && d >= 0 && d <= 6)) {
    return falla(`"${f.nombre}" tiene días libres no válidos.`)
  }
  if (!esFechaValida(f.creado)) return falla(`"${f.nombre}" tiene una fecha de inicio no válida.`)
  if (typeof f.activo !== 'boolean') return falla(`"${f.nombre}" tiene un dato no válido.`)
  return {
    id: f.id,
    nombre: f.nombre,
    metaDiaria: f.metaDiaria,
    categoriaId: f.categoriaId,
    diasLibres: [...new Set(f.diasLibres as number[])].sort((a, b) => a - b),
    creado: f.creado,
    activo: f.activo,
  }
}

function validarJornada(j: unknown, i: number, fuentesPorId: Set<number>, movimientosPorId: Set<number>): Jornada {
  if (!esObjeto(j)) return falla(`La jornada ${i + 1} no tiene el formato esperado.`)
  if (!esEntero(j.id) || j.id <= 0) return falla(`La jornada ${i + 1} no tiene un identificador válido.`)
  if (!esEntero(j.fuenteId) || !fuentesPorId.has(j.fuenteId)) return falla(`La jornada ${i + 1} usa un trabajo que no existe en la copia.`)
  if (!esFechaValida(j.fecha)) return falla(`La jornada ${i + 1} tiene una fecha no válida.`)
  if (j.estado !== 'trabajada' && j.estado !== 'descanso') return falla(`La jornada ${i + 1} tiene un estado no válido.`)
  if (j.estado === 'trabajada' && (!esEntero(j.monto) || j.monto <= 0)) return falla(`La jornada ${i + 1} tiene un monto no válido.`)
  if (j.movimientoId !== undefined && !esEntero(j.movimientoId)) return falla(`La jornada ${i + 1} tiene un dato no válido.`)
  const enlazado = j.movimientoId !== undefined && movimientosPorId.has(j.movimientoId)
  return {
    id: j.id,
    fuenteId: j.fuenteId,
    fecha: j.fecha,
    estado: j.estado,
    ...(j.estado === 'trabajada' ? { monto: j.monto as number } : {}),
    ...(enlazado ? { movimientoId: j.movimientoId as number } : {}),
  }
}

function validarOcurrencia(o: unknown, i: number, recurrentesPorId: Set<number>, movimientosPorId: Set<number>): Ocurrencia {
  if (!esObjeto(o)) return falla(`El vencimiento ${i + 1} no tiene el formato esperado.`)
  if (!esEntero(o.id) || o.id <= 0) return falla(`El vencimiento ${i + 1} no tiene un identificador válido.`)
  if (!esEntero(o.recurrenteId) || !recurrentesPorId.has(o.recurrenteId)) return falla(`El vencimiento ${i + 1} usa un recurrente que no existe en la copia.`)
  if (!esFechaValida(o.fecha)) return falla(`El vencimiento ${i + 1} tiene una fecha no válida.`)
  if (o.estado !== 'registrada' && o.estado !== 'omitida') return falla(`El vencimiento ${i + 1} tiene un estado no válido.`)
  if (o.movimientoId !== undefined && !esEntero(o.movimientoId)) return falla(`El vencimiento ${i + 1} tiene un dato no válido.`)
  const enlazado = o.movimientoId !== undefined && movimientosPorId.has(o.movimientoId)
  return {
    id: o.id,
    recurrenteId: o.recurrenteId,
    fecha: o.fecha,
    estado: o.estado,
    ...(enlazado ? { movimientoId: o.movimientoId as number } : {}),
  }
}

const esTipoMeta = (x: unknown): x is TipoMeta => x === 'inversion' || x === 'gasto'

function validarMeta(m: unknown, i: number): Meta {
  if (!esObjeto(m)) return falla(`La meta ${i + 1} no tiene el formato esperado.`)
  if (!esEntero(m.id) || m.id <= 0) return falla(`La meta ${i + 1} no tiene un identificador válido.`)
  if (typeof m.nombre !== 'string' || !m.nombre.trim() || m.nombre.length > 40) return falla(`La meta ${i + 1} tiene un nombre no válido.`)
  if (!esTipoMeta(m.tipo)) return falla(`La meta "${m.nombre}" tiene un tipo no válido.`)
  if (!esEntero(m.objetivo) || m.objetivo <= 0) return falla(`La meta "${m.nombre}" tiene un objetivo no válido.`)
  if (m.fechaMeta !== undefined && !esFechaValida(m.fechaMeta)) return falla(`La meta "${m.nombre}" tiene una fecha no válida.`)
  if (typeof m.icono !== 'string' || m.icono.length > 8) return falla(`La meta "${m.nombre}" tiene un ícono no válido.`)
  if (!esFechaValida(m.creada)) return falla(`La meta "${m.nombre}" tiene una fecha de creación no válida.`)
  if (m.archivada !== undefined && typeof m.archivada !== 'boolean') return falla(`La meta "${m.nombre}" tiene un dato no válido.`)
  const programa = m.programa === undefined ? undefined : validarPrograma(m.programa, m.nombre)
  // Sin fecha final, un ahorro programado se propondría para siempre.
  if (programa && !m.fechaMeta) return falla(`La meta "${m.nombre}" tiene un ahorro programado sin fecha final.`)
  return {
    id: m.id,
    nombre: m.nombre,
    tipo: m.tipo,
    objetivo: m.objetivo,
    icono: m.icono,
    creada: m.creada,
    ...(m.fechaMeta ? { fechaMeta: m.fechaMeta } : {}),
    ...(m.archivada ? { archivada: true } : {}),
    ...(programa ? { programa } : {}),
  }
}

function validarPrograma(p: unknown, nombre: string): ProgramaAhorro {
  if (!esObjeto(p)) return falla(`El ahorro programado de "${nombre}" no tiene el formato esperado.`)
  if (!esEntero(p.cuota) || p.cuota <= 0) return falla(`El ahorro programado de "${nombre}" tiene una cuota no válida.`)
  if (p.frecuencia !== 'diaria' && p.frecuencia !== 'semanal' && p.frecuencia !== 'mensual') {
    return falla(`El ahorro programado de "${nombre}" tiene una frecuencia no válida.`)
  }
  const dia = p.dia
  const diaValido =
    p.frecuencia === 'diaria' ? dia === 0 : p.frecuencia === 'semanal' ? esEntero(dia) && dia >= 0 && dia <= 6 : esEntero(dia) && dia >= 1 && dia <= 31
  if (!diaValido) return falla(`El ahorro programado de "${nombre}" tiene un día no válido.`)
  if (!esFechaValida(p.inicio)) return falla(`El ahorro programado de "${nombre}" tiene una fecha de inicio no válida.`)
  return { cuota: p.cuota, frecuencia: p.frecuencia, dia: dia as number, inicio: p.inicio }
}

function validarAporte(a: unknown, i: number, metasPorId: Set<number>, movimientosPorId: Set<number>): Aporte {
  if (!esObjeto(a)) return falla(`El aporte ${i + 1} no tiene el formato esperado.`)
  if (!esEntero(a.id) || a.id <= 0) return falla(`El aporte ${i + 1} no tiene un identificador válido.`)
  if (!esEntero(a.metaId) || !metasPorId.has(a.metaId)) return falla(`El aporte ${i + 1} usa una meta que no existe en la copia.`)
  if (a.omitida !== undefined && typeof a.omitida !== 'boolean') return falla(`El aporte ${i + 1} tiene un dato no válido.`)
  const omitida = a.omitida === true
  // Una cuota omitida no es un aporte: no suma dinero y siempre indica a qué cuota se refiere.
  if (omitida) {
    if (a.monto !== 0) return falla(`La cuota omitida ${i + 1} no puede tener dinero.`)
    if (!esFechaValida(a.fechaCuota)) return falla(`La cuota omitida ${i + 1} no indica su fecha.`)
  } else if (!esEntero(a.monto) || a.monto <= 0) {
    return falla(`El aporte ${i + 1} tiene un monto no válido.`)
  }
  if (!esFechaValida(a.fecha)) return falla(`El aporte ${i + 1} tiene una fecha no válida.`)
  if (a.fechaCuota !== undefined && !esFechaValida(a.fechaCuota)) return falla(`El aporte ${i + 1} tiene una fecha de cuota no válida.`)
  if (typeof a.nota !== 'string' || a.nota.length > 200) return falla(`El aporte ${i + 1} tiene una nota no válida.`)
  if (a.movimientoId !== undefined && !esEntero(a.movimientoId)) return falla(`El aporte ${i + 1} tiene un dato no válido.`)
  // Si el gasto enlazado se borró del Presupuesto, el aporte sigue valiendo; solo se suelta el enlace.
  const enlazado = a.movimientoId !== undefined && movimientosPorId.has(a.movimientoId)
  return {
    id: a.id,
    metaId: a.metaId,
    monto: a.monto as number,
    fecha: a.fecha,
    nota: a.nota,
    ...(enlazado ? { movimientoId: a.movimientoId as number } : {}),
    ...(a.fechaCuota ? { fechaCuota: a.fechaCuota } : {}),
    ...(omitida ? { omitida: true } : {}),
  }
}

/** `propuestasDesdeSiFalta`: para copias anteriores a la versión 6, que no traen esa fecha. */
function validarDeuda(d: unknown, i: number, propuestasDesdeSiFalta?: string): Deuda {
  if (!esObjeto(d)) return falla(`La deuda ${i + 1} no tiene el formato esperado.`)
  if (!esEntero(d.id) || d.id <= 0) return falla(`La deuda ${i + 1} no tiene un identificador válido.`)
  if (typeof d.nombre !== 'string' || !d.nombre.trim() || d.nombre.length > 40) return falla(`La deuda ${i + 1} tiene un nombre no válido.`)
  if (typeof d.icono !== 'string' || d.icono.length > 8) return falla(`La deuda "${d.nombre}" tiene un ícono no válido.`)
  if (!esEntero(d.saldoInicial) || d.saldoInicial <= 0) return falla(`La deuda "${d.nombre}" tiene un saldo no válido.`)
  if (typeof d.tasa !== 'number' || !Number.isFinite(d.tasa) || d.tasa < 0 || d.tasa > 1000) return falla(`La deuda "${d.nombre}" tiene una tasa no válida.`)
  if (d.tipoTasa !== 'ea' && d.tipoTasa !== 'mensual') return falla(`La deuda "${d.nombre}" tiene un tipo de tasa no válido.`)
  if (!esEntero(d.pagoMinimo) || d.pagoMinimo <= 0) return falla(`La deuda "${d.nombre}" tiene un pago mínimo no válido.`)
  if (d.diaPago !== undefined && (!esEntero(d.diaPago) || d.diaPago < 1 || d.diaPago > 31)) return falla(`La deuda "${d.nombre}" tiene un día de pago no válido.`)
  if (!esFechaValida(d.creada)) return falla(`La deuda "${d.nombre}" tiene una fecha de creación no válida.`)
  if (d.propuestasDesde !== undefined && !esFechaValida(d.propuestasDesde)) return falla(`La deuda "${d.nombre}" tiene una fecha de inicio de propuestas no válida.`)
  const propuestasDesde = (d.propuestasDesde as string | undefined) ?? propuestasDesdeSiFalta
  return {
    id: d.id,
    nombre: d.nombre,
    icono: d.icono,
    saldoInicial: d.saldoInicial,
    tasa: d.tasa,
    tipoTasa: d.tipoTasa as TipoTasa,
    pagoMinimo: d.pagoMinimo,
    creada: d.creada,
    ...(d.diaPago !== undefined ? { diaPago: d.diaPago } : {}),
    ...(propuestasDesde ? { propuestasDesde } : {}),
  }
}

function validarPagoDeuda(p: unknown, i: number, deudasPorId: Set<number>, movimientosPorId: Set<number>): PagoDeuda {
  if (!esObjeto(p)) return falla(`El pago de deuda ${i + 1} no tiene el formato esperado.`)
  if (!esEntero(p.id) || p.id <= 0) return falla(`El pago de deuda ${i + 1} no tiene un identificador válido.`)
  if (!esEntero(p.deudaId) || !deudasPorId.has(p.deudaId)) return falla(`El pago de deuda ${i + 1} usa una deuda que no existe en la copia.`)
  if (p.omitida !== undefined && typeof p.omitida !== 'boolean') return falla(`El pago de deuda ${i + 1} tiene un dato no válido.`)
  const omitida = p.omitida === true
  // Una cuota omitida no es un pago: no mueve dinero y siempre indica a qué cuota se refiere.
  if (omitida) {
    if (p.monto !== 0 || p.interes !== 0 || p.aCapital !== 0) return falla(`La cuota omitida ${i + 1} no puede tener dinero.`)
    if (!esFechaValida(p.fechaCuota)) return falla(`La cuota omitida ${i + 1} no indica su fecha.`)
  } else {
    if (!esEntero(p.monto) || p.monto <= 0) return falla(`El pago de deuda ${i + 1} tiene un monto no válido.`)
    if (!esEntero(p.interes) || p.interes < 0) return falla(`El pago de deuda ${i + 1} tiene un interés no válido.`)
    if (!esEntero(p.aCapital)) return falla(`El pago de deuda ${i + 1} tiene un dato no válido.`)
  }
  if (!esFechaValida(p.fecha)) return falla(`El pago de deuda ${i + 1} tiene una fecha no válida.`)
  if (p.fechaCuota !== undefined && !esFechaValida(p.fechaCuota)) return falla(`El pago de deuda ${i + 1} tiene una fecha de cuota no válida.`)
  if (p.movimientoId !== undefined && !esEntero(p.movimientoId)) return falla(`El pago de deuda ${i + 1} tiene un dato no válido.`)
  const enlazado = p.movimientoId !== undefined && movimientosPorId.has(p.movimientoId)
  return {
    id: p.id,
    deudaId: p.deudaId,
    monto: p.monto as number,
    interes: p.interes as number,
    aCapital: p.aCapital as number,
    fecha: p.fecha,
    ...(p.fechaCuota ? { fechaCuota: p.fechaCuota } : {}),
    ...(enlazado ? { movimientoId: p.movimientoId as number } : {}),
    ...(omitida ? { omitida: true } : {}),
  }
}

function validarAjuste(a: unknown, i: number): Ajuste {
  if (!esObjeto(a)) return falla(`La preferencia ${i + 1} no tiene el formato esperado.`)
  if (a.clave === 'deudaExtra' && esEntero(a.valor) && a.valor >= 0) return { clave: 'deudaExtra', valor: a.valor }
  if (a.clave === 'deudaEstrategia' && (a.valor === 'bola' || a.valor === 'avalancha')) {
    return { clave: 'deudaEstrategia', valor: a.valor }
  }
  return falla(`La preferencia ${i + 1} no es válida.`)
}

function validarMovimiento(m: unknown, i: number, categoriasPorId: Map<number, Categoria>): Movimiento {
  if (!esObjeto(m)) return falla(`El movimiento ${i + 1} no tiene el formato esperado.`)
  if (!esEntero(m.id) || m.id <= 0) return falla(`El movimiento ${i + 1} no tiene un identificador válido.`)
  if (!esTipo(m.tipo)) return falla(`El movimiento ${i + 1} tiene un tipo no válido.`)
  if (!esEntero(m.monto) || m.monto <= 0) return falla(`El movimiento ${i + 1} tiene un monto no válido.`)
  if (!esEntero(m.categoriaId) || !categoriasPorId.has(m.categoriaId)) return falla(`El movimiento ${i + 1} usa una categoría que no existe en la copia.`)
  if (!esFechaValida(m.fecha)) return falla(`El movimiento ${i + 1} tiene una fecha no válida.`)
  if (typeof m.nota !== 'string' || m.nota.length > 200) return falla(`El movimiento ${i + 1} tiene una nota no válida.`)
  const programado = m.programado === undefined ? undefined : validarProgramado(m.programado, i)
  return {
    id: m.id,
    tipo: m.tipo,
    monto: m.monto,
    categoriaId: m.categoriaId,
    fecha: m.fecha,
    nota: m.nota,
    ...(programado ? { programado } : {}),
  }
}

function validarProgramado(p: unknown, i: number): Programado {
  if (!esObjeto(p)) return falla(`El gasto programado ${i + 1} no tiene el formato esperado.`)
  if (p.origen !== 'deuda' && p.origen !== 'ahorro' && p.origen !== 'recurrente') return falla(`El movimiento programado ${i + 1} tiene un origen no válido.`)
  if (!esEntero(p.refId) || p.refId <= 0) return falla(`El gasto programado ${i + 1} tiene un dato no válido.`)
  if (!esFechaValida(p.fechaCuota)) return falla(`El gasto programado ${i + 1} tiene una fecha de cuota no válida.`)
  if (!esEntero(p.montoPlan) || p.montoPlan <= 0) return falla(`El gasto programado ${i + 1} tiene un monto no válido.`)
  return { origen: p.origen, refId: p.refId, fechaCuota: p.fechaCuota, montoPlan: p.montoPlan }
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
  // Las copias de la versión 1 son anteriores a los ahorros: no traen metas ni aportes.
  const metasCrudas = datos.version >= 2 ? datos.metas : []
  const aportesCrudos = datos.version >= 2 ? datos.aportes : []
  // Las de la versión 2 son anteriores a las deudas.
  const deudasCrudas = datos.version >= 3 ? datos.deudas : []
  const pagosCrudos = datos.version >= 3 ? datos.pagosDeuda : []
  const ajustesCrudos = datos.version >= 3 ? datos.ajustes : []
  // Las de la versión 3 son anteriores a los recurrentes.
  const recurrentesCrudos = datos.version >= 4 ? datos.recurrentes : []
  const ocurrenciasCrudas = datos.version >= 4 ? datos.ocurrencias : []
  // Las de la versión 4 son anteriores a los trabajos por días.
  const fuentesCrudas = datos.version >= 5 ? datos.fuentes : []
  const jornadasCrudas = datos.version >= 5 ? datos.jornadas : []
  if (
    !Array.isArray(metasCrudas) || !Array.isArray(aportesCrudos) ||
    !Array.isArray(deudasCrudas) || !Array.isArray(pagosCrudos) || !Array.isArray(ajustesCrudos) ||
    !Array.isArray(recurrentesCrudos) || !Array.isArray(ocurrenciasCrudas) ||
    !Array.isArray(fuentesCrudas) || !Array.isArray(jornadasCrudas)
  ) {
    falla('A la copia le faltan datos.')
  }

  const categorias = datos.categorias.map(validarCategoria)
  sinRepetidos(categorias.map((c) => c.id!), 'identificadores de categoría')
  const categoriasPorId = new Map(categorias.map((c) => [c.id!, c]))
  const movimientos = datos.movimientos.map((m, i) => validarMovimiento(m, i, categoriasPorId))
  sinRepetidos(movimientos.map((m) => m.id!), 'identificadores de movimiento')

  const metas = metasCrudas.map(validarMeta)
  sinRepetidos(metas.map((m) => m.id!), 'identificadores de meta')
  const aportes = aportesCrudos.map((a, i) =>
    validarAporte(a, i, new Set(metas.map((m) => m.id!)), new Set(movimientos.map((m) => m.id!))),
  )
  sinRepetidos(aportes.map((a) => a.id!), 'identificadores de aporte')

  // Las copias anteriores a la versión 6 no traen desde cuándo se proponen las cuotas: se empieza hoy.
  const versionCopia = datos.version
  const deudas = deudasCrudas.map((d, i) => validarDeuda(d, i, versionCopia < 6 ? hoy() : undefined))
  sinRepetidos(deudas.map((d) => d.id!), 'identificadores de deuda')
  const pagosDeuda = pagosCrudos.map((p, i) =>
    validarPagoDeuda(p, i, new Set(deudas.map((d) => d.id!)), new Set(movimientos.map((m) => m.id!))),
  )
  sinRepetidos(pagosDeuda.map((p) => p.id!), 'identificadores de pago de deuda')
  const ajustes = ajustesCrudos.map(validarAjuste)
  if (new Set(ajustes.map((a) => a.clave)).size !== ajustes.length) falla('La copia tiene preferencias repetidas.')

  const recurrentes = recurrentesCrudos.map((r, i) => validarRecurrente(r, i, categoriasPorId))
  sinRepetidos(recurrentes.map((r) => r.id!), 'identificadores de recurrente')
  const ocurrencias = ocurrenciasCrudas.map((o, i) =>
    validarOcurrencia(o, i, new Set(recurrentes.map((r) => r.id!)), new Set(movimientos.map((m) => m.id!))),
  )
  sinRepetidos(ocurrencias.map((o) => o.id!), 'identificadores de vencimiento')

  const fuentes = fuentesCrudas.map((f, i) => validarFuente(f, i, categoriasPorId))
  sinRepetidos(fuentes.map((f) => f.id!), 'identificadores de trabajo por días')
  const jornadas = jornadasCrudas.map((j, i) =>
    validarJornada(j, i, new Set(fuentes.map((f) => f.id!)), new Set(movimientos.map((m) => m.id!))),
  )
  sinRepetidos(jornadas.map((j) => j.id!), 'identificadores de jornada')

  // Un gasto programado cuya deuda o meta no está en la copia ya no tiene de dónde venir: queda como un gasto normal.
  const deudasIds = new Set(deudas.map((d) => d.id!))
  const metasIds = new Set(metas.map((m) => m.id!))
  const recurrentesIds = new Set(recurrentes.map((r) => r.id!))
  const origenes = { deuda: deudasIds, ahorro: metasIds, recurrente: recurrentesIds }
  const movimientosFinales = movimientos.map(({ programado, ...resto }): Movimiento =>
    programado && origenes[programado.origen].has(programado.refId) ? { ...resto, programado } : resto,
  )

  return {
    app: 'mis-finanzas',
    version: datos.version,
    exportadoEn: datos.exportadoEn,
    categorias,
    movimientos: movimientosFinales,
    metas,
    aportes,
    deudas,
    pagosDeuda,
    ajustes,
    recurrentes,
    ocurrencias,
    fuentes,
    jornadas,
  }
}

/** Reemplaza todo lo que hay en el teléfono por el contenido de la copia (todo o nada). */
export async function restaurarRespaldo(respaldo: Respaldo): Promise<void> {
  const tablas = [
    db.categorias, db.movimientos, db.metas, db.aportes, db.deudas, db.pagosDeuda, db.ajustes,
    db.recurrentes, db.ocurrencias, db.fuentes, db.jornadas,
  ]
  await db.transaction('rw', tablas, async () => {
    await Promise.all(tablas.map((t) => t.clear()))
    await db.categorias.bulkAdd(respaldo.categorias)
    await db.movimientos.bulkAdd(respaldo.movimientos)
    await db.metas.bulkAdd(respaldo.metas)
    await db.aportes.bulkAdd(respaldo.aportes)
    await db.deudas.bulkAdd(respaldo.deudas)
    await db.pagosDeuda.bulkAdd(respaldo.pagosDeuda)
    await db.ajustes.bulkAdd(respaldo.ajustes)
    await db.recurrentes.bulkAdd(respaldo.recurrentes)
    await db.ocurrencias.bulkAdd(respaldo.ocurrencias)
    await db.fuentes.bulkAdd(respaldo.fuentes)
    await db.jornadas.bulkAdd(respaldo.jornadas)
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
