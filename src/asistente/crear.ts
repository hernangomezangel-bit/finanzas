// Crea en la app el presupuesto que armó el asistente, con los mismos datos que usa todo lo demás: categorías (con su
// tope mensual), gastos e ingresos fijos (recurrentes) y metas de ahorro programado. Los movimientos de cada mes los
// programa solo la app, como con cualquier recurrente.
import { eliminarMeta } from '../ahorros'
import { guardarConfigAvisos } from '../avisosDatos'
import { db, type Categoria, type PresupuestoTico } from '../db'
import { hoy } from '../fechas'
import { eliminarRecurrente } from '../recurrentes'
import type { PlanPresupuesto } from './presupuesto'

/** Lo que Tico creó la última vez, si existe. */
export async function leerPresupuestoTico(): Promise<PresupuestoTico | null> {
  const ajuste = await db.ajustes.get('asistentePresupuesto')
  return ajuste?.clave === 'asistentePresupuesto' ? ajuste.valor : null
}

/** Busca una categoría por nombre (sin importar mayúsculas) y tipo; si no existe, la crea. Si estaba oculta, la vuelve a mostrar. */
async function categoriaPorNombre(nombre: string, tipo: Categoria['tipo'], icono: string, variable?: boolean): Promise<number> {
  const existente = await db.categorias.filter((c) => c.tipo === tipo && c.nombre.toLowerCase() === nombre.toLowerCase()).first()
  if (existente) {
    if (existente.oculta) await db.categorias.update(existente.id!, { oculta: undefined })
    return existente.id!
  }
  return db.categorias.add({ nombre, tipo, icono, ...(variable ? { variable: true } : {}) })
}

/**
 * Quita lo que Tico creó antes. Los gastos e ingresos que ya se confirmaron se conservan. Una meta a la que la persona
 * ya le hizo aportes no se borra (sería perder su historial): queda como suya y se devuelve su nombre para no duplicarla.
 */
async function quitarLoAnterior(anterior: PresupuestoTico): Promise<Set<string>> {
  for (const id of anterior.recurrenteIds) await eliminarRecurrente(id)
  const conservadas = new Set<string>()
  for (const id of anterior.metaIds) {
    const meta = await db.metas.get(id)
    if (!meta) continue
    const aportes = await db.aportes.where('metaId').equals(id).toArray()
    if (aportes.some((a) => !a.omitida && a.monto > 0)) conservadas.add(meta.nombre.toLowerCase())
    else await eliminarMeta(id)
  }
  for (const id of anterior.categoriasConTope) await db.categorias.update(id, { tope: undefined })
  return conservadas
}

/**
 * Crea el presupuesto del plan. Si Tico ya había creado uno, lo reemplaza (solo eso: lo hecho a mano no se toca).
 * Todo ocurre en una sola operación: o queda completo o no cambia nada. Se puede llamar más de una vez con el mismo plan.
 */
export async function crearPresupuestoTico(plan: PlanPresupuesto, avisos: { diasAntes: number } | null): Promise<void> {
  await db.transaction('rw', [db.categorias, db.recurrentes, db.ocurrencias, db.metas, db.aportes, db.movimientos, db.ajustes], async () => {
    const anterior = await leerPresupuestoTico()
    const metasConservadas = anterior ? await quitarLoAnterior(anterior) : new Set<string>()

    const categoriaIds = new Map<string, number>()
    for (const c of plan.categorias) categoriaIds.set(`${c.tipo}|${c.nombre.toLowerCase()}`, await categoriaPorNombre(c.nombre, c.tipo, c.icono, c.variable))
    const idDe = (tipo: Categoria['tipo'], nombre: string) => categoriaIds.get(`${tipo}|${nombre.toLowerCase()}`)!

    const categoriasConTope: number[] = []
    for (const t of plan.topes) {
      const id = idDe('gasto', t.categoria)
      await db.categorias.update(id, { tope: t.monto })
      categoriasConTope.push(id)
    }

    const recurrenteIds: number[] = []
    for (const i of plan.ingresos) {
      recurrenteIds.push(
        await db.recurrentes.add({ nombre: i.nombre, tipo: 'ingreso', monto: i.monto, categoriaId: idDe('ingreso', i.categoria), nota: '', dias: [i.dia], creado: plan.desde, activo: true }),
      )
    }
    for (const g of plan.fijos) {
      recurrenteIds.push(
        await db.recurrentes.add({ nombre: g.nombre, tipo: 'gasto', monto: g.monto, categoriaId: idDe('gasto', g.categoria), nota: '', dias: [g.dia], creado: plan.desde, activo: true }),
      )
    }

    const metaIds: number[] = []
    for (const m of plan.metas) {
      if (metasConservadas.has(m.nombre.toLowerCase())) continue
      metaIds.push(
        await db.metas.add({
          nombre: m.nombre,
          tipo: m.tipo,
          objetivo: m.objetivo,
          fechaMeta: m.fechaMeta,
          icono: m.icono,
          creada: hoy(),
          programa: { cuota: m.cuota, frecuencia: 'mensual', dia: m.dia, inicio: m.inicio },
        }),
      )
    }

    await db.ajustes.put({ clave: 'asistentePresupuesto', valor: { creadoEn: hoy(), para: plan.para, recurrenteIds, metaIds, categoriasConTope } })
    if (avisos) await guardarConfigAvisos({ dias: [avisos.diasAntes], estiloTico: true })
  })
}
