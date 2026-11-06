"use client";

/**
 * O DIÁLOGO DA ÂNCORA (B83) — escolher o registro que dá o contexto inicial da
 * Sessão. Um só para a home (a Âncora vai na criação) e para a Sessão ainda
 * sem Mensagens (a Âncora ainda pode mudar); com Mensagens ela se fixa, e quem
 * chama não oferece mais o diálogo.
 *
 * O diálogo edita um RASCUNHO: Cancelar não mexe na Âncora que já existia (a
 * versão anterior, na home, apagava a Âncora ao cancelar).
 *
 * Negócio, Contato e Conversa vivem nas tabelas do CRM novo (Fase 15, 3.4.9, UCR-08): o
 * diálogo os lista pelas rotas de lista, com a busca indo à api como `q`, e o nome de uma
 * Âncora no CRM vem de `POST /crm/nomes` (`useNomesDoCrm`). Nada disso sai do store. A
 * operação (`createChatSession`, `configureChatSession`) leva o nome que a tela tem em `nomes`
 * (último argumento): o servidor o descarta e relê das tabelas, e o navegador só o usa para
 * aplicar na hora. Tarefa e Documento de Conhecimento continuam do store.
 */

import { useMemo, useState } from "react";
import { useData, useSession } from "@/dados/store";
import { useContatos } from "@/dados/crm/contatos";
import { useConversas } from "@/dados/crm/conversas";
import { useNegocios } from "@/dados/crm/negocios";
import { nomeDe, useNomesDoCrm } from "@/dados/crm/nomes";
import type { AlvoDoCrm } from "@n1/dominio/crm/nomes";
import type { DataState } from "@n1/dominio/state";
import type { ChatAnchor, NomesDasAncoras } from "@n1/dominio/types";
import { memberSeesTask } from "@n1/dominio/derive";
import { ConfirmDialog, Field, Select, TextInput, type Option } from "@/features/shell/ui";

/** B83 — as famílias que o Chat oferece para ancorar uma Sessão. */
export const TIPOS_DE_ANCORA = [
  { value: "deal", label: "Negócio" },
  { value: "task", label: "Tarefa" },
  { value: "contact", label: "Contato" },
  { value: "conversation", label: "Conversa" },
  { value: "knowledgeDocument", label: "Documento de Conhecimento" },
] as const satisfies ReadonlyArray<{ readonly value: ChatAnchor["type"]; readonly label: string }>;

type TipoOferecido = (typeof TIPOS_DE_ANCORA)[number]["value"];

/** O texto de uma Âncora no CRM cuja api não devolveu nome (sem permissão, de outro Espaço ou inexistente). */
export const NOME_INDISPONIVEL = "Registro indisponível";

/** Quantos registros a lista do diálogo traz por busca: o resto se acha digitando. */
const REGISTROS_POR_BUSCA = 30;

export interface EscolhaDeAncora {
  readonly type: ChatAnchor["type"];
  readonly id: string;
  /** O nome que a tela tem do registro do CRM; vai em `nomes` na operação e nunca no pedido da Âncora. */
  readonly nome?: string;
}

/** As famílias da Âncora que moram no CRM novo (a api dá a lista e o nome). */
const TIPOS_NO_CRM: ReadonlySet<string> = new Set<ChatAnchor["type"]>(["deal", "contact", "company", "conversation"]);

function alvoDoCrm(escolha: Pick<EscolhaDeAncora, "type" | "id">): AlvoDoCrm | undefined {
  return TIPOS_NO_CRM.has(escolha.type) ? { tipo: escolha.type as AlvoDoCrm["tipo"], id: escolha.id } : undefined;
}

/** A Âncora como a operação a recebe: só o tipo e o id (o nome da tela não é parte dela). */
export function ancoraDaEscolha(escolha: EscolhaDeAncora): { readonly type: ChatAnchor["type"]; readonly id: string } {
  return { type: escolha.type, id: escolha.id };
}

