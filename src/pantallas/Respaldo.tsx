import { useRef, useState } from 'react'
import {
  aArchivo,
  crearRespaldo,
  diasDesde,
  leerRespaldo,
  marcarRespaldoHecho,
  nombreArchivo,
  restaurarRespaldo,
  ultimoRespaldo,
  type Respaldo as DatosRespaldo,
} from '../respaldo'
import Hoja from '../componentes/Hoja'

type Mensaje = { tipo: 'ok' | 'error'; texto: string } | null

const formatoFecha = new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'long', year: 'numeric' })

export default function Respaldo() {
  const [mensaje, setMensaje] = useState<Mensaje>(null)
  const [pendiente, setPendiente] = useState<DatosRespaldo | null>(null)
  const [ultimo, setUltimo] = useState(ultimoRespaldo)
  const selector = useRef<HTMLInputElement>(null)

  const puedeCompartir = typeof navigator.canShare === 'function' && navigator.canShare({ files: [aArchivo(vacio())] })

  async function guardarCopia() {
    try {
      const archivo = aArchivo(await crearRespaldo())
      const url = URL.createObjectURL(archivo)
      const enlace = document.createElement('a')
      enlace.href = url
      enlace.download = nombreArchivo()
      document.body.append(enlace)
      enlace.click()
      enlace.remove()
      setTimeout(() => URL.revokeObjectURL(url), 10000)
      registrarHecho()
      setMensaje({ tipo: 'ok', texto: `Copia guardada como ${nombreArchivo()}. Búscala en la carpeta Descargas.` })
    } catch {
      setMensaje({ tipo: 'error', texto: 'No se pudo crear la copia. Inténtalo de nuevo.' })
    }
  }

  async function compartirCopia() {
    try {
      await navigator.share({ files: [aArchivo(await crearRespaldo())], title: 'Copia de seguridad de Mis Finanzas' })
      registrarHecho()
      setMensaje({ tipo: 'ok', texto: 'Copia compartida.' })
    } catch (e) {
      // Cerrar el menú de compartir sin elegir nada no es un error.
      if (e instanceof DOMException && e.name === 'AbortError') return
      setMensaje({ tipo: 'error', texto: 'No se pudo compartir la copia. Prueba con "Guardar copia".' })
    }
  }

  function registrarHecho() {
    marcarRespaldoHecho()
    setUltimo(ultimoRespaldo())
  }

  async function alElegirArchivo(e: React.ChangeEvent<HTMLInputElement>) {
    const archivo = e.target.files?.[0]
    e.target.value = '' // Permite volver a elegir el mismo archivo.
    if (!archivo) return
    setMensaje(null)
    try {
      setPendiente(await leerRespaldo(archivo))
    } catch (err) {
      setMensaje({ tipo: 'error', texto: err instanceof Error ? err.message : 'No se pudo leer el archivo.' })
    }
  }

  async function confirmarRestauracion() {
    if (!pendiente) return
    try {
      await restaurarRespaldo(pendiente)
      setMensaje({
        tipo: 'ok',
        texto: `Listo: se restauraron ${plural(pendiente.movimientos.length, 'movimiento', 'movimientos')}, ${plural(pendiente.categorias.length, 'categoría', 'categorías')}, ${plural(pendiente.metas.length, 'meta', 'metas')} y ${plural(pendiente.deudas.length, 'deuda', 'deudas')}.`,
      })
    } catch {
      setMensaje({ tipo: 'error', texto: 'No se pudo restaurar la copia. Tus datos actuales no se cambiaron.' })
    }
    setPendiente(null)
  }

  return (
    <section className="tarjeta">
      <h2>Copia de seguridad</h2>
      <p className="explicacion">
        Tus datos viven solo en este teléfono. Si borras los datos de Chrome o desinstalas la app, se pierden.
        Guarda una copia de vez en cuando y envíatela por WhatsApp, correo o Drive.
      </p>
      <p className="estado-copia">
        {ultimo
          ? `Última copia: ${formatoFecha.format(ultimo)} (${textoDias(diasDesde(ultimo))})`
          : 'Aún no has guardado ninguna copia.'}
      </p>

      <button className="boton primario" onClick={guardarCopia}>Guardar copia</button>
      {puedeCompartir && (
        <button className="boton secundario" onClick={compartirCopia}>Compartir copia</button>
      )}
      <button className="boton secundario" onClick={() => selector.current?.click()}>
        Restaurar desde un archivo
      </button>
      <input ref={selector} type="file" accept=".json,application/json" hidden onChange={alElegirArchivo} />

      {mensaje && (
        <p className={mensaje.tipo === 'ok' ? 'mensaje ok' : 'mensaje error'} role={mensaje.tipo === 'ok' ? 'status' : 'alert'}>
          {mensaje.texto}
        </p>
      )}

      {pendiente && (
        <Hoja titulo="¿Restaurar esta copia?" alCerrar={() => setPendiente(null)}>
          <p>
            La copia es del <strong>{formatoFecha.format(new Date(pendiente.exportadoEn))}</strong> y tiene{' '}
            <strong>{plural(pendiente.movimientos.length, 'movimiento', 'movimientos')}</strong> y{' '}
            <strong>{plural(pendiente.categorias.length, 'categoría', 'categorías')}</strong>
            {pendiente.version >= 2 && (
              <>
                {pendiente.version >= 3 ? ', ' : ' y '}
                <strong>{plural(pendiente.metas.length, 'meta de ahorro', 'metas de ahorro')}</strong>
              </>
            )}
            {pendiente.version >= 3 && (
              <>
                {' '}y <strong>{plural(pendiente.deudas.length, 'deuda', 'deudas')}</strong>
              </>
            )}
            .
          </p>
          <p className="aviso-fuerte">
            Se reemplazarán TODOS los datos que tienes ahora en este teléfono. Esto no se puede deshacer.
          </p>
          <button className="boton secundario" onClick={guardarCopia}>
            Primero guardar copia de mis datos actuales
          </button>
          <button className="boton primario" onClick={confirmarRestauracion}>Sí, reemplazar mis datos</button>
          <button className="boton" onClick={() => setPendiente(null)}>Cancelar</button>
        </Hoja>
      )}
    </section>
  )
}

function plural(cantidad: number, uno: string, varios: string): string {
  return `${cantidad} ${cantidad === 1 ? uno : varios}`
}

function textoDias(dias: number): string {
  if (dias <= 0) return 'hoy'
  return dias === 1 ? 'hace 1 día' : `hace ${dias} días`
}

/** Copia vacía solo para preguntarle al navegador si sabe compartir este tipo de archivo. */
function vacio(): DatosRespaldo {
  return { app: 'mis-finanzas', version: 1, exportadoEn: new Date().toISOString(), categorias: [], movimientos: [], metas: [], aportes: [], deudas: [], pagosDeuda: [], ajustes: [], recurrentes: [], ocurrencias: [], fuentes: [], jornadas: [] }
}
