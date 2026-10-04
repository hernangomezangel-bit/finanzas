import { useLiveQuery } from 'dexie-react-hooks'
import { db, type Fuente, type Jornada } from './db'
import { claveJornada, lunesDe, pendientesDiarios, resumirMes, type ResumenMes } from './diario'
import { hoy } from './fechas'

export interface DiaConFuente {
  fuente: Fuente
  fecha: string
}

/** Los días en que ya se podía trabajar y todavía no se ha dicho qué pasó (hoy primero). */
export async function leerDiasPendientes(): Promise<DiaConFuente[]> {
  const [fuentes, jornadas] = await Promise.all([db.fuentes.toArray(), db.jornadas.toArray()])
  const resueltas = new Set(jornadas.map((j) => claveJornada(j.fuenteId, j.fecha)))
  const lista = pendientesDiarios(
    fuentes.map((f) => ({ id: f.id!, creado: f.creado, activo: f.activo, diasLibres: f.diasLibres })),
    resueltas,
    hoy(),
  )
  const porId = new Map(fuentes.map((f) => [f.id!, f]))
  return lista.map((d) => ({ fuente: porId.get(d.fuenteId)!, fecha: d.fecha }))
}

/** Registra lo ganado ese día como ingreso y deja el día como trabajado. Devuelve el id de la jornada. */
export async function registrarJornada(fuente: Fuente, fecha: string, monto: number): Promise<number> {
  return db.transaction('rw', db.movimientos, db.jornadas, async () => {
    const movimientoId = await db.movimientos.add({
      tipo: 'ingreso',
      monto,
      categoriaId: fuente.categoriaId,
      fecha,
      nota: fuente.nombre,
    })
    return db.jornadas.add({ fuenteId: fuente.id!, fecha, estado: 'trabajada', monto, movimientoId })
  })
}

/** Marca el día como descanso: no se ganó nada y no se vuelve a preguntar. */
export async function registrarDescanso(fuente: Fuente, fecha: string): Promise<number> {
  return db.jornadas.add({ fuenteId: fuente.id!, fecha, estado: 'descanso' })
}

/** Quita la jornada (y su ingreso, si lo tenía) para volver a preguntar ese día. */
export async function deshacerJornada(jornadaId: number): Promise<void> {
  await db.transaction('rw', db.movimientos, db.jornadas, async () => {
    const jornada = await db.jornadas.get(jornadaId)
    if (!jornada) return
    if (jornada.movimientoId !== undefined) await db.movimientos.delete(jornada.movimientoId)
    await db.jornadas.delete(jornadaId)
  })
}

/** Borra el trabajo y su historial de días. Los ingresos ya registrados se conservan. */
export async function eliminarFuente(id: number): Promise<void> {
  await db.transaction('rw', db.fuentes, db.jornadas, async () => {
    await db.jornadas.where('fuenteId').equals(id).delete()
    await db.fuentes.delete(id)
  })
}

export interface ResumenFuente {
  fuente: Fuente
  resumen: ResumenMes
}

/**
 * Resumen del mes de cada trabajo por días. El dinero sale de los ingresos registrados: si editas
 * el monto en Presupuesto se actualiza aquí, y si borras ese ingreso, el día deja de contar.
 */
export function useResumenesJornadas(mes: string): ResumenFuente[] | undefined {
  return useLiveQuery(async () => {
    // La semana en curso puede empezar en el mes anterior; se cargan esos días para no contarla corta.
    const lunes = lunesDe(hoy())
    const desde = lunes < `${mes}-01` ? lunes : `${mes}-01`
    const [fuentes, jornadas, movimientos] = await Promise.all([
      db.fuentes.toArray(),
      db.jornadas.where('fecha').between(desde, `${mes}-32`).toArray(),
      db.movimientos.where('fecha').between(desde, `${mes}-32`).toArray(),
    ])
    const montos = new Map(movimientos.map((m) => [m.id!, m.monto]))
    const efectivo = (j: Jornada) =>
      j.estado === 'descanso' ? 0 : j.movimientoId !== undefined ? montos.get(j.movimientoId) : j.monto
    return fuentes.map((fuente) => ({
      fuente,
      resumen: resumirMes(
        jornadas
          .filter((j) => j.fuenteId === fuente.id)
          .flatMap((j) => {
            const monto = efectivo(j)
            return monto === undefined ? [] : [{ fecha: j.fecha, estado: j.estado, monto }]
          }),
        mes,
        fuente.metaDiaria,
        hoy(),
      ),
    }))
  }, [mes])
}

const NOMBRES_DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']
export const ETIQUETAS_DIAS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

export function textoDiasLibres(dias: number[]): string {
  if (dias.length === 0) return 'Sin días libres fijos'
  const nombres = [...dias].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7)).map((d) => NOMBRES_DIAS[d])
  return `No trabajas: ${nombres.join(', ')}`
}
