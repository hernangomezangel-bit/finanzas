// Todo lo que dice Tico, en un solo lugar. Cada texto tiene su id (el del guion) y la expresión del personaje.
// Para cambiar lo que dice Tico basta con editar este archivo: no hace falta tocar nada más.
//
// Las palabras entre llaves, como {total_ingresos}, se reemplazan al mostrar el mensaje.
// Los montos ya vienen con formato ($1.250.000). Máximo unos 120 caracteres por globo.

export type Expresion = 'feliz' | 'explicando' | 'pensando' | 'celebrando' | 'preocupado'

export interface Mensaje {
  expresion: Expresion
  texto: string
}

export const MENSAJES = {
  // Paso 1 · Bienvenida
  BIE_01: { expresion: 'feliz', texto: '¡Hola! Soy Tico. En unos 5 minutos armamos juntos tu presupuesto.' },

  // Paso 2 · Para quién es
  QUI_01: { expresion: 'explicando', texto: '¿Este presupuesto es solo tuyo o de toda la familia?' },
  QUI_02: { expresion: 'feliz', texto: '¡Perfecto! Entonces vamos a sumar lo que entra entre todos.' },

  // Paso 3 · Ingresos
  ING_01: { expresion: 'explicando', texto: 'Empecemos por lo que entra. ¿De dónde viene tu primer ingreso?' },
  ING_02: { expresion: 'explicando', texto: '¿Cuánto recibes por {tipo_ingreso}?' },
  ING_03: { expresion: 'explicando', texto: '¿Cada cuánto lo recibes?' },
  ING_04: { expresion: 'explicando', texto: '¿Quién recibe este ingreso?' },
  ING_05: { expresion: 'explicando', texto: '¿Este ingreso cambia de un mes a otro?' },
  ING_06: { expresion: 'explicando', texto: 'Consejo: usa el valor de tu mes más flojo. Si un mes entra más, ¡mejor!' },
  ING_07: { expresion: 'feliz', texto: '¿Tienes otro ingreso?' },
  ING_08: { expresion: 'celebrando', texto: '¡Listo! En total entran {total_ingresos} al mes.' },

  // Paso 4 · Gastos fijos
  FIJ_01: { expresion: 'explicando', texto: 'Ahora los gastos fijos: los que pagas cada mes casi por el mismo valor. Marca los que tienes.' },
  FIJ_02: { expresion: 'explicando', texto: '¿Cuánto pagas de {categoria} al mes?' },
  FIJ_03: { expresion: 'explicando', texto: '¿Qué día del mes lo pagas?' },
  FIJ_04: { expresion: 'feliz', texto: 'Tus gastos fijos suman {total_fijos} al mes.' },

  // Paso 5 · Gastos variables
  VAR_01: { expresion: 'explicando', texto: 'Ahora los gastos que cambian cada mes. Si no sabes el valor exacto, pon un estimado; lo ajustamos después.' },
  VAR_02: { expresion: 'explicando', texto: '¿Cuánto gastas más o menos en {categoria} al mes?' },
  VAR_03: { expresion: 'explicando', texto: 'Te sugiero dejar algo para imprevistos: siempre aparece algo. ¿Lo agregamos?' },
  VAR_04: { expresion: 'feliz', texto: 'Tus gastos variables suman {total_variables} al mes.' },

  // Paso 6 · Ahorro y metas
  AHO_01: { expresion: 'explicando', texto: 'Ahorrar es pagarte a ti primero. ¿Para qué quieres ahorrar?' },
  AHO_02: { expresion: 'explicando', texto: '¿Cómo se llama tu meta y cuánto necesitas?' },
  AHO_03: { expresion: 'explicando', texto: '¿Cuánto puedes apartar cada mes para {meta}?' },
  AHO_04: { expresion: 'feliz', texto: 'No te preocupes. Puedes crear tus metas cuando quieras desde Ahorros.' },

  // Paso 7 · Revisión
  REV_01: { expresion: 'pensando', texto: 'Dame un segundo, estoy sumando todo…' },
  REV_02: { expresion: 'celebrando', texto: '¡Muy bien! Te quedan {sobrante} libres. ¿Qué hacemos con ellos?' },
  REV_03: { expresion: 'celebrando', texto: '¡Perfecto! Cada peso tiene una tarea asignada.' },
  REV_04: { expresion: 'preocupado', texto: 'Ojo: lo planeado supera lo que entra en {faltante}. No pasa nada, ajustemos juntos.' },
  REV_05: { expresion: 'explicando', texto: 'Una guía común es la regla 50/30/20: 50 % para necesidades, 30 % para gustos y 20 % para ahorro. Es una referencia, no una obligación.' },

  // Paso 8 · Recordatorios
  REC_01: { expresion: 'explicando', texto: '¿Quieres que te recuerde tus pagos fijos para que no se te pase ninguno?' },
  REC_02: { expresion: 'explicando', texto: '¿Con cuánta anticipación te aviso?' },
  // El texto de la notificación (no es un globo).
  REC_03: { expresion: 'feliz', texto: 'Tico te recuerda: {cuando} vence {categoria} por {monto}.' },

  // Paso 9 · Cierre
  FIN_01: { expresion: 'celebrando', texto: '¡Listo! Tu presupuesto quedó creado. Cada vez que registres un gasto, te ayudo a ver cómo vas.' },
  FIN_02: { expresion: 'explicando', texto: 'Aquí ves cuánto llevas gastado en cada categoría. Toca una para ver el detalle.' },

  // Mensajes generales
  VAL_01: { expresion: 'explicando', texto: 'Me falta este dato. Si no lo sabes, pon un estimado.' },
  VAL_02: { expresion: 'explicando', texto: 'Ese valor no me cuadra. Escribe un monto mayor a cero.' },
  VAL_03: { expresion: 'pensando', texto: '¿Seguro que son {monto}? Revisa que no sobre un cero.' },
  VAL_04: { expresion: 'explicando', texto: 'Escribe un día entre 1 y 31, o toca «No sé».' },
  VAL_05: { expresion: 'explicando', texto: 'Marca al menos una opción para seguir.' },
  SAL_01: { expresion: 'explicando', texto: '¿Guardamos lo que llevas para seguir después?' },
  RET_01: { expresion: 'feliz', texto: '¡Hola de nuevo! Íbamos en {nombre_paso}. ¿Seguimos?' },
  REP_01: { expresion: 'pensando', texto: 'Ya tienes un presupuesto creado. ¿Quieres reemplazarlo por uno nuevo?' },

  // Provisional de la Fase 1: se quita cuando estén los pasos siguientes.
  TMP_01: { expresion: 'feliz', texto: 'Por ahora llegamos hasta aquí: ingresos, gastos y ahorro ya quedaron anotados. La revisión viene pronto.' },
} satisfies Record<string, Mensaje>

