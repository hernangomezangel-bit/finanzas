import { useEffect, useRef, useState, type ComponentType } from 'react'
import { borradorNuevo, guardarBorrador, leerBorrador, PASO_DE, type Borrador, type Pantalla } from '../asistente/borrador'
import { ETIQUETAS, NOMBRES_PASO } from '../asistente/textos'
import { Bienvenida, ParaQuien, ParaQuienFamilia } from './asistente/Inicio'
import {
  IngresoConsejo,
  IngresoFrecuencia,
  IngresoMonto,
  IngresoOtro,
  IngresoQuien,
  IngresoTipo,
  IngresoTotal,
  IngresoVariable,
  Pronto,
} from './asistente/Ingresos'
import type { PropsPantalla } from './asistente/tipos'

const PASOS_TOTAL = NOMBRES_PASO.length

const PANTALLAS: Record<Pantalla, ComponentType<PropsPantalla>> = {
  BIE: Bienvenida,
  QUI: ParaQuien,
  QUI_FAM: ParaQuienFamilia,
  ING_TIPO: IngresoTipo,
  ING_MONTO: IngresoMonto,
  ING_FREC: IngresoFrecuencia,
  ING_QUIEN: IngresoQuien,
  ING_VAR: IngresoVariable,
  ING_CONSEJO: IngresoConsejo,
  ING_OTRO: IngresoOtro,
  ING_TOTAL: IngresoTotal,
  PRONTO: Pronto,
}

/**
 * El asistente de Tico: una pregunta por pantalla, con barra de progreso, botón para volver atrás y «Saltar asistente»
 * siempre a la vista. El progreso se guarda en cada respuesta, así que se puede salir y retomar.
 */
export default function Asistente({ alCerrar }: { alCerrar: () => void }) {
  const [borrador, setBorrador] = useState<Borrador>(() => leerBorrador() ?? borradorNuevo())
  const cuerpo = useRef<HTMLDivElement>(null)

  useEffect(() => {
    guardarBorrador(borrador)
  }, [borrador])
  // Cada pantalla nueva empieza arriba.
  useEffect(() => {
    cuerpo.current?.scrollTo(0, 0)
  }, [borrador.pantalla])

  // Los cambios se aplican sobre el borrador más reciente, para poder encadenar varios en una misma respuesta.
  const actualizar = (cambio: (previo: Borrador) => Partial<Borrador>) => setBorrador((previo) => ({ ...previo, ...cambio(previo) }))

  const props: PropsPantalla = {
    borrador,
    cambiar: (cambio) => actualizar(() => cambio),
    editarIngreso: (cambio) =>
      actualizar((previo) => ({
        ingresos: previo.ingresos.map((ingreso, i) => (i === previo.indice ? { ...ingreso, ...cambio } : ingreso)),
      })),
    nuevoIngreso: () =>
      actualizar((previo) =>
        // Si ya había empezado el siguiente (y volvió atrás), lo retoma en vez de crear otro.
        previo.indice + 1 < previo.ingresos.length
          ? { indice: previo.indice + 1 }
          : { ingresos: [...previo.ingresos, {}], indice: previo.indice + 1 },
      ),
    ir: (pantalla) => actualizar((previo) => ({ historial: [...previo.historial, previo.pantalla], pantalla })),
    cerrar: alCerrar,
  }

  function atras() {
    actualizar((previo) => {
      const anterior = previo.historial[previo.historial.length - 1]
      if (!anterior) return {}
      const cambio: Partial<Borrador> = { pantalla: anterior, historial: previo.historial.slice(0, -1) }
      // Si vuelve desde el principio de un ingreso nuevo, regresa al ingreso anterior. Lo que ya había escrito en el
      // nuevo se conserva: si vuelve a decir que tiene otro ingreso, lo retoma.
      if (previo.pantalla === 'ING_TIPO' && previo.indice > 0 && anterior === 'ING_OTRO') cambio.indice = previo.indice - 1
      return cambio
    })
  }

  const paso = PASO_DE[borrador.pantalla]
  const Pantalla = PANTALLAS[borrador.pantalla]

  return (
    <div className="asistente" role="dialog" aria-label="Asistente Tico">
      <header className="asistente-cabecera">
        <button className="asistente-atras" onClick={atras} disabled={borrador.historial.length === 0} aria-label={ETIQUETAS.atras}>
          ‹
        </button>
        <div className="asistente-progreso">
          <div
            className="progreso-tico"
            role="progressbar"
            aria-valuemin={1}
            aria-valuemax={PASOS_TOTAL}
            aria-valuenow={paso}
            aria-label={NOMBRES_PASO[paso - 1]}
          >
            <i style={{ width: `${(paso / PASOS_TOTAL) * 100}%` }} />
          </div>
          <small>
            {ETIQUETAS.pasoDe.replace('{paso}', String(paso)).replace('{total}', String(PASOS_TOTAL))} · {NOMBRES_PASO[paso - 1]}
          </small>
        </div>
        <button className="asistente-saltar" onClick={alCerrar}>{ETIQUETAS.saltar}</button>
      </header>
      <div className="asistente-cuerpo" ref={cuerpo}>
        <Pantalla {...props} />
      </div>
    </div>
  )
}
