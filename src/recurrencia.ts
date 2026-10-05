// Cuándo le toca a cada movimiento recurrente. Código puro (sin pantalla ni base de datos),
// así se puede probar solo. Las fechas son texto AAAA-MM-DD en la hora del teléfono.

/**
 * Cómo se repite un movimiento fijo. Sin `frecuencia` es mensual, como eran todos al principio:
 *  - mensual: `dias` son días del mes (1 a 31); uno es mensual y dos (uno por quincena) es quincenal.
 *  - semanal: `dias` son días de la semana (0 = domingo … 6 = sábado); pueden ser varios.
 *  - diaria: todos los días; `dias` va vacío.
 */
export interface PatronFijo {
  frecuencia?: Frecuencia
  dias: number[]
}

export interface Programa extends PatronFijo {
  id: number
  /** Desde cuándo cuenta: nunca se proponen fechas anteriores. */
  creado: string
  activo: boolean
}

export interface Vencimiento {
  recurrenteId: number
  fecha: string
}

/** Lo máximo que se propone hacia atrás, para no abrumar tras semanas sin abrir la app. */
export const VENTANA_DIAS = 92

const dos = (n: number) => String(n).padStart(2, '0')

/** Fecha del `dia` en ese mes; si el mes no tiene ese día (31 en abril), cae el último día del mes. */
function fechaEnMes(anio: number, mes: number, dia: number): string {
  const ultimo = new Date(anio, mes, 0).getDate()
  return `${anio}-${dos(mes)}-${dos(Math.min(dia, ultimo))}`
}

function restarDias(fecha: string, dias: number): string {
  const [a, m, d] = fecha.split('-').map(Number)
  const f = new Date(a, m - 1, d - dias)
  return `${f.getFullYear()}-${dos(f.getMonth() + 1)}-${dos(f.getDate())}`
}

/** Todas las fechas en que cae el programa entre `desde` y `hasta`, ambas incluidas, sin repetir y en orden. */
export function fechasEntre(dias: number[], desde: string, hasta: string): string[] {
  if (desde > hasta) return []
  const [a1, m1] = desde.split('-').map(Number)
  const [a2, m2] = hasta.split('-').map(Number)
  const fechas = new Set<string>()
  for (let total = a1 * 12 + (m1 - 1); total <= a2 * 12 + (m2 - 1); total++) {
    const anio = Math.floor(total / 12)
    const mes = (total % 12) + 1
    for (const dia of dias) {
      const f = fechaEnMes(anio, mes, dia)
      if (f >= desde && f <= hasta) fechas.add(f)
    }
  }
  return [...fechas].sort()
}

/**
 * Los vencimientos que ya llegaron y todavía no se registraron ni se omitieron.
 * `resueltas` contiene claves `${id}|${fecha}` de lo ya atendido.
 */
export function pendientes(programas: Programa[], resueltas: Set<string>, hoy: string): Vencimiento[] {
  const lista: Vencimiento[] = []
  for (const p of programas) {
    if (!p.activo) continue
    const piso = restarDias(hoy, ventanaDeFijo(p.frecuencia))
    const desde = p.creado > piso ? p.creado : piso
    for (const fecha of fechasPatron(p, desde, hoy)) {
      if (!resueltas.has(claveOcurrencia(p.id, fecha))) lista.push({ recurrenteId: p.id, fecha })
    }
  }
  return lista.sort((a, b) => a.fecha.localeCompare(b.fecha) || a.recurrenteId - b.recurrenteId)
}

/**
 * Todas las fechas en que cae un patrón entre `desde` y `hasta` (ambas incluidas), en orden y sin repetir:
 * los días del mes (mensual o quincenal), los días de la semana elegidos, o todos los días.
 */
export function fechasPatron(patron: PatronFijo, desde: string, hasta: string): string[] {
  if (desde > hasta) return []
  if (patron.frecuencia === 'diaria') return fechasCuotas({ frecuencia: 'diaria', dia: 0, inicio: desde }, hasta)
  if (patron.frecuencia === 'semanal') {
    const fechas = new Set<string>()
    for (const dia of patron.dias) {
      for (const f of fechasCuotas({ frecuencia: 'semanal', dia, inicio: desde }, hasta)) fechas.add(f)
    }
    return [...fechas].sort()
  }
  return fechasEntre(patron.dias, desde, hasta)
}

/** Cuántos días hacia atrás se siguen proponiendo vencimientos atrasados; los diarios no pueden acumularse por meses. */
export function ventanaDeFijo(frecuencia?: Frecuencia): number {
  return frecuencia === 'diaria' ? 6 : frecuencia === 'semanal' ? 34 : VENTANA_DIAS
}

/**
 * Un recurrente "por día" tiene un monto diario y días de la semana de descanso: cada mes se registra de una vez el
 * total (monto × días del mes que no son de descanso), el último día del mes. Esos recurrentes son mensuales con dia 31.
 */
