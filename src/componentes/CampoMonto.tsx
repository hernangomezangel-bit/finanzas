const formatoMiles = new Intl.NumberFormat('es-CO')

/** Campo de pesos: solo acepta dígitos y los muestra con puntos de miles. */
export default function CampoMonto({
  etiqueta = 'Monto',
  valor,
  alCambiar,
  autoFocus = false,
}: {
  etiqueta?: string
  valor: number
  alCambiar: (valor: number) => void
  autoFocus?: boolean
}) {
  return (
    <label className="campo">
      {etiqueta}
      <div className="monto-caja">
        <span>$</span>
        <input
          inputMode="numeric"
          autoFocus={autoFocus}
          placeholder="0"
          value={valor ? formatoMiles.format(valor) : ''}
          onChange={(e) => alCambiar(Number(e.target.value.replace(/\D/g, '').slice(0, 12)))}
        />
      </div>
    </label>
  )
}
