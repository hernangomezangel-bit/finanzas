import { useState } from 'react'
import type { Deuda } from '../db'
import { interesDelMes, registrarPago } from '../deudas'
import { fechaCorta, hoy } from '../fechas'
import { pesos } from '../formato'
import CampoMonto from '../componentes/CampoMonto'
import Hoja from '../componentes/Hoja'

export default function FormPago({
  deuda,
  saldo,
  montoSugerido,
  fechaCuota,
  fechaInicial,
  alOmitir,
  alCerrar,
}: {
  deuda: Deuda
  saldo: number
  montoSugerido?: number
  /** Cuota del plan que se está marcando como pagada, si viene de ahí. */
  fechaCuota?: string
  /** Fecha del pago al abrir el formulario; por defecto, hoy. */
  fechaInicial?: string
  /** Si viene, se ofrece "Omitir esta vez" para dejar pasar la cuota sin registrarla. */
  alOmitir?: () => Promise<void>
  alCerrar: () => void
}) {
  const [monto, setMonto] = useState(montoSugerido ?? deuda.pagoMinimo)
  const [fecha, setFecha] = useState(fechaInicial ?? hoy())
  const [comoGasto, setComoGasto] = useState(true)
  const [error, setError] = useState('')

  const interes = interesDelMes(deuda, saldo)
  const tope = saldo + interes
  const montoReal = Math.min(monto, tope)
  const capital = montoReal - interes

  async function guardar() {
    if (monto <= 0) return setError('Escribe un monto mayor a cero.')
    if (!fecha) return setError('Elige una fecha.')
    await registrarPago(deuda, { monto, fecha, fechaCuota, comoGasto })
    alCerrar()
  }

  return (
    <Hoja titulo={`${deuda.sinCuota ? 'Abono a' : 'Pago a'} ${deuda.nombre}`} alCerrar={alCerrar}>
      {fechaCuota && <p className="ayuda">Cuota del {fechaCorta(fechaCuota)}.</p>}
      <CampoMonto etiqueta={deuda.sinCuota ? '¿Cuánto abonas?' : '¿Cuánto pagaste?'} valor={monto} alCambiar={setMonto} autoFocus />

      {monto > 0 && (
        <p className="desglose">
          {monto > tope ? (
            <>Con eso saldas la deuda: se registrarán <strong>{pesos(tope)}</strong>.</>
          ) : deuda.sinCuota ? (
            <>Sin interés: tu deuda baja a <strong>{pesos(saldo - montoReal)}</strong>.</>
          ) : (
            <>
              Interés estimado del mes: <strong>{pesos(interes)}</strong>.{' '}
              {capital >= 0
                ? <>Bajas tu deuda en <strong>{pesos(capital)}</strong>.</>
                : <>No alcanza a cubrir el interés: tu deuda sube <strong>{pesos(-capital)}</strong>.</>}
            </>
          )}
        </p>
      )}

      <label className="campo">
        Fecha del pago
        <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
      </label>

      <label className="casilla">
        <input type="checkbox" checked={comoGasto} onChange={(e) => setComoGasto(e.target.checked)} />
        <span>
          Contar como gasto del mes en Presupuesto
          <small>Desmárcalo si ese gasto ya lo registraste por otro lado.</small>
        </span>
      </label>

      {error && <p className="error" role="alert">{error}</p>}
      <button className="boton primario" onClick={guardar}>{deuda.sinCuota ? 'Guardar abono' : 'Guardar pago'}</button>
      {alOmitir && (
        <button
          className="boton secundario"
          onClick={async () => {
            await alOmitir()
            alCerrar()
          }}
        >
          Omitir esta vez
        </button>
      )}
    </Hoja>
  )
}
