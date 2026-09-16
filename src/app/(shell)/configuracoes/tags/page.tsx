"use client";

/**
 * T44 — Tags.
 *
 * The Tag is workspace vocabulary: the same Tag crosses Tasks, Contacts,
 * Companies, Deals and Conversations. The usage count is what makes archiving
 * a decision instead of a guess, so it is computed and shown per family.
 */

import Link from "next/link";
import { useState } from "react";
import { useData } from "@/data/store";
import { BarraDeFiltros, CorpoDeTela, EmptyState, PageHeader, Pilula, Section, StateSeal } from "@/features/shell/ui";

const TARGET_LABEL: Record<string, string> = {
  task: "Tarefas",
  contact: "Contatos",
  company: "Empresas",
  deal: "Negócios",
  conversation: "Conversas",
};

export default function TagsPage() {
  const state = useData((data) => data);
  const [includeArchived, setIncludeArchived] = useState(false);

  const tags = state.tags.filter((tag) => includeArchived || tag.lifecycle === "ativo");
  const archivedCount = state.tags.filter((tag) => tag.lifecycle !== "ativo").length;

  const usageOf = (tagId: string) => ({
    task: state.tasks.filter((task) => task.tagIds.includes(tagId)).length,
    contact: state.contacts.filter((contact) => contact.tagIds.includes(tagId)).length,
    company: state.companies.filter((company) => company.tagIds.includes(tagId)).length,
    deal: state.deals.filter((deal) => deal.tagIds.includes(tagId)).length,
    conversation: state.conversations.filter((conversation) => conversation.tagIds.includes(tagId)).length,
  });

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
      />

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
        {tags.length === 0 ? (
          <EmptyState
            title="Nenhuma Tag."
            hint="Uma Tag nasce quando um vocabulário se repete: crie a primeira ao aplicá-la a um registro."
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
                </tr>
              </thead>
              <tbody>
                {tags.map((tag) => {
                  const usage = usageOf(tag.id);
                  const total = Object.values(usage).reduce((sum, count) => sum + count, 0);
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
                        {tag.lifecycle === "ativo" ? (
                          <span className="app-meta">ativo</span>
                        ) : (
                          <StateSeal state={tag.lifecycle} />
                        )}
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
