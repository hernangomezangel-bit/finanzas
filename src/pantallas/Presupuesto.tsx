import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type Movimiento } from '../db'
import { pesos } from '../formato'
import { fechaDia, hoy, mesDe, moverMes, nombreMes } from '../fechas'
import { useResumenesJornadas } from '../fuentes'
import { usePromedioVariable } from '../ingresos'
import { estaPendiente } from '../programadosPuro'
import AccesoTico from '../componentes/AccesoTico'
import AvisoRespaldo from '../componentes/AvisoRespaldo'
import AvisoTico from '../componentes/AvisoTico'
import ListaMovimientos from '../componentes/ListaMovimientos'
import PendientesJornadas from '../componentes/PendientesJornadas'
import PorRegistrar from '../componentes/PorRegistrar'
import RepetirFijos from '../componentes/RepetirFijos'
import ResumenJornadas from '../componentes/ResumenJornadas'
import Dona, { type Tajada } from '../componentes/Dona'
import FormMovimiento from './FormMovimiento'

const COLORES = ['var(--acento)','#d97706', '#2563eb', '#be185d', '#7c3aed', '#65a30d', '#dc2626', '#0891b2', '#a16207', '#64748b']

type Formulario = { movimiento?: Movimiento } | null

export default function Presupuesto({ irARespaldo, abrirAsistente }: { irARespaldo: () => void; abrirAsistente: () => void }) {
  const [mes, setMes] = useState(mesDe(hoy()))
  const [formulario, setFormulario] = useState<Formulario>(null)
  const [repitiendo, setRepitiendo] = useState(false)
  const [categoriaAbierta, setCategoriaAbierta] = useState<number | null>(null)

  const movimientos = useLiveQuery(
    () => db.movimientos.where('fecha').between(`${mes}-01`, `${mes}-32`).reverse().sortBy('fecha'),
    [mes],
  )
  const categorias = useLiveQuery(() => db.categorias.toArray())
  const promedio = usePromedioVariable(mes)
  const trabajosVariables = useResumenesJornadas(mes)

  if (!movimientos || !categorias || !trabajosVariables) return null

  const porId = new Map(categorias.map((c) => [c.id!, c]))
  const variableMes = movimientos.reduce(
    (s, m) => (m.tipo === 'ingreso' && porId.get(m.categoriaId)?.variable ? s + m.monto : s),
    0,
  )
  const gastos = suma(movimientos, 'gasto')

  // Lo ganado en trabajos por días (Didi…) se muestra en su propio recuadro con su proyección,
  // así que no se cuenta también en "Ingresos" para no sumarlo dos veces.
  const idsDeJornadas = new Set(trabajosVariables.flatMap((t) => t.idsMovimientos))
  const ingresosRegistrados = suma(movimientos, 'ingreso')
  const ingresos = movimientos.reduce(
    (s, m) => (m.tipo === 'ingreso' && !idsDeJornadas.has(m.id!) ? s + m.monto : s),
    0,
  )
  const recuadrosVariables = trabajosVariables.filter((t) => t.proyeccion.proyectado > 0)
  const proyectadoVariables = trabajosVariables.reduce((s, t) => s + t.proyeccion.proyectado, 0)

  const gastoPorCategoria = new Map<number, number>()
  for (const m of movimientos) {
    if (m.tipo === 'gasto') gastoPorCategoria.set(m.categoriaId, (gastoPorCategoria.get(m.categoriaId) ?? 0) + m.monto)
  }
  const ordenadas = [...gastoPorCategoria].sort((a, b) => b[1] - a[1])
  const tajadas: Tajada[] = ordenadas.map(([id, valor], i) => ({
    nombre: porId.get(id)?.nombre ?? 'Sin categoría',
    valor,
    color: COLORES[i % COLORES.length],
  }))
  const colorDe = new Map(ordenadas.map(([id], i) => [id, COLORES[i % COLORES.length]]))
  // Las categorías con gasto este mes y las que tienen un tope, aunque todavía no lleven nada gastado.
  const filasCategoria = categorias
    .filter((c) => c.tipo === 'gasto' && (gastoPorCategoria.has(c.id!) || c.tope !== undefined))
    .map((c) => ({ id: c.id!, nombre: c.nombre, icono: c.icono, gastado: gastoPorCategoria.get(c.id!) ?? 0, tope: c.tope }))
    .sort((a, b) => b.gastado - a.gastado || a.nombre.localeCompare(b.nombre))
  // Lo que falta por gastar de lo planeado en las categorías con tope: así el balance se compara con lo que se espera.
  const gastoPlaneadoPorGastar = filasCategoria.reduce((s, f) => (f.tope !== undefined ? s + Math.max(0, f.tope - f.gastado) : s), 0)

  // Los gastos incluyen lo que la app programó sola (cuotas de deudas y ahorros, gastos e ingresos fijos) y lo que
  // registraste con fecha futura. Eso cuenta en el mes, pero todavía no está pagado ni recibido: se muestra aparte.
  const hoyTexto = hoy()
  const gastosPendientes = movimientos
    .filter((m) => m.tipo === 'gasto' && estaPendiente(m, hoyTexto))
    .reduce((s, m) => s + m.monto, 0)
  const ingresosPendientes = movimientos
    .filter((m) => m.tipo === 'ingreso' && !idsDeJornadas.has(m.id!) && estaPendiente(m, hoyTexto))
    .reduce((s, m) => s + m.monto, 0)
  // El balance suma, además, la proyección de los trabajos por días (si cumples la meta). La proyección completa
  // y lo que falta por pagar están en la pestaña «Por pagar».
  const balance = ingresos + proyectadoVariables - gastos
  const balanceRegistrado = ingresosRegistrados - gastos

  return (
    <>
      <AvisoRespaldo alIr={irARespaldo} />
      <AccesoTico alAbrir={abrirAsistente} />
      <AvisoTico />
      <PendientesJornadas />
      <PorRegistrar />

      <div className="selector-mes">
        <button onClick={() => setMes(moverMes(mes, -1))} aria-label="Mes anterior">‹</button>
        <strong>{nombreMes(mes)}</strong>
        <button onClick={() => setMes(moverMes(mes, 1))} aria-label="Mes siguiente">›</button>
      </div>

      <button className="enlace-fijos" onClick={() => setRepitiendo(true)}>🔁 Elegir qué se repite cada mes</button>

      <div className="resumen">
        <div className="tarjeta dato">
          <span>Ingresos</span>
          <strong className="ingreso">{pesos(ingresos)}</strong>
          {ingresosPendientes > 0 && <small className="detalle-dato">Incluye {pesos(ingresosPendientes)} por recibir aún</small>}
          {recuadrosVariables.length > 0 && (
            <small className="detalle-dato">Sin {recuadrosVariables.map((t) => t.fuente.nombre).join(' ni ')}</small>
          )}
        </div>
        <div className="tarjeta dato">
          <span>Gastos</span>
          <strong className="gasto">{pesos(gastos)}</strong>
          {gastosPendientes > 0 && <small className="detalle-dato">Incluye {pesos(gastosPendientes)} por pagar aún</small>}
        </div>
        {recuadrosVariables.map(({ fuente, proyeccion }) => (
          <div key={fuente.id} className="tarjeta dato ancho">
            <span>{fuente.nombre} · proyección del mes</span>
            <strong className="ingreso">{pesos(proyeccion.proyectado)}</strong>
            <small className="detalle-dato">
              Ya ganado {pesos(proyeccion.registrado)}
              {proyeccion.diasSupuestos > 0 && (
                <>
                  {' '}+ {pesos(proyeccion.supuesto)} si cumples tu meta{' '}
                  {proyeccion.diasSupuestos === 1 ? 'el día que falta' : `los ${proyeccion.diasSupuestos} días que faltan`}
                </>
              )}
            </small>
          </div>
        ))}
        <div className="tarjeta dato ancho">
          <span>Balance del mes</span>
          <strong className={balance < 0 ? 'gasto' : 'ingreso'}>{pesos(balance)}</strong>
          {(recuadrosVariables.length > 0 || gastosPendientes > 0 || ingresosPendientes > 0) && (
            <small className="detalle-dato">
              {recuadrosVariables.length > 0 && <>Incluye la proyección de {recuadrosVariables.map((t) => t.fuente.nombre).join(' y ')}. Con lo ya registrado hasta hoy: {pesos(balanceRegistrado)}. </>}
              Mira la pestaña «Por pagar» para ver lo que falta y cuánto te quedaría.
            </small>
          )}
          {gastoPlaneadoPorGastar > 0 && (
            <small className="detalle-dato">
              Aún te falta gastar {pesos(gastoPlaneadoPorGastar)} de lo que planeaste por categoría. Si lo gastas todo, el balance sería{' '}
              {pesos(balance - gastoPlaneadoPorGastar)}.
            </small>
          )}
        </div>
      </div>

      <ResumenJornadas mes={mes} resumenes={trabajosVariables} />

      {(variableMes > 0 || promedio) && (
        <section className="tarjeta">
          <h2>Ingresos variables</h2>
          <p className="fila-dato">
            <span>Este mes</span>
            <strong className="ingreso">{pesos(variableMes)}</strong>
          </p>
          {promedio && (
            <p className="fila-dato">
              <span>Promedio mensual ({promedio.meses} {promedio.meses === 1 ? 'mes' : 'meses'})</span>
              <strong>{pesos(promedio.promedio)}</strong>
            </p>
          )}
          <p className="ayuda">Comisiones y trabajos por fuera. Úsalo como guía: no es un ingreso seguro.</p>
        </section>
      )}

      {filasCategoria.length > 0 && (
        <section className="tarjeta">
          <h2>Gastos por categoría</h2>
          {tajadas.length > 0 && <Dona tajadas={tajadas} centro={pesos(gastos)} />}
          <ul className="lista-categorias">
            {filasCategoria.map((f) => {
              const abierta = categoriaAbierta === f.id
              const sobre = f.tope !== undefined && f.gastado > f.tope
              const delaCategoria = movimientos.filter((m) => m.tipo === 'gasto' && m.categoriaId === f.id)
              return (
                <li key={f.id}>
                  <button className="fila-categoria" aria-expanded={abierta} onClick={() => setCategoriaAbierta(abierta ? null : f.id)}>
                    <span className="linea-categoria">
                      <i style={{ background: colorDe.get(f.id) ?? 'var(--borde)' }} aria-hidden="true" />
                      <span className="nombre-categoria">{f.icono} {f.nombre}</span>
                      <span className="porcentaje">{gastos > 0 ? Math.round((f.gastado / gastos) * 100) : 0}%</span>
                      <strong>{pesos(f.gastado)}</strong>
                    </span>
                    {f.tope !== undefined && (
                      <>
                        <span className="barra-tope" aria-hidden="true">
                          <i className={sobre ? 'sobre' : undefined} style={{ width: `${Math.min(100, (f.gastado / f.tope) * 100)}%` }} />
                        </span>
                        <small className={sobre ? 'texto-tope sobre' : 'texto-tope'}>
                          {sobre
                            ? `Planeado ${pesos(f.tope)} · te pasaste ${pesos(f.gastado - f.tope)}`
                            : `Planeado ${pesos(f.tope)} · te quedan ${pesos(f.tope - f.gastado)}`}
                        </small>
                      </>
                    )}
                  </button>
                  {abierta && (
                    <ul className="detalle-categoria">
                      {delaCategoria.length === 0 ? (
                        <li className="vacio">Todavía no hay gastos en esta categoría este mes.</li>
                      ) : (
                        delaCategoria.map((m) => (
                          <li key={m.id}>
                            <button onClick={() => setFormulario({ movimiento: m })}>
                              <span>
                                {m.nota || f.nombre}
                                <small>{fechaDia(m.fecha)}{estaPendiente(m, hoyTexto) ? ' · por pagar' : ''}</small>
                              </span>
                              <strong className="gasto">−{pesos(m.monto)}</strong>
                            </button>
                          </li>
                        ))
                      )}
                    </ul>
                  )}
                </li>
              )
            })}
          </ul>
        </section>
      )}

      {movimientos.length === 0 ? (
        <div className="tarjeta vacia">
          <p>Aún no hay movimientos en {nombreMes(mes).toLowerCase()}.</p>
          <p className="pequeno">Toca el botón + para registrar el primero.</p>
        </div>
      ) : (
        <>
          <ListaMovimientos
            tipo="gasto"
            movimientos={movimientos.filter((m) => m.tipo === 'gasto')}
            categorias={porId}
            hoy={hoyTexto}
            alAbrir={(movimiento) => setFormulario({ movimiento })}
          />
          <ListaMovimientos
            tipo="ingreso"
            movimientos={movimientos.filter((m) => m.tipo === 'ingreso')}
            categorias={porId}
            hoy={hoyTexto}
            alAbrir={(movimiento) => setFormulario({ movimiento })}
          />
        </>
      )}

      <button className="fab" onClick={() => setFormulario({})} aria-label="Agregar movimiento">+</button>

      {formulario && (
        <FormMovimiento
          movimiento={formulario.movimiento}
          mesActual={mes}
          alCerrar={() => setFormulario(null)}
        />
      )}
      {repitiendo && <RepetirFijos mes={mes} alCerrar={() => setRepitiendo(false)} />}
    </>
  )
}

function suma(lista: Movimiento[], tipo: Movimiento['tipo']): number {
  return lista.reduce((s, m) => (m.tipo === tipo ? s + m.monto : s), 0)
}
