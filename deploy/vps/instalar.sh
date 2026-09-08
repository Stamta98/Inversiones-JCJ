#!/usr/bin/env bash
#
# Instala Inversiones JCJ en un VPS con CloudPanel.
#
# Se ejecuta como root, una sola vez, DESPUÉS de haber creado el sitio Node.js
# en CloudPanel. Se puede volver a correr sin romper nada: cada paso comprueba
# antes de hacer.
#
# Lo que deja montado:
#   - PostgreSQL con su base y su usuario (CloudPanel no lo trae).
#   - El código, sus dependencias y la compilación.
#   - Un servicio de systemd, para que la app vuelva sola si el servidor se
#     reinicia. Sin esto, un reinicio a las tres de la mañana deja a los
#     cobradores sin app hasta que alguien se dé cuenta.
#   - El cron de los mensajes y el de los respaldos.
#
# Uso:
#   sudo bash instalar.sh midominio.com usuario-del-sitio
#
set -Eeuo pipefail

DOMINIO="${1:-}"
USUARIO="${2:-}"
PUERTO="${PUERTO:-3000}"
RAMA="${RAMA:-claude/loans-web-app-multiplatform-8pl5sx}"
REPO="${REPO:-https://github.com/Stamta98/Inversiones-JCJ.git}"

if [[ -z "$DOMINIO" || -z "$USUARIO" ]]; then
  echo "Uso: sudo bash instalar.sh <dominio> <usuario-del-sitio>" >&2
  echo "Ejemplo: sudo bash instalar.sh app.midominio.com jcj" >&2
  exit 1
fi
if [[ $EUID -ne 0 ]]; then
  echo "Esto se corre como root: sudo bash instalar.sh ..." >&2
  exit 1
fi

RAIZ="/home/${USUARIO}/htdocs/${DOMINIO}"
BASE="inversiones_jcj"
DBUSER="jcj"

paso() { printf "\n\033[1;36m==> %s\033[0m\n" "$*"; }
ok()   { printf "    \033[0;32m✓\033[0m %s\n" "$*"; }
aviso(){ printf "    \033[0;33m!\033[0m %s\n" "$*"; }

# ---------------------------------------------------------------------------
paso "Comprobando que el sitio exista en CloudPanel"
# El directorio lo crea CloudPanel al añadir el sitio Node.js. Si no está, es
# que el sitio no se creó o el usuario está mal escrito, y seguir solo
# esparciría archivos sueltos por el disco.
if [[ ! -d "/home/${USUARIO}/htdocs" ]]; then
  echo "No existe /home/${USUARIO}/htdocs." >&2
  echo "Crea primero el sitio Node.js en CloudPanel con ese usuario." >&2
  exit 1
fi
mkdir -p "$RAIZ"
ok "$RAIZ"

# ---------------------------------------------------------------------------
paso "Buscando Node"
# CloudPanel instala Node por su cuenta y no siempre queda en el PATH de root,
# así que se busca donde suele dejarlo antes de rendirse.
NODE_BIN=""
for cand in \
  "$(command -v node 2>/dev/null || true)" \
  /usr/lib/nodejs/*/bin/node \
  /home/"${USUARIO}"/.nvm/versions/node/*/bin/node
do
  [[ -n "$cand" && -x "$cand" ]] && NODE_BIN="$cand" && break
done
if [[ -z "$NODE_BIN" ]]; then
  echo "No encontré Node. Revisa que el sitio se creara como sitio Node.js." >&2
  exit 1
fi
NODE_DIR="$(dirname "$NODE_BIN")"
export PATH="${NODE_DIR}:${PATH}"
ok "$("$NODE_BIN" -v) en ${NODE_DIR}"

# ---------------------------------------------------------------------------
paso "Instalando PostgreSQL"
# CloudPanel solo administra MySQL y MariaDB. La app es PostgreSQL de verdad
# —usa arreglos y enums que MySQL no tiene—, así que va instalado aparte.
# Queda fuera del panel: los respaldos son cosa nuestra, y por eso este script
# programa uno más abajo.
if ! command -v psql >/dev/null 2>&1; then
  export DEBIAN_FRONTEND=noninteractive
  apt-get update -qq
  apt-get install -y -qq postgresql postgresql-contrib
  ok "PostgreSQL instalado"
