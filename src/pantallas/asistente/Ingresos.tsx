import { useState } from 'react'
import { ingresosActivos } from '../../asistente/borrador'
import { esIngresoCompleto, mensualDe, nombreEnFrase, totalIngresosMensual, type FrecuenciaIngreso } from '../../asistente/ingresos'
import { mensaje, monto } from '../../asistente/mensajes'
import { DIAS_SEMANA, ETIQUETAS, OPCIONES_FRECUENCIA, OPCIONES_INGRESO } from '../../asistente/textos'
import CampoMonto from '../../componentes/CampoMonto'
import { GloboTico } from '../../componentes/Tico'
import type { PropsPantalla } from './tipos'

/** «descansas lun y dom» o «trabajas todos los días». */
function textoDescansos(libres: number[]): string {
  if (libres.length === 0) return ETIQUETAS.resumenSinDescanso
  const nombres = DIAS_SEMANA.filter((d) => libres.includes(d.n)).map((d) => d.etiqueta.toLowerCase())
  const lista = nombres.length <= 1 ? nombres.join('') : `${nombres.slice(0, -1).join(', ')} y ${nombres[nombres.length - 1]}`
  return ETIQUETAS.resumenDescansas.replace('{dias}', lista)
}

/** El ingreso que se está respondiendo ahora. */
function actual({ borrador }: PropsPantalla) {
  return borrador.ingresos[borrador.indice] ?? {}
}

/** Paso 3 · ¿De dónde viene el ingreso? */
export function IngresoTipo(props: PropsPantalla) {
  const { editarIngreso, ir } = props
  const ingreso = actual(props)
  const [otro, setOtro] = useState(ingreso.tipo === 'otro')
  const [texto, setTexto] = useState(ingreso.tipo === 'otro' ? (ingreso.etiqueta ?? '') : '')
  const [error, setError] = useState(false)

  function elegir(id: string, etiqueta: string) {
    if (id === 'otro') return setOtro(true)
    if (id === 'dia') {
      // Un trabajo por días tiene sus propias preguntas: nombre, meta de cada día y días de descanso. Siempre cambia de un día a otro.
      editarIngreso({ tipo: 'dia', etiqueta: ingreso.tipo === 'dia' ? (ingreso.etiqueta ?? '') : '', frecuencia: 'diaria', variable: true })
      return ir('ING_DIA_NOMBRE')
    }
    // Si antes había elegido un trabajo por días y cambia de idea, se limpia lo propio de ese tipo.
    editarIngreso({ tipo: id, etiqueta, ...(ingreso.tipo === 'dia' ? { frecuencia: undefined, variable: undefined, diasLibres: undefined, monto: undefined } : {}) })
    ir('ING_MONTO')
  }

  function continuarConOtro() {
    if (!texto.trim()) return setError(true)
    editarIngreso({ tipo: 'otro', etiqueta: texto.trim(), ...(ingreso.tipo === 'dia' ? { frecuencia: undefined, variable: undefined, diasLibres: undefined, monto: undefined } : {}) })
    ir('ING_MONTO')
  }

  return (
    <>
      <GloboTico mensaje={mensaje('ING_01')} />
      <div className="respuesta-tico">
        {OPCIONES_INGRESO.map((o) => (
          <button
            key={o.id}
            className={(o.id === 'otro' ? otro : ingreso.tipo === o.id) ? 'opcion-tico elegida' : 'opcion-tico'}
            onClick={() => elegir(o.id, o.etiqueta)}
          >
            {o.etiqueta}
          </button>
        ))}
        {otro && (
          <>
            <label className="campo">
              {ETIQUETAS.ingresoOtroNombre}
              <input
                type="text"
                maxLength={40}
                autoFocus
                placeholder={ETIQUETAS.ingresoOtroEjemplo}
                value={texto}
                onChange={(e) => {
                  setTexto(e.target.value)
                  setError(false)
                }}
              />
            </label>
            {error && <p className="aviso-tico" role="alert">{mensaje('VAL_01').texto}</p>}
            <button className="boton primario" onClick={continuarConOtro}>{ETIQUETAS.continuar}</button>
          </>
        )}
      </div>
    </>
  )
}

/** Paso 3 · ¿Cuánto recibe? */
export function IngresoMonto(props: PropsPantalla) {
  const { editarIngreso, ir } = props
  const ingreso = actual(props)
  // Distingue «no escribió nada» de «escribió cero» para decir el mensaje que corresponde.
  const [tocado, setTocado] = useState(false)
  const [error, setError] = useState<'VAL_01' | 'VAL_02' | null>(null)
  const valor = ingreso.monto ?? 0

  function continuar() {
    if (valor <= 0) return setError(tocado ? 'VAL_02' : 'VAL_01')
    ir('ING_FREC')
  }

  return (
    <>
      <GloboTico mensaje={mensaje('ING_02', { tipo_ingreso: nombreEnFrase(ingreso) })} />
      <div className="respuesta-tico">
        <CampoMonto
          etiqueta="Monto"
          valor={valor}
          autoFocus
          alCambiar={(v) => {
            setTocado(true)
            setError(null)
            editarIngreso({ monto: v })
          }}
        />
        {error && <p className="aviso-tico" role="alert">{mensaje(error).texto}</p>}
        <button className="boton primario" onClick={continuar}>{ETIQUETAS.continuar}</button>
      </div>
    </>
  )
}

