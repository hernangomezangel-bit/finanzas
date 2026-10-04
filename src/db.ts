import Dexie, { type Table } from 'dexie'

export type Tipo = 'gasto' | 'ingreso'

export interface Categoria {
  id?: number
  nombre: string
  tipo: Tipo
  icono: string
  oculta?: boolean
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

class BaseFinanzas extends Dexie {
  categorias!: Table<Categoria, number>
  movimientos!: Table<Movimiento, number>

  constructor() {
    super('finanzas')
    this.version(1).stores({
      categorias: '++id, tipo',
      movimientos: '++id, fecha, categoriaId',
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
  { nombre: 'Otros gastos', tipo: 'gasto', icono: '🧾' },
  { nombre: 'Salario', tipo: 'ingreso', icono: '💼' },
  { nombre: 'Ingresos extra', tipo: 'ingreso', icono: '💵' },
  { nombre: 'Otros ingresos', tipo: 'ingreso', icono: '🪙' },
]

export const db = new BaseFinanzas()
