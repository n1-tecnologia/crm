"use client";

/**
 * O diálogo "Novo Negócio" (D-11): cria por `POST /negocios`.
 *
 * Um Negócio é de uma Empresa OU de um Contato (`negocios_dono_ck`): o dono
 * vem de `Segmentos` "Empresa" / "Contato" com o `SeletorDeRegistro` buscando
 * na api. O Funil vem dos Funis ativos (padrão: o do quadro que abriu o
 * diálogo, senão o Funil padrão do Espaço) e a Etapa das Etapas dele (padrão:
 * a inicial, `etapaInicial`). O valor é digitado à brasileira ("1.234,56") e
 * vai como texto decimal (`valorDigitadoParaDecimal`); a moeda só acompanha o
 * valor. O Proprietário vazio é "Eu (quem cria)": o backend usa o Membro da
 * sessão quando o corpo não traz `proprietarioId`.
 *
 * A pré-validação é a do domínio (`validarNovoNegocio`), a mesma que o
 * endpoint aplica; o que não cabe no domínio (título, dono, Funil e Etapa
 * escolhidos) é o motivo do botão. Em recusa o diálogo fica aberto com os
 * campos preservados; `SEM_FUNIL_PADRAO` traz o atalho "Ir para Funis".
 */

import Link from "next/link";
import { useState } from "react";
import { LIMITES_CRM } from "@n1/dominio/crm/comum";
import { etapaInicial } from "@n1/dominio/crm/funis";
import { validarNovoNegocio, type NegocioDetalhado, type NovoNegocio } from "@n1/dominio/crm/negocios";
import type { ErroDeApi } from "@/dados/crm/cliente-crm";
import { useFunil, useFunis, type FiltroDeFunis } from "@/dados/crm/funis";
import { criarNegocio, valorDigitadoParaDecimal } from "@/dados/crm/negocios";
import { MensagemDeRecusa } from "@/features/crm/ciclo-de-vida";
import { comoErroDeApi } from "@/features/crm/formulario-de-contato";
import { SeletorDeProprietario } from "@/features/crm/seletor-de-proprietario";
import { SeletorDeRegistro, type RegistroEscolhido } from "@/features/crm/seletor-de-registro";
import { ConfirmDialog, Field, Segmentos, Select, TextArea, TextInput } from "@/features/shell/ui";

/** Os Funis que o seletor oferece: todos os ativos (até 200). O quadro usa o mesmo filtro — a chave de SWR é uma só. */
export const FUNIS_ATIVOS: FiltroDeFunis = { estado: "ativo", limite: LIMITES_CRM.paginaMaxima };

export const MOTIVO_SEM_TITULO = "Informe o título do Negócio.";
export const MOTIVO_SEM_DONO = "Escolha a Empresa ou o Contato do Negócio.";
export const MOTIVO_SEM_FUNIL = "Nenhum Funil ativo: crie um em Funis antes do primeiro Negócio.";
export const MOTIVO_SEM_ETAPA = "O Funil escolhido não tem Etapa: configure-o antes de criar.";
export const MENSAGEM_DO_VALOR = "Informe um valor com até 2 casas decimais (ex.: 1.234,56).";
export const MENSAGEM_DA_PROBABILIDADE = "A probabilidade é um número inteiro de 0 a 100.";
export const MENSAGEM_DA_DATA = "Use uma data válida (DD/MM/AAAA).";

export type DonoDoNegocio = "empresa" | "contato";

export interface ValorInicialDoNegocio {
  readonly funilId?: string;
  readonly empresa?: RegistroEscolhido;
  readonly contato?: RegistroEscolhido;
}

export interface ValoresDoNegocio {
  readonly titulo: string;
  readonly objeto: string;
  readonly descricao: string;
  readonly dono: DonoDoNegocio;
  readonly empresa: RegistroEscolhido | null;
  readonly contato: RegistroEscolhido | null;
  /** `""` = o Funil padrão (do quadro ou do Espaço). */
  readonly funilId: string;
  /** `""` = a Etapa inicial do Funil. */
  readonly etapaId: string;
  readonly valor: string;
  readonly moeda: string;
  readonly probabilidade: string;
  readonly dataPrevista: string;
  readonly origem: string;
  /** O id do Membro, ou `""` = quem cria (D-11). */
  readonly proprietarioId: string;
}