/** Paso 3 · ¿Cada cuánto lo recibe? */
export function IngresoFrecuencia(props: PropsPantalla) {
  const { borrador, editarIngreso, ir } = props
  const ingreso = actual(props)
  return (
    <>
      <GloboTico mensaje={mensaje('ING_03')} />
      <div className="respuesta-tico">
        {OPCIONES_FRECUENCIA.map((o) => (
          <button
            key={o.id}
            className={ingreso.frecuencia === o.id ? 'opcion-tico elegida' : 'opcion-tico'}
            onClick={() => {
              editarIngreso({ frecuencia: o.id as FrecuenciaIngreso })
              ir(borrador.para === 'familiar' ? 'ING_QUIEN' : 'ING_VAR')
            }}
          >
            {o.etiqueta}
          </button>
        ))}
      </div>
    </>
  )
}

/** Paso 3 · ¿Quién lo recibe? (solo en presupuestos familiares) */
export function IngresoQuien(props: PropsPantalla) {
  const { editarIngreso, ir } = props
  const [texto, setTexto] = useState(actual(props).quien ?? '')
  return (
    <>
      <GloboTico mensaje={mensaje('ING_04')} />
      <div className="respuesta-tico">
        <label className="campo">
          {ETIQUETAS.quienEtiqueta}
          <input
            type="text"
            maxLength={30}
            autoFocus
            placeholder={ETIQUETAS.quienEjemplo}
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
          />
        </label>
        <button
          className="boton primario"
          onClick={() => {
            editarIngreso({ quien: texto.trim() })
            // Un trabajo por días ya se sabe que cambia: pasa directo al consejo.
            ir(actual(props).tipo === 'dia' ? 'ING_CONSEJO' : 'ING_VAR')
          }}
        >
          {ETIQUETAS.continuar}
        </button>
      </div>
    </>
  )
}

/** Paso 3 · Trabajo por días: ¿cómo se llama? */
export function IngresoDiaNombre(props: PropsPantalla) {
  const { editarIngreso, ir } = props
  const [texto, setTexto] = useState(actual(props).etiqueta ?? '')
  const [error, setError] = useState(false)
  return (
    <>
      <GloboTico mensaje={mensaje('ING_09')} />
      <div className="respuesta-tico">
        <label className="campo">
          {ETIQUETAS.trabajoNombre}
          <input
            type="text"
            maxLength={40}
            autoFocus
            placeholder={ETIQUETAS.trabajoEjemplo}
            value={texto}
            onChange={(e) => {
              setTexto(e.target.value)
              setError(false)
            }}
          />
        </label>
        {error && <p className="aviso-tico" role="alert">{mensaje('VAL_01').texto}</p>}
        <button
          className="boton primario"
          onClick={() => {
            if (!texto.trim()) return setError(true)
            editarIngreso({ etiqueta: texto.trim() })
            ir('ING_DIA_META')
          }}
        >
          {ETIQUETAS.continuar}
        </button>
      </div>
    </>
  )
}

/** Paso 3 · Trabajo por días: ¿cuánto quiere ganar cada día? */
export function IngresoDiaMeta(props: PropsPantalla) {
  const { editarIngreso, ir } = props
  const ingreso = actual(props)
  const [tocado, setTocado] = useState(false)
  const [error, setError] = useState<'VAL_01' | 'VAL_02' | null>(null)
  const valor = ingreso.monto ?? 0
  return (
    <>
      <GloboTico mensaje={mensaje('ING_10', { tipo_ingreso: nombreEnFrase(ingreso) })} />
      <div className="respuesta-tico">
        <CampoMonto
          etiqueta={ETIQUETAS.metaDiaria}
          valor={valor}
          autoFocus
          alCambiar={(v) => {
            setTocado(true)
            setError(null)
            editarIngreso({ monto: v })
          }}
        />
        {error && <p className="aviso-tico" role="alert">{mensaje(error).texto}</p>}
        <button
          className="boton primario"
          onClick={() => {
            if (valor <= 0) return setError(tocado ? 'VAL_02' : 'VAL_01')
            ir('ING_DIA_LIBRES')
          }}
        >
          {ETIQUETAS.continuar}
        </button>
      </div>
    </>
  )
}

