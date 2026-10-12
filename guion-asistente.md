# Guion del asistente de presupuesto

Oct 12, 2026 · @Angel Gomez

## Instrucciones para Claude Code

Este guion define, pantalla por pantalla, un asistente que guía a la persona a crear su presupuesto mensual. Es un flujo con textos fijos: no usa IA, no necesita internet y ningún dato sale del teléfono.

Requisitos técnicos:

- Antes de programar, revisa cómo la app guarda hoy ingresos, gastos, categorías y metas de ahorro, y usa esos mismos modelos. No crees datos duplicados.
- Todos los textos del personaje van en un solo archivo de textos, cada uno con su id (por ejemplo `ING_01`), para poder editarlos sin tocar la lógica.
- Las palabras entre llaves, como {total\_ingresos}, son variables que se reemplazan al mostrar el mensaje.
- Los montos están en pesos colombianos, sin decimales y con separador de miles: $1.250.000.
- El progreso se guarda en cada paso, para poder salir y retomar.
- En cualquier paso se puede volver atrás sin perder lo escrito.
- Al terminar, el asistente crea el presupuesto real en la app.
- Por ahora el personaje es una imagen fija por expresión. Mientras no existan las imágenes, usa un círculo con el nombre “Tico”. Las animaciones (Rive) se agregan después sin cambiar el flujo.

## El personaje

Tico es un tucán amable que acompaña sin regañar: celebra cada avance y, cuando algo no cuadra, propone cómo ajustarlo. El nombre y el animal son provisionales.

Cómo habla:

- Tutea y usa un tono cercano, como un amigo que sabe de plata.
- Frases cortas: máximo dos líneas (unos 120 caracteres) por globo.
- Nunca dice “mal”, “error” ni “deberías”. Prefiere “ajustemos” o “probemos”.
- Da consejos generales de presupuesto, pero no recomienda inversiones específicas.

| Expresión | Cuándo se usa |
| --- | --- |
| Feliz | Saludos y confirmaciones |
| Explicando | Al hacer una pregunta o dar un consejo |
| Pensando | Mientras calcula un resumen |
| Celebrando | Al terminar una etapa o cuando el presupuesto cuadra |
| Preocupado | Cuando lo planeado supera lo que entra, siempre en tono amable |

## Flujo del asistente paso a paso

El asistente tiene 9 pasos, una pregunta por pantalla y una barra de progreso arriba. Cada mensaje indica su id, la expresión de Tico, el texto y qué hace la app con la respuesta.

### Paso 1 · Bienvenida

- **BIE\_01** (feliz): “¡Hola! Soy Tico. En unos 5 minutos armamos juntos tu presupuesto.”
- Botones: “¡Empecemos!” → Paso 2. “Ahora no” → cierra el asistente y deja en el inicio un acceso “Crear mi presupuesto con Tico”.
- Si ya existe un presupuesto, antes de seguir se muestra **REP\_01** (ver Mensajes generales).

### Paso 2 · Para quién es

- **QUI\_01** (explicando): “¿Este presupuesto es solo tuyo o de toda la familia?”
- Opciones: “Solo mío” · “De mi familia o pareja”.
- **QUI\_02** (feliz), si elige familia: “¡Perfecto! Entonces vamos a sumar lo que entra entre todos.”
- Acción: guardar el tipo de presupuesto (personal o familiar).

### Paso 3 · Ingresos

- **ING\_01** (explicando): “Empecemos por lo que entra. ¿De dónde viene tu primer ingreso?”
- Opciones: Salario · Negocio propio · Trabajo independiente · Arriendo que recibo · Pensión · Otro (texto libre).
- **ING\_02** (explicando): “¿Cuánto recibes por {tipo\_ingreso}?” Campo de monto.
- **ING\_03** (explicando): “¿Cada cuánto lo recibes?” Opciones: Mensual · Quincenal · Semanal.
  - Acción: convertir a valor mensual. Quincenal × 2. Semanal × 52 ÷ 12, redondeado.
- **ING\_04** (explicando), solo si es familiar: “¿Quién recibe este ingreso?” Texto corto y opcional, por ejemplo “Papá”.
- **ING\_05** (explicando): “¿Este ingreso cambia de un mes a otro?” Sí · No.
- **ING\_06** (explicando), si responde Sí: “Consejo: usa el valor de tu mes más flojo. Si un mes entra más, ¡mejor!”
- **ING\_07** (feliz): “¿Tienes otro ingreso?” Sí → vuelve a ING\_01. No → ING\_08.
- **ING\_08** (celebrando): “¡Listo! En total entran {total\_ingresos} al mes.”
- Regla: hace falta al menos un ingreso para continuar.

