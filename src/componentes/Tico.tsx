import type { Expresion, Mensaje } from '../asistente/textos'

/**
 * La imagen de Tico para cada expresión. Cuando existan (por ejemplo `tico/feliz.png` dentro de public), se anotan
 * aquí y se usan en lugar del círculo; las animaciones se agregarán después sin cambiar el flujo.
 */
const IMAGENES: Partial<Record<Expresion, string>> = {}

const NOMBRE_EXPRESION: Record<Expresion, string> = {
  feliz: 'feliz',
  explicando: 'explicando',
  pensando: 'pensando',
  celebrando: 'celebrando',
  preocupado: 'preocupado',
}

/** El personaje: mientras no haya imágenes, un círculo con su nombre. */
export default function Tico({ expresion }: { expresion: Expresion }) {
  const imagen = IMAGENES[expresion]
  if (imagen) return <img className="tico" src={imagen} alt={`Tico, ${NOMBRE_EXPRESION[expresion]}`} />
  return (
    <span className={`tico tico-${expresion}`} role="img" aria-label={`Tico, ${NOMBRE_EXPRESION[expresion]}`}>
      Tico
    </span>
  )
}

/** Tico con su globo de texto, arriba de cada pregunta. */
export function GloboTico({ mensaje }: { mensaje: Mensaje }) {
  return (
    <div className="escena-tico">
      <Tico expresion={mensaje.expresion} />
      <p className="globo" role="status">{mensaje.texto}</p>
    </div>
  )
}
