import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type Movimiento } from '../db'
import { saldoActual } from '../deudas'
import { fechaCorta, hoy, mesDe, moverMes, nombreMes } from '../fechas'
import { pesos } from '../formato'
import { useResumenesJornadas } from '../fuentes'
import { estaPendiente } from '../programadosPuro'

type Etiqueta = 'Deuda' | 'Ahorro' | 'Gasto fijo' | 'Ingreso fijo' | 'Pendiente'

function etiquetaDe(m: Movimiento): Etiqueta {
  switch (m.programado?.origen) {
    case 'deuda':
      return 'Deuda'
    case 'ahorro':
      return 'Ahorro'
    case 'recurrente':
      return m.tipo === 'gasto' ? 'Gasto fijo' : 'Ingreso fijo'
    default:
      return 'Pendiente'
  }
}

function cuando(fecha: string): string {
  const hoyTexto = hoy()
  if (fecha === hoyTexto) return 'Hoy'
  return fecha < hoyTexto ? `Tocaba el ${fechaCorta(fecha)}` : fechaCorta(fecha)
}

/**
 * Lo que falta por pagar en el mes y cuánto dinero te quedaría después de pagarlo, sumando lo que ya recibiste y lo que
 * aún falta por recibir. Un movimiento está «por pagar» o «por recibir» si la app lo programó (cuotas de deudas y
 * ahorros, gastos e ingresos fijos) y aún no lo confirmaste, o si lo registraste con una fecha que todavía no llega.
 */
