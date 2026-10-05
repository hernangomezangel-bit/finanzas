import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type Movimiento } from '../db'
import { pesos } from '../formato'
import { hoy, mesDe, moverMes, nombreDia, nombreMes } from '../fechas'
import { useResumenesJornadas } from '../fuentes'
import { usePromedioVariable } from '../ingresos'
import AvisoRespaldo from '../componentes/AvisoRespaldo'
import PendientesJornadas from '../componentes/PendientesJornadas'
import PorRegistrar from '../componentes/PorRegistrar'
import ResumenJornadas from '../componentes/ResumenJornadas'
import Dona, { type Tajada } from '../componentes/Dona'
import FormMovimiento from './FormMovimiento'

const COLORES = ['var(--acento)','#d97706', '#2563eb', '#be185d', '#7c3aed', '#65a30d', '#dc2626', '#0891b2', '#a16207', '#64748b']

type Formulario = { movimiento?: Movimiento } | null

export default function Presupuesto({ irARespaldo }: { irARespaldo: () => void }) {
  const [mes, setMes] = useState(mesDe(hoy()))
  const [formulario, setFormulario] = useState<Formulario>(null)

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
  const tajadas: Tajada[] = [...gastoPorCategoria]
    .sort((a, b) => b[1] - a[1])
    .map(([id, valor], i) => ({
      nombre: porId.get(id)?.nombre ?? 'Sin categoría',
      valor,
      color: COLORES[i % COLORES.length],
    }))

  const dias = new Map<string, Movimiento[]>()
  for (const m of movimientos) dias.set(m.fecha, [...(dias.get(m.fecha) ?? []), m])

  // Los gastos incluyen las cuotas programadas de deudas y ahorros (la app las crea sola). El balance suma, además,
  // la proyección de los trabajos por días (si cumples la meta). La proyección completa, con lo que falta por
  // recibir y por pagar de tus movimientos recurrentes, está en la pestaña «Por pagar».
  const balance = ingresos + proyectadoVariables - gastos
  const balanceRegistrado = ingresosRegistrados - gastos
  const programadosDelMes = movimientos.filter((m) => m.programado).reduce((s, m) => s + m.monto, 0)

  return (
    <>
      <AvisoRespaldo alIr={irARespaldo} />
      <PendientesJornadas />
      <PorRegistrar />

      <div className="selector-mes">
        <button onClick={() => setMes(moverMes(mes, -1))} aria-label="Mes anterior">‹</button>
        <strong>{nombreMes(mes)}</strong>
        <button onClick={() => setMes(moverMes(mes, 1))} aria-label="Mes siguiente">›</button>
      </div>

      <div className="resumen">
        <div className="tarjeta dato">
          <span>Ingresos</span>
          <strong className="ingreso">{pesos(ingresos)}</strong>
          {recuadrosVariables.length > 0 && (
            <small className="detalle-dato">Sin {recuadrosVariables.map((t) => t.fuente.nombre).join(' ni ')}</small>
          )}
        </div>
        <div className="tarjeta dato">
          <span>Gastos</span>
          <strong className="gasto">{pesos(gastos)}</strong>
          {programadosDelMes > 0 && (
            <small className="detalle-dato">Incluye {pesos(programadosDelMes)} programados</small>
          )}
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
          {(recuadrosVariables.length > 0 || programadosDelMes > 0) && (
            <small className="detalle-dato">
              {recuadrosVariables.length > 0 && <>Incluye la proyección de {recuadrosVariables.map((t) => t.fuente.nombre).join(' y ')}. Con lo ya registrado hasta hoy: {pesos(balanceRegistrado)}. </>}
              Mira la pestaña «Por pagar» para ver lo que falta y cuánto te quedaría.
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

      {tajadas.length > 0 && (
        <section className="tarjeta">
          <h2>Gastos por categoría</h2>
          <Dona tajadas={tajadas} centro={pesos(gastos)} />
          <ul className="leyenda">
            {tajadas.map((t) => (
              <li key={t.nombre}>
                <i style={{ background: t.color }} aria-hidden="true" />
                <span>{t.nombre}</span>
                <span className="porcentaje">{Math.round((t.valor / gastos) * 100)}%</span>
                <strong>{pesos(t.valor)}</strong>
              </li>
            ))}
          </ul>
        </section>
      )}

      {movimientos.length === 0 ? (
        <div className="tarjeta vacia">
          <p>Aún no hay movimientos en {nombreMes(mes).toLowerCase()}.</p>
          <p className="pequeno">Toca el botón + para registrar el primero.</p>
        </div>
      ) : (
        [...dias].map(([fecha, lista]) => (
          <section key={fecha} className="dia">
            <h3>{nombreDia(fecha)}</h3>
            <ul className="tarjeta lista">
              {lista.map((m) => {
                const cat = porId.get(m.categoriaId)
                return (
                  <li key={m.id}>
                    <button onClick={() => setFormulario({ movimiento: m })}>
                      <span className="icono-cat" aria-hidden="true">{cat?.icono ?? '🧾'}</span>
                      <span className="texto-mov">
                        <span>{cat?.nombre ?? 'Sin categoría'}</span>
                        {m.nota && <small>{m.nota}</small>}
                        {m.programado && <small className="programado">Programado · se confirma el día del pago</small>}
                      </span>
                      <strong className={m.tipo}>
                        {m.tipo === 'gasto' ? '−' : '+'}{pesos(m.monto)}
                      </strong>
                    </button>
                  </li>
                )
              })}
            </ul>
          </section>
        ))
      )}

      <button className="fab" onClick={() => setFormulario({})} aria-label="Agregar movimiento">+</button>

      {formulario && (
        <FormMovimiento
          movimiento={formulario.movimiento}
          mesActual={mes}
          alCerrar={() => setFormulario(null)}
        />
      )}
    </>
  )
}

function suma(lista: Movimiento[], tipo: Movimiento['tipo']): number {
  return lista.reduce((s, m) => (m.tipo === tipo ? s + m.monto : s), 0)
}
