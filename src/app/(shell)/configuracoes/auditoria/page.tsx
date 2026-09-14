"use client";

/**
 * T50 — Auditoria.
 *
 * A6.2 — every recorded action carries the actor and, when there is one, the
 * delegate ("em nome de"). A6.4 / INV-ET-12 — the record survives both the
 * removal of the Member who acted and the elimination of the object, which is
 * why the object NAME is stored on the record instead of being looked up.
 */

import Link from "next/link";
import { useId, useState } from "react";
import { useData } from "@/data/store";
import { actorLabel, newestFirst } from "@/data/derive";
import { OBJECT_TYPE_LABEL } from "@/features/shell/format";
import { useFormat } from "@/features/shell/use-format";
import {
  BarraDeFiltros,
  Button,
  CorpoDeTela,
  EmptyState,
  Field,
  PageHeader,
  Pilula,
  Select,
  TextInput,
  Toast,
  type TomPilula,
} from "@/features/shell/ui";
import {
  GovernanceAccessDialog,
  useGovernanceAccessDialog,
} from "@/features/configuracoes/governance-access-dialog";
import type { ActorRef } from "@/data/types";

const RESULT_LABEL: Record<string, string> = {
  ok: "concluída",
  denied: "negada",
  failed: "falhou",
};

/** O tom da pílula de resultado: negada pede atenção, falha é erro. */
const RESULT_TONE: Record<string, TomPilula> = {
  ok: "neutro",
  denied: "aviso",
  failed: "erro",
};

const PAGE_SIZE = 50;

