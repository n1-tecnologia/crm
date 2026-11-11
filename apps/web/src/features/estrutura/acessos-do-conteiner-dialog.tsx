"use client";

/**
 * 12.4.4 — quem tem acesso a um Espaço, Pasta ou Lista: as Concessões deste
 * contêiner, revogar uma, e conceder acesso a um Membro, a uma Equipe ou a um
 * Papel. Aberto pelo botão "Acessos" do cabeçalho das três páginas.
 *
 * Quem decide é o domínio (`concederAcesso`, `revogarAcesso`): só quem
 * administra o contêiner concede ou revoga, e a última concessão `administrar`
 * de um contêiner privado não se revoga. A tela mostra o motivo no botão
 * desligado, nunca decide sozinha.
 */

import { useState } from "react";
import type { Grant } from "@n1/dominio";
import { containerAdminRefusal, containerPath, type PathNode } from "@n1/dominio/derive";
import { ACOES_DE_ACESSO, type AcaoDeAcesso, type SujeitoDeAcesso } from "@n1/dominio/operations/acessos";
import { concederAcesso, revogarAcesso } from "@n1/dominio/operations";
import { useData, useRun, useSession } from "@/dados/store";
import { Button, EmptyState, Field, Segmentos, Select, SidePanel, Toast } from "@/features/shell/ui";
import type { DataState } from "@n1/dominio/state";

const ROTULO_DO_TIPO: Readonly<Record<PathNode["type"], string>> = { space: "Espaço", folder: "Pasta", list: "Lista" };
const NESTE: Readonly<Record<PathNode["type"], string>> = { space: "neste Espaço", folder: "nesta Pasta", list: "nesta Lista" };
const ROTULO_DO_SUJEITO: Readonly<Record<SujeitoDeAcesso, string>> = { member: "Membro", team: "Equipe", role: "Papel" };
const ROTULO_DA_ACAO: Readonly<Record<string, string>> = {
  ver: "Ver",
  comentar: "Comentar",
  editar: "Editar",
  administrar: "Administrar",
  criar: "Criar",
  excluir: "Excluir",
  executar: "Executar",
};

function nomeDoSujeito(state: DataState, grant: Pick<Grant, "subjectKind" | "subjectId">): string {
  switch (grant.subjectKind) {
    case "member":
      return state.members.find((m) => m.id === grant.subjectId)?.displayName ?? "Membro";
    case "team":
      return `Equipe ${state.teams.find((t) => t.id === grant.subjectId)?.name ?? ""}`.trim();
    case "role":
      return `Papel ${state.roles.find((r) => r.id === grant.subjectId)?.name ?? ""}`.trim();
    case "agent":
      return `Agente ${state.agents.find((a) => a.id === grant.subjectId)?.name ?? ""}`.trim();
    case "automation":
      return `Automação ${state.automations.find((a) => a.id === grant.subjectId)?.name ?? ""}`.trim();
  }
}

