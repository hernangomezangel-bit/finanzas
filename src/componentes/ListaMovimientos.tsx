import type { Categoria, Movimiento, Tipo } from '../db'
import { fechaDia } from '../fechas'
import { pesos } from '../formato'
import { estaPendiente } from '../programadosPuro'

/** Lo que dice la etiqueta de un movimiento que todavía no ocurre; nada si ya pasó. */
function etiquetaPendiente(m: Movimiento, hoy: string): string | null {
  if (!estaPendiente(m, hoy)) return null
  if (m.fecha > hoy) return m.tipo === 'gasto' ? 'Por pagar' : 'Por recibir'
  return 'Por confirmar'
}

/**
 * Todos los gastos (o todos los ingresos) del mes en una sola lista, con el total arriba. Cada fila lleva el nombre, la
 * fecha y la categoría juntos, y una etiqueta si todavía no se ha pagado o recibido.
 */
export default function ListaMovimientos({
  tipo,
  movimientos,
  categorias,
  hoy,
  alAbrir,
}: {
  tipo: Tipo
  movimientos: Movimiento[]
  categorias: Map<number, Categoria>
  hoy: string
  alAbrir: (movimiento: Movimiento) => void
}) {
  if (movimientos.length === 0) return null
  const total = movimientos.reduce((suma, m) => suma + m.monto, 0)
  const signo = tipo === 'gasto' ? '−' : '+'
  const titulo = tipo === 'gasto' ? 'Gastos' : 'Ingresos'

  return (
    <section className="bloque-mov">
      <header className="bloque-cabecera">
        <h3>
          {titulo} <span className="contador">{movimientos.length}</span>
        </h3>
        <strong className={tipo}>{signo}{pesos(total)}</strong>
      </header>
      <ul>
        {movimientos.map((m) => {
          const categoria = categorias.get(m.categoriaId)
          const nombreCategoria = categoria?.nombre ?? 'Sin categoría'
          const etiqueta = etiquetaPendiente(m, hoy)
          return (
            <li key={m.id}>
              <button className={etiqueta ? 'fila-mov pendiente' : 'fila-mov'} onClick={() => alAbrir(m)}>
                <span className={`burbuja ${tipo}`} aria-hidden="true">{categoria?.icono ?? '🧾'}</span>
                <span className="datos-mov">
                  <span className="nombre-mov">{m.nota || nombreCategoria}</span>
                  <small>
                    {fechaDia(m.fecha)}
                    {m.nota && ` · ${nombreCategoria}`}
                  </small>
                  {etiqueta && <span className="pildora">{etiqueta}</span>}
                </span>
                <strong className={`monto-mov ${tipo}`}>{signo}{pesos(m.monto)}</strong>
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
