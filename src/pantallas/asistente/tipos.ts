import type { Borrador, Pantalla } from '../../asistente/borrador'
import type { IngresoBorrador } from '../../asistente/ingresos'

/** Lo que recibe cada pantalla del asistente. */
export interface PropsPantalla {
  borrador: Borrador
  /** Cambia datos del borrador (se guardan solos). Con una función, parte del borrador más reciente. */
  cambiar: (cambio: Partial<Borrador> | ((previo: Borrador) => Partial<Borrador>)) => void
  /** Cambia el ingreso que se está respondiendo. */
  editarIngreso: (cambio: IngresoBorrador) => void
  /** Empieza a responder un ingreso nuevo. */
  nuevoIngreso: () => void
  /**
   * Va a otra pantalla, recordando de dónde viene (y en qué pregunta de la lista iba) para poder volver. Con `posicion`
   * indica qué pregunta de la lista se responde en la pantalla nueva.
   */
  ir: (pantalla: Pantalla, posicion?: number) => void
  /** Cierra el asistente (el progreso queda guardado). */
  cerrar: () => void
}
