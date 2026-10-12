import { useState } from 'react'
import { CLAVE_FIN_02 } from '../asistente/borrador'
import { mensaje } from '../asistente/mensajes'
import { ETIQUETAS } from '../asistente/textos'
import { GloboTico } from './Tico'

function pendienteDeMostrar(): boolean {
  try {
    return localStorage.getItem(CLAVE_FIN_02) === 'pendiente'
  } catch {
    return false
  }
}

/** FIN_02: la primera vez que se abre Presupuesto después de crearlo con Tico, explica qué se ve ahí. */
export default function AvisoTico() {
  const [visible, setVisible] = useState(pendienteDeMostrar)
  if (!visible) return null
  return (
    <section className="tarjeta aviso-tico-presupuesto">
      <GloboTico mensaje={mensaje('FIN_02')} />
      <button
        className="boton secundario"
        onClick={() => {
          try {
            localStorage.setItem(CLAVE_FIN_02, 'visto')
          } catch {
            // Sin permiso para guardar: solo se oculta ahora.
          }
          setVisible(false)
        }}
      >
        {ETIQUETAS.entendido}
      </button>
    </section>
  )
}
