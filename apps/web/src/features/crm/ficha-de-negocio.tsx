"use client";

/**
 * A ficha nova de Negócio (D-04): enxuta, sobre o que a 007 guarda — os dados
 * do Negócio, o dono (Empresa OU Contato), a Etapa e o Funil, o encerramento —
 * e o ciclo de vida do D-06 (Arquivar, Excluir = Lixeira, Restaurar, Excluir
 * permanentemente) com as recusas visíveis por `MensagemDeRecusa`.
 *
 * O que a 007 NÃO guarda não aparece aqui, nem desabilitado, nem como "em
 * breve" (D-02): Vínculos Contato-Negócio N:N e papéis, Tags, Comentários,
 * Anexos, histórico de Etapas, Requisitos de entrada e temperatura. O Negócio
 * mostra a sua Empresa ou o seu Contato, um só.
 *
 * Cada gesto é uma rota: editar é `PATCH /negocios/:id` só com o que mudou
 * (`validarEdicao` antes, a mesma função do serviço); trocar a Etapa ou o
 * Funil é `POST …/mover` (`validarMovimento` antes — trocar de Funil exige a
 * Etapa do Funil novo, RN-FUN-15); ganhar, perder e reabrir passam pelo
 * `DialogoDeEncerramento`, que aplica as Regras do Funil (D-05). Só um Negócio
 * `ativo` se edita, move ou encerra (RN-NEG-16): arquivado ou na lixeira a
 * ficha é só leitura e o cabeçalho só restaura ou exclui. Reabrir um `ganho` é
 * de quem administra (RN-NEG-10, D-14): a tela desliga o botão com a frase e
 * quem barra de verdade é o backend.
 *
 * A ficha recebe o `NegocioDetalhado` pronto (a página lê por `useNegocio`) e
 * toda gravação passa pelas mutações de `dados/crm/negocios.ts`, que revalidam
 * `/negocios`, `/funis`, `/contatos` e `/empresas` — o dado novo volta pela
 * mesma prop. O Toast "Negócio criado." viaja com a navegação (`marcarChegada`
 * em quem cria) e esta ficha o acende ao chegar.
 *
 * Todo texto vindo da api é renderizado como texto React (escapado); links
 * saem de rota fixa + id; nada de `dangerouslySetInnerHTML` (T-07-34).
 */

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import type { SituacaoNegocio } from "@n1/dominio/crm/comum";
import {
  probabilidadeEfetiva,
  validarEdicao,
  validarMovimento,
  type EdicaoDeNegocio,
  type NegocioDetalhado,
} from "@n1/dominio/crm/negocios";
import type { ErroDeApi } from "@/dados/crm/cliente-crm";
import { useFunil, useFunis } from "@/dados/crm/funis";
import {
  arquivarNegocio,
  editarNegocio,
  enviarNegocioParaLixeira,
  excluirNegocioPermanentemente,
  moverNegocio,
  restaurarNegocio,
  valorDigitadoParaDecimal,
} from "@/dados/crm/negocios";
import { useNomeDoMembro, usePodeNoCrm } from "@/dados/crm/sessao";
import { AcoesDeCicloDeVida, MensagemDeRecusa, seloDoEstado } from "@/features/crm/ciclo-de-vida";
import { DialogoDeEncerramento, type ModoDeEncerramento } from "@/features/crm/dialogo-de-encerramento";
import { comoErroDeApi } from "@/features/crm/formulario-de-contato";
import {
  dataDigitadaParaCivil,
  FUNIS_ATIVOS,
  MENSAGEM_DA_DATA,
  MENSAGEM_DA_PROBABILIDADE,
  MENSAGEM_DO_VALOR,
  type DonoDoNegocio,
} from "@/features/crm/formulario-de-negocio";
import { SeletorDeProprietario } from "@/features/crm/seletor-de-proprietario";
import { SeletorDeRegistro, type RegistroEscolhido } from "@/features/crm/seletor-de-registro";
import { consumirChegada, lerChegada } from "@/features/shell/recente";
import {
  Button,
  ConfirmDialog,
  CorpoDeTela,
  Field,
  PageHeader,
  Painel,
  Pilula,
  Section,
  Segmentos,
  Select,
  StateSeal,
  TextArea,
  TextInput,
  Toast,
} from "@/features/shell/ui";
import { useFormat } from "@/features/shell/use-format";

