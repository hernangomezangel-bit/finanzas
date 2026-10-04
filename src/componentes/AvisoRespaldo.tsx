import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import { debeAvisar, diasDesde, posponerAviso, ultimoRespaldo } from '../respaldo'

/** Recordatorio suave: solo aparece si ya hay movimientos y hace tiempo que no se guarda una copia. */
export default function AvisoRespaldo({ alIr }: { alIr: () => void }) {
  const cantidad = useLiveQuery(() => db.movimientos.count())
  const [oculto, setOculto] = useState(false)

  if (!cantidad || oculto || !debeAvisar()) return null

  const ultimo = ultimoRespaldo()
  const texto = ultimo
    ? `Hace ${diasDesde(ultimo)} días que no guardas una copia de seguridad.`
    : 'Aún no has guardado una copia de seguridad de tus datos.'

  return (
    <div className="aviso-copia" role="status">
      <p>🛟 {texto}</p>
      <div>
        <button onClick={alIr}>Hacer copia</button>
        <button
          className="tenue"
          onClick={() => {
            posponerAviso()
            setOculto(true)
          }}
        >
          Después
        </button>
      </div>
    </div>
  )
}
