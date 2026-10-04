import { useState } from 'react'
import type { Aporte, Meta } from '../db'
import { eliminarAporte, guardarAporte } from '../ahorros'
import { hoy } from '../fechas'
import CampoMonto from '../componentes/CampoMonto'
import Hoja from '../componentes/Hoja'

export default function FormAporte({
  meta,
  aporte,
  alCerrar,
}: {
  meta: Meta
  /** Si viene, se edita ese aporte; si no, se crea uno nuevo. */
  aporte?: Aporte
  alCerrar: () => void
}) {
  const editando = aporte !== undefined
  const [monto, setMonto] = useState(aporte?.monto ?? 0)
  const [fecha, setFecha] = useState(aporte?.fecha ?? hoy())
  const [nota, setNota] = useState(aporte?.nota ?? '')
  // En un aporte nuevo viene marcado; al editar, refleja si ya tenía su gasto en el Presupuesto.
  const [comoGasto, setComoGasto] = useState(editando ? aporte.movimientoId !== undefined : true)
  const [error, setError] = useState('')

  async function guardar() {
    if (monto <= 0) return setError('Escribe un monto mayor a cero.')
    if (!fecha) return setError('Elige una fecha.')
    await guardarAporte({ metaId: meta.id!, monto, fecha, nota: nota.trim(), comoGasto }, aporte)
    alCerrar()
  }

  async function eliminar() {
    const aviso = aporte!.movimientoId !== undefined
      ? '¿Eliminar este aporte? También se quitará su gasto del Presupuesto.'
      : '¿Eliminar este aporte?'
    if (!window.confirm(aviso)) return
    await eliminarAporte(aporte!)
    alCerrar()
  }

  return (
    <Hoja titulo={editando ? 'Editar aporte' : `Aportar a ${meta.nombre}`} alCerrar={alCerrar}>
      <CampoMonto valor={monto} alCambiar={setMonto} autoFocus />

      <label className="campo">
        Fecha
        <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
      </label>

      <label className="campo">
        Nota (opcional)
        <input type="text" maxLength={80} value={nota} onChange={(e) => setNota(e.target.value)} />
      </label>

      <label className="casilla">
        <input type="checkbox" checked={comoGasto} onChange={(e) => setComoGasto(e.target.checked)} />
        <span>
          Contar como gasto del mes en Presupuesto
          <small>Desmárcalo si este dinero ya lo tenías guardado aparte.</small>
        </span>
      </label>

      {error && <p className="error" role="alert">{error}</p>}
      <button className="boton primario" onClick={guardar}>Guardar</button>
      {editando && <button className="boton peligro" onClick={eliminar}>Eliminar aporte</button>}
    </Hoja>
  )
}
