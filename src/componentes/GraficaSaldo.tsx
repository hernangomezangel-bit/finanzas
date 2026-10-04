export interface Serie {
  nombre: string
  color: string
  /** Saldo total al final de cada mes; la posición 0 es el saldo de hoy. */
  valores: number[]
}

const compacto = new Intl.NumberFormat('es-CO', { notation: 'compact', maximumFractionDigits: 1 })

const ANCHO = 320
const ALTO = 180
const MARGEN = { izq: 10, der: 10, arriba: 20, abajo: 24 }

/** Cómo baja lo que debes mes a mes, una línea por método. */
export default function GraficaSaldo({ series }: { series: Serie[] }) {
  const meses = Math.max(1, ...series.map((s) => s.valores.length - 1))
  const maximo = Math.max(1, ...series.flatMap((s) => s.valores)) * 1.05
  const ancho = ANCHO - MARGEN.izq - MARGEN.der
  const alto = ALTO - MARGEN.arriba - MARGEN.abajo
  const px = (mes: number) => MARGEN.izq + (mes / meses) * ancho
  const py = (valor: number) => MARGEN.arriba + alto - (valor / maximo) * alto

  return (
    <svg
      viewBox={`0 0 ${ANCHO} ${ALTO}`}
      className="grafica"
      role="img"
      aria-label={series
        .map((s) => `${s.nombre}: termina en ${s.valores.length - 1} meses`)
        .join('. ')}
    >
      <line x1={MARGEN.izq} x2={ANCHO - MARGEN.der} y1={py(0)} y2={py(0)} className="eje" />
      {series.map((s) => (
        <path
          key={s.nombre}
          d={s.valores.map((v, i) => `${i === 0 ? 'M' : 'L'}${px(i).toFixed(1)} ${py(v).toFixed(1)}`).join(' ')}
          fill="none"
          stroke={s.color}
          strokeWidth="2.5"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      ))}
      <text x={MARGEN.izq} y="12" className="texto-grafica">Debes hoy: {compacto.format(series[0]?.valores[0] ?? 0)}</text>
      <text x={MARGEN.izq} y={ALTO - 6} className="texto-grafica">Hoy</text>
      <text x={ANCHO - MARGEN.der} y={ALTO - 6} textAnchor="end" className="texto-grafica">Mes {meses}</text>
    </svg>
  )
}
