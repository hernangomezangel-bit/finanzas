const dos = (n: number) => String(n).padStart(2, '0')

/** Hoy en formato AAAA-MM-DD, con la hora del teléfono (no UTC). */
export function hoy(): string {
  const d = new Date()
  return `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}`
}

/** Mes en formato AAAA-MM a partir de una fecha AAAA-MM-DD. */
export function mesDe(fecha: string): string {
  return fecha.slice(0, 7)
}

export function moverMes(mes: string, delta: number): string {
  const [a, m] = mes.split('-').map(Number)
  const d = new Date(a, m - 1 + delta, 1)
  return `${d.getFullYear()}-${dos(d.getMonth() + 1)}`
}

function aFecha(texto: string): Date {
  const [a, m, d = 1] = texto.split('-').map(Number)
  return new Date(a, m - 1, d)
}

/** Un día después de una fecha AAAA-MM-DD. */
export function diaSiguiente(fecha: string): string {
  const [a, m, d] = fecha.split('-').map(Number)
  const f = new Date(a, m - 1, d + 1)
  return `${f.getFullYear()}-${dos(f.getMonth() + 1)}-${dos(f.getDate())}`
}

/**
 * Fecha de la cuota número `numero` (1 = la próxima) de una deuda con día de pago fijo,
 * contando desde `desde`. Si el mes no tiene ese día (31 en febrero), cae el último día del mes.
 */
export function fechaDeCuota(diaPago: number, numero: number, desde = hoy()): string {
  const [a, m, d] = desde.split('-').map(Number)
  const total = m - 1 + (d > diaPago ? 1 : 0) + (numero - 1)
  const anio = a + Math.floor(total / 12)
  const mes = total % 12
  const ultimo = new Date(anio, mes + 1, 0).getDate()
  return `${anio}-${dos(mes + 1)}-${dos(Math.min(diaPago, ultimo))}`
}

/** Número de día (desde 1970) de una fecha AAAA-MM-DD; sirve para ubicar puntos en una gráfica. */
export function numeroDeDia(fecha: string): number {
  const [a, m, d] = fecha.split('-').map(Number)
  return Math.round(Date.UTC(a, m - 1, d) / 86_400_000)
}

/** Meses completos que faltan para una fecha, mínimo 1. */
export function mesesHasta(fecha: string, desde = hoy()): number {
  const [a1, m1, d1] = desde.split('-').map(Number)
  const [a2, m2, d2] = fecha.split('-').map(Number)
  const meses = (a2 - a1) * 12 + (m2 - m1) - (d2 < d1 ? 1 : 0)
  return Math.max(1, meses)
}

export function fechaCorta(fecha: string): string {
  return aFecha(fecha).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })
}

/** Día de la semana, día y mes en corto: «Lun, 5 oct». */
export function fechaDia(fecha: string): string {
  const texto = aFecha(fecha)
    .toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric', month: 'short' })
    .replace(/\./g, '')
  return texto.charAt(0).toUpperCase() + texto.slice(1)
}

export function nombreMes(mes: string): string {
  const texto = aFecha(mes).toLocaleDateString('es-CO', { month: 'long', year: 'numeric' })
  return texto.charAt(0).toUpperCase() + texto.slice(1)
}

export function nombreDia(fecha: string): string {
  const texto = aFecha(fecha).toLocaleDateString('es-CO', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
  return texto.charAt(0).toUpperCase() + texto.slice(1)
}