export const DIAS_DEL_COBRO_POR_DIA = [31]

/** Cuántos días de ese mes (AAAA-MM) se trabajan: todos menos los que caen en un día de descanso (0 = domingo … 6 = sábado). */
export function diasTrabajados(mes: string, diasLibres: number[]): number {
  const [anio, m] = mes.split('-').map(Number)
  const total = new Date(anio, m, 0).getDate()
  let trabajados = 0
  for (let dia = 1; dia <= total; dia++) {
    if (!diasLibres.includes(new Date(anio, m - 1, dia).getDay())) trabajados++
  }
  return trabajados
}

/** Lo que vale un vencimiento: el monto tal cual, o el total del mes si el recurrente se cobra por día trabajado. */
export function montoDelVencimiento(r: { monto: number; diasLibres?: number[] }, fecha: string): number {
  return r.diasLibres === undefined ? r.monto : r.monto * diasTrabajados(fecha.slice(0, 7), r.diasLibres)
}

export function claveOcurrencia(recurrenteId: number, fecha: string): string {
  return `${recurrenteId}|${fecha}`
}

// ---------- Cuotas de ahorro programado (diarias, semanales o mensuales) ----------

export type Frecuencia = 'diaria' | 'semanal' | 'mensual'

export interface ProgramaCuotas {
  frecuencia: Frecuencia
  /** Semanal: día de la semana (0 = domingo … 6 = sábado). Mensual: día del mes (1 a 31). Diaria: se ignora. */
  dia: number
  /** Fecha de la primera cuota posible. */
  inicio: string
}

function sumarDias(fecha: string, dias: number): string {
  return restarDias(fecha, -dias)
}

/** Todas las cuotas entre `inicio` y `hasta`, ambas incluidas, en orden. */
export function fechasCuotas(p: ProgramaCuotas, hasta: string, desde: string = p.inicio): string[] {
  const primero = desde > p.inicio ? desde : p.inicio
  if (primero > hasta) return []
  if (p.frecuencia === 'mensual') return fechasEntre([p.dia], primero, hasta)
  const fechas: string[] = []
  for (let f = primero; f <= hasta; f = sumarDias(f, 1)) {
    const [a, m, d] = f.split('-').map(Number)
    if (p.frecuencia === 'diaria' || new Date(a, m - 1, d).getDay() === p.dia) fechas.push(f)
  }
  return fechas
}

/** Cuántos días hacia atrás se siguen proponiendo cuotas atrasadas; una cuota diaria no puede acumularse por meses. */
const VENTANA_CUOTAS: Record<Frecuencia, number> = { diaria: 6, semanal: 34, mensual: VENTANA_DIAS }

/**
 * Las cuotas sin atender entre `desde` y `hasta` (ambas incluidas), sin pasar del final del plan. Las vencidas solo
 * cuentan dentro de la ventana de atraso; las futuras no tienen límite. `resueltas` son las fechas ya atendidas.
 */
export function cuotasAbiertas(
  p: ProgramaCuotas,
  fin: string | undefined,
  resueltas: Set<string>,
  hoy: string,
  desde: string,
  hasta: string,
): string[] {
  const piso = restarDias(hoy, VENTANA_CUOTAS[p.frecuencia])
  const limite = fin !== undefined && fin < hasta ? fin : hasta
  return fechasCuotas(p, limite, desde > piso ? desde : piso).filter((f) => !resueltas.has(f))
}

/**
 * Las cuotas que ya vencieron (hasta hoy y hasta el final del plan) y todavía no se registraron ni se omitieron.
 * `resueltas` son las fechas ya atendidas.
 */
export function cuotasPendientes(p: ProgramaCuotas, fin: string | undefined, resueltas: Set<string>, hoy: string): string[] {
  return cuotasAbiertas(p, fin, resueltas, hoy, p.inicio, hoy)
}

/**
 * Los vencimientos mensuales de un movimiento recurrente entre `desde` y `hasta` que siguen sin atender: nunca
 * antes de que se creara ni de la ventana de atraso. `resueltas` son las fechas ya registradas u omitidas.
 */
export function vencimientosAbiertos(
  patron: PatronFijo | number[],
  creado: string,
  resueltas: Set<string>,
  hoy: string,
  desde: string,
  hasta: string,
): string[] {
  // Una lista de números sola es un patrón mensual (así se usaba antes).
  const p: PatronFijo = Array.isArray(patron) ? { dias: patron } : patron
  const piso = restarDias(hoy, ventanaDeFijo(p.frecuencia))
  const inicio = [creado, desde, piso].reduce((a, b) => (a > b ? a : b))
  return fechasPatron(p, inicio, hasta).filter((f) => !resueltas.has(f))
}