else
  ok "PostgreSQL ya estaba"
fi
systemctl enable --now postgresql >/dev/null 2>&1 || true

# ---------------------------------------------------------------------------
paso "Creando la base y su usuario"
CLAVE_ARCHIVO="/root/.jcj-db-password"
if [[ -f "$CLAVE_ARCHIVO" ]]; then
  DBPASS="$(cat "$CLAVE_ARCHIVO")"
  ok "Reusando la contraseña guardada"
else
  DBPASS="$(openssl rand -base64 24 | tr -d '/+=' | head -c 28)"
  umask 077 && printf '%s' "$DBPASS" > "$CLAVE_ARCHIVO"
  ok "Contraseña nueva guardada en ${CLAVE_ARCHIVO}"
fi

sudo -u postgres psql -v ON_ERROR_STOP=1 <<SQL >/dev/null
DO \$\$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '${DBUSER}') THEN
    CREATE ROLE ${DBUSER} LOGIN PASSWORD '${DBPASS}';
  ELSE
    ALTER ROLE ${DBUSER} PASSWORD '${DBPASS}';
  END IF;
END
\$\$;
SQL
if ! sudo -u postgres psql -lqt | cut -d\| -f1 | grep -qw "$BASE"; then
  sudo -u postgres createdb -O "$DBUSER" "$BASE"
  ok "Base ${BASE} creada"
else
  ok "Base ${BASE} ya existía"
fi
# La app crea sus tablas con las migraciones, así que necesita mandar en el
# esquema público. En una base dedicada eso no le abre nada a nadie más.
sudo -u postgres psql -d "$BASE" -v ON_ERROR_STOP=1 \
  -c "GRANT ALL ON SCHEMA public TO ${DBUSER};" \
  -c "ALTER DATABASE ${BASE} OWNER TO ${DBUSER};" >/dev/null
ok "Permisos dados"

# ---------------------------------------------------------------------------
paso "Bajando el código"
if [[ -d "${RAIZ}/.git" ]]; then
  sudo -u "$USUARIO" git -C "$RAIZ" fetch origin "$RAMA"
  sudo -u "$USUARIO" git -C "$RAIZ" checkout "$RAMA"
  sudo -u "$USUARIO" git -C "$RAIZ" reset --hard "origin/${RAMA}"
  ok "Actualizado a lo último de ${RAMA}"
