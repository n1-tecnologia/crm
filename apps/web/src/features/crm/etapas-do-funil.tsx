"use client";

/**
 * O editor de Etapas da ficha de Funil (D-04): uma linha por Etapa na `ordem`,
 * com nome e probabilidade editáveis no lugar, as contagens de Negócios por
 * situação, subir/descer e Remover, mais "Adicionar Etapa" no fim.
 *
 * Doutrina:
 *   - reordenar manda a permutação COMPLETA das Etapas (a api recusa uma parcial
 *     e grava tudo num comando só);
 *   - Remover uma Etapa com Negócios não chama o DELETE: abre o remapeamento
 *     (`?remapear-etapa=`, D-07). Se a api recusar mesmo assim (corrida), a
 *     recusa traz o botão "Remapear Negócios";
 *   - as frases de nome e probabilidade são as do domínio, as mesmas que a api
 *     aplica, e caem no campo antes de qualquer ida ao servidor;
 *   - Requisitos de Etapa e Transições permitidas não aparecem (D-02): a 007
 *     não os guarda.
 *
 * Sem permissão (D-14) ou com o Funil fora de `ativo`, a lista é só leitura e
 * os botões ficam desabilitados com o motivo — quem barra de verdade é a api.
 */

import { useId, useState } from "react";
import {
  LIMITE_DE_ETAPAS_POR_FUNIL,
  validarNomeDeEtapa,
  validarProbabilidadeDeEtapa,
  validarRemocaoDeEtapa,
  type EtapaDetalhada,
  type FunilDetalhado,
} from "@n1/dominio/crm/funis";
import type { ErroDeApi } from "@/dados/crm/cliente-crm";
import { adicionarEtapa, editarEtapa, removerEtapa, reordenarEtapas } from "@/dados/crm/funis";
import { MensagemDeRecusa } from "@/features/crm/ciclo-de-vida";
import { comoErroDeApi } from "@/features/crm/formulario-de-contato";
import { Button, CabecalhoDePainel, Field, Painel, SetaDeOrdem, TextInput } from "@/features/shell/ui";

type Agir = (acao: () => Promise<unknown>, sucesso?: string) => Promise<boolean>;

/** `{abertos} abertos · {ganhos} ganhos · {perdidos} perdidos`, e os extras só quando passam de zero. */
function contagens(etapa: EtapaDetalhada): string {
  const { abertos, ganhos, perdidos, arquivados, naLixeira } = etapa.negocios;
  const partes = [`${abertos} abertos`, `${ganhos} ganhos`, `${perdidos} perdidos`];
  if (arquivados > 0) partes.push(`${arquivados} arquivados`);
  if (naLixeira > 0) partes.push(`${naLixeira} na Lixeira`);
  return partes.join(" · ");
}

