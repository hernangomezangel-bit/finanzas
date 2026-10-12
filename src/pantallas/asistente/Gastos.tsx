import { useState } from 'react'
import type { Borrador } from '../../asistente/borrador'
import {
  alternarOpcion,
  diaValido,
  editarDatos,
  gastosContados,
  itemsDe,
  nombreGastoEnFrase,
  otroSinTexto,
  totalLista,
  type ListaGastos,
} from '../../asistente/gastos'
import { mensaje, monto } from '../../asistente/mensajes'
import { ETIQUETAS, OPCIONES_FIJOS, OPCIONES_VARIABLES, type IdMensaje } from '../../asistente/textos'
import CampoMonto from '../../componentes/CampoMonto'
import { GloboTico } from '../../componentes/Tico'
import { superaLosIngresos } from '../../asistente/presupuesto'
import AvisoMontoAlto from './AvisoMontoAlto'
import ListaMarcar from './ListaMarcar'
import type { PropsPantalla } from './tipos'

// Los pasos 4 (gastos fijos) y 5 (gastos variables) funcionan igual: se marcan los que tienes, se pregunta cuánto
// pagas de cada uno y se muestra el total. Solo cambian los textos y que en los fijos también se pregunta el día.

export type TipoGastos = 'fijos' | 'variables'

const CONFIG: Record<
  TipoGastos,
  { opciones: { id: string; etiqueta: string }[]; lista: IdMensaje; monto: IdMensaje; total: IdMensaje; variable: string; etiquetaTotal: string }
> = {
  fijos: { opciones: OPCIONES_FIJOS, lista: 'FIJ_01', monto: 'FIJ_02', total: 'FIJ_04', variable: 'total_fijos', etiquetaTotal: ETIQUETAS.totalFijos },
  variables: { opciones: OPCIONES_VARIABLES, lista: 'VAR_01', monto: 'VAR_02', total: 'VAR_04', variable: 'total_variables', etiquetaTotal: ETIQUETAS.totalVariables },
}

/** Aplica un cambio a la lista del paso (fijos o variables) sobre el borrador más reciente. */
function cambiarLista(props: PropsPantalla, tipo: TipoGastos, f: (lista: ListaGastos) => ListaGastos) {
  props.cambiar((previo: Borrador) => ({ [tipo]: f(previo[tipo]) }) as Partial<Borrador>)
}

/** Quién sigue después de responder la pregunta número `posicion`: la siguiente, o el cierre del paso. */
function siguiente(props: PropsPantalla, tipo: TipoGastos, posicion: number) {
  const lista = props.borrador[tipo]
  const items = itemsDe(lista, CONFIG[tipo].opciones)
  if (posicion + 1 < items.length) return props.ir(tipo === 'fijos' ? 'FIJ_MONTO' : 'VAR_MONTO', posicion + 1)
  return finDelPaso(props, tipo)
}

/** Al terminar las preguntas: en los fijos, el total; en los variables, la sugerencia de imprevistos si no la marcó. */
function finDelPaso(props: PropsPantalla, tipo: TipoGastos) {
  if (tipo === 'fijos') return props.ir('FIJ_TOTAL')
  const lista = props.borrador.variables
  return props.ir(lista.elegidos.includes('imprevistos') ? 'VAR_TOTAL' : 'VAR_SUGIERE')
}

/** Paso 4 y 5 · Marcar los que tienes. */
export function GastosLista(props: PropsPantalla & { tipo: TipoGastos }) {
  const { borrador, tipo, ir } = props
  const config = CONFIG[tipo]
  const lista = borrador[tipo]
  const [error, setError] = useState(false)

  function continuar() {
    if (otroSinTexto(lista)) return setError(true)
    if (itemsDe(lista, config.opciones).length === 0) return finDelPaso(props, tipo)
    ir(tipo === 'fijos' ? 'FIJ_MONTO' : 'VAR_MONTO', 0)
  }

  return (
    <>
      <GloboTico mensaje={mensaje(config.lista)} />
      <div className="respuesta-tico">
        <ListaMarcar
          opciones={config.opciones}
          elegidos={lista.elegidos}
          alAlternar={(id) =>
            cambiarLista(props, tipo, (l) => {
              const nueva = alternarOpcion(l, id)
              // Si la persona marca «Imprevistos» ella misma, ya no cuenta como sugerencia de Tico.
              return id === 'imprevistos' ? { ...nueva, imprevistosSugerido: false } : nueva
            })
          }
          otro={lista.otro}
          alCambiarOtro={(texto) => {
            setError(false)
            cambiarLista(props, tipo, (l) => ({ ...l, otro: texto }))
          }}
          errorOtro={error}
        />
        <button className="boton primario" onClick={continuar}>{ETIQUETAS.continuar}</button>
      </div>
    </>
  )
}

