import { hayBorradorEnCurso } from '../asistente/borrador'

/** El acceso al asistente: «Crear mi presupuesto con Tico», o «Seguir…» si ya dejó uno a medias. */
export default function AccesoTico({ alAbrir }: { alAbrir: () => void }) {
  const aMedias = hayBorradorEnCurso()
  return (
    <button className="acceso-tico" onClick={alAbrir}>
      <span className="tico tico-feliz mini" aria-hidden="true">Tico</span>
      <span className="texto-acceso">
        <strong>{aMedias ? 'Seguir mi presupuesto con Tico' : 'Crear mi presupuesto con Tico'}</strong>
        <small>{aMedias ? 'Retoma donde te quedaste' : 'Te guío paso a paso, en unos 5 minutos'}</small>
      </span>
    </button>
  )
}
