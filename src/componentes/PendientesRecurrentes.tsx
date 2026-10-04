import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import { hoy, fechaCorta } from '../fechas'
import { pesos } from '../formato'
import { leerPendientes, registrarVencimiento, type PendienteConDatos } from '../recurrentes'
import FormOcurrencia from '../pantallas/FormOcurrencia'

/** Lo que ya tocaba registrar según tus movimientos recurrentes: un toque para confirmar. */
export default function PendientesRecurrentes() {
  const lista = useLiveQuery(leerPendientes)
  const categorias = useLiveQuery(() => db.categorias.toArray())
  const [abierto, setAbierto] = useState<PendienteConDatos | null>(null)

  if (!lista || !categorias || lista.length === 0) return null

  const hoyTexto = hoy()
  return (
    <section className="tarjeta pendientes">
      <h2>Por registrar ({lista.length})</h2>
      <ul className="lista-pendientes">
        {lista.map((p) => {
          const r = p.recurrente
          const icono = categorias.find((c) => c.id === r.categoriaId)?.icono ?? '🧾'
          return (
            <li key={`${p.recurrenteId}|${p.fecha}`}>
              <button className="fila-toca" onClick={() => setAbierto(p)}>
                <span className="icono-cat" aria-hidden="true">{icono}</span>
                <span className="texto-mov">
                  <span>{r.nombre}</span>
                  <small>{p.fecha === hoyTexto ? 'Hoy' : `Tocaba el ${fechaCorta(p.fecha)}`}</small>
                </span>
                <strong className={`monto-fila ${r.tipo}`}>{r.tipo === 'gasto' ? '−' : '+'}{pesos(r.monto)}</strong>
              </button>
              <button className="boton-chico ancho" onClick={() => void registrarVencimiento(r, p.fecha, r.monto)}>
                Registrar {r.tipo === 'gasto' ? 'gasto' : 'ingreso'}
              </button>
            </li>
          )
        })}
      </ul>
      <p className="ayuda">Toca el nombre para cambiar el monto u omitirlo.</p>

      {abierto && <FormOcurrencia pendiente={abierto} alCerrar={() => setAbierto(null)} />}
    </section>
  )
}