/** El gasto por el que se pregunta ahora (según la posición en la lista). */
function itemActual(props: PropsPantalla, tipo: TipoGastos) {
  return itemsDe(props.borrador[tipo], CONFIG[tipo].opciones)[props.borrador.posicion]
}

/** Paso 4 y 5 · ¿Cuánto pagas de este gasto al mes? */
export function GastosMonto(props: PropsPantalla & { tipo: TipoGastos }) {
  const { borrador, tipo, ir } = props
  const config = CONFIG[tipo]
  const item = itemActual(props, tipo)
  // Distingue «no escribió nada» de «escribió cero» para decir el mensaje que corresponde.
  const [tocado, setTocado] = useState(false)
  const [error, setError] = useState<'VAL_01' | 'VAL_02' | null>(null)
  const [confirmando, setConfirmando] = useState(false)
  if (!item) return <PreguntaPerdida props={props} tipo={tipo} />
  const valor = borrador[tipo].datos[item.id]?.monto ?? 0

  function avanzar() {
    if (tipo === 'fijos') return ir('FIJ_DIA')
    siguiente(props, tipo, borrador.posicion)
  }

  function continuar() {
    if (valor <= 0) return setError(tocado ? 'VAL_02' : 'VAL_01')
    // Un gasto mayor que todo lo que entra: se confirma antes de seguir.
    if (superaLosIngresos(borrador, valor)) return setConfirmando(true)
    avanzar()
  }

  if (confirmando) return <AvisoMontoAlto valor={valor} alConfirmar={avanzar} alCorregir={() => setConfirmando(false)} />

  function saltar() {
    cambiarLista(props, tipo, (l) => editarDatos(l, item.id, { saltado: true }))
    siguiente(props, tipo, borrador.posicion)
  }

  return (
    <>
      <GloboTico mensaje={mensaje(config.monto, { categoria: nombreGastoEnFrase(item.id, item.etiqueta) })} />
      <div className="respuesta-tico">
        <CampoMonto
          etiqueta={ETIQUETAS.montoEtiqueta}
          valor={valor}
          autoFocus
          alCambiar={(v) => {
            setTocado(true)
            setError(null)
            cambiarLista(props, tipo, (l) => editarDatos(l, item.id, { monto: v }))
          }}
        />
        {error && <p className="aviso-tico" role="alert">{mensaje(error).texto}</p>}
        <button className="boton primario" onClick={continuar}>{ETIQUETAS.continuar}</button>
        <button className="boton secundario" onClick={saltar}>{ETIQUETAS.saltarEsta}</button>
      </div>
    </>
  )
}

