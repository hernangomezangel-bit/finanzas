// El ahorro y las metas que va anotando el asistente. Código puro, sin pantalla ni base de datos.

/** Para qué quiere ahorrar. `nose` es «Todavía no sé» y no se puede combinar con las demás. */
export type TipoAhorro = 'fondo' | 'meta' | 'inversion'

export interface DatosMeta {
  nombre?: string
  /** Cuánto necesita (opcional). */
  objetivo?: number
  /** Cuánto aparta cada mes. */
  cuota?: number
  /** Si la saltó: sigue marcada pero no cuenta. */
  saltada?: boolean
}

export interface DatosAhorro {
  /** Ids marcados (`fondo`, `meta`, `inversion` o `nose`), en el orden en que se preguntan. */
  elegidos: string[]
  metas: Record<string, DatosMeta>
}

export function ahorroVacio(): DatosAhorro {
  return { elegidos: [], metas: {} }
}

/** Marca o desmarca una opción. «Todavía no sé» desmarca las demás, y marcar otra desmarca «Todavía no sé». */
export function alternarAhorro(ahorro: DatosAhorro, id: string): DatosAhorro {
  if (ahorro.elegidos.includes(id)) return { ...ahorro, elegidos: ahorro.elegidos.filter((e) => e !== id) }
  if (id === 'nose') return { ...ahorro, elegidos: ['nose'] }
  return { ...ahorro, elegidos: [...ahorro.elegidos.filter((e) => e !== 'nose'), id] }
}

/** Las metas por las que hay que preguntar: todas las marcadas menos «Todavía no sé». */
export function metasElegidas(ahorro: DatosAhorro): string[] {
  return ahorro.elegidos.filter((id) => id !== 'nose')
}

export function noSabe(ahorro: DatosAhorro): boolean {
  return ahorro.elegidos.includes('nose')
}

/** Cambia lo respondido de una meta. Al escribir la cuota o el nombre, deja de estar saltada. */
export function editarMeta(ahorro: DatosAhorro, id: string, cambio: DatosMeta): DatosAhorro {
  const saltada = cambio.saltada ?? (cambio.nombre !== undefined || cambio.cuota !== undefined ? false : ahorro.metas[id]?.saltada)
  return { ...ahorro, metas: { ...ahorro.metas, [id]: { ...ahorro.metas[id], ...cambio, ...(saltada !== undefined ? { saltada } : {}) } } }
}

/** Las metas que cuentan: marcadas, con nombre y cuota, y sin saltar. */
export function metasContadas(ahorro: DatosAhorro): { id: string; nombre: string; objetivo: number | null; cuota: number }[] {
  return metasElegidas(ahorro).flatMap((id) => {
    const m = ahorro.metas[id]
    if (!m || m.saltada || !m.nombre?.trim() || typeof m.cuota !== 'number' || m.cuota <= 0) return []
    return [{ id, nombre: m.nombre.trim(), objetivo: typeof m.objetivo === 'number' && m.objetivo > 0 ? m.objetivo : null, cuota: m.cuota }]
  })
}

/** Cuánto aparta al mes en total. */
export function totalAhorro(ahorro: DatosAhorro): number {
  return metasContadas(ahorro).reduce((suma, m) => suma + m.cuota, 0)
}

/** Validación de lo guardado: el ahorro tiene la forma esperada. */
export function esDatosAhorro(dato: unknown): dato is DatosAhorro {
  if (typeof dato !== 'object' || dato === null) return false
  const d = dato as Record<string, unknown>
  if (!Array.isArray(d.elegidos) || !d.elegidos.every((e) => typeof e === 'string')) return false
  if (typeof d.metas !== 'object' || d.metas === null || Array.isArray(d.metas)) return false
  return Object.values(d.metas as Record<string, unknown>).every((v) => typeof v === 'object' && v !== null)
}
