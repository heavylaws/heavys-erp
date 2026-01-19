#!/bin/bash
set -euo pipefail

APP_DIR=/opt/highway-cafe-pos
DB_NAME=highway_cafe
DB_USER=highway_cafe_user
DB_PASS='choose_a_strong_password'

sudo apt update
sudo apt install -y curl git build-essential

if ! command -v node >/dev/null; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt install -y nodejs
fi

sudo apt install -y postgresql postgresql-contrib

sudo -u postgres psql <<SQL
DO \$\$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_database WHERE datname = '${DB_NAME}') THEN
    CREATE DATABASE ${DB_NAME};
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '${DB_USER}') THEN
    CREATE USER ${DB_USER} WITH ENCRYPTED PASSWORD '${DB_PASS}';
  END IF;
  GRANT ALL PRIVILEGES ON DATABASE ${DB_NAME} TO ${DB_USER};
END
\$\$;
SQL

sudo mkdir -p ${APP_DIR}
sudo chown $(whoami):$(whoami) ${APP_DIR}

if [ ! -d "${APP_DIR}/.git" ]; then
  git clone https://github.com/heavylaws/Cafe24Pos.git ${APP_DIR}
else
  cd ${APP_DIR}
  git pull --ff-only
fi

cd ${APP_DIR}
npm ci --omit=dev

if [ ! -f .env ]; then
  cp .env.example .env
  sed -i "s#^DATABASE_URL=.*#DATABASE_URL=postgresql://${DB_USER}:${DB_PASS}@localhost:5432/${DB_NAME}#g" .env
  sed -i "s/^SESSION_SECRET=.*$/SESSION_SECRET=$(openssl rand -hex 32)/" .env
  sed -i "s/^PORT=.*$/PORT=5000/" .env
fi

npm run build
