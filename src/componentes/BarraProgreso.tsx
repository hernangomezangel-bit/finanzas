import { pesos } from '../formato'

export default function BarraProgreso({
  ahorrado,
  objetivo,
  etiqueta = 'de la meta',
}: {
  ahorrado: number
  objetivo: number
  etiqueta?: string
}) {
  const pct = Math.max(0, Math.min(100, Math.floor((ahorrado / objetivo) * 100)))
  return (
    <div>
      <div
        className="barra-progreso"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        aria-label={`${pct}% ${etiqueta}`}
      >
        <div style={{ width: `${pct}%` }} />
      </div>
      <div className="progreso-texto">
        <span>{pesos(ahorrado)} de {pesos(objetivo)}</span>
        <strong>{pct}%</strong>
      </div>
    </div>
  )
}
