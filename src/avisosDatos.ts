import Dexie from 'dexie'
import { avisosDelDia, crearIcs, pagosPendientes, type Aviso, type MovimientoParaAvisar } from './avisos'
import { db } from './db'
import { diaSiguiente, hoy } from './fechas'

// Lo que une los avisos con la base de datos. Lo usan la app y el service worker (que corre con la app cerrada).

/** Antes de esta hora no se avisa: no tiene sentido despertar al teléfono de madrugada. */
const HORA_MINIMA = 6

/** Recuerda qué avisos ya se mandaron, para no repetirlos si la revisión corre varias veces el mismo día. */
class BaseAvisos extends Dexie {
  enviados!: Dexie.Table<{ clave: string; dia: string }, string>
  constructor() {
    super('avisos')
    this.version(1).stores({ enviados: 'clave' })
  }
}
const baseAvisos = new BaseAvisos()

async function leerMovimientos(desde: string, hasta: string): Promise<MovimientoParaAvisar[]> {
  const [movimientos, categorias] = await Promise.all([
    db.movimientos.where('fecha').between(desde, hasta, true, true).toArray(),
    db.categorias.toArray(),
  ])
  const nombres = new Map(categorias.map((c) => [c.id!, c.nombre]))
  return movimientos.map((m) => ({
    id: m.id!,
    tipo: m.tipo,
    monto: m.monto,
    fecha: m.fecha,
    nota: m.nota,
    categoria: nombres.get(m.categoriaId) ?? 'Gasto',
    ...(m.programado ? { programado: m.programado } : {}),
  }))
}

/**
 * Manda los avisos que correspondan ahora (pagos de hoy y de mañana que aún no se han hecho) y que no se hayan mandado
 * ya. Devuelve cuántos avisos mandó.
 */
export async function revisarAvisos(mostrar: (aviso: Aviso) => Promise<void>, ahora: Date = new Date()): Promise<number> {
  if (ahora.getHours() < HORA_MINIMA) return 0
  const dia = hoy()
  const manana = diaSiguiente(dia)
  const pagos = pagosPendientes(await leerMovimientos(dia, manana), dia, dia, manana)
  const yaEnviados = new Set((await baseAvisos.enviados.toArray()).map((e) => e.clave))
  const nuevos = avisosDelDia(pagos, dia, manana).filter((a) => !yaEnviados.has(a.clave))
  for (const aviso of nuevos) {
    await mostrar(aviso)
    await baseAvisos.enviados.put({ clave: aviso.clave, dia })
  }
  // Lo de días anteriores ya no sirve.
  await baseAvisos.enviados.filter((e) => e.dia < dia).delete()
  return nuevos.length
}

/** Los pagos de los próximos meses para el calendario: hoy y los 90 días que siguen. */
export async function crearCalendarioDePagos(): Promise<{ texto: string; eventos: number }> {
  const dia = hoy()
  const hasta = new Date()
  hasta.setDate(hasta.getDate() + 90)
  const limite = `${hasta.getFullYear()}-${String(hasta.getMonth() + 1).padStart(2, '0')}-${String(hasta.getDate()).padStart(2, '0')}`
  const pagos = pagosPendientes(await leerMovimientos(dia, limite), dia, dia, limite)
  return { texto: crearIcs(pagos, new Date()), eventos: new Set(pagos.map((p) => p.fecha)).size }
}
