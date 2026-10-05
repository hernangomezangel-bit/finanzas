import { useState } from 'react'
import { db, type Meta, type ProgramaAhorro, type TipoMeta } from '../db'
import { totalProgramado } from '../ahorros'
import { hoy } from '../fechas'
import { pesos } from '../formato'
import type { Frecuencia } from '../recurrencia'
import CampoMonto from '../componentes/CampoMonto'
import Hoja from '../componentes/Hoja'

const SUGERENCIAS = ['🏠', '✈️', '🚗', '🎓', '💍', '🛡️', '📈', '🎁', '🏖️', '💻']
const FRECUENCIAS: { id: Frecuencia; nombre: string }[] = [
  { id: 'diaria', nombre: 'Diaria' },
  { id: 'semanal', nombre: 'Semanal' },
  { id: 'mensual', nombre: 'Mensual' },
]
/** Lunes primero, que es como se piensa la semana. */
const DIAS_SEMANA = [
  { dia: 1, nombre: 'Lun' }, { dia: 2, nombre: 'Mar' }, { dia: 3, nombre: 'Mié' }, { dia: 4, nombre: 'Jue' },
  { dia: 5, nombre: 'Vie' }, { dia: 6, nombre: 'Sáb' }, { dia: 0, nombre: 'Dom' },
]

