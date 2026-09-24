"use client";

/**
 * CONCEDER UMA HABILIDADE A UM AGENTE (RN-HAB-12) — o diálogo que a ficha da
 * Habilidade e a ficha do Agente compartilham. Um dos dois lados vem fixo:
 * daqui, a Habilidade; de lá, o Agente.
 *
 * A Concessão é a única origem de `executar` e não amplia permissão alguma
 * (INV-HAB-06): a Disponibilidade é recalculada a cada leitura, e o diálogo
 * antecipa os motivos (Ferramenta obrigatória não permitida, Integração
 * desconectada…) sem bloquear — a pessoa concede e permite depois. Mostra o
 * Efeito declarado e avisa quando é externo ou irreversível num Agente
 * autônomo (RN-HAB-11). Conceder cria a Versão seguinte do Agente (D8).
 */

import { useState } from "react";
import type { DataState } from "@/data/state";
import { useData, useRun, useSession } from "@/data/store";
import { concederHabilidade, recusaDeConvidado, recusaDeGovernarAgente } from "@/data/operations";
import { agentesGovernaveisPor, disponibilidadeDaConcessao, efeitoDeclarado, versaoCorrenteDaHabilidade, versaoCorrenteDoAgente } from "@/data/derive-ia";
import type { Id } from "@/data/types";
import { AUTONOMY_LABEL, LIFECYCLE_LABEL } from "@/features/shell/format";
import { ConfirmDialog, Field, Pilula, Select } from "@/features/shell/ui";
import { EFEITO_LABEL, EFEITO_TOM } from "../rotulos";

const SEM_AGENTE_AO_ALCANCE = "Você não governa nenhum Agente que possa receber Concessões.";

/**
 * Sem Agente ao alcance não há a quem conceder: a recusa que a ficha e o
 * catálogo mostram ANTES de abrir o diálogo (§11), composta como o Catálogo
 * de Plugins faz — o Convidado com a frase do domínio, o Membro sem Agente
 * próprio com a desta tela.
 */
export function recusaDeConcederAAlgumAgente(state: DataState, memberId: Id): string | undefined {
  return recusaDeConvidado(state, memberId, "edita Agente") ?? (agentesGovernaveisPor(state, memberId).length === 0 ? SEM_AGENTE_AO_ALCANCE : undefined);
}