/** Paso 4 · ¿Qué día del mes lo pagas? (solo gastos fijos) */
export function GastosDia(props: PropsPantalla) {
  const { borrador } = props
  const item = itemActual(props, 'fijos')
  const guardado = item ? borrador.fijos.datos[item.id]?.dia : undefined
  const [texto, setTexto] = useState(typeof guardado === 'number' ? String(guardado) : '')
  const [error, setError] = useState<'VAL_01' | 'VAL_04' | null>(null)
  if (!item) return <PreguntaPerdida props={props} tipo="fijos" />

  function guardarDia(dia: number | null) {
    cambiarLista(props, 'fijos', (l) => editarDatos(l, item.id, { dia }))
    siguiente(props, 'fijos', borrador.posicion)
  }

  function continuar() {
    if (texto.trim() === '') return setError('VAL_01')
    const dia = diaValido(texto)
    if (dia === null) return setError('VAL_04')
    guardarDia(dia)
  }

  return (
    <>
      <GloboTico mensaje={mensaje('FIJ_03')} />
      <div className="respuesta-tico">
        <label className="campo">
          {item.etiqueta} · {ETIQUETAS.diaEtiqueta}
          <input
            inputMode="numeric"
            maxLength={2}
            autoFocus
            placeholder={ETIQUETAS.diaEjemplo}
            value={texto}
            onChange={(e) => {
              setTexto(e.target.value.replace(/\D/g, ''))
              setError(null)
            }}
          />
        </label>
        {error && <p className="aviso-tico" role="alert">{mensaje(error).texto}</p>}
        <button className="boton primario" onClick={continuar}>{ETIQUETAS.continuar}</button>
        <button className="boton secundario" onClick={() => guardarDia(null)}>{ETIQUETAS.noSe}</button>
      </div>
    </>
  )
}

/** Paso 4 y 5 · Total al mes. */
export function GastosTotal(props: PropsPantalla & { tipo: TipoGastos }) {
  const { borrador, tipo, ir } = props
  const config = CONFIG[tipo]
  const lista = borrador[tipo]
  const contados = gastosContados(lista, config.opciones)
  return (
    <>
      <GloboTico mensaje={mensaje(config.total, { [config.variable]: monto(totalLista(lista)) })} />
      <div className="respuesta-tico">
        {contados.length === 0 ? (
          <p className="ayuda">{ETIQUETAS.sinGastos}</p>
        ) : (
          <ul className="resumen-tico">
            {contados.map((g) => (
              <li key={g.id}>
                <span>
                  {g.etiqueta}
                  {tipo === 'fijos' && (
                    <small className="detalle">
                      {g.dia === null ? ETIQUETAS.resumenSinDia : ETIQUETAS.resumenDia.replace('{dia}', String(g.dia))}
                    </small>
                  )}
                </span>
                <strong>{monto(g.monto)}</strong>
              </li>
            ))}
            <li className="total">
              <span>{config.etiquetaTotal}</span>
              <strong>{monto(totalLista(lista))}</strong>
            </li>
          </ul>
        )}
        <button className="boton primario" onClick={() => ir(tipo === 'fijos' ? 'VAR_LISTA' : 'AHO_LISTA')}>
          {ETIQUETAS.continuar}
        </button>
      </div>
    </>
  )
}

/** Paso 5 · Sugerencia de imprevistos. */
export function VariablesSugiere(props: PropsPantalla) {
  const { borrador, ir } = props
  const lista = borrador.variables

  function agregar() {
    const nueva: ListaGastos = {
      ...lista,
      elegidos: [...lista.elegidos.filter((id) => id !== 'imprevistos'), 'imprevistos'],
      imprevistosSugerido: true,
    }
    props.cambiar({ variables: nueva })
    ir('VAR_MONTO', itemsDe(nueva, OPCIONES_VARIABLES).length - 1)
  }

  function noAgregar() {
    // Si ya lo había agregado por la sugerencia y volvió atrás, se quita.
    if (lista.imprevistosSugerido) {
      props.cambiar({ variables: { ...lista, elegidos: lista.elegidos.filter((id) => id !== 'imprevistos'), imprevistosSugerido: false } })
    }
    ir('VAR_TOTAL')
  }

  return (
    <>
      <GloboTico mensaje={mensaje('VAR_03')} />
      <div className="respuesta-tico">
        <button className="opcion-tico" onClick={agregar}>{ETIQUETAS.si}</button>
        <button className="opcion-tico" onClick={noAgregar}>{ETIQUETAS.no}</button>
      </div>
    </>
  )
}

/** Si la pregunta ya no existe (por ejemplo, desmarcó todo y volvió), se sigue con lo que toque. */
function PreguntaPerdida({ props, tipo }: { props: PropsPantalla; tipo: TipoGastos }) {
  return (
    <div className="respuesta-tico">
      <button className="boton primario" onClick={() => finDelPaso(props, tipo)}>{ETIQUETAS.continuar}</button>
    </div>
  )
}
