"use client";

/**
 * T49 — Lixeira.
 *
 * A4.2 — `naLixeira` is a state of the record, not a place it moved to: what is
 * here still belongs to its container, and restoring returns it to the state it
 * had before (`lifecycleBeforeTrash`), not always to `ativo`.
 *
 * The retention countdown is the only thing that makes this screen urgent, so
 * it is computed per record and shown as days remaining, not as a raw date.
 *
 * 15-14 (UCR-07) — Contatos, Empresas, Negócios e Conversas vêm das rotas REST do
 * CRM (`GET /<recurso>?estado=na_lixeira`) e voltam por `POST /<recurso>/:id/restaurar`
 * (T-15-36: quem decide é a api, não o store). O resto (Tarefas, Espaços, Pastas,
 * Listas, Agentes, Automações) segue do store e das operações de hoje. Os resumos de
 * Contato, Empresa e Negócio não trazem o instante em que foram à lixeira: "Enviado
 * em" e a contagem usam `atualizadoEm`, que não muda depois que o registro está lá.
 */

import Link from "next/link";
import { useRef, useState } from "react";
import { useData, useRun } from "@/dados/store";
import {
  restoreAgent,
  restoreAutomation,
  restoreContainer,
  restoreList,
  restoreTask,
  purgeTask,
} from "@n1/dominio/operations";
import { LIMITES_CRM } from "@n1/dominio/crm/comum";
import type { DataState, OperationResult } from "@n1/dominio/state";
import { ErroDeApi } from "@/dados/crm/cliente-crm";
import { restaurarContato, useContatos } from "@/dados/crm/contatos";
import { restaurarConversa, useConversas } from "@/dados/crm/conversas";
import { restaurarEmpresa, useEmpresas } from "@/dados/crm/empresas";
import { restaurarNegocio, useNegocios } from "@/dados/crm/negocios";
import { useFormat } from "@/features/shell/use-format";
import { Button, ConfirmDialog, CorpoDeTela, EmptyState, PageHeader, Section, Toast } from "@/features/shell/ui";

interface TrashedRow {
  readonly id: string;
  readonly family: string;
  readonly name: string;
  readonly href?: string;
  readonly trashedAt?: string;
  readonly restorable: boolean;
  readonly restoreHint: string;
  /** Só as famílias do CRM: restaura pela rota REST (a api recusa quando não pode). */
  readonly restaurarNoCrm?: () => Promise<unknown>;
}

/** Os resumos do CRM na lixeira pedem a maior página: a Lixeira lista tudo, e diz quando não coube. */
const PAGINA_DA_LIXEIRA = { estado: "na_lixeira", limite: LIMITES_CRM.paginaMaxima } as const;

