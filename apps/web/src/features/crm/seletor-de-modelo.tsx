"use client";

/**
 * O SELETOR DE MODELO (Sessão 7, 7.3.5) — a escolha de uma Mensagem de modelo aprovada pela Meta, no lugar do texto livre.
 *
 * No WhatsApp oficial a empresa só abre a conversa e só escreve fora das 24 h com modelo (RN-CXE-19, 7.2.6). Os três lugares
 * que enviam nesse caso (o compositor da Caixa de Entrada, "Nova Tarefa" e "Trocar o Canal da Tarefa") usam ESTE componente:
 * a lista dos modelos que o Canal envia agora, a prévia do texto que o Contato vai receber e um campo por variável (`{{1}}`,
 * `{{2}}`…), com `{{1}}` já preenchida com o primeiro nome do Contato.
 *
 * O componente não envia nada: devolve a cada mudança uma `EscolhaDeModelo`. `pedido` está pronto para ir à api
 * (`modeloId` e `variaveis` já conferidas por `validarVariaveis`, a mesma regra do servidor) ou é `undefined`, e então
 * `motivo` diz o que falta (vira o "por quê" do botão desligado). A lista chega pronta: só os modelos ENVIÁVEIS, de
 * `useModelosEnviaveis`; os que o CRM ainda não sabe preencher ficam só na ficha do Canal.
 *
 * O estado é do componente; quem hospeda o reinicia trocando a `key`. A frase da api (409 de modelo fora do ar, 400 de
 * variável) aparece junto do campo a que ela aponta.
 */

import { useState } from "react";
import { textoDoModelo, validarVariaveis, type ModeloNaLista } from "@n1/dominio/crm/modelos";
import { ErroDeApi } from "@/dados/crm/cliente-crm";
import { useModelosEnviaveis } from "@/dados/crm/modelos";
import { Field, Select, TextInput } from "@/features/shell/ui";

/** O que vai à api no lugar do texto: o modelo escolhido e o valor de cada variável, em ordem. */
export interface PedidoDeModelo {
  readonly modeloId: string;
  readonly variaveis: readonly string[];
}

export interface EscolhaDeModelo {
  /** Pronto para enviar; `undefined` enquanto falta modelo ou variável. */
  readonly pedido: PedidoDeModelo | undefined;
  /** O que falta, na frase do domínio (ou "Escolha o modelo."); `undefined` quando o pedido está pronto. */
  readonly motivo: string | undefined;
  /** A prévia do texto que o Contato recebe: o corpo com as variáveis trocadas (`{{n}}` fica onde ainda está vazia). */
  readonly texto: string;
}

export const FRASE_ESCOLHA_O_MODELO = "Escolha a Mensagem de modelo.";

/** O estado de quem ainda não escolheu nada: o ponto de partida de quem hospeda o seletor. */
export const SEM_ESCOLHA: EscolhaDeModelo = { pedido: undefined, motivo: FRASE_ESCOLHA_O_MODELO, texto: "" };

/** A recusa da api que o seletor sabe mostrar: `variaveis` junto das variáveis, `modeloId` junto do modelo. */
export interface ErroDoSeletor {
  readonly texto: string;
  readonly campo: string | undefined;
}

/** O que o seletor diz de um modelo e das variáveis preenchidas: o pedido pronto ou o motivo, mais a prévia. */
export function escolhaDe(modelo: ModeloNaLista | undefined, variaveis: readonly string[]): EscolhaDeModelo {
  if (!modelo) return SEM_ESCOLHA;
  // Na prévia a variável ainda vazia fica como `{{n}}`, para a pessoa ver onde o valor entra.
  const texto = textoDoModelo(modelo, variaveis.map((v, i) => (v.trim() === "" ? `{{${i + 1}}}` : v.trim())));
  const valida = validarVariaveis(modelo, variaveis);
  if (!valida.ok) return { pedido: undefined, motivo: valida.error, texto };
  return { pedido: { modeloId: modelo.id, variaveis: valida.value }, motivo: undefined, texto: textoDoModelo(modelo, valida.value) };
}

const ROTULO_DA_CATEGORIA = { utilidade: "utilidade", marketing: "marketing", autenticacao: "autenticação" } as const;

/** O valor inicial de cada variável: `{{1}}` leva o primeiro nome do Contato (o caso comum), as outras ficam vazias. */
function variaveisIniciais(modelo: ModeloNaLista, primeiroNome: string | undefined): string[] {
  return Array.from({ length: modelo.quantidadeDeVariaveis }, (_, i) => (i === 0 && primeiroNome ? primeiroNome : ""));
}

