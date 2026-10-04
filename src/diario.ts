// Cuándo toca preguntar por una meta diaria y cómo se resume el mes. Código puro (sin pantalla
// ni base de datos), así se puede probar solo. Las fechas son texto AAAA-MM-DD en hora local.

export interface ProgramaDiario {
  id: number
  creado: string
  activo: boolean
  /** Días de la semana en que nunca se trabaja: 0 = domingo … 6 = sábado (p. ej. el de pico y placa). */
  diasLibres: number[]
}

export interface DiaPendiente {
  fuenteId: number
  fecha: string
}

/** Cuántos días hacia atrás se pregunta (contando hoy); lo más viejo se da por no registrado. */
export const VENTANA_JORNADAS = 7

const dos = (n: number) => String(n).padStart(2, '0')

function aTexto(f: Date): string {
  return `${f.getFullYear()}-${dos(f.getMonth() + 1)}-${dos(f.getDate())}`
}

function aFecha(texto: string): Date {
  const [a, m, d] = texto.split('-').map(Number)
  return new Date(a, m - 1, d)
}

export function sumarDias(fecha: string, dias: number): string {
  const f = aFecha(fecha)
  f.setDate(f.getDate() + dias)
  return aTexto(f)
}

/** 0 = domingo … 6 = sábado. */
export function diaSemana(fecha: string): number {
  return aFecha(fecha).getDay()
}

export function claveJornada(fuenteId: number, fecha: string): string {
  return `${fuenteId}|${fecha}`
}

/**
 * Los días (de hoy hacia atrás) en que se podía trabajar y todavía no se dijo qué pasó.
 * `resueltas` contiene claves `${id}|${fecha}` de los días ya registrados o marcados como descanso.
 */
export function pendientesDiarios(programas: ProgramaDiario[], resueltas: Set<string>, hoy: string): DiaPendiente[] {
  const piso = sumarDias(hoy, -(VENTANA_JORNADAS - 1))
  const lista: DiaPendiente[] = []
  for (const p of programas) {
    if (!p.activo) continue
    const desde = p.creado > piso ? p.creado : piso
    for (let f = desde; f <= hoy; f = sumarDias(f, 1)) {
      if (p.diasLibres.includes(diaSemana(f))) continue
      if (!resueltas.has(claveJornada(p.id, f))) lista.push({ fuenteId: p.id, fecha: f })
    }
  }
  // Hoy primero; luego los días anteriores del más reciente al más viejo.
  return lista.sort((a, b) => b.fecha.localeCompare(a.fecha) || a.fuenteId - b.fuenteId)
}

export interface JornadaMonto {
  fecha: string
  estado: 'trabajada' | 'descanso'
  /** Pesos realmente ganados ese día (0 si fue descanso). */
  monto: number
}

export interface ResumenMes {
  ganado: number
  trabajados: number
  descansos: number
  /** Promedio por día trabajado, o null si todavía no hay días trabajados. */
  promedio: number | null
  /** Promedio menos la meta diaria (positivo = por encima de la meta). */
  frenteAMeta: number | null
  /** Lo ganado en la semana (lunes a hoy), solo si `hoy` está dentro del mes que se resume. */
  semana: number | null
}

/** Lunes de la semana de una fecha. */
export function lunesDe(fecha: string): string {
  const d = diaSemana(fecha)
  return sumarDias(fecha, -((d + 6) % 7))
}

export function resumirMes(jornadas: JornadaMonto[], mes: string, metaDiaria: number, hoy: string): ResumenMes {
  const delMes = jornadas.filter((j) => j.fecha.startsWith(mes))
  const trabajadas = delMes.filter((j) => j.estado === 'trabajada')
  const ganado = trabajadas.reduce((s, j) => s + j.monto, 0)
  const promedio = trabajadas.length > 0 ? Math.round(ganado / trabajadas.length) : null
  const lunes = lunesDe(hoy)
  return {
    ganado,
    trabajados: trabajadas.length,
    descansos: delMes.length - trabajadas.length,
    promedio,
    frenteAMeta: promedio === null ? null : promedio - metaDiaria,
    semana: hoy.startsWith(mes)
      ? jornadas.filter((j) => j.estado === 'trabajada' && j.fecha >= lunes && j.fecha <= hoy).reduce((s, j) => s + j.monto, 0)
      : null,
  }
}