export default function AuditoriaPage() {
  const state = useData((data) => data);
  const fmt = useFormat();
  const [actorKind, setActorKind] = useState<"todos" | ActorRef["kind"]>("todos");
  const [objectType, setObjectType] = useState("todos");
  const [result, setResult] = useState<"todos" | "ok" | "denied" | "failed">("todos");
  const [query, setQuery] = useState("");
  const [shown, setShown] = useState(PAGE_SIZE);
  const { governedResourceId, openGovernance, closeGovernance } = useGovernanceAccessDialog();
  const [resourceProbe, setResourceProbe] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const idAtor = useId();
  const idTipo = useId();
  const idResultado = useId();
  const idBusca = useId();

  const objectTypes = [...new Set(state.activity.map((record) => record.objectType))].sort();

  const term = query.trim().toLowerCase();
  const filtered = newestFirst(state.activity)
    .filter((record) => actorKind === "todos" || record.actor.kind === actorKind)
    .filter((record) => objectType === "todos" || record.objectType === objectType)
    .filter((record) => result === "todos" || record.result === result)
    .filter(
      (record) =>
        term === "" ||
        record.action.toLowerCase().includes(term) ||
        record.objectName.toLowerCase().includes(term),
    );

  const visible = filtered.slice(0, shown);

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        path={
          <Link href="/configuracoes" className="hover:underline">
            Configurações
          </Link>
        }
        title="Auditoria"
        meta={`${state.activity.length} Registro(s) de Atividade`}
      />

      <BarraDeFiltros>
        <div className="flex items-center gap-2">
          <label htmlFor={idAtor} className="app-meta">
            Ator
          </label>
          <div className="w-36">
            <Select
              size="sm"
              id={idAtor}
              value={actorKind}
              onChange={(value) => {
                setActorKind(value as "todos" | ActorRef["kind"]);
                setShown(PAGE_SIZE);
              }}
              options={[
                { value: "todos", label: "Todos" },
                { value: "member", label: "Membro" },
                { value: "agent", label: "Agente" },
                { value: "automation", label: "Automação" },
                { value: "integration", label: "Integração" },
                { value: "system", label: "Sistema" },
              ]}
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <label htmlFor={idTipo} className="app-meta">
            Tipo de objeto
          </label>
          <div className="w-44">
            <Select
              size="sm"
              id={idTipo}
              value={objectType}
              onChange={(value) => {
                setObjectType(value);
                setShown(PAGE_SIZE);
              }}
              options={[
                { value: "todos", label: "Todos" },
                ...objectTypes.map((type) => ({ value: type, label: OBJECT_TYPE_LABEL[type] ?? type })),
              ]}
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <label htmlFor={idResultado} className="app-meta">
            Resultado
          </label>
          <div className="w-36">
            <Select
              size="sm"
              id={idResultado}
              value={result}
              onChange={(value) => {
                setResult(value as "todos" | "ok" | "denied" | "failed");
                setShown(PAGE_SIZE);
              }}
              options={[
                { value: "todos", label: "Todos" },
                { value: "ok", label: "Concluída" },
                { value: "denied", label: "Negada" },
                { value: "failed", label: "Falhou" },
              ]}
            />
          </div>
        </div>

        <div className="min-w-48 flex-1">
          <label htmlFor={idBusca} className="sr-only">
            Buscar na ação ou no objeto
          </label>
          <TextInput
            size="sm"
            id={idBusca}
            type="search"
            value={query}
            onChange={(value) => {
              setQuery(value);
              setShown(PAGE_SIZE);
            }}
            placeholder="Buscar na ação ou no objeto"
          />
        </div>

        <span className="app-meta app-numero shrink-0">
          {filtered.length} de {state.activity.length}
        </span>
      </BarraDeFiltros>

      <GovernanceAccessDialog
        resourceId={governedResourceId}
        onClose={closeGovernance}
        onDone={setNotice}
      />

      <CorpoDeTela>
        {notice ? (
          <Toast tone="success" onDismiss={() => setNotice(null)}>
            {notice}
          </Toast>
        ) : null}

        {/*
          B38a esconde o contêiner privado de todo mundo, então não existe uma
          listagem navegável dele. A via de B38b entra por aqui: pelo rastro que
          o Registro deixa, ou por um identificador recebido por fora.
        */}
        <details className="painel mb-4">
          <summary className="app-md cursor-pointer px-4 py-3" style={{ color: "var(--texto)" }}>
            Ato de governança sobre Recurso privado
          </summary>
          <div className="px-4 pb-4">
            <p className="app-base max-w-[74ch]" style={{ color: "var(--texto-3)" }}>
              Um contêiner privado não aparece em listagem nenhuma — nem para o Proprietário do Espaço de
              Trabalho. A única via de entrada sem concessão prévia é este ato, e ele nunca é silencioso:
              exige motivo e gera Registro visível a quem tem acesso ao Recurso.
            </p>
            <div className="mt-3 flex flex-wrap items-end gap-2">
              <div className="min-w-64 flex-1">
                <Field label="Identificador do Recurso" hint="Espaço, Pasta, Lista, Funil ou Coleção.">
                  {(id) => (
                    <TextInput
                      id={id}
                      value={resourceProbe}
                      onChange={setResourceProbe}
                      placeholder="Ex.: spc_com"
                    />
                  )}
                </Field>
              </div>
              <Button
                onClick={() => openGovernance(resourceProbe.trim())}
                disabled={resourceProbe.trim() === ""}
                disabledReason="Informe o identificador do Recurso."
              >
                Abrir ato de governança
              </Button>
            </div>
          </div>
        </details>

        {filtered.length === 0 ? (
          <EmptyState
            title="Nenhum Registro de Atividade com estes filtros."
            hint="Ajuste o ator, o tipo de objeto, o resultado ou o termo de busca."
          />
        ) : (
          <>
            <table className="tabela">
              <thead>
                <tr>
                  <th className="app-coluna">Quando</th>
                  <th className="app-coluna">Quem</th>
                  <th className="app-coluna">Ação</th>
                  <th className="app-coluna">Objeto</th>
                  <th className="app-coluna">Mudança</th>
                  <th className="app-coluna">Resultado</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((record) => (
                  <tr key={record.id}>
                    <td className="whitespace-nowrap">
                      <span className="app-meta app-numero">{fmt.instant(record.at)}</span>
                    </td>
                    <td style={{ color: "var(--texto)" }}>
                      {actorLabel(state, record.actor)}
                      {record.delegate ? (
                        <span className="app-meta block">em nome de {actorLabel(state, record.delegate)}</span>
                      ) : null}
                    </td>
                    <td style={{ color: "var(--texto)" }}>
                      {record.action}
                      {record.detail ? <span className="app-meta block">{record.detail}</span> : null}
                    </td>
                    <td style={{ color: "var(--texto)" }}>
                      {record.objectName}
                      <span className="app-meta block">{OBJECT_TYPE_LABEL[record.objectType] ?? record.objectType}</span>
                    </td>
                    <td>
                      <span className="app-meta">
                        {record.before || record.after
                          ? `${record.before ?? "—"} → ${record.after ?? "—"}`
                          : "—"}
                      </span>
                    </td>
                    <td>
                      <Pilula tom={RESULT_TONE[record.result] ?? "neutro"}>
                        {RESULT_LABEL[record.result] ?? record.result}
                      </Pilula>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="flex items-center justify-between gap-4 px-1 pt-2">
              <span className="app-meta app-numero">
                Mostrando {visible.length} de {filtered.length}
              </span>
              {shown < filtered.length ? (
                <Button variant="ghost" size="sm" onClick={() => setShown((value) => value + PAGE_SIZE)}>
                  Mostrar mais
                </Button>
              ) : null}
            </div>
            <p className="app-meta mt-2">
              O nome do objeto fica gravado no próprio Registro: por isso ele continua legível mesmo depois
              de o objeto deixar de existir.
            </p>
          </>
        )}
      </CorpoDeTela>
    </div>
  );
}
