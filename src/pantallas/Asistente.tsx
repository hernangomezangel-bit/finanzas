import { useCallback, useEffect, useRef, useState, type ComponentType } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { borradorNuevo, borrarBorrador, guardarBorrador, leerBorrador, PASO_DE, type Borrador, type Pantalla } from '../asistente/borrador'
import { mensaje } from '../asistente/mensajes'
import { ETIQUETAS, NOMBRES_PASO } from '../asistente/textos'
import { db } from '../db'
import { GloboTico } from '../componentes/Tico'
import { AhorroCuota, AhorroLista, AhorroMeta, AhorroNose } from './asistente/Ahorro'
import { Fin, RecordatorioCuando, RecordatorioPregunta } from './asistente/Cierre'
import { GastosDia, GastosLista, GastosMonto, GastosTotal, VariablesSugiere } from './asistente/Gastos'
import { Bienvenida, ParaQuien, ParaQuienFamilia, Reemplazo } from './asistente/Inicio'
import {
  IngresoDiaLibres,
  IngresoDiaMeta,
  IngresoDiaNombre,
  IngresoConsejo,
  IngresoFrecuencia,
  IngresoMonto,
  IngresoOtro,
  IngresoQuien,
  IngresoTipo,
  IngresoTotal,
  IngresoVariable,
} from './asistente/Ingresos'
import { RevisionMeta, RevisionPiensa, RevisionResumen } from './asistente/Revision'
import type { PropsPantalla } from './asistente/tipos'

const PASOS_TOTAL = NOMBRES_PASO.length

const PANTALLAS: Record<Pantalla, ComponentType<PropsPantalla>> = {
  BIE: Bienvenida,
  REP: Reemplazo,
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
  ING_DIA_NOMBRE: IngresoDiaNombre,
  ING_DIA_META: IngresoDiaMeta,
  ING_DIA_LIBRES: IngresoDiaLibres,
  FIJ_LISTA: (p) => <GastosLista {...p} tipo="fijos" />,
  FIJ_MONTO: (p) => <GastosMonto {...p} tipo="fijos" />,
  FIJ_DIA: GastosDia,
  FIJ_TOTAL: (p) => <GastosTotal {...p} tipo="fijos" />,
  VAR_LISTA: (p) => <GastosLista {...p} tipo="variables" />,
  VAR_MONTO: (p) => <GastosMonto {...p} tipo="variables" />,
  VAR_SUGIERE: VariablesSugiere,
  VAR_TOTAL: (p) => <GastosTotal {...p} tipo="variables" />,
  AHO_LISTA: AhorroLista,
  AHO_META: AhorroMeta,
  AHO_CUOTA: AhorroCuota,
  AHO_NOSE: AhorroNose,
  REV_PIENSA: RevisionPiensa,
  REV_RESUMEN: RevisionResumen,
  REV_META: RevisionMeta,
  REC_PREGUNTA: RecordatorioPregunta,
  REC_CUANDO: RecordatorioCuando,
  FIN: Fin,
}

/** Pantallas donde salir no deja nada a medias: ahí «Saltar asistente» cierra sin preguntar. */
const SIN_PREGUNTA_AL_SALIR: Pantalla[] = ['BIE', 'REP', 'FIN']

/**
 * El asistente de Tico: una pregunta por pantalla, con barra de progreso, botón para volver atrás y «Saltar asistente»
 * siempre a la vista. El progreso se guarda en cada respuesta, así que se puede salir y retomar.
 */
