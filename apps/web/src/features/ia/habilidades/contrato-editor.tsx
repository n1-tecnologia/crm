"use client";

/**
 * O EDITOR DE CONTRATO de uma Versão de Habilidade (18, 6): a lista de
 * Parâmetros de entrada ou de saída — nome, tipo, obrigatório, descrição —
 * como linhas de um formulário controlado. Não grava nada: devolve a lista
 * nova a quem o chama, que grava o rascunho inteiro de uma vez.
 *
 * O nome é um identificador (letras, dígitos e sublinhado): a digitação é
 * saneada no ato, e um nome vazio, repetido ou que começa por dígito fica
 * `invalid` aqui mesmo — a validação de publicar (RN-HAB-06) diria a mesma
 * coisa mais tarde, e o campo avisa antes.
 */

import { Plus, Trash2 } from "lucide-react";
import { useId } from "react";
import type { SkillParameter } from "@n1/dominio/types";
import { Button, Icone, Select, TextInput, Toggle } from "@/features/shell/ui";

/** Os tipos que um Parâmetro admite; `referencia:<tipo>` aponta um registro da plataforma (o seed usa `referencia:deal`). */
export const TIPO_DE_PARAMETRO_LABEL: Record<string, string> = {
  texto: "texto",
  numero: "número",
  data: "data",
  selecao: "seleção",
  booleano: "booleano",
  "referencia:task": "referência a Tarefa",
  "referencia:deal": "referência a Negócio",
  "referencia:contact": "referência a Contato",
  "referencia:company": "referência a Empresa",
  "referencia:conversation": "referência a Conversa",
  "referencia:document": "referência a Documento",
  arquivo: "arquivo",
};

const TIPOS = Object.keys(TIPO_DE_PARAMETRO_LABEL);

/** O mesmo identificador que `validarRascunhoDaHabilidade` exige: letras, dígitos e sublinhado, começando por letra. */
const NOME_DE_PARAMETRO = /^[A-Za-z][A-Za-z0-9_]*$/;

const sanear = (texto: string): string => texto.replace(/[^A-Za-z0-9_]/g, "");

export function ContratoEditor({
  valor,
  onChange,
  rotulo,
  vazio,
}: {
  readonly valor: readonly SkillParameter[];
  readonly onChange: (proximo: SkillParameter[]) => void;
  /** Nomeia o contrato para os rótulos acessíveis: "entrada" ou "saída". */
  readonly rotulo: string;
  readonly vazio: string;
}) {
  const ids = useId();
  const nomes = valor.map((p) => p.name.trim());
  const repetidos = new Set(nomes.filter((n, i) => n !== "" && nomes.indexOf(n) !== i));

  const alterar = (indice: number, patch: Partial<SkillParameter>) => {
    onChange(valor.map((p, i) => (i === indice ? { ...p, ...patch } : p)));
  };

  return (
    <div className="grid gap-2">
      {valor.length === 0 ? (
        <p className="app-meta px-1">{vazio}</p>
      ) : (
        <ol className="grid gap-2">
          {valor.map((parametro, i) => {
            const nome = parametro.name.trim();
            const invalido = nome === "" || repetidos.has(nome) || !NOME_DE_PARAMETRO.test(nome);
            const motivo = nome === "" ? "Dê um nome ao Parâmetro." : repetidos.has(nome) ? `O Parâmetro “${nome}” se repete no contrato de ${rotulo}.` : !NOME_DE_PARAMETRO.test(nome) ? "O nome começa por letra." : undefined;
            return (
              <li key={i} className="grid items-center gap-2 rounded-[var(--r-controle)] p-2 sm:grid-cols-[minmax(0,1fr)_11rem_auto_minmax(0,1.4fr)_auto]" style={{ background: "var(--superficie-1)", border: "1px solid var(--linha)" }}>
                <span title={motivo} className="block">
                  <TextInput value={parametro.name} onChange={(v) => alterar(i, { name: sanear(v) })} placeholder="nome_do_parametro" invalid={invalido} size="sm" />
                </span>
                <Select value={parametro.type} onChange={(type) => alterar(i, { type })} size="sm" options={TIPOS.map((t) => ({ value: t, label: TIPO_DE_PARAMETRO_LABEL[t] ?? t }))} />
                <span className="flex items-center gap-2">
                  <span id={`${ids}-obrig-${i}`} className="app-sm" style={{ color: "var(--texto-3)" }}>
                    obrigatório
                  </span>
                  <Toggle checked={parametro.required} onChange={(required) => alterar(i, { required })} labelledBy={`${ids}-obrig-${i}`} />
                </span>
                <TextInput value={parametro.description} onChange={(description) => alterar(i, { description })} placeholder="Para que serve" size="sm" />
                <Button size="sm" variant="ghost" icon={<Icone de={Trash2} tamanho="xs" />} onClick={() => onChange(valor.filter((_, j) => j !== i))}>
                  Remover
                </Button>
              </li>
            );
          })}
        </ol>
      )}
      <div>
        <Button size="sm" variant="ghost" icon={<Icone de={Plus} tamanho="xs" />} onClick={() => onChange([...valor, { name: "", type: "texto", required: false, description: "" }])}>
          Adicionar Parâmetro
        </Button>
      </div>
    </div>
  );
}
