#!/usr/bin/env bash
# Restaura um backup do schema `plataforma` num Postgres DESCARTÁVEL em Docker,
# no Mac do dono — e só diz "RESTAURAÇÃO OK" se a contagem fechar.
#
#   bash restaurar-backup.sh <arquivo.dump.age> <arquivo.contagem> <chave-privada-age>
#
# Baixe os dois arquivos do bucket (mesmo nome, extensões .dump.age e .contagem).
# A chave PRIVADA `age` é só do dono e nunca esteve na VPS (D-10, T-09-70).
#
# D-21 / T-09-73: este script não recebe URL nem aponta para banco nenhum que
# não seja o contêiner que ele mesmo sobe e apaga no fim. Dado de produção
# nunca vai para a homologação.
#
# `pg_restore` roda DENTRO do contêiner, então a versão dele é a da imagem:
# a imagem precisa ser da versão do servidor que gerou o dump ou mais nova
# (um pg_restore mais velho que o dump recusa o arquivo). `PG_IMAGEM=postgres:17`
# troca. Se o Supabase for maior que o `postgres:16` padrão, troque.
#
# Variáveis: PG_IMAGEM (padrão postgres:16), PORTA (padrão 55699), AGE (padrão `age`),
# NOME_CONTEINER (padrão crm-n1-pg-restauracao-<pid>).
#
# A conferência (sonda SEG-09): `registros_antes` e `registros_depois` vêm do
# .contagem. Se iguais, o `count(*)` restaurado tem de ser exatamente esse
# número; se diferentes (houve escrita durante o dump), tem de estar dentro do
# intervalo. Erro do `pg_restore` vira aviso: quem decide é a contagem.
set -euo pipefail

DUMP="${1:?uso: restaurar-backup.sh <arquivo.dump.age> <arquivo.contagem> <chave-privada-age>}"
CONTAGEM="${2:?uso: restaurar-backup.sh <arquivo.dump.age> <arquivo.contagem> <chave-privada-age>}"
CHAVE="${3:?uso: restaurar-backup.sh <arquivo.dump.age> <arquivo.contagem> <chave-privada-age>}"
PG_IMAGEM="${PG_IMAGEM:-postgres:16}"
PORTA="${PORTA:-55699}"
AGE="${AGE:-age}"

for f in "$DUMP" "$CONTAGEM" "$CHAVE"; do
  [ -f "$f" ] || { echo "arquivo não encontrado: $f" >&2; exit 2; }
done
command -v docker >/dev/null 2>&1 || { echo "precisa do Docker" >&2; exit 2; }

ANTES="$(sed -n 's/^registros_antes=\([0-9][0-9]*\)$/\1/p' "$CONTAGEM")"
DEPOIS="$(sed -n 's/^registros_depois=\([0-9][0-9]*\)$/\1/p' "$CONTAGEM")"
if [ -z "$ANTES" ] || [ -z "$DEPOIS" ]; then
  echo "o .contagem não tem registros_antes= e registros_depois=" >&2
  exit 2
fi
if [ "$ANTES" -le "$DEPOIS" ]; then MIN="$ANTES"; MAX="$DEPOIS"; else MIN="$DEPOIS"; MAX="$ANTES"; fi

CONTEINER="${NOME_CONTEINER:-crm-n1-pg-restauracao-$$}"
limpar() {
  docker rm -f "$CONTEINER" >/dev/null 2>&1 || true
}
trap limpar EXIT

# Senha só deste contêiner descartável, que escuta em 127.0.0.1 e some no fim.
SENHA_DESCARTAVEL="$(od -An -N12 -tx1 /dev/urandom | tr -d ' \n')"
echo "== subindo $PG_IMAGEM na porta $PORTA (descartável)"
docker run -d --rm --name "$CONTEINER" -e POSTGRES_PASSWORD="$SENHA_DESCARTAVEL" \
  -p "127.0.0.1:$PORTA:5432" "$PG_IMAGEM" >/dev/null

pronto=0
for _ in $(seq 1 60); do
  # Duas respostas seguidas: a imagem sobe um servidor temporário no initdb.
  if docker exec "$CONTEINER" pg_isready -U postgres -q 2>/dev/null; then
    sleep 1
    if docker exec "$CONTEINER" pg_isready -U postgres -q 2>/dev/null \
      && docker exec "$CONTEINER" psql -U postgres -Atqc 'select 1' >/dev/null 2>&1; then
      pronto=1
      break
    fi
  fi
  sleep 1
done
[ "$pronto" = 1 ] || { echo "o Postgres descartável não respondeu em 60 s" >&2; exit 2; }

echo "== decifrando e restaurando"
set +e
"$AGE" --decrypt -i "$CHAVE" "$DUMP" \
  | docker exec -i "$CONTEINER" pg_restore -U postgres -d postgres --no-owner --no-acl
estados=("${PIPESTATUS[@]}")
set -e
if [ "${estados[0]}" -ne 0 ]; then
  echo "RESTAURAÇÃO FALHOU: o age não decifrou o dump (chave errada ou arquivo corrompido)" >&2
  exit 1
fi
if [ "${estados[1]}" -ne 0 ]; then
  echo "aviso: o pg_restore saiu com erro (${estados[1]}); quem decide é a contagem" >&2
fi

RESTAURADO="$(docker exec "$CONTEINER" psql -U postgres -Atqc 'select count(*) from plataforma.registros' 2>/dev/null || true)"
if ! [[ "$RESTAURADO" =~ ^[0-9]+$ ]]; then
  echo "RESTAURAÇÃO DIVERGE — não consegui contar plataforma.registros no banco restaurado (backup: antes=$ANTES depois=$DEPOIS)" >&2
  exit 1
fi

if [ "$RESTAURADO" -ge "$MIN" ] && [ "$RESTAURADO" -le "$MAX" ]; then
  echo "RESTAURAÇÃO OK — registros=$RESTAURADO (backup: antes=$ANTES depois=$DEPOIS)"
  exit 0
fi
echo "RESTAURAÇÃO DIVERGE — registros=$RESTAURADO fora do que o backup diz (antes=$ANTES depois=$DEPOIS)" >&2
exit 1
