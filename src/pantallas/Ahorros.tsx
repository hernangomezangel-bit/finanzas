import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type Aporte, type Meta } from '../db'
import { pesos } from '../formato'
import BarraProgreso from '../componentes/BarraProgreso'
import { serieAcumulada, textoFrecuencia } from '../ahorros'
import GraficaCrecimiento from '../componentes/GraficaCrecimiento'
import DetalleMeta from './DetalleMeta'
import FormMeta from './FormMeta'

export default function Ahorros() {
  const metas = useLiveQuery(() => db.metas.toArray())
  const aportes = useLiveQuery(() => db.aportes.toArray())
  const [abierta, setAbierta] = useState<number | null>(null)
  const [creando, setCreando] = useState(false)

  if (!metas || !aportes) return null

  const aportesDe = (id: number) => aportes.filter((a) => a.metaId === id)
  const abiertaMeta = abierta !== null ? metas.find((m) => m.id === abierta) : undefined
  if (abiertaMeta) {
    return <DetalleMeta meta={abiertaMeta} aportes={aportesDe(abiertaMeta.id!)} alVolver={() => setAbierta(null)} />
  }

  const activas = metas.filter((m) => !m.archivada)
  const cerradas = metas.filter((m) => m.archivada)
  const totalAhorrado = sumar(activas.flatMap((m) => aportesDe(m.id!)))
  const totalObjetivo = activas.reduce((s, m) => s + m.objetivo, 0)
  const aportesActivos = activas.flatMap((m) => aportesDe(m.id!))
  const inicio = activas.map((m) => m.creada).sort()[0]
  const puntos = inicio ? serieAcumulada(aportesActivos, inicio) : []

  const tarjeta = (m: Meta) => (
    <li key={m.id}>
      <button className="tarjeta meta-tarjeta" onClick={() => setAbierta(m.id!)}>
        <div className="meta-titulo">
          <span className="icono-meta" aria-hidden="true">{m.icono}</span>
          <div>
            <strong>{m.nombre}</strong>
            <span className="etiqueta">
              {m.tipo === 'inversion' ? 'Inversión' : 'Gasto programado'}
              {m.programa && ` · ${pesos(m.programa.cuota)} ${textoFrecuencia(m.programa)}`}
            </span>
          </div>
        </div>
        <BarraProgreso ahorrado={sumar(aportesDe(m.id!))} objetivo={m.objetivo} />
      </button>
    </li>
  )

  return (
    <>
      {metas.length === 0 ? (
        <div className="tarjeta vacia">
          <p>Aún no tienes metas de ahorro.</p>
          <p className="pequeno">Crea una para un viaje, un gasto grande o una inversión, y ve cómo crece con cada aporte.</p>
        </div>
      ) : (
        <>
          {activas.length > 0 && (
            <section className="tarjeta">
              <span className="etiqueta-grande">Total ahorrado</span>
              <strong className="total-grande ingreso">{pesos(totalAhorrado)}</strong>
              <span className="pequeno">
                de {pesos(totalObjetivo)} en {activas.length} {activas.length === 1 ? 'meta' : 'metas'}
              </span>
              {puntos.length > 0 && <GraficaCrecimiento puntos={puntos} />}
            </section>
          )}
          <ul className="lista-metas">{activas.map(tarjeta)}</ul>
          {cerradas.length > 0 && (
            <details className="cerradas">
              <summary>Metas cerradas ({cerradas.length})</summary>
              <ul className="lista-metas">{cerradas.map(tarjeta)}</ul>
            </details>
          )}
        </>
      )}

      <button className="fab" onClick={() => setCreando(true)} aria-label="Crear meta">+</button>
      {creando && <FormMeta alCerrar={() => setCreando(false)} />}
    </>
  )
}

function sumar(aportes: Aporte[]): number {
  return aportes.reduce((s, a) => s + a.monto, 0)
}
