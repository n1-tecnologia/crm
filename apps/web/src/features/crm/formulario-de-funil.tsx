"use client";

/**
 * O diálogo "Novo Funil" (D-04, D-13): Nome, Descrição, Cor, Privado, as duas
 * Regras de encerramento e a lista de Etapas (mínimo uma).
 *
 * A pré-validação é a do domínio (`validarNovoFunil`), a mesma que o endpoint
 * aplica: a frase cai no `Field` certo antes de qualquer ida ao servidor. O
 * primeiro Funil do Espaço de Trabalho vira o Funil padrão no servidor (D-13) —
 * a tela só avisa, não decide. "Privado" é só registrado nesta fase (D-10).
 *
 * Em erro o diálogo fica aberto com os campos preservados; `FUNIL_NOME_EM_USO`
 * cai inline no campo Nome e as demais recusas aparecem por `MensagemDeRecusa`.
 */

import { useId, useState } from "react";
import {
  LIMITE_DE_ETAPAS_POR_FUNIL,
  validarNovoFunil,
  type FunilDetalhado,
  type NovoFunil,
} from "@n1/dominio/crm/funis";
import type { ErroDeApi } from "@/dados/crm/cliente-crm";
import { criarFunil } from "@/dados/crm/funis";
import { MensagemDeRecusa } from "@/features/crm/ciclo-de-vida";
import { comoErroDeApi } from "@/features/crm/formulario-de-contato";
import { Button, ConfirmDialog, Field, SetaDeOrdem, Select, TextArea, TextInput, Toggle } from "@/features/shell/ui";

/** As cores de um Funil são tokens do sistema (a cor é dado do registro, mas nunca um hex escrito no TSX). */
export const CORES_DE_FUNIL: ReadonlyArray<{ readonly value: string; readonly label: string; readonly color?: string }> = [
  { value: "", label: "Sem cor" },
  { value: "var(--texto-3)", label: "Neutra", color: "var(--texto-3)" },
  { value: "var(--info)", label: "Azul", color: "var(--info)" },
  { value: "var(--sucesso)", label: "Verde", color: "var(--sucesso)" },
  { value: "var(--aviso)", label: "Amarela", color: "var(--aviso)" },
  { value: "var(--erro)", label: "Vermelha", color: "var(--erro)" },
  { value: "var(--acento)", label: "Roxa", color: "var(--acento)" },
];

export const NOTA_DE_PRIVADO = "Nesta fase, “privado” só é registrado; a visibilidade por Papel chega depois.";

/** Um interruptor com o rótulo visível ao lado (o `Toggle` pede `labelledBy`). */
export function InterruptorRotulado({
  rotulo,
  nota,
  checked,
  onChange,
  disabled = false,
}: {
  readonly rotulo: string;
  readonly nota?: string;
  readonly checked: boolean;
  readonly onChange: (proximo: boolean) => void;
  readonly disabled?: boolean;
}) {
  const idDoRotulo = useId();
  const idDaNota = useId();
  return (
    <div className="flex items-start justify-between gap-3 py-1">
      <div className="min-w-0">
        <span id={idDoRotulo} className="app-base" style={{ color: "var(--texto)" }}>
          {rotulo}
        </span>
        {nota ? (
          <p id={idDaNota} className="app-meta">
            {nota}
          </p>
        ) : null}
      </div>
      <Toggle checked={checked} onChange={onChange} labelledBy={idDoRotulo} disabled={disabled} {...(nota ? { describedBy: idDaNota } : {})} />
    </div>
  );
}

export interface EtapaDoFormulario {
  /** Identidade da linha na tela (as Etapas ainda não têm id). */
  readonly chave: number;
  readonly nome: string;
  /** Texto digitado; vazio = a api usa o padrão dela. */
  readonly probabilidade: string;
}

export interface ValoresDoFunil {
  readonly nome: string;
  readonly descricao: string;
  readonly cor: string;
  readonly privado: boolean;
  readonly exigeMotivoPerda: boolean;
  readonly exigeValorGanho: boolean;
  readonly etapas: readonly EtapaDoFormulario[];
}

export interface ErrosDoFunil {
  readonly nome?: string;
  readonly etapas?: string;
}

