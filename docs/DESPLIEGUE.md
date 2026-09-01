# Poner la aplicación en línea

La base de datos ya está en Supabase y lista. Falta un lugar donde corra la
aplicación. Esta guía usa **Vercel** porque es gratis para empezar, se conecta
solo con GitHub y da una dirección `https://` que sirve igual en la computadora
y en el celular.

Toma unos 10 minutos y se hace una sola vez.

---

## Antes de empezar

Necesitas la **contraseña de la base de datos** de Supabase. No se puede
consultar: se ve una sola vez al crear el proyecto. Si no la tienes a mano:

> Supabase → tu proyecto → *Project Settings* → *Database* → **Reset database
> password**

Anótala. La vas a pegar dos veces en el paso 2.

---

## 1. Crear el proyecto en Vercel

1. Entra a [vercel.com](https://vercel.com) y crea la cuenta con **GitHub**.
2. *Add New…* → *Project*.
3. Busca el repositorio **Inversiones-JCJ** e *Import*.
4. En *Framework Preset* debe decir **Next.js**. No cambies nada más.
5. **No le des a Deploy todavía** — primero abre *Environment Variables* y haz
   el paso 2.

---

## 2. Las variables de entorno

Pégalas en *Environment Variables*, una por una. Donde dice `TU_CONTRASEÑA`, pon
la contraseña de la base de datos.

| Nombre | Valor |
| --- | --- |
| `DATABASE_URL` | `postgresql://postgres.ivhmbqqiccegjoyayvhv:TU_CONTRASEÑA@aws-0-us-east-2.pooler.supabase.com:6543/postgres?pgbouncer=true` |
| `DIRECT_URL` | `postgresql://postgres.ivhmbqqiccegjoyayvhv:TU_CONTRASEÑA@aws-0-us-east-2.pooler.supabase.com:5432/postgres` |
| `AUTH_SECRET` | *(el que te pasé por chat)* |
| `JOBS_SECRET` | *(el que te pasé por chat)* |
| `STORAGE_PROVIDER` | `supabase` |
| `SUPABASE_URL` | `https://ivhmbqqiccegjoyayvhv.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | *(ver abajo)* |
| `SUPABASE_STORAGE_BUCKET` | `customer-files` |
| `DEFAULT_CURRENCY` | `DOP` |
| `DEFAULT_TIMEZONE` | `America/Santo_Domingo` |
| `DEFAULT_LOCALE` | `es` |

**La `SUPABASE_SERVICE_ROLE_KEY`** la sacas de Supabase → *Project Settings* →
*API Keys*. Si el proyecto usa el formato nuevo de claves, la que sirve está en
**Secret keys** y empieza por `sb_secret_` — **no** la de *Publishable key*, que
es pública. En proyectos viejos es la `service_role` de *Legacy API Keys*. Las
dos cumplen la misma función y la variable se sigue llamando igual.

Esa clave **salta todas las protecciones de la base de datos**: no la pegues en
un chat, ni en el código, ni se la mandes a nadie. Solo en Vercel. Si se te
escapa, bórrala y crea otra desde esa misma pantalla.

> `STORAGE_PROVIDER` tiene que ser `supabase`. Vercel borra el disco en cada
> despliegue, así que con `local` las fotos de los clientes se perderían.

### Cuidado con las variables duplicadas

Vercel lee los nombres de `.env.example` y los precarga **vacíos**. Si además
cargas un archivo con *Import .env*, los añade encima y quedan repetidos: sale
*"A variable with the name X already exists"* y no deja continuar.

La regla para limpiarlo: **si la fila tiene valor se queda, si está vacía se
borra** (botón `−` a la derecha del nombre). Deben quedar solo las de la tabla
de arriba.

Ahora sí: **Deploy**.

---

## 3. La rama de producción

Vercel toma como rama de producción la que sea **la rama por defecto del
repositorio en el momento de importar**, no necesariamente `main`. Se ve y se
cambia en *Settings → Environments → Production → Branch Tracking*.

Solo se despliega a producción lo que se sube a esa rama; cualquier otra rama
genera un *preview* con su propia dirección. Si la página principal del
proyecto dice **"No Production Deployment"**, es que a esa rama todavía no ha
llegado ningún push desde que se creó el proyecto: haz uno y el despliegue
arranca solo.

## 4. Terminar de configurar

Cuando termine, Vercel te da una dirección tipo
`https://inversiones-jcj.vercel.app`. Agrega una variable más con esa dirección
y vuelve a desplegar (*Deployments* → los tres puntos → *Redeploy*):

| Nombre | Valor |
| --- | --- |
| `APP_URL` | la dirección que te dio Vercel |

---

## 5. Entrar y cambiar la contraseña

Entra a tu dirección `/login` con:

- **Correo:** `admin@inversionesjcj.com`
- **Contraseña:** `Cambiar123`

**Lo primero que tienes que hacer es cambiar esa contraseña**, en *Perfil →
Cambiar la contraseña*. Está publicada en la documentación de este repositorio,
así que cualquiera que lo lea puede entrar mientras no la cambies. La aplicación
te lo va a avisar con una alerta roja hasta que lo hagas.

Haz lo mismo con la cuenta del cobrador (`cobrador@inversionesjcj.com`), desde
*Configuración → Usuarios → Cambiar la contraseña*, o bórrala si no la vas a
usar todavía.

---

## 6. Instalarla en el celular

No hace falta el APK para empezar. La aplicación es instalable desde el
navegador:

- **Android (Chrome):** abre la dirección → menú ⋮ → *Instalar aplicación*.
- **iPhone (Safari):** abre la dirección → *Compartir* → *Añadir a pantalla de
  inicio*.

Queda con su ícono, a pantalla completa, igual que una app instalada. La cámara
y el GPS funcionan porque el sitio va por `https://`.

El APK de Android sirve para publicarla en Play Store más adelante; para usarla
en el día a día no cambia nada.

---

## Los mensajes automáticos de cobranza

`vercel.json` ya deja programado `/api/jobs/run` cada hora. Ese trabajo
actualiza la mora de todos los préstamos y despacha los mensajes del día.

Dos cosas a tener en cuenta:

1. **El plan gratis de Vercel limita cuántas veces corre el cron** (suele ser
   una vez al día). Si necesitas que corra cada hora sin pagar el plan Pro, usa
   un programador externo gratuito como [cron-job.org](https://cron-job.org)
   apuntando a:

   ```
   GET https://tu-dominio.vercel.app/api/jobs/run
   Authorization: Bearer TU_JOBS_SECRET
   ```

2. **No sale ningún mensaje hasta que conectes una cuenta de WhatsApp de
   verdad**, en *Mensajería → Conectar cuenta*. Mientras tanto el proveedor es
   `log`: la aplicación registra lo que hubiera mandado, sin mandarlo. Sirve
   para revisar los textos con calma antes de que le lleguen a un cliente.

---

## Si algo falla

| Síntoma | Causa casi siempre |
| --- | --- |
| El build falla en `prisma generate` | Falta `DIRECT_URL`. |
| `Can't reach database server` | La contraseña de la base está mal, o le falta `?pgbouncer=true` a `DATABASE_URL`. |
| Entra pero no guarda fotos | `STORAGE_PROVIDER` no está en `supabase`, o falta la `service_role`. |
| `Unauthorized` en `/api/jobs/run` | El `JOBS_SECRET` de la petición no es el mismo que el de Vercel. |

Los errores completos están en Vercel → tu proyecto → *Logs*.