type Negocio = NegocioDetalhado["negocio"];

/**
 * Executa uma gravação: limpa os avisos, mostra o sucesso, ou a recusa. Devolve se deu certo.
 * `aoRecusar` pode tomar a recusa para si (devolvendo `true`): a tela não a repete em `Toast`.
 */
type Agir = (acao: () => Promise<unknown>, sucesso?: string, aoRecusar?: (erro: ErroDeApi) => boolean) => Promise<boolean>;

/** A situação do Negócio no vocabulário de cor do sistema: `perdido` não é vermelho. */
const PILULA_DA_SITUACAO: Record<SituacaoNegocio, { readonly rotulo: string; readonly cor: string }> = {
  aberto: { rotulo: "Aberto", cor: "var(--cor-neg-aberto)" },
  ganho: { rotulo: "Ganho", cor: "var(--cor-neg-ganho)" },
  perdido: { rotulo: "Perdido", cor: "var(--cor-neg-perdido)" },
};

/** O Toast de sucesso de cada encerramento (UI-SPEC, "Mensagens de sucesso"). */
const AVISO_DO_MODO: Record<ModoDeEncerramento, string> = {
  ganhar: "Negócio marcado como ganho.",
  perder: "Negócio marcado como perdido.",
  reabrir: "Negócio reaberto.",
};

const MOTIVO_SEM_TITULO = "Informe o título do Negócio.";
const NADA_PARA_SALVAR = "Nada para salvar.";

function LinhaDeDado({ rotulo, children }: { readonly rotulo: string; readonly children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1">
      <dt className="app-meta shrink-0">{rotulo}</dt>
      <dd className="app-base min-w-0 break-words text-right" style={{ color: "var(--texto)" }}>
        {children}
      </dd>
    </div>
  );
}

// ── Edição (PATCH só com o que mudou) ───────────────────────────────────────

interface ValoresDeEdicao {
  readonly titulo: string;
  readonly objeto: string;
  readonly descricao: string;
  readonly valor: string;
  readonly moeda: string;
  readonly probabilidade: string;
  readonly dataPrevista: string;
  readonly origem: string;
  readonly proprietarioId: string;
}

type ErrosDeEdicao = Partial<Record<"titulo" | "valor" | "moeda" | "probabilidade" | "dataPrevistaFechamento" | "geral", string>>;

type ResultadoDaEdicao = { readonly ok: true; readonly edicao: EdicaoDeNegocio } | { readonly ok: false; readonly erros: ErrosDeEdicao };

/** "AAAA-MM-DD" → "DD/MM/AAAA", o jeito de digitar do Brasil. */
function civilParaDigitada(data: string): string {
  const [ano, mes, dia] = data.split("-");
  return ano && mes && dia ? `${dia}/${mes}/${ano}` : data;
}

function valoresDeEdicao(negocio: Negocio): ValoresDeEdicao {
  return {
    titulo: negocio.titulo,
    objeto: negocio.objeto ?? "",
    descricao: negocio.descricao ?? "",
    valor: negocio.valor === null ? "" : negocio.valor.replace(".", ","),
    moeda: negocio.moeda,
    probabilidade: negocio.probabilidade === null ? "" : String(negocio.probabilidade),
    dataPrevista: negocio.dataPrevistaFechamento ? civilParaDigitada(negocio.dataPrevistaFechamento) : "",
    origem: negocio.origem ?? "",
    proprietarioId: negocio.proprietarioId,
  };
}

/** O campo do `OperationResult` do domínio → o campo da tela. */
function campoDe(campo: string | undefined): keyof ErrosDeEdicao {
  if (campo === "titulo" || campo === "valor" || campo === "moeda" || campo === "probabilidade" || campo === "dataPrevistaFechamento") return campo;
  return "geral";
}

/**
 * O corpo de `PATCH /negocios/:id`: só o que mudou em relação ao Negócio, com
 * `null` para o que foi apagado. Valor à brasileira vira texto decimal; a
 * pré-validação é a do domínio (`validarEdicao`), a mesma que o endpoint aplica.
 */
