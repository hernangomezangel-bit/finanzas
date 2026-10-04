import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type Fuente } from '../db'
import { pesos } from '../formato'
import { textoDiasLibres } from '../fuentes'
import FormFuente from './FormFuente'

type Edicion = { fuente?: Fuente } | null

export default function IngresosPorDia() {
  const fuentes = useLiveQuery(() => db.fuentes.toArray())
  const [edicion, setEdicion] = useState<Edicion>(null)

  if (!fuentes) return null

  return (
    <section className="tarjeta">
      <h2>Meta diaria de ingresos</h2>
      <p className="explicacion">
        Para trabajos donde ganas distinto cada día, como Didi. Fijas una meta diaria y cada día te pregunto cómo te
        fue: cumpliste la meta, ganaste otro monto o no trabajaste. Nada se registra sin que lo confirmes.
      </p>

      {fuentes.length > 0 && (
        <ul className="lista-cat">
          {fuentes.map((f) => (
            <li key={f.id} className={f.activo ? '' : 'oculta'}>
              <span className="nombre">
                {f.nombre}
                <small className="ayuda">
                  Meta {pesos(f.metaDiaria)} por día · {textoDiasLibres(f.diasLibres)}
                  {f.activo ? '' : ' · en pausa'}
                </small>
              </span>
              <button onClick={() => setEdicion({ fuente: f })}>Editar</button>
            </li>
          ))}
        </ul>
      )}

      <button className="boton secundario" onClick={() => setEdicion({})}>+ Nueva meta diaria</button>

      {edicion && <FormFuente fuente={edicion.fuente} alCerrar={() => setEdicion(null)} />}
    </section>
  )
}
