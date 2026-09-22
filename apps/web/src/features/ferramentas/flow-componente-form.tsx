"use client";

/**
 * O FORMULÁRIO DE UM COMPONENTE, montado a partir da spec do seu Tipo
 * (flow-spec.ts): as propriedades com contadores "37 / 80" (em erro quando
 * estouram — 7.5.5), o Nome das entradas (único na Versão — INV-FLW-04), a
 * Ação (navegar/concluir/troca de dados/abrir endereço, com Tela de
 * destino e carga útil) e a Condição do Condicional. Grava por
 * `editarComponente`; os problemas de validação que apontam para este
 * Componente aparecem no topo.
 */

import { useState } from "react";
import { X } from "lucide-react";
import { useData, useRun } from "@/dados/store";
import { CATALOGO_DE_COMPONENTES } from "@n1/dominio/operations/ferramentas/flows-catalogo";
import { editarComponente } from "@n1/dominio/operations/ferramentas/flows";
import { type ProblemaDeValidacao } from "@n1/dominio/operations/ferramentas/flows-validacao";
import { camposDaTela, camposDeFlow, telasOrdenadas } from "@n1/dominio/derive-ferramentas";
import type { AcaoDeComponente, ComponenteDeFlow, CondicaoDeComponente, OpcaoDeComponente, OperadorDeCondicao, PropriedadesDeComponente, TelaDeFlow, TipoDeAcao, VersaoDeFlow } from "@n1/dominio/types/ferramentas";
import type { Report } from "@/features/shell/ficha";
import { Button, ConditionMarker, Field, Icone, MultiSelect, Select, TextArea, TextInput, Toggle } from "@/features/shell/ui";
import { SPEC_POR_TIPO, type PropSpec } from "./flow-spec";
import { TIPO_DE_ACAO_LABEL } from "./rotulos";

const OPERADORES: ReadonlyArray<{ readonly value: OperadorDeCondicao; readonly label: string }> = [
  { value: "igual", label: "igual a" },
  { value: "diferente", label: "diferente de" },
  { value: "contem", label: "contém" },
  { value: "naoContem", label: "não contém" },
  { value: "maior", label: "maior que" },
  { value: "menor", label: "menor que" },
  { value: "preenchido", label: "preenchido" },
];

