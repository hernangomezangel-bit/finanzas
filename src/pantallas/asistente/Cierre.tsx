import { useEffect, useRef, useState } from 'react'
import { borrarBorrador, CLAVE_FIN_02 } from '../../asistente/borrador'
import { crearPresupuestoTico } from '../../asistente/crear'
import { gastosContados } from '../../asistente/gastos'
import { cuandoVence } from '../../avisos'
import { mensaje, monto, rellenar } from '../../asistente/mensajes'
import { planDelPresupuesto, type PlanPresupuesto } from '../../asistente/presupuesto'
import { ETIQUETAS, MENSAJES, OPCIONES_ANTICIPACION, OPCIONES_FIJOS } from '../../asistente/textos'
import { hoy } from '../../fechas'
import { GloboTico } from '../../componentes/Tico'
import type { PropsPantalla } from './tipos'

/** Paso 8 · ¿Quieres recordatorios de tus pagos fijos? */
export function RecordatorioPregunta({ borrador, cambiar, ir }: PropsPantalla) {
  return (
    <>
      <GloboTico mensaje={mensaje('REC_01')} />
      <div className="respuesta-tico">
        <button
          className={borrador.recordatorio?.activo === true ? 'opcion-tico elegida' : 'opcion-tico'}
          onClick={() => {
            cambiar((previo) => ({ recordatorio: { activo: true, diasAntes: previo.recordatorio?.diasAntes ?? 1 } }))
            ir('REC_CUANDO')
          }}
        >
          {ETIQUETAS.si}
        </button>
        <button
          className={borrador.recordatorio?.activo === false ? 'opcion-tico elegida' : 'opcion-tico'}
          onClick={() => {
            cambiar((previo) => ({ recordatorio: { activo: false, diasAntes: previo.recordatorio?.diasAntes ?? 1 } }))
            ir('FIN')
          }}
        >
          {ETIQUETAS.no}
        </button>
      </div>
    </>
  )
}

/** Paso 8 · ¿Con cuánta anticipación te aviso? */
export function RecordatorioCuando({ borrador, cambiar, ir }: PropsPantalla) {
  const elegida = borrador.recordatorio?.activo ? borrador.recordatorio.diasAntes : null
  // Un ejemplo con el primer gasto fijo que tiene día de pago, para ver cómo llegará el aviso.
  const ejemplo = gastosContados(borrador.fijos, OPCIONES_FIJOS).find((g) => g.dia !== null)
  const cuando = elegida ?? 1
  return (
    <>
      <GloboTico mensaje={mensaje('REC_02')} />
      <div className="respuesta-tico">
        {OPCIONES_ANTICIPACION.map((o) => (
          <button
            key={o.dias}
            className={elegida === o.dias ? 'opcion-tico elegida' : 'opcion-tico'}
            onClick={() => {
              cambiar({ recordatorio: { activo: true, diasAntes: o.dias } })
              ir('FIN')
            }}
          >
            {o.etiqueta}
          </button>
        ))}
        {ejemplo && (
          <p className="ejemplo-aviso">
            <small>Así te llegará:</small>
            {rellenar(MENSAJES.REC_03.texto, {
              cuando: cuandoVence(cuando),
              categoria: ejemplo.etiqueta.charAt(0).toLowerCase() + ejemplo.etiqueta.slice(1),
              monto: monto(ejemplo.monto),
            })}
          </p>
        )}
      </div>
    </>
  )
}

/** Lo que se creó, en pocas palabras. */
function Creado({ plan }: { plan: PlanPresupuesto }) {
  const lineas = [
    plan.ingresos.length > 0 && `${plan.ingresos.length} ${plan.ingresos.length === 1 ? 'ingreso fijo' : 'ingresos fijos'}`,
    plan.fuentes.length > 0 && `${plan.fuentes.length} ${plan.fuentes.length === 1 ? 'trabajo por días' : 'trabajos por días'} con meta diaria`,
    plan.fijos.length > 0 && `${plan.fijos.length} ${plan.fijos.length === 1 ? 'gasto fijo' : 'gastos fijos'}`,
    plan.topes.length > 0 && `${plan.topes.length} ${plan.topes.length === 1 ? 'límite mensual' : 'límites mensuales'} por categoría`,
    plan.metas.length > 0 && `${plan.metas.length} ${plan.metas.length === 1 ? 'meta de ahorro' : 'metas de ahorro'}`,
  ].filter(Boolean)
  return lineas.length === 0 ? null : (
    <ul className="resumen-tico">
      {lineas.map((l) => (
        <li key={String(l)}>
          <span>✓ {l}</span>
        </li>
      ))}
    </ul>
  )
}

/** Paso 9 · Crea el presupuesto de verdad y se despide. */
export function Fin({ borrador, verPresupuesto }: PropsPantalla) {
  const [estado, setEstado] = useState<'creando' | 'listo' | 'error'>('creando')
  const [intento, setIntento] = useState(0)
  const [plan, setPlan] = useState<PlanPresupuesto | null>(null)
  const ultimoIntento = useRef(-1)

  useEffect(() => {
    // Una sola vez por intento (en desarrollo React ejecuta los efectos dos veces).
    if (ultimoIntento.current === intento) return
    ultimoIntento.current = intento
    const nuevo = planDelPresupuesto(borrador, hoy())
    const avisos = borrador.recordatorio?.activo ? { diasAntes: borrador.recordatorio.diasAntes } : null
    crearPresupuestoTico(nuevo, avisos)
      .then(() => {
        setPlan(nuevo)
        try {
          localStorage.setItem(CLAVE_FIN_02, 'pendiente')
        } catch {
          // Sin permiso para guardar: simplemente no se muestra la explicación de Presupuesto.
        }
        borrarBorrador()
        setEstado('listo')
      })
      .catch(() => setEstado('error'))
  }, [intento, borrador])

  if (estado === 'creando') return <GloboTico mensaje={mensaje('FIN_00')} />
  if (estado === 'error') {
    return (
      <>
        <GloboTico mensaje={mensaje('FIN_ERR')} />
        <div className="respuesta-tico">
          <button
            className="boton primario"
            onClick={() => {
              setEstado('creando')
              setIntento(intento + 1)
            }}
          >
            {ETIQUETAS.reintentar}
          </button>
        </div>
      </>
    )
  }
  return (
    <>
      <GloboTico mensaje={mensaje('FIN_01')} />
      <div className="respuesta-tico">
        {plan && <Creado plan={plan} />}
        <button className="boton primario" onClick={verPresupuesto}>{ETIQUETAS.verPresupuesto}</button>
      </div>
    </>
  )
}
