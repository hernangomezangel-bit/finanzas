import { useState } from 'react'
import { fechaCorta } from '../fechas'
import { pesos } from '../formato'
import { montoDelVencimiento } from '../recurrencia'
import { omitirVencimiento, registrarVencimiento, type PendienteConDatos } from '../recurrentes'
import CampoMonto from '../componentes/CampoMonto'
import Hoja from '../componentes/Hoja'

export default function FormOcurrencia({ pendiente, alCerrar }: { pendiente: PendienteConDatos; alCerrar: () => void }) {
  const { recurrente, fecha } = pendiente
  const porDia = recurrente.diasLibres !== undefined
  const habitual = montoDelVencimiento(recurrente, fecha)
  const [monto, setMonto] = useState(pendiente.monto)
  const [recordar, setRecordar] = useState(false)
  const [error, setError] = useState('')

  async function registrar() {
    if (monto <= 0) return setError('Escribe un monto mayor a cero.')
    await registrarVencimiento(recurrente, fecha, monto, recordar && monto !== recurrente.monto)
    alCerrar()
  }

  async function omitir() {
    await omitirVencimiento(recurrente, fecha)
    alCerrar()
  }

  return (
    <Hoja titulo={recurrente.nombre} alCerrar={alCerrar}>
      <p className="ayuda">
        {recurrente.tipo === 'gasto' ? 'Gasto' : 'Ingreso'} del {fechaCorta(fecha)}. Lo habitual es {pesos(habitual)}
        {porDia && ` (${pesos(recurrente.monto)} por cada día trabajado del mes)`}.
      </p>
      <CampoMonto etiqueta="Monto de esta vez" valor={monto} alCambiar={setMonto} autoFocus />

      {!porDia && monto !== recurrente.monto && monto > 0 && (
        <label className="casilla">
          <input type="checkbox" checked={recordar} onChange={(e) => setRecordar(e.target.checked)} />
          <span>
            Usar este monto desde ahora
            <small>La próxima vez te propondré {pesos(monto)}.</small>
          </span>
        </label>
      )}

      {error && <p className="error" role="alert">{error}</p>}
      <button className="boton primario" onClick={registrar}>Registrar</button>
      <button className="boton secundario" onClick={omitir}>Omitir esta vez</button>
    </Hoja>
  )
}