export function FormularioDeComponente({
  flowId,
  tela,
  versao,
  componente,
  problemas,
  onClose,
  report,
}: {
  readonly flowId: string;
  readonly tela: TelaDeFlow;
  readonly versao: VersaoDeFlow;
  readonly componente: ComponenteDeFlow;
  readonly problemas: readonly ProblemaDeValidacao[];
  readonly onClose: () => void;
  readonly report: Report;
}) {
  const state = useData((data) => data);
  const run = useRun();
  const def = CATALOGO_DE_COMPONENTES[componente.tipo];
  const spec = SPEC_POR_TIPO[componente.tipo];
  const [nome, setNome] = useState(componente.nome ?? "");
  const [props, setProps] = useState<PropriedadesDeComponente>({ ...componente.propriedades });
  const [acao, setAcao] = useState<AcaoDeComponente | null>(componente.acao ?? null);
  const [condicao, setCondicao] = useState<CondicaoDeComponente>(componente.condicao ?? {});
  const [erro, setErro] = useState<string | null>(null);

  const telas = telasOrdenadas(versao);
  const campos = camposDaTela(tela);
  const todosOsNomes = camposDeFlow(versao).filter((c) => c.componenteId !== componente.id).map((c) => c.nome);
  const nomeRepetido = def.entrada && nome.trim() !== "" && todosOsNomes.includes(nome.trim());
  const nomeInvalido = def.entrada && nome.trim() !== "" && !/^[a-z][a-z0-9_]*$/.test(nome.trim());
  const flow = state.flows.find((f) => f.id === flowId);

  const mudar = <K extends keyof PropriedadesDeComponente>(chave: K, valor: PropriedadesDeComponente[K] | undefined) => setProps((atual) => ({ ...atual, [chave]: valor }));

  const gravar = () => {
    const r = run((data, me) =>
      editarComponente(data, me, flowId, tela.id, componente.id, {
        ...(def.entrada ? { nome } : {}),
        propriedades: props,
        ...(def.aceitaAcao ? { acao } : {}),
        ...(componente.tipo === "condicional" ? { condicao: Object.keys(condicao).length > 0 ? condicao : null } : {}),
      }),
    );
    if (!r.ok) {
      setErro(r.error);
      return;
    }
    report(r, `${def.rotulo} gravado.`);
    onClose();
  };

  return (
    <div className="painel-solido">
      <div className="flex items-center gap-2 px-3 py-2" style={{ borderBottom: "1px solid var(--linha)" }}>
        <span className="app-md" style={{ color: "var(--texto)" }}>
          {def.rotulo}
        </span>
        <span className="app-meta">{def.descricao}</span>
        <button type="button" onClick={onClose} aria-label="Fechar" className="btn-icone ml-auto">
          <Icone de={X} tamanho="xs" />
        </button>
      </div>
      <div className="grid gap-4 p-3">
        {problemas.length > 0 ? (
          <ul className="grid gap-1">
            {problemas.map((p, i) => (
              <li key={i} className="app-sm flex items-start gap-2" style={{ color: "var(--erro)" }}>
                <ConditionMarker tone="danger">{p.regra}</ConditionMarker>
                <span>{p.mensagem}</span>
              </li>
            ))}
          </ul>
        ) : null}

        {def.entrada ? (
          <Field label="Nome" required hint="Chave do Campo de Flow e da Resposta; único na Versão. Letras minúsculas, dígitos e sublinhado." {...(nomeRepetido ? { error: `“${nome.trim()}” já existe nesta Versão (INV-FLW-04).` } : nomeInvalido ? { error: "Só letras minúsculas, dígitos e sublinhado, começando por letra." } : {})}>
            {(id) => <TextInput id={id} value={nome} onChange={setNome} placeholder="por_exemplo_cidade" invalid={nomeRepetido || nomeInvalido} />}
          </Field>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-2">
          {spec.map((s) => (
            <CampoDaSpec key={s.chave} spec={s} valor={props[s.chave]} onChange={(v) => mudar(s.chave, v as PropriedadesDeComponente[typeof s.chave])} />
          ))}
        </div>

        {def.aceitaAcao ? (
          <div className="grid gap-3" style={{ borderTop: "1px solid var(--linha)", paddingTop: "var(--e-3)" }}>
            <span className="rotulo">Ação{componente.tipo === "rodape" ? " (obrigatória)" : " (opcional)"}</span>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Tipo">
                {(id) => (
                  <Select
                    id={id}
                    value={acao?.tipo ?? ""}
                    onChange={(v) => setAcao(v ? { tipo: v as TipoDeAcao, ...(acao?.telaDeDestino ? { telaDeDestino: acao.telaDeDestino } : {}), ...(acao?.cargaUtil ? { cargaUtil: acao.cargaUtil } : {}), ...(acao?.endereco ? { endereco: acao.endereco } : {}) } : null)}
                    placeholder="Sem Ação"
                    options={[
                      ...(componente.tipo === "rodape" ? [] : [{ value: "", label: "Sem Ação" }]),
                      ...(Object.keys(TIPO_DE_ACAO_LABEL) as TipoDeAcao[]).map((t) => ({
                        value: t,
                        label: TIPO_DE_ACAO_LABEL[t],
                        ...(t === "concluir" && !tela.terminal ? { disabledReason: "“Concluir” só cabe em Tela terminal (7.5.3)." } : {}),
                        ...(t === "trocaDeDados" && !flow?.pontoDeTrocaDeDados ? { disabledReason: "Exige um Ponto de troca de dados no Flow (RN-FLW-10)." } : {}),
                      })),
                    ]}
                  />
                )}
              </Field>
              {acao && (acao.tipo === "navegar" || acao.tipo === "trocaDeDados") ? (
                <Field label="Tela de destino" required>
                  {(id) => <Select id={id} value={acao.telaDeDestino ?? ""} onChange={(v) => setAcao({ ...acao, telaDeDestino: v })} placeholder="Escolher a Tela" options={telas.filter((t) => t.id !== tela.id).map((t) => ({ value: t.identificador, label: t.titulo, detail: t.identificador }))} />}
                </Field>
              ) : null}
              {acao && acao.tipo === "abrirEndereco" ? (
                <Field label="Endereço" required>
                  {(id) => <TextInput id={id} value={acao.endereco ?? ""} onChange={(v) => setAcao({ ...acao, endereco: v })} placeholder="https://…" />}
                </Field>
              ) : null}
            </div>
            {acao && (acao.tipo === "navegar" || acao.tipo === "concluir" || acao.tipo === "trocaDeDados") ? (
              <CargaUtil valor={acao.cargaUtil ?? {}} campos={campos.map((c) => c.nome)} dados={tela.dados.map((d) => d.nome)} onChange={(carga) => setAcao({ ...acao, cargaUtil: carga })} />
            ) : null}
          </div>
        ) : null}

        {componente.tipo === "condicional" ? (
          <div className="grid gap-3" style={{ borderTop: "1px solid var(--linha)", paddingTop: "var(--e-3)" }}>
            <span className="rotulo">Condição</span>
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Variável" hint="Um Campo de Flow desta Tela ou um Dado de Tela.">
                {(id) => (
                  <Select
                    id={id}
                    value={condicao.variavel ?? ""}
                    onChange={(v) => setCondicao({ ...condicao, variavel: v })}
                    placeholder="Escolher"
                    options={[...campos.map((c) => ({ value: `{formulario.${c.nome}}`, label: c.nome, detail: "Campo desta Tela" })), ...tela.dados.map((d) => ({ value: `{dados.${d.nome}}`, label: d.nome, detail: "Dado de Tela" }))]}
                  />
                )}
              </Field>
              <Field label="Operador">
                {(id) => <Select id={id} value={condicao.operador ?? ""} onChange={(v) => setCondicao({ ...condicao, operador: v as OperadorDeCondicao })} placeholder="Escolher" options={OPERADORES} />}
              </Field>
              <Field label="Valor">
                {(id) => <TextInput id={id} value={condicao.valor ?? ""} onChange={(v) => setCondicao({ ...condicao, valor: v })} disabled={condicao.operador === "preenchido"} disabledReason="“Preenchido” não compara com valor." />}
              </Field>
            </div>
            <Field label="Ou uma Expressão manual" hint="Sobrepõe os três campos acima quando preenchida.">
              {(id) => <TextInput id={id} value={condicao.expressao ?? ""} onChange={(v) => setCondicao({ ...condicao, expressao: v })} placeholder="{formulario.formacao} == 'dentista'" />}
            </Field>
          </div>
        ) : null}

        {erro ? (
          <p role="alert" className="app-base" style={{ color: "var(--erro)" }}>
            {erro}
          </p>
        ) : null}

        <div className="flex items-center justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="primary" size="sm" onClick={gravar} disabled={nomeRepetido || nomeInvalido} disabledReason="Corrija o Nome antes de gravar.">
            Gravar
          </Button>
        </div>
      </div>
    </div>
  );
}

function Contador({ atual, limite }: { readonly atual: number; readonly limite?: number }) {
  if (limite === undefined) return null;
  return (
    <span className="app-meta app-numero" style={atual > limite ? { color: "var(--erro)" } : undefined}>
      {atual} / {limite}
    </span>
  );
}

function CampoDaSpec({ spec, valor, onChange }: { readonly spec: PropSpec; readonly valor: unknown; readonly onChange: (valor: unknown) => void }) {
  const state = useData((data) => data);
  const rotulo = (
    <span className="flex items-center justify-between gap-2">
      {spec.rotulo}
      {typeof valor === "string" ? <Contador atual={valor.length} limite={spec.limite} /> : null}
    </span>
  );
  switch (spec.controle) {
    case "texto":
      return (
        <Field label={spec.rotulo} required={spec.obrigatorio === true} {...(spec.ajuda ? { hint: spec.ajuda } : {})}>
          {(id) => (
            <span className="grid gap-1">
              <TextInput id={id} value={typeof valor === "string" ? valor : ""} onChange={(v) => onChange(v === "" ? undefined : v)} invalid={typeof valor === "string" && spec.limite !== undefined && valor.length > spec.limite} />
              {typeof valor === "string" ? <Contador atual={valor.length} limite={spec.limite} /> : null}
            </span>
          )}
        </Field>
      );
    case "textoLongo":
      return (
        <div className="sm:col-span-2">
          <Field label={spec.rotulo} required={spec.obrigatorio === true} {...(spec.ajuda ? { hint: spec.ajuda } : {})}>
            {(id) => (
              <span className="grid gap-1">
                <TextArea id={id} value={typeof valor === "string" ? valor : ""} onChange={(v) => onChange(v === "" ? undefined : v)} rows={3} autoGrow />
                {typeof valor === "string" ? <Contador atual={valor.length} limite={spec.limite} /> : null}
              </span>
            )}
          </Field>
        </div>
      );
    case "numero":
      return (
        <Field label={spec.rotulo} {...(spec.ajuda ? { hint: spec.ajuda } : {})}>
          {(id) => <TextInput id={id} type="number" value={typeof valor === "number" ? String(valor) : ""} onChange={(v) => onChange(v === "" ? undefined : Number(v))} />}
        </Field>
      );
    case "booleano":
      return <LinhaBooleana rotulo={spec.rotulo} ligado={valor === true} onChange={(v) => onChange(v ? true : undefined)} />;
    case "escolha":
      return (
        <Field label={spec.rotulo} {...(spec.ajuda ? { hint: spec.ajuda } : {})}>
          {(id) => <Select id={id} value={typeof valor === "string" ? valor : ""} onChange={(v) => onChange(v || undefined)} placeholder="Padrão" options={[{ value: "", label: "Padrão" }, ...(spec.opcoes ?? [])]} />}
        </Field>
      );
    case "expressaoOuBooleano": {
      const modo = typeof valor === "string" ? "expressao" : valor === false ? "nao" : "sim";
      return (
        <Field label={spec.rotulo} {...(spec.ajuda ? { hint: spec.ajuda } : {})}>
          {(id) => (
            <span className="grid gap-1.5">
              <Select id={id} value={modo} onChange={(v) => onChange(v === "sim" ? undefined : v === "nao" ? false : "{formulario.}")} options={[{ value: "sim", label: "sim" }, { value: "nao", label: "não" }, { value: "expressao", label: "por Expressão" }]} />
              {modo === "expressao" ? <TextInput value={typeof valor === "string" ? valor : ""} onChange={(v) => onChange(v)} placeholder="{formulario.aceite}" size="sm" /> : null}
            </span>
          )}
        </Field>
      );
    }
    case "opcoes":
      return (
        <div className="sm:col-span-2">
          <EditorDeOpcoes rotulo={spec.rotulo} opcoes={Array.isArray(valor) ? (valor as OpcaoDeComponente[]) : []} onChange={(o) => onChange(o)} {...(spec.ajuda ? { ajuda: spec.ajuda } : {})} />
        </div>
      );
    case "imagem":
    case "imagens": {
      const imagens = state.files.filter((f) => f.mediaType === "image").map((f) => ({ value: f.id, label: f.name, detail: `${Math.round(f.sizeBytes / 1024)} KB` }));
      return (
        <Field label={spec.rotulo} required={spec.obrigatorio === true} hint={imagens.length === 0 ? "Nenhum Arquivo de imagem no Espaço de Trabalho ainda." : spec.ajuda}>
          {(id) =>
            spec.controle === "imagem" ? (
              <Select id={id} value={typeof valor === "string" ? valor : ""} onChange={(v) => onChange(v || undefined)} placeholder="Escolher o Arquivo" options={imagens} />
            ) : (
              <MultiSelect id={id} values={Array.isArray(valor) ? (valor as string[]) : []} onChange={(v) => onChange(v.length > 0 ? [...v] : undefined)} options={imagens} placeholder="Escolher os Arquivos" />
            )
          }
        </Field>
      );
    }
    case "legendas": {
      const legendas = (valor ?? {}) as { esquerda?: string; centro?: string; direita?: string };
      const mudar = (chave: "esquerda" | "centro" | "direita", v: string) => onChange({ ...legendas, [chave]: v || undefined });
      return (
        <div className="sm:col-span-2">
          <span className="rotulo">{rotulo}</span>
          <div className="grid gap-2 sm:grid-cols-3">
            {(["esquerda", "centro", "direita"] as const).map((chave) => (
              <span key={chave} className="grid gap-1">
                <TextInput value={legendas[chave] ?? ""} onChange={(v) => mudar(chave, v)} placeholder={chave} size="sm" />
                <Contador atual={(legendas[chave] ?? "").length} limite={15} />
              </span>
            ))}
          </div>
          {spec.ajuda ? <p className="ajuda">{spec.ajuda}</p> : null}
        </div>
      );
    }
  }
}

function LinhaBooleana({ rotulo, ligado, onChange }: { readonly rotulo: string; readonly ligado: boolean; readonly onChange: (v: boolean) => void }) {
  const id = `bool_${rotulo.replace(/\W+/g, "_")}`;
  return (
    <div className="flex items-center gap-3 py-1">
      <Toggle checked={ligado} onChange={onChange} labelledBy={id} />
      <span id={id} className="app-base" style={{ color: "var(--texto)" }}>
        {rotulo}
      </span>
    </div>
  );
}

function EditorDeOpcoes({ rotulo, opcoes, onChange, ajuda }: { readonly rotulo: string; readonly opcoes: readonly OpcaoDeComponente[]; readonly onChange: (opcoes: OpcaoDeComponente[]) => void; readonly ajuda?: string }) {
  const mudar = (i: number, patch: Partial<OpcaoDeComponente>) => onChange(opcoes.map((o, j) => (j === i ? { ...o, ...patch } : o)));
  // O id novo é o maior sufixo numérico + 1: remover uma do meio não faz a próxima repetir um id.
  const proximoId = () => {
    const maior = opcoes.reduce((m, o) => {
      const n = /^opcao_(\d+)$/.exec(o.id);
      return n ? Math.max(m, Number(n[1])) : m;
    }, 0);
    return `opcao_${maior + 1}`;
  };
  const repetidos = new Set(opcoes.map((o) => o.id).filter((id, i, arr) => id === "" || arr.indexOf(id) !== i));
  return (
    <div className="grid gap-1.5">
      <span className="rotulo">{rotulo}</span>
      <div className="grid gap-1.5">
        {opcoes.map((o, i) => (
          <div key={i} className="grid grid-cols-[minmax(0,1fr)_minmax(0,2fr)_auto] items-center gap-2" title={repetidos.has(o.id) ? (o.id === "" ? "Identificador vazio." : "Identificador repetido: o valor gravado seria ambíguo.") : undefined}>
            <TextInput value={o.id} onChange={(v) => mudar(i, { id: v.toLowerCase().replace(/[^a-z0-9_]/g, "_") })} placeholder="identificador" size="sm" invalid={repetidos.has(o.id)} />
            <TextInput value={o.titulo} onChange={(v) => mudar(i, { titulo: v })} placeholder="Título" size="sm" />
            <button type="button" className="btn-icone" aria-label="Remover opção" onClick={() => onChange(opcoes.filter((_, j) => j !== i))}>
              <Icone de={X} tamanho="xs" />
            </button>
          </div>
        ))}
      </div>
      <span>
        <Button size="sm" variant="ghost" onClick={() => onChange([...opcoes, { id: proximoId(), titulo: `Opção ${opcoes.length + 1}` }])}>
          Adicionar opção
        </Button>
      </span>
      {ajuda ? <p className="ajuda">{ajuda}</p> : null}
    </div>
  );
}

/** A carga útil de uma Ação: pares nome → valor, onde o valor é texto ou Expressão desta Tela (7.5.4). */
function CargaUtil({ valor, campos, dados, onChange }: { readonly valor: Record<string, string>; readonly campos: readonly string[]; readonly dados: readonly string[]; readonly onChange: (carga: Record<string, string>) => void }) {
  const pares = Object.entries(valor);
  const mudar = (i: number, chave: string, v: string) => {
    const proximo: Record<string, string> = {};
    pares.forEach(([k, val], j) => {
      if (j === i) proximo[chave] = v;
      else proximo[k] = val;
    });
    onChange(proximo);
  };
  return (
    <div className="grid gap-1.5">
      <span className="rotulo">Carga útil</span>
      <p className="ajuda">O que a Tela de destino recebe (Dados de Tela). O valor é texto ou uma Expressão desta Tela: {"{formulario.nome}"} ou {"{dados.nome}"}.</p>
      {pares.map(([k, v], i) => (
        <div key={i} className="grid grid-cols-[minmax(0,1fr)_minmax(0,2fr)_auto] items-center gap-2">
          <TextInput value={k} onChange={(nk) => mudar(i, nk.replace(/[^a-z0-9_]/g, "_"), v)} placeholder="nome" size="sm" />
          <TextInput value={v} onChange={(nv) => mudar(i, k, nv)} placeholder="{formulario.cidade}" size="sm" />
          <button
            type="button"
            className="btn-icone"
            aria-label="Remover"
            onClick={() => {
              const proximo = { ...valor };
              delete proximo[k];
              onChange(proximo);
            }}
          >
            <Icone de={X} tamanho="xs" />
          </button>
        </div>
      ))}
      <span className="flex flex-wrap gap-1.5">
        {campos.filter((c) => !(c in valor)).map((c) => (
          <Button key={c} size="sm" variant="ghost" onClick={() => onChange({ ...valor, [c]: `{formulario.${c}}` })}>
            + {c}
          </Button>
        ))}
        {dados.filter((d) => !(d in valor)).map((d) => (
          <Button key={`d_${d}`} size="sm" variant="ghost" onClick={() => onChange({ ...valor, [d]: `{dados.${d}}` })}>
            + {d} (dado)
          </Button>
        ))}
        <Button size="sm" variant="ghost" onClick={() => onChange({ ...valor, [`chave_${pares.length + 1}`]: "" })}>
          + outro
        </Button>
      </span>
    </div>
  );
}
