import { useState } from 'react'
import type { Deuda, PagoDeuda } from '../db'
import { eliminarDeuda, eliminarPago, fechaCuota, interesDelMes, saldoActual, textoTasa } from '../deudas'
import { fechaCorta } from '../fechas'
import { pesos } from '../formato'
import BarraProgreso from '../componentes/BarraProgreso'
import FormDeuda from './FormDeuda'
import FormPago from './FormPago'

export default function DetalleDeuda({
  deuda,
  pagos,
  alVolver,
}: {
  deuda: Deuda
  pagos: PagoDeuda[]
  alVolver: () => void
}) {
  const [hoja, setHoja] = useState<'pago' | 'editar' | null>(null)

  const saldo = saldoActual(deuda, pagos)
  const interes = interesDelMes(deuda, saldo)
  const lista = [...pagos].sort((a, b) => b.fecha.localeCompare(a.fecha) || b.id! - a.id!)
  const proxima = fechaCuota(deuda, pagos)
  const capitalPagado = pagos.reduce((s, p) => s + p.aCapital, 0)
  const noCubre = saldo > 0 && deuda.pagoMinimo <= interes

  async function quitarPago(pago: PagoDeuda) {
    const aviso = pago.movimientoId !== undefined
      ? '¿Eliminar este pago? Tu deuda volverá a subir y también se quitará su gasto del Presupuesto.'
      : '¿Eliminar este pago? Tu deuda volverá a subir.'
    if (window.confirm(aviso)) await eliminarPago(pago)
  }

  async function borrar() {
    if (!window.confirm(`¿Eliminar la deuda "${deuda.nombre}" y su historial de pagos? Los gastos que ya contaron en el Presupuesto se conservan.`)) return
    await eliminarDeuda(deuda.id!)
    alVolver()
  }

  return (
    <>
      <button className="volver" onClick={alVolver}>‹ Todas las deudas</button>

      <section className="tarjeta">
        <div className="meta-titulo">
          <span className="icono-meta" aria-hidden="true">{deuda.icono}</span>
          <div>
            <h2>{deuda.nombre}</h2>
            <span className="etiqueta">{textoTasa(deuda)} · mínimo {pesos(deuda.pagoMinimo)}</span>
          </div>
        </div>

        <span className="etiqueta-grande">Debes hoy</span>
        <strong className="total-grande gasto">{pesos(saldo)}</strong>
        <BarraProgreso ahorrado={Math.min(deuda.saldoInicial, Math.max(0, deuda.saldoInicial - saldo))} objetivo={deuda.saldoInicial} etiqueta="pagado" />

        {saldo === 0 ? (
          <p className="mensaje ok">¡Deuda pagada! 🎉</p>
        ) : (
          <>
            <p className="faltante">
              Interés estimado de este mes: <strong>{pesos(interes)}</strong>
              {proxima && <> · Próximo pago: <strong>{fechaCorta(proxima)}</strong></>}
            </p>
            {noCubre && (
              <p className="alerta">
                ⚠️ Tu pago mínimo no cubre los intereses: pagando solo el mínimo, la deuda no baja. Aumenta lo que pagas.
              </p>
            )}
            <button className="boton primario" onClick={() => setHoja('pago')}>Registrar pago</button>
          </>
        )}
      </section>

      <section>
        <h3 className="subtitulo">Pagos hechos</h3>
        {lista.length === 0 ? (
          <div className="tarjeta vacia">
            <p>Aún no has registrado pagos.</p>
          </div>
        ) : (
          <ul className="tarjeta lista">
            {lista.map((p) => (
              <li key={p.id}>
                <button onClick={() => quitarPago(p)} aria-label={`Pago del ${fechaCorta(p.fecha)}, toca para eliminarlo`}>
                  <span className="texto-mov">
                    <span>{fechaCorta(p.fecha)}</span>
                    <small>Interés {pesos(p.interes)} · {p.aCapital >= 0 ? `Capital ${pesos(p.aCapital)}` : `Deuda +${pesos(-p.aCapital)}`}</small>
                  </span>
                  <strong className="ingreso">{pesos(p.monto)}</strong>
                </button>
              </li>
            ))}
          </ul>
        )}
        {lista.length > 0 && <p className="pequeno nota-pie">Toca un pago para eliminarlo si te equivocaste.</p>}
      </section>

      <div className="acciones-meta">
        <button className="boton secundario" onClick={() => setHoja('editar')}>Editar deuda</button>
        <button className="boton peligro" onClick={borrar}>Eliminar deuda</button>
      </div>

      {hoja === 'pago' && <FormPago deuda={deuda} saldo={saldo} alCerrar={() => setHoja(null)} />}
      {hoja === 'editar' && (
        <FormDeuda deuda={deuda} saldoActual={saldo} capitalPagado={capitalPagado} alCerrar={() => setHoja(null)} />
      )}
    </>
  )
}
