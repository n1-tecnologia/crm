"use client";

/**
 * O RASCUNHO DA HABILIDADE (18, 12.2): o único lugar onde uma Versão é
 * editada (RN-HAB-07). Formulário controlado — Instruções, os dois contratos,
 * as Ferramentas exigidas, as Dependências e as Coleções recomendadas — e um
 * só [Gravar rascunho], que manda o patch inteiro a
 * `editarRascunhoDaHabilidade`: a pessoa grava um rascunho pela metade e a
 * validação ao lado diz o que falta para publicar.
 *
 * Só RN-HAB-08 (ciclo e profundidade de Dependências) é rejeitada no ato de
 * gravar; aqui ela é calculada ao vivo sobre o que está no formulário, com
 * `validarRascunhoDaHabilidade` numa Versão sintética, para o botão dizer
 * por quê antes do clique.
 */

import { useId, useState } from "react";
import { useData, useRun } from "@/dados/store";
import { editarRascunhoDaHabilidade, validarRascunhoDaHabilidade } from "@n1/dominio/operations";
import { efeitoDeclarado, versaoCorrenteDaHabilidade } from "@n1/dominio/derive-ia";
import type { Skill, SkillParameter, SkillVersion } from "@n1/dominio/types";
import type { Report } from "@/features/shell/ficha";
import { EFFECT_CLASS_LABEL } from "@/features/shell/format";
import { Button, CabecalhoDePainel, Field, MultiSelect, Painel, Pilula, TextArea, Toggle } from "@/features/shell/ui";
import { EFEITO_LABEL, EFEITO_TOM } from "../rotulos";
import { ContratoEditor } from "./contrato-editor";

type Ferramenta = SkillVersion["toolRequirements"][number];
type Dependencia = SkillVersion["dependencies"][number];

const copiarParametros = (lista: readonly SkillParameter[]): SkillParameter[] => lista.map((p) => ({ ...p }));

