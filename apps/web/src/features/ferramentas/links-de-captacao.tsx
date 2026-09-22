"use client";

/**
 * OS LINKS DE CAPTAÇÃO: a seção no topo da aba Grupos, um item por Link com
 * o endereço público, o Critério, os Grupos elegíveis agora e os cliques; e
 * o diálogo de criar/editar. "Simular clique" faz o que a pessoa faria ao
 * tocar no link — o Clique cai no próximo Grupo elegível (RN-GRP-07) — e,
 * no passo seguinte, "simular entrada" faz o provedor avisar que o número
 * entrou (ou pediu para entrar, quando o Grupo aprova).
 */

import { useState } from "react";
import { Link2 } from "lucide-react";
import { useData, useRun } from "@/dados/store";
import { criarLinkDeCaptacao, editarLinkDeCaptacao, enviarLinkALixeira, recusaDeElegibilidade, registrarClique, simularEntradaPorClique } from "@n1/dominio/operations/ferramentas/captacao";
import { zerarCliques } from "@n1/dominio/operations/ferramentas/grupos";
import { gruposElegiveisDoLink, motivoDeInelegibilidade, proximoGrupoDoLink } from "@n1/dominio/derive-ferramentas";
import type { CriterioDeCaptacao, LinkDeCaptacao } from "@n1/dominio/types/ferramentas";
import { Selo } from "@/features/estrutura/icone-de-tipo";
import type { Report } from "@/features/shell/ficha";
import { useFormat } from "@/features/shell/use-format";
import { ActionMenu, Button, ConfirmDialog, EmptyState, Field, MultiSelect, Pilula, ReguaDeSecao, Select, TextInput, Toggle } from "@/features/shell/ui";
import { CRITERIO_LABEL } from "./rotulos";
import { useParametros } from "./url";

