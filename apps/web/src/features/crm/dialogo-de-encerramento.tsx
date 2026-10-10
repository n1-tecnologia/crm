"use client";

/**
 * O DIÁLOGO DE ENCERRAMENTO (UI-SPEC §5): ganhar, perder e reabrir um Negócio,
 * num só componente de três modos. O quadro o abre pelo menu do cartão e pela
 * faixa "Negócios encerrados"; a ficha do Negócio (07-11) o reusa.
 *
 * As Regras de encerramento do Funil (D-05) valem ANTES do envio: o diálogo
 * chama `validarGanho`/`validarPerda`/`validarReabertura` do domínio, as mesmas
 * funções que o serviço aplica, e deixa Confirmar desligado com a frase delas.
 * A pessoa vê o porquê antes do clique; o servidor continua sendo a autoridade
 * (um 409 `NEGOCIO_EXIGE_VALOR`/`NEGOCIO_EXIGE_MOTIVO` de uma tela velha cai no
 * campo, e qualquer outra recusa aparece por `MensagemDeRecusa`, sem fechar).
 *
 * Quem pode reabrir um Negócio `ganho` é do Papel (RN-NEG-10, D-14): a tela só
 * desliga o botão por `usePodeNoCrm`; quem barra de verdade é o backend.
 *
 * Reabrir: a Etapa de destino é opcional (sem ela, a atual). Com o Funil do
 * Negócio arquivado ou na lixeira ela deixa de ser opcional (RN-FUN-14): o
 * diálogo pede um Funil ativo e uma Etapa dele.
 */

import { useState } from "react";
import type { EstadoCrm, SituacaoNegocio } from "@n1/dominio/crm/comum";
import { validarGanho, validarPerda, validarReabertura, type Ganho, type Perda, type Reabertura } from "@n1/dominio/crm/negocios";
import type { ErroDeApi } from "@/dados/crm/cliente-crm";
import { useFunil, useFunis } from "@/dados/crm/funis";
import { ganharNegocio, perderNegocio, reabrirNegocio, valorDigitadoParaDecimal } from "@/dados/crm/negocios";
import { usePodeNoCrm } from "@/dados/crm/sessao";
import { MensagemDeRecusa } from "@/features/crm/ciclo-de-vida";
import { comoErroDeApi } from "@/features/crm/formulario-de-contato";
import { ConfirmDialog, Field, Select, TextArea, TextInput } from "@/features/shell/ui";

export type ModoDeEncerramento = "ganhar" | "perder" | "reabrir";

export interface NegocioDoDialogo {
  readonly id: string;
  readonly titulo: string;
  readonly valor: string | null;
  readonly situacao: SituacaoNegocio;
  readonly estado: EstadoCrm;
}

export interface FunilDoDialogo {
  readonly estado: EstadoCrm;
  readonly exigeMotivoPerda: boolean;
  readonly exigeValorGanho: boolean;
}

export interface PropsDoDialogoDeEncerramento {
  readonly modo: ModoDeEncerramento;
  readonly negocio: NegocioDoDialogo;
  readonly funil: FunilDoDialogo;
  /** As Etapas do Funil do Negócio, para o destino opcional da reabertura. */
  readonly etapas?: ReadonlyArray<{ readonly id: string; readonly nome: string }>;
  readonly onClose: () => void;
  /** Gravou: quem abriu fecha o diálogo e atualiza o que mostra. */
  readonly onConcluido: () => void;
}

const MENSAGEM_DO_VALOR = "Informe um valor com até 2 casas decimais (ex.: 1.234,56).";
const MANTER_A_ETAPA = "Manter a Etapa atual";

const ROTULO_DO_BOTAO: Record<ModoDeEncerramento, string> = {
  ganhar: "Marcar como ganho",
  perder: "Marcar como perdido",
  reabrir: "Reabrir Negócio",
};

const TITULO: Record<ModoDeEncerramento, string> = {
  ganhar: "Ganhar Negócio",
  perder: "Perder Negócio",
  reabrir: "Reabrir Negócio",
};

function descricaoDo(modo: ModoDeEncerramento, titulo: string): string {
  if (modo === "ganhar") {
    return `“${titulo}” permanece na Etapa atual. Reabrir é possível depois, mas só um Administrador reabre um Negócio ganho.`;
  }
  if (modo === "perder") return `“${titulo}” permanece na Etapa atual. Reabrir é possível depois.`;
  return `“${titulo}” volta a ficar aberto, e o motivo e a nota de encerramento são limpos (RN-NEG-11).`;
}

/** Um campo de texto só entra no corpo se tiver algo escrito. */
function aparado(texto: string): string | undefined {
  const limpo = texto.trim();
  return limpo === "" ? undefined : limpo;
}

