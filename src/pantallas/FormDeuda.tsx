import { useState } from 'react'
import { db, type Deuda } from '../db'
import { hoy } from '../fechas'
import { pesos } from '../formato'
import { sincronizarTasaCuotas, tasaEfectivaAnual, tasaMensual, type ResultadoVinculo, type TipoTasa } from '../plan'
import CampoMonto from '../componentes/CampoMonto'
import Hoja from '../componentes/Hoja'

const SUGERENCIAS = ['💳', '🏦', '🚗', '🏍️', '🏠', '🎓', '👤', '🛍️']
const porcentaje = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 2 })

/** El porcentaje escrito como número, o null si está vacío o no es válido. */
function numeroDe(texto: string): number | null {
  if (texto.trim() === '') return null
  const n = Number(texto.replace(',', '.'))
  return Number.isFinite(n) && n >= 0 ? n : null
}

function enteroDe(texto: string): number | null {
  const n = Number(texto)
  return texto.trim() !== '' && Number.isInteger(n) && n > 0 ? n : null
}

type Casilla = 'tasa' | 'cuotas'

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
  // Al editar, las cuotas que faltan salen de la tasa guardada.
  const [inicial] = useState<ResultadoVinculo | null>(() =>
    deuda && saldoActual
      ? sincronizarTasaCuotas({ saldo: saldoActual, pago: deuda.pagoMinimo, tipo: deuda.tipoTasa, tasa: deuda.tasa, cuotas: null, editado: 'tasa' })
      : null,
  )
  const [cuotas, setCuotas] = useState(inicial?.cuotas ? String(inicial.cuotas) : '')
  /** La casilla que la persona escribió por última vez; la otra se calcula a partir de ella. */
  const [editado, setEditado] = useState<Casilla>('tasa')
  /** Cuál de las dos casillas se llenó sola, para avisarlo. */
  const [calculada, setCalculada] = useState<Casilla | null>(inicial?.cuotas ? 'cuotas' : null)
  const [problema, setProblema] = useState<ResultadoVinculo['problema']>(undefined)
  const [error, setError] = useState('')

  const tasaNumero = Number(tasa.replace(',', '.'))
  const tasaValida = tasa.trim() !== '' && Number.isFinite(tasaNumero) && tasaNumero >= 0
  const tm = tasaValida ? tasaMensual(tasaNumero, tipoTasa) : null

  /** Recalcula la casilla que no se tocó, con los valores nuevos (los que cambiaron y los que siguen igual). */
  function recalcular(nuevo: { saldo?: number; pago?: number; tipo?: TipoTasa; tasa?: string; cuotas?: string; editado: Casilla }) {
    const tasaTexto = nuevo.tasa ?? tasa
    const cuotasTexto = nuevo.cuotas ?? cuotas
    const r = sincronizarTasaCuotas({
      saldo: nuevo.saldo ?? saldo,
      pago: nuevo.pago ?? pagoMinimo,
      tipo: nuevo.tipo ?? tipoTasa,
      tasa: numeroDe(tasaTexto),
      cuotas: enteroDe(cuotasTexto),
      editado: nuevo.editado,
    })
    setProblema(r.problema)
    const otra: Casilla = nuevo.editado === 'tasa' ? 'cuotas' : 'tasa'
    const valor = otra === 'cuotas' ? r.cuotas : r.tasa
    if (valor !== null) {
      // Lo calculado se muestra en la casilla; la tasa con coma decimal, como se escribe en Colombia.
      if (otra === 'cuotas') setCuotas(String(valor))
      else setTasa(String(valor).replace('.', ','))
      setCalculada(otra)
    } else if (calculada === otra) {
      // Si no se puede calcular, se vacía solo lo que se había llenado automáticamente, nunca lo que escribió la persona.
      if (otra === 'cuotas') setCuotas('')
      else setTasa('')
      setCalculada(null)
    }
  }

  async function guardar() {
    const limpio = nombre.trim()
    if (!limpio) return setError('Escribe un nombre para la deuda.')
    if (saldo <= 0) return setError('Escribe cuánto debes hoy.')
    if (!tasaValida) return setError('Escribe la tasa de interés (puede ser 0) o el número de cuotas.')
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
      await db.deudas.put({
        ...datos,
        id: deuda.id,
        creada: deuda.creada,
        saldoInicial: saldo + capitalPagado,
        ...(deuda.propuestasDesde ? { propuestasDesde: deuda.propuestasDesde } : {}),
      })
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

      <CampoMonto
        etiqueta="¿Cuánto debes hoy?"
        valor={saldo}
        alCambiar={(v) => {
          setSaldo(v)
          recalcular({ saldo: v, editado })
        }}
      />

      <CampoMonto
        etiqueta="Pago mínimo mensual (tu cuota)"
        valor={pagoMinimo}
        alCambiar={(v) => {
          setPagoMinimo(v)
          recalcular({ pago: v, editado })
        }}
      />

      <div className="campo">
        Tasa de interés
        <div className="selector" role="group" aria-label="Tipo de tasa">
          <button
            className={tipoTasa === 'ea' ? 'sel ingreso' : ''}
            onClick={() => {
              setTipoTasa('ea')
              recalcular({ tipo: 'ea', editado })
            }}
          >
            Efectiva anual
          </button>
          <button
            className={tipoTasa === 'mensual' ? 'sel ingreso' : ''}
            onClick={() => {
              setTipoTasa('mensual')
              recalcular({ tipo: 'mensual', editado })
            }}
          >
            Mensual
          </button>
        </div>
        <div className={calculada === 'tasa' ? 'monto-caja calculado' : 'monto-caja'}>
          <input
            inputMode="decimal"
            placeholder={tipoTasa === 'ea' ? 'Ej: 28,5' : 'Ej: 2,1'}
            value={tasa}
            onChange={(e) => {
              const texto = e.target.value.replace(/[^\d.,]/g, '').slice(0, 7)
              setTasa(texto)
              setEditado('tasa')
              if (calculada === 'tasa') setCalculada(null)
              recalcular({ tasa: texto, editado: 'tasa' })
            }}
            aria-label="Porcentaje de la tasa"
          />
          <span>%</span>
        </div>
        {calculada === 'tasa' && <small className="ayuda automatico">Calculada con tu saldo, tu pago y el número de cuotas.</small>}
        {tm !== null && (
          <small className="ayuda">
            {tipoTasa === 'ea'
              ? `Equivale a ${porcentaje.format(tm * 100)} % mensual.`
              : `Equivale a ${porcentaje.format(tasaEfectivaAnual(tm) * 100)} % efectiva anual.`}
          </small>
        )}
      </div>

      <div className="campo">
        Número de cuotas que faltan
        <div className={calculada === 'cuotas' ? 'monto-caja calculado' : 'monto-caja'}>
          <input
            inputMode="numeric"
            placeholder="Ej: 36"
            maxLength={3}
            value={cuotas}
            onChange={(e) => {
              const texto = e.target.value.replace(/\D/g, '')
              setCuotas(texto)
              setEditado('cuotas')
              if (calculada === 'cuotas') setCalculada(null)
              recalcular({ cuotas: texto, editado: 'cuotas' })
            }}
            aria-label="Número de cuotas que faltan"
          />
          <span className="unidad">cuotas</span>
        </div>
        {calculada === 'cuotas' ? (
          <small className="ayuda automatico">
            Calculado con tu saldo, tu pago y la tasa. Si escribes otro número, se calcula la tasa.
          </small>
        ) : (
          <small className="ayuda">
            Va conectado con la tasa: llena el saldo y tu pago, y escribe cualquiera de los dos; el otro se calcula solo.
          </small>
        )}
        {problema === 'nunca' && tm !== null && (
          <p className="alerta">
            ⚠️ Con esa tasa, el interés de un mes ({pesos(Math.round(saldo * tm))}) es mayor que tu pago ({pesos(pagoMinimo)}): la
            deuda nunca se terminaría. Sube el pago o revisa la tasa.
          </p>
        )}
        {problema === 'imposible' && (
          <p className="alerta">
            ⚠️ Con ese pago y {cuotas} cuotas pagarías {pesos(pagoMinimo * (enteroDe(cuotas) ?? 0))} en total, menos de lo que
            debes ({pesos(saldo)}). Sube el pago o las cuotas.
          </p>
        )}
      </div>

      <label className="campo">
        Día del mes en que pagas
        <input
          inputMode="numeric"
          placeholder="Ej: 15"
          maxLength={2}
          value={diaPago}
          onChange={(e) => setDiaPago(e.target.value.replace(/\D/g, ''))}
        />
        <small className="ayuda">
          Con el día de pago, la app crea sola el gasto de cada cuota en Presupuesto (con el monto del plan, incluido el
          dinero extra si lo hay). Sin él, tendrás que registrar los pagos tú.
        </small>
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
