import Dexie, { type Table } from 'dexie'
import type { Estrategia, TipoTasa } from './plan'

export type Tipo = 'gasto' | 'ingreso'

export interface Categoria {
  id?: number
  nombre: string
  tipo: Tipo
  icono: string
  oculta?: boolean
  /** Marca las categorías que la app usa por su cuenta (p. ej. 'ahorro'), aunque se renombren. */
  clave?: 'ahorro' | 'deudas'
}

export interface Movimiento {
  id?: number
  tipo: Tipo
  /** Pesos enteros, siempre positivo; el tipo dice si suma o resta. */
  monto: number
  categoriaId: number
  /** Fecha local en formato AAAA-MM-DD. */
  fecha: string
  nota: string
}

export type TipoMeta = 'inversion' | 'gasto'

export interface Meta {
  id?: number
  nombre: string
  tipo: TipoMeta
  objetivo: number
  /** Fecha en que quieres tener el dinero (AAAA-MM-DD); opcional. */
  fechaMeta?: string
  icono: string
  /** Día en que se creó la meta (AAAA-MM-DD). */
  creada: string
  /** Meta cerrada: cumplida o dejada de lado. */
  archivada?: boolean
}

export interface Aporte {
  id?: number
  metaId: number
  monto: number
  fecha: string
  nota: string
  /** Gasto que este aporte generó en el Presupuesto, si se marcó esa opción. */
  movimientoId?: number
}

export interface Deuda {
  id?: number
  nombre: string
  icono: string
  /** Lo que se debía el día que se registró; el saldo de hoy sale de restarle los pagos. */
  saldoInicial: number
  /** Porcentaje tal como lo escribe la persona (28,5 = 28,5 %). */
  tasa: number
  tipoTasa: TipoTasa
  pagoMinimo: number
  /** Día del mes (1 a 31) en que se paga la cuota; opcional. */
  diaPago?: number
  creada: string
}

export interface PagoDeuda {
  id?: number
  deudaId: number
  monto: number
  /** Parte del pago que fue interés (estimada). */
  interes: number
  /** Parte que bajó el saldo; negativa si el pago no alcanzó a cubrir el interés. */
  aCapital: number
  fecha: string
  /** Fecha de la cuota que cubre este pago, si venía del plan. */
  fechaCuota?: string
  /** Gasto que este pago generó en el Presupuesto, si se marcó esa opción. */
  movimientoId?: number
}

/** Preferencias del plan de deudas; viajan en la copia de seguridad. */
export type Ajuste =
  | { clave: 'deudaExtra'; valor: number }
  | { clave: 'deudaEstrategia'; valor: Estrategia }

export const CATEGORIA_AHORRO: Categoria = {
  nombre: 'Ahorro e inversión',
  tipo: 'gasto',
  icono: '🐷',
  clave: 'ahorro',
}

export const CATEGORIA_DEUDAS: Categoria = {
  nombre: 'Pago de deudas',
  tipo: 'gasto',
  icono: '💳',
  clave: 'deudas',
}

class BaseFinanzas extends Dexie {
  categorias!: Table<Categoria, number>
  movimientos!: Table<Movimiento, number>
  metas!: Table<Meta, number>
  aportes!: Table<Aporte, number>
  deudas!: Table<Deuda, number>
  pagosDeuda!: Table<PagoDeuda, number>
  ajustes!: Table<Ajuste, string>

  constructor() {
    super('finanzas')
    this.version(1).stores({
      categorias: '++id, tipo',
      movimientos: '++id, fecha, categoriaId',
    })
    this.version(2)
      .stores({
        metas: '++id',
        aportes: '++id, metaId, fecha',
      })
      .upgrade(async (tx) => {
        // Quien ya usaba la app recibe la categoría de ahorro sin perder lo que tenía.
        const categorias = tx.table<Categoria>('categorias')
        if ((await categorias.filter((c) => c.clave === 'ahorro').count()) === 0) {
          await categorias.add(CATEGORIA_AHORRO)
        }
      })
    this.version(3)
      .stores({
        deudas: '++id',
        pagosDeuda: '++id, deudaId, fecha',
        ajustes: 'clave',
      })
      .upgrade(async (tx) => {
        const categorias = tx.table<Categoria>('categorias')
        if ((await categorias.filter((c) => c.clave === 'deudas').count()) === 0) {
          await categorias.add(CATEGORIA_DEUDAS)
        }
      })
    this.on('populate', (tx) => {
      tx.table('categorias').bulkAdd(CATEGORIAS_INICIALES)
    })
  }
}

const CATEGORIAS_INICIALES: Categoria[] = [
  { nombre: 'Comida', tipo: 'gasto', icono: '🍽️' },
  { nombre: 'Mercado', tipo: 'gasto', icono: '🛒' },
  { nombre: 'Transporte', tipo: 'gasto', icono: '🚌' },
  { nombre: 'Arriendo', tipo: 'gasto', icono: '🏠' },
  { nombre: 'Servicios', tipo: 'gasto', icono: '💡' },
  { nombre: 'Salud', tipo: 'gasto', icono: '🩺' },
  { nombre: 'Educación', tipo: 'gasto', icono: '📚' },
  { nombre: 'Ocio', tipo: 'gasto', icono: '🎉' },
  { nombre: 'Ropa', tipo: 'gasto', icono: '👕' },
  CATEGORIA_AHORRO,
  CATEGORIA_DEUDAS,
  { nombre: 'Otros gastos', tipo: 'gasto', icono: '🧾' },
  { nombre: 'Salario', tipo: 'ingreso', icono: '💼' },
  { nombre: 'Ingresos extra', tipo: 'ingreso', icono: '💵' },
  { nombre: 'Otros ingresos', tipo: 'ingreso', icono: '🪙' },
]

export const db = new BaseFinanzas()
