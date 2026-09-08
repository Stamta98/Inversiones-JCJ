# Mudar la aplicación a un VPS con CloudPanel

Guía para pasar Inversiones JCJ de Vercel + Supabase a un servidor propio.
Escrita contra un VPS de Hetzner con Ubuntu 24.04, 3 núcleos y 4 GB, pero
sirve igual en cualquier servidor con CloudPanel.

## Por qué mudarse

Hoy la aplicación corre en Vercel y la base de datos está en Supabase, en otro
centro de datos. Cada pantalla hace seis u ocho consultas, y **cada una cruza
internet**. En el VPS la aplicación y la base viven en la misma máquina: esas
consultas pasan de unos 20 milisegundos a menos de uno. Ahí está la mayor parte
de la lentitud, no en la distancia hasta el cobrador.

De paso se acaban dos cosas del plan gratuito: el arranque en frío de la
función en Vercel y la pausa por inactividad de la base en Supabase.

## Antes de empezar: dos decisiones

### 1. El dominio, y la app de los cobradores

**Esto es lo que puede salir mal de verdad.** El APK que tienen instalado los
cobradores no lleva la aplicación adentro: apunta a una dirección que quedó
grabada al compilarlo, y por defecto es `https://inversiones-jcj.vercel.app`.

Si apagas Vercel, **esa app deja de funcionar en todos los teléfonos**.

Así que hace falta un dominio propio, y hay que volver a compilar el APK
apuntándolo ahí. El flujo de trabajo `android-apk.yml` ya recibe la dirección
como parámetro, así que es una recompilación y una reinstalación, una sola vez.

El orden que evita quedarse sin cobrar un día:

1. Monta el VPS y deja la aplicación funcionando en el dominio nuevo.
2. Comprueba que todo esté bien **con Vercel todavía encendido**.
3. Compila el APK nuevo y que los cobradores lo instalen.
4. Recién ahí apaga Vercel.

### 2. Cuánto tiene que aguantar el servidor

Medido sobre este mismo proyecto:

| | Memoria |
| --- | --- |
| La aplicación corriendo | ~330 MB |
| PostgreSQL | ~100–400 MB |
| Compilar (`npm run build`) | pico de **1,3 GB** |

En operación normal es menos de 1 GB. El pico es al compilar. Con 4 GB va
sobrado, **salvo que el servidor ya tenga otros sitios ocupando memoria**. Si
los tiene y la compilación se queda sin memoria, añade intercambio antes:

```bash
fallocate -l 2G /swapfile && chmod 600 /swapfile
mkswap /swapfile && swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab
```

## Los pasos

### 1. Crear el sitio en CloudPanel

**Sitios → Añadir sitio → Crear un sitio Node.js**

| Campo | Qué poner |
| --- | --- |
| Nombre de dominio | El dominio que vas a usar |
| Versión de Node.js | Node 24 LTS |
| Puerto App | 3000, o 3001 si el 3000 ya está ocupado |
| Usuario del Sitio | `jcj` |
| Contraseña | Dale a **Generar nueva contraseña** y guárdala |

CloudPanel crea el directorio y el Nginx que reenvía al puerto, pero **no
ejecuta la aplicación**: de eso se encarga el servicio que monta el script.

### 2. Instalar

Por SSH, como root:

```bash
cd /home/jcj/htdocs/TU-DOMINIO.com
git clone -b claude/loans-web-app-multiplatform-8pl5sx \
  https://github.com/Stamta98/Inversiones-JCJ.git .
sudo bash deploy/vps/instalar.sh TU-DOMINIO.com jcj
```

El script instala PostgreSQL —CloudPanel solo administra MySQL y MariaDB, y
esta aplicación usa arreglos y enums que MySQL no tiene—, crea la base, escribe
la configuración, compila, deja la aplicación como servicio de systemd y
programa el trabajo por hora y los respaldos.

Se puede volver a correr cuando quieras: es como se actualiza.

### 3. Certificado y DNS

En CloudPanel, **Sitio → SSL/TLS → Nuevo certificado Let's Encrypt**. Y apunta
el DNS del dominio a la IP del servidor. El certificado necesita que el DNS ya
esté apuntando, así que primero el DNS.

### 4. Traer los datos

Con Vercel todavía encendido, pero **sin que nadie esté cobrando**: lo que se
registre en Supabase después de la copia no llega al servidor nuevo.

```bash
export SUPABASE_DB_URL="postgresql://postgres.xxxx:CLAVE@host:5432/postgres"
export SUPABASE_URL="https://xxxx.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="sb_secret_..."
bash deploy/vps/traer-datos.sh
```

Las fotos no necesitan que se toque la base: la clave de cada archivo es la
misma en Supabase y en disco (`<empresa>/<uuid>.jpg`), y lo que se guarda en la
base es `/api/files/<clave>` en los dos casos.

### 5. Comprobar antes de apagar nada

- Entra con tu usuario de siempre.
- Abre un cliente y mira que se vean sus fotos.
- Cuadra el total de préstamos con el que veías en Vercel.
- Registra un cobro de prueba y bórralo.
- Reinicia el servidor (`reboot`) y comprueba que la aplicación vuelve sola.

Ese último no te lo saltes: es la diferencia entre un reinicio a las tres de la
mañana que no se nota y una jornada de cobro perdida.

## Después

| Para | Comando |
| --- | --- |
| Ver si está viva | `systemctl status inversiones-jcj` |
| Leer los errores | `journalctl -u inversiones-jcj -f` |
| Actualizar | `sudo bash deploy/vps/instalar.sh TU-DOMINIO.com jcj` |
| Reiniciar | `systemctl restart inversiones-jcj` |

### Los respaldos son tuyos

CloudPanel respalda MySQL, no PostgreSQL. El script deja un `pg_dump` diario a
las 3:30 en `/var/backups`, rotando siete días.

**Eso no basta.** Están en el mismo disco que la base: si el disco falla, se
pierden los dos. Baja una copia fuera del servidor de vez en cuando:

```bash
scp root@TU-IP:/var/backups/jcj-1.dump ~/respaldos/
```

Y para restaurar:

```bash
systemctl stop inversiones-jcj
sudo -u postgres psql -d inversiones_jcj -c \
  "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
sudo -u postgres pg_restore --no-owner --no-acl \
  --dbname=inversiones_jcj /var/backups/jcj-1.dump
systemctl start inversiones-jcj
```

Prueba esa restauración **una vez, ahora**, cuando no la necesitas. Un respaldo
que nunca se ha restaurado no es un respaldo: es una suposición.
