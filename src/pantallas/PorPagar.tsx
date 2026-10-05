import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import { useCompromisos } from '../compromisos'
import { fechaCorta, hoy, mesDe, moverMes, nombreMes } from '../fechas'
import { pesos } from '../formato'
import { useResumenesJornadas } from '../fuentes'
import { claveProgramado } from '../programadosPuro'

interface Fila {
  clave: string
  fecha: string
  nombre: string
  icono: string
  monto: number
  etiqueta: 'Deuda' | 'Ahorro' | 'Gasto fijo'
}

function cuando(fecha: string): string {
  const hoyTexto = hoy()
  if (fecha === hoyTexto) return 'Hoy'
  return fecha < hoyTexto ? `Tocaba el ${fechaCorta(fecha)}` : fechaCorta(fecha)
}

/**
 * Todo lo que falta por pagar en el mes (cuotas de deudas, ahorros y gastos fijos) y cuánto dinero te quedaría
 * después de pagarlo, sumando lo que ya recibiste y lo que aún falta por recibir.
 */
export default function PorPagar() {
  const [mes, setMes] = useState(mesDe(hoy()))
  const movimientos = useLiveQuery(() => db.movimientos.where('fecha').between(`${mes}-01`, `${mes}-32`).toArray(), [mes])
  const categorias = useLiveQuery(() => db.categorias.toArray())
  const trabajos = useResumenesJornadas(mes)
  const compromisos = useCompromisos(mes)

  if (!movimientos || !categorias || !trabajos || !compromisos) return null

  const categoria = (id: number) => categorias.find((c) => c.id === id)

  // Lo que falta por pagar: gastos programados (la app los creó sola y se confirman el día del pago)…
  const programados = movimientos.filter((m) => m.programado !== undefined && m.tipo === 'gasto')
  const clavesProgramadas = new Set(
    programados.map((m) => claveProgramado(m.programado!.origen, m.programado!.refId, m.programado!.fechaCuota)),
  )
  const filas: Fila[] = programados.map((m) => ({
    clave: `m|${m.id}`,
    fecha: m.fecha,
    nombre: m.nota,
    icono: categoria(m.categoriaId)?.icono ?? '🧾',
    monto: m.monto,
    etiqueta: m.programado!.origen === 'deuda' ? 'Deuda' : 'Ahorro',
  }))
  // …más lo que todavía no tiene gasto creado: gastos fijos recurrentes y cuotas de meses que aún no empiezan.
  const aRecibir = compromisos.items.filter((c) => c.direccion === 'recibir')
  for (const c of compromisos.items) {
    if (c.direccion !== 'pagar' || clavesProgramadas.has(c.clave)) continue
    filas.push({
      clave: c.clave,
      fecha: c.fecha,
      nombre: c.nombre,
      icono: c.icono,
      monto: c.monto,
      etiqueta: c.tipo === 'deuda' ? 'Deuda' : c.tipo === 'ahorro' ? 'Ahorro' : 'Gasto fijo',
    })
  }
  filas.sort((a, b) => a.fecha.localeCompare(b.fecha) || a.clave.localeCompare(b.clave))

  // Ingresos: lo recibido (sin el trabajo por días, que va con su proyección) + lo que falta por recibir.
  const idsDeJornadas = new Set(trabajos.flatMap((t) => t.idsMovimientos))
  const recibido = movimientos.reduce((s, m) => (m.tipo === 'ingreso' && !idsDeJornadas.has(m.id!) ? s + m.monto : s), 0)
  const porRecibir = aRecibir.reduce((s, c) => s + c.monto, 0)
  const proyeccionTrabajos = trabajos.reduce((s, t) => s + t.proyeccion.proyectado, 0)
  const ingresosProyectados = recibido + porRecibir + proyeccionTrabajos

  const pagados = movimientos.filter((m) => m.tipo === 'gasto' && m.programado === undefined)
  const gastosPagados = pagados.reduce((s, m) => s + m.monto, 0)
  const porPagar = filas.reduce((s, f) => s + f.monto, 0)
  const quedaria = ingresosProyectados - gastosPagados - porPagar

  const trabajosConProyeccion = trabajos.filter((t) => t.proyeccion.proyectado > 0)

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
            <dd className="ingreso">{pesos(recibido)}</dd>
          </div>
          {trabajosConProyeccion.map(({ fuente, proyeccion }) => (
            <div key={fuente.id}>
              <dt>{fuente.nombre} (proyección si cumples tu meta)</dt>
              <dd className="ingreso">{pesos(proyeccion.proyectado)}</dd>
            </div>
          ))}
          {porRecibir > 0 && (
            <div>
              <dt>Por recibir ({[...new Set(aRecibir.map((c) => c.nombre))].join(', ')})</dt>
              <dd className="ingreso">{pesos(porRecibir)}</dd>
            </div>
          )}
          <div>
            <dt>Gastos ya pagados</dt>
            <dd className="gasto">−{pesos(gastosPagados)}</dd>
          </div>
          <div>
            <dt>Por pagar</dt>
            <dd className="gasto">−{pesos(porPagar)}</dd>
          </div>
          <div className="total">
            <dt>Te quedaría</dt>
            <dd className={quedaria < 0 ? 'gasto' : 'ingreso'}>{pesos(quedaria)}</dd>
          </div>
        </dl>
      </section>

      <section>
        <h3 className="subtitulo">Por pagar este mes ({filas.length})</h3>
        {filas.length === 0 ? (
          <div className="tarjeta vacia">
            <p>No tienes nada pendiente por pagar en {nombreMes(mes).toLowerCase()}. 🎉</p>
          </div>
        ) : (
          <ul className="tarjeta lista por-pagar">
            {filas.map((f) => (
              <li key={f.clave}>
                <div className="fila-por-pagar">
                  <span className="icono-cat" aria-hidden="true">{f.icono}</span>
                  <span className="texto-mov">
                    <span>{f.nombre}</span>
                    <small>{cuando(f.fecha)} · {f.etiqueta}</small>
                  </span>
                  <strong className="gasto">{pesos(f.monto)}</strong>
                </div>
              </li>
            ))}
          </ul>
        )}
        <p className="pequeno nota-pie">
          Los pagos de deudas y ahorros ya están en tus gastos como «Programado». Confírmalos en Presupuesto → «Por
          registrar» el día que pagues.
        </p>
      </section>

      {compromisos.deudasSinDia.length > 0 && (
        <p className="aviso-sin-dia">
          ⚠️ {compromisos.deudasSinDia.join(', ')} no {compromisos.deudasSinDia.length === 1 ? 'tiene' : 'tienen'} día de
          pago, así que no se {compromisos.deudasSinDia.length === 1 ? 'incluye' : 'incluyen'} aquí. Pon el día en Deudas →
          Editar deuda.
        </p>
      )}

      <details className="tarjeta">
        <summary>Ya pagado este mes ({pagados.length})</summary>
        {pagados.length === 0 ? (
          <p className="pequeno">Aún no has pagado nada este mes.</p>
        ) : (
          <ul className="lista-pagados">
            {[...pagados]
              .sort((a, b) => a.fecha.localeCompare(b.fecha))
              .map((m) => (
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
