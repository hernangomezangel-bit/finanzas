import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type Fuente } from '../db'
import { hoy } from '../fechas'
import { ETIQUETAS_DIAS, eliminarFuente } from '../fuentes'
import CampoMonto from '../componentes/CampoMonto'
import Hoja from '../componentes/Hoja'

/** Lunes primero, que es como se piensa la semana de trabajo. */
const ORDEN_SEMANA = [1, 2, 3, 4, 5, 6, 0]

export default function FormFuente({ fuente, alCerrar }: { fuente?: Fuente; alCerrar: () => void }) {
  const editando = fuente !== undefined
  const [nombre, setNombre] = useState(fuente?.nombre ?? '')
  const [metaDiaria, setMetaDiaria] = useState(fuente?.metaDiaria ?? 0)
  const [categoriaId, setCategoriaId] = useState<number | null>(fuente?.categoriaId ?? null)
  const [diasLibres, setDiasLibres] = useState<number[]>(fuente?.diasLibres ?? [])
  const [error, setError] = useState('')

  const categorias = useLiveQuery(() => db.categorias.where('tipo').equals('ingreso').toArray())
  const visibles = (categorias ?? []).filter((c) => !c.oculta || c.id === fuente?.categoriaId)
  // Sugerida: una categoría de ingreso variable, para que cuente en el promedio de ingresos variables.
  const sugerida = visibles.find((c) => c.nombre === 'Ingresos extra') ?? visibles.find((c) => c.variable)
  const seleccionada = categoriaId ?? sugerida?.id ?? null

  function alternarDia(dia: number) {
    setDiasLibres((actuales) => (actuales.includes(dia) ? actuales.filter((d) => d !== dia) : [...actuales, dia]))
  }

  async function guardar() {
    const limpio = nombre.trim()
    if (!limpio) return setError('Escribe el nombre del trabajo, por ejemplo Didi.')
    if (metaDiaria <= 0) return setError('Escribe tu meta diaria.')
    if (seleccionada === null) return setError('Elige una categoría de ingreso.')
    if (diasLibres.length >= 7) return setError('Deja al menos un día de la semana para trabajar.')

    const datos = { nombre: limpio, metaDiaria, categoriaId: seleccionada, diasLibres: [...diasLibres].sort((a, b) => a - b) }
    if (editando) await db.fuentes.update(fuente.id!, datos)
    else await db.fuentes.add({ ...datos, creado: hoy(), activo: true })
    alCerrar()
  }

  async function borrar() {
    if (!window.confirm(`¿Eliminar "${fuente!.nombre}" y su historial de días? Los ingresos que ya registraste se conservan.`)) return
    await eliminarFuente(fuente!.id!)
    alCerrar()
  }

  async function alternarPausa() {
    await db.fuentes.update(fuente!.id!, { activo: !fuente!.activo })
    alCerrar()
  }

  return (
    <Hoja titulo={editando ? 'Editar meta diaria' : 'Nueva meta diaria'} alCerrar={alCerrar}>
      <label className="campo">
        Trabajo
        <input
          type="text"
          maxLength={40}
          autoFocus={!editando}
          placeholder="Ej: Didi"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
        />
      </label>

      <CampoMonto etiqueta="Meta: ¿cuánto quieres ganar por día?" valor={metaDiaria} alCambiar={setMetaDiaria} />

      <div className="campo">
        ¿Qué días de la semana nunca trabajas?
        <div className="chips">
          {ORDEN_SEMANA.map((dia) => (
            <button
              key={dia}
              className={diasLibres.includes(dia) ? 'chip activo' : 'chip'}
              onClick={() => alternarDia(dia)}
              aria-pressed={diasLibres.includes(dia)}
            >
              {ETIQUETAS_DIAS[dia]}
            </button>
          ))}
        </div>
        <small className="ayuda">
          Por ejemplo, el día de pico y placa de tu vehículo. Esos días no te preguntaré nada. Los demás días
          te preguntaré, y puedes responder "No trabajé".
        </small>
      </div>

      <div className="campo">
        ¿En qué categoría se registran las ganancias?
        <div className="chips">
          {visibles.map((c) => (
            <button key={c.id} className={c.id === seleccionada ? 'chip activo' : 'chip'} onClick={() => setCategoriaId(c.id!)}>
              <span aria-hidden="true">{c.icono}</span> {c.nombre}
            </button>
          ))}
        </div>
      </div>

      {error && <p className="error" role="alert">{error}</p>}
      <button className="boton primario" onClick={guardar}>Guardar</button>
      {editando && (
        <>
          <button className="boton secundario" onClick={alternarPausa}>
            {fuente.activo ? 'Pausar (dejar de preguntar)' : 'Reanudar'}
          </button>
          <button className="boton peligro" onClick={borrar}>Eliminar</button>
        </>
      )}
    </Hoja>
  )
}
