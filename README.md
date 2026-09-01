# Inversiones JCJ

Plataforma de **préstamos, cobros y créditos** para escritorio y móvil.
Una sola base de código sirve la web y se empaqueta como APK de Android.

- **Código interno: inglés.** Nombres de variables, tablas, funciones y rutas.
- **Interfaz: español.** Todo el texto visible vive en `src/i18n/es.ts` y cada
  empresa puede renombrar cualquier etiqueta desde *Configuración* sin tocar
  el código.

---

## Qué incluye

| Módulo | Qué hace |
| --- | --- |
| **Inicio** | Cartera activa, cobrado del día, mora y dinero en caja. |
| **Clientes** | Ficha con foto, referencias, punto de referencia, GPS, día de pago, documentos e historial. |
| **Préstamos** | Cinco modalidades de interés, seis frecuencias, tabla de amortización, mora automática y desembolso a caja. |
| **Cobros** | Recibo, aplicación automática a las cuotas y movimiento de caja. |
| **Rutas de cobro** | Rutas por cobrador, armadas solas con lo que vence hoy o con los morosos. |
| **Caja y bancos** | Cajas, cuentas, movimientos y saldo en vivo. |
| **Gastos** | Gastos por categoría, con o sin préstamo asociado. |
| **Reportes** | Cartera, cobranza, mora por tramos, rentabilidad y productividad. |
| **Plantillas** | Mensajes y documentos con variables y vista previa. |
| **Mensajería** | WhatsApp automático: recordatorios, avisos y cobranza. |
| **Call center** | Cola de morosos con llamada y WhatsApp directos, y registro de gestiones. |
| **Constructor de módulos** | Crear módulos y campos propios sin programar. |
| **Configuración** | Empresa, usuarios, roles, módulos y textos personalizables. |

Cada módulo se activa o desactiva por empresa desde *Configuración → Módulos*.

### Modalidades de préstamo

| Modalidad | Cómo se calcula |
| --- | --- |
| Porcentaje simple (`FLAT`) | Interés fijo sobre el capital original, repartido en partes iguales. Es el modelo del "10% mensual". |
| Francés (`FRENCH`) | Cuota fija; el interés se calcula sobre el saldo, así que el capital sube cada período. |
| Alemán (`GERMAN`) | Capital fijo; la cuota baja período a período. |
| Americano (`AMERICAN`) | Solo interés durante el plazo, todo el capital en la última cuota. |
| Línea de crédito (`CREDIT_LINE`) | Préstamo indefinido: solo se programa el interés y el capital queda pendiente. |

### Modalidades de cobro

| Modalidad | Cómo se programa |
| --- | --- |
| Diario | Todos los días. |
| Un día sí y uno no | Cada dos días. |
| Dos veces a la semana | Dos días fijos de la semana, p. ej. lunes y jueves. |
| Semanal | El mismo día cada semana. |
| Cada 14 días | Cada dos semanas. |
| Quincenal | Dos veces al mes: el mismo día y ese día más quince. |
| Mensual, trimestral, anual | El mismo día del mes, ajustando fin de mes. |
| Pago único | Una sola cuota. |
| Personalizado | Cada N días, con N a tu elección. |

### Días que no se cobra

En cada préstamo puedes marcar los días de la semana en que no sales a cobrar
(el domingo, o el fin de semana completo). El sistema lo aplica según la
modalidad:

- **Diario, un día sí y uno no, o personalizado con menos de una semana:**
  el día bloqueado **se salta**, no se pierde la cuota. Un préstamo diario de
  30 cuotas sin domingos se cobra en 35 días corridos.
- **Semanal o más largo:** sólo se corre la cuota que cae en día bloqueado, y
  la siguiente vuelve a su fecha. Un préstamo mensual que vence los días 5
  sigue venciendo los días 5, aunque un mes el 5 caiga domingo.

Modos de mora: sin mora, % de la cuota una vez, % por día de atraso, monto fijo
por día y monto fijo una vez — todos con días de gracia.

---

## Puesta en marcha

Necesitas Node 20+ y PostgreSQL.

