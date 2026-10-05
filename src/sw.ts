/// <reference lib="webworker" />
// Service worker: guarda la app para que abra sin internet y, con la app cerrada, revisa si hay pagos para hoy o mañana
// y avisa. Chrome decide cuándo despertarlo (la «sincronización periódica» no tiene hora exacta), por eso los avisos
// son aproximados; el calendario es el respaldo puntual.
import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching'
import { revisarAvisos } from './avisosDatos'

declare const self: ServiceWorkerGlobalScope

precacheAndRoute(self.__WB_MANIFEST)
cleanupOutdatedCaches()

// La app nueva se activa sola al actualizarse (igual que con registerType: 'autoUpdate').
self.addEventListener('install', () => void self.skipWaiting())
self.addEventListener('activate', (evento) => evento.waitUntil(self.clients.claim()))

/** La etiqueta con la que se registra la revisión periódica; la app usa la misma. */
const ETIQUETA = 'revisar-pagos'

function revisar(): Promise<number> {
  if (Notification.permission !== 'granted') return Promise.resolve(0)
  return revisarAvisos((aviso) =>
    self.registration.showNotification(aviso.titulo, {
      body: aviso.texto,
      tag: aviso.clave,
      icon: 'icon-192.png',
      badge: 'icon-192.png',
    }),
  )
}

// Chrome lo llama de vez en cuando, con la app cerrada.
self.addEventListener('periodicsync', (evento) => {
  if ((evento as Event & { tag: string }).tag === ETIQUETA) {
    ;(evento as Event & { waitUntil: (p: Promise<unknown>) => void }).waitUntil(revisar())
  }
})

// La app también pide una revisión cada vez que se abre.
self.addEventListener('message', (evento) => {
  if (evento.data?.tipo === 'revisar') evento.waitUntil(revisar())
})

// Tocar el aviso abre la app, o la trae al frente si ya estaba abierta.
self.addEventListener('notificationclick', (evento) => {
  evento.notification.close()
  evento.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((ventanas) => {
      const abierta = ventanas[0]
      return abierta ? abierta.focus() : self.clients.openWindow(self.registration.scope)
    }),
  )
})
