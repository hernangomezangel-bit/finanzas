import { mensaje } from '../../asistente/mensajes'
import { ETIQUETAS } from '../../asistente/textos'
import { GloboTico } from '../../componentes/Tico'
import type { PropsPantalla } from './tipos'

/** Paso 1 · Bienvenida. */
export function Bienvenida({ ir, cerrar }: PropsPantalla) {
  return (
    <>
      <GloboTico mensaje={mensaje('BIE_01')} />
      <div className="respuesta-tico">
        <button className="boton primario" onClick={() => ir('QUI')}>{ETIQUETAS.empecemos}</button>
        <button className="boton secundario" onClick={cerrar}>{ETIQUETAS.ahoraNo}</button>
      </div>
    </>
  )
}

/** Paso 2 · Para quién es el presupuesto. */
export function ParaQuien({ borrador, cambiar, ir }: PropsPantalla) {
  const elegir = (para: 'personal' | 'familiar') => {
    cambiar({ para })
    ir(para === 'familiar' ? 'QUI_FAM' : 'ING_TIPO')
  }
  return (
    <>
      <GloboTico mensaje={mensaje('QUI_01')} />
      <div className="respuesta-tico">
        <button className={borrador.para === 'personal' ? 'opcion-tico elegida' : 'opcion-tico'} onClick={() => elegir('personal')}>
          {ETIQUETAS.soloMio}
        </button>
        <button className={borrador.para === 'familiar' ? 'opcion-tico elegida' : 'opcion-tico'} onClick={() => elegir('familiar')}>
          {ETIQUETAS.familia}
        </button>
      </div>
    </>
  )
}

/** Paso 2 · Confirmación cuando el presupuesto es familiar. */
export function ParaQuienFamilia({ ir }: PropsPantalla) {
  return (
    <>
      <GloboTico mensaje={mensaje('QUI_02')} />
      <div className="respuesta-tico">
        <button className="boton primario" onClick={() => ir('ING_TIPO')}>{ETIQUETAS.continuar}</button>
      </div>
    </>
  )
}
