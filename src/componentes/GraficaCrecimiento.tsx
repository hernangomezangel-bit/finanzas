import type { Punto } from '../ahorros'
import { numeroDeDia } from '../fechas'
import { pesos } from '../formato'

const compacto = new Intl.NumberFormat('es-CO', { notation: 'compact', maximumFractionDigits: 1 })

const ANCHO = 320
const ALTO = 170
const MARGEN = { izq: 10, der: 10, arriba: 18, abajo: 24 }

const etiquetaDia = (dia: number) =>
  new Date(dia * 86_400_000).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })

export default function GraficaCrecimiento({
  puntos,
  objetivo,
  hasta,
}: {
  puntos: Punto[]
  /** Si se da, se dibuja una línea punteada con la meta. */
  objetivo?: number
  /** Fecha (AAAA-MM-DD) hasta donde se extiende el eje, p. ej. la fecha límite de la meta. */
  hasta?: string
}) {
  if (puntos.length === 0) return null

  const x0 = puntos[0].dia
  const x1 = Math.max(puntos[puntos.length - 1].dia, hasta ? numeroDeDia(hasta) : 0, x0 + 1)
  const maximo = Math.max(objetivo ?? 0, ...puntos.map((p) => p.valor)) * 1.08
  const interior = { ancho: ANCHO - MARGEN.izq - MARGEN.der, alto: ALTO - MARGEN.arriba - MARGEN.abajo }
  const px = (dia: number) => MARGEN.izq + ((dia - x0) / (x1 - x0)) * interior.ancho
  const py = (valor: number) => MARGEN.arriba + interior.alto - (valor / maximo) * interior.alto
  const base = py(0)

  const linea = puntos.map((p, i) => `${i === 0 ? 'M' : 'L'}${px(p.dia).toFixed(1)} ${py(p.valor).toFixed(1)}`).join(' ')
  const area = `${linea} L${px(puntos[puntos.length - 1].dia).toFixed(1)} ${base} L${px(x0).toFixed(1)} ${base} Z`
  const final = puntos[puntos.length - 1].valor

  return (
    <svg
      viewBox={`0 0 ${ANCHO} ${ALTO}`}
      className="grafica"
      role="img"
      aria-label={`Crecimiento del ahorro, de ${etiquetaDia(x0)} a ${etiquetaDia(x1)}. Acumulado: ${pesos(final)}`}
    >
      <line x1={MARGEN.izq} x2={ANCHO - MARGEN.der} y1={base} y2={base} className="eje" />
      {objetivo !== undefined && (
        <>
          <line x1={MARGEN.izq} x2={ANCHO - MARGEN.der} y1={py(objetivo)} y2={py(objetivo)} className="linea-meta" />
          <text x={ANCHO - MARGEN.der} y={py(objetivo) - 4} textAnchor="end" className="texto-grafica">
            Meta {compacto.format(objetivo)}
          </text>
        </>
      )}
      <path d={area} className="area" />
      <path d={linea} className="linea" />
      {puntos.filter((p) => p.real).map((p, i) => (
        <circle key={i} cx={px(p.dia)} cy={py(p.valor)} r="3.5" className="punto" />
      ))}
      <text x={MARGEN.izq} y={ALTO - 6} className="texto-grafica">{etiquetaDia(x0)}</text>
      <text x={ANCHO - MARGEN.der} y={ALTO - 6} textAnchor="end" className="texto-grafica">{etiquetaDia(x1)}</text>
      <text x={MARGEN.izq} y="11" className="texto-grafica">Ahorrado: {compacto.format(final)}</text>
    </svg>
  )
}
