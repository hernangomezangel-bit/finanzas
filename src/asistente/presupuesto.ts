// Del borrador del asistente al presupuesto real: la revisión (sobra o falta) y el plan de lo que se va a crear en la app.
// Código puro, sin pantalla ni base de datos, así se puede probar solo.
import { metasContadas } from './ahorro.ts'
import { ingresosActivos, type Borrador } from './borrador.ts'
import { gastosContados, totalLista } from './gastos.ts'
import { esIngresoCompleto, mensualDe, totalIngresosMensual } from './ingresos.ts'
import { OPCIONES_FIJOS, OPCIONES_VARIABLES } from './textos.ts'

// ---------- Revisión (Paso 7) ----------

export interface FilaEditable {
  /** `variable` o `ahorro`, y el id de la opción o de la meta. */
  tipo: 'variable' | 'ahorro'
  id: string
  etiqueta: string
  monto: number
}

/** Las metas de ahorro con su aporte mensual, sumando lo que la persona decidió pasarles del sobrante. */
export function ahorroDeMetas(b: Borrador): { id: string; nombre: string; objetivo: number | null; cuota: number }[] {
  return metasContadas(b.ahorro).map((m) => (b.extraAhorro && b.extraAhorro.meta === m.id ? { ...m, cuota: m.cuota + b.extraAhorro.monto } : m))
}

export interface Revision {
  ingresos: number
  fijos: number
  variables: number
  ahorro: number
  /** Ingresos menos todo lo planeado: positivo sobra, cero cuadra, negativo falta. */
  sobrante: number
}

export function revisar(b: Borrador): Revision {
  const ingresos = totalIngresosMensual(ingresosActivos(b))
  const fijos = totalLista(b.fijos)
  const variables = totalLista(b.variables)
  const ahorro = ahorroDeMetas(b).reduce((suma, m) => suma + m.cuota, 0)
  return { ingresos, fijos, variables, ahorro, sobrante: ingresos - fijos - variables - ahorro }
}

/** ¿Este monto es mayor que todo lo que entra al mes? (Si no hay ingresos con qué comparar, no se avisa.) */
export function superaLosIngresos(b: Borrador, valor: number): boolean {
  const ingresos = totalIngresosMensual(ingresosActivos(b))
  return ingresos > 0 && valor > ingresos
}

/** Lo que se puede editar cuando lo planeado supera lo que entra: los 3 gastos variables más altos y cada ahorro. */
export function filasParaAjustar(b: Borrador): FilaEditable[] {
  const variables: FilaEditable[] = gastosContados(b.variables, OPCIONES_VARIABLES)
    .sort((x, y) => y.monto - x.monto)
    .slice(0, 3)
    .map((g) => ({ tipo: 'variable', id: g.id, etiqueta: g.etiqueta, monto: g.monto }))
  const ahorro: FilaEditable[] = metasContadas(b.ahorro).map((m) => ({ tipo: 'ahorro', id: m.id, etiqueta: m.nombre, monto: m.cuota }))
  return [...variables, ...ahorro]
}

// ---------- Recordatorios (Paso 8) ----------

/** ¿Algún gasto fijo tiene día de pago? Solo entonces se ofrecen los recordatorios. */
export function hayFijosConDia(b: Borrador): boolean {
  return gastosContados(b.fijos, OPCIONES_FIJOS).some((g) => g.dia !== null)
}

// ---------- Plan de lo que se crea ----------

export interface CategoriaPlan {
  nombre: string
  icono: string
  tipo: 'gasto' | 'ingreso'
  variable?: boolean
}

