import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type Recurrente, type Tipo } from '../db'
import { hoy } from '../fechas'
import { eliminarRecurrente } from '../recurrentes'
import CampoMonto from '../componentes/CampoMonto'
import Hoja from '../componentes/Hoja'

export default function FormRecurrente({ recurrente, alCerrar }: { recurrente?: Recurrente; alCerrar: () => void }) {
  const editando = recurrente !== undefined
  const [tipo, setTipo] = useState<Tipo>(recurrente?.tipo ?? 'gasto')
  const [nombre, setNombre] = useState(recurrente?.nombre ?? '')
  const [monto, setMonto] = useState(recurrente?.monto ?? 0)
  const [categoriaId, setCategoriaId] = useState<number | null>(recurrente?.categoriaId ?? null)
  const [dia1, setDia1] = useState(recurrente ? String(recurrente.dias[0]) : '')
  const [dia2, setDia2] = useState(recurrente?.dias[1] !== undefined ? String(recurrente.dias[1]) : '')
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
    const d1 = Number(dia1)
    const d2 = dia2.trim() === '' ? undefined : Number(dia2)
    const valido = (d: number) => Number.isInteger(d) && d >= 1 && d <= 31
    if (!valido(d1)) return setError('Escribe el día del mes (de 1 a 31).')
    if (d2 !== undefined && (!valido(d2) || d2 === d1)) return setError('El segundo día debe ser distinto, de 1 a 31.')

    const categoria = visibles.find((c) => c.id === categoriaId)
    const datos = {
      nombre: (nombre.trim() || categoria?.nombre || 'Recurrente').slice(0, 40),
      tipo,
      monto,
      categoriaId,
      dias: d2 !== undefined ? [d1, d2].sort((a, b) => a - b) : [d1],
    }
    if (editando) await db.recurrentes.update(recurrente.id!, datos)
    else await db.recurrentes.add({ ...datos, nota: '', creado: hoy(), activo: true })
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
        ¿Qué día del mes?
        <div className="dos-dias">
          <input inputMode="numeric" maxLength={2} placeholder="Ej: 5" value={dia1} aria-label="Día del mes" onChange={(e) => setDia1(e.target.value.replace(/\D/g, ''))} />
          <input inputMode="numeric" maxLength={2} placeholder="Otro día (quincena)" value={dia2} aria-label="Segundo día, si es quincenal" onChange={(e) => setDia2(e.target.value.replace(/\D/g, ''))} />
        </div>
        <small className="ayuda">Si el mes no tiene ese día (31 en abril), se usa el último día del mes.</small>
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
