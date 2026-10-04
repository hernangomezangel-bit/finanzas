import { pesos } from '../formato'

export default function BarraProgreso({ ahorrado, objetivo }: { ahorrado: number; objetivo: number }) {
  const pct = Math.min(100, Math.floor((ahorrado / objetivo) * 100))
  return (
    <div>
      <div
        className="barra-progreso"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        aria-label={`${pct}% de la meta`}
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