export default function FormMeta({ meta, alCerrar }: { meta?: Meta; alCerrar: () => void }) {
  const editando = meta !== undefined
  const [nombre, setNombre] = useState(meta?.nombre ?? '')
  const [tipo, setTipo] = useState<TipoMeta>(meta?.tipo ?? 'gasto')
  const [objetivo, setObjetivo] = useState(meta?.objetivo ?? 0)
  const [fechaMeta, setFechaMeta] = useState(meta?.fechaMeta ?? '')
  const [icono, setIcono] = useState(meta?.icono ?? '🎯')
  // Ahorro programado: cuota fija que se repite hasta la fecha final.
  const [programado, setProgramado] = useState(meta?.programa !== undefined)
  const [cuota, setCuota] = useState(meta?.programa?.cuota ?? 0)
  const [frecuencia, setFrecuencia] = useState<Frecuencia>(meta?.programa?.frecuencia ?? 'mensual')
  const [diaSemana, setDiaSemana] = useState(meta?.programa?.frecuencia === 'semanal' ? meta.programa.dia : 5)
  const [diaMes, setDiaMes] = useState(meta?.programa?.frecuencia === 'mensual' ? String(meta.programa.dia) : '')
  const [inicio, setInicio] = useState(meta?.programa?.inicio ?? hoy())
  const [error, setError] = useState('')

  const dia = frecuencia === 'diaria' ? 0 : frecuencia === 'semanal' ? diaSemana : Number(diaMes)
  const diaValido = frecuencia !== 'mensual' || (Number.isInteger(dia) && dia >= 1 && dia <= 31)
  const programa: ProgramaAhorro | null =
    programado && cuota > 0 && diaValido && inicio ? { cuota, frecuencia, dia, inicio } : null
  const resumen = programa && fechaMeta ? totalProgramado(programa, fechaMeta) : null

  async function guardar() {
    const limpio = nombre.trim()
    if (!limpio) return setError('Escribe un nombre para la meta.')
    if (programado) {
      if (cuota <= 0) return setError('Escribe el valor de cada cuota.')
      if (!diaValido) return setError('Escribe el día del mes de la cuota (de 1 a 31).')
      if (!fechaMeta) return setError('Elige la fecha en que termina el ahorro.')
      if (!resumen || resumen.cuotas < 1) return setError('Con esas fechas no cae ninguna cuota. Revisa el inicio y la fecha final.')
    } else {
      if (objetivo <= 0) return setError('El objetivo debe ser mayor a cero.')
      if (fechaMeta && fechaMeta < hoy() && fechaMeta !== meta?.fechaMeta) return setError('La fecha de la meta debe ser de hoy en adelante.')
    }
    const datos = {
      nombre: limpio,
      tipo,
      // En un ahorro programado el objetivo es lo que se habrá ahorrado al terminar todas las cuotas.
      objetivo: programado ? resumen!.total : objetivo,
      icono: icono.trim() || '🎯',
      ...(fechaMeta ? { fechaMeta } : {}),
      ...(programado && programa ? { programa } : {}),
    }
    if (editando) {
      // put reemplaza el registro completo, así quitar la fecha o el programa también se guarda.
      await db.metas.put({ ...datos, id: meta.id, creada: meta.creada, ...(meta.archivada ? { archivada: true } : {}) })
    } else {
      await db.metas.add({ ...datos, creada: hoy() })
    }
    alCerrar()
  }

  return (
    <Hoja titulo={editando ? 'Editar meta' : 'Nueva meta'} alCerrar={alCerrar}>
      <label className="campo">
        Nombre
        <input
          type="text"
          maxLength={40}
          autoFocus
          placeholder="Ej: Viaje a Cartagena"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
        />
      </label>

      <div className="selector" role="group" aria-label="Tipo de meta">
        <button className={tipo === 'gasto' ? 'sel ingreso' : ''} onClick={() => setTipo('gasto')}>
          Gasto programado
        </button>
        <button className={tipo === 'inversion' ? 'sel ingreso' : ''} onClick={() => setTipo('inversion')}>
          Inversión
        </button>
      </div>

      <label className="casilla">
        <input type="checkbox" checked={programado} onChange={(e) => setProgramado(e.target.checked)} />
        <span>
          Ahorro programado (cuota fija)
          <small>
            Como los de los bancos: una cuota diaria, semanal o mensual hasta una fecha. Te la propongo cada vez en
            Presupuesto y cuenta como gasto.
          </small>
        </span>
      </label>

      {programado ? (
        <>
          <CampoMonto etiqueta="Valor de cada cuota" valor={cuota} alCambiar={setCuota} />

          <div className="campo">
            ¿Cada cuánto?
            <div className="selector tres" role="group" aria-label="Frecuencia de la cuota">
              {FRECUENCIAS.map((f) => (
                <button key={f.id} className={frecuencia === f.id ? 'sel ingreso' : ''} onClick={() => setFrecuencia(f.id)}>
                  {f.nombre}
                </button>
              ))}
            </div>
          </div>

          {frecuencia === 'semanal' && (
            <div className="campo">
              ¿Qué día de la semana?
              <div className="chips">
                {DIAS_SEMANA.map((d) => (
                  <button
                    key={d.dia}
                    className={diaSemana === d.dia ? 'chip activo' : 'chip'}
                    onClick={() => setDiaSemana(d.dia)}
                    aria-pressed={diaSemana === d.dia}
                  >
                    {d.nombre}
                  </button>
                ))}
              </div>
            </div>
          )}

          {frecuencia === 'mensual' && (
            <label className="campo">
              ¿Qué día del mes?
              <input
                inputMode="numeric"
                maxLength={2}
                placeholder="Ej: 15"
                value={diaMes}
                onChange={(e) => setDiaMes(e.target.value.replace(/\D/g, ''))}
              />
              <small className="ayuda">Si el mes no tiene ese día (31 en abril), se usa el último día del mes.</small>
            </label>
          )}

          <label className="campo">
            Primera cuota desde
            <input type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} />
          </label>

          <label className="campo">
            Fecha en que termina el ahorro
            <input type="date" value={fechaMeta} onChange={(e) => setFechaMeta(e.target.value)} />
          </label>

          {resumen && resumen.cuotas > 0 && (
            <p className="desglose">
              Serán <strong>{resumen.cuotas} {resumen.cuotas === 1 ? 'cuota' : 'cuotas'}</strong> de{' '}
              <strong>{pesos(programa!.cuota)}</strong>. Al terminar habrás ahorrado <strong>{pesos(resumen.total)}</strong>,
              sin intereses.
            </p>
          )}
        </>
      ) : (
        <>
          <CampoMonto etiqueta="¿Cuánto quieres juntar?" valor={objetivo} alCambiar={setObjetivo} />

          <label className="campo">
            Fecha límite (opcional)
            <input type="date" value={fechaMeta} onChange={(e) => setFechaMeta(e.target.value)} />
          </label>
        </>
      )}

      <div className="campo">
        Ícono
        <div className="chips">
          {SUGERENCIAS.map((s) => (
            <button key={s} className={s === icono ? 'chip activo' : 'chip'} onClick={() => setIcono(s)} aria-label={`Ícono ${s}`}>
              {s}
            </button>
          ))}
        </div>
      </div>

      {error && <p className="error" role="alert">{error}</p>}
      <button className="boton primario" onClick={guardar}>Guardar</button>
    </Hoja>
  )
}