export const NEGOCIO_VAZIO: ValoresDoNegocio = {
  titulo: "",
  objeto: "",
  descricao: "",
  dono: "empresa",
  empresa: null,
  contato: null,
  funilId: "",
  etapaId: "",
  valor: "",
  moeda: "BRL",
  probabilidade: "",
  dataPrevista: "",
  origem: "",
  proprietarioId: "",
};

export type ErrosDoNegocio = Partial<
  Record<"titulo" | "dono" | "funil" | "etapa" | "valor" | "moeda" | "probabilidade" | "dataPrevistaFechamento", string>
>;

export type ResultadoDaMontagem =
  | { readonly ok: true; readonly corpo: NovoNegocio }
  | { readonly ok: false; readonly erros: ErrosDoNegocio };

const aparado = (texto: string): string => texto.trim();

/** "DD/MM/AAAA" → "AAAA-MM-DD"; "AAAA-MM-DD" passa; o resto é `undefined`. O domínio confere se o dia existe. */
export function dataDigitadaParaCivil(texto: string): string | undefined {
  const limpo = aparado(texto);
  const brasileira = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(limpo);
  if (brasileira) return `${brasileira[3]}-${brasileira[2]}-${brasileira[1]}`;
  return /^\d{4}-\d{2}-\d{2}$/.test(limpo) ? limpo : undefined;
}

/** O campo do `OperationResult` do domínio → o campo da tela. */
function campoDe(campo: string | undefined): keyof ErrosDoNegocio {
  if (campo === "valor" || campo === "moeda" || campo === "probabilidade" || campo === "dataPrevistaFechamento") return campo;
  if (campo === "titulo") return "titulo";
  return "dono";
}

/** O corpo de `POST /negocios`: campos vazios ficam de fora; a moeda só vai com o valor. */
export function montarNovoNegocio(valores: ValoresDoNegocio, funilId: string, etapaId: string): ResultadoDaMontagem {
  const erros: ErrosDoNegocio = {};

  const titulo = aparado(valores.titulo);
  if (titulo === "") erros.titulo = MOTIVO_SEM_TITULO;

  const dono = valores.dono === "empresa" ? valores.empresa : valores.contato;
  if (dono === null) erros.dono = MOTIVO_SEM_DONO;

  if (funilId === "") erros.funil = MOTIVO_SEM_FUNIL;
  else if (etapaId === "") erros.etapa = MOTIVO_SEM_ETAPA;

  let valor: string | undefined;
  if (aparado(valores.valor) !== "") {
    valor = valorDigitadoParaDecimal(valores.valor);
    if (valor === undefined) erros.valor = MENSAGEM_DO_VALOR;
  }

  let probabilidade: number | undefined;
  if (aparado(valores.probabilidade) !== "") {
    const numero = Number(aparado(valores.probabilidade));
    if (!Number.isInteger(numero) || numero < 0 || numero > 100) erros.probabilidade = MENSAGEM_DA_PROBABILIDADE;
    else probabilidade = numero;
  }

  let dataPrevistaFechamento: string | undefined;
  if (aparado(valores.dataPrevista) !== "") {
    dataPrevistaFechamento = dataDigitadaParaCivil(valores.dataPrevista);
    if (dataPrevistaFechamento === undefined) erros.dataPrevistaFechamento = MENSAGEM_DA_DATA;
  }

  if (Object.keys(erros).length > 0 || dono === null) return { ok: false, erros };

  const texto = (chave: "objeto" | "descricao" | "origem") => (aparado(valores[chave]) !== "" ? { [chave]: aparado(valores[chave]) } : {});
  const corpo: NovoNegocio = {
    titulo,
    ...(valores.dono === "empresa" ? { empresaId: dono.id } : { contatoId: dono.id }),
    funilId,
    etapaId,
    ...(valor !== undefined ? { valor, moeda: aparado(valores.moeda).toUpperCase() } : {}),
    ...(probabilidade !== undefined ? { probabilidade } : {}),
    ...(dataPrevistaFechamento !== undefined ? { dataPrevistaFechamento } : {}),
    ...texto("objeto"),
    ...texto("descricao"),
    ...texto("origem"),
    ...(valores.proprietarioId !== "" ? { proprietarioId: valores.proprietarioId } : {}),
  };

  // A mesma validação que o endpoint aplica (título, dono, valor, moeda, probabilidade, data).
  const validacao = validarNovoNegocio(corpo);
  if (!validacao.ok) {
    const errosDoDominio: ErrosDoNegocio = {};
    errosDoDominio[campoDe(validacao.field)] = validacao.error;
    return { ok: false, erros: errosDoDominio };
  }
  return { ok: true, corpo };
}