export function montarEdicaoDeNegocio(negocio: Negocio, valores: ValoresDeEdicao): ResultadoDaEdicao {
  const erros: ErrosDeEdicao = {};
  const edicao: { -readonly [K in keyof EdicaoDeNegocio]?: EdicaoDeNegocio[K] } = {};

  const titulo = valores.titulo.trim();
  if (titulo === "") erros.titulo = MOTIVO_SEM_TITULO;
  else if (titulo !== negocio.titulo) edicao.titulo = titulo;

  for (const chave of ["objeto", "descricao", "origem"] as const) {
    const texto = valores[chave].trim();
    if (texto !== (negocio[chave] ?? "")) edicao[chave] = texto === "" ? null : texto;
  }

  const valorTexto = valores.valor.trim();
  if (valorTexto === "") {
    if (negocio.valor !== null) edicao.valor = null;
  } else {
    const decimal = valorDigitadoParaDecimal(valorTexto);
    if (decimal === undefined) erros.valor = MENSAGEM_DO_VALOR;
    else if (decimal !== negocio.valor) edicao.valor = decimal;
  }

  const moeda = valores.moeda.trim().toUpperCase();
  if (moeda !== negocio.moeda) edicao.moeda = moeda;

  const probabilidadeTexto = valores.probabilidade.trim();
  if (probabilidadeTexto === "") {
    if (negocio.probabilidade !== null) edicao.probabilidade = null;
  } else {
    const numero = Number(probabilidadeTexto);
    if (!Number.isInteger(numero) || numero < 0 || numero > 100) erros.probabilidade = MENSAGEM_DA_PROBABILIDADE;
    else if (numero !== negocio.probabilidade) edicao.probabilidade = numero;
  }

  const dataTexto = valores.dataPrevista.trim();
  if (dataTexto === "") {
    if (negocio.dataPrevistaFechamento !== null) edicao.dataPrevistaFechamento = null;
  } else {
    const civil = dataDigitadaParaCivil(dataTexto);
    if (civil === undefined) erros.dataPrevistaFechamento = MENSAGEM_DA_DATA;
    else if (civil !== negocio.dataPrevistaFechamento) edicao.dataPrevistaFechamento = civil;
  }

  if (valores.proprietarioId !== "" && valores.proprietarioId !== negocio.proprietarioId) edicao.proprietarioId = valores.proprietarioId;

  if (Object.keys(erros).length > 0) return { ok: false, erros };

  const validacao = validarEdicao(negocio, edicao);
  if (!validacao.ok) {
    const errosDoDominio: ErrosDeEdicao = {};
    errosDoDominio[campoDe(validacao.field)] = validacao.error;
    return { ok: false, erros: errosDoDominio };
  }
  return { ok: true, edicao };
}

const ORDEM_DOS_MOTIVOS: readonly (keyof ErrosDeEdicao)[] = ["titulo", "valor", "moeda", "probabilidade", "dataPrevistaFechamento", "geral"];

function motivoParaNaoSalvar(montado: ResultadoDaEdicao): string | undefined {
  if (montado.ok) return Object.keys(montado.edicao).length === 0 ? NADA_PARA_SALVAR : undefined;
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
        <TextInput id={id} value={valor} onChange={onChange} invalid={erro !== undefined} required={required} {...(placeholder ? { placeholder } : {})} />
      )}
    </Field>
  );
}

