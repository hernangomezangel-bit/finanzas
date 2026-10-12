import { mensaje } from '../../asistente/mensajes'
import { ETIQUETAS } from '../../asistente/textos'

/**
 * Lista de opciones para marcar (varias a la vez). Si está marcado «Otro», pide escribir cuál. Lo marcado se guarda en
 * el borrador al instante, así que no se pierde al volver atrás.
 */
export default function ListaMarcar({
  opciones,
  elegidos,
  alAlternar,
  otro,
  alCambiarOtro,
  errorOtro = false,
}: {
  opciones: { id: string; etiqueta: string }[]
  elegidos: string[]
  alAlternar: (id: string) => void
  /** Lo escrito en «Otro»; si no viene, la lista no tiene «Otro» con texto. */
  otro?: string
  alCambiarOtro?: (texto: string) => void
  errorOtro?: boolean
}) {
  return (
    <>
      {opciones.map((o) => {
        const marcada = elegidos.includes(o.id)
        return (
          <button
            key={o.id}
            className={marcada ? 'opcion-tico marcable elegida' : 'opcion-tico marcable'}
            aria-pressed={marcada}
            onClick={() => alAlternar(o.id)}
          >
            <span className="marca" aria-hidden="true">{marcada ? '☑' : '☐'}</span>
            {o.etiqueta}
          </button>
        )
      })}
      {elegidos.includes('otro') && alCambiarOtro && (
        <>
          <label className="campo">
            {ETIQUETAS.otroGastoNombre}
            <input
              type="text"
              maxLength={40}
              placeholder={ETIQUETAS.otroGastoEjemplo}
              value={otro ?? ''}
              onChange={(e) => alCambiarOtro(e.target.value)}
            />
          </label>
          {errorOtro && <p className="aviso-tico" role="alert">{mensaje('VAL_01').texto}</p>}
        </>
      )}
    </>
  )
}