export default function PorPagar() {
  const [mes, setMes] = useState(mesDe(hoy()))
  const movimientos = useLiveQuery(() => db.movimientos.where('fecha').between(`${mes}-01`, `${mes}-32`).toArray(), [mes])
  const categorias = useLiveQuery(() => db.categorias.toArray())
  const trabajos = useResumenesJornadas(mes)
  const deudasSinDia = useLiveQuery(async () => {
    const [deudas, pagos] = await Promise.all([db.deudas.toArray(), db.pagosDeuda.toArray()])
    return deudas
      .filter((d) => d.diaPago === undefined && saldoActual(d, pagos.filter((p) => p.deudaId === d.id)) > 0)
      .map((d) => d.nombre)
  })

  if (!movimientos || !categorias || !trabajos || !deudasSinDia) return null

  const hoyTexto = hoy()
  const categoria = (id: number) => categorias.find((c) => c.id === id)
  // Lo que genera el trabajo por días (Didi…) va con su proyección, no aquí.
  const idsDeJornadas = new Set(trabajos.flatMap((t) => t.idsMovimientos))
  const propios = movimientos.filter((m) => !idsDeJornadas.has(m.id!))

  const porPagar = propios.filter((m) => m.tipo === 'gasto' && estaPendiente(m, hoyTexto)).sort(porFecha)
  const porRecibir = propios.filter((m) => m.tipo === 'ingreso' && estaPendiente(m, hoyTexto)).sort(porFecha)
  const pagados = propios.filter((m) => m.tipo === 'gasto' && !estaPendiente(m, hoyTexto)).sort(porFecha)
  const recibidos = propios.filter((m) => m.tipo === 'ingreso' && !estaPendiente(m, hoyTexto))

  const total = (lista: Movimiento[]) => lista.reduce((s, m) => s + m.monto, 0)
  const proyeccionTrabajos = trabajos.reduce((s, t) => s + t.proyeccion.proyectado, 0)
  const ingresosProyectados = total(recibidos) + total(porRecibir) + proyeccionTrabajos
  const quedaria = ingresosProyectados - total(pagados) - total(porPagar)
  const trabajosConProyeccion = trabajos.filter((t) => t.proyeccion.proyectado > 0)

  const fila = (m: Movimiento, color: 'gasto' | 'ingreso') => (
    <li key={m.id}>
      <div className="fila-por-pagar">
        <span className="icono-cat" aria-hidden="true">{categoria(m.categoriaId)?.icono ?? '🧾'}</span>
        <span className="texto-mov">
          <span>{m.nota || categoria(m.categoriaId)?.nombre || 'Movimiento'}</span>
          <small>{cuando(m.fecha)} · {etiquetaDe(m)}</small>
        </span>
        <strong className={color}>{pesos(m.monto)}</strong>
      </div>
    </li>
  )

  return (
    <>
      <div className="selector-mes">
        <button onClick={() => setMes(moverMes(mes, -1))} aria-label="Mes anterior">‹</button>
        <strong>{nombreMes(mes)}</strong>
        <button onClick={() => setMes(moverMes(mes, 1))} aria-label="Mes siguiente">›</button>
      </div>

      <section className="tarjeta">
        <span className="etiqueta-grande">Te quedaría este mes</span>
        <strong className={`total-grande ${quedaria < 0 ? 'gasto' : 'ingreso'}`}>{pesos(quedaria)}</strong>
        <span className="pequeno">Después de pagar todo lo que falta, con lo que ya recibiste y lo que aún vas a recibir.</span>

        <dl className="cuentas">
          <div>
            <dt>Ingresos ya recibidos</dt>
            <dd className="ingreso">{pesos(total(recibidos))}</dd>
          </div>
          {trabajosConProyeccion.map(({ fuente, proyeccion }) => (
            <div key={fuente.id}>
              <dt>{fuente.nombre} (proyección si cumples tu meta)</dt>
              <dd className="ingreso">{pesos(proyeccion.proyectado)}</dd>
            </div>
          ))}
          {porRecibir.length > 0 && (
            <div>
              <dt>Por recibir ({[...new Set(porRecibir.map((m) => m.nota || 'ingreso'))].join(', ')})</dt>
              <dd className="ingreso">{pesos(total(porRecibir))}</dd>
            </div>
          )}
          <div>
            <dt>Gastos ya pagados</dt>
            <dd className="gasto">−{pesos(total(pagados))}</dd>
          </div>
          <div>
            <dt>Por pagar</dt>
            <dd className="gasto">−{pesos(total(porPagar))}</dd>
          </div>
          <div className="total">
            <dt>Te quedaría</dt>
            <dd className={quedaria < 0 ? 'gasto' : 'ingreso'}>{pesos(quedaria)}</dd>
          </div>
        </dl>
      </section>

      <section>
        <h3 className="subtitulo">Por pagar este mes ({porPagar.length})</h3>
        {porPagar.length === 0 ? (
          <div className="tarjeta vacia">
            <p>No tienes nada pendiente por pagar en {nombreMes(mes).toLowerCase()}. 🎉</p>
          </div>
        ) : (
          <ul className="tarjeta lista por-pagar">{porPagar.map((m) => fila(m, 'gasto'))}</ul>
        )}
        <p className="pequeno nota-pie">
          Aquí aparece todo gasto programado (deudas, ahorros y gastos fijos) o con fecha futura, hasta que llega su día. Las
          cuotas se confirman en Presupuesto → «Por registrar» cuando pagas.
        </p>
      </section>

      {porRecibir.length > 0 && (
        <section>
          <h3 className="subtitulo">Por recibir este mes ({porRecibir.length})</h3>
          <ul className="tarjeta lista por-pagar">{porRecibir.map((m) => fila(m, 'ingreso'))}</ul>
        </section>
      )}

      {deudasSinDia.length > 0 && (
        <p className="aviso-sin-dia">
          ⚠️ {deudasSinDia.join(', ')} no {deudasSinDia.length === 1 ? 'tiene' : 'tienen'} día de pago, así que no se{' '}
          {deudasSinDia.length === 1 ? 'incluye' : 'incluyen'} aquí. Pon el día en Deudas → Editar deuda.
        </p>
      )}

      <details className="tarjeta">
        <summary>Ya pagado este mes ({pagados.length})</summary>
        {pagados.length === 0 ? (
          <p className="pequeno">Aún no has pagado nada este mes.</p>
        ) : (
          <ul className="lista-pagados">
            {pagados.map((m) => (
              <li key={m.id}>
                <span aria-hidden="true">{categoria(m.categoriaId)?.icono ?? '🧾'}</span>
                <span className="nombre">
                  {categoria(m.categoriaId)?.nombre ?? 'Sin categoría'}
                  <small>{fechaCorta(m.fecha)}{m.nota ? ` · ${m.nota}` : ''}</small>
                </span>
                <strong className="gasto">{pesos(m.monto)}</strong>
              </li>
            ))}
          </ul>
        )}
      </details>
    </>
  )
}

function porFecha(a: Movimiento, b: Movimiento): number {
  return a.fecha.localeCompare(b.fecha) || a.id! - b.id!
}