export function AcessosDoConteinerDialog({
  open,
  type,
  id,
  onClose,
}: {
  readonly open: boolean;
  readonly type: PathNode["type"];
  readonly id: string;
  readonly onClose: () => void;
}) {
  const state = useData((data) => data);
  const run = useRun();
  const { memberId } = useSession();
  const [sujeito, setSujeito] = useState<SujeitoDeAcesso>("member");
  const [quem, setQuem] = useState("");
  const [acao, setAcao] = useState<AcaoDeAcesso>("ver");
  const [aviso, setAviso] = useState<{ readonly tom: "success" | "error"; readonly frase: string } | null>(null);

  const conteiner = containerPath(state, type, id).at(-1);
  const recusa = memberId ? containerAdminRefusal(state, memberId, type, id) : "Sem sessão.";
  const concessoes = state.grants.filter((g) => g.resourceId === id && g.resourceType === type);

  const opcoes =
    sujeito === "member"
      ? state.members.filter((m) => m.state !== "removido").map((m) => ({ value: m.id, label: m.displayName }))
      : sujeito === "team"
        ? state.teams.map((t) => ({ value: t.id, label: t.name }))
        : state.roles.map((r) => ({ value: r.id, label: r.name }));

  const conceder = () => {
    const r = run((data, me) => concederAcesso(data, me, { subjectKind: sujeito, subjectId: quem, action: acao, resourceType: type, resourceId: id }));
    if (r.ok) {
      setAviso({ tom: "success", frase: `${nomeDoSujeito(state, { subjectKind: sujeito, subjectId: quem })} pode ${ROTULO_DA_ACAO[acao]?.toLowerCase()} aqui.` });
      setQuem("");
    } else setAviso({ tom: "error", frase: r.error });
  };

  const revogar = (grant: Grant) => {
    const r = run((data, me) => revogarAcesso(data, me, grant.id));
    setAviso(r.ok ? { tom: "success", frase: `Acesso de ${nomeDoSujeito(state, grant)} revogado.` } : { tom: "error", frase: r.error });
  };

  return (
    <SidePanel open={open} onClose={onClose} title={`Acessos · ${ROTULO_DO_TIPO[type]} ${conteiner?.name ?? ""}`.trim()}>
      <div className="grid gap-5">
        {aviso ? (
          <Toast tone={aviso.tom} onDismiss={() => setAviso(null)}>
            {aviso.frase}
          </Toast>
        ) : null}

        <section>
          <h3 className="rotulo">Concessões {NESTE[type]}</h3>
          {concessoes.length === 0 ? (
            <EmptyState compact title="Nenhuma Concessão aqui." hint="Quem alcança vem do Papel ou de uma Concessão num contêiner acima." />
          ) : (
            <ul className="pilha-solta mt-2">
              {concessoes.map((grant) => (
                <li key={grant.id} className="item-solto" data-estatico="true">
                  <span className="app-base min-w-0 flex-1 truncate" style={{ color: "var(--texto)" }}>
                    {nomeDoSujeito(state, grant)}
                  </span>
                  <span className="app-meta shrink-0">{ROTULO_DA_ACAO[grant.action] ?? grant.action}</span>
                  <Button size="sm" variant="ghost" onClick={() => revogar(grant)} disabled={Boolean(recusa)} disabledReason={recusa}>
                    Revogar
                  </Button>
                </li>
              ))}
            </ul>
          )}
          <p className="app-meta mt-2">Uma Concessão vale para tudo o que está dentro deste contêiner.</p>
        </section>

        <section className="grid gap-3">
          <h3 className="rotulo">Conceder acesso</h3>
          <Segmentos
            rotulo="Conceder a"
            opcoes={(["member", "team", "role"] as const).map((valor) => ({ valor, rotulo: ROTULO_DO_SUJEITO[valor] }))}
            valor={sujeito}
            aoTrocar={(valor) => {
              setSujeito(valor);
              setQuem("");
            }}
          />
          <Field label={ROTULO_DO_SUJEITO[sujeito]}>
            {(campo) => (
              <Select
                id={campo}
                value={quem}
                onChange={setQuem}
                options={opcoes}
                searchable
                placeholder={`Escolher ${ROTULO_DO_SUJEITO[sujeito].toLowerCase()}`}
                disabled={Boolean(recusa)}
                {...(recusa ? { disabledReason: recusa } : {})}
              />
            )}
          </Field>
          <Field label="Pode">
            {(campo) => (
              <Select
                id={campo}
                value={acao}
                onChange={(valor) => setAcao(valor as AcaoDeAcesso)}
                options={ACOES_DE_ACESSO.map((a) => ({ value: a, label: ROTULO_DA_ACAO[a] ?? a }))}
                disabled={Boolean(recusa)}
                {...(recusa ? { disabledReason: recusa } : {})}
              />
            )}
          </Field>
          <div>
            <Button
              variant="primary"
              onClick={conceder}
              disabled={Boolean(recusa) || !quem}
              disabledReason={recusa ?? `Escolha ${sujeito === "team" ? "a Equipe" : sujeito === "role" ? "o Papel" : "o Membro"}.`}
            >
              Conceder
            </Button>
          </div>
        </section>
      </div>
    </SidePanel>
  );
}
