import { useState } from 'react'
import { db, type Meta, type TipoMeta } from '../db'
import { hoy } from '../fechas'
import CampoMonto from '../componentes/CampoMonto'
import Hoja from '../componentes/Hoja'

const SUGERENCIAS = ['🏠', '✈️', '🚗', '🎓', '💍', '🛡️', '📈', '🎁', '🏖️', '💻']

export default function FormMeta({ meta, alCerrar }: { meta?: Meta; alCerrar: () => void }) {
  const editando = meta !== undefined
  const [nombre, setNombre] = useState(meta?.nombre ?? '')
  const [tipo, setTipo] = useState<TipoMeta>(meta?.tipo ?? 'gasto')
  const [objetivo, setObjetivo] = useState(meta?.objetivo ?? 0)
  const [fechaMeta, setFechaMeta] = useState(meta?.fechaMeta ?? '')
  const [icono, setIcono] = useState(meta?.icono ?? '🎯')
  const [error, setError] = useState('')

  async function guardar() {
    const limpio = nombre.trim()
    if (!limpio) return setError('Escribe un nombre para la meta.')
    if (objetivo <= 0) return setError('El objetivo debe ser mayor a cero.')
    if (fechaMeta && fechaMeta < hoy() && fechaMeta !== meta?.fechaMeta) return setError('La fecha de la meta debe ser de hoy en adelante.')
    const datos = {
      nombre: limpio,
      tipo,
      objetivo,
      icono: icono.trim() || '🎯',
      ...(fechaMeta ? { fechaMeta } : {}),
    }
    if (editando) {
      // put reemplaza el registro completo, así quitar la fecha también se guarda.
      await db.metas.put({ ...datos, id: meta.id, creada: meta.creada, ...(meta.archivada ? { archivada: true } : {}) })
    } else {
      await db.metas.add({ ...datos, creada: hoy() })
    }
    alCerrar()
  }

  return (
    <Hoja titulo={editando ? 'Editar meta' : 'Nueva meta'} alCerrar={alCerrar}>
      <label className="campo">
        Nombre
        <input
          type="text"
          maxLength={40}
          autoFocus
          placeholder="Ej: Viaje a Cartagena"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
        />
      </label>

      <div className="selector" role="group" aria-label="Tipo de meta">
        <button className={tipo === 'gasto' ? 'sel ingreso' : ''} onClick={() => setTipo('gasto')}>
          Gasto programado
        </button>
        <button className={tipo === 'inversion' ? 'sel ingreso' : ''} onClick={() => setTipo('inversion')}>
          Inversión
        </button>
      </div>

      <CampoMonto etiqueta="¿Cuánto quieres juntar?" valor={objetivo} alCambiar={setObjetivo} />

      <label className="campo">
        Fecha límite (opcional)
        <input type="date" value={fechaMeta} onChange={(e) => setFechaMeta(e.target.value)} />
      </label>

      <div className="campo">
        Ícono
        <div className="chips">
          {SUGERENCIAS.map((s) => (
            <button key={s} className={s === icono ? 'chip activo' : 'chip'} onClick={() => setIcono(s)} aria-label={`Ícono ${s}`}>
              {s}
            </button>
          ))}
        </div>
      </div>

      {error && <p className="error" role="alert">{error}</p>}
      <button className="boton primario" onClick={guardar}>Guardar</button>
    </Hoja>
  )
}