export function SecaoDeLinksDeCaptacao({ report }: { readonly report: Report }) {
  const state = useData((data) => data);
  const run = useRun();
  const fmt = useFormat();
  const { set } = useParametros();
  const [editando, setEditando] = useState<string | null>(null);
  const [ultimoClique, setUltimoClique] = useState<{ readonly cliqueId: string; readonly grupoNome: string; readonly linkId: string } | null>(null);
  const [numero, setNumero] = useState("");

  const links = state.linksDeCaptacao.filter((l) => l.lifecycle !== "naLixeira");

  const clicar = (link: LinkDeCaptacao) => {
    const r = run((data) => registrarClique(data, link.id));
    if (!r.ok) {
      report(r, "");
      return;
    }
    if (r.value.grupo) {
      setUltimoClique({ cliqueId: r.value.clique.id, grupoNome: r.value.grupo.nome, linkId: link.id });
      report(r, `Clique encaminhado ao Grupo ${r.value.grupo.nome}. Simule a entrada do número para o provedor avisar.`);
    } else {
      setUltimoClique(null);
      report({ ok: false, error: "Nenhum Grupo elegível: o Clique ficou sem destino (a captação está cega)." }, "");
    }
  };

  const entrar = () => {
    if (!ultimoClique) return;
    const r = run((data) => simularEntradaPorClique(data, ultimoClique.cliqueId, numero.trim() || `5511${String(Math.floor(900000000 + Math.random() * 99999999)).slice(0, 9)}`));
    report(r, r.ok && r.value.pedidoId ? `O Grupo ${r.value.grupo.nome} aprova entradas: virou Pedido de Entrada.` : `Entrada registrada no Grupo ${r.ok ? r.value.grupo.nome : ""}: Participação com origem Link de Captação.`);
    if (r.ok) {
      setUltimoClique(null);
      setNumero("");
    }
  };

  return (
    <section>
      <ReguaDeSecao rotulo="Links de Captação" contagem={links.length} acao={<Button size="sm" onClick={() => set({ criar: "link" })}>Novo Link</Button>} />
      {links.length === 0 ? (
        <EmptyState compact title="Nenhum Link de Captação." hint="Um Link é o endereço público que manda cada clique ao Link de convite de um Grupo elegível." />
      ) : (
        <ul className="pilha-solta">
          {links.map((link) => {
            const elegiveis = gruposElegiveisDoLink(state, link);
            const proximo = proximoGrupoDoLink(state, link);
            const motivoSemDestino = !link.ativo ? "O Link está inativo." : elegiveis.length === 0 ? "Nenhum Grupo elegível agora: a captação está cega." : undefined;
            return (
              <li key={link.id} className="item-solto">
                <Selo icone={Link2} cor={link.ativo ? "var(--acento)" : "var(--texto-3)"} lavado={link.ativo ? "var(--acento-lavado)" : "var(--superficie-2)"} />
                <span className="min-w-0 flex-1">
                  <span className="app-md flex flex-wrap items-center gap-1.5" style={{ color: "var(--texto)" }}>
                    {link.nome}
                    <span className="identificador">/l/{link.slug}</span>
                    <Pilula tom={link.ativo ? "sucesso" : "neutro"}>{link.ativo ? "ativo" : "inativo"}</Pilula>
                  </span>
                  <span className="app-meta block truncate">
                    {CRITERIO_LABEL[link.criterio]} · {elegiveis.length} de {link.gruposElegiveisIds.length} Grupo{link.gruposElegiveisIds.length === 1 ? "" : "s"} elegíve{link.gruposElegiveisIds.length === 1 ? "l" : "is"} · {fmt.number(link.cliques.length)} clique{link.cliques.length === 1 ? "" : "s"}
                    {proximo ? ` · próximo: ${proximo.nome}` : ""}
                  </span>
                </span>
                <Button size="sm" onClick={() => clicar(link)} disabled={motivoSemDestino !== undefined} {...(motivoSemDestino ? { disabledReason: motivoSemDestino } : {})}>
                  Simular clique
                </Button>
                <ActionMenu
                  items={[
                    { label: "Editar", onSelect: () => setEditando(link.id) },
                    { label: link.ativo ? "Inativar" : "Ativar", onSelect: () => report(run((data, me) => editarLinkDeCaptacao(data, me, link.id, { ativo: !link.ativo })), link.ativo ? "Link inativado." : "Link ativado.") },
                    {
                      label: "Zerar cliques dos Grupos",
                      onSelect: () => {
                        for (const id of link.gruposElegiveisIds) run((data, me) => zerarCliques(data, me, id));
                        report({ ok: true }, "Cliques contabilizados zerados nos Grupos deste Link (RN-GRP-08).");
                      },
                    },
                    { label: "Enviar à lixeira", destructive: true, onSelect: () => report(run((data, me) => enviarLinkALixeira(data, me, link.id)), "Link enviado à lixeira.") },
                  ]}
                />
              </li>
            );
          })}
        </ul>
      )}

      {ultimoClique ? (
        <div className="painel mt-2 flex flex-wrap items-center gap-2 px-3 py-2">
          <span className="app-sm min-w-0 flex-1" style={{ color: "var(--texto-2)" }}>
            O clique foi ao Grupo <strong style={{ color: "var(--texto)" }}>{ultimoClique.grupoNome}</strong>. Que número entrou?
          </span>
          <span className="w-44">
            <TextInput value={numero} onChange={setNumero} placeholder="5511 9…" size="sm" />
          </span>
          <Button size="sm" variant="primary" onClick={entrar}>
            Simular entrada
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setUltimoClique(null)}>
            Ignorar
          </Button>
        </div>
      ) : null}

      {editando ? <CriarLinkDialog open linkId={editando} onClose={() => setEditando(null)} report={report} /> : null}
    </section>
  );
}

/** Criar ou editar um Link: nome, endereço, Critério, Grupos elegíveis (na ordem em que forem escolhidos), ativo. */
export function CriarLinkDialog({ open, linkId, onClose, report }: { readonly open: boolean; readonly linkId?: string; readonly onClose: () => void; readonly report: Report }) {
  if (!open) return null;
  return <FormularioDeLink linkId={linkId} onClose={onClose} report={report} />;
}