export default function Asistente({ alCerrar, alVerPresupuesto }: { alCerrar: () => void; alVerPresupuesto: () => void }) {
  // Lo guardado de una vez anterior, si lo hay. Si ya había avanzado más allá de la bienvenida, primero se le pregunta.
  const [guardado] = useState(() => leerBorrador())
  const [borrador, setBorrador] = useState<Borrador>(() => guardado ?? borradorNuevo())
  const [retomando, setRetomando] = useState(() => guardado !== null && guardado.pantalla !== 'BIE')
  const [saliendo, setSaliendo] = useState(false)
  const cuerpo = useRef<HTMLDivElement>(null)
  const hayPresupuesto = useLiveQuery(async () => (await db.ajustes.get('asistentePresupuesto')) !== undefined) ?? false

  useEffect(() => {
    guardarBorrador(borrador)
  }, [borrador])
  // Cada pantalla nueva empieza arriba.
  useEffect(() => {
    cuerpo.current?.scrollTo(0, 0)
  }, [borrador.pantalla, retomando])

  // Los cambios se aplican sobre el borrador más reciente, para poder encadenar varios en una misma respuesta.
  const actualizar = (cambio: (previo: Borrador) => Partial<Borrador>) => setBorrador((previo) => ({ ...previo, ...cambio(previo) }))

  function volver() {
    actualizar((previo) => {
      const anterior = previo.historial[previo.historial.length - 1]
      if (!anterior) return {}
      const cambio: Partial<Borrador> = {
        pantalla: anterior,
        historial: previo.historial.slice(0, -1),
        posiciones: previo.posiciones.slice(0, -1),
        // Vuelve a la pregunta de la lista en la que iba en esa pantalla.
        posicion: previo.posiciones[previo.posiciones.length - 1] ?? 0,
      }
      // Si vuelve desde el principio de un ingreso nuevo, regresa al ingreso anterior. Lo que ya había escrito en el
      // nuevo se conserva: si vuelve a decir que tiene otro ingreso, lo retoma.
      if (previo.pantalla === 'ING_TIPO' && previo.indice > 0 && anterior === 'ING_OTRO') cambio.indice = previo.indice - 1
      return cambio
    })
  }

  // Estas dos no cambian entre dibujos, para que las pantallas que las usan en un efecto no se reinicien.
  const cambiar = useCallback<PropsPantalla['cambiar']>(
    (cambio) => setBorrador((previo) => ({ ...previo, ...(typeof cambio === 'function' ? cambio(previo) : cambio) })),
    [],
  )
  const reemplazar = useCallback((pantalla: Pantalla) => setBorrador((previo) => ({ ...previo, pantalla })), [])

  const props: PropsPantalla = {
    borrador,
    cambiar,
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
    ir: (pantalla, posicion) =>
      actualizar((previo) => ({
        historial: [...previo.historial, previo.pantalla],
        posiciones: [...previo.posiciones, previo.posicion],
        pantalla,
        ...(posicion !== undefined ? { posicion } : {}),
      })),
    reemplazar,
    volver,
    hayPresupuesto,
    cerrar: alCerrar,
    verPresupuesto: alVerPresupuesto,
  }

  const paso = PASO_DE[borrador.pantalla]
  const Pantalla = PANTALLAS[borrador.pantalla]

  function saltar() {
    // Si ya respondió algo, antes de salir se pregunta si se guarda lo que lleva.
    if (SIN_PREGUNTA_AL_SALIR.includes(borrador.pantalla) || retomando) return alCerrar()
    setSaliendo(true)
  }

  return (
    <div className="asistente" role="dialog" aria-label="Asistente Tico">
      <header className="asistente-cabecera">
        <button className="asistente-atras" onClick={volver} disabled={retomando || borrador.historial.length === 0} aria-label={ETIQUETAS.atras}>
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
        <button className="asistente-saltar" onClick={saltar}>{ETIQUETAS.saltar}</button>
      </header>
      <div className="asistente-cuerpo" ref={cuerpo}>
        {retomando ? (
          <>
            {/* RET_01: al volver a abrir un asistente sin terminar, se ofrece seguir o empezar de nuevo. */}
            <GloboTico mensaje={mensaje('RET_01', { nombre_paso: NOMBRES_PASO[paso - 1] })} />
            <div className="respuesta-tico">
              <button className="boton primario" onClick={() => setRetomando(false)}>{ETIQUETAS.seguir}</button>
              <button
                className="boton secundario"
                onClick={() => {
                  borrarBorrador()
                  setBorrador(borradorNuevo())
                  setRetomando(false)
                }}
              >
                {ETIQUETAS.empezarDeNuevo}
              </button>
            </div>
          </>
        ) : (
          <Pantalla {...props} />
        )}
      </div>
      {saliendo && (
        <div className="asistente-modal" role="alertdialog" aria-label="Guardar y salir">
          <div className="asistente-modal-caja">
            {/* SAL_01: al cerrar a mitad del flujo. Lo respondido ya está guardado; salir solo cierra. */}
            <GloboTico mensaje={mensaje('SAL_01')} />
            <div className="respuesta-tico">
              <button className="boton primario" onClick={alCerrar}>{ETIQUETAS.guardarSalir}</button>
              <button className="boton secundario" onClick={() => setSaliendo(false)}>{ETIQUETAS.seguirAqui}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
