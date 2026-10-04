import Dexie, { type Table } from 'dexie'

export type Tipo = 'gasto' | 'ingreso'

export interface Categoria {
  id?: number
  nombre: string
  tipo: Tipo
  icono: string
  oculta?: boolean
  /** Marca las categorías que la app usa por su cuenta (p. ej. 'ahorro'), aunque se renombren. */
  clave?: 'ahorro'
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

export const CATEGORIA_AHORRO: Categoria = {
  nombre: 'Ahorro e inversión',
  tipo: 'gasto',
  icono: '🐷',
  clave: 'ahorro',
}

class BaseFinanzas extends Dexie {
  categorias!: Table<Categoria, number>
  movimientos!: Table<Movimiento, number>
  metas!: Table<Meta, number>
  aportes!: Table<Aporte, number>

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
  { nombre: 'Otros gastos', tipo: 'gasto', icono: '🧾' },
  { nombre: 'Salario', tipo: 'ingreso', icono: '💼' },
  { nombre: 'Ingresos extra', tipo: 'ingreso', icono: '💵' },
  { nombre: 'Otros ingresos', tipo: 'ingreso', icono: '🪙' },
]

export const db = new BaseFinanzas()