export function RascunhoDaHabilidade({ skill, rascunho, report }: { readonly skill: Skill; readonly rascunho: SkillVersion; readonly report: Report }) {
  const state = useData((data) => data);
  const run = useRun();
  const ids = useId();
  const [instrucoes, setInstrucoes] = useState(rascunho.instructions);
  const [entrada, setEntrada] = useState<SkillParameter[]>(() => copiarParametros(rascunho.inputContract));
  const [saida, setSaida] = useState<SkillParameter[]>(() => copiarParametros(rascunho.outputContract.structured));
  const [devolveTexto, setDevolveTexto] = useState(rascunho.outputContract.text);
  const [ferramentas, setFerramentas] = useState<Ferramenta[]>(() => rascunho.toolRequirements.map((f) => ({ ...f })));
  const [dependencias, setDependencias] = useState<Dependencia[]>(() => rascunho.dependencies.map((d) => ({ ...d })));
  const [colecoes, setColecoes] = useState<string[]>(() => [...rascunho.recommendedCollectionIds]);
  const [erro, setErro] = useState<string | null>(null);

  const patch = {
    instructions: instrucoes,
    inputContract: entrada,
    outputContract: { structured: saida, text: devolveTexto },
    toolRequirements: ferramentas,
    dependencies: dependencias,
    recommendedCollectionIds: colecoes,
  };
  // A Versão sintética com o que está no formulário: a validação é pura, e RN-HAB-08 é o que gravar recusaria.
  const problemasDoFormulario = validarRascunhoDaHabilidade(state, skill, { ...rascunho, ...patch });
  const oitava = problemasDoFormulario.find((p) => p.regra === "RN-HAB-08");
  const mudou =
    JSON.stringify(patch) !==
    JSON.stringify({
      instructions: rascunho.instructions,
      inputContract: rascunho.inputContract,
      outputContract: rascunho.outputContract,
      toolRequirements: rascunho.toolRequirements,
      dependencies: rascunho.dependencies,
      recommendedCollectionIds: rascunho.recommendedCollectionIds,
    });
  const motivoGravar = oitava ? oitava.mensagem : !mudou ? "Nada mudou desde a última gravação." : undefined;
  const efeito = efeitoDeclarado(state, { ...rascunho, ...patch });

  const gravar = () => {
    const r = run((data, me) => editarRascunhoDaHabilidade(data, me, skill.id, patch));
    setErro(r.ok ? null : r.error);
    report(r, `Rascunho v${rascunho.number} gravado.`);
  };

  const ferramentasDoCatalogo = state.tools.map((t) => ({
    value: t.id,
    label: t.name,
    detail: `${EFFECT_CLASS_LABEL[t.effectClass] ?? t.effectClass} · ${t.origin === "integracao" ? "de Integração" : "da plataforma"}`,
  }));
  // Só outra Habilidade ativa com Versão corrente serve de Dependência (RN-HAB-06); a fixação de Versão, se existia, é preservada.
  const habilidadesDependiveis = state.skills
    .filter((s) => s.id !== skill.id && s.lifecycle === "ativo")
    .flatMap((s) => {
      const corrente = versaoCorrenteDaHabilidade(s);
      return corrente ? [{ value: s.id, label: s.name, detail: `v${corrente.number} · ${EFEITO_LABEL[efeitoDeclarado(state, corrente)]}` }] : [];
    });
  const colecoesAtivas = state.collections.filter((c) => c.lifecycle === "ativo").map((c) => ({ value: c.id, label: c.name, ...(c.isPrivate ? { detail: "privada" } : {}) }));

  return (
    <Painel className="min-w-0">
      <CabecalhoDePainel
        titulo={`Rascunho v${rascunho.number}`}
        acao={
          <Button variant="primary" size="sm" onClick={gravar} disabled={motivoGravar !== undefined} {...(motivoGravar ? { disabledReason: motivoGravar } : {})}>
            Gravar rascunho
          </Button>
        }
      />
      <div className="grid gap-5 p-4">
        <Field label="Instruções" required hint="O que o Agente faz ao exercer a Habilidade. Publicar exige Instruções (RN-HAB-06).">
          {(id) => <TextArea id={id} value={instrucoes} onChange={setInstrucoes} rows={8} placeholder="Passos, critérios e o que nunca fazer." />}
        </Field>

        <div className="grid gap-1.5">
          <span className="rotulo">Contrato de entrada</span>
          <ContratoEditor valor={entrada} onChange={setEntrada} rotulo="entrada" vazio="Sem Parâmetros de entrada: a Habilidade recebe só o pedido em texto." />
        </div>

        <div className="grid gap-1.5">
          <span className="rotulo">Contrato de saída</span>
          <ContratoEditor valor={saida} onChange={setSaida} rotulo="saída" vazio="Sem saída estruturada." />
          <div className="flex items-center gap-3 pt-1">
            <Toggle checked={devolveTexto} onChange={setDevolveTexto} labelledBy={`${ids}-texto`} />
            <span id={`${ids}-texto`} className="app-base" style={{ color: "var(--texto)" }}>
              Também devolve texto
            </span>
          </div>
        </div>

        <Field label="Ferramentas exigidas" hint="Uma obrigatória que o Agente não tem permitida torna a Concessão indisponível (RN-HAB-13); uma opcional só é usada se permitida.">
          {(id) => (
            <div className="grid gap-2">
              <MultiSelect
                id={id}
                values={ferramentas.map((f) => f.toolId)}
                onChange={(valores) => setFerramentas(valores.map((toolId) => ferramentas.find((f) => f.toolId === toolId) ?? { toolId, mandatory: false }))}
                placeholder="Nenhuma Ferramenta"
                options={ferramentasDoCatalogo}
              />
              {ferramentas.length > 0 ? (
                <ul className="grid gap-1.5">
                  {ferramentas.map((f, i) => {
                    const tool = state.tools.find((t) => t.id === f.toolId);
                    return (
                      <li key={f.toolId} className="flex items-center gap-3 rounded-[var(--r-controle)] px-3 py-2" style={{ background: "var(--superficie-1)", border: "1px solid var(--linha)" }}>
                        <span className="min-w-0 flex-1">
                          <span className="app-base block truncate" style={{ color: "var(--texto)" }}>
                            {tool?.name ?? f.toolId}
                          </span>
                          <span className="app-meta block truncate">{tool ? (EFFECT_CLASS_LABEL[tool.effectClass] ?? tool.effectClass) : "não existe no Catálogo"}</span>
                        </span>
                        <span id={`${ids}-obrig-${i}`} className="app-sm" style={{ color: "var(--texto-3)" }}>
                          obrigatória
                        </span>
                        <Toggle checked={f.mandatory} onChange={(mandatory) => setFerramentas(ferramentas.map((g) => (g.toolId === f.toolId ? { ...g, mandatory } : g)))} labelledBy={`${ids}-obrig-${i}`} />
                      </li>
                    );
                  })}
                </ul>
              ) : null}
            </div>
          )}
        </Field>

        <Field label="Dependências" hint="Outras Habilidades que esta exerce. Sem ciclo e até 3 níveis (RN-HAB-08)." {...(oitava ? { error: oitava.mensagem } : {})}>
          {(id) => (
            <MultiSelect
              id={id}
              values={dependencias.map((d) => d.skillId)}
              onChange={(valores) => setDependencias(valores.map((skillId) => dependencias.find((d) => d.skillId === skillId) ?? { skillId }))}
              placeholder="Nenhuma Dependência"
              options={habilidadesDependiveis}
            />
          )}
        </Field>

        <Field label="Coleções recomendadas" hint="Declaração, não concessão (RN-HAB-10).">
          {(id) => <MultiSelect id={id} values={colecoes} onChange={(valores) => setColecoes([...valores])} placeholder="Nenhuma Coleção" options={colecoesAtivas} />}
        </Field>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="app-meta flex items-center gap-2">
            Efeito declarado
            <Pilula tom={EFEITO_TOM[efeito]}>{EFEITO_LABEL[efeito]}</Pilula>
          </span>
          <Button variant="primary" onClick={gravar} disabled={motivoGravar !== undefined} {...(motivoGravar ? { disabledReason: motivoGravar } : {})}>
            Gravar rascunho
          </Button>
        </div>
        {erro ? (
          <p role="alert" className="app-base" style={{ color: "var(--erro)" }}>
            {erro}
          </p>
        ) : null}
      </div>
    </Painel>
  );
}