export function SeletorDeModelo({
  modelos,
  primeiroNome,
  disabled = false,
  erro,
  onChange,
}: {
  /** Só os modelos enviáveis do Canal (`useModelosEnviaveis`). */
  readonly modelos: readonly ModeloNaLista[];
  /** O primeiro nome do Contato: pré-preenche `{{1}}` ao escolher o modelo. */
  readonly primeiroNome?: string | undefined;
  /** Enquanto o envio está em voo os campos ficam parados. */
  readonly disabled?: boolean;
  readonly erro?: ErroDoSeletor | null | undefined;
  readonly onChange: (escolha: EscolhaDeModelo) => void;
}) {
  const [modeloId, setModeloId] = useState("");
  const [variaveis, setVariaveis] = useState<string[]>([]);
  const modelo = modelos.find((m) => m.id === modeloId);

  const escolher = (id: string) => {
    const novo = modelos.find((m) => m.id === id);
    const valores = novo ? variaveisIniciais(novo, primeiroNome) : [];
    setModeloId(id);
    setVariaveis(valores);
    onChange(escolhaDe(novo, valores));
  };

  const preencher = (indice: number, valor: string) => {
    const valores = variaveis.map((v, i) => (i === indice ? valor : v));
    setVariaveis(valores);
    onChange(escolhaDe(modelo, valores));
  };

  const escolha = escolhaDe(modelo, variaveis);
  const noModelo = erro?.campo === "modeloId" ? erro.texto : undefined;
  const nasVariaveis = erro?.campo === "variaveis" ? erro.texto : undefined;

  return (
    <div className="grid gap-3" data-seletor-de-modelo="true">
      <Field label="Mensagem de modelo" required hint="Aprovada pela Meta. É a única forma de começar a conversa ou de escrever fora da janela de 24 h." {...(noModelo !== undefined ? { error: noModelo } : {})}>
        {(id) => (
          <Select
            id={id}
            value={modeloId}
            onChange={escolher}
            placeholder="Escolher o modelo"
            required
            disabled={disabled}
            disabledReason="Enviando a Mensagem…"
            options={modelos.map((m) => ({ value: m.id, label: m.nome, detail: `${m.idioma} · ${ROTULO_DA_CATEGORIA[m.categoria]}` }))}
          />
        )}
      </Field>

      {modelo ? (
        <>
          {/* O texto vem de um modelo da Meta e do que a pessoa digitou: entra como texto do React, nunca como HTML. */}
          <div>
            <p className="rotulo">Como o Contato vai receber</p>
            <p
              data-previa-do-modelo="true"
              className="app-base whitespace-pre-wrap rounded-[var(--r-controle)] px-3 py-2"
              style={{ background: "var(--superficie-2)", color: "var(--texto)" }}
            >
              {escolha.texto}
            </p>
          </div>

          {modelo.quantidadeDeVariaveis > 0 ? (
            <div className="grid gap-3">
              {variaveis.map((valor, i) => (
                <Field
                  key={`${modelo.id}:${i}`}
                  label={`Variável {{${i + 1}}}`}
                  required
                  {...(i === 0 && primeiroNome ? { hint: "Já veio com o primeiro nome do Contato; troque se precisar." } : {})}
                >
                  {(id) => <TextInput id={id} value={valor} onChange={(novo) => preencher(i, novo)} disabled={disabled} disabledReason="Enviando a Mensagem…" invalid={nasVariaveis !== undefined} required />}
                </Field>
              ))}
              {nasVariaveis !== undefined ? (
                <p role="alert" className="app-sm" style={{ color: "var(--erro)" }}>
                  {nasVariaveis}
                </p>
              ) : null}
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

/** O que falta dizer quando o Canal não tem NENHUM modelo enviável (a lista da Meta ainda não foi sincronizada, ou nada foi aprovado). */
export const FRASE_SEM_MODELO_ENVIAVEL =
  "Este Canal não tem Mensagem de modelo aprovada: sincronize os modelos na ficha do Canal ou aprove um na Meta.";

/**
 * O estado do seletor para quem o hospeda num diálogo (nova Tarefa, trocar o Canal da Tarefa): lê os modelos do Canal, guarda a
 * escolha e diz se a Mensagem inicial é de modelo (`oficial`) e, se for, o que falta (`motivo`). `chave` identifica o par
 * (Contato, Canal, abertura) a que a escolha pertence: quando ela muda, a escolha antiga é descartada sem efeito nem reset à mão.
 * A recusa `JANELA_EXPIRADA` da api traz os modelos (`aprenderDaRecusa`) e vale quando a leitura deles falhou.
 */
export function useEscolhaDeModelo(canal: { readonly id: string; readonly provedor: string } | undefined, chave: string, opcoes: { readonly pausado?: boolean } = {}) {
  const modelos = useModelosEnviaveis(canal, opcoes);
  const [guardada, setGuardada] = useState<{ readonly chave: string; readonly escolha: EscolhaDeModelo }>({ chave: "", escolha: SEM_ESCOLHA });
  const [daRecusa, setDaRecusa] = useState<{ readonly chave: string; readonly itens: readonly ModeloNaLista[] } | undefined>(undefined);
  const escolha = guardada.chave === chave ? guardada.escolha : SEM_ESCOLHA;
  const paraEscolher = modelos.enviaveis.length > 0 ? modelos.enviaveis : daRecusa?.chave === chave ? daRecusa.itens : [];
  const carregando = modelos.carregando && paraEscolher.length === 0;
  /** Por que a Mensagem inicial de modelo ainda não pode sair; `undefined` quando o pedido está pronto. */
  const motivo = carregando
    ? "Carregando as Mensagens de modelo…"
    : paraEscolher.length === 0
      ? FRASE_SEM_MODELO_ENVIAVEL
      : escolha.pedido === undefined
        ? escolha.motivo
        : undefined;
  return {
    /** O Canal é o WhatsApp oficial: a primeira Mensagem é de modelo, não de texto livre. */
    oficial: modelos.oficial,
    carregando,
    paraEscolher,
    escolha,
    motivo,
    aoEscolher: (nova: EscolhaDeModelo) => setGuardada({ chave, escolha: nova }),
    aprenderDaRecusa: (falha: unknown) => {
      if (falha instanceof ErroDeApi && falha.codigo === "JANELA_EXPIRADA" && falha.modelos && falha.modelos.length > 0) setDaRecusa({ chave, itens: falha.modelos });
    },
  };
}
