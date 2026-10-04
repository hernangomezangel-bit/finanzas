import { useLiveQuery } from 'dexie-react-hooks'
import { db, type Categoria, type Movimiento } from './db'
import { moverMes } from './fechas'

const MESES_ATRAS = 6

export interface PromedioVariable {
  /** Pesos por mes, redondeado. */
  promedio: number
  /** Cuántos meses se usaron para el promedio (de 1 a 6). */
  meses: number
}

/**
 * Cuánto entra en promedio al mes por ingresos variables (comisiones, trabajos por fuera),
 * mirando hasta 6 meses completos antes de `mes`. Cuenta desde el primer mes con datos, para
 * que un historial corto no baje el promedio. Devuelve null si aún no hay historial.
 */
export function promedioVariable(movimientos: Movimiento[], categorias: Categoria[], mes: string): PromedioVariable | null {
  const variables = new Set(categorias.filter((c) => c.variable).map((c) => c.id!))
  const desde = moverMes(mes, -MESES_ATRAS)
  const porMes = new Map<string, number>()
  for (const m of movimientos) {
    const mesM = m.fecha.slice(0, 7)
    if (m.tipo !== 'ingreso' || !variables.has(m.categoriaId) || mesM >= mes || mesM < desde) continue
    porMes.set(mesM, (porMes.get(mesM) ?? 0) + m.monto)
  }
  if (porMes.size === 0) return null
  const primero = [...porMes.keys()].sort()[0]
  const [a1, m1] = primero.split('-').map(Number)
  const [a2, m2] = mes.split('-').map(Number)
  const meses = Math.min(MESES_ATRAS, (a2 - a1) * 12 + (m2 - m1))
  const total = [...porMes.values()].reduce((s, v) => s + v, 0)
  return { promedio: Math.round(total / meses), meses }
}

/** Promedio mensual de ingresos variables antes del mes dado; se actualiza solo cuando cambian los datos. */
export function usePromedioVariable(mes: string): PromedioVariable | null | undefined {
  return useLiveQuery(async () => {
    const [movimientos, categorias] = await Promise.all([
      db.movimientos.where('fecha').between(`${moverMes(mes, -MESES_ATRAS)}-01`, `${mes}-01`).toArray(),
      db.categorias.toArray(),
    ])
    return promedioVariable(movimientos, categorias, mes)
  }, [mes])
}