/** Paso 3 · Trabajo por días: ¿qué días de la semana descansa? */
export function IngresoDiaLibres(props: PropsPantalla) {
  const { borrador, editarIngreso, ir } = props
  const libres = actual(props).diasLibres ?? []
  const [error, setError] = useState(false)
  const alternar = (dia: number) => {
    setError(false)
    editarIngreso({ diasLibres: libres.includes(dia) ? libres.filter((d) => d !== dia) : [...libres, dia] })
  }
  return (
    <>
      <GloboTico mensaje={mensaje('ING_11')} />
      <div className="respuesta-tico">
        <div className="chips" role="group" aria-label="Días de descanso">
          {DIAS_SEMANA.map((d) => (
            <button key={d.n} className={libres.includes(d.n) ? 'chip activo' : 'chip'} aria-pressed={libres.includes(d.n)} onClick={() => alternar(d.n)}>
              {d.etiqueta}
            </button>
          ))}
        </div>
        <p className="ayuda">{ETIQUETAS.diasLibresAyuda}</p>
        {error && <p className="aviso-tico" role="alert">{ETIQUETAS.diasLibresTodos}</p>}
        <button
          className="boton primario"
          onClick={() => {
            if (libres.length >= 7) return setError(true)
            // Aunque no marque ningún día, queda guardado que respondió (sin descansos).
            editarIngreso({ diasLibres: [...libres].sort((a, b) => a - b) })
            ir(borrador.para === 'familiar' ? 'ING_QUIEN' : 'ING_CONSEJO')
          }}
        >
          {ETIQUETAS.continuar}
        </button>
      </div>
    </>
  )
}

/** Paso 3 · ¿Cambia de un mes a otro? */
export function IngresoVariable(props: PropsPantalla) {
  const { editarIngreso, ir } = props
  const ingreso = actual(props)
  const responder = (variable: boolean) => {
    editarIngreso({ variable })
    ir(variable ? 'ING_CONSEJO' : 'ING_OTRO')
  }
  return (
    <>
      <GloboTico mensaje={mensaje('ING_05')} />
      <div className="respuesta-tico">
        <button className={ingreso.variable === true ? 'opcion-tico elegida' : 'opcion-tico'} onClick={() => responder(true)}>
          {ETIQUETAS.si}
        </button>
        <button className={ingreso.variable === false ? 'opcion-tico elegida' : 'opcion-tico'} onClick={() => responder(false)}>
          {ETIQUETAS.no}
        </button>
      </div>
    </>
  )
}

/** Paso 3 · Consejo para ingresos que cambian. */
export function IngresoConsejo({ ir }: PropsPantalla) {
  return (
    <>
      <GloboTico mensaje={mensaje('ING_06')} />
      <div className="respuesta-tico">
        <button className="boton primario" onClick={() => ir('ING_OTRO')}>{ETIQUETAS.continuar}</button>
      </div>
    </>
  )
}

/** Paso 3 · ¿Tienes otro ingreso? */
export function IngresoOtro({ nuevoIngreso, ir }: PropsPantalla) {
  return (
    <>
      <GloboTico mensaje={mensaje('ING_07')} />
      <div className="respuesta-tico">
        <button
          className="opcion-tico"
          onClick={() => {
            nuevoIngreso()
            ir('ING_TIPO')
          }}
        >
          {ETIQUETAS.si}
        </button>
        <button className="opcion-tico" onClick={() => ir('ING_TOTAL')}>{ETIQUETAS.no}</button>
      </div>
    </>
  )
}

/** Paso 3 · Total de ingresos al mes. */
export function IngresoTotal({ borrador, ir }: PropsPantalla) {
  const activos = ingresosActivos(borrador)
  const completos = activos.filter(esIngresoCompleto)
  const total = totalIngresosMensual(activos)
  return (
    <>
      <GloboTico mensaje={mensaje('ING_08', { total_ingresos: monto(total) })} />
      <div className="respuesta-tico">
        <ul className="resumen-tico">
          {completos.map((i, n) => (
            <li key={n}>
              <span>
                {i.etiqueta}
                {i.quien && <small> · {i.quien}</small>}
                {i.frecuencia !== 'mensual' && (
                  <small className="detalle">
                    {i.frecuencia === 'quincenal'
                      ? ETIQUETAS.resumenQuincenal.replace('{monto}', monto(i.monto))
                      : i.frecuencia === 'semanal'
                        ? ETIQUETAS.resumenSemanal.replace('{monto}', monto(i.monto))
                        : `${ETIQUETAS.resumenPorDia.replace('{monto}', monto(i.monto))} · ${textoDescansos(i.diasLibres ?? [])}`}
                  </small>
                )}
              </span>
              <strong>
                {(i.frecuencia === 'diaria' ? ETIQUETAS.resumenPromedio : ETIQUETAS.resumenAlMes).replace(
                  '{monto}',
                  monto(mensualDe(i.monto, i.frecuencia, i.diasLibres)),
                )}
              </strong>
            </li>
          ))}
          <li className="total">
            <span>{ETIQUETAS.totalIngresos}</span>
            <strong>{monto(total)}</strong>
          </li>
        </ul>
        <button className="boton primario" disabled={total <= 0} onClick={() => ir('FIJ_LISTA')}>{ETIQUETAS.continuar}</button>
      </div>
    </>
  )
}
