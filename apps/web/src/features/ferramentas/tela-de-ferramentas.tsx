"use client";

/**
 * FERRAMENTAS — um assunto do trilho, como CRM e IA, com três telas no
 * painel: Grupos, Comunidades e Flows (os Ativos de Canal, docs 23–25). Cada
 * tela é um gerenciador: lista no padrão das telas-índice, o registro aberto
 * num popup no formato da Tarefa e os diálogos de criação — tudo na URL
 * (`?grupo=`, `?comunidade=`, `?flow=`, `?criar=`). O provedor é simulado.
 *
 * Uma só casca para as três rotas: o cabeçalho, as ações e os avisos mudam
 * com a tela; o corpo é a aba correspondente.
 */

import { useRouter } from "next/navigation";
import { Layers, Users, Workflow } from "lucide-react";
import { useData, useRun, useSession } from "@/dados/store";
import { recusaDeMembroAtivo, sincronizarComunidade, sincronizarGrupo } from "@n1/dominio/operations";
import { useAvisos } from "@/features/shell/ficha";
import { ActionMenu, Button, Icone, PageHeader } from "@/features/shell/ui";
import { AbaComunidades } from "./aba-comunidades";
import { AbaFlows } from "./aba-flows";
import { AbaGrupos } from "./aba-grupos";
import { useParametros, type AbaDeFerramentas } from "./url";

const TITULO: Record<AbaDeFerramentas, string> = { grupos: "Grupos", comunidades: "Comunidades", flows: "Flows" };
const ICONE = { grupos: Users, comunidades: Layers, flows: Workflow } as const;

export function TelaDeFerramentas({ aba }: { readonly aba: AbaDeFerramentas }) {
  const state = useData((data) => data);
  const run = useRun();
  const router = useRouter();
  const { set } = useParametros();
  const { avisos, report } = useAvisos();
  const { memberId } = useSession();
  // A mesma recusa que cada sincronização devolveria: o item já nasce desligado com ela.
  const recusaDeMembro = recusaDeMembroAtivo(state, memberId);

  const grupos = state.grupos.filter((g) => g.lifecycle !== "naLixeira").length;
  const comunidades = state.comunidades.filter((c) => c.lifecycle !== "naLixeira").length;
  const flows = state.flows.filter((f) => f.lifecycle !== "naLixeira").length;
  const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;
  const contagem = aba === "grupos" ? plural(grupos, "Grupo", "Grupos") : aba === "comunidades" ? plural(comunidades, "Comunidade", "Comunidades") : plural(flows, "Flow", "Flows");

  const sincronizarTudo = () => {
    let ok = 0;
    let falhas = 0;
    // As recusas que as operações devolveram, sem repetição: é o que a tela mostra, nunca um motivo próprio.
    const erros = new Set<string>();
    const contar = (r: { ok: boolean; error?: string }) => {
      if (r.ok) ok += 1;
      else {
        falhas += 1;
        if (r.error) erros.add(r.error);
      }
    };
    if (aba === "grupos") {
      for (const g of state.grupos.filter((x) => x.lifecycle !== "naLixeira")) contar(run((data, me) => sincronizarGrupo(data, me, g.id)));
    } else {
      for (const c of state.comunidades.filter((x) => x.lifecycle !== "naLixeira")) contar(run((data, me) => sincronizarComunidade(data, me, c.id)));
    }
    report(
      falhas === 0 ? { ok: true } : { ok: false, error: `${ok} sincronizado${ok === 1 ? "" : "s"}, ${falhas} não: ${[...erros].join(" ") || "Não foi possível concluir a operação."}` },
      `${ok} ${aba === "grupos" ? "Grupo" : "Comunidade"}${ok === 1 ? "" : "s"} sincronizad${aba === "grupos" ? "o" : "a"}${ok === 1 ? "" : "s"}.`,
    );
  };

  const acoes =
    aba === "grupos" ? (
      <>
        <Button variant="primary" size="sm" onClick={() => set({ criar: "grupo" })}>
          Novo Grupo
        </Button>
        <ActionMenu
          items={[
            { label: "Novo Link de Captação", onSelect: () => set({ criar: "link" }) },
            { label: "Importar do Canal", onSelect: () => set({ criar: "importar" }) },
            { label: "Sincronizar tudo", onSelect: sincronizarTudo, ...(recusaDeMembro ? { disabledReason: recusaDeMembro } : {}) },
          ]}
        />
      </>
    ) : aba === "comunidades" ? (
      <>
        <Button variant="primary" size="sm" onClick={() => set({ criar: "comunidade" })}>
          Nova Comunidade
        </Button>
        <ActionMenu items={[{ label: "Sincronizar tudo", onSelect: sincronizarTudo, ...(recusaDeMembro ? { disabledReason: recusaDeMembro } : {}) }]} />
      </>
    ) : (
      <Button variant="primary" size="sm" onClick={() => set({ criar: "flow" })}>
        Novo Flow
      </Button>
    );

  return (
    <div className="flex h-full flex-col">
      <PageHeader path="Ferramentas" icon={<Icone de={ICONE[aba]} tamanho="sm" />} title={TITULO[aba]} meta={contagem} actions={acoes} />
      <div className="px-4 pt-2">{avisos}</div>
      {aba === "grupos" ? <AbaGrupos report={report} /> : aba === "comunidades" ? <AbaComunidades /> : <AbaFlows onAbrirConstrutor={(id) => router.push(`/ferramentas/flows/${id}`)} />}
    </div>
  );
}
