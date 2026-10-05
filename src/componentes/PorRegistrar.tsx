import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import { guardarAporte, leerCuotasAhorro, omitirCuotaAhorro, textoFrecuencia, type CuotaAhorro } from '../ahorros'
import { leerCuotasPropuestas, omitirCuota, registrarPago, type CuotaPropuesta } from '../deudas'
import { fechaCorta, hoy } from '../fechas'
import { pesos } from '../formato'
import { leerPendientes, registrarVencimiento, type PendienteConDatos } from '../recurrentes'
import FormAporte from '../pantallas/FormAporte'
import FormOcurrencia from '../pantallas/FormOcurrencia'
import FormPago from '../pantallas/FormPago'

type Item =
  | { clave: string; fecha: string; tipo: 'recurrente'; pendiente: PendienteConDatos }
  | { clave: string; fecha: string; tipo: 'deuda'; cuota: CuotaPropuesta }
  | { clave: string; fecha: string; tipo: 'ahorro'; cuota: CuotaAhorro }

async function leerItems(): Promise<Item[]> {
  const [recurrentes, cuotas, ahorros] = await Promise.all([leerPendientes(), leerCuotasPropuestas(), leerCuotasAhorro()])
  const items: Item[] = [
    ...ahorros.map((cuota): Item => ({
      clave: `a|${cuota.meta.id}|${cuota.fecha}`,
      fecha: cuota.fecha,
      tipo: 'ahorro',
      cuota,
    })),
    ...recurrentes.map((pendiente): Item => ({
      clave: `r|${pendiente.recurrenteId}|${pendiente.fecha}`,
      fecha: pendiente.fecha,
      tipo: 'recurrente',
      pendiente,
    })),
    ...cuotas.map((cuota): Item => ({
      clave: `d|${cuota.deuda.id}|${cuota.fecha}`,
      fecha: cuota.fecha,
      tipo: 'deuda',
      cuota,
    })),
  ]
  return items.sort((a, b) => a.fecha.localeCompare(b.fecha) || a.clave.localeCompare(b.clave))
}

/** Cuántos nombres se ven en el botón cerrado; el resto se resume como «+N más». */
const NOMBRES_VISIBLES = 4

/**
 * Lo que ya tocaba registrar: movimientos recurrentes, pagos de deudas (con el monto que indica el plan)
 * y cuotas de ahorro programado. Cerrado es un botón con los nombres; al tocarlo se despliegan las fichas.
 * En cada ficha, un toque confirma; tocar el nombre permite cambiar el monto u omitirlo.
 */
