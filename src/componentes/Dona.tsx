import { pesos } from '../formato'

export interface Tajada {
  nombre: string
  valor: number
  color: string
}

const R = 54
const C = 2 * Math.PI * R

export default function Dona({ tajadas, centro }: { tajadas: Tajada[]; centro: string }) {
  const total = tajadas.reduce((s, t) => s + t.valor, 0)
  // Cuánto avanza cada tajada sobre la circunferencia: el inicio de una es el fin de la anterior.
  const largos = tajadas.map((t) => (C * t.valor) / total)
  const inicios = largos.map((_, i) => largos.slice(0, i).reduce((s, l) => s + l, 0))

  return (
    <svg
      viewBox="0 0 140 140"
      className="dona"
      role="img"
      aria-label={`Gastos por categoría. Total ${pesos(total)}`}
    >
      <circle cx="70" cy="70" r={R} fill="none" stroke="var(--borde)" strokeWidth="22" />
      {tajadas.map((t, i) => (
        <circle
          key={t.nombre}
          cx="70"
          cy="70"
          r={R}
          fill="none"
          stroke={t.color}
          strokeWidth="22"
          strokeDasharray={`${largos[i]} ${C - largos[i]}`}
          strokeDashoffset={-inicios[i]}
          transform="rotate(-90 70 70)"
        />
      ))}
      <text x="70" y="66" textAnchor="middle" className="dona-etiqueta">Gastos</text>
      <text x="70" y="84" textAnchor="middle" className="dona-total">{centro}</text>
    </svg>
  )
}
