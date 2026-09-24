"use client";

/**
 * O FORMULÁRIO DE UM BLOCO DA AUTOMAÇÃO, montado a partir da spec
 * (automacao-spec.ts) — como `flow-componente-form.tsx` faz com os
 * Componentes de Flow. Recebe a spec, o valor plano e `onChange`; quem o
 * chama decide quando gravar. Os controles que olham o mundo leem daqui:
 * o Status lê as Definições da Lista do escopo, o Membro lê `state.members`,
 * o Agente lê os Agentes ativos e a Habilidade lê as concedidas ao Agente
 * escolhido no próprio formulário.
 */

import { useData } from "@/data/store";
import { effectiveContainerConfig } from "@/data/derive";
import type { AutomationScopeType, FieldDefinition, Id } from "@/data/types";
import { Field, MultiSelect, Pilula, Select, TextArea, TextInput, Toggle } from "@/features/shell/ui";
import { LEGADO_LABEL } from "../rotulos";
import type { BlocoSpec, CampoSpec, ContextoDaSpec, OpcaoDaSpec, ValorDoBloco } from "./automacao-spec";

export function BlocoForm({
  spec,
  valor,
  onChange,
  scopeType,
  scopeId,
}: {
  readonly spec: BlocoSpec;
  readonly valor: ValorDoBloco;
  readonly onChange: (valor: ValorDoBloco) => void;
  readonly scopeType: AutomationScopeType;
  readonly scopeId: Id;
}) {
  const state = useData((data) => data);
  const ctx: ContextoDaSpec = { state, scopeType, scopeId, valor };
  const visiveis = spec.campos.filter((c) => !c.visivelSe || c.visivelSe(valor));
  const mudar = (chave: string, v: unknown) => {
    const proximo = { ...valor };
    if (v === undefined) delete proximo[chave];
    else proximo[chave] = v;
    onChange(proximo);
  };
  // A Ferramenta legada diz que é: a pílula antes da descrição, que nomeia a equivalente executável.
  const descricao = (
    <p className="app-sm flex flex-wrap items-center gap-2" style={{ color: "var(--texto-3)" }}>
      {spec.legadoDe ? <Pilula tom="aviso">{LEGADO_LABEL}</Pilula> : null}
      <span className="min-w-0">{spec.descricao}</span>
    </p>
  );
  if (visiveis.length === 0) {
    return descricao;
  }
  return (
    <div className="grid gap-3">
      {descricao}
      {visiveis.map((campo) => (
        <CampoDoBloco key={campo.chave} campo={campo} ctx={ctx} valor={valor[campo.chave]} onChange={(v) => mudar(campo.chave, v)} />
      ))}
    </div>
  );
}

const ALVO_DO_ESCOPO: Record<AutomationScopeType, FieldDefinition["target"]> = {
  workspace: "task",
  space: "task",
  folder: "task",
  list: "task",
  funnel: "deal",
  inbox: "conversation",
  queue: "conversation",
  grupo: "contact",
  comunidade: "contact",
  flow: "contact",
};

/** Os Status que o escopo alcança: a Lista, ou o que uma Lista criada na Pasta/Espaço consumiria (B25). */
function statusDoEscopo(ctx: ContextoDaSpec): OpcaoDaSpec[] | undefined {
  if (ctx.scopeType !== "list" && ctx.scopeType !== "folder" && ctx.scopeType !== "space") return undefined;
  const config = effectiveContainerConfig(ctx.state, ctx.scopeType, ctx.scopeId);
  if (!config) return undefined;
  return [...config.statusSet.definitions].sort((a, b) => a.order - b.order).map((d) => ({ value: d.name, label: d.name, color: d.color }));
}