### Paso 4 · Gastos fijos

- **FIJ\_01** (explicando): “Ahora los gastos fijos: los que pagas cada mes casi por el mismo valor. Marca los que tienes.”
- Lista para marcar: Arriendo o hipoteca · Administración · Servicios (agua, luz, gas) · Internet y celular · Transporte · Colegio o universidad · Cuotas de créditos · Seguros y salud · Otro (texto libre).
- Por cada uno marcado:
  - **FIJ\_02** (explicando): “¿Cuánto pagas de {categoria} al mes?”
  - **FIJ\_03** (explicando): “¿Qué día del mes lo pagas?” Número del 1 al 31, o “No sé”. Acción: guardar el día para los recordatorios del Paso 8.
- **FIJ\_04** (feliz): “Tus gastos fijos suman {total\_fijos} al mes.”

### Paso 5 · Gastos variables

- **VAR\_01** (explicando): “Ahora los gastos que cambian cada mes. Si no sabes el valor exacto, pon un estimado; lo ajustamos después.”
- Lista para marcar: Mercado · Comidas fuera y domicilios · Ropa · Salud y farmacia · Entretenimiento · Mascotas · Cuidado personal · Regalos y celebraciones · Imprevistos · Otro (texto libre).
- **VAR\_02** (explicando), por cada uno marcado: “¿Cuánto gastas más o menos en {categoria} al mes?”
- **VAR\_03** (explicando), si no marcó Imprevistos: “Te sugiero dejar algo para imprevistos: siempre aparece algo. ¿Lo agregamos?” Sí → pide el monto con VAR\_02. No → sigue.
- **VAR\_04** (feliz): “Tus gastos variables suman {total\_variables} al mes.”

### Paso 6 · Ahorro y metas

- **AHO\_01** (explicando): “Ahorrar es pagarte a ti primero. ¿Para qué quieres ahorrar?” Se pueden marcar varias.
- Opciones: Fondo de emergencia · Una meta (viaje, carro, estudio…) · Inversión · Todavía no sé.
- Por cada meta marcada:
  - **AHO\_02** (explicando): “¿Cómo se llama tu meta y cuánto necesitas?” Nombre y valor objetivo; el valor es opcional.
  - **AHO\_03** (explicando): “¿Cuánto puedes apartar cada mes para {meta}?”
- **AHO\_04** (feliz), si elige “Todavía no sé”: “No te preocupes. Puedes crear tus metas cuando quieras desde Ahorros.” → Paso 7.
- Acción: crear las metas de ahorro en la app.

### Paso 7 · Revisión

- **REV\_01** (pensando): “Dame un segundo, estoy sumando todo…” Se muestra 1 a 2 segundos.
- Pantalla de resumen: Ingresos · Gastos fijos · Gastos variables · Ahorro · Queda libre.
- Cálculo: {sobrante} = ingresos − gastos fijos − gastos variables − ahorro.
- Según el resultado:
  - Si sobra (mayor que 0) → **REV\_02** (celebrando): “¡Muy bien! Te quedan {sobrante} libres. ¿Qué hacemos con ellos?” Opciones: “Sumarlos a mi ahorro” (pregunta a qué meta) · “Dejarlos libres”.
  - Si da exacto (igual a 0) → **REV\_03** (celebrando): “¡Perfecto! Cada peso tiene una tarea asignada.”
  - Si falta (menor que 0) → **REV\_04** (preocupado): “Ojo: lo planeado supera lo que entra en {faltante}. No pasa nada, ajustemos juntos.” Muestra los 3 gastos variables más altos y el ahorro, cada uno con botón “Editar”. Al guardar un cambio, recalcula y vuelve a evaluar estos tres casos.
- **REV\_05** (explicando), detrás de un botón “Ver una referencia”: “Una guía común es la regla 50/30/20: 50 % para necesidades, 30 % para gustos y 20 % para ahorro. Es una referencia, no una obligación.”

### Paso 8 · Recordatorios

