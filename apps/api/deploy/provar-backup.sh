#!/usr/bin/env bash
# Prova, em Docker local, o caminho inteiro do backup (D-10, D-21, SEG-09):
#   dump -> cifra -> envio -> restauração -> contagem
#
#   bash apps/api/deploy/provar-backup.sh      # portas 55614 (origem) e 55615 (restauração)
#
# O `age` e o `rclone` são trocados por substitutos de teste (o `age` só copia
# a entrada para a saída; o `rclone` grava o que recebe numa pasta). O `age` e
# o `rclone` REAIS, o bucket e a chave de verdade são provados pelo dono em
# 09-18. O que esta prova garante é o resto: o pipe, a contagem antes/depois, a
# versão do `pg_dump`, a restauração e a recusa de uma contagem adulterada.
#
# O `pg_dump` é o da imagem `postgres:16` (pelo Docker), para a versão do
# cliente e a do servidor serem a mesma — o `pg_dump` do Homebrew costuma ser
# mais novo que o `pg_restore` do contêiner e o arquivo não abriria.
#
# Nada aqui toca a VPS, um bucket ou um banco real: o banco de origem é um
# contêiner descartável, e a pasta temporária e os contêineres saem no fim.
set -euo pipefail

AQUI="$(cd "$(dirname "$0")" && pwd)"
RAIZ="$(cd "$AQUI/../../.." && pwd)"
PORTA_ORIGEM=55614
PORTA_RESTAURACAO=55615
IMAGEM=postgres:16
ORIGEM="crm-n1-pg-0914-origem-$$"
RESTAURACAO="crm-n1-pg-0914-restauracao-$$"
TMP="$(mktemp -d)"
FALHAS=0

limpar() {
  docker rm -f "$ORIGEM" "$RESTAURACAO" >/dev/null 2>&1 || true
  rm -rf "$TMP"
}
trap limpar EXIT

ok() { echo "ok - $1"; }
falhou() {
  echo "FALHOU: $1"
  FALHAS=$((FALHAS + 1))
}

command -v docker >/dev/null 2>&1 || { echo "precisa do Docker" >&2; exit 1; }
command -v psql >/dev/null 2>&1 || { echo "precisa do psql no PATH" >&2; exit 1; }

# Senha só do contêiner descartável de origem.
SENHA="$(od -An -N12 -tx1 /dev/urandom | tr -d ' \n')"
URL="postgresql://postgres:$SENHA@127.0.0.1:$PORTA_ORIGEM/postgres"

mkdir -p "$TMP/bin" "$TMP/bucket"

# --- substitutos de teste ---------------------------------------------------
cat > "$TMP/bin/age-teste" <<'STUB'
#!/usr/bin/env bash
# Substituto de teste do age: NÃO cifra, só copia. Guarda os argumentos para a prova conferir o -R.
echo "$*" >> "$LOG_AGE"
decifrar=0
ultimo=""
for a in "$@"; do
  [ "$a" = "--decrypt" ] && decifrar=1
  ultimo="$a"
done
if [ "$decifrar" = 1 ] && [ -f "$ultimo" ]; then cat "$ultimo"; else cat; fi
STUB
cat > "$TMP/bin/rclone-teste" <<'STUB'
#!/usr/bin/env bash
# Substituto de teste do rclone: `rcat <destino>` grava a entrada na pasta do bucket de teste.
[ "${1:-}" = rcat ] || { echo "rclone-teste só sabe rcat" >&2; exit 64; }
echo "$*" >> "$LOG_RCLONE"
destino="${*: -1}"
cat > "$BUCKET_DE_TESTE/${destino##*/}"
STUB
cat > "$TMP/bin/pg_dump-docker" <<'STUB'
#!/usr/bin/env bash
# pg_dump do contêiner (mesma versão do servidor de prova). A conexão chega por PG* no
# ambiente; o localhost do Mac vira host.docker.internal dentro do contêiner.
host="${PGHOST:-127.0.0.1}"
case "$host" in 127.0.0.1|localhost) host=host.docker.internal ;; esac
exec docker run --rm -i --add-host=host.docker.internal:host-gateway \
  -e PGHOST="$host" -e PGPORT -e PGUSER -e PGPASSWORD -e PGDATABASE \
  "$IMAGEM_DE_TESTE" pg_dump "$@"
