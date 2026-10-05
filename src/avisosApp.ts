// Lo que la app (no el service worker) hace con los avisos: pedir permiso, activar la revisión periódica y pedirle al
// service worker que revise cada vez que se abre.

/** La etiqueta de la revisión periódica; es la misma que escucha src/sw.ts. */
const ETIQUETA = 'revisar-pagos'
/** Cada cuánto se pide la revisión; Chrome la espacia como quiera, esto es solo lo mínimo. */
const INTERVALO_MS = 12 * 60 * 60 * 1000

/** La parte de la API de sincronización periódica que usamos (todavía no viene en los tipos del navegador). */
interface SincronizacionPeriodica {
  register: (etiqueta: string, opciones: { minInterval: number }) => Promise<void>
  unregister: (etiqueta: string) => Promise<void>
  getTags: () => Promise<string[]>
}

export type EstadoAvisos =
  /** El teléfono o el navegador no puede mandar avisos (por ejemplo, la app no está instalada). */
  | 'no-disponible'
  | 'bloqueado'
  | 'apagado'
  /** Permiso dado, pero Chrome no deja programar la revisión: solo avisa cuando abres la app. */
  | 'solo-al-abrir'
  | 'activo'

async function registro(): Promise<(ServiceWorkerRegistration & { periodicSync?: SincronizacionPeriodica }) | null> {
  if (!('serviceWorker' in navigator)) return null
  try {
    return await navigator.serviceWorker.ready
  } catch {
    return null
  }
}

export async function leerEstadoAvisos(): Promise<EstadoAvisos> {
  if (!('Notification' in window)) return 'no-disponible'
  const reg = await registro()
  if (!reg) return 'no-disponible'
  if (Notification.permission === 'denied') return 'bloqueado'
  if (Notification.permission !== 'granted') return 'apagado'
  const etiquetas = (await reg.periodicSync?.getTags().catch(() => [])) ?? []
  return etiquetas.includes(ETIQUETA) ? 'activo' : 'solo-al-abrir'
}

/** Pide permiso (hay que llamarlo desde un toque) y programa la revisión. Devuelve cómo quedó. */
export async function activarAvisos(): Promise<EstadoAvisos> {
  if (!('Notification' in window)) return 'no-disponible'
  const reg = await registro()
  if (!reg) return 'no-disponible'
  const permiso = await Notification.requestPermission()
  if (permiso === 'denied') return 'bloqueado'
  if (permiso !== 'granted') return 'apagado'
  try {
    await reg.periodicSync?.register(ETIQUETA, { minInterval: INTERVALO_MS })
  } catch {
    // Sin permiso para la sincronización periódica: queda la revisión al abrir la app.
  }
  pedirRevision()
  return leerEstadoAvisos()
}

export async function desactivarAvisos(): Promise<EstadoAvisos> {
  const reg = await registro()
  await reg?.periodicSync?.unregister(ETIQUETA).catch(() => undefined)
  return leerEstadoAvisos()
}

/** Un aviso de muestra, para ver cómo se ven. */
export async function probarAviso(): Promise<void> {
  const reg = await registro()
  await reg?.showNotification('Así se verán tus avisos', {
    body: 'Hoy toca pagar: 1 pago · $ 800.000',
    icon: 'icon-192.png',
    badge: 'icon-192.png',
  })
}

/** Le pide al service worker que revise si hay pagos para hoy o mañana (no hace nada si no hay permiso). */
export function pedirRevision(): void {
  void registro().then((reg) => reg?.active?.postMessage({ tipo: 'revisar' }))
}

/** Pide una revisión al abrir la app y cada vez que se vuelve a ella. Devuelve cómo detenerlo. */
export function iniciarRevisionDeAvisos(): () => void {
  pedirRevision()
  const alVolver = () => {
    if (document.visibilityState === 'visible') pedirRevision()
  }
  document.addEventListener('visibilitychange', alVolver)
  return () => document.removeEventListener('visibilitychange', alVolver)
}
