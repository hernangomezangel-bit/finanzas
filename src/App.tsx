import { useEffect, useState } from 'react'
import { iniciarSincronizacion } from './programados'
import Presupuesto from './pantallas/Presupuesto'
import Ahorros from './pantallas/Ahorros'
import Categorias from './pantallas/Categorias'
import Deudas from './pantallas/Deudas'
import IngresosPorDia from './pantallas/IngresosPorDia'
import PorPagar from './pantallas/PorPagar'
import Recurrentes from './pantallas/Recurrentes'
import Respaldo from './pantallas/Respaldo'

type Pestana = 'presupuesto' | 'porpagar' | 'ahorros' | 'deudas' | 'mas'

const PESTANAS: { id: Pestana; icono: string; nombre: string }[] = [
  { id: 'presupuesto', icono: '💰', nombre: 'Presupuesto' },
  { id: 'porpagar', icono: '🧾', nombre: 'Por pagar' },
  { id: 'ahorros', icono: '🎯', nombre: 'Ahorros' },
  { id: 'deudas', icono: '📉', nombre: 'Deudas' },
  { id: 'mas', icono: '⚙️', nombre: 'Más' },
]

export default function App() {
  const [activa, setActiva] = useState<Pestana>('presupuesto')
  const actual = PESTANAS.find((p) => p.id === activa)!

  // Mantiene al día los gastos programados (cuotas de deudas y ahorros) mientras la app está abierta.
  useEffect(() => iniciarSincronizacion(), [])

  return (
    <div className="app">
      <header className="encabezado">
        <h1>{actual.nombre}</h1>
      </header>

      <main className="contenido">
        {activa === 'presupuesto' && <Presupuesto irARespaldo={() => setActiva('mas')} />}
        {activa === 'porpagar' && <PorPagar />}
        {activa === 'ahorros' && <Ahorros />}
        {activa === 'deudas' && <Deudas />}
        {activa === 'mas' && (
          <>
            <Respaldo />
            <IngresosPorDia />
            <Recurrentes />
            <Categorias />
          </>
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