STUB
cat > "$TMP/bin/pg_dump-antigo" <<'STUB'
#!/usr/bin/env bash
# Finge um pg_dump 15 (mais velho que o servidor de prova, 16) para provar a recusa do Pitfall 10.
case "${1:-}" in --version) echo "pg_dump (PostgreSQL) 15.4"; exit 0 ;; esac
echo "pg_dump-antigo não deveria ter sido chamado para dumpar" >&2
exit 99
STUB
chmod +x "$TMP/bin/"*
echo "age1-recipient-publico-de-teste" > "$TMP/recipient"
echo "CHAVE-PRIVADA-DE-TESTE-SEM-VALOR" > "$TMP/chave-de-teste"

export LOG_AGE="$TMP/age.log" LOG_RCLONE="$TMP/rclone.log" BUCKET_DE_TESTE="$TMP/bucket" IMAGEM_DE_TESTE="$IMAGEM"
: > "$LOG_AGE"
: > "$LOG_RCLONE"

# --- Postgres de origem, migrado e com 3 registros --------------------------
echo "== subindo $IMAGEM de origem na porta $PORTA_ORIGEM"
docker run -d --rm --name "$ORIGEM" -e POSTGRES_PASSWORD="$SENHA" \
  -p "127.0.0.1:$PORTA_ORIGEM:5432" "$IMAGEM" >/dev/null
pronto=0
for _ in $(seq 1 60); do
  if docker exec "$ORIGEM" pg_isready -U postgres -q 2>/dev/null; then
    sleep 1
    if docker exec "$ORIGEM" psql -U postgres -Atqc 'select 1' >/dev/null 2>&1; then pronto=1; break; fi
  fi
  sleep 1
done
[ "$pronto" = 1 ] || { echo "o Postgres de origem não respondeu em 60 s" >&2; exit 1; }

echo "== migrando o contêiner de origem"
# As DUAS variáveis, local: o .env do apps/api pode ter DATABASE_URL_MIGRACAO
# apontando para um banco de verdade, e `migrar` usa essa de preferência.
(cd "$RAIZ" && DATABASE_URL="$URL" DATABASE_URL_MIGRACAO="$URL" npm run --silent migrar -w @n1/api >/dev/null)

semear() {
  docker exec "$ORIGEM" psql -U postgres -v ON_ERROR_STOP=1 -q -c \
    "insert into plataforma.registros (workspace_id, colecao, id, dados) values
       ('ws-prova', 'tasks', 't1', '{\"titulo\":\"um\"}'),
       ('ws-prova', 'tasks', 't2', '{\"titulo\":\"dois\"}'),
       ('ws-prova', 'tasks', 't3', '{\"titulo\":\"tres\"}')"
}
semear
registros_origem="$(docker exec "$ORIGEM" psql -U postgres -Atqc 'select count(*) from plataforma.registros')"
[ "$registros_origem" = 3 ] || { echo "esperava 3 registros na origem, achei $registros_origem" >&2; exit 1; }

rodar_backup() {
  env -u DATABASE_CA_PATH \
    DATABASE_URL_MIGRACAO="$URL" \
    BACKUP_DESTINO="n1backup:bucket-de-teste/plataforma" \
    BACKUP_RECIPIENT="$TMP/recipient" \
    AGE="$TMP/bin/age-teste" RCLONE="$TMP/bin/rclone-teste" PSQL="psql" \
    "$@"
}

# --- prova 1: cliente mais velho que o servidor é recusado (Pitfall 10) -----
set +e
saida_antigo="$(rodar_backup env PG_DUMP="$TMP/bin/pg_dump-antigo" bash "$AQUI/n1-crm-backup.sh" 2>&1)"
estado_antigo=$?
set -e
if [ "$estado_antigo" -ne 0 ] && printf '%s' "$saida_antigo" | grep -q "mais velho que o servidor" \
  && [ -z "$(ls -A "$TMP/bucket")" ]; then
  ok "prova 1: pg_dump mais velho que o servidor é recusado, e nada foi enviado ao bucket"
else
  falhou "prova 1: o backup com pg_dump 15 contra servidor 16 deveria parar com 'mais velho que o servidor' e não enviar nada (estado=$estado_antigo)"
fi

