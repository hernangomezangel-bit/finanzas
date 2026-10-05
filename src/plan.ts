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

// ---------- Tasa y número de cuotas: dos formas de decir lo mismo ----------
// Con un saldo, una cuota fija y una tasa mensual, el número de cuotas queda determinado, y al revés.
// Usa la fórmula de los préstamos: saldo = cuota × (1 − (1 + r)^−n) / r.

/** Valor presente de `n` cuotas de 1 peso a la tasa mensual `r` (con r = 0 es simplemente n). */
function factorDeAnualidad(r: number, n: number): number {
  return r === 0 ? n : -Math.expm1(-n * Math.log1p(r)) / r
}

/**
 * Cuántas cuotas (puede tener decimales: la última sería menor) hacen falta para pagar `saldo` con cuotas de `pago`
 * y una tasa mensual `tm`. Devuelve null si el pago no alcanza ni a cubrir los intereses, porque entonces nunca se termina.
 */
export function cuotasParaTasa(saldo: number, pago: number, tm: number): number | null {
  if (saldo <= 0 || pago <= 0 || tm < 0) return null
  if (tm === 0) return saldo / pago
  const interes = tm * saldo
  if (interes >= pago) return null
  return -Math.log1p(-interes / pago) / Math.log1p(tm)
}

/**
 * Qué tasa mensual hace que `n` cuotas de `pago` paguen exactamente `saldo`. Devuelve null si es imposible: cuando
 * las cuotas sumadas no alcanzan a cubrir lo que se debe (haría falta una tasa negativa).
 */
export function tasaParaCuotas(saldo: number, pago: number, n: number): number | null {
  if (saldo <= 0 || pago <= 0 || !Number.isInteger(n) || n < 1) return null
  if (pago * n < saldo) return null
  if (pago * n === saldo) return 0
  // El valor presente baja a medida que sube la tasa: se busca por bisección entre 0 y una tasa suficientemente alta.
  let bajo = 0
  let alto = 1
  for (let i = 0; i < 60 && pago * factorDeAnualidad(alto, n) > saldo; i++) alto *= 2
  for (let i = 0; i < 200; i++) {
    const medio = (bajo + alto) / 2
    if (pago * factorDeAnualidad(medio, n) > saldo) bajo = medio
    else alto = medio
  }
  return (bajo + alto) / 2
}

export interface EntradaVinculo {
  saldo: number
  pago: number
  tipo: TipoTasa
  /** Porcentaje que escribió la persona (28,5 = 28,5 %), o null si está vacío o no es válido. */
  tasa: number | null
  cuotas: number | null
  /** Cuál de las dos escribió la persona por última vez: la otra se calcula a partir de esta. */
  editado: 'tasa' | 'cuotas'
}

export interface ResultadoVinculo {
  tasa: number | null
  cuotas: number | null
  /** 'nunca': con esa tasa el pago no cubre los intereses. 'imposible': las cuotas no alcanzan a pagar el saldo. */
  problema?: 'nunca' | 'imposible'
}

/**
 * Mantiene relacionadas la tasa y el número de cuotas. Lo que la persona escribió se respeta tal cual; solo se
 * calcula la otra casilla, si ya hay saldo y pago. La tasa calculada sale en la misma unidad que eligió (E.A. o mensual).
 */
export function sincronizarTasaCuotas(e: EntradaVinculo): ResultadoVinculo {
  const completo = e.saldo > 0 && e.pago > 0
  if (e.editado === 'tasa') {
    if (!completo || e.tasa === null) return { tasa: e.tasa, cuotas: null }
    const n = cuotasParaTasa(e.saldo, e.pago, tasaMensual(e.tasa, e.tipo))
    if (n === null) return { tasa: e.tasa, cuotas: null, problema: 'nunca' }
    // Si el resultado cae casi sobre un número entero (por el redondeo de la tasa), se toma ese entero.
    const entero = Math.round(n)
    return { tasa: e.tasa, cuotas: Math.abs(n - entero) < 0.05 && entero >= 1 ? entero : Math.ceil(n) }
  }
  if (!completo || e.cuotas === null) return { tasa: null, cuotas: e.cuotas }
  const tm = tasaParaCuotas(e.saldo, e.pago, e.cuotas)
  if (tm === null) return { tasa: null, cuotas: e.cuotas, problema: 'imposible' }
  const porcentaje = (e.tipo === 'mensual' ? tm : tasaEfectivaAnual(tm)) * 100
  return { tasa: Math.round(porcentaje * 100) / 100, cuotas: e.cuotas }
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
