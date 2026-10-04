import { metaDelMes } from '../diario'
import { pesos } from '../formato'
import { useResumenesJornadas } from '../fuentes'
import BarraProgreso from './BarraProgreso'

/** Cómo va el mes en cada trabajo con meta diaria: ganado, promedio frente a la meta y la semana. */
export default function ResumenJornadas({ mes }: { mes: string }) {
  const resumenes = useResumenesJornadas(mes)
  if (!resumenes) return null

  return (
    <>
      {resumenes
        .filter(({ resumen }) => resumen.trabajados > 0 || resumen.descansos > 0)
        .map(({ fuente, resumen }) => {
          const metaMes = metaDelMes(mes, fuente.metaDiaria, fuente.diasLibres)
          return (
          <section key={fuente.id} className="tarjeta">
            <h2>{fuente.nombre} este mes</h2>
            <p className="fila-dato">
              <span>Ganado ({resumen.trabajados} {resumen.trabajados === 1 ? 'día trabajado' : 'días trabajados'})</span>
              <strong className="ingreso">{pesos(resumen.ganado)}</strong>
            </p>
            <p className="fila-dato">
              <span>Si cumples tu meta todos los días ({metaMes.dias} días)</span>
              <strong>{pesos(metaMes.total)}</strong>
            </p>
            <div className="meta-mes">
              <BarraProgreso ahorrado={Math.min(resumen.ganado, metaMes.total)} objetivo={metaMes.total} etiqueta="de la meta del mes" />
            </div>
            <p className={resumen.ganado >= metaMes.total ? 'frente-meta arriba' : 'frente-meta falta'}>
              {resumen.ganado >= metaMes.total
                ? '¡Meta del mes cumplida! 🎉'
                : `Te faltan ${pesos(metaMes.total - resumen.ganado)} para tu meta del mes`}
            </p>
            {resumen.promedio !== null && (
              <p className="fila-dato">
                <span>Promedio por día trabajado</span>
                <strong>{pesos(resumen.promedio)}</strong>
              </p>
            )}
            {resumen.frenteAMeta !== null && (
              <p className={resumen.frenteAMeta >= 0 ? 'frente-meta arriba' : 'frente-meta abajo'}>
                {resumen.frenteAMeta === 0
                  ? `Justo en tu meta de ${pesos(fuente.metaDiaria)} por día`
                  : resumen.frenteAMeta > 0
                    ? `${pesos(resumen.frenteAMeta)} por encima de tu meta de ${pesos(fuente.metaDiaria)} por día`
                    : `${pesos(-resumen.frenteAMeta)} por debajo de tu meta de ${pesos(fuente.metaDiaria)} por día`}
              </p>
            )}
            {resumen.semana !== null && (
              <p className="fila-dato">
                <span>Esta semana</span>
                <strong>{pesos(resumen.semana)}</strong>
              </p>
            )}
            <p className="fila-dato">
              <span>Días de descanso</span>
              <strong>{resumen.descansos}</strong>
            </p>
          </section>
          )
        })}
    </>
  )
}