/** "Editar Negócio": os escalares. O dono, a Etapa, o Funil e o encerramento ficam nas seções próprias. */
function DialogoDeEdicao({ negocio, onFechar, agir }: { readonly negocio: Negocio; readonly onFechar: () => void; readonly agir: Agir }) {
  const [valores, setValores] = useState<ValoresDeEdicao>(() => valoresDeEdicao(negocio));
  const [salvando, setSalvando] = useState(false);

  const montado = montarEdicaoDeNegocio(negocio, valores);
  const erros: ErrosDeEdicao = montado.ok ? {} : montado.erros;
  const motivo = salvando ? "Gravando o Negócio…" : motivoParaNaoSalvar(montado);

  const salvar = async () => {
    if (!montado.ok || Object.keys(montado.edicao).length === 0) return;
    setSalvando(true);
    const deuCerto = await agir(() => editarNegocio(negocio.id, montado.edicao), "Alterações salvas.");
    setSalvando(false);
    if (deuCerto) onFechar();
  };

  const mudar = (parte: Partial<ValoresDeEdicao>) => setValores((atual) => ({ ...atual, ...parte }));

  return (
    <ConfirmDialog
      open
      wide
      title="Editar Negócio"
      description="O dono, a Etapa, o Funil e o encerramento ficam nas seções próprias, logo abaixo."
      confirmLabel="Salvar alterações"
      {...(motivo ? { confirmDisabledReason: motivo } : {})}
      onConfirm={() => void salvar()}
      onCancel={onFechar}
    >
      {erros.geral ? (
        <p role="alert" className="app-base mb-3 rounded-[var(--r-controle)] px-3 py-2" style={{ background: "var(--erro-lavado)", color: "var(--erro)" }}>
          {erros.geral}
        </p>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <CampoDeTexto rotulo="Título" valor={valores.titulo} onChange={(titulo) => mudar({ titulo })} erro={erros.titulo} required />
        </div>
        <CampoDeTexto rotulo="Objeto" valor={valores.objeto} onChange={(objeto) => mudar({ objeto })} placeholder="O que está sendo vendido" />
        <CampoDeTexto rotulo="Origem" valor={valores.origem} onChange={(origem) => mudar({ origem })} />
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
          {(id) => <SeletorDeProprietario id={id} valor={valores.proprietarioId} onChange={(proprietarioId) => mudar({ proprietarioId })} rotuloVazio={null} />}
        </Field>
        <div className="sm:col-span-2">
          <Field label="Descrição">{(id) => <TextArea id={id} value={valores.descricao} onChange={(descricao) => mudar({ descricao })} />}</Field>
        </div>
      </div>
    </ConfirmDialog>
  );
}

// ── Dono: Empresa OU Contato ────────────────────────────────────────────────

function SecaoDoDono({
  detalhado,
  podeEditar,
  motivo,
  agir,
}: {
  readonly detalhado: NegocioDetalhado;
  readonly podeEditar: boolean;
  readonly motivo: string | undefined;
  readonly agir: Agir;
}) {
  const { negocio, empresa, contato } = detalhado;
  const [trocando, setTrocando] = useState(false);
  const [tipo, setTipo] = useState<DonoDoNegocio>(empresa ? "empresa" : "contato");
  const [escolhido, setEscolhido] = useState<RegistroEscolhido | null>(null);
  const [salvando, setSalvando] = useState(false);
  const desligado = motivo ? { disabled: true, disabledReason: motivo } : {};

  const fecharTroca = () => {
    setTrocando(false);
    setEscolhido(null);
  };

  const salvar = async () => {
    if (escolhido === null) return;
    // Trocar o dono manda os dois: o novo e o outro como `null` (`negocios_dono_ck`).
    const edicao: EdicaoDeNegocio = tipo === "empresa" ? { empresaId: escolhido.id, contatoId: null } : { contatoId: escolhido.id, empresaId: null };
    const validacao = validarEdicao(negocio, edicao);
    if (!validacao.ok) return;
    setSalvando(true);
    const deuCerto = await agir(() => editarNegocio(negocio.id, edicao), "Alterações salvas.");
    setSalvando(false);
    if (deuCerto) fecharTroca();
  };

  const rotuloDaBusca = tipo === "empresa" ? "Buscar Empresa" : "Buscar Contato";
  const motivoParaNaoSalvarDono = salvando ? "Gravando o Negócio…" : escolhido === null ? (tipo === "empresa" ? "Escolha a Empresa." : "Escolha o Contato.") : undefined;

  const dono = empresa
    ? { rotulo: "Empresa", href: `/crm/empresas/${empresa.id}`, nome: empresa.nome, estado: empresa.estado }
    : contato
      ? { rotulo: "Contato", href: `/crm/contatos/${contato.id}`, nome: contato.nome, estado: contato.estado }
      : null;

  return (
    <Section
      title="Dono"
      action={
        podeEditar ? (
          <Button size="sm" onClick={() => (trocando ? fecharTroca() : setTrocando(true))} {...desligado}>
            {trocando ? "Cancelar" : "Trocar dono"}
          </Button>
        ) : undefined
      }
    >
      <Painel className="px-4 py-2">
        {dono ? (
          <>
            <p className="app-meta pt-1">{dono.rotulo}</p>
            <p className="flex items-center gap-2 py-1">
              <Link href={dono.href} className="app-base underline" style={{ color: "var(--texto)" }}>
                {dono.nome}
              </Link>
              {dono.estado !== "ativo" ? <StateSeal state={seloDoEstado(dono.estado)} /> : null}
            </p>
          </>
        ) : (
          <p className="app-base py-1">Este Negócio está sem dono.</p>
        )}
      </Painel>
      {trocando && podeEditar ? (
        <Painel className="mt-3 grid gap-3 p-4">
          <Segmentos
            rotulo="Tipo do dono"
            opcoes={[
              { valor: "empresa", rotulo: "Empresa" },
              { valor: "contato", rotulo: "Contato" },
            ]}
            valor={tipo}
            aoTrocar={(novo) => {
              setTipo(novo);
              setEscolhido(null);
            }}
          />
          <Field label={rotuloDaBusca}>
            {(id) =>
              tipo === "empresa" ? (
                <SeletorDeRegistro id={id} recurso="empresas" rotulo={rotuloDaBusca} valor={escolhido} onChange={setEscolhido} {...(empresa ? { excluirIds: [empresa.id] } : {})} />
              ) : (
                <SeletorDeRegistro id={id} recurso="contatos" rotulo={rotuloDaBusca} valor={escolhido} onChange={setEscolhido} {...(contato ? { excluirIds: [contato.id] } : {})} />
              )
            }
          </Field>
          <div>
            <Button
              variant="primary"
              onClick={() => void salvar()}
              {...(motivoParaNaoSalvarDono ? { disabled: true, disabledReason: motivoParaNaoSalvarDono } : {})}
            >
              Salvar dono
            </Button>
          </div>
        </Painel>
      ) : null}
    </Section>
  );
}

// ── Etapa e Funil (POST …/mover) ────────────────────────────────────────────

function SecaoDeEtapa({
  detalhado,
  podeMover,
  motivo,
  agir,
  recusar,
}: {
  readonly detalhado: NegocioDetalhado;
  /** Negócio `aberto` e `ativo` (RN-NEG-04/16): fora disso a Etapa só se lê. */
  readonly podeMover: boolean;
  readonly motivo: string | undefined;
  readonly agir: Agir;
  /** Uma recusa do domínio, antes da api, no mesmo lugar das recusas da api. */
  readonly recusar: (frase: string) => void;
}) {
  const { negocio, funil, etapa } = detalhado;
  const etapas = [...detalhado.etapasDoFunil].sort((a, b) => a.ordem - b.ordem);
  const [mudandoFunil, setMudandoFunil] = useState(false);
  const [funilDestinoId, setFunilDestinoId] = useState("");
  const [etapaDestinoId, setEtapaDestinoId] = useState("");
  const [movendo, setMovendo] = useState(false);
  const desligado = motivo ? { disabled: true, disabledReason: motivo } : {};

  // Fechado, nada vai à api; aberto, os Funis ativos (menos este) e as Etapas do escolhido.
  const funis = useFunis(FUNIS_ATIVOS, { pausado: !mudandoFunil });
  const funilDestino = useFunil(mudandoFunil && funilDestinoId !== "" ? funilDestinoId : undefined);
  const destinos = (funis.data?.itens ?? []).filter((item) => item.funil.estado === "ativo" && item.funil.id !== funil.id);
  const etapasDoDestino = funilDestino.data?.funil.id === funilDestinoId ? [...funilDestino.data.etapas].sort((a, b) => a.ordem - b.ordem) : [];

  const fecharTrocaDeFunil = () => {
    setMudandoFunil(false);
    setFunilDestinoId("");
    setEtapaDestinoId("");
  };

  /** Trocar a Etapa dentro do Funil: a mesma `validarMovimento` do serviço, e depois `POST …/mover`. */
  const moverParaEtapa = async (etapaId: string) => {
    if (etapaId === negocio.etapaId) return;
    const validacao = validarMovimento({ negocio, funilDestino: { id: funil.id, estado: funil.estado }, etapaDestino: { id: etapaId, funilId: funil.id } });
    if (!validacao.ok) {
      recusar(validacao.error);
      return;
    }
    setMovendo(true);
    await agir(() => moverNegocio(negocio.id, { etapaId }));
    setMovendo(false);
  };

  // Trocar de Funil exige a Etapa do Funil novo (RN-FUN-15): sem ela, o botão diz o porquê.
  const validacaoDaTroca =
    funilDestinoId === ""
      ? { ok: false as const, error: "Escolha o Funil de destino." }
      : validarMovimento({
          negocio,
          funilDestino: { id: funilDestinoId, estado: "ativo" },
          ...(etapaDestinoId !== "" ? { etapaDestino: { id: etapaDestinoId, funilId: funilDestinoId } } : {}),
        });
  const motivoParaNaoTrocar = movendo ? "Movendo o Negócio…" : (motivo ?? (validacaoDaTroca.ok ? undefined : validacaoDaTroca.error));

  const moverParaFunil = async () => {
    if (!validacaoDaTroca.ok) return;
    setMovendo(true);
    const deuCerto = await agir(() => moverNegocio(negocio.id, { funilId: funilDestinoId, etapaId: etapaDestinoId }));
    setMovendo(false);
    if (deuCerto) fecharTrocaDeFunil();
  };

  return (
    <Section
      title="Etapa"
      action={
        podeMover ? (
          <Button size="sm" onClick={() => (mudandoFunil ? fecharTrocaDeFunil() : setMudandoFunil(true))} {...desligado}>
            {mudandoFunil ? "Cancelar" : "Mudar de Funil"}
          </Button>
        ) : undefined
      }
    >
      <Painel className="p-4">
        {podeMover ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Funil">{(id) => <p id={id} className="app-base py-2">{funil.nome}</p>}</Field>
            <Field label="Etapa">
              {(id) => (
                <Select
                  id={id}
                  value={negocio.etapaId}
                  options={etapas.map((item) => ({ value: item.id, label: item.nome }))}
                  onChange={(etapaId) => void moverParaEtapa(etapaId)}
                  disabled={motivo !== undefined || movendo}
                  {...(motivo ? { disabledReason: motivo } : movendo ? { disabledReason: "Movendo o Negócio…" } : {})}
                />
              )}
            </Field>
          </div>
        ) : (
          <dl>
            <LinhaDeDado rotulo="Funil">{funil.nome}</LinhaDeDado>
            <LinhaDeDado rotulo={negocio.situacao === "aberto" ? "Etapa" : "Última Etapa"}>{etapa.nome}</LinhaDeDado>
          </dl>
        )}
      </Painel>
      {mudandoFunil && podeMover ? (
        <Painel className="mt-3 grid gap-3 p-4 sm:grid-cols-2">
          <Field label="Funil de destino" required hint="O Negócio sai deste Funil e entra na Etapa escolhida do outro.">
            {(id) => (
              <Select
                id={id}
                value={funilDestinoId}
                placeholder={funis.data === undefined && !funis.error ? "Carregando…" : "Escolher o Funil"}
                options={destinos.map((item) => ({ value: item.funil.id, label: item.funil.nome, ...(item.funil.padrao ? { detail: "padrão" } : {}) }))}
                onChange={(valor) => {
                  setFunilDestinoId(valor);
                  setEtapaDestinoId("");
                }}
              />
            )}
          </Field>
          <Field label="Etapa de destino" required>
            {(id) => (
              <Select
                id={id}
                value={etapaDestinoId}
                placeholder="Escolher a Etapa"
                options={etapasDoDestino.map((item) => ({ value: item.id, label: item.nome, detail: `${item.probabilidadePadrao}%` }))}
                onChange={setEtapaDestinoId}
                disabled={funilDestinoId === "" || etapasDoDestino.length === 0}
                disabledReason={funilDestinoId === "" ? "Escolha o Funil de destino antes." : "Carregando as Etapas…"}
              />
            )}
          </Field>
          <div className="sm:col-span-2">
            <Button variant="primary" onClick={() => void moverParaFunil()} {...(motivoParaNaoTrocar ? { disabled: true, disabledReason: motivoParaNaoTrocar } : {})}>
              Mover para o Funil
            </Button>
          </div>
        </Painel>
      ) : null}
    </Section>
  );
}

// ── Encerramento ────────────────────────────────────────────────────────────

function SecaoDeEncerramento({
  detalhado,
  ativo,
  semGanhar,
  semPerder,
  semReabrir,
  abrir,
}: {
  readonly detalhado: NegocioDetalhado;
  readonly ativo: boolean;
  readonly semGanhar: string | undefined;
  readonly semPerder: string | undefined;
  readonly semReabrir: string | undefined;
  readonly abrir: (modo: ModoDeEncerramento) => void;
}) {
  const fmt = useFormat();
  const { negocio } = detalhado;
  const desligado = (frase: string | undefined) => (frase ? { disabled: true, disabledReason: frase } : {});

  if (negocio.situacao === "aberto") {
    return (
      <Section title="Encerramento">
        <Painel className="flex flex-wrap items-center justify-between gap-3 p-4">
          <p className="app-base">Este Negócio está aberto.</p>
          {ativo ? (
            <span className="flex items-center gap-2">
              <Button variant="primary" onClick={() => abrir("ganhar")} {...desligado(semGanhar)}>
                Marcar como ganho
              </Button>
              <Button onClick={() => abrir("perder")} {...desligado(semPerder)}>
                Marcar como perdido
              </Button>
            </span>
          ) : null}
        </Painel>
      </Section>
    );
  }

  const motivo = negocio.situacao === "ganho" ? negocio.motivoGanho : negocio.motivoPerda;
  return (
    <Section
      title="Encerramento"
      action={
        ativo ? (
          <Button size="sm" onClick={() => abrir("reabrir")} {...desligado(semReabrir)}>
            Reabrir
          </Button>
        ) : undefined
      }
    >
      <Painel className="p-4">
        <dl>
          <LinhaDeDado rotulo={negocio.situacao === "ganho" ? "Motivo do ganho" : "Motivo da perda"}>{motivo ?? "—"}</LinhaDeDado>
          <LinhaDeDado rotulo="Nota de encerramento">{negocio.notaEncerramento ?? "—"}</LinhaDeDado>
          <LinhaDeDado rotulo="Encerrado em">{negocio.encerradoEm ? fmt.instant(negocio.encerradoEm) : "—"}</LinhaDeDado>
        </dl>
      </Painel>
    </Section>
  );
}

// ── A ficha ─────────────────────────────────────────────────────────────────

export function FichaDeNegocio({ negocioId, detalhado }: { readonly negocioId: string; readonly detalhado: NegocioDetalhado }) {
  const { negocio, funil, etapa } = detalhado;
  const router = useRouter();
  const pathname = usePathname();
  const fmt = useFormat();
  const nomeDoMembro = useNomeDoMembro();
  const [editando, setEditando] = useState(false);
  const [dialogo, setDialogo] = useState<ModoDeEncerramento | null>(null);
  // "Criar e abrir": o Toast "Negócio criado." viaja com a navegação e esta ficha o acende ao chegar.
  const [aviso, setAviso] = useState<string | null>(() => lerChegada(pathname));
  const [recusa, setRecusa] = useState<ErroDeApi | Error | null>(null);
  useEffect(() => {
    consumirChegada(pathname);
  }, [pathname]);

  // D-14: o que o Papel não alcança fica desligado com o motivo; quem barra de verdade é o backend.
  const semEditar = usePodeNoCrm("editar", "negocio");
  const semMover = usePodeNoCrm("mover", "negocio");
  const semGanhar = usePodeNoCrm("ganhar", "negocio");
  const semPerder = usePodeNoCrm("perder", "negocio");
  const semReabrir = usePodeNoCrm("reabrir", "negocio", { situacao: negocio.situacao });

  const ativo = negocio.estado === "ativo";
  const aberto = negocio.situacao === "aberto";
  const pilula = PILULA_DA_SITUACAO[negocio.situacao];
  const probabilidade = probabilidadeEfetiva(negocio, etapa);
  const ajustada = aberto && negocio.probabilidade !== null;

  const agir: Agir = async (acao, sucesso, aoRecusar) => {
    setRecusa(null);
    setAviso(null);
    try {
      await acao();
      if (sucesso) setAviso(sucesso);
      return true;
    } catch (falha) {
      const erro = comoErroDeApi(falha, "Não foi possível concluir a ação. Tente de novo.");
      if (!aoRecusar?.(erro)) setRecusa(erro);
      return false;
    }
  };

  const concluirDialogo = (modo: ModoDeEncerramento) => {
    setDialogo(null);
    setRecusa(null);
    setAviso(AVISO_DO_MODO[modo]);
  };

  const desligado = semEditar ? { disabled: true, disabledReason: semEditar } : {};

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        path={
          <>
            <Link href="/crm/negocios" className="hover:underline">
              Negócios
            </Link>
            {" › "}
            <Link href={`/crm/funis/${funil.id}`} className="hover:underline">
              {funil.nome}
            </Link>
          </>
        }
        title={negocio.titulo}
        seal={
          <>
            <StateSeal state={seloDoEstado(negocio.estado)} />
            <Pilula cor={pilula.cor}>{pilula.rotulo}</Pilula>
          </>
        }
        meta={`${funil.nome} · ${etapa.nome}`}
        actions={
          <AcoesDeCicloDeVida
            estado={negocio.estado}
            rotulo={negocio.titulo}
            motivoSemPermissao={semEditar}
            onArquivar={() => void agir(() => arquivarNegocio(negocioId), `${negocio.titulo} arquivado.`)}
            onRestaurar={() => void agir(() => restaurarNegocio(negocioId), `${negocio.titulo} restaurado.`)}
            onEnviarParaLixeira={() => void agir(() => enviarNegocioParaLixeira(negocioId), `${negocio.titulo} foi para a Lixeira.`)}
            onExcluirPermanentemente={async () => {
              if (await agir(() => excluirNegocioPermanentemente(negocioId))) router.push("/crm/negocios");
            }}
          />
        }
      />

      <CorpoDeTela>
        {aviso ? (
          <Toast tone="success" onDismiss={() => setAviso(null)}>
            {aviso}
          </Toast>
        ) : null}
        <MensagemDeRecusa erro={recusa} onFechar={() => setRecusa(null)} />

        {dialogo ? (
          <DialogoDeEncerramento
            modo={dialogo}
            negocio={{ id: negocio.id, titulo: negocio.titulo, valor: negocio.valor, situacao: negocio.situacao, estado: negocio.estado }}
            funil={{ estado: funil.estado, exigeMotivoPerda: funil.exigeMotivoPerda, exigeValorGanho: funil.exigeValorGanho }}
            etapas={[...detalhado.etapasDoFunil].sort((a, b) => a.ordem - b.ordem).map((item) => ({ id: item.id, nome: item.nome }))}
            onClose={() => setDialogo(null)}
            onConcluido={() => concluirDialogo(dialogo)}
          />
        ) : null}

        <Section
          title="Dados"
          action={
            ativo ? (
              <Button size="sm" onClick={() => setEditando(true)} {...desligado}>
                Editar
              </Button>
            ) : undefined
          }
        >
          <Painel className="p-4">
            <dl>
              <LinhaDeDado rotulo="Título">{negocio.titulo}</LinhaDeDado>
              <LinhaDeDado rotulo="Objeto">{negocio.objeto ?? "—"}</LinhaDeDado>
              <LinhaDeDado rotulo="Valor">
                <span className="app-numero">{negocio.valor === null ? "sem valor declarado" : fmt.money({ amount: Number(negocio.valor), currency: negocio.moeda })}</span>
              </LinhaDeDado>
              <LinhaDeDado rotulo="Probabilidade">
                <span className="app-numero">{probabilidade}%</span>
                {ajustada ? (
                  <Pilula tom="info" className="ml-2">
                    ajustada
                  </Pilula>
                ) : null}
              </LinhaDeDado>
              <LinhaDeDado rotulo="Data prevista de fechamento">{negocio.dataPrevistaFechamento ? fmt.civilDate(negocio.dataPrevistaFechamento) : "—"}</LinhaDeDado>
              <LinhaDeDado rotulo="Origem">{negocio.origem ?? "—"}</LinhaDeDado>
              <LinhaDeDado rotulo="Proprietário">{nomeDoMembro(negocio.proprietarioId)}</LinhaDeDado>
              <LinhaDeDado rotulo="Descrição">{negocio.descricao ?? "—"}</LinhaDeDado>
            </dl>
          </Painel>
        </Section>
        {editando ? <DialogoDeEdicao negocio={negocio} onFechar={() => setEditando(false)} agir={agir} /> : null}

        <SecaoDoDono detalhado={detalhado} podeEditar={ativo} motivo={semEditar} agir={agir} />
        <SecaoDeEtapa
          key={`etapa-${negocio.funilId}-${negocio.etapaId}`}
          detalhado={detalhado}
          podeMover={ativo && aberto}
          motivo={semMover}
          agir={agir}
          recusar={(frase) => setRecusa(new Error(frase))}
        />
        <SecaoDeEncerramento detalhado={detalhado} ativo={ativo} semGanhar={semGanhar} semPerder={semPerder} semReabrir={semReabrir} abrir={setDialogo} />
      </CorpoDeTela>
    </div>
  );
}