- Solo aparece si algún gasto fijo tiene día de pago.
- **REC\_01** (explicando): “¿Quieres que te recuerde tus pagos fijos para que no se te pase ninguno?” Sí · No.
- **REC\_02** (explicando), si responde Sí: “¿Con cuánta anticipación te aviso?” El mismo día · 1 día antes · 3 días antes.
- Acción: programar notificaciones locales mensuales en Android, con la imagen de Tico.
- **REC\_03**, texto de la notificación: “Tico te recuerda: {cuando} vence {categoria} por {monto}.” Ejemplo: “Tico te recuerda: mañana vence el arriendo por $1.200.000.”

### Paso 9 · Cierre

- **FIN\_01** (celebrando): “¡Listo! Tu presupuesto quedó creado. Cada vez que registres un gasto, te ayudo a ver cómo vas.”
- Botón “Ver mi presupuesto” → abre la pantalla de presupuesto.
- **FIN\_02** (explicando), la primera vez que se abre esa pantalla: “Aquí ves cuánto llevas gastado en cada categoría. Toca una para ver el detalle.”

## Mensajes generales

Estos mensajes pueden aparecer en cualquier paso.

- **VAL\_01** (explicando), campo vacío: “Me falta este dato. Si no lo sabes, pon un estimado.”
- **VAL\_02** (explicando), monto en cero o negativo: “Ese valor no me cuadra. Escribe un monto mayor a cero.”
- **VAL\_03** (pensando), un gasto mayor que el total de ingresos: “¿Seguro que son {monto}? Revisa que no sobre un cero.” Botones: “Sí, está bien” · “Corregir”.
- **SAL\_01** (explicando), al cerrar a mitad del flujo: “¿Guardamos lo que llevas para seguir después?” Botones: “Guardar y salir” · “Seguir aquí”.
- **RET\_01** (feliz), al volver a abrir un flujo sin terminar: “¡Hola de nuevo! Íbamos en {nombre\_paso}. ¿Seguimos?” Botones: “Seguir” · “Empezar de nuevo”.
- **REP\_01** (pensando), si ya existe un presupuesto: “Ya tienes un presupuesto creado. ¿Quieres reemplazarlo por uno nuevo?” Botones: “Reemplazar” · “Cancelar”.

## Reglas de comportamiento y criterios de aceptación

El asistente debe sentirse corto y opcional: nada obliga a terminarlo, salvo registrar un ingreso para pasar del Paso 3.

Reglas:

- Una pregunta por pantalla: Tico arriba con su globo de texto y la respuesta abajo.
- Los montos abren el teclado numérico y muestran el separador de miles mientras se escribe.
- Cualquier categoría se puede saltar.
- El botón “Saltar asistente” está siempre visible.
- El asistente se puede volver a abrir desde el menú con “Crear presupuesto con Tico”.

Criterios para dar por terminado el trabajo:

- [ ] Completo el flujo entero y al final veo el presupuesto creado con los montos correctos.
- [ ] Un ingreso quincenal de $1.000.000 aparece como $2.000.000 al mes.
- [ ] Si lo planeado supera los ingresos, aparece REV\_04, y al bajar un gasto el resumen se recalcula.
- [ ] Si cierro la app en el Paso 5 y la abro de nuevo, aparece RET\_01 y retomo en el Paso 5 con mis datos.
- [ ] Al cambiar un texto en el archivo de textos, cambia lo que dice Tico sin tocar otro código.
- [ ] Los recordatorios de pago llegan con la anticipación elegida.
- [ ] Todo el asistente funciona en modo avión.

## Prompt para pegar en Claude Code

Exporta este documento como Markdown, guárdalo en la carpeta del proyecto como `guion-asistente.md` y luego pega este mensaje en Claude Code:

```
Quiero agregar a mi app de finanzas un asistente guiado con un personaje llamado Tico, que ayuda a crear el presupuesto paso a paso. El guion completo está en guion-asistente.md.

Antes de escribir código:
1. Haz un commit en git del estado actual de la app.
2. Revisa cómo la app guarda hoy ingresos, gastos, categorías y metas de ahorro.
3. Propón un plan para implementar el asistente reutilizando esos modelos y dime qué archivos vas a crear o cambiar.

No uses IA ni servicios externos: todo debe funcionar en el teléfono, sin internet.

Implementa por fases y espera mi revisión al terminar cada una:
- Fase 1: pasos 1 a 3 y el archivo de textos.
- Fase 2: pasos 4 a 6.
- Fase 3: pasos 7 a 9 y los mensajes generales.

Al final, revisa uno por uno los criterios de aceptación del guion.
```
