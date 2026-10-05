import { liveQuery } from 'dexie'
import { CATEGORIA_AHORRO, CATEGORIA_DEUDAS, db, type Ajuste, type Movimiento } from './db'
import { omitirCuotaAhorro } from './ahorros'
import { calcularPlan, fechaCuota, omitirCuota, saldoActual } from './deudas'
import { hoy } from './fechas'
import {
  claveProgramado,
  limiteDeProgramacion,
  MESES_POR_ADELANTADO,
  planificarCambios,
  type Deseada,
  type Existente,
} from './programadosPuro'
import { omitirVencimiento } from './recurrentes'
import { cuotasAbiertas, vencimientosAbiertos } from './recurrencia'

// Movimientos programados: la app crea sola, como movimientos normales de Presupuesto, las cuotas de cada deuda con
// día de pago, las cuotas de cada ahorro programado y los gastos e ingresos fijos (recurrentes) de los próximos
// meses, así aparecen ya en cada mes. Aquí se mantienen al día cuando cambia algo (el plan, el día de pago, una cuota
// pagada u omitida, una meta cerrada, un recurrente pausado…) y cuando pasa el tiempo.

async function categoriaPorClave(clave: 'ahorro' | 'deudas'): Promise<number> {
  const existente = await db.categorias.filter((c) => c.clave === clave).first()
  return existente?.id ?? db.categorias.add({ ...(clave === 'ahorro' ? CATEGORIA_AHORRO : CATEGORIA_DEUDAS) })
}

/** Lo que debería existir: cuotas y recurrentes sin atender, con fecha hasta el límite de programación. */
async function calcularDeseadas(): Promise<Deseada[]> {
  const hoyTexto = hoy()
  const hasta = limiteDeProgramacion(hoyTexto, MESES_POR_ADELANTADO)
  const [deudas, pagos, ajustes, metas, aportes, recurrentes, ocurrencias] = await Promise.all([
    db.deudas.toArray(),
    db.pagosDeuda.toArray(),
    db.ajustes.toArray(),
    db.metas.toArray(),
    db.aportes.toArray(),
    db.recurrentes.toArray(),
    db.ocurrencias.toArray(),
  ])
  const deseadas: Deseada[] = []

  // Deudas: cada cuota lleva el monto que indica el plan (mínimo, o más si el método elegido le asigna dinero extra),
  // hasta que la deuda quede saldada en el plan.
  const extra = ajustes.find((a): a is Extract<Ajuste, { clave: 'deudaExtra' }> => a.clave === 'deudaExtra')?.valor ?? 0
  const elegida = ajustes.find((a): a is Extract<Ajuste, { clave: 'deudaEstrategia' }> => a.clave === 'deudaEstrategia')?.valor
  const plan = calcularPlan(deudas, pagos, extra, elegida).resultado.plan
  for (const deuda of deudas) {
    const propios = pagos.filter((p) => p.deudaId === deuda.id)
    if (deuda.diaPago === undefined || saldoActual(deuda, propios) === 0) continue
    const resueltas = new Set(propios.flatMap((p) => (p.fechaCuota ? [p.fechaCuota] : [])))
    for (let i = 0; i < plan.length; i++) {
      const monto = plan[i].lineas.find((l) => l.deudaId === deuda.id)?.pago
      if (monto === undefined) break // en el plan, la deuda ya quedó saldada
      const fecha = fechaCuota(deuda, propios, i + 1)
      if (!fecha || fecha > hasta) break
      if (resueltas.has(fecha) || monto <= 0) continue
      deseadas.push({
        clave: claveProgramado('deuda', deuda.id!, fecha),
        origen: 'deuda',
        refId: deuda.id!,
        fechaCuota: fecha,
        tipo: 'gasto',
        monto,
        nota: `Pago de ${deuda.nombre}`.slice(0, 200),
      })
    }
  }

  // Ahorros programados: la cuota fija, hasta la fecha final del plan.
  for (const meta of metas) {
    if (!meta.programa || meta.archivada || !meta.fechaMeta) continue
    const resueltas = new Set(aportes.flatMap((a) => (a.metaId === meta.id && a.fechaCuota ? [a.fechaCuota] : [])))
    for (const fecha of cuotasAbiertas(meta.programa, meta.fechaMeta, resueltas, hoyTexto, meta.programa.inicio, hasta)) {
      deseadas.push({
        clave: claveProgramado('ahorro', meta.id!, fecha),
        origen: 'ahorro',
        refId: meta.id!,
        fechaCuota: fecha,
        tipo: 'gasto',
        monto: meta.programa.cuota,
        nota: `Aporte a ${meta.nombre}`.slice(0, 200),
      })
    }
  }

  // Gastos e ingresos fijos (recurrentes): su monto habitual, cada mes, mientras estén activos.
  for (const r of recurrentes) {
    if (!r.activo) continue
    const resueltas = new Set(ocurrencias.flatMap((o) => (o.recurrenteId === r.id ? [o.fecha] : [])))
    for (const fecha of vencimientosAbiertos(r.dias, r.creado, resueltas, hoyTexto, r.creado, hasta)) {
      deseadas.push({
        clave: claveProgramado('recurrente', r.id!, fecha),
        origen: 'recurrente',
        refId: r.id!,
        fechaCuota: fecha,
        tipo: r.tipo,
        monto: r.monto,
        nota: (r.nota || r.nombre).slice(0, 200),
        categoriaId: r.categoriaId,
      })
    }
  }
  return deseadas
}

