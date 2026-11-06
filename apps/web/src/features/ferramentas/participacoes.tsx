"use client";

/**
 * AS PARTICIPAÇÕES DE UM GRUPO (24, 7.1): a `tabela` com o Contato, o Papel,
 * a Origem, a entrada e a saída — as encerradas ficam escondidas até se
 * pedir, porque nunca são eliminadas (INV-GRP-07). As ações por linha
 * (promover, rebaixar, remover) são Ferramentas externas: desligadas com o
 * motivo quando o Canal não administra o Grupo (RN-GRP-05).
 */

import Link from "next/link";
import { useState } from "react";
import { useData, useRun } from "@/dados/store";
import { adicionarParticipantes, promoverParticipante, rebaixarParticipante, recusaExternaNoGrupo, removerParticipante } from "@n1/dominio/operations";
import { participacoesVigentes } from "@n1/dominio/derive-ferramentas";
import type { Grupo, ParticipacaoDeGrupo } from "@n1/dominio/types";
import type { Report } from "@/features/shell/ficha";
import { useFormat } from "@/features/shell/use-format";
import { ActionMenu, ActorAvatar, Button, ConfirmDialog, EmptyState, Field, MultiSelect, Pilula, ReguaDeSecao, TextInput, Toggle } from "@/features/shell/ui";
import { nomeDe as nomeNoLote, useNomesDoCrm } from "@/dados/crm/nomes";
import { recusaSePronta, useCanaisDasFerramentas, useCrmDasFerramentas, useSeletorDeContatos, montarCrmDasFerramentas } from "./crm-das-ferramentas";
import { CAUSA_DA_SAIDA_LABEL, ORIGEM_DA_PARTICIPACAO_LABEL, PAPEL_NA_PARTICIPACAO_LABEL } from "./rotulos";

