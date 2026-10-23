#!/usr/bin/env bash
# Instala o backup diário na VPS — uma vez, como root. Idempotente: rodar de
# novo atualiza o script, o serviço e o timer, e não mexe no que é do dono
# (backup.env, backup.recipient, rclone.conf).
#
#   scp -r apps/api/deploy root@VPS:/tmp/n1-crm-deploy
#   ssh root@VPS 'bash /tmp/n1-crm-deploy/instalar-backup.sh'
#
# `--conferir` não pede root e não muda nada: imprime o plano e confere o que
# já dá para conferir.
#
# Só produção (D-21): a homologação não tem dado real e não ganha timer.
#
# O script instalado é cópia do root em /opt/n1-crm/bin/n1-crm-backup.sh, não
# o da versão no ar: o n1crm não consegue alterá-lo e o backup existe antes de
# a fase chegar à `main`.
#
# Não instala `age`, `rclone` nem o cliente do Postgres: pacote de sistema é
# escolha do dono (checkpoint de 09-18). Se faltar, o script para e diz qual.
set -euo pipefail

AQUI="$(cd "$(dirname "$0")" && pwd)"
CONFERIR=0
for arg in "$@"; do
  [ "$arg" = "--conferir" ] && CONFERIR=1
done

USUARIO=n1crm
BASE=/opt/n1-crm
BIN="$BASE/bin"
SCRIPT="$BIN/n1-crm-backup.sh"
ENV_BACKUP="$BASE/shared/backup.env"
BINARIOS=(age rclone pg_dump psql)

if [ "$CONFERIR" = 1 ]; then
  echo "== plano (nada será alterado)"
  echo "script   : $AQUI/n1-crm-backup.sh -> $SCRIPT (root:root, 755)"
  echo "serviço  : $AQUI/n1-crm-backup.service -> /etc/systemd/system/n1-crm-backup.service"
  echo "timer    : $AQUI/n1-crm-backup.timer -> /etc/systemd/system/n1-crm-backup.timer"
  echo "ambiente : $ENV_BACKUP ($USUARIO, 600) — criado só se não existir, com:"
  echo "           BACKUP_DESTINO=  BACKUP_RECIPIENT=$BASE/shared/backup.recipient  RCLONE_CONFIG=$BASE/shared/rclone.conf"
  echo "depois   : systemctl daemon-reload && systemctl enable --now n1-crm-backup.timer"
  echo "== binários no PATH desta máquina"
  for b in "${BINARIOS[@]}"; do
    if command -v "$b" >/dev/null 2>&1; then echo "ok      $b"; else echo "falta   $b (precisa existir na VPS)"; fi
  done
  echo "== arquivos do repositório"
  for f in n1-crm-backup.sh n1-crm-backup.service n1-crm-backup.timer; do
    if [ -f "$AQUI/$f" ]; then echo "ok      $f"; else echo "falta   $f" >&2; exit 1; fi
  done
  exit 0
fi

[ "$(id -u)" = 0 ] || { echo "rode como root" >&2; exit 1; }

faltam=()
for b in "${BINARIOS[@]}"; do
  command -v "$b" >/dev/null 2>&1 || faltam+=("$b")
done
if [ "${#faltam[@]}" -gt 0 ]; then
  echo "faltam no PATH: ${faltam[*]}" >&2
  echo "instale-os pelo gerenciador de pacotes da VPS (age, rclone, postgresql-client na versão do servidor) e rode de novo." >&2
  exit 1
fi
[ -d "$BASE/shared" ] || { echo "$BASE/shared não existe: rode preparar-vps.sh antes" >&2; exit 1; }

echo "== script em $SCRIPT (do root)"
install -d -o root -g root -m 755 "$BIN"
install -o root -g root -m 755 "$AQUI/n1-crm-backup.sh" "$SCRIPT"

echo "== serviço e timer"
install -o root -g root -m 644 "$AQUI/n1-crm-backup.service" /etc/systemd/system/n1-crm-backup.service
install -o root -g root -m 644 "$AQUI/n1-crm-backup.timer" /etc/systemd/system/n1-crm-backup.timer

echo "== $ENV_BACKUP (só se não existir)"
if [ ! -f "$ENV_BACKUP" ]; then
  install -o "$USUARIO" -g "$USUARIO" -m 600 /dev/null "$ENV_BACKUP"
  cat > "$ENV_BACKUP" <<ENV
# Backup diário — lido pelo n1-crm-backup.service. Sem segredo aqui: a chave do
# bucket mora no rclone.conf. Preencha BACKUP_DESTINO (remoto:bucket/pasta).
BACKUP_DESTINO=
BACKUP_RECIPIENT=$BASE/shared/backup.recipient
RCLONE_CONFIG=$BASE/shared/rclone.conf
ENV
  echo "criado; falta preencher BACKUP_DESTINO"
else
  echo "já existe; não foi tocado"
fi

systemctl daemon-reload
systemctl enable --now n1-crm-backup.timer
systemctl list-timers n1-crm-backup.timer --no-pager

echo
echo "Pronto. Falta, antes do primeiro backup:"
echo "  - $ENV_BACKUP: BACKUP_DESTINO (dono $USUARIO, modo 600)"
echo "  - $BASE/shared/backup.recipient: a chave PÚBLICA age1… do dono (a privada nunca vem para cá)"
echo "  - $BASE/shared/rclone.conf: o remoto do bucket (dono $USUARIO, modo 600)"
echo "  - um backup de teste: systemctl start n1-crm-backup.service && journalctl -u n1-crm-backup.service -n 20 --no-pager"