```bash
cp .env.example .env.local     # y edita DATABASE_URL y AUTH_SECRET
npm install
npm run db:deploy              # aplica las migraciones
npm run db:seed                # empresa, roles, plantillas y datos de ejemplo
npm run dev                    # http://localhost:3000
```

El seed deja lista una empresa con usuarios de prueba:

| Correo | Rol | Clave |
| --- | --- | --- |
| `admin@inversionesjcj.com` | Dueño | `Cambiar123` |
| `cobrador@inversionesjcj.com` | Cobrador | `Cambiar123` |

> Cambia esas claves antes de poner el sistema en producción.
> `AUTH_SECRET` se genera con `openssl rand -base64 32`.

---

## Supabase

La base de datos de producción vive en Supabase. El esquema ya está aplicado en
el proyecto `ivhmbqqiccegjoyayvhv` (`https://ivhmbqqiccegjoyayvhv.supabase.co`):
33 tablas, 22 tipos, 96 índices y 65 llaves foráneas, más el bucket privado
`customer-files` para las fotos.

### Conectar la aplicación

Las contraseñas y claves **no están en el repositorio** y hay que copiarlas del
panel de Supabase:

1. **Botón "Connect" → pestaña ORM → Prisma.** Ahí salen las dos líneas ya
   armadas, con los mismos nombres que usa el proyecto:
   - `DATABASE_URL` → pooler en modo **transacción** (puerto 6543). La usa la
     aplicación.
   - `DIRECT_URL` → pooler en modo **sesión** (puerto 5432). La usan las
     migraciones, que necesitan una sesión real.

   Las dos van por el pooler compartido a propósito: la conexión directa a
   `db.<ref>.supabase.co` es sólo IPv6 y no funciona desde la mayoría de los
   hosts.
2. **Project Settings → API Keys → `service_role`** →
   `SUPABASE_SERVICE_ROLE_KEY`, y pon `STORAGE_PROVIDER="supabase"` para
   guardar las fotos ahí.

> La contraseña de la base **no se puede consultar**: sólo se muestra una vez,
> al crear el proyecto. Si no la tienes, genera otra en
> *Project Settings → Database → Reset database password* y cópiala en ese
> momento.

Después:

```bash
npm run db:status    # confirma que no falta ninguna migración
npm run db:seed      # solo la primera vez
```

### Seguridad

Supabase publica automáticamente una API REST sobre el esquema `public`. Sin
cerrarla, cualquiera con la clave `anon` —que es pública por diseño— podría
leer clientes, cédulas, préstamos y cobros.

La migración `20260901000001_lock_down_public_api` activa RLS en las 33 tablas
**sin ninguna política**, y le quita los permisos a los roles `anon` y
`authenticated`. Resultado: por la API pública no se ve nada. La aplicación
conecta por Postgres directo con un rol que omite RLS, así que funciona igual.

El bucket de archivos también es privado: las fotos se sirven por `/api/files`,
que exige sesión y solo entrega archivos de la empresa del usuario.

### Datos base ya cargados

El proyecto de Supabase ya tiene la empresa, los 5 roles, los 13 módulos, los
dos usuarios, la caja, las categorías de gasto, las 5 plantillas de WhatsApp y
las 4 automatizaciones de cobranza. **No hay clientes ni préstamos de ejemplo**:
la base está limpia para empezar a trabajar de verdad.

Si necesitas volver a generar esos datos base en otra base de datos y no puedes
conectarte con Prisma (por ejemplo desde un servidor que solo permite HTTP), el
script los emite como SQL para pegar en el editor de Supabase:

```bash
npx tsx scripts/gen-seed-sql.ts > seed.sql
```

Lee las mismas constantes que la aplicación, así que no se puede desincronizar
de los roles, módulos y plantillas reales. Se puede correr varias veces sin
duplicar nada.

### Cambios de esquema

```bash
# 1. edita prisma/schema.prisma
npm run db:migrate -- --name lo_que_cambiaste   # crea la migración
npm run db:deploy                               # la aplica en producción
```

No uses `db:push` contra Supabase: no deja historial y puede borrar datos.
Queda solo para probar rápido en local.

---

## WhatsApp y cobranza automática

