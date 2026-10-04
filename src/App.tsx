import { useState } from 'react'
import { pesos } from './formato'

type Pestana = 'presupuesto' | 'ahorros' | 'deudas' | 'mas'

const PESTANAS: { id: Pestana; icono: string; nombre: string; texto: string }[] = [
  { id: 'presupuesto', icono: '💰', nombre: 'Presupuesto', texto: 'Aquí registrarás tus ingresos y gastos.' },
  { id: 'ahorros', icono: '🎯', nombre: 'Ahorros', texto: 'Aquí crearás tus metas de ahorro.' },
  { id: 'deudas', icono: '📉', nombre: 'Deudas', texto: 'Aquí armarás tu plan para pagar deudas.' },
  { id: 'mas', icono: '⚙️', nombre: 'Más', texto: 'Aquí estará la copia de seguridad.' },
]

export default function App() {
  const [activa, setActiva] = useState<Pestana>('presupuesto')
  const actual = PESTANAS.find((p) => p.id === activa)!

  return (
    <div className="app">
      <header className="encabezado">
        <h1>{actual.nombre}</h1>
      </header>

      <main className="contenido">
        <div className="tarjeta vacia">
          <p>{actual.texto}</p>
          <p className="pequeno">Prueba de formato: {pesos(1250000)}</p>
        </div>
      </main>

      <nav className="barra" aria-label="Secciones">
        {PESTANAS.map((p) => (
          <button
            key={p.id}
            className={p.id === activa ? 'activa' : ''}
            aria-current={p.id === activa ? 'page' : undefined}
            onClick={() => setActiva(p.id)}
          >
            <span className="icono" aria-hidden="true">{p.icono}</span>
            {p.nombre}
          </button>
        ))}
      </nav>
    </div>
  )
}