function LinhaDeEtapa({
  etapa,
  irmas,
  indice,
  total,
  podeEditar,
  motivo,
  agir,
  onMover,
  onRemover,
}: {
  readonly etapa: EtapaDetalhada;
  readonly irmas: readonly string[];
  readonly indice: number;
  readonly total: number;
  readonly podeEditar: boolean;
  readonly motivo: string | undefined;
  readonly agir: Agir;
  readonly onMover: (passo: -1 | 1) => void;
  readonly onRemover: () => void;
}) {
  const idDoNome = useId();
  const idDaProbabilidade = useId();
  const [nome, setNome] = useState(etapa.nome);
  const [probabilidade, setProbabilidade] = useState(String(etapa.probabilidadePadrao));
  const [erro, setErro] = useState<string | undefined>(undefined);

  const salvarNome = async () => {
    const novo = nome.trim();
    if (novo === etapa.nome) {
      setNome(etapa.nome);
      setErro(undefined);
      return;
    }
    const validacao = validarNomeDeEtapa(novo, irmas);
    if (!validacao.ok) {
      setErro(validacao.error);
      return;
    }
    setErro(undefined);
    await agir(() => editarEtapa(etapa.id, { nome: novo }));
  };

  const salvarProbabilidade = async () => {
    const texto = probabilidade.trim();
    if (texto === "" || Number(texto) === etapa.probabilidadePadrao) {
      setProbabilidade(String(etapa.probabilidadePadrao));
      setErro(undefined);
      return;
    }
    const valor = Number(texto);
    const validacao = validarProbabilidadeDeEtapa(valor);
    if (!validacao.ok) {
      setErro(validacao.error);
      return;
    }
    setErro(undefined);
    await agir(() => editarEtapa(etapa.id, { probabilidadePadrao: valor }));
  };

  const confirmarComEnter = (acao: () => Promise<void>) => (evento: React.KeyboardEvent<HTMLElement>) => {
    if (evento.key === "Enter") {
      evento.preventDefault();
      void acao();
    }
  };

  const motivoDeRemover = motivo ?? (validarRemocaoDeEtapa(total).ok ? undefined : "Um Funil precisa de ao menos uma Etapa.");

  return (
    <li className="item-solto" data-bloco="true" data-estatico="true">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {podeEditar ? (
          <span className="min-w-0 flex-1">
            <label htmlFor={idDoNome} className="sr-only">
              {`Nome da Etapa ${etapa.nome}`}
            </label>
            <span onBlur={() => void salvarNome()} onKeyDown={confirmarComEnter(salvarNome)}>
              <TextInput id={idDoNome} value={nome} onChange={setNome} invalid={erro !== undefined} size="sm" />
            </span>
          </span>
        ) : (
          <span className="app-md min-w-0 flex-1 truncate" style={{ color: "var(--texto)" }}>
            {etapa.nome}
          </span>
        )}
        <span className="flex shrink-0 items-center gap-3">
          {podeEditar ? (
            <span className="app-meta app-numero flex items-center gap-1">
              Probabilidade padrão
              <label htmlFor={idDaProbabilidade} className="sr-only">
                {`Probabilidade padrão da Etapa ${etapa.nome} (%)`}
              </label>
              <span onBlur={() => void salvarProbabilidade()} onKeyDown={confirmarComEnter(salvarProbabilidade)} className="w-20">
                <TextInput id={idDaProbabilidade} type="number" value={probabilidade} onChange={setProbabilidade} size="sm" />
              </span>
              %
            </span>
          ) : (
            <span className="app-meta app-numero">Probabilidade padrão {etapa.probabilidadePadrao}%</span>
          )}
          <SetaDeOrdem
            direcao="subir"
            motivo={motivo ?? (indice === 0 ? "Já é a primeira Etapa." : undefined)}
            onClick={() => onMover(-1)}
          />
          <SetaDeOrdem
            direcao="descer"
            motivo={motivo ?? (indice === total - 1 ? "Já é a última Etapa." : undefined)}
            onClick={() => onMover(1)}
          />
          <Button
            variant="danger"
            size="sm"
            onClick={onRemover}
            {...(motivoDeRemover ? { disabled: true, disabledReason: motivoDeRemover } : {})}
          >
            Remover
          </Button>
        </span>
      </div>
      {erro ? (
        <p role="alert" className="ajuda" data-erro="true">
          {erro}
        </p>
      ) : null}
      <p className="app-sm app-numero mt-2" style={{ color: "var(--texto-3)" }}>
        {contagens(etapa)}
      </p>
    </li>
  );
}

function FormularioDeNovaEtapa({
  funilId,
  existentes,
  agir,
  onFechar,
}: {
  readonly funilId: string;
  readonly existentes: readonly string[];
  readonly agir: Agir;
  readonly onFechar: () => void;
}) {
  const [nome, setNome] = useState("");
  const [probabilidade, setProbabilidade] = useState("");
  const [posicao, setPosicao] = useState("");
  const [erros, setErros] = useState<{ nome?: string; probabilidade?: string; posicao?: string }>({});

  const adicionar = async () => {
    const proximos: { nome?: string; probabilidade?: string; posicao?: string } = {};
    const validacaoDoNome = validarNomeDeEtapa(nome, existentes);
    if (!validacaoDoNome.ok) proximos.nome = validacaoDoNome.error;
    const textoDaProbabilidade = probabilidade.trim();
    const valorDaProbabilidade = textoDaProbabilidade === "" ? undefined : Number(textoDaProbabilidade);
    const validacaoDaProbabilidade = validarProbabilidadeDeEtapa(valorDaProbabilidade);
    if (!validacaoDaProbabilidade.ok) proximos.probabilidade = validacaoDaProbabilidade.error;
    const textoDaPosicao = posicao.trim();
    const valorDaPosicao = textoDaPosicao === "" ? undefined : Number(textoDaPosicao);
    if (valorDaPosicao !== undefined && (!Number.isInteger(valorDaPosicao) || valorDaPosicao < 1 || valorDaPosicao > existentes.length + 1)) {
      proximos.posicao = `A posição vai de 1 a ${existentes.length + 1}.`;
    }
    setErros(proximos);
    if (Object.keys(proximos).length > 0) return;

    const deuCerto = await agir(
      () =>
        adicionarEtapa(funilId, {
          nome: nome.trim(),
          ...(valorDaProbabilidade !== undefined ? { probabilidadePadrao: valorDaProbabilidade } : {}),
          ...(valorDaPosicao !== undefined ? { posicao: valorDaPosicao } : {}),
        }),
      "Etapa adicionada.",
    );
    if (deuCerto) onFechar();
  };

  return (
    <div className="mt-3 grid items-end gap-3 sm:grid-cols-[minmax(0,1fr)_9rem_9rem_auto]">
      <Field label="Nome da nova Etapa" {...(erros.nome ? { error: erros.nome } : {})}>
        {(id) => <TextInput id={id} value={nome} onChange={setNome} invalid={erros.nome !== undefined} />}
      </Field>
      <Field label="Probabilidade padrão (%)" {...(erros.probabilidade ? { error: erros.probabilidade } : {})}>
        {(id) => <TextInput id={id} type="number" value={probabilidade} onChange={setProbabilidade} invalid={erros.probabilidade !== undefined} />}
      </Field>
      <Field label="Posição (opcional)" {...(erros.posicao ? { error: erros.posicao } : {})}>
        {(id) => <TextInput id={id} type="number" value={posicao} onChange={setPosicao} invalid={erros.posicao !== undefined} />}
      </Field>
      <span className="flex items-center gap-2 pb-1">
        <Button variant="primary" onClick={() => void adicionar()}>
          Adicionar
        </Button>
        <Button variant="ghost" onClick={onFechar}>
          Cancelar
        </Button>
      </span>
    </div>
  );
}