export type IdMensaje = keyof typeof MENSAJES

/** Los nombres de los 9 pasos, para la barra de progreso y para «Íbamos en {nombre_paso}». */
export const NOMBRES_PASO = [
  'Bienvenida',
  'Para quién es',
  'Ingresos',
  'Gastos fijos',
  'Gastos variables',
  'Ahorro y metas',
  'Revisión',
  'Recordatorios',
  'Cierre',
]

/** Botones, opciones y rótulos de las pantallas. */
export const ETIQUETAS = {
  atras: 'Atrás',
  saltar: 'Saltar asistente',
  continuar: 'Continuar',
  si: 'Sí',
  no: 'No',
  pasoDe: 'Paso {paso} de {total}',

  // Paso 1
  empecemos: '¡Empecemos!',
  ahoraNo: 'Ahora no',

  // Paso 2
  soloMio: 'Solo mío',
  familia: 'De mi familia o pareja',

  // Paso 3
  ingresoOtroNombre: 'Escribe de dónde viene',
  ingresoOtroEjemplo: 'Ej: Venta de comida',
  quienEtiqueta: 'Quién lo recibe (opcional)',
  quienEjemplo: 'Ej: Papá',
  montoEtiqueta: 'Monto al mes',
  otroGastoNombre: 'Escribe cuál es',
  otroGastoEjemplo: 'Ej: Gimnasio',
  diaEtiqueta: 'Día del mes (1 a 31)',
  diaEjemplo: 'Ej: 5',
  noSe: 'No sé',
  saltarEsta: 'Saltar esta',
  resumenDia: 'día {dia}',
  resumenSinDia: 'sin día fijo',
  totalFijos: 'Total fijos al mes',
  totalVariables: 'Total variables al mes',
  sinGastos: 'No marcaste ninguno por ahora.',
  metaNombre: 'Nombre de la meta',
  metaNombreEjemplo: 'Ej: Viaje a Cartagena',
  metaObjetivo: 'Cuánto necesitas (opcional)',
  cuotaEtiqueta: 'Aporte al mes',
  resumenAlMes: '{monto} al mes',
  resumenQuincenal: '2 pagos de {monto}',
  resumenSemanal: 'Cada semana {monto}',
  totalIngresos: 'Total al mes',
}