export function SecaoDeParticipacoes({ grupo, report }: { readonly grupo: Grupo; readonly report: Report }) {
  const state = useData((data) => data);
  const run = useRun();
  const fmt = useFormat();
  const [encerradas, setEncerradas] = useState(false);
  const [adicionando, setAdicionando] = useState(false);
  const vigentes = participacoesVigentes(grupo);
  const lista = (encerradas ? [...grupo.participacoes] : vigentes).sort((a, b) => {
    const va = a.saidaEm === undefined ? 0 : 1;
    const vb = b.saidaEm === undefined ? 0 : 1;
    return va - vb || (a.papel === "administrador" ? 0 : 1) - (b.papel === "administrador" ? 0 : 1) || b.entradaEm.localeCompare(a.entradaEm);
  });
  // Canal e nome de Contato vêm do CRM novo (GET /canais e POST /crm/nomes, um lote por Grupo aberto).
  const canaisDoCrm = useCanaisDasFerramentas();
  const crm = useCrmDasFerramentas(canaisDoCrm);
  const nomes = useNomesDoCrm(lista.flatMap((p) => (p.contactId && !p.canalParticipanteId ? [{ tipo: "contact" as const, id: p.contactId }] : [])));
  const externa = recusaSePronta(canaisDoCrm, () => recusaExternaNoGrupo(state, grupo, "administrador", crm));
  const motivoAvisos = grupo.papelNaComunidade === "avisos" ? "O provedor mantém os participantes do Grupo de avisos: a plataforma só espelha (RN-COM-04)." : undefined;
  const motivoAdicionar = motivoAvisos ?? externa;

  const nomeDe = (p: ParticipacaoDeGrupo) => {
    if (p.canalParticipanteId) return { nome: canaisDoCrm.nomeDoCanal(p.canalParticipanteId) ?? "Canal", canal: true, href: undefined };
    // `null` = a api não nomeou (Contato de outro Espaço, eliminado ou sem permissão de leitura): mostra o número da Participação.
    const nome = p.contactId ? nomeNoLote(nomes, "contact", p.contactId) : undefined;
    return { nome: nome ?? (p.anonimizada ? "Contato eliminado" : p.identificadorExternoDoParticipante), canal: false, href: nome && p.contactId ? `/crm/contatos/${p.contactId}` : undefined };
  };

  return (
    <section>
      <ReguaDeSecao
        rotulo="Participações"
        contagem={vigentes.length}
        acao={
          <span className="flex items-center gap-3">
            <label className="app-sm flex items-center gap-2" style={{ color: "var(--texto-3)" }}>
              <input type="checkbox" className="accent-[var(--acento)]" checked={encerradas} onChange={(e) => setEncerradas(e.target.checked)} />
              Mostrar encerradas ({grupo.participacoes.length - vigentes.length})
            </label>
            <Button size="sm" onClick={() => setAdicionando(true)} disabled={motivoAdicionar !== undefined} {...(motivoAdicionar ? { disabledReason: motivoAdicionar } : {})}>
              Adicionar participante
            </Button>
          </span>
        }
      />
      {lista.length === 0 ? (
        <EmptyState compact title="Ninguém no Grupo." hint="Adicione Contatos com identidade de WhatsApp, ou espere a Sincronização." />
      ) : (
        <table className="tabela">
          <thead>
            <tr>
              <th className="app-coluna">Contato</th>
              <th className="app-coluna">Papel</th>
              <th className="app-coluna">Origem</th>
              <th className="app-coluna">Entrada</th>
              <th className="app-coluna">Saída</th>
              <th className="app-coluna" data-vazia="true" aria-label="Ações" />
            </tr>
          </thead>
          <tbody>
            {lista.map((p) => {
              const quem = nomeDe(p);
              const vigente = p.saidaEm === undefined;
              const ehOCanal = p.canalParticipanteId === grupo.canalId;
              const motivoLinha = motivoAvisos ?? externa ?? (!vigente ? "Esta Participação já está encerrada." : undefined);
              return (
                <tr key={p.id} style={vigente ? undefined : { opacity: 0.6 }}>
                  <td className="max-w-[24ch] whitespace-nowrap">
                    <span className="flex min-w-0 items-center gap-2">
                      <ActorAvatar kind={quem.canal ? "integration" : "member"} name={quem.nome} />
                      {quem.href ? (
                        <Link href={quem.href} className="app-md min-w-0 truncate hover:underline" style={{ color: "var(--texto)" }} title={quem.nome}>
                          {quem.nome}
                        </Link>
                      ) : (
                        <span className="app-md min-w-0 truncate" style={{ color: "var(--texto)" }} title={quem.nome}>
                          {quem.nome}
                        </span>
                      )}
                      {quem.canal ? <Pilula tom="info" className="shrink-0">É o Canal</Pilula> : null}
                    </span>
                  </td>
                  <td className="whitespace-nowrap">
                    <Pilula tom={p.papel === "administrador" ? "acento" : "neutro"}>{PAPEL_NA_PARTICIPACAO_LABEL[p.papel]}</Pilula>
                  </td>
                  <td className="max-w-[26ch] whitespace-nowrap">
                    {(() => {
                      const origem = `${ORIGEM_DA_PARTICIPACAO_LABEL[p.origem]}${p.origemInferida ? " (inferida)" : ""}${p.linkDeCaptacaoId ? ` · ${state.linksDeCaptacao.find((l) => l.id === p.linkDeCaptacaoId)?.nome ?? "Link"}` : ""}`;
                      return (
                        <span className="app-sm block truncate" style={{ color: "var(--texto-2)" }} title={origem}>
                          {origem}
                        </span>
                      );
                    })()}
                  </td>
                  <td className="whitespace-nowrap">
                    <span className="app-sm" style={{ color: "var(--texto-2)" }}>
                      {fmt.instant(p.entradaEm)}
                      {p.entradaEstimada ? " (estimada)" : ""}
                    </span>
                  </td>
                  <td className="whitespace-nowrap">
                    {p.saidaEm ? (
                      <span className="app-sm" style={{ color: "var(--texto-2)" }}>
                        {fmt.instant(p.saidaEm)} · {p.causaDaSaida ? CAUSA_DA_SAIDA_LABEL[p.causaDaSaida] : ""}
                      </span>
                    ) : (
                      <span className="app-meta">vigente</span>
                    )}
                  </td>
                  <td>
                    <ActionMenu
                      items={[
                        p.papel === "administrador"
                          ? { label: "Rebaixar a membro", onSelect: () => report(run((data, me) => rebaixarParticipante(data, me, grupo.id, p.id, crm)), `${quem.nome} agora é membro.`), ...(motivoLinha ? { disabledReason: motivoLinha } : ehOCanal ? { disabledReason: "Rebaixar o próprio Canal tiraria da plataforma o privilégio de administrar." } : {}) }
                          : { label: "Promover a administrador", onSelect: () => report(run((data, me) => promoverParticipante(data, me, grupo.id, p.id, crm)), `${quem.nome} agora administra.`), ...(motivoLinha ? { disabledReason: motivoLinha } : {}) },
                        {
                          label: "Remover do Grupo",
                          destructive: true,
                          onSelect: () => report(run((data, me) => removerParticipante(data, me, grupo.id, p.id, crm)), `${quem.nome} removido; a Participação fica encerrada na história.`),
                          ...(motivoLinha ? { disabledReason: motivoLinha } : ehOCanal ? { disabledReason: "Para tirar o próprio Canal, use “Sair do Grupo”." } : {}),
                        },
                      ]}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
      {adicionando ? <AdicionarParticipanteDialog grupo={grupo} onClose={() => setAdicionando(false)} report={report} /> : null}
    </section>
  );
}

function AdicionarParticipanteDialog({ grupo, onClose, report }: { readonly grupo: Grupo; readonly onClose: () => void; readonly report: Report }) {
  const run = useRun();
  const [ids, setIds] = useState<readonly string[]>([]);
  const [admin, setAdmin] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const canaisDoCrm = useCanaisDasFerramentas();
  // Só Contatos com WhatsApp, da api; a busca vai como `q` (3.4.8).
  const seletor = useSeletorDeContatos(ids);
  const crm = montarCrmDasFerramentas(canaisDoCrm, seletor.contatosDoCrm);
  const jaEstao = new Set(participacoesVigentes(grupo).map((p) => p.contactId));
  const opcoes = seletor.opcoes.map((o) => ({ ...o, ...(jaEstao.has(o.value) ? { disabledReason: "Já está no Grupo (INV-GRP-02)." } : {}) }));
  return (
    <ConfirmDialog
      open
      title={`Adicionar participante a ${grupo.nome}`}
      description="Ferramenta externa: o provedor adiciona; a plataforma abre a Participação com origem “adicionado” e por quem."
      confirmLabel={ids.length > 1 ? `Adicionar ${ids.length}` : "Adicionar"}
      {...(ids.length === 0 ? { confirmDisabledReason: "Escolha ao menos um Contato." } : {})}
      onConfirm={() => {
        const r = run((data, me) => adicionarParticipantes(data, me, grupo.id, { contactIds: ids, comoAdministrador: admin }, crm));
        if (!r.ok) {
          setErro(r.error);
          return;
        }
        report(r, `${r.value.adicionados.length} adicionado${r.value.adicionados.length === 1 ? "" : "s"}${r.value.jaEstavam > 0 ? `; ${r.value.jaEstavam} já estava${r.value.jaEstavam === 1 ? "" : "m"}` : ""}.`);
        onClose();
      }}
      onCancel={onClose}
    >
      <div className="grid gap-4">
        <Field label="Buscar Contato" hint="A busca filtra por nome, e-mail ou telefone.">
          {(id) => <TextInput id={id} value={seletor.busca} onChange={seletor.setBusca} placeholder="Nome, e-mail ou telefone" />}
        </Field>
        <Field label="Contatos" required hint="Só Contatos com identidade de WhatsApp: é por ela que o provedor os encontra.">
          {(id) => <MultiSelect id={id} values={ids} onChange={setIds} options={opcoes} placeholder="Escolher Contatos" />}
        </Field>
        <div className="flex items-center gap-3">
          <Toggle checked={admin} onChange={setAdmin} labelledBy="adm-label" />
          <span id="adm-label" className="app-base" style={{ color: "var(--texto)" }}>
            Como administrador
          </span>
        </div>
        {erro ? (
          <p role="alert" className="app-base" style={{ color: "var(--erro)" }}>
            {erro}
          </p>
        ) : null}
      </div>
    </ConfirmDialog>
  );
}
