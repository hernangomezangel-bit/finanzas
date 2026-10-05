// Lo que la persona elige en el calendario al registrar un movimiento: solo ese día, todos los días, cada semana,
// cada quincena o cada mes. Es código puro (sin pantalla ni base de datos), así se puede probar solo.
import { fechasPatron, type PatronFijo } from './recurrencia.ts'

export type TipoRepeticion = 'unica' | 'diaria' | 'semanal' | 'quincenal' | 'mensual'

export interface Repeticion {
  tipo: TipoRepeticion
  /**
   * semanal: días de la semana (0 = domingo … 6 = sábado), uno o varios.
   * quincenal: dos días del mes, el primero de la 1.ª quincena (1 a 15) y el segundo de la 2.ª (16 a 31).
   * mensual: un solo día del mes. Solo este día y todos los días: vacío.
   */
  dias: number[]
}

export const ABREVIATURAS_DIA = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
const NOMBRES_DIA = ['domingos', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábados']

/** Día de la semana de una fecha AAAA-MM-DD: 0 = domingo … 6 = sábado. */
export function diaDeSemana(fecha: string): number {
  const [a, m, d] = fecha.split('-').map(Number)
  return new Date(a, m - 1, d).getDay()
}

/** Lo que se propone al elegir un tipo de repetición, a partir del día que se tocó en el calendario. */
export function repeticionPorDefecto(tipo: TipoRepeticion, fecha: string): Repeticion {
  const dia = Number(fecha.slice(8, 10))
  switch (tipo) {
    case 'semanal':
      return { tipo, dias: [diaDeSemana(fecha)] }
    case 'mensual':
      return { tipo, dias: [dia] }
    case 'quincenal':
      // El día que se tocó es de una quincena; el de la otra queda 15 días después (o antes).
      return { tipo, dias: dia <= 15 ? [dia, Math.min(dia + 15, 31)] : [Math.min(dia - 15, 15), dia] }
    default:
      return { tipo, dias: [] }
  }
}

/** ¿Los días elegidos tienen sentido para ese tipo? */
export function esRepeticionValida(r: Repeticion): boolean {
  const enteros = r.dias.every((d) => Number.isInteger(d))
  switch (r.tipo) {
    case 'semanal':
      return enteros && r.dias.length >= 1 && r.dias.every((d) => d >= 0 && d <= 6)
    case 'mensual':
      return enteros && r.dias.length === 1 && r.dias[0] >= 1 && r.dias[0] <= 31
    case 'quincenal':
      return enteros && r.dias.length === 2 && r.dias[0] >= 1 && r.dias[0] <= 15 && r.dias[1] >= 16 && r.dias[1] <= 31
    default:
      return true
  }
}

/** Cómo se guarda la repetición. Devuelve null si es solo ese día. Quincenal es mensual con dos días. */
export function patronDe(r: Repeticion): PatronFijo | null {
  const dias = [...new Set(r.dias)].sort((a, b) => a - b)
  switch (r.tipo) {
    case 'unica':
      return null
    case 'diaria':
      return { frecuencia: 'diaria', dias: [] }
    case 'semanal':
      return { frecuencia: 'semanal', dias }
    default:
      return { dias } // mensual y quincenal: días del mes
  }
}

/** Lo que se muestra al abrir algo ya guardado: reconoce una quincena (un día en cada mitad del mes). */
export function repeticionDe(patron: PatronFijo): Repeticion {
  const dias = [...patron.dias].sort((a, b) => a - b)
  if (patron.frecuencia === 'diaria') return { tipo: 'diaria', dias: [] }
  if (patron.frecuencia === 'semanal') return { tipo: 'semanal', dias }
  if (dias.length === 2 && dias[0] <= 15 && dias[1] >= 16) return { tipo: 'quincenal', dias }
  return { tipo: 'mensual', dias }
}

function lista(items: string[]): string {
  return items.length <= 1 ? (items[0] ?? '') : `${items.slice(0, -1).join(', ')} y ${items[items.length - 1]}`
}

/** Una frase corta con lo que se eligió. Vacía si es solo ese día. */
export function textoRepeticion(r: Repeticion): string {
  const dias = [...r.dias].sort((a, b) => a - b)
  switch (r.tipo) {
    case 'diaria':
      return 'Todos los días'
    case 'semanal':
      // Con lunes primero, que es como se piensa la semana.
      return `Cada semana: ${lista([...dias].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7)).map((d) => NOMBRES_DIA[d]))}`
    case 'quincenal':
      return `Cada quincena: días ${dias[0]} y ${dias[1]}`
    case 'mensual':
      return `Cada mes, el día ${dias[0]}`
    default:
      return ''
  }
}

/** Texto de un patrón ya guardado. */
export function textoPatron(patron: PatronFijo): string {
  return textoRepeticion(repeticionDe(patron))
}

/** Las fechas que caerían entre `desde` y `hasta`, empezando en `inicio` (para marcarlas en el calendario). */
export function fechasDeRepeticion(r: Repeticion, inicio: string, desde: string, hasta: string): string[] {
  const patron = patronDe(r)
  const primero = desde > inicio ? desde : inicio
  if (!patron) return inicio >= desde && inicio <= hasta ? [inicio] : []
  return fechasPatron(patron, primero, hasta)
}

/** ¿Esa fecha es una de las del patrón? (Por ejemplo, un lunes elegido como inicio de algo que se repite los viernes: no.) */
export function esOcurrencia(patron: PatronFijo, fecha: string): boolean {
  return fechasPatron(patron, fecha, fecha).length === 1
}