async function ejecutar(): Promise<void> {
  await db.transaction(
    'rw',
    [db.movimientos, db.categorias, db.deudas, db.pagosDeuda, db.ajustes, db.metas, db.aportes, db.recurrentes, db.ocurrencias],
    async () => {
      const deseadas = await calcularDeseadas()
      const existentes: Existente[] = (await db.movimientos.filter((m) => m.programado !== undefined).toArray()).map((m) => ({
        id: m.id!,
        clave: claveProgramado(m.programado!.origen, m.programado!.refId, m.programado!.fechaCuota),
        monto: m.monto,
        montoPlan: m.programado!.montoPlan,
        nota: m.nota,
      }))
      const cambios = planificarCambios(deseadas, existentes)

      for (const d of cambios.crear) {
        await db.movimientos.add({
          tipo: d.tipo,
          monto: d.monto,
          categoriaId: d.categoriaId ?? (await categoriaPorClave(d.origen === 'deuda' ? 'deudas' : 'ahorro')),
          fecha: d.fechaCuota,
          nota: d.nota,
          programado: { origen: d.origen, refId: d.refId, fechaCuota: d.fechaCuota, montoPlan: d.monto },
        })
      }
      for (const c of cambios.actualizar) {
        await db.movimientos.update(c.id, {
          ...(c.monto !== undefined ? { monto: c.monto } : {}),
          ...(c.montoPlan !== undefined ? { 'programado.montoPlan': c.montoPlan } : {}),
          ...(c.nota !== undefined ? { nota: c.nota } : {}),
        })
      }
      if (cambios.borrar.length > 0) await db.movimientos.bulkDelete(cambios.borrar)
    },
  )
}

// Una a la vez, para que dos avisos seguidos no choquen.
let cola: Promise<void> = Promise.resolve()

/** Pone al día los movimientos programados. Se puede llamar las veces que haga falta: si no hay nada que cambiar, no hace nada. */
export function sincronizarProgramados(): Promise<void> {
  cola = cola.then(ejecutar).catch(() => undefined)
  return cola
}

/**
 * Mantiene los movimientos programados al día mientras la app está abierta: al empezar, cada vez que cambian las deudas,
 * los ahorros, el plan o los recurrentes, y al volver a la app (por si pasó el tiempo). Devuelve cómo detenerlo.
 */
export function iniciarSincronizacion(): () => void {
  const suscripcion = liveQuery(() =>
    Promise.all([
      db.deudas.toArray(),
      db.pagosDeuda.toArray(),
      db.ajustes.toArray(),
      db.metas.toArray(),
      db.aportes.toArray(),
      db.recurrentes.toArray(),
      db.ocurrencias.toArray(),
    ]),
  ).subscribe({ next: () => void sincronizarProgramados(), error: () => undefined })
  const alVolver = () => {
    if (document.visibilityState === 'visible') void sincronizarProgramados()
  }
  document.addEventListener('visibilitychange', alVolver)
  return () => {
    suscripcion.unsubscribe()
    document.removeEventListener('visibilitychange', alVolver)
  }
}

/** Quitar un movimiento programado equivale a omitir esa cuota o ese vencimiento (si no, la app lo volvería a crear). */
export async function omitirProgramado(movimiento: Movimiento): Promise<void> {
  const programado = movimiento.programado
  if (programado?.origen === 'deuda') {
    const deuda = await db.deudas.get(programado.refId)
    if (deuda) return omitirCuota(deuda, programado.fechaCuota)
  } else if (programado?.origen === 'ahorro') {
    const meta = await db.metas.get(programado.refId)
    if (meta) return omitirCuotaAhorro(meta, programado.fechaCuota)
  } else if (programado?.origen === 'recurrente') {
    const recurrente = await db.recurrentes.get(programado.refId)
    if (recurrente) return omitirVencimiento(recurrente, programado.fechaCuota)
  }
  // Si el origen ya no existe, el movimiento programado sobra.
  await db.movimientos.delete(movimiento.id!)
}
