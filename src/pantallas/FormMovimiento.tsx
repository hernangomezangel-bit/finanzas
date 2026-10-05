import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type Movimiento, type Tipo } from '../db'
import { hoy, nombreDia } from '../fechas'
import { omitirProgramado } from '../programados'
import { crearMovimientoConPatron, idsVinculados, volverFijo } from '../recurrentes'
import { patronDe, textoRepeticion, type Repeticion } from '../repeticion'
import Calendario from '../componentes/Calendario'
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
  const [repeticion, setRepeticion] = useState<Repeticion>({ tipo: 'unica', dias: [] })
  const [calendario, setCalendario] = useState(false)
  const [nota, setNota] = useState(movimiento?.nota ?? '')
  const [error, setError] = useState('')

  const categorias = useLiveQuery(() => db.categorias.where('tipo').equals(tipo).toArray(), [tipo])
  // Las categorías ocultas no se ofrecen, salvo la que ya usa este movimiento.
  const visibles = (categorias ?? []).filter((c) => !c.oculta || c.id === movimiento?.categoriaId)
  // Un movimiento que ya existe se puede volver fijo, salvo si ya es programado o está atado a un recurrente, pago o aporte.
  const atado = useLiveQuery(
    async () => (movimiento?.id !== undefined ? (await idsVinculados()).has(movimiento.id) : false),
    [movimiento?.id],
  )
  const puedeRepetir = !editando || (movimiento.programado === undefined && atado === false)

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
    const patron = puedeRepetir ? patronDe(repeticion) : null
    if (editando) {
      await db.movimientos.update(movimiento.id!, datos)
      if (patron) await volverFijo(movimiento.id!, patron)
    } else if (patron) await crearMovimientoConPatron(datos, patron)
    else await db.movimientos.add(datos)
    alCerrar()
  }

  async function eliminar() {
    const programado = movimiento!.programado !== undefined
    const aviso = programado
      ? 'Este pago está programado. Si lo eliminas, se omite esta cuota y no volverá a aparecer. ¿Eliminarlo?'
      : '¿Eliminar este movimiento?'
    if (!window.confirm(aviso)) return
    // Un gasto programado se quita omitiendo su cuota; si no, la app lo volvería a crear.
    if (programado) await omitirProgramado(movimiento!)
    else await db.movimientos.delete(movimiento!.id!)
    alCerrar()
  }

  return (
    <Hoja titulo={editando ? 'Editar movimiento' : 'Nuevo movimiento'} alCerrar={alCerrar}>
      {movimiento?.programado && (
        <p className="ayuda">
          Programado: la app lo creó sola. Puedes cambiar el monto. El día del pago, confírmalo en «Por registrar» para que
          baje el saldo de tu deuda o sume a tu ahorro.
        </p>
      )}
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

      <div className="campo">
        {repeticion.tipo === 'unica' ? 'Fecha' : 'Empieza el'}
        <button className="boton-fecha" onClick={() => setCalendario(true)} aria-label="Elegir fecha">
          <span aria-hidden="true">📅</span> {nombreDia(fecha)}
        </button>
        {repeticion.tipo !== 'unica' && <span className="repite">🔁 {textoRepeticion(repeticion)}</span>}
        {puedeRepetir && repeticion.tipo === 'unica' && (
          <small className="ayuda">Toca la fecha para elegir otro día o para que se repita (todos los días, cada semana, cada quincena o cada mes).</small>
        )}
        {fecha > hoy() && (
          <small className="ayuda">
            La fecha todavía no llega: quedará como «{tipo === 'gasto' ? 'por pagar' : 'por recibir'}» hasta ese día.
          </small>
        )}
      </div>

      <label className="campo">
        Nota (opcional)
        <input type="text" maxLength={80} value={nota} onChange={(e) => setNota(e.target.value)} />
      </label>

      {error && <p className="error" role="alert">{error}</p>}

      <button className="boton primario" onClick={guardar}>Guardar</button>
      {editando && <button className="boton peligro" onClick={eliminar}>Eliminar</button>}

      {calendario && (
        <Calendario
          fecha={fecha}
          repeticion={repeticion}
          permiteRepetir={puedeRepetir}
          alAplicar={(f, r) => {
            setFecha(f)
            setRepeticion(r)
            setCalendario(false)
          }}
          alCerrar={() => setCalendario(false)}
        />
      )}
    </Hoja>
  )
}

/** Hoy si se mira el mes actual; si no, el primer día del mes que se está viendo. */
function fechaInicial(mes: string): string {
  const h = hoy()
  return h.startsWith(mes) ? h : `${mes}-01`
}
