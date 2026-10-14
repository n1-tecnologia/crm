"use client";

/**
 * RELO-04 — os requisitos de um Status, editados: o que a Tarefa precisa ter
 * para SAIR dele e para ENTRAR nele, e de quais Status ele aceita Tarefa
 * ("só vindo de"). Antes a tela só mostrava o que o seed do Financeiro
 * escreveu. As regras (um Campo ou um atributo, Campo ativo, condição com os
 * dois lados, Status do Conjunto) moram em `updateStatus`; o rascunho aqui só
 * impede de mandar o que a operação recusaria.
 */

import { useId, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { useData, useRun } from "@/dados/store";
import { effectiveContainerConfig } from "@n1/dominio/derive";
import { updateStatus } from "@n1/dominio/operations";
import type { OperationResult } from "@n1/dominio/state";
import type { FieldDefinition, FieldRequirement, StatusDefinition } from "@n1/dominio/types";
import { Button, ConfirmDialog, Field, Icone, MultiSelect, Select, TextInput, Toggle } from "@/features/shell/ui";

type Report = (result: OperationResult<unknown>, message: string) => void;
type ContainerType = "space" | "folder" | "list";

const ATRIBUTOS: ReadonlyArray<{ readonly value: NonNullable<FieldRequirement["attribute"]>; readonly label: string }> = [
  { value: "dueDate", label: "Data de vencimento" },
  { value: "startDate", label: "Data de início" },
  { value: "estimate", label: "Estimativa" },
];

const NUMERICOS: ReadonlySet<FieldDefinition["type"]> = new Set(["number", "currency", "percent"]);

/** O rascunho de um requisito: `alvo` é `atributo:<nome>` ou `campo:<id>`. */
interface Rascunho {
  readonly chave: number;
  readonly alvo: string;
  readonly positive: boolean;
  readonly whenDefinitionId: string;
  readonly whenValue: string;
}

let proximaChave = 1;

function paraRascunho(req: FieldRequirement): Rascunho {
  return {
    chave: proximaChave++,
    alvo: req.attribute ? `atributo:${req.attribute}` : `campo:${req.definitionId ?? ""}`,
    positive: req.positive === true,
    whenDefinitionId: req.whenDefinitionId ?? "",
    whenValue: req.whenValue ?? "",
  };
}

function paraRequisito(r: Rascunho): FieldRequirement {
  const [tipo, id] = r.alvo.split(":") as [string, string];
  return {
    ...(tipo === "atributo" ? { attribute: id as FieldRequirement["attribute"] } : { definitionId: id }),
    ...(r.positive ? { positive: true } : {}),
    ...(r.whenDefinitionId ? { whenDefinitionId: r.whenDefinitionId, whenValue: r.whenValue } : {}),
  };
}

/** Por que o rascunho ainda não pode ser salvo — a mesma frase que `updateStatus` daria. */
function motivoDoRascunho(lista: readonly Rascunho[]): string | undefined {
  for (const r of lista) {
    if (!r.alvo || r.alvo.endsWith(":")) return "Cada requisito precisa de um Campo ou de um atributo.";
    if (r.whenDefinitionId && r.whenValue.trim() === "") return "Um requisito condicional precisa do valor da condição.";
  }
  return undefined;
}

export function RequisitosDoStatusDialog({
  containerType,
  containerId,
  definition,
  definicoes,
  open,
  onClose,
  report,
}: {
  readonly containerType: ContainerType;
  readonly containerId: string;
  readonly definition: StatusDefinition | undefined;
  readonly definicoes: readonly StatusDefinition[];
  readonly open: boolean;
  readonly onClose: () => void;
  readonly report: Report;
}) {
  const state = useData((data) => data);
  const run = useRun();
  const ids = useId();
  const [saida, setSaida] = useState<readonly Rascunho[]>([]);
  const [entrada, setEntrada] = useState<readonly Rascunho[]>([]);
  const [vindoDe, setVindoDe] = useState<readonly string[]>([]);

  // Cada abertura parte do que está gravado no Status.
  const [abertoPara, setAbertoPara] = useState<string | null>(null);
  const chaveDeAbertura = open && definition ? definition.id : null;
  if (chaveDeAbertura !== abertoPara) {
    setAbertoPara(chaveDeAbertura);
    if (definition && open) {
      setSaida((definition.exitRequirements ?? []).map(paraRascunho));
      setEntrada((definition.entryRequirements ?? []).map(paraRascunho));
      setVindoDe([...(definition.entryFromStatusIds ?? [])]);
    }
  }

  // Os Campos que uma Tarefa deste caminho enxerga: só eles podem ser exigidos.
  const config = effectiveContainerConfig(state, containerType, containerId);
  const campos = (config?.fieldDefinitionIds ?? [])
    .map((id) => state.fieldDefinitions.find((d) => d.id === id))
    .filter((d): d is FieldDefinition => d !== undefined && d.lifecycle === "ativo");
  const opcoesDeAlvo = [
    ...ATRIBUTOS.map((a) => ({ value: `atributo:${a.value}`, label: a.label, detail: "atributo da Tarefa" })),
    ...campos.map((c) => ({ value: `campo:${c.id}`, label: c.name, detail: "Campo" })),
  ];
  const campoDe = (alvo: string): FieldDefinition | undefined => (alvo.startsWith("campo:") ? campos.find((c) => c.id === alvo.slice(6)) : undefined);

  const motivo = motivoDoRascunho(saida) ?? motivoDoRascunho(entrada);

  const salvar = () => {
    if (!definition) return;
    report(
      run((data, me) =>
        updateStatus(data, me, containerType, containerId, definition.id, {
          exitRequirements: saida.map(paraRequisito),
          entryRequirements: entrada.map(paraRequisito),
          entryFromStatusIds: vindoDe,
        }),
      ),
      "Requisitos do Status gravados.",
    );
    onClose();
  };

  // Função de render, não componente: nasce a cada render sem trocar de identidade.
  const lista = ({ titulo, dica, itens, aoMudar }: { readonly titulo: string; readonly dica: string; readonly itens: readonly Rascunho[]; readonly aoMudar: (itens: readonly Rascunho[]) => void }) => (
    <div className="grid gap-2">
      <div className="flex items-end justify-between gap-2">
        <span>
          <span className="app-base block" style={{ color: "var(--texto)" }}>
            {titulo}
          </span>
          <span className="app-sm block" style={{ color: "var(--texto-3)" }}>
            {dica}
          </span>
        </span>
        <Button
          size="sm"
          icon={<Icone de={Plus} tamanho="xs" />}
          onClick={() => aoMudar([...itens, { chave: proximaChave++, alvo: "", positive: false, whenDefinitionId: "", whenValue: "" }])}
          disabled={opcoesDeAlvo.length === 0}
          disabledReason="Não há Campo nem atributo para exigir."
        >
          Requisito
        </Button>
      </div>
      {itens.length === 0 ? (
        <p className="app-sm" style={{ color: "var(--texto-4)" }}>
          Nenhum requisito.
        </p>
      ) : (
        <ul className="grid gap-2">
          {itens.map((r, i) => {
            const campo = campoDe(r.alvo);
            const condicao = campos.find((c) => c.id === r.whenDefinitionId);
            const trocar = (parte: Partial<Rascunho>) => aoMudar(itens.map((x, j) => (j === i ? { ...x, ...parte } : x)));
            return (
              <li key={r.chave} className="grid gap-2 rounded-[var(--r-controle)] p-2" style={{ border: "1px solid var(--linha)" }}>
                <div className="flex items-end gap-2">
                  <span className="min-w-0 flex-1">
                    <Field label="Exigir">
                      {(id) => <Select id={id} value={r.alvo} onChange={(alvo) => trocar({ alvo, positive: false })} placeholder="Campo ou atributo" options={opcoesDeAlvo} />}
                    </Field>
                  </span>
                  <button type="button" onClick={() => aoMudar(itens.filter((_, j) => j !== i))} aria-label="Remover requisito" title="Remover requisito" className="btn-icone btn-icone-nu">
                    <Icone de={Trash2} tamanho="xs" />
                  </button>
                </div>
                {campo && NUMERICOS.has(campo.type) ? (
                  <div className="flex items-center gap-2">
                    <Toggle checked={r.positive} onChange={(positive) => trocar({ positive })} labelledBy={`${ids}-positivo-${r.chave}`} />
                    <span id={`${ids}-positivo-${r.chave}`} className="app-sm" style={{ color: "var(--texto-2)" }}>
                      Além de preenchido, maior que zero
                    </span>
                  </div>
                ) : null}
                <div className="grid gap-2 sm:grid-cols-2">
                  <Field label="Só quando" hint="Opcional: a exigência vale só se outro Campo tiver este valor.">
                    {(id) => (
                      <Select
                        id={id}
                        value={r.whenDefinitionId}
                        onChange={(whenDefinitionId) => trocar({ whenDefinitionId, whenValue: "" })}
                        placeholder="Sempre"
                        options={[{ value: "", label: "Sempre" }, ...campos.map((c) => ({ value: c.id, label: c.name }))]}
                      />
                    )}
                  </Field>
                  {r.whenDefinitionId ? (
                    <Field label="for igual a">
                      {(id) =>
                        condicao?.options?.length ? (
                          <Select id={id} value={r.whenValue} onChange={(whenValue) => trocar({ whenValue })} placeholder="Escolher" options={condicao.options.map((o) => ({ value: o, label: o }))} />
                        ) : (
                          <TextInput id={id} value={r.whenValue} onChange={(whenValue) => trocar({ whenValue })} placeholder="Valor" />
                        )
                      }
                    </Field>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );

  return (
    <ConfirmDialog
      open={open && definition !== undefined}
      title={`Requisitos de “${definition?.name ?? ""}”`}
      description="O que a Tarefa precisa ter para sair deste Status e para chegar a ele. Ao mover, a recusa diz pelo nome o que falta."
      confirmLabel="Salvar"
      wide
      {...(motivo ? { confirmDisabledReason: motivo } : {})}
      onConfirm={salvar}
      onCancel={onClose}
    >
      <div className="grid gap-5">
        {lista({ titulo: "Para sair", dica: "Exigido para deixar este Status, seja qual for o destino.", itens: saida, aoMudar: setSaida })}
        {lista({ titulo: "Para entrar", dica: "Exigido para a Tarefa chegar a este Status.", itens: entrada, aoMudar: setEntrada })}
        <Field label="Só vindo de" hint="Vazio: de qualquer Status. Marcado: só recebe Tarefa vinda destes.">
          {(id) => (
            <MultiSelect
              id={id}
              values={vindoDe}
              onChange={setVindoDe}
              options={definicoes.filter((d) => d.id !== definition?.id).map((d) => ({ value: d.id, label: d.name }))}
              placeholder="Qualquer Status"
            />
          )}
        </Field>
      </div>
    </ConfirmDialog>
  );
}
