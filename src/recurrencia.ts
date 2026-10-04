// Cuándo le toca a cada movimiento recurrente. Código puro (sin pantalla ni base de datos),
// así se puede probar solo. Las fechas son texto AAAA-MM-DD en la hora del teléfono.

export interface Programa {
  id: number
  /** Días del mes en que se repite (1 a 31); uno para mensual, dos para quincenal. */
  dias: number[]
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
  const piso = restarDias(hoy, VENTANA_DIAS)
  const lista: Vencimiento[] = []
  for (const p of programas) {
    if (!p.activo) continue
    const desde = p.creado > piso ? p.creado : piso
    for (const fecha of fechasEntre(p.dias, desde, hoy)) {
      if (!resueltas.has(claveOcurrencia(p.id, fecha))) lista.push({ recurrenteId: p.id, fecha })
    }
  }
  return lista.sort((a, b) => a.fecha.localeCompare(b.fecha) || a.recurrenteId - b.recurrenteId)
}

export function claveOcurrencia(recurrenteId: number, fecha: string): string {
  return `${recurrenteId}|${fecha}`
}
