"use client";

/**
 * ENSAIAR UM AGENTE (DO-AGE-13, B82): uma Execução real, gravada com
 * `rehearsal`, em que a Composição do Contexto e as leituras acontecem e
 * toda escrita vira um Passo `simulado` — sem efeito, sem Registro no alvo e
 * sem Memória. É a única Execução que um rascunho admite (RN-AGE-10), e por
 * isso é o botão primário do Agente ativo e o caminho de teste do rascunho.
 *
 * A Âncora é opcional: uma Tarefa, um Negócio ou um Contato ativo que entra
 * na Composição do Contexto como registro-alvo (DO-AGE-09).
 *
 * Negócio e Contato vêm do CRM novo (Fase 15, 3.4.9, UCR-08): as listas são as de
 * `GET /negocios` e `GET /contatos`, com a busca indo à api como `q`, e o nome do que foi
 * escolhido vem de `POST /crm/nomes` quando ele sai da página de resultados. A operação leva
 * `nomes` com o nome que a tela tem; o servidor o descarta e relê das tabelas (15-08).
 */

import { useMemo, useState } from "react";
import { useContatos } from "@/dados/crm/contatos";
import { useNegocios } from "@/dados/crm/negocios";
import { useData, useRun, useSession } from "@/dados/store";
import { ensaiarAgente, recusaDeGovernarAgente } from "@n1/dominio/operations";
import { versaoCorrenteDoAgente } from "@n1/dominio/derive-ia";
import type { ChatAnchor } from "@n1/dominio/types";
import { useNavegar } from "@/features/shell/navegacao";
import { ConfirmDialog, Field, Select, TextArea, TextInput, type Option } from "@/features/shell/ui";
import { nomesDaEscolha, useNomeDaEscolha, type EscolhaDeAncora } from "../ancora-do-chat";

const ANCORA_LABEL: Record<string, string> = { task: "Tarefa", deal: "Negócio", contact: "Contato" };

/** Quantos Negócios e Contatos a lista traz por busca: o resto se acha digitando. */
const REGISTROS_POR_BUSCA = 30;

