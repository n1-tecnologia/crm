"use client";

/**
 * T44 — Tags.
 *
 * The Tag is workspace vocabulary: the same Tag crosses Tasks, Contacts,
 * Companies, Deals and Conversations. The usage count is what makes archiving
 * a decision instead of a guess, so it is computed and shown per family.
 *
 * AVIS-02 — a Tag nasce e muda AQUI: nome, cor e as famílias a que se aplica,
 * por quem administra o Espaço de Trabalho (B35). Antes só o seed as escrevia.
 */

import Link from "next/link";
import { useState } from "react";
import { Plus } from "lucide-react";
import { useData, useRun, useSession } from "@/dados/store";
import { archiveTag, createTag, restoreTag, updateTag } from "@n1/dominio/operations";
import { administraOEspaco } from "@n1/dominio/operations/ia/permissoes-ia";
import type { Tag } from "@n1/dominio/types";
import { ActionMenu, BarraDeFiltros, Button, ConfirmDialog, CorpoDeTela, EmptyState, Field, Icone, MultiSelect, PageHeader, Pilula, Section, StateSeal, TextInput, Toast } from "@/features/shell/ui";

const TARGET_LABEL: Record<string, string> = {
  task: "Tarefas",
  contact: "Contatos",
  company: "Empresas",
  deal: "Negócios",
  conversation: "Conversas",
  grupo: "Grupos",
  comunidade: "Comunidades",
  flow: "Flows",
};

type Alvo = NonNullable<Tag["appliesTo"]>[number];
const ALVOS = Object.keys(TARGET_LABEL) as Alvo[];

