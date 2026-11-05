"use client";

/**
 * 12.3.2, 12.3.7 e 12.5.1 — o painel "Acesso" da ficha do Membro: o estado da
 * participação, "Reenviar convite" (pendente), "Suspender" (ativo) e
 * "Reativar" (suspenso), e os módulos que o Papel dele libera, só para leitura.
 *
 * Quem decide é o domínio (`suspenderMembro`, `reativarMembro`) e a api
 * (`POST /membros/:id/convite`); esconder um botão aqui é só a consequência
 * visual da regra, e o motivo aparece no botão desligado.
 */

import { useState, useTransition } from "react";
import type { Member, Role } from "@n1/dominio";
import { ROTULO_DO_MODULO, modulosDoPapel } from "@n1/dominio/derive-modulos";
import { reativarMembro, suspenderMembro } from "@n1/dominio/operations";
import { useRun } from "@/dados/store";
import { reenviarOConvite } from "@/features/convite/acoes";
import { Button, CabecalhoDePainel, ConfirmDialog, Painel, Pilula } from "@/features/shell/ui";

const FRASE_DO_ESTADO: Readonly<Record<Member["state"], string>> = {
  pendente: "Convite pendente: a pessoa ainda não aceitou.",
  ativo: "Ativo: entra e usa o Espaço de Trabalho conforme o Papel.",
  suspenso: "Suspenso: não entra no Espaço de Trabalho até ser reativado. Equipes, Concessões e histórico continuam.",
  removido: "Participação encerrada.",
};

export function AcessoDoMembro({
  member,
  role,
  mayGovern,
  isOwner,
  isSelf,
  onNotice,
  onError,
}: {
  readonly member: Member;
  readonly role: Role | undefined;
  readonly mayGovern: boolean;
  readonly isOwner: boolean;
  readonly isSelf: boolean;
  readonly onNotice: (frase: string) => void;
  readonly onError: (frase: string) => void;
}) {
  const run = useRun();
  const [confirmandoSuspensao, setConfirmandoSuspensao] = useState(false);
  const [reenviando, iniciarReenvio] = useTransition();

  const motivoDeNaoSuspender = !mayGovern
    ? "Só um Administrador ou o Proprietário suspende um Membro."
    : isOwner
      ? "O Proprietário do Espaço de Trabalho não pode ser suspenso."
      : isSelf
        ? "Você não pode suspender a si mesmo."
        : undefined;

  const suspender = () => {
    setConfirmandoSuspensao(false);
    const r = run((data, me) => suspenderMembro(data, me, member.id));
    if (r.ok) onNotice(`${member.displayName} foi suspenso e perdeu o acesso.`);
    else onError(r.error);
  };

  const reativar = () => {
    const r = run((data, me) => reativarMembro(data, me, member.id));
    if (r.ok) onNotice(`${member.displayName} foi reativado.`);
    else onError(r.error);
  };

  const reenviar = () =>
    iniciarReenvio(async () => {
      const r = await reenviarOConvite(member.id);
      if (!r.ok) onError(r.erro);
      else onNotice(r.aviso ?? `Convite reenviado para ${member.invitedIdentity?.value ?? member.displayName}.`);
    });

  const modulos = role ? modulosDoPapel(role) : [];

  return (
    <Painel>
      <CabecalhoDePainel titulo="Acesso" />
      <div className="grid gap-4 p-4">
        <p className="app-base" style={{ color: "var(--texto-2)" }}>
          {FRASE_DO_ESTADO[member.state]}
        </p>

        {member.state === "pendente" ? (
          <div>
            <Button
              size="sm"
              onClick={reenviar}
              disabled={!mayGovern || reenviando}
              disabledReason={reenviando ? "Reenviando…" : "Só um Administrador ou o Proprietário reenvia um convite."}
            >
              {reenviando ? "Reenviando…" : "Reenviar convite"}
            </Button>
          </div>
        ) : null}

        {member.state === "ativo" ? (
          <div>
            <Button size="sm" variant="danger" onClick={() => setConfirmandoSuspensao(true)} disabled={Boolean(motivoDeNaoSuspender)} disabledReason={motivoDeNaoSuspender}>
              Suspender
            </Button>
          </div>
        ) : null}

        {member.state === "suspenso" ? (
          <div>
            <Button size="sm" variant="primary" onClick={reativar} disabled={!mayGovern} disabledReason="Só um Administrador ou o Proprietário reativa um Membro.">
              Reativar
            </Button>
          </div>
        ) : null}

        <div>
          <p className="rotulo">Módulos que o Papel libera</p>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {modulos.length === 0 ? <span className="app-meta">Nenhum.</span> : modulos.map((m) => <Pilula key={m}>{ROTULO_DO_MODULO[m]}</Pilula>)}
          </div>
          <p className="app-meta mt-1">Vêm do Papel{role ? ` ${role.name}` : ""}: para mudar os módulos, mude o Papel ou edite-o em Papéis.</p>
        </div>
      </div>

      <ConfirmDialog
        open={confirmandoSuspensao}
        title={`Suspender ${member.displayName}`}
        description="A pessoa perde o acesso ao Espaço de Trabalho na hora: não entra, não lê e não altera nada. Equipes, Concessões e histórico continuam, e ela volta como estava ao ser reativada."
        confirmLabel="Suspender"
        destructive
        onConfirm={suspender}
        onCancel={() => setConfirmandoSuspensao(false)}
      />
    </Painel>
  );
}
