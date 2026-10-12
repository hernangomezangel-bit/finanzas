import { useEffect, useState } from 'react'
import { editarMeta } from '../../asistente/ahorro'
import { editarDatos } from '../../asistente/gastos'
import { mensaje, monto } from '../../asistente/mensajes'
import { ahorroDeMetas, filasParaAjustar, hayFijosConDia, revisar, type FilaEditable } from '../../asistente/presupuesto'
import { ETIQUETAS, type IdMensaje } from '../../asistente/textos'
import CampoMonto from '../../componentes/CampoMonto'
import { GloboTico } from '../../componentes/Tico'
import type { PropsPantalla } from './tipos'

/** Después de la revisión: los recordatorios si algún gasto fijo tiene día de pago, y si no, el cierre. */
function despuesDeLaRevision(props: PropsPantalla) {
  props.ir(hayFijosConDia(props.borrador) ? 'REC_PREGUNTA' : 'FIN')
}

/** Paso 7 · «Dame un segundo, estoy sumando todo…» Se muestra un momento y pasa solo a la revisión. */
export function RevisionPiensa({ cambiar, reemplazar }: PropsPantalla) {
  useEffect(() => {
    // Una revisión nueva parte de cero: lo que se haya sumado al ahorro antes ya no vale.
    cambiar({ extraAhorro: null })
    const espera = setTimeout(() => reemplazar('REV_RESUMEN'), 1500)
    return () => clearTimeout(espera)
  }, [cambiar, reemplazar])
  return (
    <>
      <GloboTico mensaje={mensaje('REV_01')} />
      <div className="puntos-pensando" aria-hidden="true">
        <i /><i /><i />
      </div>
    </>
  )
}

/** Paso 7 · Resumen del presupuesto: cuánto entra, cuánto se va y qué queda libre (o falta). */
export function RevisionResumen(props: PropsPantalla) {
  const { borrador, cambiar, ir } = props
  const r = revisar(borrador)
  const [referencia, setReferencia] = useState(false)
  const [editando, setEditando] = useState<string | null>(null)
  const [nuevoMonto, setNuevoMonto] = useState(0)

  const caso: 'sobra' | 'cuadra' | 'falta' = r.sobrante > 0 ? 'sobra' : r.sobrante === 0 ? 'cuadra' : 'falta'
  const id: IdMensaje = caso === 'sobra' ? 'REV_02' : caso === 'cuadra' ? 'REV_03' : 'REV_04'
  const texto = mensaje(id, { sobrante: monto(r.sobrante), faltante: monto(-r.sobrante) })
  const filas = caso === 'falta' ? filasParaAjustar(borrador) : []
  const hayMetas = ahorroDeMetas(borrador).length > 0

  function empezarAEditar(fila: FilaEditable) {
    setEditando(`${fila.tipo}:${fila.id}`)
    setNuevoMonto(fila.monto)
  }

  function guardarEdicion(fila: FilaEditable) {
    if (nuevoMonto > 0) {
      cambiar((previo) =>
        fila.tipo === 'variable'
          ? { variables: editarDatos(previo.variables, fila.id, { monto: nuevoMonto }) }
          : { ahorro: editarMeta(previo.ahorro, fila.id, { cuota: nuevoMonto }) },
      )
    }
    setEditando(null)
  }

  return (
    <>
      <GloboTico mensaje={texto} />
      <div className="respuesta-tico">
        <ul className="resumen-tico">
          <li><span>{ETIQUETAS.resumenIngresos}</span><strong className="ingreso">{monto(r.ingresos)}</strong></li>
          <li><span>{ETIQUETAS.resumenFijos}</span><strong>{monto(r.fijos)}</strong></li>
          <li><span>{ETIQUETAS.resumenVariables}</span><strong>{monto(r.variables)}</strong></li>
          <li><span>{ETIQUETAS.resumenAhorro}</span><strong>{monto(r.ahorro)}</strong></li>
          <li className="total">
            <span>{caso === 'falta' ? ETIQUETAS.resumenFalta : ETIQUETAS.resumenLibre}</span>
            <strong className={caso === 'falta' ? 'gasto' : 'ingreso'}>{monto(caso === 'falta' ? -r.sobrante : r.sobrante)}</strong>
          </li>
        </ul>

        {caso === 'falta' && filas.length > 0 && (
          <>
            <p className="subtitulo-tico">{ETIQUETAS.ajustarTitulo}</p>
            <ul className="resumen-tico">
              {filas.map((fila) => {
                const clave = `${fila.tipo}:${fila.id}`
                return (
                  <li key={clave} className={editando === clave ? 'editando' : undefined}>
                    {editando === clave ? (
                      <div className="edicion-fila">
                        <CampoMonto etiqueta={fila.etiqueta} valor={nuevoMonto} alCambiar={setNuevoMonto} autoFocus />
                        <button className="boton primario" onClick={() => guardarEdicion(fila)}>{ETIQUETAS.guardar}</button>
                      </div>
                    ) : (
                      <>
                        <span>
                          {fila.etiqueta}
                          <small className="detalle">{fila.tipo === 'ahorro' ? ETIQUETAS.resumenAhorro : ETIQUETAS.resumenVariables}</small>
                        </span>
                        <strong>{monto(fila.monto)}</strong>
                        <button className="boton-chico" onClick={() => empezarAEditar(fila)}>{ETIQUETAS.editar}</button>
                      </>
                    )}
                  </li>
                )
              })}
            </ul>
          </>
        )}

        {caso === 'sobra' ? (
          <>
            {hayMetas && <button className="opcion-tico" onClick={() => ir('REV_META')}>{ETIQUETAS.sumarAhorro}</button>}
            <button className="opcion-tico" onClick={() => despuesDeLaRevision(props)}>{ETIQUETAS.dejarLibres}</button>
          </>
        ) : (
          <button className="boton primario" onClick={() => despuesDeLaRevision(props)}>{ETIQUETAS.continuar}</button>
        )}

        <button className="boton secundario" onClick={() => setReferencia(!referencia)} aria-expanded={referencia}>
          {referencia ? ETIQUETAS.ocultarReferencia : ETIQUETAS.verReferencia}
        </button>
        {referencia && (
          <>
            <GloboTico mensaje={mensaje('REV_05')} />
            <GloboTico mensaje={mensaje('REV_05B')} />
          </>
        )}
      </div>
    </>
  )
}

/** Paso 7 · ¿A qué meta se suma lo que sobra? */
export function RevisionMeta({ borrador, cambiar, volver }: PropsPantalla) {
  const sobrante = revisar(borrador).sobrante
  const metas = ahorroDeMetas(borrador)
  return (
    <>
      <GloboTico mensaje={mensaje('REV_06')} />
      <div className="respuesta-tico">
        {metas.map((m) => (
          <button
            key={m.id}
            className="opcion-tico"
            onClick={() => {
              cambiar({ extraAhorro: sobrante > 0 ? { meta: m.id, monto: sobrante } : null })
              volver()
            }}
          >
            {m.nombre}
            <small className="detalle"> · {monto(m.cuota)} → {monto(m.cuota + Math.max(0, sobrante))}</small>
          </button>
        ))}
      </div>
    </>
  )
}
