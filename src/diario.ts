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

/**
 * Lo que se ganaría en el mes completo cumpliendo la meta cada día que se puede trabajar
 * (todos los días menos los de la semana en que nunca se trabaja).
 */
export function metaDelMes(mes: string, metaDiaria: number, diasLibres: number[]): { dias: number; total: number } {
  const [anio, m] = mes.split('-').map(Number)
  const diasEnMes = new Date(anio, m, 0).getDate()
  let dias = 0
  for (let d = 1; d <= diasEnMes; d++) {
    if (!diasLibres.includes(new Date(anio, m - 1, d).getDay())) dias++
  }
  return { dias, total: dias * metaDiaria }
}

export interface JornadaMonto {
  fecha: string
  estado: 'trabajada' | 'descanso'
  /** Pesos realmente ganados ese día (0 si fue descanso); null si se borró el ingreso de esa jornada. */
  monto: number | null
}

export interface Proyeccion {
  /** Lo ya registrado como ganado en el mes. */
  registrado: number
  /** Lo que se supone que se ganará en los días aún abiertos, cumpliendo la meta cada uno. */
  supuesto: number
  /** Cuántos días siguen abiertos (sin responder y que todavía se pueden registrar o trabajar). */
  diasSupuestos: number
  /** Registrado + supuesto: lo que se ganaría en el mes si se cumple la meta los días que faltan. */
  proyectado: number
}

/**
 * Proyección del mes de un trabajo por días. Cada día del mes aporta así:
 *  - con jornada registrada: lo realmente ganado (0 si fue descanso);
 *  - sin jornada, y que se puede trabajar: el valor de la meta, mientras el día siga abierto, es decir
 *    desde hoy hacia atrás hasta donde la app aún lo pregunta, y todo lo que falta del mes;
 *  - los demás días (libres, anteriores al inicio del trabajo o demasiado viejos): nada.
 * Así, al responder un día, la proyección baja si no se trabajó o se ganó menos que la meta, y sube si se ganó más.
 */
export function proyectarMes(datos: {
  mes: string
  metaDiaria: number
  diasLibres: number[]
  creado: string
  activo: boolean
  hoy: string
  jornadas: JornadaMonto[]
}): Proyeccion {
  const { mes, metaDiaria, diasLibres, creado, activo, hoy, jornadas } = datos
  const [anio, m] = mes.split('-').map(Number)
  const diasEnMes = new Date(anio, m, 0).getDate()
  const porFecha = new Map(jornadas.map((j) => [j.fecha, j]))
  const piso = sumarDias(hoy, -(VENTANA_JORNADAS - 1))

  let registrado = 0
  let diasSupuestos = 0
  for (let d = 1; d <= diasEnMes; d++) {
    const fecha = `${mes}-${dos(d)}`
    const jornada = porFecha.get(fecha)
    if (jornada) {
      registrado += jornada.estado === 'trabajada' ? (jornada.monto ?? 0) : 0
    } else if (
      activo &&
      !diasLibres.includes(new Date(anio, m - 1, d).getDay()) &&
      fecha >= creado &&
      fecha >= piso
    ) {
      diasSupuestos++
    }
  }
  const supuesto = diasSupuestos * metaDiaria
  return { registrado, supuesto, diasSupuestos, proyectado: registrado + supuesto }
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
  // Una jornada cuyo ingreso se borró no cuenta como día trabajado ni suma dinero.
  const conMonto = (j: JornadaMonto): j is JornadaMonto & { monto: number } => j.estado === 'trabajada' && j.monto !== null
  const trabajadas = delMes.filter(conMonto)
  const ganado = trabajadas.reduce((s, j) => s + j.monto, 0)
  const promedio = trabajadas.length > 0 ? Math.round(ganado / trabajadas.length) : null
  const lunes = lunesDe(hoy)
  return {
    ganado,
    trabajados: trabajadas.length,
    descansos: delMes.filter((j) => j.estado === 'descanso').length,
    promedio,
    frenteAMeta: promedio === null ? null : promedio - metaDiaria,
    semana: hoy.startsWith(mes)
      ? jornadas.filter(conMonto).filter((j) => j.fecha >= lunes && j.fecha <= hoy).reduce((s, j) => s + j.monto, 0)
      : null,
  }
}
