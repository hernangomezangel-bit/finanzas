import { useState } from 'react'
import { moverMes, nombreDia, nombreMes, hoy } from '../fechas'
import {
  esRepeticionValida,
  fechasDeRepeticion,
  repeticionPorDefecto,
  textoRepeticion,
  type Repeticion,
} from '../repeticion'
import Hoja from './Hoja'
import SelectorRepeticion from './SelectorRepeticion'

const ENCABEZADOS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

const dos = (n: number) => String(n).padStart(2, '0')

/**
 * Calendario para elegir el día de un movimiento y, si se quiere, cada cuánto se repite. Los días que caerían según lo
 * elegido se marcan en el calendario, para ver el resultado antes de guardar.
 */
export default function Calendario({
  fecha,
  repeticion,
  permiteRepetir,
  alAplicar,
  alCerrar,
}: {
  fecha: string
  repeticion: Repeticion
  /** Si se pueden elegir repeticiones (no en un movimiento programado o que ya está atado a algo). */
  permiteRepetir: boolean
  alAplicar: (fecha: string, repeticion: Repeticion) => void
  alCerrar: () => void
}) {
  const [elegida, setElegida] = useState(fecha)
  const [rep, setRep] = useState(repeticion)
  const [mes, setMes] = useState(fecha.slice(0, 7))
  const [error, setError] = useState('')

  const [anio, m] = mes.split('-').map(Number)
  const diasEnMes = new Date(anio, m, 0).getDate()
  // Lunes primero: cuántos huecos van antes del día 1.
  const huecos = (new Date(anio, m - 1, 1).getDay() + 6) % 7
  const marcadas = new Set(fechasDeRepeticion(rep, elegida, `${mes}-01`, `${mes}-${dos(diasEnMes)}`))
  const hoyTexto = hoy()

  function tocar(dia: number) {
    const nueva = `${mes}-${dos(dia)}`
    setElegida(nueva)
    setError('')
    // Al cambiar el inicio, los días propuestos se ajustan a él.
    if (rep.tipo !== 'unica') setRep(repeticionPorDefecto(rep.tipo, nueva))
  }

  function aplicar() {
    if (!esRepeticionValida(rep)) {
      setError(
        rep.tipo === 'quincenal'
          ? 'Escribe un día de la primera quincena (1 a 15) y uno de la segunda (16 a 31).'
          : rep.tipo === 'mensual'
            ? 'Escribe un día del mes entre 1 y 31.'
            : 'Elige al menos un día de la semana.',
      )
      return
    }
    alAplicar(elegida, rep)
  }

  return (
    <Hoja titulo="Elige el día" alCerrar={alCerrar}>
      <div className="selector-mes calendario-mes">
        <button onClick={() => setMes(moverMes(mes, -1))} aria-label="Mes anterior">‹</button>
        <strong>{nombreMes(mes)}</strong>
        <button onClick={() => setMes(moverMes(mes, 1))} aria-label="Mes siguiente">›</button>
      </div>

      <div className="rejilla-calendario" role="grid" aria-label={nombreMes(mes)}>
        {ENCABEZADOS.map((d) => (
          <span key={d} className="encabezado-cal" role="columnheader">{d}</span>
        ))}
        {Array.from({ length: huecos }, (_, i) => (
          <span key={`h${i}`} />
        ))}
        {Array.from({ length: diasEnMes }, (_, i) => {
          const dia = i + 1
          const f = `${mes}-${dos(dia)}`
          const clases = ['dia-cal', f === elegida ? 'elegido' : marcadas.has(f) ? 'marcado' : '', f === hoyTexto ? 'es-hoy' : '']
            .filter(Boolean)
            .join(' ')
          return (
            <button key={f} className={clases} onClick={() => tocar(dia)} aria-label={nombreDia(f)} aria-pressed={f === elegida}>
              {dia}
            </button>
          )
        })}
      </div>

      <p className="resumen-fecha">
        Empieza el <strong>{nombreDia(elegida).toLowerCase()}</strong>
        {rep.tipo !== 'unica' && <> · {textoRepeticion(rep).toLowerCase()}</>}
      </p>

      {permiteRepetir && (
        <div className="campo">
          ¿Se repite?
          <SelectorRepeticion
            repeticion={rep}
            fechaReferencia={elegida}
            alCambiar={(r) => {
              setRep(r)
              setError('')
            }}
          />
        </div>
      )}

      {error && <p className="error" role="alert">{error}</p>}
      <button className="boton primario" onClick={aplicar}>Listo</button>
    </Hoja>
  )
}
