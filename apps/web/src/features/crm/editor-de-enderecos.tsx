"use client";

/**
 * Endereços de um Contato (e, depois, de uma Empresa): uma lista editável de
 * objetos de valor, sem identidade (ontologia de contatos, 7.3). Até
 * `LIMITES_CRM.enderecosMaximo`, e só um principal — marcar um desmarca o
 * outro. A regra é a `validarEnderecos` do domínio, a mesma que o endpoint
 * aplica; o editor a roda antes de devolver a lista e diz o erro ao lado.
 *
 * O componente é de RASCUNHO: não grava nada. Quem o usa guarda a lista e
 * decide quando enviar (a ficha tem um "Salvar alterações" por seção).
 */

import { useId, useState } from "react";
import { LIMITES_CRM, validarEnderecos, type Endereco, type RotuloDeEndereco } from "@n1/dominio/crm/comum";
import { Button, Field, Select, TextInput, Toggle } from "@/features/shell/ui";

const ROTULOS: ReadonlyArray<{ readonly value: RotuloDeEndereco; readonly label: string }> = [
  { value: "residencial", label: "Residencial" },
  { value: "comercial", label: "Comercial" },
  { value: "outro", label: "Outro" },
];

type CampoDeTexto = "logradouro" | "numero" | "complemento" | "bairro" | "cidade" | "estado" | "pais" | "codigoPostal";

const CAMPOS: ReadonlyArray<{ readonly chave: CampoDeTexto; readonly rotulo: string }> = [
  { chave: "logradouro", rotulo: "Logradouro" },
  { chave: "numero", rotulo: "Número" },
  { chave: "complemento", rotulo: "Complemento" },
  { chave: "bairro", rotulo: "Bairro" },
  { chave: "cidade", rotulo: "Cidade" },
  { chave: "estado", rotulo: "Estado" },
  { chave: "pais", rotulo: "País" },
  { chave: "codigoPostal", rotulo: "Código postal" },
];

/** Texto vazio tira a chave do objeto (o contrato aceita campo ausente, não vazio). */
function comTexto(endereco: Endereco, chave: CampoDeTexto, texto: string): Endereco {
  const { [chave]: _anterior, ...resto } = endereco;
  void _anterior;
  return texto.trim() === "" ? resto : { ...resto, [chave]: texto };
}

function LinhaDeEndereco({
  endereco,
  indice,
  disabled,
  onChange,
  onRemover,
}: {
  readonly endereco: Endereco;
  readonly indice: number;
  readonly disabled: boolean;
  readonly onChange: (proximo: Endereco) => void;
  readonly onRemover: () => void;
}) {
  const rotuloDoPrincipal = useId();
  return (
    <div className="painel grid gap-3 p-4 sm:grid-cols-2">
      <Field label="Tipo de endereço">
        {(id) => (
          <Select
            id={id}
            value={endereco.rotulo}
            options={ROTULOS}
            onChange={(valor) => onChange({ ...endereco, rotulo: valor as RotuloDeEndereco })}
            disabled={disabled}
          />
        )}
      </Field>
      {CAMPOS.map((campo) => (
        <Field key={campo.chave} label={campo.rotulo}>
          {(id) => (
            <TextInput
              id={id}
              value={endereco[campo.chave] ?? ""}
              onChange={(texto) => onChange(comTexto(endereco, campo.chave, texto))}
              disabled={disabled}
            />
          )}
        </Field>
      ))}
      <div className="flex items-center justify-between gap-3 sm:col-span-2">
        <span className="flex items-center gap-2">
          <Toggle
            checked={endereco.principal}
            labelledBy={rotuloDoPrincipal}
            onChange={(marcado) => onChange({ ...endereco, principal: marcado })}
            disabled={disabled}
          />
          <span id={rotuloDoPrincipal} className="app-base">
            Endereço principal
          </span>
        </span>
        <Button
          size="sm"
          variant="ghost"
          onClick={onRemover}
          disabled={disabled}
          {...(disabled ? { disabledReason: "Edição indisponível." } : {})}
        >
          {`Remover endereço ${indice + 1}`}
        </Button>
      </div>
    </div>
  );
}

export function EditorDeEnderecos({
  valor,
  onChange,
  disabled = false,
}: {
  readonly valor: readonly Endereco[];
  /** Devolve a lista e, se o domínio a recusa, a frase (a lista segue como está para o rascunho continuar editável). */
  readonly onChange: (enderecos: readonly Endereco[], erro?: string) => void;
  readonly disabled?: boolean;
}) {
  const [erro, setErro] = useState<string | undefined>(undefined);

  const emitir = (proximo: readonly Endereco[]) => {
    const validacao = validarEnderecos(proximo);
    const frase = validacao.ok ? undefined : validacao.error;
    setErro(frase);
    onChange(proximo, frase);
  };

  const editar = (indice: number, proximo: Endereco) => {
    // Um principal só: marcar um desmarca o outro.
    const lista = valor.map((endereco, i) => {
      if (i === indice) return proximo;
      return proximo.principal && !valor[indice]?.principal ? { ...endereco, principal: false } : endereco;
    });
    emitir(lista);
  };

  const noLimite = valor.length >= LIMITES_CRM.enderecosMaximo;
  const semAdicionar = disabled || noLimite;
  const motivo = disabled ? "Edição indisponível." : `No máximo ${LIMITES_CRM.enderecosMaximo} endereços.`;

  return (
    <div className="grid gap-3">
      {valor.map((endereco, indice) => (
        <LinhaDeEndereco
          key={indice}
          endereco={endereco}
          indice={indice}
          disabled={disabled}
          onChange={(proximo) => editar(indice, proximo)}
          onRemover={() => emitir(valor.filter((_, i) => i !== indice))}
        />
      ))}
      {erro ? (
        <p role="alert" className="ajuda" data-erro="true">
          {erro}
        </p>
      ) : null}
      <span>
        <Button
          size="sm"
          onClick={() => emitir([...valor, { rotulo: "residencial", principal: valor.length === 0 }])}
          disabled={semAdicionar}
          {...(semAdicionar ? { disabledReason: motivo } : {})}
        >
          Adicionar endereço
        </Button>
      </span>
    </div>
  );
}