const ORDEM_DOS_MOTIVOS: readonly (keyof ErrosDoNegocio)[] = [
  "titulo",
  "dono",
  "funil",
  "etapa",
  "valor",
  "moeda",
  "probabilidade",
  "dataPrevistaFechamento",
];

/** `undefined` quando dá para criar; senão o motivo que o botão mostra (o primeiro, na ordem dos campos). */
export function motivoParaNaoCriar(montado: ResultadoDaMontagem): string | undefined {
  if (montado.ok) return undefined;
  for (const campo of ORDEM_DOS_MOTIVOS) {
    const motivo = montado.erros[campo];
    if (motivo !== undefined) return motivo;
  }
  return undefined;
}

function CampoDeTexto({
  rotulo,
  valor,
  onChange,
  erro,
  placeholder,
  required = false,
}: {
  readonly rotulo: string;
  readonly valor: string;
  readonly onChange: (texto: string) => void;
  readonly erro?: string | undefined;
  readonly placeholder?: string;
  readonly required?: boolean;
}) {
  return (
    <Field label={rotulo} required={required} {...(erro ? { error: erro } : {})}>
      {(id) => (
        <TextInput
          id={id}
          value={valor}
          onChange={onChange}
          invalid={erro !== undefined}
          required={required}
          {...(placeholder ? { placeholder } : {})}
        />
      )}
    </Field>
  );
}

/**
 * O diálogo "Novo Negócio" (CTA "Criar Negócio"). Em erro, o diálogo fica
 * aberto com os campos preservados; a recusa da api (409 `SEM_FUNIL_PADRAO`,
 * `FUNIL_INATIVO`, `EMPRESA_INATIVA`, 403…) aparece por `MensagemDeRecusa`
 * logo abaixo do cabeçalho.
 */
