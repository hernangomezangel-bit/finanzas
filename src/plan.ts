// Cálculos del plan de pago de deudas. Es código puro (sin pantalla ni base de datos),
// así se puede probar solo y los números del plan salen siempre de un único lugar.

export type Estrategia = 'bola' | 'avalancha'
export type TipoTasa = 'ea' | 'mensual'

export interface DeudaPlan {
  id: number
  nombre: string
  saldo: number
  /** Tasa efectiva mensual como fracción (0,02 = 2 % al mes). */
  tm: number
  minimo: number
}

export interface LineaPago {
  deudaId: number
  pago: number
  interes: number
  capital: number
  saldoFinal: number
}

export interface MesPlan {
  mes: number
  lineas: LineaPago[]
  pagoTotal: number
  saldoTotal: number
}

export interface ResultadoPlan {
  estrategia: Estrategia
  /** false si, con estos pagos, las deudas no se terminan nunca. */
  viable: boolean
  meses: number
  interesTotal: number
  pagoTotal: number
  plan: MesPlan[]
  /** Mes (1, 2, 3…) en que queda en cero cada deuda. */
  liquidada: Record<number, number>
}

const MAX_MESES = 1200
const MESES_VISIBLES_SI_NO_VIABLE = 60

/** Convierte la tasa que escribe la persona a tasa efectiva mensual. */
export function tasaMensual(tasa: number, tipo: TipoTasa): number {
  const t = tasa / 100
  return tipo === 'mensual' ? t : Math.pow(1 + t, 1 / 12) - 1
}

export function tasaEfectivaAnual(tm: number): number {
  return Math.pow(1 + tm, 12) - 1
}

/**
 * Simula mes a mes. Cada mes:
 *  1) se suman los intereses al saldo de cada deuda,
 *  2) se paga el mínimo de cada una,
 *  3) todo el dinero que sobra (extra + mínimos de deudas ya saldadas) va a la deuda prioritaria.
 * Bola de nieve prioriza el saldo más pequeño; avalancha, la tasa más alta.
 * El dinero total que se destina cada mes se mantiene constante.
 */
export function simular(deudas: DeudaPlan[], extra: number, estrategia: Estrategia): ResultadoPlan {
  const activas = deudas.filter((d) => d.saldo > 0).map((d) => ({ ...d }))
  const presupuesto = activas.reduce((s, d) => s + d.minimo, 0) + Math.max(0, extra)

  const plan: MesPlan[] = []
  const liquidada: Record<number, number> = {}
  let interesTotal = 0
  let pagoTotal = 0
  let mes = 0

  while (activas.some((d) => d.saldo > 0) && mes < MAX_MESES) {
    mes++
    const enCurso = activas.filter((d) => d.saldo > 0)
    const detalle = new Map(enCurso.map((d) => [d.id, { pago: 0, interes: 0 }]))

    for (const d of enCurso) {
      const interes = Math.round(d.saldo * d.tm)
      d.saldo += interes
      detalle.get(d.id)!.interes = interes
    }

    let disponible = presupuesto
    const pagar = (d: DeudaPlan, tope: number) => {
      const p = Math.min(tope, d.saldo, disponible)
      d.saldo -= p
      disponible -= p
      detalle.get(d.id)!.pago += p
    }

    for (const d of enCurso) pagar(d, d.minimo)

    const orden = [...enCurso].sort((a, b) =>
      estrategia === 'bola' ? a.saldo - b.saldo : b.tm - a.tm || a.saldo - b.saldo,
    )
    for (const d of orden) {
      if (disponible <= 0) break
      pagar(d, Infinity)
    }

    const lineas: LineaPago[] = enCurso.map((d) => {
      const { pago, interes } = detalle.get(d.id)!
      if (d.saldo === 0) liquidada[d.id] = mes
      return { deudaId: d.id, pago, interes, capital: pago - interes, saldoFinal: d.saldo }
    })
    const pagoMes = lineas.reduce((s, l) => s + l.pago, 0)
    interesTotal += lineas.reduce((s, l) => s + l.interes, 0)
    pagoTotal += pagoMes
    plan.push({ mes, lineas, pagoTotal: pagoMes, saldoTotal: activas.reduce((s, d) => s + d.saldo, 0) })
  }

  const viable = !activas.some((d) => d.saldo > 0)
  return {
    estrategia,
    viable,
    meses: viable ? mes : 0,
    interesTotal: viable ? interesTotal : 0,
    pagoTotal: viable ? pagoTotal : 0,
    plan: viable ? plan : plan.slice(0, MESES_VISIBLES_SI_NO_VIABLE),
    liquidada: viable ? liquidada : {},
  }
}