/**
 * O `nomes` que a operação leva: o nome do registro do CRM que a tela escolheu. Vazio para
 * Tarefa e Documento (o domínio os lê do estado) e para uma escolha sem nome.
 */
export function nomesDaEscolha(escolha: EscolhaDeAncora): NomesDasAncoras {
  return alvoDoCrm(escolha) && escolha.nome !== undefined ? { [escolha.id]: escolha.nome } : {};
}

/**
 * Os registros ativos de uma família que ficam no store, como opções de escolha — só os que o
 * Membro VÊ (RN-CHT-03; a Tarefa é a família com visibilidade por Membro, e a operação recusa
 * a Âncora numa Tarefa alheia com a mesma regra). O CRM novo não passa por aqui.
 */
function registrosDoStore(state: DataState, memberId: string, tipo: string): Option[] {
  switch (tipo as TipoOferecido) {
    case "task":
      return state.tasks.filter((t) => t.lifecycle === "ativo" && memberSeesTask(state, memberId, t.id)).map((t) => ({ value: t.id, label: t.title }));
    case "knowledgeDocument":
      return state.documents.filter((d) => d.lifecycle === "ativo").map((d) => ({ value: d.id, label: d.title }));
    default:
      return [];
  }
}

/** O nome de uma Âncora do store (Tarefa ou Documento), ou `undefined` se o registro não está lá. */
function nomeNoStore(state: DataState, escolha: EscolhaDeAncora): string | undefined {
  if (escolha.type === "task") return state.tasks.find((t) => t.id === escolha.id)?.title;
  if (escolha.type === "knowledgeDocument") return state.documents.find((d) => d.id === escolha.id)?.title;
  return undefined;
}

/**
 * O nome que a tela mostra para a Âncora escolhida (a home, antes de a Sessão existir).
 * No CRM novo vem de `POST /crm/nomes`: `null` da api é "Registro indisponível" (UCR-08: a
 * tela nunca mostra o nome que a api não devolveu); enquanto a resposta não chega vale o nome
 * da escolha. Tarefa e Documento vêm do store.
 */
export function useNomeDaEscolha(escolha: EscolhaDeAncora | null): string | undefined {
  const state = useData((data) => data);
  const alvo = escolha ? alvoDoCrm(escolha) : undefined;
  const nomes = useNomesDoCrm(alvo ? [alvo] : []);
  if (!escolha) return undefined;
  if (!alvo) return nomeNoStore(state, escolha) ?? "Registro";
  const nome = nomeDe(nomes, alvo.tipo, alvo.id);
  if (nome === null) return NOME_INDISPONIVEL;
  return nome ?? escolha.nome ?? "Registro";
}

/**
 * As opções de registro da família escolhida: a lista do CRM novo (com a busca indo à api) ou
 * o store. Só a família escolhida, com o diálogo aberto, vai à rede (`pausado` nas outras).
 */
function useOpcoesDeRegistro(tipo: string, busca: string, aberto: boolean): { readonly opcoes: Option[]; readonly carregando: boolean } {
  const state = useData((data) => data);
  const { memberId } = useSession();
  const filtro = { q: busca, limite: REGISTROS_POR_BUSCA };
  const negocios = useNegocios(filtro, { pausado: !aberto || tipo !== "deal" });
  const contatos = useContatos(filtro, { pausado: !aberto || tipo !== "contact" });
  const conversas = useConversas(filtro, { pausado: !aberto || tipo !== "conversation" });

  const itensDeNegocio = negocios.data?.itens;
  const itensDeContato = contatos.data?.itens;
  const itensDeConversa = conversas.data?.itens;
  const opcoes = useMemo((): Option[] => {
    switch (tipo as TipoOferecido) {
      case "deal":
        return (itensDeNegocio ?? []).map((n) => ({ value: n.id, label: n.titulo }));
      case "contact":
        return (itensDeContato ?? []).map((c) => ({ value: c.id, label: c.nomeDeExibicao }));
      case "conversation":
        return (itensDeConversa ?? []).map((c) => ({ value: c.id, label: c.titulo, ...(c.contatoNome ? { detail: c.contatoNome } : {}) }));
      default:
        return registrosDoStore(state, memberId, tipo);
    }
  }, [tipo, itensDeNegocio, itensDeContato, itensDeConversa, state, memberId]);

  const carregando = tipo === "deal" ? negocios.isLoading : tipo === "contact" ? contatos.isLoading : tipo === "conversation" ? conversas.isLoading : false;
  return { opcoes, carregando };
}

