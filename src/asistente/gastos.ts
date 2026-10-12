// Los gastos (fijos o variables) que va anotando el asistente. Código puro, sin pantalla ni base de datos.

/** Lo que se respondió de un gasto. */
export interface DatosGasto {
  monto?: number
  /** Solo en gastos fijos: día del mes en que se paga (1 a 31), o null si no lo sabe. */
  dia?: number | null
  /** Si lo saltó: sigue marcado en la lista pero no cuenta. */
  saltado?: boolean
}

/** Una lista de gastos marcada por la persona: qué marcó, en qué orden, y lo respondido de cada uno. */
export interface ListaGastos {
  /** Ids de las opciones marcadas, en el orden en que se van a preguntar. */
  elegidos: string[]
  /** Lo que escribió si marcó «Otro». */
  otro: string
  datos: Record<string, DatosGasto>
  /** Solo en gastos variables: si «Imprevistos» lo agregó Tico por sugerencia y no la persona. */
  imprevistosSugerido?: boolean
}

export interface OpcionGasto {
  id: string
  etiqueta: string
}

export function listaVacia(): ListaGastos {
  return { elegidos: [], otro: '', datos: {} }
}

/** Marca o desmarca una opción. Al marcar, queda al final del orden en que se pregunta. */
export function alternarOpcion(lista: ListaGastos, id: string): ListaGastos {
  const elegidos = lista.elegidos.includes(id) ? lista.elegidos.filter((e) => e !== id) : [...lista.elegidos, id]
  return { ...lista, elegidos }
}

/** Las preguntas que toca hacer, una por cada opción marcada (con el texto libre si es «Otro»). */
export function itemsDe(lista: ListaGastos, opciones: OpcionGasto[]): OpcionGasto[] {
  return lista.elegidos.flatMap((id) => {
    const opcion = opciones.find((o) => o.id === id)
    if (!opcion) return []
    return [id === 'otro' ? { id, etiqueta: lista.otro.trim() || opcion.etiqueta } : opcion]
  })
}

/** ¿Falta escribir qué es «Otro»? */
export function otroSinTexto(lista: ListaGastos): boolean {
  return lista.elegidos.includes('otro') && lista.otro.trim() === ''
}

/** Cambia lo respondido de un gasto. Al escribir un monto, deja de estar saltado. */
export function editarDatos(lista: ListaGastos, id: string, cambio: DatosGasto): ListaGastos {
  const saltado = cambio.saltado ?? (cambio.monto !== undefined ? false : lista.datos[id]?.saltado)
  return { ...lista, datos: { ...lista.datos, [id]: { ...lista.datos[id], ...cambio, ...(saltado !== undefined ? { saltado } : {}) } } }
}

/** ¿Cuenta este gasto? Tiene que estar marcado, con monto y sin saltar. */
function cuenta(lista: ListaGastos, id: string): boolean {
  const d = lista.datos[id]
  return lista.elegidos.includes(id) && !!d && typeof d.monto === 'number' && d.monto > 0 && !d.saltado
}

/** Los gastos que cuentan, en orden, con su monto. */
export function gastosContados(lista: ListaGastos, opciones: OpcionGasto[]): { id: string; etiqueta: string; monto: number; dia: number | null }[] {
  return itemsDe(lista, opciones)
    .filter((i) => cuenta(lista, i.id))
    .map((i) => ({ id: i.id, etiqueta: i.etiqueta, monto: lista.datos[i.id].monto as number, dia: lista.datos[i.id].dia ?? null }))
}

/** Cuánto suma la lista al mes. */
export function totalLista(lista: ListaGastos): number {
  return lista.elegidos.reduce((suma, id) => (cuenta(lista, id) ? suma + (lista.datos[id].monto as number) : suma), 0)
}

/** El día del mes escrito: un entero de 1 a 31, o null si no es válido. */
export function diaValido(texto: string): number | null {
  if (!/^\d{1,2}$/.test(texto.trim())) return null
  const dia = Number(texto)
  return dia >= 1 && dia <= 31 ? dia : null
}

/** El nombre de un gasto para usarlo dentro de una frase: «arriendo o hipoteca»; un texto libre se deja como lo escribió. */
export function nombreGastoEnFrase(id: string, etiqueta: string): string {
  const limpio = etiqueta.trim()
  if (id === 'otro' || limpio === '') return limpio
  return limpio.charAt(0).toLowerCase() + limpio.slice(1)
}

/** Validación de lo guardado: la lista tiene la forma esperada. */
export function esListaGastos(dato: unknown): dato is ListaGastos {
  if (typeof dato !== 'object' || dato === null) return false
  const d = dato as Record<string, unknown>
  if (!Array.isArray(d.elegidos) || !d.elegidos.every((e) => typeof e === 'string')) return false
  if (typeof d.otro !== 'string') return false
  if (typeof d.datos !== 'object' || d.datos === null || Array.isArray(d.datos)) return false
  if (d.imprevistosSugerido !== undefined && typeof d.imprevistosSugerido !== 'boolean') return false
  return Object.values(d.datos as Record<string, unknown>).every((v) => typeof v === 'object' && v !== null)
}
