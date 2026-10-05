import { useState } from 'react'
import { db, type Aporte, type Meta } from '../db'
import {
  eliminarAporte,
  eliminarMeta,
  progresoCuotas,
  proximaCuotaAhorro,
  serieAcumulada,
  textoFrecuencia,
} from '../ahorros'
import { fechaCorta, hoy, mesesHasta } from '../fechas'
import { pesos } from '../formato'
import BarraProgreso from '../componentes/BarraProgreso'
import GraficaCrecimiento from '../componentes/GraficaCrecimiento'
import FormAporte from './FormAporte'
import FormMeta from './FormMeta'

type Hoja = { aporte?: Aporte } | 'meta' | null

export default function DetalleMeta({ meta, aportes, alVolver }: { meta: Meta; aportes: Aporte[]; alVolver: () => void }) {
  const [hoja, setHoja] = useState<Hoja>(null)

  const ahorrado = aportes.reduce((s, a) => s + a.monto, 0)
  const faltante = Math.max(0, meta.objetivo - ahorrado)
  const cumplida = ahorrado >= meta.objetivo
  const lista = [...aportes].sort((a, b) => b.fecha.localeCompare(a.fecha) || b.id! - a.id!)
  const puntos = serieAcumulada(aportes, meta.creada)
  const programa = meta.programa
  const cuotas = progresoCuotas(meta, aportes)
  const proxima = proximaCuotaAhorro(meta, aportes)

  async function quitarOmision(aporte: Aporte) {
    if (window.confirm('¿Quitar esta omisión? La cuota volverá a proponerse en Presupuesto.')) await eliminarAporte(aporte)
  }

  async function borrar() {
    if (!window.confirm(`¿Eliminar la meta "${meta.nombre}" y todos sus aportes? Los gastos que ya contaron en el Presupuesto se conservan.`)) return
    await eliminarMeta(meta.id!)
    alVolver()
  }

  return (
    <>
      <button className="volver" onClick={alVolver}>‹ Todas las metas</button>

      <section className="tarjeta">
        <div className="meta-titulo">
          <span className="icono-meta" aria-hidden="true">{meta.icono}</span>
          <div>
            <h2>{meta.nombre}</h2>
            <span className="etiqueta">{meta.tipo === 'inversion' ? 'Inversión' : 'Gasto programado'}{meta.archivada ? ' · Cerrada' : ''}</span>
          </div>
        </div>
        <BarraProgreso ahorrado={ahorrado} objetivo={meta.objetivo} />
        {cumplida ? (
          <p className="mensaje ok">¡Meta cumplida! 🎉</p>
        ) : (
          <p className="faltante">
            Faltan <strong>{pesos(faltante)}</strong>
            {meta.fechaMeta && !programa && <> · {textoPlazo(meta.fechaMeta, faltante)}</>}
          </p>
        )}
        {programa && (
          <div className="programa-info">
            <p>
              <strong>Ahorro programado:</strong> {pesos(programa.cuota)} {textoFrecuencia(programa)}
              {meta.fechaMeta && <>, hasta el {fechaCorta(meta.fechaMeta)}</>}.
            </p>
            {cuotas && (
              <p>
                Cuotas registradas: <strong>{cuotas.hechas} de {cuotas.total}</strong>. Al terminar habrás ahorrado{' '}
                <strong>{pesos(meta.objetivo)}</strong>, sin intereses.
              </p>
            )}
            {proxima && (
              <p>
                {proxima <= hoy() ? 'Cuota pendiente' : 'Próxima cuota'}: <strong>{fechaCorta(proxima)}</strong>
              </p>
            )}
          </div>
        )}
        {!meta.archivada && (
          <button className="boton primario" onClick={() => setHoja({})}>+ Aportar</button>
        )}
      </section>

      {puntos.length > 0 && (
        <section className="tarjeta">
          <h2>Cómo va creciendo</h2>
          <GraficaCrecimiento puntos={puntos} objetivo={meta.objetivo} hasta={meta.archivada ? undefined : meta.fechaMeta} />
        </section>
      )}

      <section>
        <h3 className="subtitulo">Aportes</h3>
        {lista.length === 0 ? (
          <div className="tarjeta vacia">
            <p>Aún no hay aportes.</p>
            <p className="pequeno">Toca “Aportar” para registrar el primero.</p>
          </div>
        ) : (
          <ul className="tarjeta lista">
            {lista.map((a) =>
              a.omitida ? (
                <li key={a.id}>
                  <button onClick={() => quitarOmision(a)} aria-label="Cuota omitida, toca para quitar la omisión">
                    <span className="texto-mov">
                      <span>Cuota del {fechaCorta(a.fechaCuota ?? a.fecha)}</span>
                      <small>Omitida: no se registró aporte</small>
                    </span>
                    <strong className="etiqueta">Omitida</strong>
                  </button>
                </li>
              ) : (
                <li key={a.id}>
                  <button onClick={() => setHoja({ aporte: a })}>
                    <span className="texto-mov">
                      <span>{fechaCorta(a.fecha)}</span>
                      {a.nota && <small>{a.nota}</small>}
                    </span>
                    <strong className="ingreso">+{pesos(a.monto)}</strong>
                  </button>
                </li>
              ),
            )}
          </ul>
        )}
      </section>

      <div className="acciones-meta">
        <button className="boton secundario" onClick={() => setHoja('meta')}>Editar meta</button>
        <button className="boton secundario" onClick={() => db.metas.update(meta.id!, { archivada: !meta.archivada })}>
          {meta.archivada ? 'Reabrir meta' : 'Cerrar meta'}
        </button>
        <button className="boton peligro" onClick={borrar}>Eliminar meta</button>
      </div>

      {hoja === 'meta' && <FormMeta meta={meta} alCerrar={() => setHoja(null)} />}
      {hoja !== null && hoja !== 'meta' && (
        <FormAporte meta={meta} aporte={hoja.aporte} alCerrar={() => setHoja(null)} />
      )}
    </>
  )
}

function textoPlazo(fechaMeta: string, faltante: number): string {
  if (fechaMeta <= hoy()) return `la fecha (${fechaCorta(fechaMeta)}) ya pasó`
  const meses = mesesHasta(fechaMeta)
  const cuota = Math.ceil(faltante / meses)
  return `para el ${fechaCorta(fechaMeta)} aporta ${pesos(cuota)} al mes`
}
