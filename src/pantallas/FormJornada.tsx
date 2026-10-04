import { useState } from 'react'
import { nombreDia } from '../fechas'
import { pesos } from '../formato'
import { registrarJornada, type DiaConFuente } from '../fuentes'
import CampoMonto from '../componentes/CampoMonto'
import Hoja from '../componentes/Hoja'

export default function FormJornada({
  dia,
  alCerrar,
  alRegistrar,
}: {
  dia: DiaConFuente
  alCerrar: () => void
  /** Avisa qué jornada se creó, para poder deshacerla. */
  alRegistrar: (jornadaId: number, monto: number) => void
}) {
  const { fuente, fecha } = dia
  const [monto, setMonto] = useState(0)
  const [error, setError] = useState('')

  const diferencia = monto - fuente.metaDiaria

  async function guardar() {
    if (monto <= 0) return setError('Escribe lo que ganaste. Si no trabajaste, usa "No trabajé".')
    const jornadaId = await registrarJornada(fuente, fecha, monto)
    alRegistrar(jornadaId, monto)
    alCerrar()
  }

  return (
    <Hoja titulo={`${fuente.nombre} · ${nombreDia(fecha)}`} alCerrar={alCerrar}>
      <CampoMonto etiqueta="¿Cuánto ganaste?" valor={monto} alCambiar={setMonto} autoFocus />

      {monto > 0 && (
        <p className="desglose">
          {diferencia === 0 && <>Justo tu meta de {pesos(fuente.metaDiaria)}.</>}
          {diferencia > 0 && <>¡Superaste tu meta de {pesos(fuente.metaDiaria)} por <strong>{pesos(diferencia)}</strong>!</>}
          {diferencia < 0 && <>Quedaste <strong>{pesos(-diferencia)}</strong> por debajo de tu meta de {pesos(fuente.metaDiaria)}.</>}
        </p>
      )}

      {error && <p className="error" role="alert">{error}</p>}
      <button className="boton primario" onClick={guardar}>Guardar</button>
    </Hoja>
  )
}
