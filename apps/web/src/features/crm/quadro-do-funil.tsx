"use client";

/**
 * O QUADRO DO FUNIL (UI-SPEC §4, D-05): o kanban de Negócios de `/crm/negocios`
 * lido e gravado só pela api (D-04). Uma `ColunaDeQuadro` por Etapa do Funil
 * (`GET /funis/:id`, na `ordem`, inclusive vazias), os Negócios `aberto` de
 * `GET /negocios?funilId=…&estado=ativo` nas colunas da Etapa deles, e os
 * `ganho`/`perdido` na faixa "Negócios encerrados" — ganho e perdido NÃO são
 * colunas (B58): são uma situação que o Negócio carrega na última Etapa.
 *
 * Arrastar é mover. Ao soltar, o cartão muda de coluna NA HORA — `mutate`
 * otimista da chave da lista, sem revalidar — e `POST /negocios/:id/mover`
 * sai em seguida; no sucesso quem revalida é a própria mutação
 * (`invalidarCrm("/negocios")`), e uma recusa (409 `NEGOCIO_ENCERRADO`,
 * `FUNIL_INATIVO`, 403…) revalida a chave — o cartão VOLTA — e mostra a frase
 * por `MensagemDeRecusa`. A posição otimista é só de tela; o servidor é a
 * fonte da verdade (T-07-32). Mover não dá Toast de sucesso: o cartão mudar de
 * coluna já é o feedback.
 *
 * O menu do cartão traz, além de Abrir, Ganhar e Perder, um "Mover para
 * {Etapa}" por Etapa de destino: a alternativa a arrastar para teclado e toque
 * (WCAG 2.5.7), pelo mesmo `moverNegocio`. Ganhar, Perder e Reabrir abrem o
 * `DialogoDeEncerramento`, que aplica as Regras do Funil antes do envio.
 *
 * D-14 na tela: o que `usePodeNoCrm` recusa some — um Convidado não arrasta,
 * o menu dele só tem Abrir, e Reabrir um `ganho` fica desligado com o motivo
 * para quem não administra. Quem barra de verdade é o backend.
 *
 * O quadro de Status das Listas conversacionais é OUTRO arquivo
 * (`features/estrutura/quadro-negocios.tsx`, modelo de Tarefas) e não muda.
 */

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { LIMITES_CRM } from "@n1/dominio/crm/comum";
import type { FunilDetalhado } from "@n1/dominio/crm/funis";
import { valorPonderado, type NegocioResumo } from "@n1/dominio/crm/negocios";
import type { ErroDeApi } from "@/dados/crm/cliente-crm";
import { useFunil } from "@/dados/crm/funis";
import { moverNegocio, useNegocios, type FiltroDeNegocios } from "@/dados/crm/negocios";
import { usePodeNoCrm } from "@/dados/crm/sessao";
import { CartaoDeNegocio, type AcaoDoCartao } from "@/features/crm/cartao-de-negocio";
import { MensagemDeRecusa } from "@/features/crm/ciclo-de-vida";
import { DialogoDeEncerramento, type ModoDeEncerramento } from "@/features/crm/dialogo-de-encerramento";
import { comoErroDeApi } from "@/features/crm/formulario-de-contato";
import { ColunaDeQuadro, VazioDaColuna } from "@/features/shell/quadro";
import { Button, EmptyState, EsqueletoDeLinhas, Pilula, RolagemNoTopo, Section, Toast } from "@/features/shell/ui";
import { useFormat } from "@/features/shell/use-format";

/** A coluna carrega até 200 Negócios por Funil (UI-SPEC §9); acima disso, o rodapé diz "Mostrando 200 de N". */
export const NEGOCIOS_POR_FUNIL = LIMITES_CRM.paginaMaxima;

/** O Toast de sucesso de cada encerramento (UI-SPEC, "Mensagens de sucesso"). */
const AVISO_DO_MODO: Record<ModoDeEncerramento, string> = {
  ganhar: "Negócio marcado como ganho.",
  perder: "Negócio marcado como perdido.",
  reabrir: "Negócio reaberto.",
};

/** A situação do Negócio encerrado no vocabulário de cor do sistema: `perdido` não é vermelho. */
const PILULA_DA_SITUACAO: Record<string, { readonly rotulo: string; readonly cor: string }> = {
  ganho: { rotulo: "Ganho", cor: "var(--cor-neg-ganho)" },
  perdido: { rotulo: "Perdido", cor: "var(--cor-neg-perdido)" },
};

