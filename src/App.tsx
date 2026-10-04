import { useState } from 'react'
import Presupuesto from './pantallas/Presupuesto'
import Categorias from './pantallas/Categorias'

type Pestana = 'presupuesto' | 'ahorros' | 'deudas' | 'mas'

const PESTANAS: { id: Pestana; icono: string; nombre: string }[] = [
  { id: 'presupuesto', icono: '💰', nombre: 'Presupuesto' },
  { id: 'ahorros', icono: '🎯', nombre: 'Ahorros' },
  { id: 'deudas', icono: '📉', nombre: 'Deudas' },
  { id: 'mas', icono: '⚙️', nombre: 'Más' },
]

const PROXIMAMENTE: Partial<Record<Pestana, string>> = {
  ahorros: 'Aquí crearás tus metas de ahorro. Llega en una fase próxima.',
  deudas: 'Aquí armarás tu plan para pagar deudas. Llega en una fase próxima.',
}

export default function App() {
  const [activa, setActiva] = useState<Pestana>('presupuesto')
  const actual = PESTANAS.find((p) => p.id === activa)!

  return (
    <div className="app">
      <header className="encabezado">
        <h1>{actual.nombre}</h1>
      </header>

      <main className="contenido">
        {activa === 'presupuesto' && <Presupuesto />}
        {activa === 'mas' && <Categorias />}
        {PROXIMAMENTE[activa] && (
          <div className="tarjeta vacia">
            <p>{PROXIMAMENTE[activa]}</p>
          </div>
        )}
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
