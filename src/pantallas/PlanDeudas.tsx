import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type Ajuste, type Deuda, type PagoDeuda } from '../db'
import { calcularPlan, fechaCuota, guardarAjuste } from '../deudas'
import { fechaCorta, hoy, mesDe, moverMes, nombreMes } from '../fechas'
import { pesos } from '../formato'
import { usePromedioVariable } from '../ingresos'
import type { Estrategia, ResultadoPlan } from '../plan'
import CampoMonto from '../componentes/CampoMonto'
import GraficaSaldo from '../componentes/GraficaSaldo'
import FormPago from './FormPago'

const NOMBRES: Record<Estrategia, string> = { bola: 'Bola de nieve', avalancha: 'Avalancha' }
const COLORES: Record<Estrategia, string> = { bola: '#d97706', avalancha: 'var(--acento)' }
const MESES_MOSTRADOS = 120

interface Props {
  deudas: Deuda[]
  pagos: PagoDeuda[]
  alVolver: () => void
}

/** Carga las preferencias guardadas antes de dibujar, para que no parpadeen los valores. */
export default function PlanDeudas(props: Props) {
  const ajustes = useLiveQuery(() => db.ajustes.toArray())
  if (!ajustes) return null
  const extra = ajustes.find((a): a is Extract<Ajuste, { clave: 'deudaExtra' }> => a.clave === 'deudaExtra')
  const estrategia = ajustes.find((a): a is Extract<Ajuste, { clave: 'deudaEstrategia' }> => a.clave === 'deudaEstrategia')
  return <Contenido {...props} extraInicial={extra?.valor ?? 0} estrategiaInicial={estrategia?.valor} />
}

