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