function FormularioDeLink({ linkId, onClose, report }: { readonly linkId?: string; readonly onClose: () => void; readonly report: Report }) {
  const state = useData((data) => data);
  const run = useRun();
  const existente = linkId ? state.linksDeCaptacao.find((l) => l.id === linkId) : undefined;
  const [nome, setNome] = useState(existente?.nome ?? "");
  const [slug, setSlug] = useState(existente?.slug ?? "");
  const [criterio, setCriterio] = useState<CriterioDeCaptacao>(existente?.criterio ?? "porOrdem");
  const [grupos, setGrupos] = useState<readonly string[]>(existente?.gruposElegiveisIds ?? []);
  const [ativo, setAtivo] = useState(existente?.ativo ?? true);
  const [erro, setErro] = useState<string | null>(null);

  const opcoes = state.grupos
    .filter((g) => g.lifecycle !== "naLixeira")
    .map((g) => {
      const recusa = recusaDeElegibilidade(state, g, "whatsapp");
      const motivo = recusa ?? motivoDeInelegibilidade(state, g);
      return {
        value: g.id,
        label: g.nome,
        detail: motivo ? `agora: ${motivo}` : "elegível agora",
        ...(recusa ? { disabledReason: recusa } : {}),
      };
    });

  const motivo = !nome.trim() ? "Dê um nome ao Link." : grupos.length === 0 ? "Escolha ao menos um Grupo elegível." : undefined;

  const confirmar = () => {
    const r = existente
      ? run((data, me) => editarLinkDeCaptacao(data, me, existente.id, { nome, criterio, gruposElegiveisIds: grupos, ativo }))
      : run((data, me) => criarLinkDeCaptacao(data, me, { nome, ...(slug.trim() ? { slug } : {}), criterio, gruposElegiveisIds: grupos, ativo }));
    if (!r.ok) {
      setErro(r.error);
      return;
    }
    report(r, existente ? "Link alterado." : `Link criado em /l/${r.value.slug}.`);
    onClose();
  };

  return (
    <ConfirmDialog
      open
      title={existente ? "Editar Link de Captação" : "Novo Link de Captação"}
      description="Um endereço público que manda cada clique ao Link de convite de um Grupo elegível. O Link referencia Grupos, nunca endereços — regenerar o convite de um Grupo não o quebra (RN-GRP-06)."
      confirmLabel={existente ? "Gravar" : "Criar Link"}
      wide
      {...(motivo ? { confirmDisabledReason: motivo } : {})}
      onConfirm={confirmar}
      onCancel={onClose}
    >
      <div className="grid gap-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nome" required>
            {(id) => <TextInput id={id} value={nome} onChange={setNome} placeholder="Por exemplo: Lançamento de outubro" />}
          </Field>
          <Field label="Endereço" hint={existente ? "O endereço não muda depois de criado: já pode estar impresso em algum lugar." : "Vazio, sai do nome. Só letras, dígitos e hífen."}>
            {(id) => <TextInput id={id} value={slug} onChange={setSlug} placeholder="lancamento-outubro" disabled={existente !== undefined} disabledReason="O endereço não muda depois de criado." />}
          </Field>
        </div>
        <Field label="Grupos elegíveis" required hint="Na ordem em que forem escolhidos: com o Critério “por ordem”, o primeiro elegível recebe o clique. O Grupo de avisos nunca entra (RN-COM-07).">
          {(id) => <MultiSelect id={id} values={grupos} onChange={setGrupos} options={opcoes} placeholder="Escolher os Grupos" />}
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Critério">
            {(id) => (
              <Select
                id={id}
                value={criterio}
                onChange={(v) => setCriterio(v as CriterioDeCaptacao)}
                options={[
                  { value: "porOrdem", label: "Por ordem", detail: "o primeiro elegível da lista" },
                  { value: "porCliques", label: "Por cliques", detail: "o elegível com menos cliques" },
                ]}
              />
            )}
          </Field>
          <div className="grid gap-1.5">
            <span className="rotulo" id="lcp-ativo">
              Ativo
            </span>
            <div className="flex items-center gap-3 py-1">
              <Toggle checked={ativo} onChange={setAtivo} labelledBy="lcp-ativo" />
              <span className="app-sm" style={{ color: "var(--texto-3)" }}>
                Inativo, o endereço não encaminha ninguém.
              </span>
            </div>
          </div>
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