export function ConcederHabilidadeDialog({
  skillId: habilidadeFixa,
  agentId: agenteFixo,
  open,
  onClose,
  onDone,
}: {
  readonly skillId?: string;
  readonly agentId?: string;
  readonly open: boolean;
  readonly onClose: () => void;
  readonly onDone: (message: string, id: string) => void;
}) {
  const state = useData((data) => data);
  const run = useRun();
  const { memberId } = useSession();
  const [agentId, setAgentId] = useState(agenteFixo ?? "");
  const [skillId, setSkillId] = useState(habilidadeFixa ?? "");
  const [versao, setVersao] = useState("");
  const [erro, setErro] = useState<string | null>(null);

  // Os governáveis que ainda recebem Concessões, e os arquivados que a pessoa governa — desligados, com o porquê (§11).
  const governaveis = agentesGovernaveisPor(state, memberId);
  const arquivados = state.agents.filter((a) => a.lifecycle === "arquivado" && recusaDeGovernarAgente(state, memberId, a, "editar") === undefined);
  // Nenhum Agente a escolher: o Select desliga e diz por quê, em vez de abrir uma lista vazia.
  const semAgente = agenteFixo === undefined ? recusaDeConcederAAlgumAgente(state, memberId) : undefined;
  const agente = state.agents.find((a) => a.id === agentId);
  const skill = state.skills.find((s) => s.id === skillId);
  const corrente = skill ? versaoCorrenteDaHabilidade(skill) : undefined;
  const publicadas = skill ? skill.versions.filter((v) => v.state === "publicada").sort((a, b) => b.number - a.number) : [];
  const pinnedVersion = versao ? Number(versao) : undefined;
  const exercida = pinnedVersion !== undefined ? skill?.versions.find((v) => v.number === pinnedVersion) : corrente;
  const efeito = exercida ? efeitoDeclarado(state, exercida) : undefined;
  const versaoDoAgente = agente ? versaoCorrenteDoAgente(agente) : undefined;
  const autonomo = versaoDoAgente?.autonomy === "autonomo";
  const jaConcedida = agente !== undefined && skill !== undefined && state.skillGrants.some((g) => g.agentId === agente.id && g.skillId === skill.id);
  const disponibilidade = agente && skill ? disponibilidadeDaConcessao(state, { agentId: agente.id, skillId: skill.id, ...(pinnedVersion !== undefined ? { pinnedVersion } : {}) }) : undefined;

  const motivo = !agentId
    ? (semAgente ?? "Escolha o Agente.")
    : !skillId
      ? "Escolha a Habilidade."
      : agente && (agente.lifecycle === "arquivado" || agente.lifecycle === "naLixeira")
        ? "Um Agente arquivado ou na lixeira não recebe Concessões."
        : skill && skill.lifecycle !== "ativo"
          ? "Só uma Habilidade ativa é concedida."
          : jaConcedida
            ? "Esta Habilidade já está concedida a este Agente."
            : (agente ? recusaDeGovernarAgente(state, memberId, agente, "editar") : undefined);

  const reset = () => {
    setAgentId(agenteFixo ?? "");
    setSkillId(habilidadeFixa ?? "");
    setVersao("");
    setErro(null);
  };

  const confirmar = () => {
    const r = run((data, me) => concederHabilidade(data, me, { agentId, skillId, ...(pinnedVersion !== undefined ? { pinnedVersion } : {}) }));
    if (!r.ok) {
      setErro(r.error);
      return;
    }
    reset();
    onDone(`Habilidade “${skill?.name ?? skillId}” concedida a ${agente?.name ?? agentId}${pinnedVersion !== undefined ? `, fixada na v${pinnedVersion}` : ""}.`, r.value.id);
  };

  return (
    <ConfirmDialog
      open={open}
      title="Conceder a um Agente"
      description="A Concessão é a única origem de executar (RN-HAB-12) e não amplia permissão alguma: as Ferramentas obrigatórias precisam estar permitidas ao Agente. Isto cria a Versão seguinte do Agente, válida a partir da próxima Execução (RN-AGE-06)."
      confirmLabel="Conceder"
      {...(motivo ? { confirmDisabledReason: motivo } : {})}
      onConfirm={confirmar}
      onCancel={() => {
        reset();
        onClose();
      }}
    >
      <div className="grid gap-5">
        <Field label="Agente" required>
          {(id) => (
            <Select
              id={id}
              value={agentId}
              onChange={setAgentId}
              searchable
              placeholder={semAgente ? "Nenhum Agente ao seu alcance" : "Escolher o Agente"}
              disabled={agenteFixo !== undefined || semAgente !== undefined}
              disabledReason={semAgente ?? "O Agente é o desta ficha."}
              options={[
                ...governaveis.map((a) => {
                  const v = versaoCorrenteDoAgente(a);
                  return { value: a.id, label: a.name, detail: `${LIFECYCLE_LABEL[a.lifecycle] ?? a.lifecycle}${v ? ` · ${AUTONOMY_LABEL[v.autonomy] ?? v.autonomy}` : ""}` };
                }),
                ...arquivados.map((a) => ({ value: a.id, label: a.name, detail: LIFECYCLE_LABEL[a.lifecycle] ?? a.lifecycle, disabledReason: "Um Agente arquivado ou na lixeira não recebe Concessões." })),
              ]}
            />
          )}
        </Field>
        <Field label="Habilidade" required hint="Só uma Habilidade ativa com Versão publicada é exercível (RN-HAB-03).">
          {(id) => (
            <Select
              id={id}
              value={skillId}
              onChange={(v) => {
                setSkillId(v);
                setVersao("");
              }}
              searchable
              placeholder="Escolher a Habilidade"
              disabled={habilidadeFixa !== undefined}
              disabledReason="A Habilidade é a desta ficha."
              options={state.skills
                .filter((s) => s.lifecycle === "ativo" || s.id === habilidadeFixa)
                .flatMap((s) => {
                  const c = versaoCorrenteDaHabilidade(s);
                  // A Habilidade desta ficha entra mesmo sem Versão publicada (a Concessão nasce indisponível, RN-HAB-03):
                  // o valor precisa existir nas opções, senão o Select mostra o placeholder como se nada tivesse sido escolhido.
                  if (!c && s.id !== habilidadeFixa) return [];
                  const concedida = agente !== undefined && state.skillGrants.some((g) => g.agentId === agente.id && g.skillId === s.id);
                  return [
                    {
                      value: s.id,
                      label: s.name,
                      detail: c ? `v${c.number} · ${EFEITO_LABEL[efeitoDeclarado(state, c)]}${s.ownership === "plataforma" ? " · da plataforma" : ""}` : "sem Versão publicada",
                      ...(concedida ? { disabledReason: "Esta Habilidade já está concedida a este Agente." } : {}),
                    },
                  ];
                })}
            />
          )}
        </Field>
        <Field label="Versão" hint="Seguir a corrente acompanha cada publicação; fixar prende a Concessão a uma Versão publicada (RN-HAB-03).">
          {(id) => (
            <Select
              id={id}
              value={versao}
              onChange={setVersao}
              placeholder="Seguir a corrente"
              disabled={!skill}
              disabledReason="Escolha a Habilidade antes."
              options={[
                { value: "", label: "Seguir a corrente", detail: corrente ? `hoje, a v${corrente.number}` : "sem Versão publicada" },
                ...publicadas.map((v) => ({ value: String(v.number), label: `Fixar na Versão ${v.number}`, detail: v.number === corrente?.number ? "corrente" : "publicada" })),
              ]}
            />
          )}
        </Field>

        {efeito ? (
          <p className="app-base flex flex-wrap items-center gap-2" style={{ color: "var(--texto-2)" }}>
            Efeito declarado
            <Pilula tom={EFEITO_TOM[efeito]}>{EFEITO_LABEL[efeito]}</Pilula>
          </p>
        ) : null}
        {efeito && autonomo && (efeito === "externa" || efeito === "irreversivel") ? (
          <p className="app-sm rounded-[var(--r-controle)] px-3 py-2" style={{ background: "var(--aviso-lavado)", color: "var(--aviso)" }}>
            Este Agente é autônomo e a Habilidade declara {EFEITO_LABEL[efeito]}: o produto pode exigir aprovação de Administrador para esta Concessão (RN-HAB-11). A aprovação em tempo de exercício segue por Ferramenta (B22).
          </p>
        ) : null}
        {disponibilidade && !disponibilidade.disponivel && !jaConcedida ? (
          <p className="app-sm rounded-[var(--r-controle)] px-3 py-2" style={{ background: "var(--aviso-lavado)", color: "var(--aviso)" }}>
            A Concessão nascerá indisponível até resolver: {disponibilidade.motivos.join(" · ")}. Conceder não permite Ferramenta alguma (INV-HAB-06).
          </p>
        ) : null}
        {erro ? (
          <p role="alert" className="app-base" style={{ color: "var(--erro)" }}>
            {erro}
          </p>
        ) : null}
      </div>
    </ConfirmDialog>
  );
}
