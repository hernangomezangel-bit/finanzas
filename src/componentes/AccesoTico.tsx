import { useLiveQuery } from 'dexie-react-hooks'
import { hayBorradorEnCurso } from '../asistente/borrador'
import { db } from '../db'
import Tico from './Tico'

/** El acceso al asistente: «Crear mi presupuesto con Tico», «Seguir…» si dejó uno a medias, o «Rehacer…» si ya lo creó. */
export default function AccesoTico({ alAbrir }: { alAbrir: () => void }) {
  const aMedias = hayBorradorEnCurso()
  const creado = useLiveQuery(async () => (await db.ajustes.get('asistentePresupuesto')) !== undefined) ?? false
  const titulo = aMedias ? 'Seguir mi presupuesto con Tico' : creado ? 'Rehacer mi presupuesto con Tico' : 'Crear mi presupuesto con Tico'
  const detalle = aMedias ? 'Retoma donde te quedaste' : creado ? 'Vuelve a armarlo paso a paso' : 'Te guío paso a paso, en unos 5 minutos'
  return (
    <button className="acceso-tico" onClick={alAbrir}>
      <Tico expresion="feliz" mini />
      <span className="texto-acceso">
        <strong>{titulo}</strong>
        <small>{detalle}</small>
      </span>
    </button>
  )
}
