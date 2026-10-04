import { useState } from 'react'
import { db, type Deuda } from '../db'
import { hoy } from '../fechas'
import { tasaEfectivaAnual, tasaMensual, type TipoTasa } from '../plan'
import CampoMonto from '../componentes/CampoMonto'
import Hoja from '../componentes/Hoja'

const SUGERENCIAS = ['💳', '🏦', '🚗', '🏍️', '🏠', '🎓', '👤', '🛍️']
const porcentaje = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 2 })

export default function FormDeuda({
  deuda,
  capitalPagado = 0,
  saldoActual,
  alCerrar,
}: {
  /** Si viene, se edita esa deuda. */
  deuda?: Deuda
  /** Cuánto capital se ha pagado ya (para no perder el historial al corregir el saldo). */
  capitalPagado?: number
  saldoActual?: number
  alCerrar: () => void
}) {
  const editando = deuda !== undefined
  const [nombre, setNombre] = useState(deuda?.nombre ?? '')
  const [icono, setIcono] = useState(deuda?.icono ?? '💳')
  const [saldo, setSaldo] = useState(saldoActual ?? 0)
  const [tasa, setTasa] = useState(deuda ? String(deuda.tasa).replace('.', ',') : '')
  const [tipoTasa, setTipoTasa] = useState<TipoTasa>(deuda?.tipoTasa ?? 'ea')
  const [pagoMinimo, setPagoMinimo] = useState(deuda?.pagoMinimo ?? 0)
  const [diaPago, setDiaPago] = useState(deuda?.diaPago !== undefined ? String(deuda.diaPago) : '')
  const [error, setError] = useState('')

  const tasaNumero = Number(tasa.replace(',', '.'))
  const tasaValida = tasa.trim() !== '' && Number.isFinite(tasaNumero) && tasaNumero >= 0
  const tm = tasaValida ? tasaMensual(tasaNumero, tipoTasa) : null

  async function guardar() {
    const limpio = nombre.trim()
    if (!limpio) return setError('Escribe un nombre para la deuda.')
    if (saldo <= 0) return setError('Escribe cuánto debes hoy.')
    if (!tasaValida) return setError('Escribe la tasa de interés (puede ser 0).')
    if (tipoTasa === 'mensual' && tasaNumero > 30) return setError('Una tasa mensual mayor a 30 % es poco probable. ¿Era anual?')
    if (tipoTasa === 'ea' && tasaNumero > 1000) return setError('La tasa anual parece demasiado alta.')
    if (pagoMinimo <= 0) return setError('Escribe el pago mínimo mensual.')
    const dia = diaPago.trim() === '' ? undefined : Number(diaPago)
    if (dia !== undefined && (!Number.isInteger(dia) || dia < 1 || dia > 31)) return setError('El día de pago debe estar entre 1 y 31.')

    const datos = {
      nombre: limpio,
      icono,
      tasa: tasaNumero,
      tipoTasa,
      pagoMinimo,
      ...(dia !== undefined ? { diaPago: dia } : {}),
    }
    if (editando) {
      // El saldo que se escribe es el de hoy; el inicial se ajusta para que el historial de pagos siga cuadrando.
      await db.deudas.put({ ...datos, id: deuda.id, creada: deuda.creada, saldoInicial: saldo + capitalPagado })
    } else {
      await db.deudas.add({ ...datos, saldoInicial: saldo, creada: hoy() })
    }
    alCerrar()
  }

  return (
    <Hoja titulo={editando ? 'Editar deuda' : 'Nueva deuda'} alCerrar={alCerrar}>
      <label className="campo">
        Nombre
        <input
          type="text"
          maxLength={40}
          autoFocus
          placeholder="Ej: Tarjeta de crédito"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
        />
      </label>

      <CampoMonto etiqueta="¿Cuánto debes hoy?" valor={saldo} alCambiar={setSaldo} />

      <div className="campo">
        Tasa de interés
        <div className="selector" role="group" aria-label="Tipo de tasa">
          <button className={tipoTasa === 'ea' ? 'sel ingreso' : ''} onClick={() => setTipoTasa('ea')}>
            Efectiva anual
          </button>
          <button className={tipoTasa === 'mensual' ? 'sel ingreso' : ''} onClick={() => setTipoTasa('mensual')}>
            Mensual
          </button>
        </div>
        <div className="monto-caja">
          <input
            inputMode="decimal"
            placeholder={tipoTasa === 'ea' ? 'Ej: 28,5' : 'Ej: 2,1'}
            value={tasa}
            onChange={(e) => setTasa(e.target.value.replace(/[^\d.,]/g, '').slice(0, 7))}
            aria-label="Porcentaje de la tasa"
          />
          <span>%</span>
        </div>
        {tm !== null && (
          <small className="ayuda">
            {tipoTasa === 'ea'
              ? `Equivale a ${porcentaje.format(tm * 100)} % mensual.`
              : `Equivale a ${porcentaje.format(tasaEfectivaAnual(tm) * 100)} % efectiva anual.`}
          </small>
        )}
      </div>

      <CampoMonto etiqueta="Pago mínimo mensual" valor={pagoMinimo} alCambiar={setPagoMinimo} />

      <label className="campo">
        Día del mes en que pagas (opcional)
        <input
          inputMode="numeric"
          placeholder="Ej: 15"
          maxLength={2}
          value={diaPago}
          onChange={(e) => setDiaPago(e.target.value.replace(/\D/g, ''))}
        />
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
