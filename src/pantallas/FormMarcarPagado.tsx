import { useState } from 'react'
import { db, type Movimiento } from '../db'
import { fechaCorta, hoy } from '../fechas'
import CampoMonto from '../componentes/CampoMonto'
import Hoja from '../componentes/Hoja'

/** Para un gasto (o ingreso) que se anotó con fecha futura: registrarlo ya, con el monto y el día reales. */
export default function FormMarcarPagado({ movimiento, nombre, alCerrar }: { movimiento: Movimiento; nombre: string; alCerrar: () => void }) {
  const gasto = movimiento.tipo === 'gasto'
  const [monto, setMonto] = useState(movimiento.monto)
  const [fecha, setFecha] = useState(hoy())
  const [error, setError] = useState('')

  async function guardar() {
    if (monto <= 0) return setError('Escribe un monto mayor a cero.')
    if (!fecha) return setError('Elige una fecha.')
    if (fecha > hoy()) return setError(`Esa fecha todavía no llega. Si ${gasto ? 'ya lo pagaste' : 'ya lo recibiste'}, elige hoy o un día anterior.`)
    await db.movimientos.update(movimiento.id!, { monto, fecha })
    alCerrar()
  }

  return (
    <Hoja titulo={nombre} alCerrar={alCerrar}>
      <p className="ayuda">
        {gasto ? 'Gasto' : 'Ingreso'} pendiente del {fechaCorta(movimiento.fecha)}. Al registrarlo deja de estar{' '}
        {gasto ? 'por pagar' : 'por recibir'}.
      </p>
      <CampoMonto etiqueta={gasto ? '¿Cuánto pagaste?' : '¿Cuánto recibiste?'} valor={monto} alCambiar={setMonto} autoFocus />

      <label className="campo">
        {gasto ? 'Fecha del pago' : 'Fecha en que lo recibiste'}
        <input type="date" value={fecha} max={hoy()} onChange={(e) => setFecha(e.target.value)} />
      </label>

      {error && <p className="error" role="alert">{error}</p>}
      <button className="boton primario" onClick={guardar}>{gasto ? 'Registrar pago' : 'Registrar ingreso'}</button>
    </Hoja>
  )
}
