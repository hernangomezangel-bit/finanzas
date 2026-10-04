import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { hoy, nombreDia } from '../fechas'
import { pesos } from '../formato'
import {
  deshacerJornada,
  leerDiasPendientes,
  registrarDescanso,
  registrarJornada,
  type DiaConFuente,
} from '../fuentes'
import FormJornada from '../pantallas/FormJornada'

interface Deshacer {
  jornadaId: number
  texto: string
}

/** Pregunta cómo le fue hoy (y los días recientes que faltan) a cada trabajo con meta diaria. */
export default function PendientesJornadas() {
  const dias = useLiveQuery(leerDiasPendientes)
  const [otroMonto, setOtroMonto] = useState<DiaConFuente | null>(null)
  const [deshacer, setDeshacer] = useState<Deshacer | null>(null)

  // El aviso de "Deshacer" dura unos segundos; la persona tiene tiempo de corregir un toque equivocado.
  useEffect(() => {
    if (!deshacer) return
    const temporizador = setTimeout(() => setDeshacer(null), 8000)
    return () => clearTimeout(temporizador)
  }, [deshacer])

  if (!dias) return null

  const hoyTexto = hoy()
  const deHoy = dias.filter((d) => d.fecha === hoyTexto)
  const anteriores = dias.filter((d) => d.fecha !== hoyTexto)
  const cuando = (fecha: string) => (fecha === hoyTexto ? 'hoy' : nombreDia(fecha).toLowerCase())

  async function cumpli(d: DiaConFuente) {
    const jornadaId = await registrarJornada(d.fuente, d.fecha, d.fuente.metaDiaria)
    setDeshacer({ jornadaId, texto: `${d.fuente.nombre}: ${pesos(d.fuente.metaDiaria)} registrados (${cuando(d.fecha)})` })
  }

  async function descanso(d: DiaConFuente) {
    const jornadaId = await registrarDescanso(d.fuente, d.fecha)
    setDeshacer({ jornadaId, texto: `${d.fuente.nombre}: ${cuando(d.fecha)} como día de descanso` })
  }

  const bloque = (d: DiaConFuente) => (
    <div key={`${d.fuente.id}|${d.fecha}`} className="jornada">
      <h3>
        {d.fuente.nombre} · {cuando(d.fecha)}
      </h3>
      <p className="ayuda">Tu meta: {pesos(d.fuente.metaDiaria)}</p>
      <button className="boton primario" onClick={() => void cumpli(d)}>
        Cumplí mi meta · {pesos(d.fuente.metaDiaria)}
      </button>
      <button className="boton secundario" onClick={() => setOtroMonto(d)}>Gané otro monto</button>
      <button className="boton suave" onClick={() => void descanso(d)}>No trabajé</button>
    </div>
  )

  return (
    <>
      {deHoy.length > 0 && <section className="tarjeta pendientes">{deHoy.map(bloque)}</section>}
      {anteriores.length > 0 && (
        <details className="tarjeta">
          <summary>Días anteriores sin registrar ({anteriores.length})</summary>
          {anteriores.map(bloque)}
        </details>
      )}

      {otroMonto && (
        <FormJornada
          dia={otroMonto}
          alCerrar={() => setOtroMonto(null)}
          alRegistrar={(jornadaId, monto) =>
            setDeshacer({
              jornadaId,
              texto: `${otroMonto.fuente.nombre}: ${pesos(monto)} registrados (${cuando(otroMonto.fecha)})`,
            })
          }
        />
      )}

      {deshacer && (
        <div className="aviso-deshacer" role="status">
          <span>{deshacer.texto}</span>
          <button
            onClick={async () => {
              await deshacerJornada(deshacer.jornadaId)
              setDeshacer(null)
            }}
          >
            Deshacer
          </button>
        </div>
      )}
    </>
  )
}