function Contenido({
  deudas,
  pagos,
  alVolver,
  extraInicial,
  estrategiaInicial,
}: Props & { extraInicial: number; estrategiaInicial?: Estrategia }) {
  const [extra, setExtra] = useState(extraInicial)
  const [elegida, setElegida] = useState<Estrategia | undefined>(estrategiaInicial)
  const [pagando, setPagando] = useState<{ deuda: Deuda; saldo: number; monto: number; fechaCuota?: string } | null>(null)
  const variables = usePromedioVariable(mesDe(hoy()))

  const pagosDe = (id: number) => pagos.filter((p) => p.deudaId === id)
  const { activas, bola, avalancha, recomendada, siguiendo, resultado } = useMemo(
    () => calcularPlan(deudas, pagos, extra, elegida),
    [deudas, pagos, extra, elegida],
  )

  const minimos = activas.reduce((s, d) => s + d.minimo, 0)
  const viable = bola.viable && avalancha.viable
  const nombreDeuda = (id: number) => deudas.find((d) => d.id === id)?.nombre ?? 'Deuda'

  function cambiarExtra(valor: number) {
    setExtra(valor)
    void guardarAjuste({ clave: 'deudaExtra', valor })
  }

  function elegir(estrategia: Estrategia) {
    setElegida(estrategia)
    void guardarAjuste({ clave: 'deudaEstrategia', valor: estrategia })
  }

  /** Fecha aproximada en que terminas: la cuota en que se salda la última deuda. */
  function fechaFinal(r: ResultadoPlan): string {
    const [idUltima, mesUltimo] = Object.entries(r.liquidada).sort((a, b) => b[1] - a[1])[0] ?? []
    const deuda = deudas.find((d) => d.id === Number(idUltima))
    const exacta = deuda && fechaCuota(deuda, pagosDe(deuda.id!), mesUltimo)
    return exacta ? fechaCorta(exacta) : nombreMes(moverMes(mesDe(hoy()), r.meses))
  }

  const problemas = activas.filter((d) => d.minimo <= Math.round(d.saldo * d.tm))

  return (
    <>
      <button className="volver" onClick={alVolver}>‹ Todas las deudas</button>

      <section className="tarjeta">
        <h2>Tu plan para salir de deudas</h2>
        <CampoMonto etiqueta="Dinero extra cada mes (opcional)" valor={extra} alCambiar={cambiarExtra} />
        <p className="ayuda">
          Además de tus pagos mínimos, que suman {pesos(minimos)}. Todo lo extra, y lo que se libera cuando terminas una
          deuda, se va a la siguiente.
          {variables && (
            <> Tus ingresos variables promedian {pesos(variables.promedio)} al mes: podrías destinar una parte.</>
          )}
        </p>
      </section>

      {!viable ? (
        <section className="tarjeta">
          <p className="alerta">
            ⚠️ Con estos pagos las deudas nunca se terminan: el interés es mayor que lo que pagas.
          </p>
          {problemas.length > 0 && (
            <p>
              Revisa: {problemas.map((d) => d.nombre).join(', ')}. Su pago mínimo no cubre el interés del mes. Sube el pago
              mínimo o agrega dinero extra.
            </p>
          )}
        </section>
      ) : (
        <>
          <Comparacion bola={bola} avalancha={avalancha} fechaFinal={fechaFinal} />

          <section className="tarjeta">
            <h2>Cuánto debes mes a mes</h2>
            <GraficaSaldo
              series={(['bola', 'avalancha'] as const).map((e) => {
                const r = e === 'bola' ? bola : avalancha
                return { nombre: NOMBRES[e], color: COLORES[e], valores: [activas.reduce((s, d) => s + d.saldo, 0), ...r.plan.map((m) => m.saldoTotal)] }
              })}
            />
            <ul className="leyenda">
              {(['bola', 'avalancha'] as const).map((e) => (
                <li key={e}>
                  <i style={{ background: COLORES[e] }} aria-hidden="true" />
                  <span>{NOMBRES[e]}</span>
                  <strong>{(e === 'bola' ? bola : avalancha).meses} meses</strong>
                </li>
              ))}
            </ul>
          </section>

          <section className="tarjeta">
            <h2>¿Cuál sigues?</h2>
            <div className="selector" role="group" aria-label="Método a seguir">
              {(['bola', 'avalancha'] as const).map((e) => (
                <button key={e} className={siguiendo === e ? 'sel ingreso' : ''} onClick={() => elegir(e)}>
                  {NOMBRES[e]}
                  {e === recomendada && <small className="recomendado">Recomendado</small>}
                </button>
              ))}
            </div>
            <p className="ayuda">
              {siguiendo === 'bola'
                ? 'Primero pagas la deuda más pequeña. Ves resultados rápido y te motivas, aunque pagues algo más de interés.'
                : 'Primero pagas la deuda con la tasa más alta. Es la forma de pagar menos intereses en total.'}
            </p>
          </section>

          <section>
            <h3 className="subtitulo">Tus próximos pagos ({NOMBRES[siguiendo]})</h3>
            <ul className="tarjeta lista">
              {(resultado.plan[0]?.lineas ?? []).map((l) => {
                const deuda = deudas.find((d) => d.id === l.deudaId)!
                const cuota = fechaCuota(deuda, pagosDe(deuda.id!))
                const saldo = activas.find((d) => d.id === l.deudaId)!.saldo
                const extraAqui = l.pago - deuda.pagoMinimo
                return (
                  <li key={l.deudaId}>
                    <div className="fila-pago">
                      <span className="texto-mov">
                        <span>{deuda.icono} {deuda.nombre}</span>
                        <small>
                          {cuota ? `${fechaCorta(cuota)} · ` : ''}
                          {extraAqui > 0 ? `incluye ${pesos(extraAqui)} extra` : 'pago mínimo'}
                        </small>
                      </span>
                      <strong>{pesos(l.pago)}</strong>
                      <button
                        className="boton-chico"
                        onClick={() => setPagando({ deuda, saldo, monto: l.pago, fechaCuota: cuota })}
                      >
                        Marcar pagado
                      </button>
                    </div>
                  </li>
                )
              })}
            </ul>
          </section>

          <details className="tarjeta detalle-plan">
            <summary>Plan mes a mes ({resultado.meses} meses)</summary>
            {resultado.plan.slice(0, MESES_MOSTRADOS).map((m) => (
              <div key={m.mes} className="mes-plan">
                <div className="mes-cabecera">
                  <strong>Mes {m.mes}</strong>
                  <span>pagas {pesos(m.pagoTotal)} · quedan {pesos(m.saldoTotal)}</span>
                </div>
                <ul>
                  {m.lineas.map((l) => (
                    <li key={l.deudaId}>
                      <span>{nombreDeuda(l.deudaId)}</span>
                      <span>
                        {pesos(l.pago)}
                        {l.saldoFinal === 0 && ' ✅ saldada'}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
            {resultado.plan.length > MESES_MOSTRADOS && (
              <p className="pequeno nota-pie">Se muestran los primeros {MESES_MOSTRADOS} meses.</p>
            )}
          </details>

          <details className="tarjeta">
            <summary>¿Cómo funcionan estos métodos?</summary>
            <p className="ayuda">
              <strong>Bola de nieve:</strong> pagas el mínimo de todas y mandas el dinero extra a la deuda más pequeña. Al
              saldarla, ese dinero pasa a la siguiente, y así la bola crece.
            </p>
            <p className="ayuda">
              <strong>Avalancha:</strong> igual, pero el dinero extra va a la deuda con la tasa de interés más alta. Casi
              siempre es la que menos intereses cuesta.
            </p>
            <p className="ayuda">
              Los cálculos son estimados: asumen que los intereses se suman una vez al mes sobre lo que debes. Tu banco puede
              calcularlos distinto por días o por comisiones.
            </p>
          </details>
        </>
      )}

      {pagando && (
        <FormPago
          deuda={pagando.deuda}
          saldo={pagando.saldo}
          montoSugerido={pagando.monto}
          fechaCuota={pagando.fechaCuota}
          alCerrar={() => setPagando(null)}
        />
      )}
    </>
  )
}

function Comparacion({
  bola,
  avalancha,
  fechaFinal,
}: {
  bola: ResultadoPlan
  avalancha: ResultadoPlan
  fechaFinal: (r: ResultadoPlan) => string
}) {
  const ahorro = bola.interesTotal - avalancha.interesTotal
  const mesesMenos = bola.meses - avalancha.meses
  const tarjeta = (e: Estrategia, r: ResultadoPlan, otra: ResultadoPlan) => (
    <div key={e} className={r.interesTotal < otra.interesTotal ? 'metodo recomendado-borde' : 'metodo'}>
      <h3>{NOMBRES[e]}</h3>
      {r.interesTotal < otra.interesTotal && <span className="insignia">Menos intereses</span>}
      {r.meses < otra.meses && <span className="insignia azul">Termina antes</span>}
      <dl>
        <dt>Terminas en</dt>
        <dd>{r.meses} meses</dd>
        <dt>Fecha aprox.</dt>
        <dd>{fechaFinal(r)}</dd>
        <dt>Intereses</dt>
        <dd>{pesos(r.interesTotal)}</dd>
        <dt>Total pagado</dt>
        <dd>{pesos(r.pagoTotal)}</dd>
      </dl>
    </div>
  )

  return (
    <section className="tarjeta">
      <h2>Bola de nieve vs. avalancha</h2>
      <div className="metodos">
        {tarjeta('bola', bola, avalancha)}
        {tarjeta('avalancha', avalancha, bola)}
      </div>
      <p className="veredicto">
        {ahorro > 0 ? (
          <>
            La avalancha te ahorra <strong>{pesos(ahorro)}</strong> en intereses
            {mesesMenos > 0 && <> y termina <strong>{mesesMenos} {mesesMenos === 1 ? 'mes' : 'meses'}</strong> antes</>}.
          </>
        ) : (
          <>Con tus deudas, los dos métodos cuestan lo mismo en intereses.</>
        )}
      </p>
    </section>
  )
}
