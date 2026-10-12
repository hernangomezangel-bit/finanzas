import { useState } from 'react'
import { alternarAhorro, editarMeta, metasElegidas, noSabe } from '../../asistente/ahorro'
import { mensaje } from '../../asistente/mensajes'
import { ETIQUETAS, NOMBRE_META_INICIAL, OPCIONES_AHORRO } from '../../asistente/textos'
import CampoMonto from '../../componentes/CampoMonto'
import { GloboTico } from '../../componentes/Tico'
import { superaLosIngresos } from '../../asistente/presupuesto'
import AvisoMontoAlto from './AvisoMontoAlto'
import ListaMarcar from './ListaMarcar'
import type { PropsPantalla } from './tipos'

/** La meta por la que se pregunta ahora (según la posición en la lista de las marcadas). */
function metaActual(props: PropsPantalla): string | undefined {
  return metasElegidas(props.borrador.ahorro)[props.borrador.posicion]
}

/** Quién sigue después de la meta número `posicion`: la siguiente, o el siguiente paso. */
function siguiente(props: PropsPantalla, posicion: number) {
  if (posicion + 1 < metasElegidas(props.borrador.ahorro).length) return props.ir('AHO_META', posicion + 1)
  props.ir('REV_PIENSA')
}

/** Paso 6 · ¿Para qué quieres ahorrar? (se pueden marcar varias) */
export function AhorroLista(props: PropsPantalla) {
  const { borrador, ir, cambiar } = props
  const [error, setError] = useState(false)

  function continuar() {
    if (borrador.ahorro.elegidos.length === 0) return setError(true)
    if (noSabe(borrador.ahorro)) return ir('AHO_NOSE')
    ir('AHO_META', 0)
  }

  return (
    <>
      <GloboTico mensaje={mensaje('AHO_01')} />
      <div className="respuesta-tico">
        <ListaMarcar
          opciones={OPCIONES_AHORRO}
          elegidos={borrador.ahorro.elegidos}
          alAlternar={(id) => {
            setError(false)
            cambiar((previo) => ({ ahorro: alternarAhorro(previo.ahorro, id) }))
          }}
        />
        {error && <p className="aviso-tico" role="alert">{mensaje('VAL_05').texto}</p>}
        <button className="boton primario" onClick={continuar}>{ETIQUETAS.continuar}</button>
      </div>
    </>
  )
}

/** Paso 6 · Nombre de la meta y cuánto necesita (opcional). */
export function AhorroMeta(props: PropsPantalla) {
  const { borrador, cambiar, ir } = props
  const id = metaActual(props)
  const [error, setError] = useState(false)
  if (!id) return <MetaPerdida {...props} />
  const datos = borrador.ahorro.metas[id]
  // Si todavía no la nombró, arranca con el nombre de la opción («Fondo de emergencia») o vacío («Una meta»).
  const nombre = datos?.nombre ?? NOMBRE_META_INICIAL[id] ?? ''

  function continuar() {
    if (!nombre.trim()) return setError(true)
    cambiar((previo) => ({ ahorro: editarMeta(previo.ahorro, id!, { nombre: nombre.trim() }) }))
    ir('AHO_CUOTA')
  }

  function saltar() {
    cambiar((previo) => ({ ahorro: editarMeta(previo.ahorro, id!, { saltada: true }) }))
    siguiente(props, borrador.posicion)
  }

  return (
    <>
      <GloboTico mensaje={mensaje('AHO_02')} />
      <div className="respuesta-tico">
        <label className="campo">
          {ETIQUETAS.metaNombre}
          <input
            type="text"
            maxLength={40}
            autoFocus={!nombre}
            placeholder={ETIQUETAS.metaNombreEjemplo}
            value={nombre}
            onChange={(e) => {
              setError(false)
              cambiar((previo) => ({ ahorro: editarMeta(previo.ahorro, id, { nombre: e.target.value }) }))
            }}
          />
        </label>
        {error && <p className="aviso-tico" role="alert">{mensaje('VAL_01').texto}</p>}
        <CampoMonto
          etiqueta={ETIQUETAS.metaObjetivo}
          valor={datos?.objetivo ?? 0}
          alCambiar={(v) => cambiar((previo) => ({ ahorro: editarMeta(previo.ahorro, id, { objetivo: v }) }))}
        />
        <button className="boton primario" onClick={continuar}>{ETIQUETAS.continuar}</button>
        <button className="boton secundario" onClick={saltar}>{ETIQUETAS.saltarEsta}</button>
      </div>
    </>
  )
}

/** Paso 6 · ¿Cuánto puedes apartar cada mes para esta meta? */
export function AhorroCuota(props: PropsPantalla) {
  const { borrador, cambiar } = props
  const id = metaActual(props)
  const [tocado, setTocado] = useState(false)
  const [error, setError] = useState<'VAL_01' | 'VAL_02' | null>(null)
  const [confirmando, setConfirmando] = useState(false)
  if (!id) return <MetaPerdida {...props} />
  const datos = borrador.ahorro.metas[id]
  const valor = datos?.cuota ?? 0

  function continuar() {
    if (valor <= 0) return setError(tocado ? 'VAL_02' : 'VAL_01')
    if (superaLosIngresos(borrador, valor)) return setConfirmando(true)
    siguiente(props, borrador.posicion)
  }

  if (confirmando) return <AvisoMontoAlto valor={valor} alConfirmar={() => siguiente(props, borrador.posicion)} alCorregir={() => setConfirmando(false)} />

  return (
    <>
      <GloboTico mensaje={mensaje('AHO_03', { meta: datos?.nombre ?? '' })} />
      <div className="respuesta-tico">
        <CampoMonto
          etiqueta={ETIQUETAS.cuotaEtiqueta}
          valor={valor}
          autoFocus
          alCambiar={(v) => {
            setTocado(true)
            setError(null)
            cambiar((previo) => ({ ahorro: editarMeta(previo.ahorro, id, { cuota: v }) }))
          }}
        />
        {error && <p className="aviso-tico" role="alert">{mensaje(error).texto}</p>}
        <button className="boton primario" onClick={continuar}>{ETIQUETAS.continuar}</button>
      </div>
    </>
  )
}

/** Paso 6 · «Todavía no sé»: no hay metas que crear por ahora. */
export function AhorroNose({ ir }: PropsPantalla) {
  return (
    <>
      <GloboTico mensaje={mensaje('AHO_04')} />
      <div className="respuesta-tico">
        <button className="boton primario" onClick={() => ir('REV_PIENSA')}>{ETIQUETAS.continuar}</button>
      </div>
    </>
  )
}

/** Si la meta ya no existe (por ejemplo, desmarcó todo y volvió), se sigue con lo que toque. */
function MetaPerdida({ ir }: PropsPantalla) {
  return (
    <div className="respuesta-tico">
      <button className="boton primario" onClick={() => ir('REV_PIENSA')}>{ETIQUETAS.continuar}</button>
    </div>
  )
}