export interface PlanPresupuesto {
  /** Primer día del mes en que se crea: de ahí cuentan los fijos, los ingresos y los ahorros. */
  desde: string
  para: 'personal' | 'familiar'
  categorias: CategoriaPlan[]
  ingresos: { nombre: string; categoria: string; monto: number; dia: number }[]
  /** Trabajos por días (Didi…): meta de cada día trabajado y días de la semana de descanso. */
  fuentes: { nombre: string; categoria: string; metaDiaria: number; diasLibres: number[] }[]
  fijos: { nombre: string; categoria: string; monto: number; dia: number }[]
  /** Lo planeado para gastos variables, sumado por categoría. */
  topes: { categoria: string; monto: number }[]
  metas: { nombre: string; tipo: 'inversion' | 'gasto'; icono: string; cuota: number; objetivo: number; inicio: string; fechaMeta: string; dia: number }[]
}

/** Categoría (nombre e ícono) de cada opción de gasto fijo. Las que ya existen en la app se reutilizan por nombre. */
const CATEGORIA_FIJO: Record<string, { nombre: string; icono: string }> = {
  arriendo: { nombre: 'Arriendo', icono: '🏠' },
  administracion: { nombre: 'Administración', icono: '🏢' },
  servicios: { nombre: 'Servicios', icono: '💡' },
  internet: { nombre: 'Internet y celular', icono: '📱' },
  transporte: { nombre: 'Transporte', icono: '🚌' },
  colegio: { nombre: 'Educación', icono: '📚' },
  creditos: { nombre: 'Cuotas de créditos', icono: '🏦' },
  seguros: { nombre: 'Salud', icono: '🩺' },
}

const CATEGORIA_VARIABLE: Record<string, { nombre: string; icono: string }> = {
  mercado: { nombre: 'Mercado', icono: '🛒' },
  comidas: { nombre: 'Comida', icono: '🍽️' },
  ropa: { nombre: 'Ropa', icono: '👕' },
  salud: { nombre: 'Salud', icono: '🩺' },
  entretenimiento: { nombre: 'Ocio', icono: '🎉' },
  mascotas: { nombre: 'Mascotas', icono: '🐾' },
  cuidado: { nombre: 'Cuidado personal', icono: '💇' },
  regalos: { nombre: 'Regalos y celebraciones', icono: '🎁' },
  imprevistos: { nombre: 'Imprevistos', icono: '🧯' },
}

const CATEGORIA_INGRESO: Record<string, { nombre: string; icono: string }> = {
  salario: { nombre: 'Salario', icono: '💼' },
  negocio: { nombre: 'Negocio propio', icono: '🏪' },
  independiente: { nombre: 'Trabajo independiente', icono: '🧰' },
  arriendo: { nombre: 'Arriendo recibido', icono: '🏘️' },
  pension: { nombre: 'Pensión', icono: '🧓' },
  otro: { nombre: 'Otros ingresos', icono: '🪙' },
}

/** Los ingresos que cambian de un mes a otro van a la categoría de ingresos variables que ya tiene la app. */
const CATEGORIA_INGRESO_VARIABLE = { nombre: 'Ingresos extra', icono: '💵' }

const CATEGORIA_OTRO_GASTO_ICONO = '🧾'

function dosDigitos(n: number): string {
  return String(n).padStart(2, '0')
}

/** El primer día de un mes, desplazado `meses` meses. */
export function primerDiaDeMes(fecha: string, meses = 0): string {
  const [a, m] = fecha.split('-').map(Number)
  const total = a * 12 + (m - 1) + meses
  return `${Math.floor(total / 12)}-${dosDigitos((total % 12) + 1)}-01`
}

/** Cuántas cuotas hacen falta para juntar el objetivo, y si no hay objetivo, un año. Entre 1 y 600. */
export function cuotasDeMeta(objetivo: number | null, cuota: number): number {
  if (objetivo === null) return 12
  return Math.min(600, Math.max(1, Math.ceil(objetivo / cuota)))
}

function agregarCategoria(lista: CategoriaPlan[], categoria: CategoriaPlan) {
  if (!lista.some((c) => c.nombre.toLowerCase() === categoria.nombre.toLowerCase() && c.tipo === categoria.tipo)) lista.push(categoria)
}