La mensajería trabaja en dos pasos separados a propósito: primero se **decide**
qué mandar y se guarda en cola, después se **envía**. Así un fallo de red nunca
pierde la decisión, y todo se puede revisar antes de que salga.

Cada mensaje lleva una clave de deduplicación (`regla + cuota + día`), así que
correr el trabajo dos veces **no** le escribe dos veces al cliente.

### Proveedores

| Proveedor | Cuándo usarlo |
| --- | --- |
| `log` | Modo prueba. Registra el mensaje sin enviar nada. Es el que trae por defecto. |
| `cloud_api` | WhatsApp Business API oficial de Meta. Necesita *access token* y *phone number ID*. |
| `bridge` | Tu propio número de WhatsApp, a través de un servicio puente propio. |

El puente solo tiene que exponer:

```
POST {baseUrl}/messages
Authorization: Bearer {token}
{ "to": "18095550123", "body": "..." }
→ 200 { "id": "..." }
```

Se conectan desde *Mensajería → Conectar cuenta*. Mientras no conectes una
cuenta real, nada sale del sistema.

### Automatizaciones

Se crean desde *Mensajería → Automatizaciones*:

- **Antes del vencimiento** — N días antes de que venza la cuota.
- **El día del vencimiento**.
- **Después del vencimiento** — a los N días, si sigue sin pagar.
- **Al llegar a X días de mora**.

### Programar el envío

```bash
curl -X POST https://tu-dominio.com/api/jobs/run \
  -H "x-jobs-secret: $JOBS_SECRET"
```

Ese endpoint actualiza la mora de todos los préstamos, arma los mensajes del
día y los despacha. Prográmalo una vez por hora con cron, Vercel Cron o
cualquier programador.

---

## Datos que bajan la mora

Cuatro cosas del cliente que el sistema usa activamente, no sólo almacena:

- **Referencias** — hasta cinco personas con parentesco y teléfono, y el
  teléfono queda listo para llamar de un toque desde la ficha.
- **Punto de referencia** — "frente al colmado Mi Ranchito". Aparece en la
  ruta de cobro debajo del barrio, que es el orden en que un cobrador lee.
- **Día de pago** — cada cuánto le pagan y qué día. Al crear un préstamo, el
  sistema **propone la fecha de la primera cuota** para el día siguiente a que
  cobra, saltando los días en que no se sale a cobrar.
- **Ubicación GPS** de la casa y del trabajo — se captura con un botón parado
  frente a la puerta, y desde la ficha y la ruta se abre en el mapa.

---

## Fotos y documentos

La foto del cliente es **obligatoria** al darlo de alta, y las fotos del
documento de identidad (frente y reverso) se guardan aparte. En el celular el
campo abre la cámara directamente; la imagen se reduce a 1600 px y se
recomprime en el navegador antes de subirla, para que un cobrador en la calle
no gaste datos ni espere.

Los archivos **nunca son públicos**: se sirven por `/api/files/...`, que exige
sesión y sólo entrega archivos de la empresa del usuario.

| Proveedor | Cuándo usarlo |
| --- | --- |
| `local` | Disco del servidor. Es el valor por defecto y lo correcto en un VPS o Docker. |
| `supabase` | Supabase Storage, para plataformas sin disco persistente (Vercel y similares). |

```bash
STORAGE_PROVIDER="local"
STORAGE_LOCAL_DIR="./storage"
```

> Si despliegas en una plataforma serverless, `local` **no sirve**: el disco se
> borra en cada despliegue. Usa `supabase` con un bucket privado.

---

## Aplicación móvil (Android e iOS)

Capacitor envuelve **la misma aplicación web** en un contenedor nativo: una
sola base de código, un solo despliegue, y nada de mantener un segundo front.

El contenedor apunta al sitio desplegado en vez de llevar una copia adentro.
Es una app que necesita el servidor en cada pantalla, y una copia empaquetada
quedaría vieja apenas actualices el sitio: el cobrador estaría viendo la app de
ayer. La carpeta `mobile/` **no es la app**: es la pantalla local que se ve
mientras carga y, sobre todo, **cuando el teléfono se queda sin señal en plena
ruta**.