export function valoresIniciaisDoFunil(): ValoresDoFunil {
  return {
    nome: "",
    descricao: "",
    cor: "",
    privado: false,
    exigeMotivoPerda: false,
    exigeValorGanho: false,
    etapas: [{ chave: 1, nome: "Novo", probabilidade: "" }],
  };
}

export type ResultadoDoFormularioDeFunil =
  | { readonly ok: true; readonly corpo: NovoFunil }
  | { readonly ok: false; readonly erros: ErrosDoFunil };

/** O corpo de `POST /funis`: vazios ficam de fora; a regra é a de `validarNovoFunil`. */
export function montarNovoFunil(valores: ValoresDoFunil): ResultadoDoFormularioDeFunil {
  const etapas = valores.etapas.map((etapa) => {
    const texto = etapa.probabilidade.trim();
    return {
      nome: etapa.nome.trim(),
      ...(texto !== "" ? { probabilidadePadrao: Number(texto) } : {}),
    };
  });
  const corpo: NovoFunil = {
    nome: valores.nome.trim(),
    ...(valores.descricao.trim() !== "" ? { descricao: valores.descricao.trim() } : {}),
    ...(valores.cor !== "" ? { cor: valores.cor } : {}),
    privado: valores.privado,
    exigeMotivoPerda: valores.exigeMotivoPerda,
    exigeValorGanho: valores.exigeValorGanho,
    etapas,
  };
  const validacao = validarNovoFunil(corpo);
  if (!validacao.ok) {
    return { ok: false, erros: validacao.field === "nome" ? { nome: validacao.error } : { etapas: validacao.error } };
  }
  return { ok: true, corpo };
}

function ListaDeEtapas({
  etapas,
  onChange,
  erro,
}: {
  readonly etapas: readonly EtapaDoFormulario[];
  readonly onChange: (proximas: readonly EtapaDoFormulario[]) => void;
  readonly erro: string | undefined;
}) {
  const trocar = (chave: number, mudanca: Partial<EtapaDoFormulario>) =>
    onChange(etapas.map((etapa) => (etapa.chave === chave ? { ...etapa, ...mudanca } : etapa)));
  const mover = (indice: number, passo: -1 | 1) => {
    const proximas = [...etapas];
    const [movida] = proximas.splice(indice, 1);
    if (movida) proximas.splice(indice + passo, 0, movida);
    onChange(proximas);
  };
  const proximaChave = etapas.reduce((maior, etapa) => Math.max(maior, etapa.chave), 0) + 1;
  const cheio = etapas.length >= LIMITE_DE_ETAPAS_POR_FUNIL;

  return (
    <fieldset className="grid gap-2">
      <legend className="rotulo">Etapas</legend>
      <ol className="grid gap-2">
        {etapas.map((etapa, indice) => (
          <li key={etapa.chave} className="grid items-end gap-2 sm:grid-cols-[minmax(0,1fr)_9rem_auto]">
            <Field label={`Nome da Etapa ${indice + 1}`}>
              {(id) => <TextInput id={id} value={etapa.nome} onChange={(nome) => trocar(etapa.chave, { nome })} />}
            </Field>
            <Field label="Probabilidade padrão (%)">
              {(id) => (
                <TextInput
                  id={id}
                  type="number"
                  value={etapa.probabilidade}
                  placeholder="0 a 100"
                  onChange={(probabilidade) => trocar(etapa.chave, { probabilidade })}
                />
              )}
            </Field>
            <span className="flex items-center gap-1 pb-1">
              <SetaDeOrdem
                direcao="subir"
                motivo={indice === 0 ? "Já é a primeira Etapa." : undefined}
                onClick={() => mover(indice, -1)}
              />
              <SetaDeOrdem
                direcao="descer"
                motivo={indice === etapas.length - 1 ? "Já é a última Etapa." : undefined}
                onClick={() => mover(indice, 1)}
              />
              <Button
                size="sm"
                variant="ghost"
                onClick={() => onChange(etapas.filter((outra) => outra.chave !== etapa.chave))}
                {...(etapas.length <= 1 ? { disabled: true, disabledReason: "Um Funil precisa de ao menos uma Etapa." } : {})}
              >
                Remover
              </Button>
            </span>
          </li>
        ))}
      </ol>
      {erro ? (
        <p role="alert" className="ajuda" data-erro="true">
          {erro}
        </p>
      ) : null}
      <div>
        <Button
          size="sm"
          onClick={() => onChange([...etapas, { chave: proximaChave, nome: "", probabilidade: "" }])}
          {...(cheio ? { disabled: true, disabledReason: `Um Funil tem no máximo ${LIMITE_DE_ETAPAS_POR_FUNIL} Etapas.` } : {})}
        >
          Adicionar Etapa
        </Button>
      </div>
    </fieldset>
  );
}

