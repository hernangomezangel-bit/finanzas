import { useState } from 'react'
import {
  ABREVIATURAS_DIA,
  repeticionPorDefecto,
  type Repeticion,
  type TipoRepeticion,
} from '../repeticion'

const OPCIONES: { tipo: TipoRepeticion; nombre: string }[] = [
  { tipo: 'unica', nombre: 'Solo este día' },
  { tipo: 'diaria', nombre: 'Todos los días' },
  { tipo: 'semanal', nombre: 'Cada semana' },
  { tipo: 'quincenal', nombre: 'Cada quincena' },
  { tipo: 'mensual', nombre: 'Cada mes' },
]

/** Lunes primero, que es como se piensa la semana. */
const ORDEN_SEMANA = [1, 2, 3, 4, 5, 6, 0]

/**
 * Para elegir cada cuánto se repite algo: opciones rápidas (todos los días, cada semana, cada quincena, cada mes) y,
 * según la que se elija, los días: de la semana (uno o varios), de cada quincena, o el día del mes.
 */
export default function SelectorRepeticion({
  repeticion,
  fechaReferencia,
  alCambiar,
  permiteUnica = true,
}: {
  repeticion: Repeticion
  /** El día de inicio: de ahí salen los días que se proponen al elegir una opción. */
  fechaReferencia: string
  alCambiar: (repeticion: Repeticion) => void
  /** Si se ofrece «Solo este día» (al registrar un movimiento sí; en un recurrente ya guardado no). */
  permiteUnica?: boolean
}) {
  return (
    <div className="selector-repeticion">
      <div className="chips" role="group" aria-label="Cada cuánto se repite">
        {OPCIONES.filter((o) => permiteUnica || o.tipo !== 'unica').map((o) => (
          <button
            key={o.tipo}
            className={repeticion.tipo === o.tipo ? 'chip activo' : 'chip'}
            aria-pressed={repeticion.tipo === o.tipo}
            onClick={() => alCambiar(repeticionPorDefecto(o.tipo, fechaReferencia))}
          >
            {o.nombre}
          </button>
        ))}
      </div>

      {repeticion.tipo === 'diaria' && <p className="ayuda">Se repite cada día, empezando en la fecha elegida.</p>}

      {repeticion.tipo === 'semanal' && (
        <div className="campo">
          ¿Qué días de la semana?
          <div className="chips">
            {ORDEN_SEMANA.map((dia) => {
              const activo = repeticion.dias.includes(dia)
              return (
                <button
                  key={dia}
                  className={activo ? 'chip activo' : 'chip'}
                  aria-pressed={activo}
                  onClick={() =>
                    // Se puede quitar cualquier día; si no queda ninguno, avisa al guardar.
                    alCambiar({ ...repeticion, dias: activo ? repeticion.dias.filter((d) => d !== dia) : [...repeticion.dias, dia] })
                  }
                >
                  {ABREVIATURAS_DIA[dia]}
                </button>
              )
            })}
          </div>
          <small className="ayuda">Puedes elegir varios. Toca un día otra vez para quitarlo.</small>
        </div>
      )}

      {repeticion.tipo === 'quincenal' && (
        <DiasDelMes key={`q|${fechaReferencia}`} repeticion={repeticion} alCambiar={alCambiar} />
      )}

      {repeticion.tipo === 'mensual' && (
        <DiasDelMes key={`m|${fechaReferencia}`} repeticion={repeticion} alCambiar={alCambiar} />
      )}
    </div>
  )
}

/** Los días del mes de una quincena (uno por mitad del mes) o de una repetición mensual (uno solo). */
function DiasDelMes({ repeticion, alCambiar }: { repeticion: Repeticion; alCambiar: (r: Repeticion) => void }) {
  const quincenal = repeticion.tipo === 'quincenal'
  const [textos, setTextos] = useState(repeticion.dias.map(String))

  function cambiar(posicion: number, texto: string) {
    const limpio = texto.replace(/\D/g, '').slice(0, 2)
    const nuevos = textos.map((t, i) => (i === posicion ? limpio : t))
    setTextos(nuevos)
    alCambiar({ ...repeticion, dias: nuevos.map((t) => Number(t) || 0) })
  }

  return (
    <div className="campo">
      {quincenal ? '¿Qué día de cada quincena?' : '¿Qué día del mes?'}
      <div className="dos-dias">
        {textos.map((texto, i) => (
          <label key={i} className="dia-del-mes">
            <small>{quincenal ? (i === 0 ? '1.ª quincena (1 a 15)' : '2.ª quincena (16 a 31)') : 'Día (1 a 31)'}</small>
            <input
              inputMode="numeric"
              maxLength={2}
              value={texto}
              aria-label={quincenal ? (i === 0 ? 'Día de la primera quincena' : 'Día de la segunda quincena') : 'Día del mes'}
              onChange={(e) => cambiar(i, e.target.value)}
            />
          </label>
        ))}
      </div>
      <small className="ayuda">Si el mes no tiene ese día (31 en abril), se usa el último día del mes.</small>
    </div>
  )
}