export function DialogoNovoNegocio({
  open,
  onClose,
  onCriado,
  valorInicial,
}: {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly onCriado: (detalhado: NegocioDetalhado) => void;
  /** O Funil do quadro que abriu o diálogo, ou a Empresa/o Contato de cuja ficha ele nasce (07-11). */
  readonly valorInicial?: ValorInicialDoNegocio;
}) {
  const inicial = (): ValoresDoNegocio => ({
    ...NEGOCIO_VAZIO,
    ...(valorInicial?.contato && !valorInicial.empresa ? { dono: "contato" as const, contato: valorInicial.contato } : {}),
    ...(valorInicial?.empresa ? { empresa: valorInicial.empresa } : {}),
  });
  const [valores, setValores] = useState<ValoresDoNegocio>(inicial);
  const [errosDoEnvio, setErrosDoEnvio] = useState<ErrosDoNegocio>({});
  const [recusa, setRecusa] = useState<ErroDeApi | null>(null);
  const [enviando, setEnviando] = useState(false);

  // Fechado, nada vai à api; aberto, os Funis ativos e as Etapas do escolhido.
  const funis = useFunis(FUNIS_ATIVOS, { pausado: !open });
  const funisAtivos = (funis.data?.itens ?? []).filter((item) => item.funil.estado === "ativo");
  const funilPadraoId =
    (valorInicial?.funilId !== undefined && funisAtivos.some((item) => item.funil.id === valorInicial.funilId) ? valorInicial.funilId : undefined) ??
    funisAtivos.find((item) => item.funil.padrao)?.funil.id ??
    funisAtivos[0]?.funil.id ??
    "";
  const funilId = funisAtivos.some((item) => item.funil.id === valores.funilId) ? valores.funilId : funilPadraoId;
  const funil = useFunil(open && funilId !== "" ? funilId : undefined);
  const etapas = funil.data?.funil.id === funilId ? [...funil.data.etapas].sort((a, b) => a.ordem - b.ordem) : [];
  const etapaId = etapas.some((etapa) => etapa.id === valores.etapaId) ? valores.etapaId : (etapaInicial(etapas)?.id ?? "");

  const montado = montarNovoNegocio(valores, funilId, etapaId);
  const carregando = funis.data === undefined && !funis.error ? "Carregando os Funis…" : funilId !== "" && funil.data === undefined && !funil.error ? "Carregando as Etapas…" : undefined;
  const motivo = enviando ? "Gravando o Negócio…" : (motivoParaNaoCriar(montado) ?? carregando);
  // Os erros de forma (valor, probabilidade, data) aparecem no campo enquanto se digita; os de envio, depois da tentativa.
  const errosDeForma: ErrosDoNegocio = montado.ok ? {} : montado.erros;
  const erros: ErrosDoNegocio = {
    ...errosDoEnvio,
    ...(errosDeForma.valor ? { valor: errosDeForma.valor } : {}),
    ...(errosDeForma.probabilidade ? { probabilidade: errosDeForma.probabilidade } : {}),
    ...(errosDeForma.dataPrevistaFechamento ? { dataPrevistaFechamento: errosDeForma.dataPrevistaFechamento } : {}),
  };

  const limpar = () => {
    setValores(inicial());
    setErrosDoEnvio({});
    setRecusa(null);
  };

  const cancelar = () => {
    limpar();
    onClose();
  };

  const enviar = async () => {
    if (!montado.ok) {
      setErrosDoEnvio(montado.erros);
      return;
    }
    setErrosDoEnvio({});
    setRecusa(null);
    setEnviando(true);
    try {
      const detalhado = await criarNegocio(montado.corpo);
      limpar();
      onCriado(detalhado);
    } catch (falha) {
      // Diálogo aberto, campos preenchidos: a pessoa corrige e tenta de novo.
      setRecusa(comoErroDeApi(falha, "Não foi possível criar o Negócio. Tente de novo."));
    } finally {
      setEnviando(false);
    }
  };

  const mudar = (parte: Partial<ValoresDoNegocio>) => {
    setValores((atual) => ({ ...atual, ...parte }));
    setErrosDoEnvio({});
  };

  const rotuloDoDono = valores.dono === "empresa" ? "Buscar Empresa" : "Buscar Contato";

  return (
    <ConfirmDialog
      open={open}
      wide
      title="Novo Negócio"
      description="O Negócio nasce numa Etapa do Funil escolhido — a inicial, por padrão — e pertence a uma Empresa ou a um Contato."
      confirmLabel="Criar Negócio"
      {...(motivo ? { confirmDisabledReason: motivo } : {})}
      onConfirm={() => void enviar()}
      onCancel={cancelar}
    >
      <MensagemDeRecusa
        erro={recusa}
        onFechar={() => setRecusa(null)}
        {...(recusa?.codigo === "SEM_FUNIL_PADRAO"
          ? {
              acao: (
                <Link href="/crm/funis" className="btn btn-contorno btn-sm shrink-0">
                  Ir para Funis
                </Link>
              ),
            }
          : {})}
      />
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <CampoDeTexto rotulo="Título" valor={valores.titulo} onChange={(titulo) => mudar({ titulo })} erro={erros.titulo} required />
        </div>
        <CampoDeTexto rotulo="Objeto" valor={valores.objeto} onChange={(objeto) => mudar({ objeto })} placeholder="O que está sendo vendido" />
        <CampoDeTexto rotulo="Origem" valor={valores.origem} onChange={(origem) => mudar({ origem })} />

        <div className="sm:col-span-2">
          <Segmentos
            rotulo="Dono do Negócio"
            opcoes={[
              { valor: "empresa", rotulo: "Empresa" },
              { valor: "contato", rotulo: "Contato" },
            ]}
            valor={valores.dono}
            aoTrocar={(dono) => mudar({ dono })}
          />
        </div>
        <div className="sm:col-span-2">
          <Field label={rotuloDoDono} {...(erros.dono ? { error: erros.dono } : {})}>
            {(id) =>
              valores.dono === "empresa" ? (
                <SeletorDeRegistro id={id} recurso="empresas" rotulo={rotuloDoDono} valor={valores.empresa} onChange={(empresa) => mudar({ empresa })} />
              ) : (
                <SeletorDeRegistro id={id} recurso="contatos" rotulo={rotuloDoDono} valor={valores.contato} onChange={(contato) => mudar({ contato })} />
              )
            }
          </Field>
        </div>

        <Field label="Funil" {...(erros.funil ? { error: erros.funil } : {})}>
          {(id) => (
            <Select
              id={id}
              value={funilId}
              placeholder={carregando === "Carregando os Funis…" ? "Carregando…" : "Escolher o Funil"}
              options={funisAtivos.map((item) => ({ value: item.funil.id, label: item.funil.nome, ...(item.funil.padrao ? { detail: "padrão" } : {}) }))}
              // Trocar de Funil volta a Etapa para a inicial do novo.
              onChange={(novo) => mudar({ funilId: novo, etapaId: "" })}
            />
          )}
        </Field>
        <Field label="Etapa" {...(erros.etapa ? { error: erros.etapa } : {})}>
          {(id) => (
            <Select
              id={id}
              value={etapaId}
              placeholder={funilId === "" ? "Escolha o Funil antes" : "Escolher a Etapa"}
              options={etapas.map((etapa) => ({ value: etapa.id, label: etapa.nome, detail: `${etapa.probabilidadePadrao}%` }))}
              onChange={(novo) => mudar({ etapaId: novo })}
              disabled={etapas.length === 0}
              {...(etapas.length === 0 ? { disabledReason: funilId === "" ? "Escolha o Funil antes." : (carregando ?? MOTIVO_SEM_ETAPA) } : {})}
            />
          )}
        </Field>

        <CampoDeTexto rotulo="Valor" valor={valores.valor} onChange={(valor) => mudar({ valor })} erro={erros.valor} placeholder="0,00" />
        <CampoDeTexto rotulo="Moeda" valor={valores.moeda} onChange={(moeda) => mudar({ moeda })} erro={erros.moeda} placeholder="BRL" />
        <CampoDeTexto
          rotulo="Probabilidade (%)"
          valor={valores.probabilidade}
          onChange={(probabilidade) => mudar({ probabilidade })}
          erro={erros.probabilidade}
          placeholder="A da Etapa, se vazio"
        />
        <CampoDeTexto
          rotulo="Data prevista de fechamento"
          valor={valores.dataPrevista}
          onChange={(dataPrevista) => mudar({ dataPrevista })}
          erro={erros.dataPrevistaFechamento}
          placeholder="DD/MM/AAAA"
        />
        <Field label="Proprietário">
          {(id) => <SeletorDeProprietario id={id} valor={valores.proprietarioId} onChange={(proprietarioId) => mudar({ proprietarioId })} />}
        </Field>
        <div className="sm:col-span-2">
          <Field label="Descrição">{(id) => <TextArea id={id} value={valores.descricao} onChange={(descricao) => mudar({ descricao })} />}</Field>
        </div>
      </div>
    </ConfirmDialog>
  );
}