/** De dónde puede venir un ingreso (Paso 3). `otro` abre un campo de texto. */
export const OPCIONES_INGRESO = [
  { id: 'salario', etiqueta: 'Salario' },
  { id: 'negocio', etiqueta: 'Negocio propio' },
  { id: 'independiente', etiqueta: 'Trabajo independiente' },
  { id: 'arriendo', etiqueta: 'Arriendo que recibo' },
  { id: 'pension', etiqueta: 'Pensión' },
  { id: 'otro', etiqueta: 'Otro' },
]

/** Gastos fijos (Paso 4): los que se pagan cada mes casi por el mismo valor. `otro` abre un campo de texto. */
export const OPCIONES_FIJOS = [
  { id: 'arriendo', etiqueta: 'Arriendo o hipoteca' },
  { id: 'administracion', etiqueta: 'Administración' },
  { id: 'servicios', etiqueta: 'Servicios (agua, luz, gas)' },
  { id: 'internet', etiqueta: 'Internet y celular' },
  { id: 'transporte', etiqueta: 'Transporte' },
  { id: 'colegio', etiqueta: 'Colegio o universidad' },
  { id: 'creditos', etiqueta: 'Cuotas de créditos' },
  { id: 'seguros', etiqueta: 'Seguros y salud' },
  { id: 'otro', etiqueta: 'Otro' },
]

/** Gastos variables (Paso 5): los que cambian cada mes. `otro` abre un campo de texto. */
export const OPCIONES_VARIABLES = [
  { id: 'mercado', etiqueta: 'Mercado' },
  { id: 'comidas', etiqueta: 'Comidas fuera y domicilios' },
  { id: 'ropa', etiqueta: 'Ropa' },
  { id: 'salud', etiqueta: 'Salud y farmacia' },
  { id: 'entretenimiento', etiqueta: 'Entretenimiento' },
  { id: 'mascotas', etiqueta: 'Mascotas' },
  { id: 'cuidado', etiqueta: 'Cuidado personal' },
  { id: 'regalos', etiqueta: 'Regalos y celebraciones' },
  { id: 'imprevistos', etiqueta: 'Imprevistos' },
  { id: 'otro', etiqueta: 'Otro' },
]

/** Para qué quiere ahorrar (Paso 6). `nose` no se combina con las demás. */
export const OPCIONES_AHORRO = [
  { id: 'fondo', etiqueta: 'Fondo de emergencia' },
  { id: 'meta', etiqueta: 'Una meta (viaje, carro, estudio…)' },
  { id: 'inversion', etiqueta: 'Inversión' },
  { id: 'nose', etiqueta: 'Todavía no sé' },
]

/** El nombre con el que arranca cada meta; «Una meta» empieza vacía para que la persona la nombre. */
export const NOMBRE_META_INICIAL: Record<string, string> = {
  fondo: 'Fondo de emergencia',
  meta: '',
  inversion: 'Inversión',
}

/** Cada cuánto llega un ingreso. */
export const OPCIONES_FRECUENCIA = [
  { id: 'mensual', etiqueta: 'Mensual' },
  { id: 'quincenal', etiqueta: 'Quincenal' },
  { id: 'semanal', etiqueta: 'Semanal' },
]
