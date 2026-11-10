#!/usr/bin/env bash
# Prova, num nginx real em Docker, o que n1-crm-limites.conf e o site prometem:
#   1. 50 POST seguidos do mesmo IP a /v1/public/forms/<segredo>/submissions:
#      ao menos 30 recebem 429 e o primeiro 429 cai entre a 11ª e a 20ª chamada;
#   2. 50 GET seguidos a /v1/public/forms/<segredo>: nenhum recebe 429;
#   3. nenhum log do nginx (acesso e erro, arquivo e saída do contêiner) guarda
#      o segredo, e o acesso mostra /v1/public/forms/***;
#   4. (Fase 16, Pitfall 5) um fluxo `text/event-stream` com `X-Accel-Buffering: no`
#      passa pelo `location /` do site e entrega o primeiro quadro em menos de 1 s,
#      enquanto o upstream segura a resposta por 3 s. O mesmo fluxo SEM o cabeçalho
#      é medido só como informação: o nginx 1.30 do contêiner não o segurou, e o
#      cabeçalho continua sendo a garantia que a rota manda (não é o que a prova exige).
#
#   bash apps/api/deploy/provar-nginx.sh        # PORTA_DE_PROVA=18609 por padrão
#
# Só usa os arquivos deste diretório e uma imagem pública do nginx; não toca em
# VPS nem em domínio nenhum. O contêiner e a pasta temporária saem no fim.
# O dono repete o mesmo roteiro na VPS (deploy/CONTEXT.md).
#
# A prova 4 usa um contêiner `node:24-alpine` na rede do contêiner do nginx (só
# para segurar o fluxo); nada toca a VPS.
#
# Um segundo `server` faz de upstream: um `return 200` no location rodaria antes
# do limit_req (fase de reescrita) e pareceria que o limite não funciona.
set -euo pipefail

AQUI="$(cd "$(dirname "$0")" && pwd)"
PORTA="${PORTA_DE_PROVA:-18609}"
SEGREDO=SEGREDOPROVA0906
IMAGEM=nginx:stable-alpine
CONTEINER="n1-prova-nginx-$$"
UPSTREAM_SSE="n1-prova-sse-$$"
IMAGEM_NODE=node:24-alpine
TMP="$(mktemp -d)"
FALHAS=0

limpar() {
  docker rm -f "$UPSTREAM_SSE" >/dev/null 2>&1 || true
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
# Prova 4: o MESMO modelo de site, num segundo nome (sse.localhost) que aponta para o
# Node de prova na 8082 — o location / real, sem o limite das rotas públicas.
sed "s/__DOMINIO__/sse.localhost/g; s/__PORTA__/8082/g; s/__SITE__/sse-prova/g" \
  "$AQUI/nginx-n1-crm-api.conf" > "$TMP/conf.d/11-site-sse.conf"
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

# Prova 4: o fluxo de eventos não fica preso no buffer do nginx (T-16-57). O upstream
# (Node, na rede do contêiner do nginx) responde `text/event-stream` e manda o
# cabeçalho na hora; 100 ms depois escreve `: aberto`, espera 3 s e fecha. O nginx
# repassa o cabeçalho sempre, então a medida é o tempo do primeiro QUADRO (a primeira
# linha do corpo), não do primeiro byte. A prova exige menos de 1 s COM o cabeçalho; o
# tempo SEM ele sai só como informação (o nginx 1.30 de `stable-alpine` não segurou o
# fluxo nem assim, mas versões e configurações com buffer maior seguram).
docker run -d --rm --name "$UPSTREAM_SSE" --network "container:$CONTEINER" "$IMAGEM_NODE" node -e '
const http = require("http");
http.createServer((req, res) => {
  const cabecalhos = { "content-type": "text/event-stream", "cache-control": "no-cache" };
  if (req.url.startsWith("/eventos-de-prova")) cabecalhos["x-accel-buffering"] = "no";
  res.writeHead(200, cabecalhos);
  res.flushHeaders();
  setTimeout(() => res.write(": aberto\n\n"), 100);
  setTimeout(() => res.end(), 3000);
}).listen(8082, "127.0.0.1", () => console.log("pronto"));
' >/dev/null
pronto_sse=0
for _ in $(seq 1 100); do
  if docker logs "$UPSTREAM_SSE" 2>&1 | grep -q '^pronto$'; then pronto_sse=1; break; fi
  sleep 0.2
done
[ "$pronto_sse" = 1 ] || { echo "FALHOU: o upstream de prova do SSE não subiu em 20 s" >&2; exit 1; }

# Milissegundos até a primeira linha do corpo de um GET ao site `sse.localhost`
# (perl para o relógio: o `date` do macOS não tem nanossegundos). Imprime só o número.
primeiro_quadro_ms() {
  curl -sN --max-time 6 -H 'Host: sse.localhost' "http://127.0.0.1:$PORTA$1" 2>/dev/null \
    | perl -MTime::HiRes=time -e '$t = time; $l = <STDIN>; printf "%d\n", defined $l ? (time - $t) * 1000 : 99999;' || true
}

com_cabecalho_ms="$(primeiro_quadro_ms /eventos-de-prova)"
sem_cabecalho_ms="$(primeiro_quadro_ms /sem-cabecalho)"
if [ -z "$com_cabecalho_ms" ] || [ -z "$sem_cabecalho_ms" ]; then
  falhou "prova 4 (SSE): não foi possível medir (curl ou perl ausente?)"
elif [ "$com_cabecalho_ms" -ge 1000 ]; then
  falhou "prova 4 (SSE): o primeiro quadro levou $com_cabecalho_ms ms com X-Accel-Buffering: no (esperado: menos de 1000)"
else
  echo "ok - prova 4 (SSE): primeiro quadro em $com_cabecalho_ms ms com X-Accel-Buffering: no (informativo, sem o cabeçalho: $sem_cabecalho_ms ms)"
fi

[ "$FALHAS" = 0 ] || exit 1