export function EtapasDoFunil({
  detalhado,
  podeEditar,
  motivo,
  onRemoverComNegocios,
  onAviso,
}: {
  readonly detalhado: FunilDetalhado;
  readonly podeEditar: boolean;
  /** Por que não dá para editar (a frase de `podeNoCrm` ou a do estado); `undefined` quando `podeEditar`. */
  readonly motivo: string | undefined;
  /** Remover uma Etapa que tem Negócios: abre o remapeamento (D-07). */
  readonly onRemoverComNegocios: (etapaId: string) => void;
  readonly onAviso?: (texto: string) => void;
}) {
  const { funil } = detalhado;
  const etapas = [...detalhado.etapas].sort((a, b) => a.ordem - b.ordem);
  const [adicionando, setAdicionando] = useState(false);
  const [recusa, setRecusa] = useState<ErroDeApi | null>(null);
  const [etapaDaRecusa, setEtapaDaRecusa] = useState<string | null>(null);

  const agir: Agir = async (acao, sucesso) => {
    setRecusa(null);
    try {
      await acao();
      if (sucesso) onAviso?.(sucesso);
      return true;
    } catch (falha) {
      setRecusa(comoErroDeApi(falha, "Não foi possível concluir a ação. Tente de novo."));
      return false;
    }
  };

  const mover = (indice: number, passo: -1 | 1) => {
    const ids = etapas.map((etapa) => etapa.id);
    const [movida] = ids.splice(indice, 1);
    if (movida === undefined) return;
    ids.splice(indice + passo, 0, movida);
    void agir(() => reordenarEtapas(funil.id, ids));
  };

  const remover = (etapa: EtapaDetalhada) => {
    if (etapa.negocios.total > 0) {
      onRemoverComNegocios(etapa.id);
      return;
    }
    setEtapaDaRecusa(etapa.id);
    void agir(() => removerEtapa(etapa.id), `Etapa ${etapa.nome} removida.`);
  };

  const cheio = etapas.length >= LIMITE_DE_ETAPAS_POR_FUNIL;
  const motivoDeAdicionar = motivo ?? (cheio ? `Um Funil tem no máximo ${LIMITE_DE_ETAPAS_POR_FUNIL} Etapas.` : undefined);

  return (
    <Painel className="min-w-0">
      <CabecalhoDePainel titulo="Etapas" contagem={etapas.length} />
      <div className="p-3">
        <MensagemDeRecusa
          erro={recusa}
          onFechar={() => setRecusa(null)}
          {...(recusa?.codigo === "ETAPA_COM_NEGOCIOS" && etapaDaRecusa
            ? {
                acao: (
                  <Button size="sm" onClick={() => onRemoverComNegocios(etapaDaRecusa)}>
                    Remapear Negócios
                  </Button>
                ),
              }
            : {})}
        />
        <ol className="pilha-solta" aria-label="Etapas do Funil">
          {etapas.map((etapa, indice) => (
            <LinhaDeEtapa
              key={`${etapa.id}:${etapa.nome}:${etapa.probabilidadePadrao}`}
              etapa={etapa}
              irmas={etapas.filter((outra) => outra.id !== etapa.id).map((outra) => outra.nome)}
              indice={indice}
              total={etapas.length}
              podeEditar={podeEditar}
              motivo={motivo}
              agir={agir}
              onMover={(passo) => mover(indice, passo)}
              onRemover={() => remover(etapa)}
            />
          ))}
        </ol>
        <div className="mt-3">
          <Button
            onClick={() => setAdicionando((aberto) => !aberto)}
            {...(motivoDeAdicionar ? { disabled: true, disabledReason: motivoDeAdicionar } : {})}
          >
            Adicionar Etapa
          </Button>
        </div>
        {adicionando && podeEditar ? (
          <FormularioDeNovaEtapa
            funilId={funil.id}
            existentes={etapas.map((etapa) => etapa.nome)}
            agir={agir}
            onFechar={() => setAdicionando(false)}
          />
        ) : null}
      </div>
    </Painel>
  );
}
