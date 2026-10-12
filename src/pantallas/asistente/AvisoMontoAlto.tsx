import { mensaje, monto } from '../../asistente/mensajes'
import { ETIQUETAS } from '../../asistente/textos'
import { GloboTico } from '../../componentes/Tico'

/** «¿Seguro que son $X? Revisa que no sobre un cero.» con los botones para confirmar o corregir. */
export default function AvisoMontoAlto({ valor, alConfirmar, alCorregir }: { valor: number; alConfirmar: () => void; alCorregir: () => void }) {
  return (
    <>
      <GloboTico mensaje={mensaje('VAL_03', { monto: monto(valor) })} />
      <div className="respuesta-tico">
        <button className="opcion-tico" onClick={alConfirmar}>{ETIQUETAS.siEstaBien}</button>
        <button className="opcion-tico" onClick={alCorregir}>{ETIQUETAS.corregir}</button>
      </div>
    </>
  )
}
