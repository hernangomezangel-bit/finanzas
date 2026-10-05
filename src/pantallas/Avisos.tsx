import { useEffect, useState } from 'react'
import { crearCalendarioDePagos } from '../avisosDatos'
import { activarAvisos, desactivarAvisos, leerEstadoAvisos, probarAviso, type EstadoAvisos } from '../avisosApp'

type Mensaje = { tipo: 'ok' | 'error'; texto: string } | null

const TEXTO: Record<EstadoAvisos, string> = {
  'no-disponible': 'Este teléfono o navegador no permite avisos. Instala la app desde el menú de Chrome («Instalar app») y vuelve a intentarlo.',
  bloqueado: 'Los avisos están bloqueados. Actívalos en los ajustes de Android: Aplicaciones → Finanzas → Notificaciones.',
  apagado: 'Los avisos están apagados.',
  'solo-al-abrir': 'Avisos activados, pero Chrome no permite revisar con la app cerrada: te avisaré al abrir la app. Usa el calendario para recibirlos siempre.',
  activo: 'Avisos activados: un día antes y el mismo día de cada pago.',
}

export default function Avisos() {
  const [estado, setEstado] = useState<EstadoAvisos | null>(null)
  const [mensaje, setMensaje] = useState<Mensaje>(null)

  useEffect(() => {
    void leerEstadoAvisos().then(setEstado)
  }, [])

  async function activar() {
    setMensaje(null)
    setEstado(await activarAvisos())
  }

  async function apagar() {
    setMensaje(null)
    setEstado(await desactivarAvisos())
  }

  async function probar() {
    try {
      await probarAviso()
    } catch {
      setMensaje({ tipo: 'error', texto: 'No se pudo mostrar el aviso de prueba.' })
    }
  }

  async function guardarCalendario() {
    try {
      const { texto, eventos } = await crearCalendarioDePagos()
      if (eventos === 0) return setMensaje({ tipo: 'error', texto: 'No hay pagos pendientes en los próximos 90 días.' })
      const url = URL.createObjectURL(new Blob([texto], { type: 'text/calendar' }))
      const enlace = document.createElement('a')
      enlace.href = url
      enlace.download = 'pagos-finanzas.ics'
      document.body.append(enlace)
      enlace.click()
      enlace.remove()
      setTimeout(() => URL.revokeObjectURL(url), 10000)
      setMensaje({
        tipo: 'ok',
        texto: `Listo: ${eventos} días con pagos. Abre el archivo pagos-finanzas.ics (carpeta Descargas) y elige tu calendario de Google.`,
      })
    } catch {
      setMensaje({ tipo: 'error', texto: 'No se pudo crear el archivo de calendario.' })
    }
  }

  const activo = estado === 'activo' || estado === 'solo-al-abrir'

  return (
    <section className="tarjeta">
      <h2>Avisos de pagos</h2>
      <p className="explicacion">
        Te aviso un día antes y el mismo día de cada gasto por pagar, sin abrir la app. Chrome decide cuándo revisar, así
        que puede llegar con algo de retraso.
      </p>
      {estado && <p className="ayuda">{TEXTO[estado]}</p>}

      {estado && estado !== 'no-disponible' && estado !== 'bloqueado' && (
        <>
          {!activo && <button className="boton secundario" onClick={activar}>Activar avisos</button>}
          {activo && <button className="boton secundario" onClick={probar}>Ver un aviso de prueba</button>}
          {activo && <button className="boton secundario" onClick={apagar}>Desactivar revisión en segundo plano</button>}
        </>
      )}

      <p className="explicacion">
        Para un recordatorio que siempre llega a su hora, guarda los pagos en tu calendario (9:00 de la víspera y 9:00 del
        mismo día). Cubre los próximos 90 días; si cambias algo, vuelve a guardarlo y se actualiza.
      </p>
      <button className="boton secundario" onClick={guardarCalendario}>Guardar pagos en el calendario</button>

      {mensaje && <p className={mensaje.tipo === 'ok' ? 'ayuda' : 'error'} role="status">{mensaje.texto}</p>}
    </section>
  )
}
