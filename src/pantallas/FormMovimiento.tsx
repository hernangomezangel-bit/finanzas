import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type Movimiento, type Tipo } from '../db'
import { hoy } from '../fechas'
import { omitirProgramado } from '../programados'
import { crearMovimientoRecurrente, idsVinculados, repetirMovimientos } from '../recurrentes'
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
  const [repetir, setRepetir] = useState(false)
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
    if (editando) {
      await db.movimientos.update(movimiento.id!, datos)
      if (repetir && puedeRepetir) await repetirMovimientos([movimiento.id!])
    } else if (repetir) await crearMovimientoRecurrente(datos)
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

      <label className="campo">
        Fecha
        <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
        {fecha > hoy() && (
          <small className="ayuda">
            La fecha todavía no llega: quedará como «{tipo === 'gasto' ? 'por pagar' : 'por recibir'}» hasta ese día.
          </small>
        )}
      </label>

      <label className="campo">
        Nota (opcional)
        <input type="text" maxLength={80} value={nota} onChange={(e) => setNota(e.target.value)} />
      </label>

      {puedeRepetir && (
        <label className="casilla">
          <input type="checkbox" checked={repetir} onChange={(e) => setRepetir(e.target.checked)} />
          <span>
            Repetir cada mes
            <small>
              Aparecerá en cada mes, el día {Number(fecha.slice(8, 10)) || '…'}, como «{tipo === 'gasto' ? 'por pagar' : 'por recibir'}»
              hasta ese día. Lo confirmas con un toque.
            </small>
          </span>
        </label>
      )}

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
