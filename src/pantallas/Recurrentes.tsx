import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type Recurrente } from '../db'
import { pesos } from '../formato'
import { textoDias } from '../recurrentes'
import FormRecurrente from './FormRecurrente'

type Edicion = { recurrente?: Recurrente } | null

export default function Recurrentes() {
  const recurrentes = useLiveQuery(() => db.recurrentes.toArray())
  const categorias = useLiveQuery(() => db.categorias.toArray())
  const [edicion, setEdicion] = useState<Edicion>(null)

  if (!recurrentes || !categorias) return null

  return (
    <section className="tarjeta">
      <h2>Movimientos recurrentes</h2>
      <p className="explicacion">
        Salario, arriendo, servicios… Regístralos una vez y la app te los propone cuando llegue el día, para que los
        confirmes con un toque. Solo aparecen cuando abres la app.
      </p>

      {recurrentes.length > 0 && (
        <ul className="lista-cat">
          {recurrentes.map((r) => {
            const categoria = categorias.find((c) => c.id === r.categoriaId)
            return (
              <li key={r.id} className={r.activo ? '' : 'oculta'}>
                <span aria-hidden="true">{categoria?.icono ?? '🧾'}</span>
                <span className="nombre">
                  {r.nombre}
                  <small className="ayuda">
                    {textoDias(r)}{r.activo ? '' : ' · en pausa'}
                  </small>
                </span>
                <strong className={r.tipo}>{pesos(r.monto)}</strong>
                <button onClick={() => setEdicion({ recurrente: r })}>Editar</button>
              </li>
            )
          })}
        </ul>
      )}

      <button className="boton secundario" onClick={() => setEdicion({})}>+ Nuevo recurrente</button>

      {edicion && <FormRecurrente recurrente={edicion.recurrente} alCerrar={() => setEdicion(null)} />}
    </section>
  )
}