# --- prova 2: o backup roda, cifra por -R, envia por rcat e escreve a contagem
saida_backup="$(rodar_backup env PG_DUMP="$TMP/bin/pg_dump-docker" bash "$AQUI/n1-crm-backup.sh" 2>&1)" || {
  echo "$saida_backup" >&2
  falhou "prova 2: o n1-crm-backup.sh saiu com erro"
  saida_backup=""
}
DUMP_ENVIADO="$(ls "$TMP/bucket"/*.dump.age 2>/dev/null | head -1 || true)"
CONTAGEM_ENVIADA="$(ls "$TMP/bucket"/*.contagem 2>/dev/null | head -1 || true)"
if [ -n "$DUMP_ENVIADO" ] && [ -s "$DUMP_ENVIADO" ] && [ -n "$CONTAGEM_ENVIADA" ] \
  && printf '%s' "$saida_backup" | grep -qE '^backup ok: n1-crm-plataforma-[0-9]{8}T[0-9]{6}Z registros=3\.\.3$' \
  && grep -qx 'registros_antes=3' "$CONTAGEM_ENVIADA" && grep -qx 'registros_depois=3' "$CONTAGEM_ENVIADA" \
  && grep -q -- "-R $TMP/recipient" "$LOG_AGE" \
  && grep -q -- '--s3-no-check-bucket' "$LOG_RCLONE"; then
  ok "prova 2: dump enviado por age -R e rclone rcat --s3-no-check-bucket, com .contagem antes=3 depois=3"
else
  falhou "prova 2: dump/contagem não foram enviados como o contrato manda (saída: $saida_backup)"
fi
if printf '%s' "$saida_backup" | grep -q "$SENHA"; then
  falhou "prova 2: a senha do banco apareceu na saída do backup"
fi

restaurar() {
  PORTA="$PORTA_RESTAURACAO" NOME_CONTEINER="$RESTAURACAO" AGE="$TMP/bin/age-teste" \
    bash "$AQUI/restaurar-backup.sh" "$DUMP_ENVIADO" "$1" "$TMP/chave-de-teste"
}

# --- prova 3: a restauração fecha a contagem --------------------------------
set +e
saida_restauracao="$(restaurar "$CONTAGEM_ENVIADA" 2>&1)"
estado_restauracao=$?
set -e
if [ "$estado_restauracao" -eq 0 ] && printf '%s' "$saida_restauracao" | grep -q 'RESTAURAÇÃO OK — registros=3 '; then
  ok "prova 3: restauração decifra, restaura e confere registros=3 (RESTAURAÇÃO OK)"
else
  echo "$saida_restauracao" >&2
  falhou "prova 3: a restauração não terminou com 'RESTAURAÇÃO OK — registros=3' (estado=$estado_restauracao)"
fi

# --- prova 4: intervalo (houve escrita no meio do dump) ---------------------
printf 'registros_antes=2\nregistros_depois=4\n' > "$TMP/contagem-intervalo"
set +e
saida_intervalo="$(restaurar "$TMP/contagem-intervalo" 2>&1)"
estado_intervalo=$?
set -e
if [ "$estado_intervalo" -eq 0 ] && printf '%s' "$saida_intervalo" | grep -q 'RESTAURAÇÃO OK — registros=3 (backup: antes=2 depois=4)'; then
  ok "prova 4: com escrita no meio (antes=2, depois=4), 3 restaurados caem no intervalo e passam"
else
  echo "$saida_intervalo" >&2
  falhou "prova 4: contagem restaurada dentro do intervalo deveria passar (estado=$estado_intervalo)"
fi

# --- prova 5: contagem adulterada faz a restauração falhar ------------------
printf 'registros_antes=99\nregistros_depois=99\n' > "$TMP/contagem-adulterada"
set +e
saida_adulterada="$(restaurar "$TMP/contagem-adulterada" 2>&1)"
estado_adulterada=$?
set -e
if [ "$estado_adulterada" -eq 1 ] && printf '%s' "$saida_adulterada" | grep -q 'RESTAURAÇÃO DIVERGE' \
  && ! printf '%s' "$saida_adulterada" | grep -q 'RESTAURAÇÃO OK'; then
  ok "prova 5: contagem adulterada (99) faz a restauração sair 1 com RESTAURAÇÃO DIVERGE"
else
  echo "$saida_adulterada" >&2
  falhou "prova 5: contagem adulterada deveria sair 1 com 'RESTAURAÇÃO DIVERGE' (estado=$estado_adulterada)"
fi

# --- prova 6: os contêineres de restauração sumiram -------------------------
if docker ps -a --format '{{.Names}}' | grep -q "^$RESTAURACAO\$"; then
  falhou "prova 6: o contêiner de restauração não foi removido"
else
  ok "prova 6: o contêiner de restauração foi apagado no fim"
fi

[ "$FALHAS" = 0 ] || exit 1
