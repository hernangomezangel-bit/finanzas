import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type Categoria, type Tipo } from '../db'
import Hoja from '../componentes/Hoja'

type Edicion = { categoria?: Categoria; tipo: Tipo } | null

export default function Categorias() {
  const categorias = useLiveQuery(() => db.categorias.toArray())
  const [edicion, setEdicion] = useState<Edicion>(null)

  if (!categorias) return null

  return (
    <>
      {(['gasto', 'ingreso'] as const).map((tipo) => (
        <section key={tipo} className="tarjeta">
          <h2>{tipo === 'gasto' ? 'Categorías de gastos' : 'Categorías de ingresos'}</h2>
          <ul className="lista-cat">
            {categorias
              .filter((c) => c.tipo === tipo)
              .map((c) => (
                <li key={c.id} className={c.oculta ? 'oculta' : ''}>
                  <span aria-hidden="true">{c.icono}</span>
                  <span className="nombre">
                    {c.nombre}
                    {c.variable && <small className="ayuda">Ingreso variable</small>}
                  </span>
                  <button onClick={() => setEdicion({ categoria: c, tipo })}>Editar</button>
                  <button onClick={() => db.categorias.update(c.id!, { oculta: !c.oculta })}>
                    {c.oculta ? 'Mostrar' : 'Ocultar'}
                  </button>
                </li>
              ))}
          </ul>
          <button className="boton secundario" onClick={() => setEdicion({ tipo })}>
            + Nueva categoría
          </button>
        </section>
      ))}
      <p className="pequeno nota-pie">
        Ocultar una categoría la quita de la lista al registrar, pero conserva tus movimientos anteriores.
      </p>

      {edicion && <FormCategoria edicion={edicion} alCerrar={() => setEdicion(null)} />}
    </>
  )
}

function FormCategoria({ edicion, alCerrar }: { edicion: NonNullable<Edicion>; alCerrar: () => void }) {
  const { categoria, tipo } = edicion
  const [nombre, setNombre] = useState(categoria?.nombre ?? '')
  const [icono, setIcono] = useState(categoria?.icono ?? '🏷️')
  const [variable, setVariable] = useState(categoria?.variable ?? false)
  const [error, setError] = useState('')

  async function guardar() {
    const limpio = nombre.trim()
    if (!limpio) return setError('Escribe un nombre.')
    // undefined borra la marca al editar; en gastos nunca aplica.
    const datos = { nombre: limpio, icono: icono.trim() || '🏷️', variable: tipo === 'ingreso' && variable ? true : undefined }
    if (categoria) await db.categorias.update(categoria.id!, datos)
    else await db.categorias.add({ ...datos, tipo })
    alCerrar()
  }

  return (
    <Hoja titulo={categoria ? 'Editar categoría' : 'Nueva categoría'} alCerrar={alCerrar}>
      <label className="campo">
        Nombre
        <input type="text" maxLength={24} autoFocus value={nombre} onChange={(e) => setNombre(e.target.value)} />
      </label>
      <label className="campo">
        Ícono (un emoji)
        <input type="text" maxLength={4} value={icono} onChange={(e) => setIcono(e.target.value)} />
      </label>
      {tipo === 'ingreso' && (
        <label className="casilla">
          <input type="checkbox" checked={variable} onChange={(e) => setVariable(e.target.checked)} />
          <span>
            Ingreso variable
            <small>Marca esto si no llega fijo cada mes: comisiones, trabajos por fuera. Verás su promedio en Presupuesto.</small>
          </span>
        </label>
      )}
      {error && <p className="error" role="alert">{error}</p>}
      <button className="boton primario" onClick={guardar}>Guardar</button>
    </Hoja>
  )
}
