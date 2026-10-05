import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type Recurrente, type Tipo } from '../db'
import { hoy } from '../fechas'
import { eliminarRecurrente } from '../recurrentes'
import { esRepeticionValida, patronDe, repeticionDe, repeticionPorDefecto, type Repeticion } from '../repeticion'
import CampoMonto from '../componentes/CampoMonto'
import Hoja from '../componentes/Hoja'
import SelectorRepeticion from '../componentes/SelectorRepeticion'

export default function FormRecurrente({ recurrente, alCerrar }: { recurrente?: Recurrente; alCerrar: () => void }) {
  const editando = recurrente !== undefined
  const [tipo, setTipo] = useState<Tipo>(recurrente?.tipo ?? 'gasto')
  const [nombre, setNombre] = useState(recurrente?.nombre ?? '')
  const [monto, setMonto] = useState(recurrente?.monto ?? 0)
  const [categoriaId, setCategoriaId] = useState<number | null>(recurrente?.categoriaId ?? null)
  const [repeticion, setRepeticion] = useState<Repeticion>(() =>
    recurrente ? repeticionDe(recurrente) : repeticionPorDefecto('mensual', hoy()),
  )
  const [error, setError] = useState('')

  const categorias = useLiveQuery(() => db.categorias.where('tipo').equals(tipo).toArray(), [tipo])
  const visibles = (categorias ?? []).filter((c) => !c.oculta || c.id === recurrente?.categoriaId)

  function cambiarTipo(nuevo: Tipo) {
    if (nuevo === tipo) return
    setTipo(nuevo)
    setCategoriaId(null)
  }

  async function guardar() {
    if (monto <= 0) return setError('Escribe un monto mayor a cero.')
    if (categoriaId === null) return setError('Elige una categoría.')
    const patron = patronDe(repeticion)
    if (!patron || !esRepeticionValida(repeticion)) {
      return setError(
        repeticion.tipo === 'semanal'
          ? 'Elige al menos un día de la semana.'
          : repeticion.tipo === 'quincenal'
            ? 'Escribe un día de la primera quincena (1 a 15) y uno de la segunda (16 a 31).'
            : 'Escribe un día del mes entre 1 y 31.',
      )
    }

    const categoria = visibles.find((c) => c.id === categoriaId)
    const datos = {
      nombre: (nombre.trim() || categoria?.nombre || 'Recurrente').slice(0, 40),
      tipo,
      monto,
      categoriaId,
      dias: patron.dias,
    }
    if (editando) {
      // undefined borra la frecuencia al volver a mensual (que es lo que significa no tenerla).
      await db.recurrentes.update(recurrente.id!, { ...datos, frecuencia: patron.frecuencia })
    } else {
      await db.recurrentes.add({
        ...datos,
        ...(patron.frecuencia ? { frecuencia: patron.frecuencia } : {}),
        nota: '',
        creado: hoy(),
        activo: true,
      })
    }
    alCerrar()
  }

  async function borrar() {
    if (!window.confirm(`¿Eliminar "${recurrente!.nombre}"? Los movimientos que ya registraste se conservan.`)) return
    await eliminarRecurrente(recurrente!.id!)
    alCerrar()
  }

  async function alternarPausa() {
    await db.recurrentes.update(recurrente!.id!, { activo: !recurrente!.activo })
    alCerrar()
  }

  return (
    <Hoja titulo={editando ? 'Editar recurrente' : 'Nuevo recurrente'} alCerrar={alCerrar}>
      <div className="selector" role="group" aria-label="Tipo de movimiento">
        <button className={tipo === 'gasto' ? 'sel gasto' : ''} onClick={() => cambiarTipo('gasto')}>Gasto</button>
        <button className={tipo === 'ingreso' ? 'sel ingreso' : ''} onClick={() => cambiarTipo('ingreso')}>Ingreso</button>
      </div>

      <label className="campo">
        Nombre (opcional)
        <input
          type="text"
          maxLength={40}
          placeholder={tipo === 'gasto' ? 'Ej: Arriendo' : 'Ej: Salario'}
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
        />
      </label>

      <CampoMonto etiqueta="Monto habitual" valor={monto} alCambiar={setMonto} autoFocus={!editando} />

      <div className="campo">
        Categoría
        <div className="chips">
          {visibles.map((c) => (
            <button key={c.id} className={c.id === categoriaId ? 'chip activo' : 'chip'} onClick={() => setCategoriaId(c.id!)}>
              <span aria-hidden="true">{c.icono}</span> {c.nombre}
            </button>
          ))}
        </div>
      </div>

      <div className="campo">
        ¿Cada cuánto?
        <SelectorRepeticion
          repeticion={repeticion}
          fechaReferencia={hoy()}
          alCambiar={(r) => {
            setRepeticion(r)
            setError('')
          }}
          permiteUnica={false}
        />
      </div>

      {error && <p className="error" role="alert">{error}</p>}
      <button className="boton primario" onClick={guardar}>Guardar</button>
      {editando && (
        <>
          <button className="boton secundario" onClick={alternarPausa}>
            {recurrente.activo ? 'Pausar (dejar de proponerlo)' : 'Reanudar'}
          </button>
          <button className="boton peligro" onClick={borrar}>Eliminar</button>
        </>
      )}
    </Hoja>
  )
}