export default function PorRegistrar() {
  const lista = useLiveQuery(leerItems)
  const categorias = useLiveQuery(() => db.categorias.toArray())
  const [abierto, setAbierto] = useState<Item | null>(null)
  // Siempre arranca cerrado: solo el botón con los nombres.
  const [desplegado, setDesplegado] = useState(false)

  if (!lista || !categorias || lista.length === 0) return null

  const hoyTexto = hoy()
  const cuando = (fecha: string) => (fecha === hoyTexto ? 'Hoy' : `Tocaba el ${fechaCorta(fecha)}`)

  // Cada pendiente se resume en su ícono y su nombre, para la lista pequeña del botón.
  const resumen = lista.map((item) => {
    if (item.tipo === 'recurrente') {
      const r = item.pendiente.recurrente
      return { clave: item.clave, icono: categorias.find((c) => c.id === r.categoriaId)?.icono ?? '🧾', nombre: r.nombre }
    }
    if (item.tipo === 'ahorro') return { clave: item.clave, icono: item.cuota.meta.icono, nombre: `Ahorro: ${item.cuota.meta.nombre}` }
    return { clave: item.clave, icono: item.cuota.deuda.icono, nombre: `Pago de ${item.cuota.deuda.nombre}` }
  })
  const visibles = resumen.slice(0, NOMBRES_VISIBLES)
  const ocultos = resumen.length - visibles.length

  return (
    <section className="por-registrar">
      <button
        className={desplegado ? 'resumen-pend abierto' : 'resumen-pend'}
        aria-expanded={desplegado}
        onClick={() => setDesplegado(!desplegado)}
      >
        <span className="cabecera-pend">
          <span>
            <strong>Por registrar</strong>
            <span className="num-pend">{lista.length}</span>
          </span>
          <span className="flecha-pend" aria-hidden="true">⌄</span>
        </span>
        {!desplegado && (
          <>
            <span className="nombres-pend">
              {visibles.map((r) => (
                <span key={r.clave} className="nombre-pend">
                  <span className="mini-pend" aria-hidden="true">{r.icono}</span>
                  <span className="texto-nombre-pend">{r.nombre}</span>
                </span>
              ))}
              {ocultos > 0 && <span className="nombre-pend mas">+{ocultos} más</span>}
            </span>
            <small className="pista-pend">Toca para ver y registrar</small>
          </>
        )}
      </button>

      {desplegado && (
      <div className="tarjeta fichas-pend">
      <ul className="lista-pendientes">
        {lista.map((item) => {
          if (item.tipo === 'recurrente') {
            const r = item.pendiente.recurrente
            const icono = categorias.find((c) => c.id === r.categoriaId)?.icono ?? '🧾'
            return (
              <li key={item.clave}>
                <button className="fila-toca" onClick={() => setAbierto(item)}>
                  <span className="icono-cat" aria-hidden="true">{icono}</span>
                  <span className="texto-mov">
                    <span>{r.nombre}</span>
                    <small>{cuando(item.fecha)}</small>
                  </span>
                  <strong className={`monto-fila ${r.tipo}`}>{r.tipo === 'gasto' ? '−' : '+'}{pesos(item.pendiente.monto)}</strong>
                </button>
                <button className="boton-chico ancho" onClick={() => void registrarVencimiento(r, item.fecha, item.pendiente.monto)}>
                  Registrar {r.tipo === 'gasto' ? 'gasto' : 'ingreso'}
                </button>
              </li>
            )
          }
          if (item.tipo === 'ahorro') {
            const { meta, monto } = item.cuota
            return (
              <li key={item.clave}>
                <button className="fila-toca" onClick={() => setAbierto(item)}>
                  <span className="icono-cat" aria-hidden="true">{meta.icono}</span>
                  <span className="texto-mov">
                    <span>Ahorro: {meta.nombre}</span>
                    <small>
                      {cuando(item.fecha)} · cuota {meta.programa ? textoFrecuencia(meta.programa) : ''}
                    </small>
                  </span>
                  <strong className="monto-fila gasto">−{pesos(monto)}</strong>
                </button>
                <button
                  className="boton-chico ancho"
                  onClick={() =>
                    void guardarAporte({ metaId: meta.id!, monto, fecha: item.fecha, nota: '', comoGasto: true, fechaCuota: item.fecha })
                  }
                >
                  Registrar ahorro
                </button>
              </li>
            )
          }
          const { deuda, monto, extra } = item.cuota
          return (
            <li key={item.clave}>
              <button className="fila-toca" onClick={() => setAbierto(item)}>
                <span className="icono-cat" aria-hidden="true">{deuda.icono}</span>
                <span className="texto-mov">
                  <span>Pago de {deuda.nombre}</span>
                  <small>
                    {cuando(item.fecha)} · {extra > 0 ? `incluye ${pesos(extra)} extra` : 'pago mínimo'}
                  </small>
                </span>
                <strong className="monto-fila gasto">−{pesos(monto)}</strong>
              </button>
              <button
                className="boton-chico ancho"
                onClick={() => void registrarPago(deuda, { monto, fecha: item.fecha, fechaCuota: item.fecha, comoGasto: true })}
              >
                Registrar pago
              </button>
            </li>
          )
        })}
      </ul>
      <p className="ayuda">Toca el nombre para cambiar el monto u omitirlo.</p>
      </div>
      )}

      {abierto?.tipo === 'recurrente' && (
        <FormOcurrencia pendiente={abierto.pendiente} alCerrar={() => setAbierto(null)} />
      )}
      {abierto?.tipo === 'ahorro' && (
        <FormAporte
          meta={abierto.cuota.meta}
          montoInicial={abierto.cuota.monto}
          fechaInicial={abierto.fecha}
          fechaCuota={abierto.fecha}
          alOmitir={() => omitirCuotaAhorro(abierto.cuota.meta, abierto.fecha)}
          alCerrar={() => setAbierto(null)}
        />
      )}
      {abierto?.tipo === 'deuda' && (
        <FormPago
          deuda={abierto.cuota.deuda}
          saldo={abierto.cuota.saldo}
          montoSugerido={abierto.cuota.monto}
          fechaCuota={abierto.fecha}
          fechaInicial={abierto.fecha}
          alOmitir={() => omitirCuota(abierto.cuota.deuda, abierto.fecha)}
          alCerrar={() => setAbierto(null)}
        />
      )}
    </section>
  )
}
