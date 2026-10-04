// Los pesos colombianos se guardan como números enteros (sin centavos).
const formatoCOP = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0,
})

export function pesos(valor: number): string {
  return formatoCOP.format(valor)
}