/** Os totais do quadro são somados em BRL, a moeda padrão dos Negócios (`moeda char(3) default 'BRL'`). */
const MOEDA_DOS_TOTAIS = "BRL";

export interface TotaisDoQuadro {
  readonly abertos: number;
  /** A soma do `valor` dos abertos. */
  readonly declarado: number;
  /** A soma de `valorPonderado(valor, probabilidadeEfetiva)` dos abertos. */
  readonly ponderado: number;
}

/** Em centavos até o fim: somar `Number("0.10")` dez vezes não dá 1. */
function centavos(valor: string | null): number {
  return valor === null ? 0 : Math.round(Number(valor) * 100);
}

/** O que o cabeçalho de `/crm/negocios` mostra: só os `aberto` contam. */
export function totaisDoQuadro(itens: ReadonlyArray<NegocioResumo>): TotaisDoQuadro {
  let abertos = 0;
  let declarado = 0;
  let ponderado = 0;
  for (const negocio of itens) {
    if (negocio.situacao !== "aberto") continue;
    abertos += 1;
    declarado += centavos(negocio.valor);
    ponderado += Math.round(valorPonderado(negocio.valor, negocio.probabilidadeEfetiva) * 100);
  }
  return { abertos, declarado: declarado / 100, ponderado: ponderado / 100 };
}

/**
 * A lista do quadro: os Negócios `ativo` do Funil, até 200. A página e o quadro
 * chamam com o MESMO filtro (a chave é a mesma; o SWR busca uma vez), e sem
 * Funil (`undefined`) nada vai à api.
 */
export function useNegociosDoQuadro(funilId: string | undefined) {
  const filtro: FiltroDeNegocios = { estado: "ativo", limite: NEGOCIOS_POR_FUNIL, ...(funilId !== undefined ? { funilId } : {}) };
  return useNegocios(filtro, { pausado: funilId === undefined });
}

/** `keepPreviousData`: ao trocar de Funil a lista ainda pode ser a do anterior; só o que é deste Funil entra no quadro. */
export function negociosDoFunil(itens: ReadonlyArray<NegocioResumo> | undefined, funilId: string): NegocioResumo[] {
  return (itens ?? []).filter((negocio) => negocio.funilId === funilId);
}

type EtapaDoQuadro = FunilDetalhado["etapas"][number];

function etapasNaOrdem(etapas: ReadonlyArray<EtapaDoQuadro> | undefined): EtapaDoQuadro[] {
  return [...(etapas ?? [])].sort((a, b) => a.ordem - b.ordem);
}

interface DialogoAberto {
  readonly modo: ModoDeEncerramento;
  readonly negocio: NegocioResumo;
}