/**
 * "Novo Funil" (CTA "Criar Funil"). Sucesso devolve o `FunilDetalhado` para
 * quem chama navegar até a ficha; recusa deixa o diálogo aberto.
 */
export function DialogoNovoFunil({
  open,
  onClose,
  onCriado,
}: {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly onCriado: (detalhado: FunilDetalhado) => void;
}) {
  const [valores, setValores] = useState<ValoresDoFunil>(valoresIniciaisDoFunil);
  const [erros, setErros] = useState<ErrosDoFunil>({});
  const [recusa, setRecusa] = useState<ErroDeApi | null>(null);
  const [enviando, setEnviando] = useState(false);

  const limpar = () => {
    setValores(valoresIniciaisDoFunil());
    setErros({});
    setRecusa(null);
  };

  const cancelar = () => {
    limpar();
    onClose();
  };

  const enviar = async () => {
    const montado = montarNovoFunil(valores);
    if (!montado.ok) {
      setErros(montado.erros);
      return;
    }
    setErros({});
    setRecusa(null);
    setEnviando(true);
    try {
      const detalhado = await criarFunil(montado.corpo);
      limpar();
      onCriado(detalhado);
    } catch (falha) {
      const erro = comoErroDeApi(falha, "Não foi possível criar o Funil. Tente de novo.");
      // Nome repetido é erro do campo; o resto é recusa do servidor, com o diálogo aberto e os campos preservados.
      if (erro.codigo === "FUNIL_NOME_EM_USO") setErros({ nome: erro.message });
      else setRecusa(erro);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <ConfirmDialog
      open={open}
      wide
      title="Novo Funil"
      description="Um Funil precisa de ao menos uma Etapa. O primeiro Funil do Espaço de Trabalho vira o Funil padrão."
      confirmLabel="Criar Funil"
      {...(enviando ? { confirmDisabledReason: "Gravando o Funil…" } : {})}
      onConfirm={() => void enviar()}
      onCancel={cancelar}
    >
      <MensagemDeRecusa erro={recusa} onFechar={() => setRecusa(null)} />
      <div className="grid gap-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Nome" required {...(erros.nome ? { error: erros.nome } : {})}>
            {(id) => (
              <TextInput id={id} value={valores.nome} invalid={erros.nome !== undefined} onChange={(nome) => setValores({ ...valores, nome })} />
            )}
          </Field>
          <Field label="Cor">
            {(id) => (
              <Select
                id={id}
                value={valores.cor}
                options={CORES_DE_FUNIL}
                onChange={(cor) => setValores({ ...valores, cor })}
              />
            )}
          </Field>
        </div>
        <Field label="Descrição">
          {(id) => <TextArea id={id} value={valores.descricao} onChange={(descricao) => setValores({ ...valores, descricao })} />}
        </Field>
        <div className="grid gap-1">
          <InterruptorRotulado
            rotulo="Privado"
            nota={NOTA_DE_PRIVADO}
            checked={valores.privado}
            onChange={(privado) => setValores({ ...valores, privado })}
          />
          <InterruptorRotulado
            rotulo="Exigir Motivo de Perda ao marcar como perdido"
            checked={valores.exigeMotivoPerda}
            onChange={(exigeMotivoPerda) => setValores({ ...valores, exigeMotivoPerda })}
          />
          <InterruptorRotulado
            rotulo="Exigir valor ao marcar como ganho"
            checked={valores.exigeValorGanho}
            onChange={(exigeValorGanho) => setValores({ ...valores, exigeValorGanho })}
          />
        </div>
        <ListaDeEtapas etapas={valores.etapas} onChange={(etapas) => setValores({ ...valores, etapas })} erro={erros.etapas} />
      </div>
    </ConfirmDialog>
  );
}
