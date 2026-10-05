import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type Deuda, type PagoDeuda } from '../db'
import { fechaCuota, interesDelMes, saldoActual, textoTasa } from '../deudas'
import { fechaCorta } from '../fechas'
import { pesos } from '../formato'
import BarraProgreso from '../componentes/BarraProgreso'
import DetalleDeuda from './DetalleDeuda'
import FormDeuda from './FormDeuda'
import FormPago from './FormPago'
import PlanDeudas from './PlanDeudas'

type Vista = { tipo: 'lista' } | { tipo: 'plan' } | { tipo: 'deuda'; id: number }

export default function Deudas() {
  const deudas = useLiveQuery(() => db.deudas.toArray())
  const pagos = useLiveQuery(() => db.pagosDeuda.toArray())
  const [vista, setVista] = useState<Vista>({ tipo: 'lista' })
  const [creando, setCreando] = useState(false)
  const [abonando, setAbonando] = useState<{ deuda: Deuda; saldo: number } | null>(null)

  if (!deudas || !pagos) return null

  const pagosDe = (id: number): PagoDeuda[] => pagos.filter((p) => p.deudaId === id)
  const volver = () => setVista({ tipo: 'lista' })

  if (vista.tipo === 'plan') return <PlanDeudas deudas={deudas} pagos={pagos} alVolver={volver} />
  const abierta = vista.tipo === 'deuda' ? deudas.find((d) => d.id === vista.id) : undefined
  if (abierta) return <DetalleDeuda deuda={abierta} pagos={pagosDe(abierta.id!)} alVolver={volver} />

  const saldos = new Map(deudas.map((d) => [d.id!, saldoActual(d, pagosDe(d.id!))]))
  const activas = deudas.filter((d) => saldos.get(d.id!)! > 0)
  const saldadas = deudas.filter((d) => saldos.get(d.id!) === 0)
  const total = activas.reduce((s, d) => s + saldos.get(d.id!)!, 0)
  // Las deudas sin cuota (préstamos sin interés) se muestran aparte y no cuentan en los pagos mínimos.
  const conCuota = activas.filter((d) => !d.sinCuota)
  const sinCuota = activas.filter((d) => d.sinCuota)
  const minimos = conCuota.reduce((s, d) => s + d.pagoMinimo, 0)

  const tarjeta = (d: Deuda) => {
    const saldo = saldos.get(d.id!)!
    const proxima = fechaCuota(d, pagosDe(d.id!))
    const noCubre = saldo > 0 && !d.sinCuota && d.pagoMinimo <= interesDelMes(d, saldo)
    return (
      <li key={d.id} className={d.sinCuota && saldo > 0 ? 'con-abono' : undefined}>
        <button className="tarjeta meta-tarjeta" onClick={() => setVista({ tipo: 'deuda', id: d.id! })}>
          <div className="meta-titulo">
            <span className="icono-meta" aria-hidden="true">{d.icono}</span>
            <div className="deuda-texto">
              <strong>{d.nombre}</strong>
              <span className="etiqueta">
                {d.sinCuota ? 'Sin interés · sin pago mensual' : `${textoTasa(d)} · mínimo ${pesos(d.pagoMinimo)}`}
              </span>
            </div>
            <strong className={saldo > 0 ? 'gasto' : 'ingreso'}>{saldo > 0 ? pesos(saldo) : '¡Pagada! 🎉'}</strong>
          </div>
          <BarraProgreso
            ahorrado={Math.min(d.saldoInicial, Math.max(0, d.saldoInicial - saldo))}
            objetivo={d.saldoInicial}
            etiqueta="pagado"
          />
          {proxima && saldo > 0 && <span className="etiqueta">Próximo pago: {fechaCorta(proxima)}</span>}
          {noCubre && <span className="alerta-chica">⚠️ El mínimo no cubre los intereses</span>}
        </button>
        {d.sinCuota && saldo > 0 && (
          <button className="boton secundario" onClick={() => setAbonando({ deuda: d, saldo })}>Abonar</button>
        )}
      </li>
    )
  }

  return (
    <>
      {deudas.length === 0 ? (
        <div className="tarjeta vacia">
          <p>Aún no has registrado deudas.</p>
          <p className="pequeno">
            Agrega cada una con su saldo, interés y pago mínimo, y la app te arma un plan para pagarlas lo más rápido posible.
          </p>
        </div>
      ) : (
        <>
          {activas.length > 0 && (
            <section className="tarjeta">
              <span className="etiqueta-grande">Debes en total</span>
              <strong className="total-grande gasto">{pesos(total)}</strong>
              <span className="pequeno">
                en {activas.length} {activas.length === 1 ? 'deuda' : 'deudas'}
                {conCuota.length > 0 && <> · mínimos: {pesos(minimos)} al mes</>}
                {sinCuota.length > 0 && <> · {sinCuota.length} sin cuota ni interés</>}
              </span>
              {conCuota.length > 0 && (
                <button className="boton primario" onClick={() => setVista({ tipo: 'plan' })}>Ver mi plan de pago</button>
              )}
            </section>
          )}
          {conCuota.length > 0 && <ul className="lista-metas">{conCuota.map(tarjeta)}</ul>}
          {sinCuota.length > 0 && (
            <>
              <h3 className="subtitulo">Sin cuota ni interés</h3>
              <ul className="lista-metas">{sinCuota.map(tarjeta)}</ul>
            </>
          )}
          {saldadas.length > 0 && (
            <details className="cerradas">
              <summary>Deudas pagadas ({saldadas.length})</summary>
              <ul className="lista-metas">{saldadas.map(tarjeta)}</ul>
            </details>
          )}
        </>
      )}

      <button className="fab" onClick={() => setCreando(true)} aria-label="Agregar deuda">+</button>
      {creando && <FormDeuda alCerrar={() => setCreando(false)} />}
      {abonando && <FormPago deuda={abonando.deuda} saldo={abonando.saldo} alCerrar={() => setAbonando(null)} />}
    </>
  )
}