export function QuadroDoFunil({
  funilId,
  onNovo,
}: {
  readonly funilId: string;
  /** O "+" das colunas vazias: abre o Novo Negócio. */
  readonly onNovo: () => void;
}) {
  const router = useRouter();
  const fmt = useFormat();
  const funil = useFunil(funilId);
  const lista = useNegociosDoQuadro(funilId);

  const [arrastando, setArrastando] = useState<string | null>(null);
  /** O cartão que acabou de mudar de coluna: acende (`data-recente`) até o próximo arrasto. */
  const [recente, setRecente] = useState<string | null>(null);
  const [recusa, setRecusa] = useState<ErroDeApi | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [dialogo, setDialogo] = useState<DialogoAberto | null>(null);
  const [mostrarEncerrados, setMostrarEncerrados] = useState(false);

  // D-14: o que o Papel não alcança some do quadro; o backend é quem barra.
  const semCriar = usePodeNoCrm("criar", "negocio");
  const semMover = usePodeNoCrm("mover", "negocio");
  const semGanhar = usePodeNoCrm("ganhar", "negocio");
  const semPerder = usePodeNoCrm("perder", "negocio");
  const semReabrirGanho = usePodeNoCrm("reabrir", "negocio", { situacao: "ganho" });
  const semReabrirPerdido = usePodeNoCrm("reabrir", "negocio", { situacao: "perdido" });

  const detalhado = funil.data?.funil.id === funilId ? funil.data : undefined;
  const erro = funil.error ?? lista.error;
  if (!detalhado || lista.data === undefined) {
    if (erro) {
      return <EmptyState title="Não foi possível carregar o quadro." hint={comoErroDeApi(erro, "Tente de novo em instantes.").message} />;
    }
    return <EsqueletoDeLinhas quantidade={6} />;
  }

  const pagina = lista.data;
  const etapas = etapasNaOrdem(detalhado.etapas);
  const negocios = negociosDoFunil(pagina.itens, funilId);
  const abertos = negocios.filter((negocio) => negocio.situacao === "aberto");
  const encerrados = negocios.filter((negocio) => negocio.situacao !== "aberto");
  // UI-SPEC §9: até 200 por Funil; acima disso cada coluna avisa no rodapé.
  const rodapeDaColuna = pagina.total > pagina.itens.length ? `Mostrando ${pagina.itens.length} de ${pagina.total}` : undefined;

  /**
   * D-05: o cartão vai para a Etapa nova na hora e `POST …/mover` sai em
   * seguida; a recusa revalida a chave (o cartão volta) e mostra a frase.
   * Mover zera a probabilidade própria no servidor (RN-NEG-04): na tela, a
   * efetiva vira a padrão da Etapa de destino até a revalidação confirmar.
   */
  const mover = async (negocio: NegocioResumo, etapaId: string) => {
    if (negocio.etapaId === etapaId) return;
    const destino = etapas.find((etapa) => etapa.id === etapaId);
    if (!destino) return;
    setRecusa(null);
    const atual = lista.data;
    if (atual) {
      const otimista = {
        ...atual,
        itens: atual.itens.map((item) =>
          item.id === negocio.id ? { ...item, etapaId, probabilidadeEfetiva: destino.probabilidadePadrao } : item,
        ),
      };
      void lista.mutate(otimista, { revalidate: false });
    }
    setRecente(negocio.id);
    try {
      await moverNegocio(negocio.id, { etapaId });
    } catch (falha) {
      setRecusa(comoErroDeApi(falha, "Não foi possível mover o Negócio. Tente de novo."));
      setRecente(null);
      await lista.mutate();
    }
  };

  const soltar = (etapaId: string) => {
    const id = arrastando;
    setArrastando(null);
    if (id === null) return;
    const negocio = abertos.find((item) => item.id === id);
    if (negocio) void mover(negocio, etapaId);
  };

  const hrefDe = (negocio: NegocioResumo) => `/crm/negocios/${negocio.id}`;

  /** Abrir, Ganhar, Perder e "Mover para …" (todas as Etapas menos a atual): só o que o Papel alcança. */
  const acoesDe = (negocio: NegocioResumo): AcaoDoCartao[] => {
    const acoes: AcaoDoCartao[] = [{ label: "Abrir", onSelect: () => router.push(hrefDe(negocio)) }];
    if (semGanhar === undefined) acoes.push({ label: "Ganhar", onSelect: () => setDialogo({ modo: "ganhar", negocio }) });
    if (semPerder === undefined) acoes.push({ label: "Perder", destructive: true, onSelect: () => setDialogo({ modo: "perder", negocio }) });
    if (semMover === undefined) {
      for (const etapa of etapas) {
        if (etapa.id === negocio.etapaId) continue;
        acoes.push({ label: `Mover para ${etapa.nome}`, onSelect: () => void mover(negocio, etapa.id) });
      }
    }
    return acoes;
  };

  const concluirDialogo = (modo: ModoDeEncerramento) => {
    setDialogo(null);
    setRecusa(null);
    setAviso(AVISO_DO_MODO[modo]);
  };

  return (
    <>
      <MensagemDeRecusa erro={recusa} onFechar={() => setRecusa(null)} />
      {aviso ? (
        <Toast tone="success" onDismiss={() => setAviso(null)}>
          {aviso}
        </Toast>
      ) : null}

      {dialogo ? (
        <DialogoDeEncerramento
          modo={dialogo.modo}
          negocio={{
            id: dialogo.negocio.id,
            titulo: dialogo.negocio.titulo,
            valor: dialogo.negocio.valor,
            situacao: dialogo.negocio.situacao,
            estado: dialogo.negocio.estado,
          }}
          funil={{
            estado: detalhado.funil.estado,
            exigeMotivoPerda: detalhado.funil.exigeMotivoPerda,
            exigeValorGanho: detalhado.funil.exigeValorGanho,
          }}
          etapas={etapas.map((etapa) => ({ id: etapa.id, nome: etapa.nome }))}
          onClose={() => setDialogo(null)}
          onConcluido={() => concluirDialogo(dialogo.modo)}
        />
      ) : null}

      {/*
        As Etapas aparecem mesmo sem Negócio: um Funil recém-criado é feito
        das colunas, e escondê-las faria ele parecer vazio de configuração,
        não só de Negócios. Cada coluna já diz "Nenhum Negócio nesta Etapa"
        e oferece o "+" a quem pode criar.
      */}
      {etapas.length === 0 ? (
        <EmptyState
          title={`${detalhado.funil.nome} não tem Etapa.`}
          hint="Um Negócio só existe dentro de uma Etapa: configure o Funil antes de criar."
          action={
            <Link href={`/crm/funis/${funilId}`} className="btn btn-contorno btn-sm">
              Abrir o Funil
            </Link>
          }
        />
      ) : (
        <RolagemNoTopo>
          <div className="flex gap-4">
            {etapas.map((etapa) => {
              const coluna = abertos.filter((negocio) => negocio.etapaId === etapa.id);
              const valorDaColuna = coluna.reduce((soma, negocio) => soma + centavos(negocio.valor), 0) / 100;
              return (
                <ColunaDeQuadro
                  key={etapa.id}
                  contagem={coluna.length}
                  nome={etapa.nome}
                  {...(etapa.cor ? { cor: etapa.cor } : {})}
                  onDrop={() => soltar(etapa.id)}
                  subtitulo={`${etapa.probabilidadePadrao}% padrão · ${fmt.money({ amount: valorDaColuna, currency: MOEDA_DOS_TOTAIS })}`}
                  {...(rodapeDaColuna ? { rodape: rodapeDaColuna } : {})}
                >
                  {coluna.length === 0 ? (
                    <VazioDaColuna texto="Nenhum Negócio nesta Etapa." {...(semCriar === undefined ? { onCriar: onNovo } : {})} />
                  ) : (
                    coluna.map((negocio) => (
                      // Cartão em arraste a 60% (UI-SPEC §4): a coluna de destino não ganha cor nova.
                      <div key={negocio.id} style={arrastando === negocio.id ? { opacity: 0.6 } : undefined}>
                        <CartaoDeNegocio
                          negocio={negocio}
                          href={hrefDe(negocio)}
                          recente={negocio.id === recente}
                          arrastavel={semMover === undefined}
                          onDragStart={() => {
                            setRecente(null);
                            setArrastando(negocio.id);
                          }}
                          onDragEnd={() => setArrastando(null)}
                          acoes={acoesDe(negocio)}
                        />
                      </div>
                    ))
                  )}
                </ColunaDeQuadro>
              );
            })}
          </div>
        </RolagemNoTopo>
      )}

      <div className="mt-6">
        <Section
          title="Negócios encerrados"
          count={encerrados.length}
          action={
            encerrados.length > 0 ? (
              <Button variant="ghost" size="sm" onClick={() => setMostrarEncerrados((valor) => !valor)}>
                {mostrarEncerrados ? "Ocultar encerrados" : "Mostrar encerrados"}
              </Button>
            ) : null
          }
        >
          {encerrados.length === 0 ? (
            <EmptyState compact title="Nenhum Negócio ganho ou perdido neste Funil." />
          ) : mostrarEncerrados ? (
            <ul className="grade-solta sm:grid-cols-2 lg:grid-cols-3">
              {encerrados.map((negocio) => {
                const etapa = etapas.find((item) => item.id === negocio.etapaId);
                const pilula = PILULA_DA_SITUACAO[negocio.situacao];
                const semReabrir = negocio.situacao === "ganho" ? semReabrirGanho : semReabrirPerdido;
                return (
                  <li key={negocio.id} className="relative">
                    {/* Encerrado é peça atenuada: continua peça, só não disputa atenção com o que está aberto. */}
                    <Link href={hrefDe(negocio)} className="item-solto" data-bloco="true" data-atenuado="true">
                      <p className="flex items-start justify-between gap-2 pr-20">
                        <span className="app-md min-w-0 truncate" style={{ color: "var(--texto)" }} title={negocio.titulo}>
                          {negocio.titulo}
                        </span>
                        {pilula ? (
                          <Pilula cor={pilula.cor} className="shrink-0">
                            {pilula.rotulo}
                          </Pilula>
                        ) : null}
                      </p>
                      <p className="app-meta mt-1">
                        Última Etapa: {etapa?.nome ?? "—"}
                        {negocio.valor !== null ? ` · ${fmt.money({ amount: Number(negocio.valor), currency: negocio.moeda })}` : ""}
                      </p>
                    </Link>
                    {/* Fora do link: um botão dentro de `<a>` não é HTML válido. */}
                    <div className="absolute right-2 top-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={semReabrir !== undefined}
                        {...(semReabrir !== undefined ? { disabledReason: semReabrir } : {})}
                        onClick={() => setDialogo({ modo: "reabrir", negocio })}
                      >
                        Reabrir
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="app-meta">Preservam a última Etapa que ocuparam e não aparecem nas colunas.</p>
          )}
        </Section>
      </div>
    </>
  );
}
