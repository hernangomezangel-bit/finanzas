import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type Recurrente, type Tipo } from '../db'
import { hoy } from '../fechas'
import { eliminarRecurrente } from '../recurrentes'
import { pesos } from '../formato'
import { DIAS_DEL_COBRO_POR_DIA, diasTrabajados } from '../recurrencia'
import {
  ABREVIATURAS_DIA,
  esRepeticionValida,
  patronDe,
  repeticionDe,
  repeticionPorDefecto,
  type Repeticion,
} from '../repeticion'
import CampoMonto from '../componentes/CampoMonto'
import Hoja from '../componentes/Hoja'
import SelectorRepeticion from '../componentes/SelectorRepeticion'

/** Lunes primero, que es como se piensa la semana. */
const ORDEN_SEMANA = [1, 2, 3, 4, 5, 6, 0]

export default function FormRecurrente({ recurrente, alCerrar }: { recurrente?: Recurrente; alCerrar: () => void }) {
  const editando = recurrente !== undefined
  const [tipo, setTipo] = useState<Tipo>(recurrente?.tipo ?? 'gasto')
  const [nombre, setNombre] = useState(recurrente?.nombre ?? '')
  const [monto, setMonto] = useState(recurrente?.monto ?? 0)
  const [categoriaId, setCategoriaId] = useState<number | null>(recurrente?.categoriaId ?? null)
  const [repeticion, setRepeticion] = useState<Repeticion>(() =>
    recurrente ? repeticionDe(recurrente) : repeticionPorDefecto('mensual', hoy()),
  )
  // Por día: el monto es el de cada día trabajado y la app registra el total del mes (menos los días de descanso).
  const [porDia, setPorDia] = useState(recurrente?.diasLibres !== undefined)
  const [diasLibres, setDiasLibres] = useState<number[]>(recurrente?.diasLibres ?? [])
  const [error, setError] = useState('')

  const categorias = useLiveQuery(() => db.categorias.where('tipo').equals(tipo).toArray(), [tipo])
  const visibles = (categorias ?? []).filter((c) => !c.oculta || c.id === recurrente?.categoriaId)

  function cambiarTipo(nuevo: Tipo) {
    if (nuevo === tipo) return
    setTipo(nuevo)
    setCategoriaId(null)
  }

  const libresOrdenados = [...diasLibres].sort((a, b) => a - b)
  const mesActual = hoy().slice(0, 7)
  const diasDelMes = diasTrabajados(mesActual, diasLibres)

  async function guardar() {
    if (monto <= 0) return setError('Escribe un monto mayor a cero.')
    if (categoriaId === null) return setError('Elige una categoría.')
    if (porDia && diasLibres.length >= 7) return setError('Deja al menos un día de trabajo a la semana.')
    // Por día se registra el total de cada mes el último día del mes: mensual, día 31.
    const patron = porDia ? { dias: DIAS_DEL_COBRO_POR_DIA } : patronDe(repeticion)
    if (!patron || (!porDia && !esRepeticionValida(repeticion))) {
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
      await db.recurrentes.update(recurrente.id!, {
        ...datos,
        frecuencia: 'frecuencia' in patron ? patron.frecuencia : undefined,
        diasLibres: porDia ? libresOrdenados : undefined,
      })
    } else {
      await db.recurrentes.add({
        ...datos,
        ...('frecuencia' in patron && patron.frecuencia ? { frecuencia: patron.frecuencia } : {}),
        ...(porDia ? { diasLibres: libresOrdenados } : {}),
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

      <div className="campo">
        ¿Cómo es el monto?
        <div className="chips" role="group" aria-label="Cómo es el monto">
          <button className={porDia ? 'chip' : 'chip activo'} aria-pressed={!porDia} onClick={() => setPorDia(false)}>
            Un monto cada vez
          </button>
          <button className={porDia ? 'chip activo' : 'chip'} aria-pressed={porDia} onClick={() => setPorDia(true)}>
            Un monto por cada día
          </button>
        </div>
      </div>

      <CampoMonto etiqueta={porDia ? 'Monto de cada día trabajado' : 'Monto habitual'} valor={monto} alCambiar={setMonto} autoFocus={!editando} />

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

      {porDia ? (
        <div className="campo">
          {tipo === 'ingreso' ? '¿Qué días de la semana NO trabajas?' : '¿Qué días de la semana descansas (no cuentan)?'}
          <div className="chips">
            {ORDEN_SEMANA.map((dia) => {
              const libre = diasLibres.includes(dia)
              return (
                <button
                  key={dia}
                  className={libre ? 'chip activo' : 'chip'}
                  aria-pressed={libre}
                  onClick={() => {
                    setDiasLibres(libre ? diasLibres.filter((d) => d !== dia) : [...diasLibres, dia])
                    setError('')
                  }}
                >
                  {ABREVIATURAS_DIA[dia]}
                </button>
              )
            })}
          </div>
          <small className="ayuda">
            Cada mes la app registra de una vez el total: el monto de cada día por los días del mes que no son de descanso.
            {monto > 0 &&
              ` Este mes: ${diasDelMes} días × ${pesos(monto)} = ${pesos(diasDelMes * monto)}.`}
          </small>
        </div>
      ) : (
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
      )}

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