/** `valor` à brasileira → decimal; o resto é texto livre. */
function montarGanho(valor: string | undefined, motivo: string, nota: string): Ganho | undefined {
  const corpo: { valor?: string; motivoGanho?: string; notaEncerramento?: string } = {};
  if (valor !== undefined) corpo.valor = valor;
  const motivoGanho = aparado(motivo);
  if (motivoGanho !== undefined) corpo.motivoGanho = motivoGanho;
  const notaEncerramento = aparado(nota);
  if (notaEncerramento !== undefined) corpo.notaEncerramento = notaEncerramento;
  return Object.keys(corpo).length > 0 ? corpo : undefined;
}

function montarPerda(motivo: string, nota: string): Perda | undefined {
  const corpo: { motivoPerda?: string; notaEncerramento?: string } = {};
  const motivoPerda = aparado(motivo);
  if (motivoPerda !== undefined) corpo.motivoPerda = motivoPerda;
  const notaEncerramento = aparado(nota);
  if (notaEncerramento !== undefined) corpo.notaEncerramento = notaEncerramento;
  return Object.keys(corpo).length > 0 ? corpo : undefined;
}

export function DialogoDeEncerramento({ modo, negocio, funil, etapas, onClose, onConcluido }: PropsDoDialogoDeEncerramento) {
  // Pré-preenchido com o valor do Negócio, no jeito de digitar do Brasil.
  const [valorTexto, setValorTexto] = useState(negocio.valor === null ? "" : negocio.valor.replace(".", ","));
  const [motivoGanho, setMotivoGanho] = useState("");
  const [motivoPerda, setMotivoPerda] = useState("");
  const [nota, setNota] = useState("");
  const [etapaId, setEtapaId] = useState("");
  const [funilDestinoId, setFunilDestinoId] = useState("");
  const [recusa, setRecusa] = useState<ErroDeApi | null>(null);
  const [erroDeCampo, setErroDeCampo] = useState<{ readonly campo: "valor" | "motivoPerda"; readonly mensagem: string } | null>(null);
  const [enviando, setEnviando] = useState(false);

  const semPermissao = usePodeNoCrm(modo, "negocio", { situacao: negocio.situacao });

  // Funil do Negócio fora de `ativo`: o destino é de outro Funil (RN-FUN-14). Nada vai à api nos outros casos.
  const pedeFunilDeDestino = modo === "reabrir" && funil.estado !== "ativo";
  const funisAtivos = useFunis({ estado: "ativo" }, { pausado: !pedeFunilDeDestino });
  const funilEscolhido = useFunil(pedeFunilDeDestino && funilDestinoId !== "" ? funilDestinoId : undefined);

  const valorDecimal = valorDigitadoParaDecimal(valorTexto);
  const valorIlegivel = modo === "ganhar" && valorTexto.trim() !== "" && valorDecimal === undefined;

  let motivoDoDominio: string | undefined;
  if (modo === "ganhar") {
    if (valorIlegivel) motivoDoDominio = MENSAGEM_DO_VALOR;
    else {
      const resultado = validarGanho({ negocio, funil, entrada: valorDecimal !== undefined ? { valor: valorDecimal } : {} });
      if (!resultado.ok) motivoDoDominio = resultado.error;
    }
  } else if (modo === "perder") {
    const resultado = validarPerda({ negocio, funil, entrada: { motivoPerda: motivoPerda } });
    if (!resultado.ok) motivoDoDominio = resultado.error;
  } else {
    const destino =
      pedeFunilDeDestino && funilDestinoId !== "" && etapaId !== ""
        ? { funil: { id: funilDestinoId, estado: "ativo" as const }, etapa: { id: etapaId, funilId: funilDestinoId } }
        : undefined;
    const resultado = validarReabertura({ negocio, funil, ...(destino ? { destino } : {}) });
    if (!resultado.ok) motivoDoDominio = resultado.error;
  }

  const motivo = enviando ? "Gravando…" : (semPermissao ?? motivoDoDominio);

  const fechar = () => {
    setRecusa(null);
    setErroDeCampo(null);
    onClose();
  };

  const enviar = async () => {
    setRecusa(null);
    setErroDeCampo(null);
    setEnviando(true);
    try {
      if (modo === "ganhar") await ganharNegocio(negocio.id, montarGanho(valorDecimal, motivoGanho, nota));
      else if (modo === "perder") await perderNegocio(negocio.id, montarPerda(motivoPerda, nota));
      else {
        const destino: Reabertura | undefined =
          etapaId === "" ? undefined : pedeFunilDeDestino ? { funilId: funilDestinoId, etapaId } : { etapaId };
        await reabrirNegocio(negocio.id, destino);
      }
      onConcluido();
    } catch (falha) {
      const erro = comoErroDeApi(falha, "Não foi possível concluir. Tente de novo.");
      // D-05: a Regra do Funil que a tela não conhecia (tela velha) cai no campo; o resto, em Toast.
      if (erro.codigo === "NEGOCIO_EXIGE_VALOR") setErroDeCampo({ campo: "valor", mensagem: erro.message });
      else if (erro.codigo === "NEGOCIO_EXIGE_MOTIVO") setErroDeCampo({ campo: "motivoPerda", mensagem: erro.message });
      else setRecusa(erro);
    } finally {
      setEnviando(false);
    }
  };

  const opcoesDeEtapa = pedeFunilDeDestino
    ? [...(funilEscolhido.data?.etapas ?? [])].sort((a, b) => a.ordem - b.ordem).map((etapa) => ({ value: etapa.id, label: etapa.nome }))
    : (etapas ?? []).map((etapa) => ({ value: etapa.id, label: etapa.nome }));

  const erroDoValor = erroDeCampo?.campo === "valor" ? erroDeCampo.mensagem : valorIlegivel ? MENSAGEM_DO_VALOR : undefined;
  const erroDoMotivo = erroDeCampo?.campo === "motivoPerda" ? erroDeCampo.mensagem : undefined;

  return (
    <ConfirmDialog
      open
      title={TITULO[modo]}
      description={descricaoDo(modo, negocio.titulo)}
      confirmLabel={ROTULO_DO_BOTAO[modo]}
      destructive={modo === "perder"}
      {...(motivo ? { confirmDisabledReason: motivo } : {})}
      onConfirm={() => void enviar()}
      onCancel={fechar}
    >
      <MensagemDeRecusa erro={recusa} onFechar={() => setRecusa(null)} />
      <div className="grid gap-3">
        {modo === "ganhar" ? (
          <>
            <Field
              label="Valor"
              required={funil.exigeValorGanho}
              {...(funil.exigeValorGanho ? { hint: "Obrigatório neste Funil." } : {})}
              {...(erroDoValor ? { error: erroDoValor } : {})}
            >
              {(id) => (
                <TextInput
                  id={id}
                  value={valorTexto}
                  invalid={erroDoValor !== undefined}
                  placeholder="0,00"
                  onChange={(texto) => {
                    setValorTexto(texto);
                    setErroDeCampo(null);
                  }}
                />
              )}
            </Field>
            <Field label="Motivo do ganho">{(id) => <TextInput id={id} value={motivoGanho} onChange={setMotivoGanho} />}</Field>
          </>
        ) : null}

        {modo === "perder" ? (
          <Field
            label="Motivo da perda"
            required={funil.exigeMotivoPerda}
            {...(funil.exigeMotivoPerda ? { hint: "Obrigatório neste Funil." } : {})}
            {...(erroDoMotivo ? { error: erroDoMotivo } : {})}
          >
            {(id) => (
              <TextInput
                id={id}
                value={motivoPerda}
                invalid={erroDoMotivo !== undefined}
                onChange={(texto) => {
                  setMotivoPerda(texto);
                  setErroDeCampo(null);
                }}
              />
            )}
          </Field>
        ) : null}

        {modo === "ganhar" || modo === "perder" ? (
          <Field label="Nota de encerramento">{(id) => <TextArea id={id} value={nota} onChange={setNota} rows={2} />}</Field>
        ) : null}

        {pedeFunilDeDestino ? (
          <Field label="Funil de destino" required hint="O Funil deste Negócio não recebe mais Negócios: escolha onde ele volta a ficar aberto.">
            {(id) => (
              <Select
                id={id}
                value={funilDestinoId}
                placeholder="Escolher o Funil"
                options={(funisAtivos.data?.itens ?? []).map((item) => ({ value: item.funil.id, label: item.funil.nome }))}
                onChange={(valor) => {
                  setFunilDestinoId(valor);
                  setEtapaId("");
                }}
              />
            )}
          </Field>
        ) : null}

        {modo === "reabrir" && (pedeFunilDeDestino || opcoesDeEtapa.length > 0) ? (
          <Field label="Etapa de destino" required={pedeFunilDeDestino}>
            {(id) => (
              <Select
                id={id}
                value={etapaId}
                placeholder={pedeFunilDeDestino ? "Escolher a Etapa" : MANTER_A_ETAPA}
                options={pedeFunilDeDestino ? opcoesDeEtapa : [{ value: "", label: MANTER_A_ETAPA }, ...opcoesDeEtapa]}
                onChange={setEtapaId}
                disabled={pedeFunilDeDestino && (funilDestinoId === "" || funilEscolhido.data === undefined)}
                {...(pedeFunilDeDestino ? { disabledReason: "Escolha o Funil de destino antes." } : {})}
              />
            )}
          </Field>
        ) : null}
      </div>
    </ConfirmDialog>
  );
}
