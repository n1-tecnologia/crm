#!/usr/bin/env bash
# Prova, num nginx real em Docker, o que n1-crm-limites.conf e o site prometem:
#   1. 50 POST seguidos do mesmo IP a /v1/public/forms/<segredo>/submissions:
#      ao menos 30 recebem 429 e o primeiro 429 cai entre a 11ª e a 20ª chamada;
#   2. 50 GET seguidos a /v1/public/forms/<segredo>: nenhum recebe 429;
#   3. nenhum log do nginx (acesso e erro, arquivo e saída do contêiner) guarda
#      o segredo, e o acesso mostra /v1/public/forms/***.
#
#   bash apps/api/deploy/provar-nginx.sh        # PORTA_DE_PROVA=18609 por padrão
#
# Só usa os arquivos deste diretório e uma imagem pública do nginx; não toca em
# VPS nem em domínio nenhum. O contêiner e a pasta temporária saem no fim.
# O dono repete o mesmo roteiro na VPS (deploy/CONTEXT.md).
#
# Um segundo `server` faz de upstream: um `return 200` no location rodaria antes
# do limit_req (fase de reescrita) e pareceria que o limite não funciona.
set -euo pipefail

AQUI="$(cd "$(dirname "$0")" && pwd)"
PORTA="${PORTA_DE_PROVA:-18609}"
SEGREDO=SEGREDOPROVA0906
IMAGEM=nginx:stable-alpine
CONTEINER="n1-prova-nginx-$$"
TMP="$(mktemp -d)"
FALHAS=0

limpar() {
  docker rm -f "$CONTEINER" >/dev/null 2>&1 || true
  rm -rf "$TMP"
}
trap limpar EXIT

falhou() {
  echo "FALHOU: $1"
  FALHAS=$((FALHAS + 1))
}

mkdir -p "$TMP/conf.d"
cp "$AQUI/n1-crm-limites.conf" "$TMP/conf.d/00-n1-crm-limites.conf"
sed "s/__DOMINIO__/localhost/g; s/__PORTA__/8081/g; s/__SITE__/n1-crm-api/g" \
  "$AQUI/nginx-n1-crm-api.conf" > "$TMP/conf.d/10-site.conf"
cat > "$TMP/conf.d/20-upstream.conf" <<'EOF'
server {
    listen 8081;
    # O upstream de prova é o Node da VPS: não tem o access_log padrão do nginx.
    access_log off;
    location / { return 200 "ok\n"; }
}
EOF
# O nginx do contêiner roda como outro usuário: a pasta precisa ser legível.
chmod -R a+rX "$TMP"

echo "== nginx -t"
docker run --rm -v "$TMP/conf.d:/etc/nginx/conf.d:ro" "$IMAGEM" nginx -t

echo "== subindo $CONTEINER na porta $PORTA"
docker run -d --rm --name "$CONTEINER" -p "127.0.0.1:$PORTA:80" \
  -v "$TMP/conf.d:/etc/nginx/conf.d:ro" "$IMAGEM" >/dev/null

pronto=0
for _ in $(seq 1 50); do
  if curl -s -o /dev/null "http://127.0.0.1:$PORTA/"; then pronto=1; break; fi
  sleep 0.2
done
[ "$pronto" = 1 ] || { echo "FALHOU: o nginx não respondeu em 10 s" >&2; exit 1; }

URL="http://127.0.0.1:$PORTA/v1/public/forms/$SEGREDO"

# Prova 1: POST limitado por IP.
codigos_post="$(for _ in $(seq 1 50); do
  curl -s -o /dev/null -w '%{http_code}\n' -X POST "$URL/submissions"
done)"
total_429="$(printf '%s\n' "$codigos_post" | grep -c '^429$' || true)"
primeiro_429="$(printf '%s\n' "$codigos_post" | grep -n '^429$' | head -1 | cut -d: -f1 || true)"
if [ "$total_429" -lt 30 ]; then
  falhou "prova 1 (POST): só $total_429 de 50 respostas 429 (esperado: 30 ou mais)"
elif [ -z "$primeiro_429" ] || [ "$primeiro_429" -lt 11 ] || [ "$primeiro_429" -gt 20 ]; then
  falhou "prova 1 (POST): o primeiro 429 foi na chamada ${primeiro_429:-nenhuma} (esperado: entre a 11ª e a 20ª)"
else
  echo "ok - prova 1 (POST): $total_429 de 50 respostas 429, o primeiro na chamada $primeiro_429"
fi

# Prova 2: GET com teto próprio, acima do que a página faz.
codigos_get="$(for _ in $(seq 1 50); do
  curl -s -o /dev/null -w '%{http_code}\n' "$URL"
done)"
get_429="$(printf '%s\n' "$codigos_get" | grep -c '^429$' || true)"
if [ "$get_429" -ne 0 ]; then
  falhou "prova 2 (GET): $get_429 de 50 respostas 429 (esperado: nenhuma)"
else
  echo "ok - prova 2 (GET): 50 respostas sem nenhum 429"
fi

# Prova 3: o segredo não está em nenhum log; o acesso mostra a máscara.
logs="$(docker exec "$CONTEINER" sh -c 'cat /var/log/nginx/n1-crm-api*.log 2>/dev/null' || true)"
saida="$(docker logs "$CONTEINER" 2>&1 || true)"
if [ -z "$logs" ]; then
  falhou "prova 3 (logs): os arquivos de log do nginx estão vazios"
elif printf '%s\n%s\n' "$logs" "$saida" | grep -q "$SEGREDO"; then
  falhou "prova 3 (logs): o segredo apareceu em log do nginx"
elif ! printf '%s\n' "$logs" | grep -q '/v1/public/forms/\*\*\*'; then
  falhou "prova 3 (logs): o acesso não mostra /v1/public/forms/***"
else
  echo "ok - prova 3 (logs): nenhum log guarda o segredo e o acesso mostra /v1/public/forms/***"
fi

[ "$FALHAS" = 0 ] || exit 1
