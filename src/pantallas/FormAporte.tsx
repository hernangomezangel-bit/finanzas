import { useState } from 'react'
import type { Aporte, Meta } from '../db'
import { eliminarAporte, guardarAporte } from '../ahorros'
import { fechaCorta, hoy } from '../fechas'
import CampoMonto from '../componentes/CampoMonto'
import Hoja from '../componentes/Hoja'

export default function FormAporte({
  meta,
  aporte,
  montoInicial,
  fechaInicial,
  fechaCuota,
  alOmitir,
  alCerrar,
}: {
  meta: Meta
  /** Si viene, se edita ese aporte; si no, se crea uno nuevo. */
  aporte?: Aporte
  /** Monto con el que abre un aporte nuevo (p. ej. la cuota del ahorro programado). */
  montoInicial?: number
  /** Fecha con la que abre un aporte nuevo; por defecto, hoy. */
  fechaInicial?: string
  /** Cuota del ahorro programado que cubre este aporte. */
  fechaCuota?: string
  /** Si viene, se ofrece "Omitir esta vez" para dejar pasar la cuota sin registrarla. */
  alOmitir?: () => Promise<void>
  alCerrar: () => void
}) {
  const editando = aporte !== undefined
  const [monto, setMonto] = useState(aporte?.monto ?? montoInicial ?? 0)
  const [fecha, setFecha] = useState(aporte?.fecha ?? fechaInicial ?? hoy())
  const [nota, setNota] = useState(aporte?.nota ?? '')
  // En un aporte nuevo viene marcado; al editar, refleja si ya tenía su gasto en el Presupuesto.
  const [comoGasto, setComoGasto] = useState(editando ? aporte.movimientoId !== undefined : true)
  const [error, setError] = useState('')

  async function guardar() {
    if (monto <= 0) return setError('Escribe un monto mayor a cero.')
    if (!fecha) return setError('Elige una fecha.')
    await guardarAporte({ metaId: meta.id!, monto, fecha, nota: nota.trim(), comoGasto, fechaCuota }, aporte)
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
      {fechaCuota && !editando && <p className="ayuda">Cuota del {fechaCorta(fechaCuota)}.</p>}
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
      {editando && <button className="boton peligro" onClick={eliminar}>Eliminar aporte</button>}
    </Hoja>
  )
}
