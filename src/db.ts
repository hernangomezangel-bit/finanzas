import Dexie, { type Table } from 'dexie'
import { hoy } from './fechas'
import type { Estrategia, TipoTasa } from './plan'
import type { OrigenProgramado } from './programadosPuro'
import type { Frecuencia } from './recurrencia'

export type Tipo = 'gasto' | 'ingreso'

export interface Categoria {
  id?: number
  nombre: string
  tipo: Tipo
  icono: string
  oculta?: boolean
  /** Marca las categorías que la app usa por su cuenta (p. ej. 'ahorro'), aunque se renombren. */
  clave?: 'ahorro' | 'deudas'
  /** Solo ingresos: dinero esporádico que cambia cada mes (comisiones, trabajos por fuera). */
  variable?: boolean
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
  /** Si viene, es el gasto de una cuota de deuda o de ahorro que la app creó sola y que aún no se confirma. */
  programado?: Programado
}

/** De qué cuota viene un gasto programado, para confirmarlo, actualizarlo o quitarlo cuando cambie algo. */
export interface Programado {
  origen: OrigenProgramado
  /** Id de la deuda o de la meta de ahorro. */
  refId: number
  /** Fecha de la cuota que representa (AAAA-MM-DD). */
  fechaCuota: string
  /** El monto que tenía el plan al crearlo o actualizarlo; si el monto del gasto es distinto, la persona lo editó. */
  montoPlan: number
}

/** Movimiento que se repite cada mes (salario, arriendo, servicios). La app lo propone; la persona confirma. */
export interface Recurrente {
  id?: number
  nombre: string
  tipo: Tipo
  /** Último monto acordado; se propone tal cual y se puede cambiar al confirmar. */
  monto: number
  categoriaId: number
  nota: string
  /** Cómo se repite. Sin valor es mensual (así eran todos al principio). */
  frecuencia?: Frecuencia
  /**
   * Mensual: días del mes en que cae (uno = mensual, dos = quincenal). Semanal: días de la semana (0 = domingo … 6 = sábado),
   * uno o varios. Diaria: vacío.
   */
  dias: number[]
  /**
   * Si viene, `monto` es lo de cada día y esto son los días de la semana de descanso (0 = domingo … 6 = sábado, puede
   * ir vacío). Cada mes se registra el total (monto × días trabajados) el último día del mes; `dias` es [31].
   */
  diasLibres?: number[]
  /** Desde cuándo cuenta; no se proponen fechas anteriores. */
  creado: string
  activo: boolean
}

/** Qué pasó con un vencimiento concreto de un recurrente. */
export interface Ocurrencia {
  id?: number
  recurrenteId: number
  /** Fecha del vencimiento (AAAA-MM-DD). */
  fecha: string
  estado: 'registrada' | 'omitida'
  movimientoId?: number
}

/** Trabajo que se cobra por día y con monto variable (Didi, domicilios…), con una meta diaria de referencia. */
export interface Fuente {
  id?: number
  nombre: string
  /** Lo que quieres ganar cada día trabajado; es solo una referencia, nunca se registra solo. */
  metaDiaria: number
  /** Categoría de ingreso donde se registran las ganancias. */
  categoriaId: number
  /** Días de la semana en que nunca trabajas (0 = domingo … 6 = sábado), p. ej. pico y placa. */
  diasLibres: number[]
  creado: string
  activo: boolean
}

/** Qué pasó un día concreto con un trabajo por días. */
export interface Jornada {
  id?: number
  fuenteId: number
  fecha: string
  estado: 'trabajada' | 'descanso'
  /** Lo registrado ese día; solo en jornadas trabajadas. */
  monto?: number
  movimientoId?: number
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
  /** Ahorro programado: una cuota fija que se repite hasta `fechaMeta`. La app propone cada cuota en Presupuesto. */
  programa?: ProgramaAhorro
}

/** Cuota fija de un ahorro programado, como los de los bancos (sin intereses). */
export interface ProgramaAhorro {
  cuota: number
  frecuencia: Frecuencia
  /** Semanal: día de la semana (0 = domingo … 6 = sábado). Mensual: día del mes (1 a 31). Diaria: 0. */
  dia: number
  /** Fecha de la primera cuota posible (AAAA-MM-DD). */
  inicio: string
}

export interface Aporte {
  id?: number
  metaId: number
  monto: number
  fecha: string
  nota: string
  /** Gasto que este aporte generó en el Presupuesto, si se marcó esa opción. */
  movimientoId?: number
  /** Cuota del ahorro programado que cubre este aporte (AAAA-MM-DD). */
  fechaCuota?: string
  /** Cuota que se dejó pasar sin registrar ("omitir"): monto 0, solo evita que se vuelva a proponer. */
  omitida?: boolean
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
  /**
   * Préstamo sin interés ni pago mensual (de un familiar, por ejemplo): solo se guarda para verlo, recordarlo y abonarle
   * cuando se pueda. Tiene tasa 0 y pago mínimo 0; no entra en el plan ni crea gastos programados.
   */
  sinCuota?: boolean
  /** Día del mes (1 a 31) en que se paga la cuota; opcional. */
  diaPago?: number
  creada: string
  /**
   * Desde cuándo se proponen las cuotas en Presupuesto. Si falta, desde `creada`. Las deudas que ya existían
   * al activarse esta función empiezan hoy, para no proponer de golpe cuotas de meses pasados.
   */
  propuestasDesde?: string
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
  /** Cuota que se dejó pasar sin pagar por la app ("omitir"): monto 0, solo evita que se vuelva a proponer. */
  omitida?: boolean
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

export const CATEGORIA_COMISIONES: Categoria = {
  nombre: 'Comisiones',
  tipo: 'ingreso',
  icono: '💸',
  variable: true,
}

class BaseFinanzas extends Dexie {
  categorias!: Table<Categoria, number>
  movimientos!: Table<Movimiento, number>
  metas!: Table<Meta, number>
  aportes!: Table<Aporte, number>
  deudas!: Table<Deuda, number>
  pagosDeuda!: Table<PagoDeuda, number>
  ajustes!: Table<Ajuste, string>
  recurrentes!: Table<Recurrente, number>
  ocurrencias!: Table<Ocurrencia, number>
  fuentes!: Table<Fuente, number>
  jornadas!: Table<Jornada, number>

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
    this.version(4)
      .stores({
        recurrentes: '++id',
        ocurrencias: '++id, recurrenteId',
      })
      .upgrade(async (tx) => {
        const categorias = tx.table<Categoria>('categorias')
        await categorias.filter((c) => c.tipo === 'ingreso' && c.nombre === 'Ingresos extra').modify({ variable: true })
        if ((await categorias.filter((c) => c.nombre === CATEGORIA_COMISIONES.nombre).count()) === 0) {
          await categorias.add(CATEGORIA_COMISIONES)
        }
      })
    this.version(5).stores({
      fuentes: '++id',
      jornadas: '++id, fuenteId, fecha',
    })
    // Sin tablas nuevas: solo marca desde cuándo se proponen las cuotas de las deudas que ya existían.
    this.version(6).stores({}).upgrade(async (tx) => {
      await tx.table<Deuda>('deudas').toCollection().modify((d) => {
        d.propuestasDesde = hoy()
      })
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
  { nombre: 'Ingresos extra', tipo: 'ingreso', icono: '💵', variable: true },
  CATEGORIA_COMISIONES,
  { nombre: 'Otros ingresos', tipo: 'ingreso', icono: '🪙' },
]

export const db = new BaseFinanzas()
