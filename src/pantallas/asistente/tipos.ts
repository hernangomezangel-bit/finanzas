import type { Borrador, Pantalla } from '../../asistente/borrador'
import type { IngresoBorrador } from '../../asistente/ingresos'

/** Lo que recibe cada pantalla del asistente. */
export interface PropsPantalla {
  borrador: Borrador
  /** Cambia datos del borrador (se guardan solos). */
  cambiar: (cambio: Partial<Borrador>) => void
  /** Cambia el ingreso que se está respondiendo. */
  editarIngreso: (cambio: IngresoBorrador) => void
  /** Empieza a responder un ingreso nuevo. */
  nuevoIngreso: () => void
  /** Va a otra pantalla, recordando de dónde viene para poder volver. */
  ir: (pantalla: Pantalla) => void
  /** Cierra el asistente (el progreso queda guardado). */
  cerrar: () => void
}