/** Lo que el asistente crea en la app a partir de lo que la persona respondió. */
export function planDelPresupuesto(b: Borrador, hoy: string): PlanPresupuesto {
  const desde = primerDiaDeMes(hoy)
  const categorias: CategoriaPlan[] = []

  const completos = ingresosActivos(b).filter(esIngresoCompleto)

  // Los trabajos por días (Didi…) se crean como «meta diaria» de la app, que pregunta cada día y proyecta el mes.
  const fuentes = completos
    .filter((i) => i.frecuencia === 'diaria')
    .map((i) => {
      agregarCategoria(categorias, { ...CATEGORIA_INGRESO_VARIABLE, tipo: 'ingreso', variable: true })
      return {
        nombre: i.etiqueta.slice(0, 40),
        categoria: CATEGORIA_INGRESO_VARIABLE.nombre,
        metaDiaria: i.monto,
        diasLibres: [...new Set(i.diasLibres ?? [])].sort((x, y) => x - y),
      }
    })

  const ingresos = completos
    .filter((i) => i.frecuencia !== 'diaria')
    .map((i) => {
      const base = i.variable ? CATEGORIA_INGRESO_VARIABLE : (CATEGORIA_INGRESO[i.tipo ?? 'otro'] ?? CATEGORIA_INGRESO.otro)
      agregarCategoria(categorias, { ...base, tipo: 'ingreso', ...(i.variable ? { variable: true } : {}) })
      const quien = i.quien?.trim()
      return { nombre: (quien ? `${i.etiqueta} (${quien})` : i.etiqueta).slice(0, 40), categoria: base.nombre, monto: mensualDe(i.monto, i.frecuencia), dia: 1 }
    })

  const fijos = gastosContados(b.fijos, OPCIONES_FIJOS).map((g) => {
    const base = CATEGORIA_FIJO[g.id] ?? { nombre: g.etiqueta.slice(0, 40), icono: CATEGORIA_OTRO_GASTO_ICONO }
    agregarCategoria(categorias, { ...base, tipo: 'gasto' })
    return { nombre: g.etiqueta.slice(0, 40), categoria: base.nombre, monto: g.monto, dia: g.dia ?? 1 }
  })

  const topesPorCategoria = new Map<string, number>()
  for (const g of gastosContados(b.variables, OPCIONES_VARIABLES)) {
    const base = CATEGORIA_VARIABLE[g.id] ?? { nombre: g.etiqueta.slice(0, 40), icono: CATEGORIA_OTRO_GASTO_ICONO }
    agregarCategoria(categorias, { ...base, tipo: 'gasto' })
    topesPorCategoria.set(base.nombre, (topesPorCategoria.get(base.nombre) ?? 0) + g.monto)
  }

  // Si una categoría tiene gastos fijos y variables a la vez (por ejemplo Salud), su tope cubre las dos cosas.
  for (const f of fijos) {
    if (topesPorCategoria.has(f.categoria)) topesPorCategoria.set(f.categoria, (topesPorCategoria.get(f.categoria) ?? 0) + f.monto)
  }

  const metas = ahorroDeMetas(b).map((m) => {
    const cuotas = cuotasDeMeta(m.objetivo, m.cuota)
    return {
      nombre: m.nombre.slice(0, 40),
      // Una meta (viaje, carro, estudio…) es plata que se va a gastar; el fondo de emergencia y la inversión, no.
      tipo: (m.id === 'meta' ? 'gasto' : 'inversion') as 'inversion' | 'gasto',
      icono: m.id === 'fondo' ? '🛟' : m.id === 'inversion' ? '📈' : '🎯',
      cuota: m.cuota,
      objetivo: cuotas * m.cuota,
      inicio: desde,
      fechaMeta: primerDiaDeMes(desde, cuotas - 1),
      dia: 1,
    }
  })

  return {
    desde,
    para: b.para ?? 'personal',
    categorias,
    ingresos,
    fuentes,
    fijos,
    topes: [...topesPorCategoria].map(([categoria, monto]) => ({ categoria, monto })),
    metas,
  }
}
