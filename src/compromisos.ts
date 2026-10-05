import { useLiveQuery } from 'dexie-react-hooks'
import { db, type Ajuste } from './db'
import { calcularPlan, fechaCuota, saldoActual } from './deudas'
import { hoy } from './fechas'
import { claveProgramado } from './programadosPuro'
import { cuotasAbiertas, vencimientosAbiertos } from './recurrencia'

/** Algo que todavía no está registrado como movimiento pero ya es seguro que va a pasar en el mes. */
export interface Compromiso {
  clave: string
  tipo: 'deuda' | 'ahorro' | 'recurrente'
  /** Si resta dinero ('pagar') o suma ('recibir'). */
  direccion: 'pagar' | 'recibir'
  fecha: string
  nombre: string
  icono: string
  monto: number
}

export interface Compromisos {
  items: Compromiso[]
  porPagar: { deudas: number; ahorros: number; fijos: number; total: number }
  porRecibir: number
  /** Deudas con saldo y sin día de pago: no se puede saber cuándo vencen, así que no se incluyen. */
  deudasSinDia: string[]
}

const suma = (items: Compromiso[]) => items.reduce((s, c) => s + c.monto, 0)

/**
 * Todo lo que falta por pagar o recibir en `mes` (AAAA-MM) y aún no está registrado: cuotas de deudas con el monto del
 * plan, cuotas de ahorro programado y movimientos recurrentes. Incluye lo ya vencido que sigue sin atender y lo que
 * vence más adelante en el mes. Al registrar una de estas partidas sale de aquí y entra a los movimientos reales,
 * así que el dinero libre del mes no cambia (salvo que el monto real sea distinto).
 */
export async function leerCompromisos(mes: string): Promise<Compromisos> {
  const [anio, m] = mes.split('-').map(Number)
  const desde = `${mes}-01`
  const hasta = `${mes}-${String(new Date(anio, m, 0).getDate()).padStart(2, '0')}`
  const hoyTexto = hoy()

  const [deudas, pagos, ajustes, metas, aportes, recurrentes, ocurrencias, categorias] = await Promise.all([
    db.deudas.toArray(),
    db.pagosDeuda.toArray(),
    db.ajustes.toArray(),
    db.metas.toArray(),
    db.aportes.toArray(),
    db.recurrentes.toArray(),
    db.ocurrencias.toArray(),
    db.categorias.toArray(),
  ])
  const items: Compromiso[] = []
  const deudasSinDia: string[] = []

  // Deudas: cada cuota lleva el monto que indica el plan (mínimo, o más si el método elegido le asigna dinero extra).
  const extra = ajustes.find((a): a is Extract<Ajuste, { clave: 'deudaExtra' }> => a.clave === 'deudaExtra')?.valor ?? 0
  const elegida = ajustes.find((a): a is Extract<Ajuste, { clave: 'deudaEstrategia' }> => a.clave === 'deudaEstrategia')?.valor
  const plan = calcularPlan(deudas, pagos, extra, elegida).resultado.plan
  for (const deuda of deudas) {
    const propios = pagos.filter((p) => p.deudaId === deuda.id)
    if (saldoActual(deuda, propios) === 0) continue
    if (deuda.diaPago === undefined) {
      deudasSinDia.push(deuda.nombre)
      continue
    }
    const resueltas = new Set(propios.flatMap((p) => (p.fechaCuota ? [p.fechaCuota] : [])))
    for (let i = 0; i < plan.length; i++) {
      const pago = plan[i].lineas.find((l) => l.deudaId === deuda.id)?.pago
      if (pago === undefined) break // en el plan, la deuda ya quedó saldada
      const fecha = fechaCuota(deuda, propios, i + 1)
      if (!fecha || fecha > hasta) break
      if (fecha >= desde && !resueltas.has(fecha)) {
        items.push({ clave: claveProgramado('deuda', deuda.id!, fecha), tipo: 'deuda', direccion: 'pagar', fecha, nombre: `Pago de ${deuda.nombre}`, icono: deuda.icono, monto: pago })
      }
    }
  }

  // Ahorros programados: la cuota fija, hasta la fecha final del plan.
  for (const meta of metas) {
    if (!meta.programa || meta.archivada || !meta.fechaMeta) continue
    const resueltas = new Set(aportes.flatMap((a) => (a.metaId === meta.id && a.fechaCuota ? [a.fechaCuota] : [])))
    for (const fecha of cuotasAbiertas(meta.programa, meta.fechaMeta, resueltas, hoyTexto, desde, hasta)) {
      items.push({ clave: claveProgramado('ahorro', meta.id!, fecha), tipo: 'ahorro', direccion: 'pagar', fecha, nombre: `Ahorro: ${meta.nombre}`, icono: meta.icono, monto: meta.programa.cuota })
    }
  }

  // Movimientos recurrentes (arriendo, servicios, salario…): lo habitual de cada uno.
  for (const r of recurrentes) {
    if (!r.activo) continue
    const resueltas = new Set(ocurrencias.flatMap((o) => (o.recurrenteId === r.id ? [o.fecha] : [])))
    const icono = categorias.find((c) => c.id === r.categoriaId)?.icono ?? '🧾'
    for (const fecha of vencimientosAbiertos(r.dias, r.creado, resueltas, hoyTexto, desde, hasta)) {
      items.push({ clave: `r|${r.id}|${fecha}`, tipo: 'recurrente', direccion: r.tipo === 'gasto' ? 'pagar' : 'recibir', fecha, nombre: r.nombre, icono, monto: r.monto })
    }
  }

  items.sort((a, b) => a.fecha.localeCompare(b.fecha) || a.clave.localeCompare(b.clave))
  const aPagar = items.filter((c) => c.direccion === 'pagar')
  const deDeudas = suma(aPagar.filter((c) => c.tipo === 'deuda'))
  const deAhorros = suma(aPagar.filter((c) => c.tipo === 'ahorro'))
  const fijos = suma(aPagar.filter((c) => c.tipo === 'recurrente'))
  return {
    items,
    porPagar: { deudas: deDeudas, ahorros: deAhorros, fijos, total: deDeudas + deAhorros + fijos },
    porRecibir: suma(items.filter((c) => c.direccion === 'recibir')),
    deudasSinDia,
  }
}

/** Lo que falta por pagar y recibir en el mes; se actualiza solo cuando cambian los datos. */
export function useCompromisos(mes: string): Compromisos | undefined {
  return useLiveQuery(() => leerCompromisos(mes), [mes])
}