export function EnsaiarDialog({ agentId, open, onClose }: { readonly agentId: string; readonly open: boolean; readonly onClose: () => void }) {
  const state = useData((data) => data);
  const run = useRun();
  const { memberId } = useSession();
  const [navegar, pendente] = useNavegar();
  const [texto, setTexto] = useState("");
  // `tipo:id` num valor só: o Select é de string, e a Âncora tem duas partes.
  const [ancora, setAncora] = useState("");
  // O nome do registro escolhido fica à parte da lista: a busca muda a página de resultados.
  const [nomeEscolhido, setNomeEscolhido] = useState<string | undefined>(undefined);
  const [busca, setBusca] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const negocios = useNegocios({ q: busca, limite: REGISTROS_POR_BUSCA }, { pausado: !open });
  const contatos = useContatos({ q: busca, limite: REGISTROS_POR_BUSCA }, { pausado: !open });
  const separador = ancora.indexOf(":");
  const escolha = useMemo(
    (): EscolhaDeAncora | null =>
      separador > 0 ? { type: ancora.slice(0, separador) as ChatAnchor["type"], id: ancora.slice(separador + 1), ...(nomeEscolhido !== undefined ? { nome: nomeEscolhido } : {}) } : null,
    [ancora, separador, nomeEscolhido],
  );
  const nomeDaEscolha = useNomeDaEscolha(escolha);

  const agent = state.agents.find((a) => a.id === agentId);
  const version = agent ? versaoCorrenteDoAgente(agent) : undefined;

  const motivo = !agent
    ? "Agente não encontrado."
    : (recusaDeGovernarAgente(state, memberId, agent, "editar") ??
      (agent.lifecycle !== "rascunho" && agent.lifecycle !== "ativo"
        ? "Só um Agente em rascunho ou ativo ensaia (DO-AGE-13)."
        : !version?.instructions.trim()
          ? "Escreva as instruções antes de ensaiar: sem elas o Agente não sabe o que fazer."
          : !texto.trim()
            ? "Escreva o pedido do ensaio."
            : pendente
              ? "Abrindo a Execução…"
              : undefined));

  const itensDeNegocio = negocios.data?.itens;
  const itensDeContato = contatos.data?.itens;
  const opcoes = useMemo((): Option[] => {
    const termo = busca.trim().toLowerCase();
    const lista: Option[] = [
      // A Tarefa é do store: a mesma busca recorta o título aqui.
      ...state.tasks
        .filter((t) => t.lifecycle === "ativo" && (termo === "" || t.title.toLowerCase().includes(termo)))
        .map((t) => ({ value: `task:${t.id}`, label: t.title, detail: ANCORA_LABEL.task ?? "Tarefa" })),
      ...(itensDeNegocio ?? []).map((n) => ({ value: `deal:${n.id}`, label: n.titulo, detail: ANCORA_LABEL.deal ?? "Negócio" })),
      ...(itensDeContato ?? []).map((c) => ({ value: `contact:${c.id}`, label: c.nomeDeExibicao, detail: ANCORA_LABEL.contact ?? "Contato" })),
    ];
    // O registro escolhido sai da página de resultados quando a busca muda; o nome vem de POST /crm/nomes.
    if (escolha && !lista.some((o) => o.value === ancora)) {
      lista.unshift({ value: ancora, label: nomeDaEscolha ?? nomeEscolhido ?? "Registro", detail: ANCORA_LABEL[escolha.type] ?? "Registro" });
    }
    return lista;
  }, [state.tasks, itensDeNegocio, itensDeContato, busca, ancora, escolha, nomeDaEscolha, nomeEscolhido]);

  const reset = () => {
    setTexto("");
    setAncora("");
    setNomeEscolhido(undefined);
    setBusca("");
    setErro(null);
  };

  const confirmar = () => {
    const anchor = escolha ? { type: escolha.type, id: escolha.id } : undefined;
    const entrada = { texto, ...(anchor ? { anchor } : {}) };
    // `nomes`: o nome que a tela tem do Negócio ou Contato; o servidor o descarta e relê das tabelas (15-08).
    const nomes = escolha ? nomesDaEscolha(escolha) : {};
    const result = run((data, me) => (Object.keys(nomes).length > 0 ? ensaiarAgente(data, me, agentId, entrada, nomes) : ensaiarAgente(data, me, agentId, entrada)));
    if (!result.ok) {
      setErro(result.error);
      return;
    }
    reset();
    onClose();
    navegar(`/ia/execucoes/${result.value.id}`);
  };

  return (
    <ConfirmDialog
      open={open}
      title={`Ensaiar ${agent?.name ?? "o Agente"}`}
      description="Escritas são simuladas, sem efeito e sem Memória (B82). Consome custo."
      confirmLabel="Ensaiar"
      {...(motivo ? { confirmDisabledReason: motivo } : {})}
      onConfirm={confirmar}
      onCancel={() => {
        reset();
        onClose();
      }}
    >
      <div className="grid gap-5">
        <Field label="Pedido" required {...(version ? { hint: `Respondido com as instruções da Versão ${version.number}.` } : {})}>
          {(id) => <TextArea id={id} value={texto} onChange={setTexto} rows={4} placeholder="O que o Agente deve fazer neste ensaio" />}
        </Field>
        <Field label="Buscar registro" hint="A busca vai às listas de Negócios e Contatos do CRM e recorta as Tarefas.">
          {(id) => <TextInput id={id} value={busca} onChange={setBusca} placeholder="Parte do nome" />}
        </Field>
        <Field label="Âncora" hint="O registro que entra na Composição do Contexto (DO-AGE-09). Opcional.">
          {(id) => (
            <Select
              id={id}
              value={ancora}
              onChange={(valor) => {
                setAncora(valor);
                setNomeEscolhido(opcoes.find((o) => o.value === valor)?.label);
              }}
              placeholder="Sem Âncora"
              options={[{ value: "", label: "Sem Âncora", detail: "só o pedido" }, ...opcoes]}
            />
          )}
        </Field>
        {erro ? (
          <p role="alert" className="app-base" style={{ color: "var(--erro)" }}>
            {erro}
          </p>
        ) : null}
      </div>
    </ConfirmDialog>
  );
}