export default function TagsPage() {
  const state = useData((data) => data);
  const run = useRun();
  const { memberId } = useSession();
  const [includeArchived, setIncludeArchived] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // O diálogo de criar ou editar: `null` fechado, `"nova"` criando, ou o id em edição.
  const [editando, setEditando] = useState<"nova" | string | null>(null);
  const [nome, setNome] = useState("");
  const [cor, setCor] = useState("#7c3aed");
  const [alvos, setAlvos] = useState<readonly string[]>([]);
  const [erroDoDialogo, setErroDoDialogo] = useState<string | null>(null);

  const administra = administraOEspaco(state, memberId);
  const motivo = administra ? undefined : "Só quem administra o Espaço de Trabalho cria e edita Tags.";
  const report = (result: { ok: boolean; error?: string }, message: string) => {
    if (result.ok) {
      setError(null);
      setNotice(message);
    } else {
      setNotice(null);
      setError(result.error ?? "Não foi possível concluir a operação.");
    }
  };

  const tags = state.tags.filter((tag) => includeArchived || tag.lifecycle === "ativo");
  const archivedCount = state.tags.filter((tag) => tag.lifecycle !== "ativo").length;

  const usageOf = (tagId: string) => ({
    task: state.tasks.filter((task) => task.tagIds.includes(tagId)).length,
    contact: state.contacts.filter((contact) => contact.tagIds.includes(tagId)).length,
    company: state.companies.filter((company) => company.tagIds.includes(tagId)).length,
    deal: state.deals.filter((deal) => deal.tagIds.includes(tagId)).length,
    conversation: state.conversations.filter((conversation) => conversation.tagIds.includes(tagId)).length,
  });

  const abrir = (tag?: Tag) => {
    setNome(tag?.name ?? "");
    setCor(tag?.color ?? "#7c3aed");
    setAlvos(tag?.appliesTo ? [...tag.appliesTo] : []);
    setErroDoDialogo(null);
    setEditando(tag?.id ?? "nova");
  };
  const fechar = () => {
    setEditando(null);
    setErroDoDialogo(null);
  };
  const salvar = () => {
    const input = { name: nome, color: cor, appliesTo: alvos as Alvo[] };
    const result = run((data, me) => (editando === "nova" || editando === null ? createTag(data, me, input) : updateTag(data, me, editando, input)));
    if (!result.ok) {
      setErroDoDialogo(result.error);
      return;
    }
    report(result, editando === "nova" ? `Tag “${result.value.name}” criada.` : `Tag “${result.value.name}” alterada.`);
    fechar();
  };

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        path={
          <Link href="/configuracoes" className="hover:underline">
            Configurações
          </Link>
        }
        title="Tags"
        meta={`${tags.length} Tag(s)`}
        actions={
          <Button variant="primary" size="sm" icon={<Icone de={Plus} tamanho="xs" />} onClick={() => abrir()} disabled={!administra} disabledReason={motivo ?? ""}>
            Nova Tag
          </Button>
        }
      />

      <ConfirmDialog
        open={editando !== null}
        title={editando === "nova" ? "Nova Tag" : "Editar Tag"}
        description="A mesma Tag atravessa Tarefas, Contatos, Empresas, Negócios e Conversas. Sem família marcada, aplica-se a todas."
        confirmLabel="Salvar"
        {...(nome.trim() === "" ? { confirmDisabledReason: "Dê um nome à Tag." } : {})}
        onConfirm={salvar}
        onCancel={fechar}
      >
        <div className="grid gap-3">
          {erroDoDialogo ? (
            <p role="alert" className="app-base rounded-[var(--r-controle)] px-3 py-2" style={{ background: "var(--erro-lavado)", color: "var(--erro)" }}>
              {erroDoDialogo}
            </p>
          ) : null}
          <Field label="Nome" required>
            {(id) => <TextInput id={id} value={nome} onChange={setNome} placeholder="Ex.: Urgente" />}
          </Field>
          <Field label="Cor">
            {(id) => (
              <span className="flex items-center gap-2">
                <input id={id} type="color" value={cor} onChange={(event) => setCor(event.target.value)} className="size-8 cursor-pointer rounded-[var(--r-caixa)] border-0 bg-transparent p-0" />
                <Pilula cor={cor}>{nome.trim() || "Tag"}</Pilula>
              </span>
            )}
          </Field>
          <Field label="Aplica-se a" hint="Vazio: todas as famílias.">
            {(id) => <MultiSelect id={id} values={alvos} onChange={setAlvos} options={ALVOS.map((a) => ({ value: a, label: TARGET_LABEL[a] ?? a }))} placeholder="Todas as famílias" />}
          </Field>
        </div>
      </ConfirmDialog>

      {archivedCount > 0 ? (
        <BarraDeFiltros>
          <label className="app-sm flex items-center gap-2" style={{ color: "var(--texto-3)" }}>
            <input
              type="checkbox"
              checked={includeArchived}
              onChange={(event) => setIncludeArchived(event.target.checked)}
              className="size-4 accent-[var(--acento)]"
            />
            Mostrar arquivadas ({archivedCount})
          </label>
        </BarraDeFiltros>
      ) : null}

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
        {tags.length === 0 ? (
          <EmptyState
            title="Nenhuma Tag."
            hint={administra ? "Crie a primeira em “Nova Tag”: ela passa a ser oferecida nas Tarefas e no CRM." : "Quem administra o Espaço de Trabalho cria as Tags."}
          />
        ) : (
          <Section title="Tags" count={tags.length}>
            <table className="tabela">
              <thead>
                <tr>
                  <th className="app-coluna">Tag</th>
                  <th className="app-coluna">Aplica-se a</th>
                  <th className="app-coluna">Em uso</th>
                  <th className="app-coluna">Estado</th>
                  <th className="app-coluna" />
                </tr>
              </thead>
              <tbody>
                {tags.map((tag) => {
                  const usage = usageOf(tag.id);
                  const total = Object.values(usage).reduce((sum, count) => sum + count, 0);
                  const ativa = tag.lifecycle === "ativo";
                  return (
                    <tr key={tag.id}>
                      <td>
                        <Pilula cor={tag.color}>
                          {tag.name}
                        </Pilula>
                      </td>
                      <td>
                        {tag.appliesTo === undefined
                          ? "todas as famílias"
                          : tag.appliesTo.map((target) => TARGET_LABEL[target] ?? target).join(", ")}
                      </td>
                      <td>
                        {total === 0 ? (
                          <span style={{ color: "var(--texto-4)" }}>em nenhum registro</span>
                        ) : (
                          <span className="app-numero">
                            {Object.entries(usage)
                              .filter(([, count]) => count > 0)
                              .map(([target, count]) => `${count} ${TARGET_LABEL[target] ?? target}`)
                              .join(" · ")}
                          </span>
                        )}
                      </td>
                      <td>
                        {ativa ? (
                          <span className="app-meta">ativo</span>
                        ) : (
                          <StateSeal state={tag.lifecycle} />
                        )}
                      </td>
                      <td className="text-right">
                        <ActionMenu
                          label={`Ações de ${tag.name}`}
                          items={[
                            { label: "Editar", onSelect: () => abrir(tag), ...(motivo ? { disabledReason: motivo } : {}) },
                            ativa
                              ? {
                                  label: "Arquivar",
                                  destructive: true,
                                  onSelect: () => report(run((data, me) => archiveTag(data, me, tag.id)), `Tag “${tag.name}” arquivada.`),
                                  ...(motivo ? { disabledReason: motivo } : {}),
                                }
                              : {
                                  label: "Desarquivar",
                                  onSelect: () => report(run((data, me) => restoreTag(data, me, tag.id)), `Tag “${tag.name}” de volta.`),
                                  ...(motivo ? { disabledReason: motivo } : {}),
                                },
                          ]}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <p className="app-meta mt-2">
              Arquivar uma Tag em uso não a retira dos registros: ela deixa de ser oferecida em novas
              atribuições e continua legível onde já está.
            </p>
          </Section>
        )}
      </CorpoDeTela>
    </div>
  );
}
