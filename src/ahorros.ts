import { CATEGORIA_AHORRO, db, type Aporte } from './db'
import { hoy, numeroDeDia } from './fechas'

export interface Punto {
  dia: number
  valor: number
  /** Los puntos reales son aportes; los demás solo marcan el inicio y el día de hoy. */
  real: boolean
}

/** Ahorro acumulado a lo largo del tiempo, a partir de los aportes. */
export function serieAcumulada(aportes: Aporte[], inicio: string): Punto[] {
  if (aportes.length === 0) return []
  const orden = [...aportes].sort((a, b) => a.fecha.localeCompare(b.fecha) || a.id! - b.id!)
  const puntos: Punto[] = []
  if (inicio < orden[0].fecha) puntos.push({ dia: numeroDeDia(inicio), valor: 0, real: false })
  let total = 0
  for (const a of orden) {
    total += a.monto
    puntos.push({ dia: numeroDeDia(a.fecha), valor: total, real: true })
  }
  const hoyDia = numeroDeDia(hoy())
  if (hoyDia > puntos[puntos.length - 1].dia) puntos.push({ dia: hoyDia, valor: total, real: false })
  return puntos
}

export interface DatosAporte {
  metaId: number
  monto: number
  fecha: string
  nota: string
  /** Si es true, el aporte también aparece como gasto en el Presupuesto. */
  comoGasto: boolean
}

async function categoriaAhorroId(): Promise<number> {
  const existente = await db.categorias.filter((c) => c.clave === 'ahorro').first()
  return existente?.id ?? db.categorias.add({ ...CATEGORIA_AHORRO })
}

/** Crea o actualiza un aporte y mantiene sincronizado su gasto en el Presupuesto. */
export async function guardarAporte(datos: DatosAporte, existente?: Aporte): Promise<void> {
  await db.transaction('rw', db.categorias, db.movimientos, db.aportes, db.metas, async () => {
    const meta = await db.metas.get(datos.metaId)
    const nota = `Aporte a ${meta?.nombre ?? 'meta'}${datos.nota ? `: ${datos.nota}` : ''}`.slice(0, 200)
    const gastoActual = existente?.movimientoId ? await db.movimientos.get(existente.movimientoId) : undefined

    let movimientoId: number | undefined
    if (datos.comoGasto) {
      const gasto = { tipo: 'gasto' as const, monto: datos.monto, fecha: datos.fecha, nota }
      if (gastoActual) {
        // Se respeta la categoría si la persona la cambió en el Presupuesto.
        await db.movimientos.update(gastoActual.id!, gasto)
        movimientoId = gastoActual.id
      } else {
        movimientoId = await db.movimientos.add({ ...gasto, categoriaId: await categoriaAhorroId() })
      }
    } else if (gastoActual) {
      await db.movimientos.delete(gastoActual.id!)
    }

    const registro = {
      metaId: datos.metaId,
      monto: datos.monto,
      fecha: datos.fecha,
      nota: datos.nota,
      ...(movimientoId !== undefined ? { movimientoId } : {}),
    }
    if (existente) await db.aportes.put({ ...registro, id: existente.id })
    else await db.aportes.add(registro)
  })
}

export async function eliminarAporte(aporte: Aporte): Promise<void> {
  await db.transaction('rw', db.movimientos, db.aportes, async () => {
    if (aporte.movimientoId !== undefined) await db.movimientos.delete(aporte.movimientoId)
    await db.aportes.delete(aporte.id!)
  })
}

/** Borra la meta y sus aportes. Los gastos que ya contaron en el Presupuesto se conservan. */
export async function eliminarMeta(metaId: number): Promise<void> {
  await db.transaction('rw', db.metas, db.aportes, async () => {
    await db.aportes.where('metaId').equals(metaId).delete()
    await db.metas.delete(metaId)
  })
}
