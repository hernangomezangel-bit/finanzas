import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type Movimiento, type Tipo } from '../db'
import { hoy } from '../fechas'
import CampoMonto from '../componentes/CampoMonto'
import Hoja from '../componentes/Hoja'

interface Props {
  /** Si viene, se edita ese movimiento; si no, se crea uno nuevo. */
  movimiento?: Movimiento
  mesActual: string
  alCerrar: () => void
}

export default function FormMovimiento({ movimiento, mesActual, alCerrar }: Props) {
  const editando = movimiento !== undefined
  const [tipo, setTipo] = useState<Tipo>(movimiento?.tipo ?? 'gasto')
  const [monto, setMonto] = useState(movimiento?.monto ?? 0)
  const [categoriaId, setCategoriaId] = useState<number | null>(movimiento?.categoriaId ?? null)
  const [fecha, setFecha] = useState(movimiento?.fecha ?? fechaInicial(mesActual))
  const [nota, setNota] = useState(movimiento?.nota ?? '')
  const [error, setError] = useState('')

  const categorias = useLiveQuery(() => db.categorias.where('tipo').equals(tipo).toArray(), [tipo])
  // Las categorías ocultas no se ofrecen, salvo la que ya usa este movimiento.
  const visibles = (categorias ?? []).filter((c) => !c.oculta || c.id === movimiento?.categoriaId)

  function cambiarTipo(nuevo: Tipo) {
    if (nuevo === tipo) return
    setTipo(nuevo)
    setCategoriaId(null)
  }

  async function guardar() {
    if (monto <= 0) return setError('Escribe un monto mayor a cero.')
    if (categoriaId === null) return setError('Elige una categoría.')
    if (!fecha) return setError('Elige una fecha.')
    const datos = { tipo, monto, categoriaId, fecha, nota: nota.trim() }
    if (editando) await db.movimientos.update(movimiento.id!, datos)
    else await db.movimientos.add(datos)
    alCerrar()
  }

  async function eliminar() {
    if (!window.confirm('¿Eliminar este movimiento?')) return
    await db.movimientos.delete(movimiento!.id!)
    alCerrar()
  }

  return (
    <Hoja titulo={editando ? 'Editar movimiento' : 'Nuevo movimiento'} alCerrar={alCerrar}>
      <div className="selector" role="group" aria-label="Tipo de movimiento">
        <button className={tipo === 'gasto' ? 'sel gasto' : ''} onClick={() => cambiarTipo('gasto')}>
          Gasto
        </button>
        <button className={tipo === 'ingreso' ? 'sel ingreso' : ''} onClick={() => cambiarTipo('ingreso')}>
          Ingreso
        </button>
      </div>

      <CampoMonto valor={monto} alCambiar={setMonto} autoFocus />

      <div className="campo">
        Categoría
        <div className="chips">
          {visibles.map((c) => (
            <button
              key={c.id}
              className={c.id === categoriaId ? 'chip activo' : 'chip'}
              onClick={() => setCategoriaId(c.id!)}
            >
              <span aria-hidden="true">{c.icono}</span> {c.nombre}
            </button>
          ))}
        </div>
      </div>

      <label className="campo">
        Fecha
        <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
      </label>

      <label className="campo">
        Nota (opcional)
        <input type="text" maxLength={80} value={nota} onChange={(e) => setNota(e.target.value)} />
      </label>

      {error && <p className="error" role="alert">{error}</p>}

      <button className="boton primario" onClick={guardar}>Guardar</button>
      {editando && <button className="boton peligro" onClick={eliminar}>Eliminar</button>}
    </Hoja>
  )
}

/** Hoy si se mira el mes actual; si no, el primer día del mes que se está viendo. */
function fechaInicial(mes: string): string {
  const h = hoy()
  return h.startsWith(mes) ? h : `${mes}-01`
}
