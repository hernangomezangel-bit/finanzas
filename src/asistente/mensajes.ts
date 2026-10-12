// Cómo se arma lo que dice Tico: busca el texto por su id y reemplaza las {variables}. Código puro, sin pantalla.
import { MENSAJES, type IdMensaje, type Mensaje } from './textos.ts'

export type Variables = Record<string, string | number>

const formatoMiles = new Intl.NumberFormat('es-CO')

/** Un monto en pesos como lo muestra Tico, con puntos de miles y sin decimales: $1.250.000. */
export function monto(valor: number): string {
  const entero = Math.round(valor)
  return `${entero < 0 ? '-' : ''}$${formatoMiles.format(Math.abs(entero))}`
}

/** Reemplaza cada {nombre} por su valor. Si falta una variable, deja la palabra entre llaves para que se note. */
export function rellenar(texto: string, variables: Variables = {}): string {
  return texto.replace(/\{(\w+)\}/g, (original, nombre: string) =>
    nombre in variables ? String(variables[nombre]) : original,
  )
}

/** El mensaje con su expresión y su texto ya completo. */
export function mensaje(id: IdMensaje, variables: Variables = {}): Mensaje {
  const { expresion, texto } = MENSAJES[id]
  return { expresion, texto: rellenar(texto, variables) }
}