function CampoDoBloco({ campo, ctx, valor, onChange }: { readonly campo: CampoSpec; readonly ctx: ContextoDaSpec; readonly valor: unknown; readonly onChange: (v: unknown) => void }) {
  const { state } = ctx;
  const comum = { label: campo.rotulo, required: campo.obrigatorio === true, ...(campo.ajuda ? { hint: campo.ajuda } : {}) };
  const textoAtual = typeof valor === "string" ? valor : "";
  const opcoes = (): readonly OpcaoDaSpec[] => (typeof campo.opcoes === "function" ? campo.opcoes(ctx) : (campo.opcoes ?? []));

  switch (campo.controle) {
    case "texto":
      return (
        <Field {...comum}>
          {(id) => <TextInput id={id} value={textoAtual} onChange={(v) => onChange(v === "" ? undefined : v)} {...(campo.placeholder ? { placeholder: campo.placeholder } : {})} />}
        </Field>
      );
    case "textoLongo":
      return (
        <Field {...comum}>
          {(id) => <TextArea id={id} value={textoAtual} onChange={(v) => onChange(v === "" ? undefined : v)} rows={3} autoGrow {...(campo.placeholder ? { placeholder: campo.placeholder } : {})} />}
        </Field>
      );
    case "numero":
      return (
        <Field {...comum}>
          {(id) => (
            <TextInput
              id={id}
              type="number"
              value={typeof valor === "number" ? String(valor) : ""}
              onChange={(v) => onChange(v === "" || Number.isNaN(Number(v)) ? undefined : Number(v))}
              {...(campo.placeholder ? { placeholder: campo.placeholder } : {})}
            />
          )}
        </Field>
      );
    case "booleano":
      return <LinhaBooleana rotulo={campo.rotulo} ligado={valor === true} onChange={(v) => onChange(v ? true : undefined)} {...(campo.ajuda ? { ajuda: campo.ajuda } : {})} />;
    case "json": {
      const invalido = textoAtual.trim() !== "" && !jsonValido(textoAtual);
      return (
        <Field {...comum} {...(invalido ? { error: "Não é um JSON válido." } : {})}>
          {(id) => <TextArea id={id} value={textoAtual} onChange={(v) => onChange(v === "" ? undefined : v)} rows={3} autoGrow placeholder={campo.placeholder ?? '{ "chave": "valor" }'} />}
        </Field>
      );
    }
    case "escolha": {
      const lista = opcoes();
      return (
        <Field {...comum} {...(lista.length === 0 ? { hint: "Nenhuma opção disponível." } : {})}>
          {(id) => <Select id={id} value={textoAtual} onChange={(v) => onChange(v || undefined)} placeholder={campo.placeholder ?? "Escolher"} searchable={lista.length > 8} options={[...(campo.obrigatorio ? [] : [{ value: "", label: "—" }]), ...lista]} />}
        </Field>
      );
    }
    case "escolhas":
      return (
        <Field {...comum}>
          {(id) => <MultiSelect id={id} values={Array.isArray(valor) ? (valor as string[]) : []} onChange={(v) => onChange(v.length > 0 ? [...v] : undefined)} options={opcoes()} placeholder={campo.placeholder ?? "Escolher"} />}
        </Field>
      );
    case "status": {
      const status = statusDoEscopo(ctx);
      // Sem Conjunto de Status no escopo (Funil, Fila, Grupo…), o nome é escrito à mão: o motor compara pelo nome.
      if (!status || status.length === 0) {
        return (
          <Field {...comum} hint={campo.ajuda ? `${campo.ajuda} O escopo não tem Conjunto de Status: escreva o nome.` : "O escopo não tem Conjunto de Status: escreva o nome."}>
            {(id) => <TextInput id={id} value={textoAtual} onChange={(v) => onChange(v === "" ? undefined : v)} placeholder="Nome do Status" />}
          </Field>
        );
      }
      return (
        <Field {...comum}>
          {(id) => <Select id={id} value={textoAtual} onChange={(v) => onChange(v || undefined)} placeholder="Escolher o Status" options={status} />}
        </Field>
      );
    }
    case "campo": {
      const alvo = campo.alvo ?? ALVO_DO_ESCOPO[ctx.scopeType];
      const definicoes = state.fieldDefinitions
        .filter((d) => d.target === alvo && d.lifecycle === "ativo")
        .map((d) => ({ value: d.id, label: d.name, detail: d.type }));
      return (
        <Field {...comum} {...(definicoes.length === 0 ? { hint: "Nenhuma Definição de Campo para este alvo." } : {})}>
          {(id) => <Select id={id} value={textoAtual} onChange={(v) => onChange(v || undefined)} placeholder="Escolher o Campo" searchable options={[...(campo.obrigatorio ? [] : [{ value: "", label: "—" }]), ...definicoes]} />}
        </Field>
      );
    }
    case "membro": {
      const membros = state.members.filter((m) => m.state === "ativo").map((m) => ({ value: m.id, label: m.displayName }));
      return (
        <Field {...comum}>
          {(id) => <Select id={id} value={textoAtual} onChange={(v) => onChange(v || undefined)} placeholder="Escolher o Membro" searchable options={[...(campo.obrigatorio ? [] : [{ value: "", label: "—" }]), ...membros]} />}
        </Field>
      );
    }
    case "membros": {
      const membros = state.members.filter((m) => m.state === "ativo").map((m) => ({ value: m.id, label: m.displayName }));
      return (
        <Field {...comum}>
          {(id) => <MultiSelect id={id} values={Array.isArray(valor) ? (valor as string[]) : []} onChange={(v) => onChange(v.length > 0 ? [...v] : undefined)} options={membros} placeholder="Escolher os Membros" />}
        </Field>
      );
    }
    case "agente": {
      // Todos os Agentes aparecem; os que não estão ativos dizem por quê (§11) — a validação recusaria na publicação.
      const agentes = state.agents
        .filter((a) => a.lifecycle !== "naLixeira")
        .map((a) => ({ value: a.id, label: a.name, ...(a.lifecycle === "ativo" ? {} : { disabledReason: `Agente ${a.lifecycle === "rascunho" ? "em rascunho" : a.lifecycle}: só um Agente ativo é invocado (RN-AUT-06).` }) }));
      return (
        <Field {...comum}>
          {(id) => <Select id={id} value={textoAtual} onChange={(v) => onChange(v || undefined)} placeholder="Escolher o Agente" searchable options={agentes} />}
        </Field>
      );
    }
    case "habilidade": {
      const agentId = typeof ctx.valor.agentId === "string" ? ctx.valor.agentId : undefined;
      const concedidas = agentId ? state.skillGrants.filter((g) => g.agentId === agentId).map((g) => g.skillId) : [];
      const habilidades = state.skills.filter((s) => concedidas.includes(s.id)).map((s) => ({ value: s.id, label: s.name }));
      const motivo = !agentId ? "Escolha o Agente primeiro." : habilidades.length === 0 ? "O Agente escolhido não tem Habilidade concedida." : undefined;
      return (
        <Field {...comum}>
          {(id) => (
            <Select
              id={id}
              value={textoAtual}
              onChange={(v) => onChange(v || undefined)}
              placeholder="O Agente decide"
              options={[{ value: "", label: "O Agente decide" }, ...habilidades]}
              disabled={motivo !== undefined}
              {...(motivo ? { disabledReason: motivo } : {})}
            />
          )}
        </Field>
      );
    }
  }
}

function jsonValido(texto: string): boolean {
  try {
    JSON.parse(texto);
    return true;
  } catch {
    return false;
  }
}

function LinhaBooleana({ rotulo, ligado, onChange, ajuda }: { readonly rotulo: string; readonly ligado: boolean; readonly onChange: (v: boolean) => void; readonly ajuda?: string }) {
  const id = `bool_${rotulo.replace(/\W+/g, "_")}`;
  return (
    <div className="flex items-center gap-3 py-1">
      <Toggle checked={ligado} onChange={onChange} labelledBy={id} />
      <span className="min-w-0">
        <span id={id} className="app-base block" style={{ color: "var(--texto)" }}>
          {rotulo}
        </span>
        {ajuda ? <span className="app-meta block">{ajuda}</span> : null}
      </span>
    </div>
  );
}