else
  # El directorio del sitio ya existe y git no clona sobre algo con contenido.
  sudo -u "$USUARIO" git clone --branch "$RAMA" "$REPO" "${RAIZ}.tmp"
  shopt -s dotglob
  mv "${RAIZ}.tmp"/* "$RAIZ"/
  shopt -u dotglob
  rmdir "${RAIZ}.tmp"
  chown -R "${USUARIO}:${USUARIO}" "$RAIZ"
  ok "Clonado en ${RAIZ}"
fi

# ---------------------------------------------------------------------------
paso "Escribiendo la configuración"
ENV="${RAIZ}/.env"
if [[ -f "$ENV" ]]; then
  aviso "Ya hay un .env — no lo toco. Bórralo si quieres uno nuevo."
else
  AUTH_SECRET="$(openssl rand -base64 48 | tr -d '\n')"
  JOBS_SECRET="$(openssl rand -base64 32 | tr -d '\n')"
  CONEXION="postgresql://${DBUSER}:${DBPASS}@127.0.0.1:5432/${BASE}"
  cat > "$ENV" <<ENVFILE
# Generado por deploy/vps/instalar.sh. No subir a git.

# La base vive en esta misma máquina: por eso 127.0.0.1 y no un servidor
# remoto. Ahí está la ganancia de velocidad de mudarse al VPS — las consultas
# de cada pantalla dejan de cruzar internet.
DATABASE_URL="${CONEXION}"
DIRECT_URL="${CONEXION}"

AUTH_SECRET="${AUTH_SECRET}"
APP_URL="https://${DOMINIO}"
PORT=${PUERTO}

# Disco de verdad, que es lo correcto en un VPS. Fuera de la carpeta del
# código para que un despliegue no se lleve por delante las fotos.
STORAGE_PROVIDER="local"
STORAGE_LOCAL_DIR="/home/${USUARIO}/jcj-archivos"

DEFAULT_CURRENCY="COP"
DEFAULT_TIMEZONE="America/Bogota"

# Con este secreto se dispara el trabajo por hora. Si se filtra, cualquiera
# puede hacer que la app mande mensajes a tus clientes.
JOBS_SECRET="${JOBS_SECRET}"

WHATSAPP_PROVIDER="log"
ENVFILE
  chown "${USUARIO}:${USUARIO}" "$ENV"
  chmod 600 "$ENV"
  ok "Escrito ${ENV}"
fi

mkdir -p "/home/${USUARIO}/jcj-archivos"
chown -R "${USUARIO}:${USUARIO}" "/home/${USUARIO}/jcj-archivos"
ok "Carpeta de fotos lista"

# ---------------------------------------------------------------------------
paso "Instalando dependencias y compilando"
# `npm run build` aplica las migraciones antes de compilar, así que este paso
# también deja la base con su estructura al día.
cd "$RAIZ"
sudo -u "$USUARIO" env PATH="$PATH" npm ci
sudo -u "$USUARIO" env PATH="$PATH" npm run build
ok "Compilado"

# ---------------------------------------------------------------------------
paso "Dejando la app como servicio"
# systemd y no PM2: es lo que ya trae el sistema, arranca sola en el reinicio y
# se revisa con los mismos comandos que todo lo demás del servidor.
cat > /etc/systemd/system/inversiones-jcj.service <<UNIT
[Unit]
Description=Inversiones JCJ
After=network.target postgresql.service
Wants=postgresql.service

[Service]
Type=simple
User=${USUARIO}
WorkingDirectory=${RAIZ}
EnvironmentFile=${RAIZ}/.env
ExecStart=${NODE_DIR}/npm run start
Restart=always
RestartSec=5
# Si la app se cae, que vuelva; y si se cae en bucle, que no se rinda para
# siempre a media jornada de cobro.
StartLimitIntervalSec=0

[Install]
WantedBy=multi-user.target
UNIT
systemctl daemon-reload
systemctl enable inversiones-jcj >/dev/null
systemctl restart inversiones-jcj
sleep 4
if systemctl is-active --quiet inversiones-jcj; then
  ok "Corriendo en el puerto ${PUERTO}"
else
  echo "El servicio no levantó. Mira: journalctl -u inversiones-jcj -n 50" >&2
  exit 1
fi

# ---------------------------------------------------------------------------
paso "Programando el trabajo por hora y los respaldos"
JOBS_SECRET_ACTUAL="$(grep -E '^JOBS_SECRET=' "$ENV" | cut -d'"' -f2)"

cat > /etc/cron.d/inversiones-jcj <<CRON
# Actualiza la mora y despacha los mensajes del día, cada hora.
0 * * * * root curl -fsS -X POST http://127.0.0.1:${PUERTO}/api/jobs/run -H 'x-jobs-secret: ${JOBS_SECRET_ACTUAL}' >/dev/null 2>&1

# Respaldo diario a las 3 de la mañana. CloudPanel no respalda PostgreSQL, así
# que esto no es un lujo: es lo único que hay entre un disco dañado y perder
# la cartera entera.
30 3 * * * postgres pg_dump -Fc ${BASE} > /var/backups/jcj-\$(date +\\%u).dump 2>/dev/null
CRON
chmod 644 /etc/cron.d/inversiones-jcj
mkdir -p /var/backups && chown postgres:postgres /var/backups
ok "Cron escrito (respaldos rotando siete días en /var/backups)"

# ---------------------------------------------------------------------------
printf "\n\033[1;32mListo.\033[0m\n\n"
cat <<FIN
Falta lo que no puedo hacer yo:

  1. En CloudPanel, apunta el sitio al puerto ${PUERTO} y dale el certificado
     SSL de Let's Encrypt (Sitio > SSL/TLS > Nuevo certificado).

  2. Apunta el DNS de ${DOMINIO} a la IP de este servidor.

  3. Trae los datos que están hoy en Supabase:
        bash deploy/vps/traer-datos.sh

Para ver cómo va:      systemctl status inversiones-jcj
Para leer los errores: journalctl -u inversiones-jcj -f
Para actualizar:       sudo bash deploy/vps/instalar.sh ${DOMINIO} ${USUARIO}

La contraseña de la base quedó en ${CLAVE_ARCHIVO} y dentro de ${ENV}.
FIN
