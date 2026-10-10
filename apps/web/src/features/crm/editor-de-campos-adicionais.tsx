"use client";

/**
 * Campos adicionais: pares chave → valor livres que o usuário cria à vontade
 * (`{ "signo": "leão" }`). Nesta tela o valor é texto digitado — "sim/não" e
 * número ficam como texto —, mas um valor que veio do servidor como número ou
 * booleano e não foi tocado volta como veio.
 *
 * Recusa antes de enviar: chave vazia (com valor preenchido) e chave repetida;
 * os tetos vêm de `validarCamposAdicionais`, a regra que o endpoint também
 * aplica. Linha totalmente em branco é ignorada. Como o editor de Endereços, é
 * de RASCUNHO: devolve o mapa e a frase de erro, e quem o usa decide quando
 * gravar.
 */

import { useState } from "react";
import {
  LIMITES_CRM,
  validarCamposAdicionais,
  type CamposAdicionais,
  type ValorDeCampoAdicional,
} from "@n1/dominio/crm/comum";
import { Button, Field, TextInput } from "@/features/shell/ui";

interface Linha {
  readonly chave: string;
  readonly texto: string;
}

function linhasDe(campos: CamposAdicionais): Linha[] {
  return Object.entries(campos).map(([chave, valor]) => ({ chave, texto: String(valor) }));
}

/** O mapa e o erro de um conjunto de linhas. Linha em branco não conta. */
export function camposDasLinhas(
  linhas: readonly Linha[],
  originais: CamposAdicionais,
): { readonly campos: CamposAdicionais; readonly erro: string | undefined } {
  const campos: Record<string, ValorDeCampoAdicional> = {};
  let erro: string | undefined;
  for (const linha of linhas) {
    const chave = linha.chave.trim();
    if (chave === "" && linha.texto.trim() === "") continue;
    if (chave === "") {
      erro ??= "O nome de um campo adicional não pode ficar vazio.";
      continue;
    }
    if (Object.hasOwn(campos, chave)) {
      erro ??= `Já existe um campo adicional chamado “${chave}”.`;
      continue;
    }
    const original = originais[chave];
    campos[chave] = original !== undefined && String(original) === linha.texto ? original : linha.texto;
  }
  if (erro === undefined) {
    const validacao = validarCamposAdicionais(campos);
    if (!validacao.ok) erro = validacao.error;
  }
  return { campos, erro };
}

export function EditorDeCamposAdicionais({
  valor,
  onChange,
  disabled = false,
}: {
  readonly valor: CamposAdicionais;
  /** O mapa válido até aqui e, se há problema no rascunho, a frase dele. */
  readonly onChange: (campos: CamposAdicionais, erro?: string) => void;
  readonly disabled?: boolean;
}) {
  const [originais] = useState(valor);
  const [linhas, setLinhas] = useState<Linha[]>(() => linhasDe(valor));
  const [erro, setErro] = useState<string | undefined>(undefined);

  const atualizar = (proximas: Linha[]) => {
    setLinhas(proximas);
    const resultado = camposDasLinhas(proximas, originais);
    setErro(resultado.erro);
    onChange(resultado.campos, resultado.erro);
  };

  const noLimite = linhas.length >= LIMITES_CRM.camposAdicionaisMaximo;
  const semAdicionar = disabled || noLimite;
  const motivo = disabled ? "Edição indisponível." : `No máximo ${LIMITES_CRM.camposAdicionaisMaximo} campos adicionais.`;

  return (
    <div className="grid gap-3">
      {linhas.map((linha, indice) => (
        <div key={indice} className="grid items-end gap-3 sm:grid-cols-[1fr_1fr_auto]">
          <Field label="Nome do campo">
            {(id) => (
              <TextInput
                id={id}
                value={linha.chave}
                onChange={(chave) => atualizar(linhas.map((l, i) => (i === indice ? { ...l, chave } : l)))}
                disabled={disabled}
              />
            )}
          </Field>
          <Field label="Valor">
            {(id) => (
              <TextInput
                id={id}
                value={linha.texto}
                onChange={(texto) => atualizar(linhas.map((l, i) => (i === indice ? { ...l, texto } : l)))}
                disabled={disabled}
              />
            )}
          </Field>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => atualizar(linhas.filter((_, i) => i !== indice))}
            disabled={disabled}
            {...(disabled ? { disabledReason: "Edição indisponível." } : {})}
          >
            {`Remover campo ${indice + 1}`}
          </Button>
        </div>
      ))}
      {erro ? (
        <p role="alert" className="ajuda" data-erro="true">
          {erro}
        </p>
      ) : null}
      <span>
        <Button
          size="sm"
          onClick={() => atualizar([...linhas, { chave: "", texto: "" }])}
          disabled={semAdicionar}
          {...(semAdicionar ? { disabledReason: motivo } : {})}
        >
          Adicionar campo
        </Button>
      </span>
    </div>
  );
}
