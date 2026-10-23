#!/usr/bin/env bash
# Backup diário do schema `plataforma` — Fase 9, D-10 (1.7.3).
#
#   pg_dump -Fc --schema=plataforma --no-owner --no-acl
#     | age -R <recipient público>
#     | rclone rcat --s3-no-check-bucket <destino>/<nome>.dump.age
#
# O dump NUNCA toca o disco da VPS, nem em claro nem cifrado: é um pipe do
# `pg_dump` ao bucket (D-10, T-09-69). Roda como `oneshot` do
# `n1-crm-backup.timer`, instalado por `instalar-backup.sh` em
# /opt/n1-crm/bin/n1-crm-backup.sh (cópia do root, independente da versão no ar).
#
# A VPS só tem o recipient PÚBLICO (`age1…`): a chave privada nasce e fica com
# o dono, no Mac, e é com ela que `restaurar-backup.sh` decifra (D-21,
# T-09-70). A expiração (14 dias) é regra de ciclo de vida do bucket, não deste
# script. Backup é só de produção: a homologação não tem dado real e não ganha
# timer (D-21).
#
# Contagem antes e depois (sonda SEG-09). O `pg_dump` enxerga um instantâneo
# único, mas o dono não sabe a que instante ele corresponde: o script conta
# `plataforma.registros` imediatamente antes e imediatamente depois, e grava
# as duas num arquivo `.contagem` ao lado do dump. A restauração compara o
# `count(*)` restaurado com esse arquivo. O `.contagem` é enviado por último:
# dump sem `.contagem` no bucket é um backup incompleto (o pipe quebrou no meio)
# e não deve ser usado.
#
# Variáveis (do `api.env` e do `backup.env`, ver o .service):
#   DATABASE_URL_MIGRACAO  obrigatória — o dono do banco (lê tudo de `plataforma`)
#   DATABASE_CA_PATH       opcional — com ela, TLS verificado (verify-full)
#   BACKUP_DESTINO         obrigatória — ex.: n1backup:<bucket>/plataforma
#   BACKUP_RECIPIENT       arquivo de recipient do `age` (padrão /opt/n1-crm/shared/backup.recipient)
#   RCLONE_CONFIG          lido pelo próprio rclone (padrão /opt/n1-crm/shared/rclone.conf)
#   AGE, RCLONE, PG_DUMP, PSQL  binários trocáveis (padrão: os do PATH)
#
# Nada é impresso da URL nem de senha: a conexão vai por PG* no ambiente, não
# por argumento (que apareceria no `ps` de uma VPS compartilhada).
set -euo pipefail

: "${DATABASE_URL_MIGRACAO:?DATABASE_URL_MIGRACAO não definida (vem do api.env)}"
: "${BACKUP_DESTINO:?BACKUP_DESTINO não definido (vem do backup.env; ex.: n1backup:<bucket>/plataforma)}"
BACKUP_RECIPIENT="${BACKUP_RECIPIENT:-/opt/n1-crm/shared/backup.recipient}"
AGE="${AGE:-age}"
RCLONE="${RCLONE:-rclone}"
PG_DUMP="${PG_DUMP:-pg_dump}"
PSQL="${PSQL:-psql}"

falhar() {
  echo "backup FALHOU: $1" >&2
  exit 1
}

[ -s "$BACKUP_RECIPIENT" ] || falhar "o arquivo de recipient do age não existe ou está vazio ($BACKUP_RECIPIENT)"

# Decompõe a URL em PGHOST/PGPORT/PGUSER/PGPASSWORD/PGDATABASE. Sem imprimir
# a URL, nem no erro.
decodificar() {
  local s="${1//\\/\\\\}"
  printf '%b' "${s//%/\\x}"
}
RE_URL='^postgres(ql)?://([^:@/]+)(:([^@]*))?@(\[[^]]+\]|[^:/?]+)(:([0-9]+))?(/([^?]*))?(\?.*)?$'
if [[ "$DATABASE_URL_MIGRACAO" =~ $RE_URL ]]; then
  PGUSER="$(decodificar "${BASH_REMATCH[2]}")"
  PGPASSWORD="$(decodificar "${BASH_REMATCH[4]}")"
  PGHOST="${BASH_REMATCH[5]}"
  PGPORT="${BASH_REMATCH[7]:-5432}"
  PGDATABASE="$(decodificar "${BASH_REMATCH[9]:-postgres}")"
  export PGUSER PGPASSWORD PGHOST PGPORT PGDATABASE
else
  falhar "DATABASE_URL_MIGRACAO não está no formato postgresql://usuário:senha@host:porta/banco"
fi
if [ -n "${DATABASE_CA_PATH:-}" ]; then
  [ -r "$DATABASE_CA_PATH" ] || falhar "DATABASE_CA_PATH não é legível ($DATABASE_CA_PATH)"
  export PGSSLMODE=verify-full
  export PGSSLROOTCERT="$DATABASE_CA_PATH"
fi

# Pitfall 10: um pg_dump mais velho que o servidor aborta no meio. Pior: pode
# abortar DEPOIS de o `rcat` ter aberto o objeto. Melhor parar antes de tudo.
VERSAO_SERVIDOR_NUM="$("$PSQL" -Atq -c 'show server_version_num')" \
  || falhar "não consegui consultar a versão do servidor (conexão, senha ou CA)"
MAIOR_SERVIDOR=$((VERSAO_SERVIDOR_NUM / 10000))
MAIOR_CLIENTE="$("$PG_DUMP" --version | grep -oE '[0-9]+' | head -1)"
[ -n "$MAIOR_CLIENTE" ] || falhar "não consegui ler a versão do pg_dump"
if [ "$MAIOR_CLIENTE" -lt "$MAIOR_SERVIDOR" ]; then
  falhar "o pg_dump da VPS é o $MAIOR_CLIENTE e o servidor é o $MAIOR_SERVIDOR (cliente mais velho que o servidor): instale o postgresql-client-$MAIOR_SERVIDOR do repositório PGDG e ponha-o em PG_DUMP"
fi

contar() {
  "$PSQL" -Atq -c 'select count(*) from plataforma.registros'
}

NOME="n1-crm-plataforma-$(date -u +%Y%m%dT%H%M%SZ)"
ANTES="$(contar)" || falhar "não consegui contar plataforma.registros antes do dump"

"$PG_DUMP" -Fc --schema=plataforma --no-owner --no-acl \
  | "$AGE" -R "$BACKUP_RECIPIENT" \
  | "$RCLONE" rcat --s3-no-check-bucket "$BACKUP_DESTINO/$NOME.dump.age" \
  || falhar "o pipe pg_dump | age | rclone falhou — o objeto $NOME.dump.age, se existir no bucket, está incompleto (não há .contagem)"

DEPOIS="$(contar)" || falhar "não consegui contar plataforma.registros depois do dump"

printf 'registros_antes=%s\nregistros_depois=%s\n' "$ANTES" "$DEPOIS" \
  | "$RCLONE" rcat --s3-no-check-bucket "$BACKUP_DESTINO/$NOME.contagem" \
  || falhar "o envio do .contagem falhou — o backup $NOME não pode ser conferido"

echo "backup ok: $NOME registros=$ANTES..$DEPOIS"
