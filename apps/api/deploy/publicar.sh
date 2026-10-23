#!/usr/bin/env bash
# Publica o apps/api na VPS: empacota um commit, envia e chama
# instalar-release.sh lá. É o mesmo passo do GitHub Actions (deploy-api.yml)
# e o de publicar à mão, da raiz do repositório:
#
#   VPS_HOST=85.155.186.214 VPS_USER=n1crm SSH_KEY=~/.ssh/n1_crm_deploy_ci \
#     apps/api/deploy/publicar.sh [commit]
#
# Homologação (Fase 9, D-09/D-23): o mesmo script, com AMBIENTE=homologacao e o
# usuário e a chave de deploy da homologação (nunca os de produção):
#
#   AMBIENTE=homologacao VPS_HOST=85.155.186.214 VPS_USER=n1crm-hml \
#     SSH_KEY=~/.ssh/n1_crm_deploy_hml apps/api/deploy/publicar.sh [commit]
#
# AMBIENTE (padrão producao) escolhe a pasta remota: /opt/n1-crm ou /opt/n1-crm-hml.
#
# Só o que está commitado vai: o pacote sai de `git archive`, nunca da pasta
# de trabalho — nada de .env, exportações ou node_modules. O script que
# instala também sai do commit, não do disco.
# Se nada do backend mudou desde a versão no ar, não publica (FORCAR=1 publica mesmo assim).
set -euo pipefail

REV="${1:-HEAD}"
AMBIENTE="${AMBIENTE:-producao}"
case "$AMBIENTE" in
  producao)    BASE=/opt/n1-crm ;;
  homologacao) BASE=/opt/n1-crm-hml ;;
  *) echo "AMBIENTE deve ser producao ou homologacao (veio: $AMBIENTE)" >&2; exit 2 ;;
esac
SHA="$(git rev-parse --verify "$REV^{commit}")"
: "${VPS_HOST:?defina VPS_HOST}" "${VPS_USER:?defina VPS_USER}"
SSH_OPCOES=(-o BatchMode=yes -o StrictHostKeyChecking=yes)
[ -n "${SSH_KEY:-}" ] && SSH_OPCOES+=(-i "$SSH_KEY" -o IdentitiesOnly=yes)
ALVO="$VPS_USER@$VPS_HOST"
# O que o apps/api precisa para instalar e rodar: o domínio, a api, o
# lockfile e o manifesto da web (só para o npm reconhecer os workspaces).
CAMINHOS=(package.json package-lock.json tsconfig.base.json packages/dominio apps/api apps/web/package.json)
FORA=(':(exclude)apps/api/exportacoes')

no_ar="$(ssh "${SSH_OPCOES[@]}" "$ALVO" "cat $BASE/current/REVISION 2>/dev/null || true")"
if [ "${FORCAR:-}" != "1" ] && [ -n "$no_ar" ]; then
  if [ "$no_ar" = "$SHA" ]; then
    echo "$SHA já está no ar"
    exit 0
  fi
  if git cat-file -e "$no_ar^{commit}" 2>/dev/null && git diff --quiet "$no_ar" "$SHA" -- "${CAMINHOS[@]}" "${FORA[@]}"; then
    echo "nada do backend mudou entre ${no_ar:0:7} (no ar) e ${SHA:0:7} — não publica"
    exit 0
  fi
fi

echo "== publicando ${SHA:0:7} em $ALVO, ambiente $AMBIENTE (no ar: ${no_ar:0:7})"
pacote="$(mktemp)"
trap 'rm -f "$pacote"' EXIT
git archive --format=tar.gz -o "$pacote" "$SHA" "${CAMINHOS[@]}" "${FORA[@]}"
scp -q "${SSH_OPCOES[@]}" "$pacote" "$ALVO:$BASE/releases/$SHA.tar.gz"
git show "$SHA:apps/api/deploy/instalar-release.sh" | ssh "${SSH_OPCOES[@]}" "$ALVO" "bash -s -- $SHA $AMBIENTE"
