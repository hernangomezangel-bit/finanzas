import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type Movimiento } from '../db'
import { fechaCorta, nombreMes } from '../fechas'
import { pesos } from '../formato'
import { candidatosAFijos, repetirMovimientos } from '../recurrentes'
import Hoja from './Hoja'

/**
 * Para elegir de una vez cuáles de lo que registraste en el mes se repite cada mes (sueldo, arriendo, servicios…).
 * Lo elegido aparece ya en los meses siguientes, el mismo día.
 */
export default function RepetirFijos({ mes, alCerrar }: { mes: string; alCerrar: () => void }) {
  const candidatos = useLiveQuery(() => candidatosAFijos(mes), [mes])
  const categorias = useLiveQuery(() => db.categorias.toArray())
  const [elegidos, setElegidos] = useState<Set<number>>(new Set())
  const [guardando, setGuardando] = useState(false)

  if (!candidatos || !categorias) return null

  const alternar = (id: number) =>
    setElegidos((actuales) => {
      const nuevo = new Set(actuales)
      if (nuevo.has(id)) nuevo.delete(id)
      else nuevo.add(id)
      return nuevo
    })

  async function confirmar() {
    setGuardando(true)
    await repetirMovimientos([...elegidos])
    alCerrar()
  }

  const grupo = (titulo: string, lista: Movimiento[]) =>
    lista.length > 0 && (
      <div className="campo">
        {titulo}
        <ul className="lista-elegir">
          {lista.map((m) => {
            const categoria = categorias.find((c) => c.id === m.categoriaId)
            return (
              <li key={m.id}>
                <label className="casilla">
                  <input type="checkbox" checked={elegidos.has(m.id!)} onChange={() => alternar(m.id!)} />
                  <span className="elegir-texto">
                    <span>
                      <span aria-hidden="true">{categoria?.icono ?? '🧾'}</span> {m.nota || categoria?.nombre || 'Movimiento'}
                    </span>
                    <small>Cada mes, el día {Number(m.fecha.slice(8, 10))} · {fechaCorta(m.fecha)}</small>
                  </span>
                  <strong className={m.tipo}>{m.tipo === 'gasto' ? '−' : '+'}{pesos(m.monto)}</strong>
                </label>
              </li>
            )
          })}
        </ul>
      </div>
    )

  return (
    <Hoja titulo="¿Qué se repite cada mes?" alCerrar={alCerrar}>
      <p className="ayuda">
        Marca lo que es igual todos los meses (tu sueldo, el arriendo, los servicios…). Aparecerá ya en los meses que vienen,
        el mismo día, y puedes cambiarlo o quitarlo cuando quieras. Estos son tus movimientos de {nombreMes(mes).toLowerCase()}.
      </p>

      {candidatos.length === 0 ? (
        <p className="pequeno">No hay movimientos tuyos en este mes que se puedan volver fijos.</p>
      ) : (
        <>
          {grupo('Ingresos', candidatos.filter((m) => m.tipo === 'ingreso'))}
          {grupo('Gastos', candidatos.filter((m) => m.tipo === 'gasto'))}
        </>
      )}

      <button className="boton primario" onClick={confirmar} disabled={elegidos.size === 0 || guardando}>
        {elegidos.size === 0 ? 'Elige al menos uno' : `Repetir cada mes (${elegidos.size})`}
      </button>
    </Hoja>
  )
}
