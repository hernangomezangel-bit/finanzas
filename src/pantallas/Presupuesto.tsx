import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type Movimiento } from '../db'
import { pesos } from '../formato'
import { hoy, mesDe, moverMes, nombreDia, nombreMes } from '../fechas'
import AvisoRespaldo from '../componentes/AvisoRespaldo'
import Dona, { type Tajada } from '../componentes/Dona'
import FormMovimiento from './FormMovimiento'

const COLORES = ['#0f766e', '#d97706', '#2563eb', '#be185d', '#7c3aed', '#65a30d', '#dc2626', '#0891b2', '#a16207', '#64748b']

type Formulario = { movimiento?: Movimiento } | null

export default function Presupuesto({ irARespaldo }: { irARespaldo: () => void }) {
  const [mes, setMes] = useState(mesDe(hoy()))
  const [formulario, setFormulario] = useState<Formulario>(null)

  const movimientos = useLiveQuery(
    () => db.movimientos.where('fecha').between(`${mes}-01`, `${mes}-32`).reverse().sortBy('fecha'),
    [mes],
  )
  const categorias = useLiveQuery(() => db.categorias.toArray())

  if (!movimientos || !categorias) return null

  const porId = new Map(categorias.map((c) => [c.id!, c]))
  const ingresos = suma(movimientos, 'ingreso')
  const gastos = suma(movimientos, 'gasto')

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

  const balance = ingresos - gastos

  return (
    <>
      <AvisoRespaldo alIr={irARespaldo} />

      <div className="selector-mes">
        <button onClick={() => setMes(moverMes(mes, -1))} aria-label="Mes anterior">‹</button>
        <strong>{nombreMes(mes)}</strong>
        <button onClick={() => setMes(moverMes(mes, 1))} aria-label="Mes siguiente">›</button>
      </div>

      <div className="resumen">
        <div className="tarjeta dato">
          <span>Ingresos</span>
          <strong className="ingreso">{pesos(ingresos)}</strong>
        </div>
        <div className="tarjeta dato">
          <span>Gastos</span>
          <strong className="gasto">{pesos(gastos)}</strong>
        </div>
        <div className="tarjeta dato ancho">
          <span>Balance del mes</span>
          <strong className={balance < 0 ? 'gasto' : 'ingreso'}>{pesos(balance)}</strong>
        </div>
      </div>

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