export function useDialogoDeAncora(aoConfirmar: (escolha: EscolhaDeAncora) => void) {
  const [aberto, setAberto] = useState(false);
  const [tipo, setTipo] = useState("");
  const [registro, setRegistro] = useState("");
  // O nome do registro escolhido fica à parte da lista: a busca muda a página de resultados.
  const [nomeEscolhido, setNomeEscolhido] = useState<string | undefined>(undefined);
  const [busca, setBusca] = useState("");
  const noCrm = tipo !== "" && TIPOS_NO_CRM.has(tipo);
  const { opcoes: daLista, carregando } = useOpcoesDeRegistro(tipo, busca, aberto);
  const opcoes = useMemo(() => {
    if (registro !== "" && nomeEscolhido !== undefined && !daLista.some((o) => o.value === registro)) {
      return [{ value: registro, label: nomeEscolhido }, ...daLista];
    }
    return daLista;
  }, [daLista, registro, nomeEscolhido]);
  const motivo = tipo === "" ? "Escolha o tipo de registro." : registro === "" ? "Escolha o registro." : undefined;

  const dialogo = (
    <ConfirmDialog
      open={aberto}
      title="Ancorar a Sessão"
      description="A Âncora dá contexto à Sessão e se fixa com a primeira Mensagem: ela guarda o nome que o registro tem agora."
      confirmLabel="Usar esta Âncora"
      {...(motivo ? { confirmDisabledReason: motivo } : {})}
      onConfirm={() => {
        if (motivo) return;
        const nome = opcoes.find((o) => o.value === registro)?.label ?? nomeEscolhido;
        aoConfirmar({ type: tipo as TipoOferecido, id: registro, ...(noCrm && nome !== undefined ? { nome } : {}) });
        setAberto(false);
      }}
      onCancel={() => setAberto(false)}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Ancorar em">
          {(id) => (
            <Select
              id={id}
              value={tipo}
              onChange={(valor) => {
                setTipo(valor);
                setRegistro("");
                setNomeEscolhido(undefined);
                setBusca("");
              }}
              placeholder="Escolher o tipo"
              options={TIPOS_DE_ANCORA.map((t) => ({ value: t.value, label: t.label }))}
            />
          )}
        </Field>
        {noCrm ? (
          <Field label="Buscar registro" hint="A busca vai à lista do CRM; escolha em seguida.">
            {(id) => <TextInput id={id} value={busca} onChange={setBusca} placeholder="Parte do nome" />}
          </Field>
        ) : null}
        {tipo ? (
          <Field label="Registro">
            {(id) => (
              <Select
                id={id}
                value={registro}
                onChange={(valor) => {
                  setRegistro(valor);
                  setNomeEscolhido(opcoes.find((o) => o.value === valor)?.label);
                }}
                searchable={!noCrm}
                placeholder={carregando ? "Carregando…" : "Escolher"}
                options={opcoes}
              />
            )}
          </Field>
        ) : null}
      </div>
    </ConfirmDialog>
  );

  return {
    dialogo,
    /** Abre com a Âncora atual (se houver) no rascunho. */
    abrir: (atual?: EscolhaDeAncora) => {
      const oferecido = atual && TIPOS_DE_ANCORA.some((t) => t.value === atual.type) ? atual : undefined;
      setTipo(oferecido?.type ?? "");
      setRegistro(oferecido?.id ?? "");
      setNomeEscolhido(oferecido?.nome);
      setBusca("");
      setAberto(true);
    },
  };
}