export default function LixeiraPage() {
  const state = useData((data) => data);
  const fmt = useFormat();
  const run = useRun();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [now] = useState(() => Date.now());
  const contatosNaLixeira = useContatos(PAGINA_DA_LIXEIRA);
  const empresasNaLixeira = useEmpresas(PAGINA_DA_LIXEIRA);
  const negociosNaLixeira = useNegocios(PAGINA_DA_LIXEIRA);
  const conversasNaLixeira = useConversas(PAGINA_DA_LIXEIRA);
  // Restaurações em andamento: o botão espera a resposta, então um segundo clique não manda outra gravação.
  const emAndamento = useRef(new Set<string>());
  const [restaurando, setRestaurando] = useState<ReadonlySet<string>>(new Set());
  // PARD-10 — "eliminar agora": só Tarefa, por enquanto; definitivo, por isso confirma.
  const [eliminando, setEliminando] = useState<TrashedRow | null>(null);

  const retentionDays = state.workspace.trashPolicy.retentionDays;

  const rows: readonly TrashedRow[] = [
    ...state.tasks
      .filter((task) => task.lifecycle === "naLixeira")
      .map((task) => ({
        id: task.id,
        family: "Tarefa",
        name: task.title,
        href: `/estrutura/tarefas/${task.id}`,
        trashedAt: task.trashedAt,
        restorable: true,
        restoreHint: "Volta ao estado que tinha antes de ir à lixeira.",
      })),
    ...state.spaces
      .filter((space) => space.lifecycle === "naLixeira")
      .map((space) => ({
        id: space.id,
        family: "Espaço",
        name: space.name,
        href: `/estrutura/espacos/${space.id}`,
        trashedAt: space.trashedAt,
        restorable: true,
        restoreHint: "Volta com as Pastas, Listas e Tarefas que foram à lixeira junto com ele.",
      })),
    ...state.folders
      .filter((folder) => folder.lifecycle === "naLixeira")
      .map((folder) => ({
        id: folder.id,
        family: "Pasta",
        name: folder.name,
        href: `/estrutura/pastas/${folder.id}`,
        trashedAt: folder.trashedAt,
        restorable: true,
        restoreHint: "Volta com as Listas e Tarefas que foram à lixeira junto com ela; o Espaço acima precisa estar fora da lixeira.",
      })),
    ...state.lists
      .filter((list) => list.lifecycle === "naLixeira")
      .map((list) => ({
        id: list.id,
        family: "Lista",
        name: list.name,
        href: `/estrutura/listas/${list.id}`,
        trashedAt: list.trashedAt,
        restorable: true,
        restoreHint: "Volta com as Tarefas que foram à lixeira junto com ela; as que já estavam lá antes continuam lá.",
      })),
    ...(contatosNaLixeira.data?.itens ?? []).map((contato) => ({
      id: contato.id,
      family: "Contato",
      name: contato.nomeDeExibicao,
      href: `/crm/contatos/${contato.id}`,
      trashedAt: contato.atualizadoEm,
      restorable: true,
      restoreHint: "Volta ao estado que tinha antes. Uma Mensagem recebida também o traz de volta automaticamente.",
      restaurarNoCrm: () => restaurarContato(contato.id),
    })),
    ...(empresasNaLixeira.data?.itens ?? []).map((empresa) => ({
      id: empresa.id,
      family: "Empresa",
      name: empresa.nomeDeExibicao,
      href: `/crm/empresas/${empresa.id}`,
      trashedAt: empresa.atualizadoEm,
      restorable: true,
      restoreHint: "Os Vínculos foram encerrados na lixeira e ficam no histórico; ela volta com um Contato admin indicado na ficha.",
      restaurarNoCrm: () => restaurarEmpresa(empresa.id),
    })),
    ...(negociosNaLixeira.data?.itens ?? []).map((negocio) => ({
      id: negocio.id,
      family: "Negócio",
      name: negocio.titulo,
      href: `/crm/negocios/${negocio.id}`,
      trashedAt: negocio.atualizadoEm,
      restorable: true,
      restoreHint: "Volta ao Funil e à Etapa que ocupava; se a Etapa foi removida, volta à primeira e o Registro diz de onde veio.",
      restaurarNoCrm: () => restaurarNegocio(negocio.id),
    })),
    ...(conversasNaLixeira.data?.itens ?? []).map((conversa) => ({
      id: conversa.id,
      family: "Conversa",
      name: conversa.titulo,
      href: `/crm/caixa-de-entrada/${conversa.id}`,
      trashedAt: conversa.naLixeiraEm ?? conversa.atualizadoEm,
      restorable: true,
      restoreHint: "Volta resolvida, com as Mensagens que nunca saíram.",
      restaurarNoCrm: () => restaurarConversa(conversa.id),
    })),
    ...state.agents
      .filter((agent) => agent.lifecycle === "naLixeira")
      .map((agent) => ({
        id: agent.id,
        family: "Agente",
        name: agent.name,
        href: `/ia/agentes/${agent.id}`,
        trashedAt: agent.trashedAt,
        restorable: true,
        restoreHint: "As Concessões de Habilidade voltam com ele.",
      })),
    ...state.automations
      .filter((automation) => automation.lifecycle === "naLixeira")
      .map((automation) => ({
        id: automation.id,
        family: "Automação",
        name: automation.name,
        href: `/ia/automacoes/${automation.id}`,
        trashedAt: automation.trashedAt,
        restorable: true,
        restoreHint: "Volta pausada: reativar é um ato separado.",
      })),
  ];

  const consultasDoCrm = [contatosNaLixeira, empresasNaLixeira, negociosNaLixeira, conversasNaLixeira];
  const carregandoCrm = consultasDoCrm.some((consulta) => consulta.isLoading);
  const recusaDaLista = consultasDoCrm.find((consulta) => consulta.error !== undefined)?.error;
  // A página do CRM tem teto; se a lixeira passar dele, a tela diz quantos faltam em vez de fingir que é tudo.
  const foraDaPagina = consultasDoCrm.reduce(
    (soma, consulta) => soma + Math.max(0, (consulta.data?.total ?? 0) - (consulta.data?.itens.length ?? 0)),
    0,
  );

  const sorted = [...rows].sort((a, b) => (b.trashedAt ?? "").localeCompare(a.trashedAt ?? ""));

  const daysLeft = (trashedAt?: string): number | null => {
    if (!trashedAt) return null;
    const elapsed = (now - Date.parse(trashedAt)) / 86_400_000;
    return Math.max(0, Math.ceil(retentionDays - elapsed));
  };

  const rotuloRestaurado = (row: TrashedRow): string =>
    `${row.family} ${row.family === "Espaço" || row.family === "Negócio" || row.family === "Contato" || row.family === "Agente" ? "restaurado" : "restaurada"}: ${row.name}.`;

  /** CRM: a rota decide. Recusa da api (segunda restauração, Empresa sem admin…) vai para o aviso, e a lista não é relida. */
  const restoreNoCrm = async (row: TrashedRow, restaurar: () => Promise<unknown>) => {
    const chave = `${row.family}-${row.id}`;
    if (emAndamento.current.has(chave)) return;
    emAndamento.current.add(chave);
    setRestaurando(new Set(emAndamento.current));
    try {
      await restaurar();
      setError(null);
      setNotice(rotuloRestaurado(row));
    } catch (erro) {
      setNotice(null);
      const mensagem = erro instanceof Error ? erro.message : "Não foi possível restaurar.";
      setError(erro instanceof ErroDeApi && erro.codigo === "EMPRESA_SEM_ADMIN" ? `${mensagem} Abra a ficha da Empresa para escolher o admin.` : mensagem);
    } finally {
      emAndamento.current.delete(chave);
      setRestaurando(new Set(emAndamento.current));
    }
  };

  const restore = (row: TrashedRow) => {
    if (row.restaurarNoCrm) {
      void restoreNoCrm(row, row.restaurarNoCrm);
      return;
    }
    const restoreOf: Record<
      string,
      (data: DataState, memberId: string) => OperationResult<unknown>
    > = {
      Tarefa: (data, memberId) => restoreTask(data, memberId, row.id),
      Espaço: (data, memberId) => restoreContainer(data, memberId, "space", row.id),
      Pasta: (data, memberId) => restoreContainer(data, memberId, "folder", row.id),
      Lista: (data, memberId) => restoreList(data, memberId, row.id),
      Agente: (data, memberId) => restoreAgent(data, memberId, row.id),
      Automação: (data, memberId) => restoreAutomation(data, memberId, row.id),
    };
    const operation = restoreOf[row.family];
    if (!operation) {
      setNotice(null);
      setError(`Não sei restaurar um registro da família ${row.family}.`);
      return;
    }
    const result = run(operation);
    if (result.ok) {
      setError(null);
      setNotice(rotuloRestaurado(row));
    } else {
      setNotice(null);
      setError(result.error);
    }
  };

  const subtarefasDe = (taskId: string): number => {
    let total = 0;
    const desce = (id: string) => {
      for (const filha of state.tasks.filter((t) => t.parentTaskId === id)) {
        total += 1;
        desce(filha.id);
      }
    };
    desce(taskId);
    return total;
  };

  return (
    <div className="flex h-full flex-col">
      {eliminando ? (
        <ConfirmDialog
          open
          title={`Eliminar “${eliminando.name}” agora?`}
          description={`Não tem volta: a Tarefa sai do Espaço de Trabalho com Comentários, Checklists e Registros de Tempo${
            subtarefasDe(eliminando.id) > 0 ? `, e ${subtarefasDe(eliminando.id)} Subtarefa(s) vão junto` : ""
          }. Vínculos e Dependências são desfeitos; os Arquivos e o Registro de Atividade ficam.`}
          confirmLabel="Eliminar agora"
          destructive
          onConfirm={() => {
            const alvo = eliminando;
            setEliminando(null);
            const result = run((data, memberId) => purgeTask(data, memberId, alvo.id));
            if (result.ok) {
              setError(null);
              setNotice(`Tarefa eliminada: ${alvo.name}.`);
            } else {
              setNotice(null);
              setError(result.error);
            }
          }}
          onCancel={() => setEliminando(null)}
        />
      ) : null}
      <PageHeader
        path={
          <Link href="/configuracoes" className="hover:underline">
            Configurações
          </Link>
        }
        title="Lixeira"
        meta={`${sorted.length} na lixeira · retenção de ${retentionDays} dias`}
      />

      <CorpoDeTela>
        {notice ? (
          <Toast tone="success" onDismiss={() => setNotice(null)}>
            {notice}
          </Toast>
        ) : null}
        {error ? (
          <Toast tone="error" onDismiss={() => setError(null)}>
            {error}
          </Toast>
        ) : null}
        {recusaDaLista ? <Toast tone="error">Não foi possível ler o CRM: {recusaDaLista.message}</Toast> : null}

        <Section title="Na lixeira" count={sorted.length}>
          {sorted.length === 0 && carregandoCrm ? (
            <p className="app-meta px-1" role="status">
              Lendo a lixeira…
            </p>
          ) : sorted.length === 0 ? (
            <EmptyState
              title="A lixeira está vazia."
              hint="Nada foi enviado à lixeira neste Espaço de Trabalho."
            />
          ) : (
            <table className="tabela">
              <thead>
                <tr>
                  <th className="app-coluna">Registro</th>
                  <th className="app-coluna">Família</th>
                  <th className="app-coluna">Enviado em</th>
                  <th className="app-coluna">Restam</th>
                  <th className="app-coluna" />
                </tr>
              </thead>
              <tbody>
                {sorted.map((row) => {
                  const remaining = daysLeft(row.trashedAt);
                  return (
                    <tr key={`${row.family}-${row.id}`}>
                      <td>
                        {row.href ? (
                          <Link href={row.href} className="app-md hover:underline" style={{ color: "var(--texto)" }}>
                            {row.name}
                          </Link>
                        ) : (
                          <span className="app-md" style={{ color: "var(--texto)" }}>
                            {row.name}
                          </span>
                        )}
                        <span className="app-meta block">{row.restoreHint}</span>
                      </td>
                      <td>{row.family}</td>
                      <td className="whitespace-nowrap">
                        <span className="app-meta app-numero">{row.trashedAt ? fmt.instant(row.trashedAt) : "—"}</span>
                      </td>
                      <td>
                        {remaining === null ? (
                          <span style={{ color: "var(--texto-4)" }}>—</span>
                        ) : (
                          <span
                            className="app-numero"
                            style={remaining <= 3 ? { color: "var(--erro)", fontWeight: 500 } : { color: "var(--texto)" }}
                          >
                            {remaining} dia(s)
                          </span>
                        )}
                      </td>
                      <td className="whitespace-nowrap">
                        <span className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            onClick={() => restore(row)}
                            disabled={!row.restorable}
                            carregando={restaurando.has(`${row.family}-${row.id}`)}
                            disabledReason={
                              restaurando.has(`${row.family}-${row.id}`)
                                ? "Restaurando…"
                                : "A restauração desta família ainda não está implementada neste protótipo."
                            }
                          >
                            Restaurar
                          </Button>
                          {row.family === "Tarefa" ? (
                            <Button size="sm" variant="danger" onClick={() => setEliminando(row)}>
                              Eliminar agora
                            </Button>
                          ) : null}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
          {foraDaPagina > 0 ? (
            <p className="app-meta mt-2">
              Há mais {foraDaPagina} registro(s) do CRM na lixeira além dos {LIMITES_CRM.paginaMaxima} mais recentes de cada tipo; restaure alguns para ver o restante.
            </p>
          ) : null}
          <p className="app-meta mt-2">
            Restaurar devolve o registro ao estado que ele tinha antes de ir à lixeira — que nem sempre é
            ativo: o que estava arquivado volta arquivado. Passado o prazo, a agenda da Lista elimina a
            Tarefa de vez, com as Subtarefas; “Eliminar agora” faz o mesmo sem esperar.
          </p>
        </Section>
      </CorpoDeTela>
    </div>
  );
}