Los proyectos nativos (`android/` e `ios/`) ya están generados y versionados,
con los permisos de cámara y ubicación declarados.

### Android

Necesitas **Android Studio** (trae el SDK y Java).

```bash
MOBILE_SERVER_URL=https://tu-dominio.com npm run mobile:sync
npm run mobile:apk:debug   # APK de prueba, se instala directo en el teléfono
npm run mobile:apk         # APK de release, hay que firmarlo para Play Store
```

El resultado queda en `android/app/build/outputs/apk/`.

Para firmar el de release: Android Studio → *Build → Generate Signed Bundle /
APK*. Guarda el keystore, si lo pierdes no puedes volver a actualizar la app en
Play Store.

### iOS

**Requiere una Mac con Xcode.** No hay forma de compilar para iPhone desde
Windows ni Linux; es un requisito de Apple, no del proyecto.

```bash
MOBILE_SERVER_URL=https://tu-dominio.com npm run mobile:sync
cd ios/App && pod install
npm run mobile:ios         # abre Xcode
```

Publicar en la App Store necesita además una cuenta de Apple Developer
(99 USD al año).

### Permisos declarados

| Permiso | Para qué |
| --- | --- |
| Cámara | Foto del cliente y del documento de identidad. |
| Ubicación (en uso) | GPS de la casa y del negocio, y orden de la ruta. |
| Fotos | Elegir una imagen ya tomada en vez de sacarla en el momento. |

En iOS los tres llevan su explicación en español en `Info.plist`. **Sin eso la
app se cierra sola** al pedir el permiso.

### PWA

Sin compilar nada: desde el navegador del celular, *Agregar a la pantalla de
inicio*. Queda con su ícono y sin barra de direcciones. Es la vía más rápida
para poner a un cobrador a trabajar hoy mismo.

---

## Cómo está armado

```
src/
├─ core/                 Lógica pura, sin base de datos ni red.
│  ├─ money.ts           Todo el dinero se calcula en centavos enteros.
│  ├─ dates.ts           Fechas de vencimiento por frecuencia.
│  ├─ loans/
│  │  ├─ schedule.ts     Tabla de amortización (las cinco modalidades).
│  │  ├─ arrears.ts      Mora y días de atraso.
│  │  └─ allocation.ts   Reparto del pago: mora → interés → capital.
│  ├─ modules/registry.ts  Registro de módulos: menú, permisos, dependencias.
│  └─ permissions.ts     Catálogo de permisos y roles base.
├─ modules/              Funcionalidad por área.
│  ├─ templates/         Variables y renderizado de plantillas.
│  ├─ messaging/         Motor de automatización y proveedores de WhatsApp.
│  ├─ storage/           Almacenamiento de fotos y documentos.
│  └─ builder/           Campos del constructor de módulos.
├─ server/               Base de datos, autenticación y servicios.
├─ components/           Interfaz compartida.
├─ app/                  Rutas (Next.js App Router).
└─ i18n/es.ts            TODO el texto visible, en español.
```

Todo lo que hay bajo `src/core` es puro y está cubierto por pruebas, así que la
misma función que arma la tabla de amortización en el servidor corre en el
navegador para la vista previa en vivo — no hay dos versiones del cálculo que
se puedan desincronizar.

### Agregar un módulo nuevo

1. Agrega su entrada en `src/core/modules/registry.ts`.
2. Agrega sus textos en `src/i18n/es.ts`.
3. Crea la ruta en `src/app/(app)/<ruta>/page.tsx`.

El menú, los permisos y la pantalla de configuración se actualizan solos.

Para módulos que no requieren programar nada, usa el **Constructor de módulos**
dentro de la aplicación.

---

## Comandos

| Comando | Qué hace |
| --- | --- |
| `npm run dev` | Servidor de desarrollo. |
| `npm run build` / `npm start` | Compilar y servir en producción. |
| `npm test` | Pruebas del motor de cálculo. |
| `npm run typecheck` | Verificación de tipos. |
| `npm run lint` | ESLint. |
| `npm run db:push` / `db:migrate` / `db:seed` / `db:studio` | Base de datos. |
| `npm run mobile:sync` / `mobile:apk` | Empaquetado Android. |
