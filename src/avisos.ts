// Qué avisar y cómo: los pagos de hoy y de mañana, y el archivo de calendario con recordatorios. Es código puro (sin
// pantalla ni base de datos), así se puede probar solo y lo usan igual la app y el service worker.
import { pesos } from './formato.ts'
import { estaPendiente } from './programadosPuro.ts'

export interface MovimientoParaAvisar {
  id: number
  tipo: 'gasto' | 'ingreso'
  monto: number
  fecha: string
  nota: string
  /** Nombre de la categoría, por si el movimiento no tiene nota. */
  categoria: string
  programado?: unknown
}

export interface Pago {
  id: number
  fecha: string
  monto: number
  nombre: string
}

/** Los gastos que aún no se han pagado (programados sin confirmar o con fecha que no llega), de `desde` a `hasta` incluidas. */
export function pagosPendientes(movimientos: MovimientoParaAvisar[], hoy: string, desde: string, hasta: string): Pago[] {
  return movimientos
    .filter((m) => m.tipo === 'gasto' && m.fecha >= desde && m.fecha <= hasta && estaPendiente(m, hoy))
    .map((m) => ({ id: m.id, fecha: m.fecha, monto: m.monto, nombre: (m.nota.trim() || m.categoria).slice(0, 60) }))
    .sort((a, b) => a.fecha.localeCompare(b.fecha) || a.id - b.id)
}

export interface Aviso {
  /** Identifica el aviso para no repetirlo: «hoy|2026-10-05» o «manana|2026-10-05». */
  clave: string
  titulo: string
  texto: string
}

function lineas(pagos: Pago[]): string {
  return pagos.map((p) => `${p.nombre}: ${pesos(p.monto)}`).join(' · ')
}

function aviso(clave: string, cuando: string, pagos: Pago[]): Aviso {
  const total = pagos.reduce((suma, p) => suma + p.monto, 0)
  const cuentas = pagos.length === 1 ? '1 pago' : `${pagos.length} pagos`
  return { clave, titulo: `${cuando}: ${cuentas} · ${pesos(total)}`, texto: lineas(pagos) }
}

/**
 * Los avisos de ese día: uno con lo que se paga hoy y otro con lo que se paga mañana (solo si hay algo). Cada uno se
 * manda una sola vez por día, aunque la app revise varias veces.
 */
export function avisosDelDia(pendientes: Pago[], hoy: string, manana: string): Aviso[] {
  const avisos: Aviso[] = []
  const deHoy = pendientes.filter((p) => p.fecha === hoy)
  const deManana = pendientes.filter((p) => p.fecha === manana)
  if (deHoy.length > 0) avisos.push(aviso(`hoy|${hoy}`, 'Hoy toca pagar', deHoy))
  if (deManana.length > 0) avisos.push(aviso(`manana|${hoy}`, 'Mañana toca pagar', deManana))
  return avisos
}

// ---------- Archivo de calendario (.ics) ----------

/** Texto de un .ics: se escapan las comas, los punto y coma, las barras y los saltos de línea. */
function escapar(texto: string): string {
  return texto.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n')
}

function sinGuiones(fecha: string): string {
  return fecha.replace(/-/g, '')
}

function diaSiguiente(fecha: string): string {
  const [a, m, d] = fecha.split('-').map(Number)
  const f = new Date(Date.UTC(a, m - 1, d + 1))
  return f.toISOString().slice(0, 10)
}

/** Corta las líneas largas como pide el formato: a 75 caracteres, con un espacio al empezar la continuación. */
function doblar(linea: string): string {
  const partes: string[] = []
  let resto = linea
  while (resto.length > 75) {
    partes.push(resto.slice(0, 75))
    resto = ' ' + resto.slice(75)
  }
  partes.push(resto)
  return partes.join('\r\n')
}

function alarma(descripcion: string, disparo: string): string[] {
  return ['BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${escapar(descripcion)}`, `TRIGGER:${disparo}`, 'END:VALARM']
}

/**
 * Un evento de todo el día por cada fecha con pagos, con dos recordatorios: a las 9:00 de la víspera y a las 9:00 del
 * mismo día. El identificador depende solo de la fecha, así que al importar de nuevo el calendario actualiza el
 * evento en vez de duplicarlo.
 */
export function crearIcs(pagos: Pago[], ahora: Date): string {
  const sello = ahora.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
  const fechas = [...new Set(pagos.map((p) => p.fecha))].sort()
  const salida = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Mis Finanzas//Pagos//ES', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'X-WR-CALNAME:Pagos (Mis Finanzas)']
  for (const fecha of fechas) {
    const delDia = pagos.filter((p) => p.fecha === fecha)
    const total = delDia.reduce((suma, p) => suma + p.monto, 0)
    const resumen = delDia.length === 1 ? `Pagar ${delDia[0].nombre}: ${pesos(total)}` : `${delDia.length} pagos: ${pesos(total)}`
    salida.push(
      'BEGIN:VEVENT',
      `UID:pagos-${fecha}@mis-finanzas`,
      `DTSTAMP:${sello}`,
      `DTSTART;VALUE=DATE:${sinGuiones(fecha)}`,
      `DTEND;VALUE=DATE:${sinGuiones(diaSiguiente(fecha))}`,
      `SUMMARY:${escapar(resumen)}`,
      `DESCRIPTION:${escapar(lineas(delDia).split(' · ').join('\n'))}`,
      'TRANSP:TRANSPARENT',
      ...alarma(`Mañana toca pagar: ${resumen}`, '-PT15H'),
      ...alarma(`Hoy toca pagar: ${resumen}`, 'PT9H'),
      'END:VEVENT',
    )
  }
  salida.push('END:VCALENDAR')
  return salida.map(doblar).join('\r\n') + '\r\n'
}
