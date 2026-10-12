import { useState } from 'react'
import type { Expresion, Mensaje } from '../asistente/textos'

/**
 * La imagen de Tico para cada expresión, en public/tico. Para cambiarlas basta con reemplazar los archivos (o apuntar
 * aquí a otros); si alguna no carga, esa expresión vuelve a mostrarse como un círculo con el nombre.
 */
const IMAGENES: Record<Expresion, string> = {
  feliz: `${import.meta.env.BASE_URL}tico/feliz.svg`,
  explicando: `${import.meta.env.BASE_URL}tico/explicando.svg`,
  pensando: `${import.meta.env.BASE_URL}tico/pensando.svg`,
  celebrando: `${import.meta.env.BASE_URL}tico/celebrando.svg`,
  preocupado: `${import.meta.env.BASE_URL}tico/preocupado.svg`,
}

const NOMBRE_EXPRESION: Record<Expresion, string> = {
  feliz: 'feliz',
  explicando: 'explicando',
  pensando: 'pensando',
  celebrando: 'celebrando',
  preocupado: 'preocupado',
}

/** El personaje con la imagen de su expresión; `mini` lo muestra pequeño (para los accesos). */
export default function Tico({ expresion, mini = false }: { expresion: Expresion; mini?: boolean }) {
  const [falla, setFalla] = useState(false)
  const tamano = mini ? ' mini' : ''
  if (!falla) {
    return (
      <img
        className={`tico imagen${tamano}`}
        src={IMAGENES[expresion]}
        alt={`Tico, ${NOMBRE_EXPRESION[expresion]}`}
        onError={() => setFalla(true)}
      />
    )
  }
  return (
    <span className={`tico tico-${expresion}${tamano}`} role="img" aria-label={`Tico, ${NOMBRE_EXPRESION[expresion]}`}>
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
