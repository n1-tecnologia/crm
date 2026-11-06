"use client";

/**
 * A call do Closer, enquanto ela acontece.
 *
 * Não existe entidade Reunião: isto é uma Tarefa de Tipo Reunião ligada ao
 * Negócio por Vínculo (D8 deixou Evento de calendário como decisão futura).
 * O Vínculo mora em `state.links` (a Tarefa é do modelo antigo); o lead mora no
 * CRM novo e é lido por HTTP: o Negócio (`useNegocio`, que já traz Etapa e
 * Funil), o Contato dele (`useContato`) e a Empresa (`useEmpresa`). Tudo que a
 * coluna da direita mostra é leitura desse lead — nada aqui é digitado duas vezes.
 * A nota da call vai para `contato_notas` (`adicionarNotaAoContato`).
 *
 * O Negócio novo não guarda Campos personalizados, e o Contato novo não tem
 * Temperatura nem perfis de LinkedIn e TikTok: o Diagnóstico e o Roteiro da call
 * saíram da tela com o modelo antigo (WINDOWS.md, Fase 15). Histórico de Etapas,
 * Tags e vários Contatos por Negócio também não voltam (F14-D-04).
 *
 * O vídeo NÃO existe: o protótipo não tem mídia nem servidor. O palco diz isso
 * em vez de fingir uma chamada, porque uma imagem parada no lugar do vídeo faz
 * quem demonstra prometer o que o produto ainda não faz.
 */

import Image from "next/image";
import Link from "next/link";
import { use, useState, useSyncExternalStore } from "react";
import {
  Clock,
  Mic,
  MonitorUp,
  MoreHorizontal,
  PhoneOff,
  ScrollText,
  Share2,
  User,
  Users,
  Video,
} from "lucide-react";
import { useData, useRun, useSession } from "@/dados/store";
import { actorLabel, statusCategory } from "@n1/dominio/derive";
import { ehAlteracaoDeDescricao } from "@n1/dominio/descricao-da-tarefa";
import { endMeeting, startMeeting } from "@n1/dominio/operations";
import type { ActivityRecord } from "@n1/dominio/types/primitives";
import { ROTULO_DO_TIPO_DE_IDENTIFICADOR, nomeDeExibicaoDoContato } from "@n1/dominio/crm/contatos";
import { validarNovaNota } from "@n1/dominio/crm/notas";
import { invalidarCrm } from "@/dados/crm/cliente-crm";
import { useAtividades } from "@/dados/crm/atividades";
import { useContato } from "@/dados/crm/contatos";
import { useEmpresa } from "@/dados/crm/empresas";
import { useNegocio } from "@/dados/crm/negocios";
import { adicionarNotaAoContato } from "@/dados/crm/notas";
import { AvatarDoContato } from "@/features/crm/avatar-do-contato";
import { InstagramIcon } from "@/features/crm/brand-icons";
import { comoErroDeApi } from "@/features/crm/formulario-de-contato";
import { useFormat } from "@/features/shell/use-format";
import {
  ActivityTimeline,
  ActorAvatar,
  Button,
  ConfirmDialog,
  CorpoDeTela,
  EmptyState,
  EsqueletoDeLinhas,
  Icone,
  PageHeader,
  Painel,
  Pilula,
  RecordPanel,
  RecordRow,
  StateSeal,
  Toast,
} from "@/features/shell/ui";

/**
 * O relógio é estado EXTERNO ao React, não estado da tela: por isso é lido por
 * `useSyncExternalStore` em vez de um efeito que chama `setState`.
 *
 * O instantâneo é arredondado ao segundo para ser estável entre renderizações
 * dentro do mesmo segundo — sem isso, cada renderização devolveria um número
 * diferente e o React entraria em laço. No servidor devolve `null`, porque
 * `Date.now()` no HTML do servidor não bate com o do navegador.
 */
/** A linha do tempo abre curta: na call, o que importa é o topo dela. */
const ATIVIDADES_POR_VEZ = 6;

function useRelogio(): number | null {
  return useSyncExternalStore(
    (aoMudar) => {
      const id = window.setInterval(aoMudar, 1000);
      return () => window.clearInterval(id);
    },
    () => Math.floor(Date.now() / 1000) * 1000,
    () => null,
  );
}

/** hh:mm:ss desde o início do Apontamento aberto. */
function duracao(desde: number, agora: number): string {
  const total = Math.max(0, Math.floor((agora - desde) / 1000));
  const h = String(Math.floor(total / 3600)).padStart(2, "0");
  const m = String(Math.floor((total % 3600) / 60)).padStart(2, "0");
  const s = String(total % 60).padStart(2, "0");
  return `${h}:${m}:${s}`;
}

/** Une as listas sem repetir id e ordena da mais recente para a mais antiga (`at` é ISO em UTC). */
function juntarAtividades(...listas: readonly ActivityRecord[][]): ActivityRecord[] {
  const porId = new Map<string, ActivityRecord>();
  for (const lista of listas) for (const registro of lista) porId.set(registro.id, registro);
  return [...porId.values()].sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
}

export default function ReuniaoPage({
  params,
}: {
  params: Promise<{ reuniao: string }>;
}) {
  const { reuniao } = use(params);
  const state = useData((data) => data);
  const { memberId } = useSession();
  const run = useRun();
  const fmt = useFormat();
  const [nota, setNota] = useState("");
  const [gravandoNota, setGravandoNota] = useState(false);

  const [encerrando, setEncerrando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [atividadesVisiveis, setAtividadesVisiveis] =
    useState(ATIVIDADES_POR_VEZ);

  const task = state.tasks.find((t) => t.id === reuniao);

  /*
   * O Vínculo da Tarefa aponta o Negócio; daí em diante o lead é do CRM novo.
   * Os hooks vêm ANTES do retorno antecipado (regra dos hooks): sem Vínculo o
   * id é `undefined` e nenhum deles vai à api.
   */
  const vinculo = task
    ? state.links.find(
        (l) =>
          (l.fromId === task.id && l.toType === "deal") ||
          (l.toId === task.id && l.fromType === "deal"),
      )
    : undefined;
  const negocioId = vinculo
    ? vinculo.fromId === task?.id
      ? vinculo.toId
      : vinculo.fromId
    : undefined;
  const consultaDoNegocio = useNegocio(negocioId);
  // Negócio na lixeira (ou 404/403 da api) é o mesmo que ausente: estado vazio, sem erro.
  const lead =
    consultaDoNegocio.data && consultaDoNegocio.data.negocio.estado !== "na_lixeira"
      ? consultaDoNegocio.data
      : undefined;
  const negocio = lead?.negocio;
  const consultaDoContato = useContato(negocio?.contatoId ?? undefined);
  const consultaDaEmpresa = useEmpresa(negocio?.empresaId ?? undefined);
  const contato = consultaDoContato.data;
  /*
   * As duas fontes de Atividade (D-15-09): `useAtividades` junta `state.activity`
   * do objeto com `GET /atividades`. A da Tarefa da Reunião é só do modelo antigo.
   */
  const atividadesDoNegocio = useAtividades(negocio ? { tipo: "deal", id: negocio.id } : undefined);
  const atividadesDoContato = useAtividades(contato ? { tipo: "contact", id: contato.contato.id } : undefined);

  const agora = useRelogio();

  if (!task) {
    return (
      <div className="flex h-full flex-col">
        <PageHeader title="Reunião não encontrada" />
        <CorpoDeTela>
          <EmptyState
            title="Esta Reunião não existe."
            hint="Ela pode ter sido eliminada, ou você não tem permissão para vê-la."
          />
        </CorpoDeTela>
      </div>
    );
  }

  const empresa = consultaDaEmpresa.data?.empresa;
  const nomeDaEmpresa =
    empresa?.nomeFantasia ?? empresa?.razaoSocial ?? lead?.empresa?.nome ?? undefined;
  const principal = contato?.identificadores.find((i) => i.principal) ?? contato?.identificadores[0];
  const nomeDoContato = contato
    ? nomeDeExibicaoDoContato(contato.contato, principal?.valorExibido ?? principal?.valor)
    : undefined;
  const localizacao = contato?.contato.enderecos[0]
    ? [contato.contato.enderecos[0].cidade, contato.contato.enderecos[0].estado].filter(Boolean).join(", ")
    : "";
  /** O cargo vem do vínculo vigente do Contato com a Empresa (o primeiro sem `fim`). */
  const vinculoVigente = contato?.vinculos.find((v) => v.fim === null);
  const carregandoOLead =
    negocioId !== undefined && consultaDoNegocio.isLoading && consultaDoNegocio.data === undefined;

  /**
   * Tudo que já aconteceu com este lead — o Negócio, o Contato e esta Reunião —
   * do mais recente para o mais antigo. O Closer entra numa conversa que o SDR
   * começou: sem esta lista ele teria que sair da call para saber o que foi
   * dito antes dela.
   */
  const atividadesDoLead = juntarAtividades(
    state.activity.filter((registro) => registro.objectId === task.id),
    atividadesDoNegocio.atividades,
    atividadesDoContato.atividades,
  );
  const historicoIncompleto = Boolean(atividadesDoNegocio.erro ?? atividadesDoContato.erro);

  /*
   * Rede social é PERFIL PÚBLICO, que se abre e se lê antes da call. WhatsApp
   * e e-mail ficam de fora de propósito: são endereço de envio, e tratá-los
   * como rede social misturaria "onde ver a pessoa" com "por onde falar".
   */
  const perfis = (contato?.identificadores ?? [])
    .filter((identificador) => identificador.tipo === "instagram")
    .map((identificador) => ({
      identificador,
      rotulo: "Instagram",
      href: `https://instagram.com/${encodeURIComponent(identificador.valor.replace(/^@/, ""))}`,
      icone: InstagramIcon,
    }));
  const eu = state.members.find((m) => m.id === memberId);

  const emAndamento = statusCategory(state, task) === "emAndamento";
  const apontamento = [...task.timeEntries]
    .reverse()
    .find((e) => e.end === undefined);
  const encerrada = statusCategory(state, task) === "concluido";

  const proximas = state.tasks
    .filter((t) => t.id !== task.id && t.lifecycle === "ativo")
    .filter((t) =>
      t.assignees.some(
        (a) => a.kind === "member" && a.id === negocio?.proprietarioId,
      ),
    )
    .filter((t) => statusCategory(state, t) !== "concluido")
    .sort((a, b) =>
      String(a.dueDate?.value ?? "9").localeCompare(
        String(b.dueDate?.value ?? "9"),
      ),
    )
    ;

  /** Só as três mais próximas cabem na barra; o total fica dito no rodapé. */
  const proximasVisiveis = proximas.slice(0, 3);

  const reportar = (
    resultado: { ok: boolean; error?: string },
    mensagem: string,
  ) => {
    if (resultado.ok) {
      setErro(null);
      setAviso(mensagem);
    } else {
      setAviso(null);
      setErro(resultado.error ?? "Não foi possível concluir a operação.");
    }
  };

  /**
   * A nota da call é do Contato (3.2.7): vai para `contato_notas`, não para a
   * Tarefa. A mesma `validarNovaNota` da api pré-valida; a recusa dela aparece
   * na tela, e o texto só some se gravou — apagá-lo junto com o erro perderia o
   * que a pessoa escreveu durante a call.
   */
  const registrarNota = async () => {
    if (!contato) return;
    const validacao = validarNovaNota({ conteudo: nota });
    if (!validacao.ok) {
      setAviso(null);
      setErro(validacao.error);
      return;
    }
    setGravandoNota(true);
    try {
      await adicionarNotaAoContato(contato.contato.id, validacao.value.conteudo);
      setErro(null);
      setAviso("Anotação registrada no Contato.");
      setNota("");
      // A api gravou "Nota registrada no Contato" na linha do tempo: revalida para ela aparecer.
      await invalidarCrm("/atividades");
    } catch (falha) {
      setAviso(null);
      setErro(comoErroDeApi(falha, "Não foi possível salvar a anotação. Tente de novo.").message);
    } finally {
      setGravandoNota(false);
    }
  };

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title={task.title}
        seal={<StateSeal state={task.lifecycle} />}
      />

      {aviso ? (
        <div className="px-4 pt-3">
          <Toast tone="success" onDismiss={() => setAviso(null)}>
            {aviso}
          </Toast>
        </div>
      ) : null}
      {erro ? (
        <div className="px-4 pt-3">
          <Toast tone="error" onDismiss={() => setErro(null)}>
            {erro}
          </Toast>
        </div>
      ) : null}

      <ConfirmDialog
        open={encerrando}
        title="Encerrar a reunião?"
        description="A Tarefa da Reunião é concluída e o tempo é gravado como Apontamento. É esse evento que move o Negócio da Call para a Proposta."
        confirmLabel="Encerrar reunião"
        destructive
        onConfirm={() => {
          reportar(
            run((data, id) => endMeeting(data, id, task.id)),
            "Reunião encerrada e tempo apontado.",
          );
          setEncerrando(false);
        }}
        onCancel={() => setEncerrando(false)}
      />

      <CorpoDeTela>
        <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_22rem]">
          {/*
            ── o palco ──
            O corpo da tela é o único bloco que rola, então o palco não pode
            mais esticar até o rodapé: ele tem a proporção de um vídeo e, na
            tela larga, fica preso ao topo enquanto o dossiê rola ao lado.
          */}
          <Painel className="relative grid aspect-video min-w-0 place-items-center self-start overflow-hidden xl:sticky xl:top-0">
            {carregandoOLead ? (
              <EsqueletoDeLinhas quantidade={2} />
            ) : contato ? (
              <>
                {/*
                  A moldura é a real; o vídeo ainda não existe, e o lugar dele é
                  ocupado pelo retrato do Contato. Quem é a pessoa está dito no
                  bloco "Detalhes do cliente", ao lado — repetir sobre a imagem
                  só cobriria o rosto. No modelo novo não há arquivo de foto: o
                  retrato são as iniciais.
                */}
                <span className="absolute inset-0 grid place-items-center overflow-hidden bg-[var(--page)]">
                  <AvatarDoContato
                    nome={contato.contato.nome}
                    sobrenome={contato.contato.sobrenome}
                    tamanho="grande"
                  />
                </span>
              </>
            ) : !lead ? (
              <EmptyState
                title="Esta Reunião não tem Negócio."
                hint="Sem Negócio vinculado não há lead para mostrar. Ele pode estar na lixeira, ou você não tem permissão para vê-lo."
              />
            ) : (
              <EmptyState
                title="Esta Reunião não tem Contato."
                hint={
                  nomeDaEmpresa
                    ? `O Negócio é da Empresa ${nomeDaEmpresa}, sem Contato vinculado: não há com quem falar.`
                    : "Sem Contato vinculado ao Negócio não há com quem falar."
                }
              />
            )}

            {/* quem está conduzindo, no canto */}
            <span className="painel-solido absolute right-3 top-3 w-44 overflow-hidden">
              <span className="relative block aspect-video">
                {eu?.photoFileId ? (
                  <Image
                    src={`/membros/${eu.photoFileId}.jpg`}
                    alt={eu.displayName}
                    fill
                    sizes="176px"
                    className="object-cover"
                  />
                ) : (
                  <span className="grid h-full place-items-center">
                    <ActorAvatar
                      kind="member"
                      name={eu?.displayName ?? "—"}
                      size="grande"
                    />
                  </span>
                )}
              </span>
              <span className="app-xs flex items-center gap-1.5 px-2 py-1" style={{ color: "var(--texto)" }}>
                <Icone de={Mic} tamanho="xs" />
                <span className="truncate">
                  {eu?.displayName ?? "—"} (você)
                </span>
              </span>
            </span>

            {/* ── controles, sobre o vídeo ── */}
            <ul className="absolute inset-x-0 bottom-0 flex flex-wrap items-start justify-center gap-4 bg-gradient-to-t from-[var(--veu-cor)] to-transparent px-4 pb-4 pt-10">
              {[
                { rotulo: "Microfone", icone: Mic },
                { rotulo: "Câmera", icone: Video },
                { rotulo: "Compartilhar", icone: MonitorUp },
                { rotulo: "Mais", icone: MoreHorizontal },
              ].map(({ rotulo, icone }) => (
                <li key={rotulo} className="grid justify-items-center gap-1">
                  {/* Não é botão: subir no hover prometeria um clique que não existe. */}
                  <span
                    title="A chamada de vídeo ainda não existe neste protótipo."
                    className="grid place-items-center rounded-full border"
                    style={{
                      width: "var(--controle-h-lg)",
                      height: "var(--controle-h-lg)",
                      borderColor: "var(--texto-4)",
                      color: "var(--texto-2)",
                    }}
                  >
                    <Icone de={icone} tamanho="md" />
                  </span>
                  <span className="app-xs" style={{ color: "var(--texto-2)" }}>{rotulo}</span>
                </li>
              ))}
              {/*
              Abrir e encerrar são o mesmo lugar porque são o mesmo botão da
              chamada: um cabeçalho separado só para isso fazia a pessoa
              procurar a ação longe de onde a call está.
            */}
              <li className="grid justify-items-center gap-1">
                {encerrada ? (
                  <>
                    <span
                      aria-hidden="true"
                      className="grid place-items-center rounded-full"
                      style={{
                        width: "var(--controle-h-lg)",
                        height: "var(--controle-h-lg)",
                        background: "var(--superficie-2)",
                        color: "var(--texto-3)",
                      }}
                    >
                      <Icone de={PhoneOff} tamanho="md" />
                    </span>
                    <span className="app-xs" style={{ color: "var(--texto-3)" }}>
                      Encerrada
                    </span>
                  </>
                ) : emAndamento ? (
                  <>
                    <button
                      type="button"
                      onClick={() => setEncerrando(true)}
                      title="Encerrar a reunião"
                      className="btn-icone"
                      style={{
                        width: "var(--controle-h-lg)",
                        height: "var(--controle-h-lg)",
                        background: "var(--erro)",
                        borderColor: "transparent",
                        color: "var(--sobre-acento)",
                      }}
                    >
                      <Icone de={PhoneOff} tamanho="md" />
                    </button>
                    <span className="app-xs" style={{ color: "var(--texto-3)" }}>
                      Finalizar
                    </span>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() =>
                        reportar(
                          run((data, id) => startMeeting(data, id, task.id)),
                          "Reunião aberta.",
                        )
                      }
                      title="Abrir a reunião"
                      className="btn-icone"
                      style={{
                        width: "var(--controle-h-lg)",
                        height: "var(--controle-h-lg)",
                        background: "var(--sucesso)",
                        borderColor: "transparent",
                        color: "var(--sobre-acento)",
                      }}
                    >
                      <Icone de={Video} tamanho="md" />
                    </button>
                    <span className="app-xs" style={{ color: "var(--texto-3)" }}>
                      Abrir
                    </span>
                  </>
                )}
              </li>
            </ul>
          </Painel>

          {/* ── o dossiê, à direita ── */}
          <div className="grid min-w-0 content-start gap-3">
            {contato ? (
              <RecordPanel
                title="Detalhes do cliente"
                icon={<Icone de={User} tamanho="sm" />}
                action={
                  contato.contato.qualificacao ? (
                    <Pilula tom="neutro">{contato.contato.qualificacao}</Pilula>
                  ) : undefined
                }
              >
                <div className="mb-3 flex items-center gap-3">
                  <AvatarDoContato
                    nome={contato.contato.nome}
                    sobrenome={contato.contato.sobrenome}
                  />
                  <span className="min-w-0">
                    <Link
                      href={`/crm/contatos/${contato.contato.id}`}
                      className="app-md block truncate hover:underline"
                      style={{ color: "var(--texto)" }}
                    >
                      {nomeDoContato}
                    </Link>
                    <span className="app-sm block truncate" style={{ color: "var(--texto-3)" }}>
                      {vinculoVigente?.cargo || "sem cargo"}
                      {nomeDaEmpresa ? ` · ${nomeDaEmpresa}` : ""}
                    </span>
                  </span>
                </div>
                <dl className="grid gap-1">
                  {contato.identificadores
                    .filter((identificador) => identificador.tipo !== "instagram")
                    .map((identificador) => (
                      <RecordRow
                        key={identificador.id}
                        label={ROTULO_DO_TIPO_DE_IDENTIFICADOR[identificador.tipo] ?? identificador.tipo}
                      >
                        <span className="identificador">
                          {identificador.valorExibido ?? identificador.valor}
                        </span>
                      </RecordRow>
                    ))}
                  {localizacao ? (
                    <RecordRow label="Localização">{localizacao}</RecordRow>
                  ) : null}
                </dl>
              </RecordPanel>
            ) : null}

            {lead && negocio ? (
              <>
                <RecordPanel
                  title="Detalhes da call"
                  icon={<Icone de={ScrollText} tamanho="sm" />}
                >
                  {/*
                  Situação, cronômetro, participantes e horário moravam no
                  cabeçalho. Ali eles competiam com o título e com o botão de
                  encerrar; aqui ficam junto do que a call produziu — que é o
                  mesmo assunto, lido de uma vez só.
                */}
                  <dl className="grid gap-2">
                    <RecordRow label="Situação">
                      <Pilula tom={emAndamento ? "sucesso" : "neutro"}>
                        {emAndamento
                          ? "Em andamento"
                          : encerrada
                            ? "Encerrada"
                            : "Não iniciada"}
                      </Pilula>
                    </RecordRow>
                    {emAndamento && apontamento && agora !== null ? (
                      <RecordRow label="Duração">
                        <span className="identificador inline-flex items-center gap-1.5">
                          <Icone de={Clock} tamanho="xs" />
                          {duracao(Date.parse(apontamento.start), agora)}
                        </span>
                      </RecordRow>
                    ) : null}
                    <RecordRow label="Objetivo">{task.title}</RecordRow>
                    <RecordRow label="Quando">
                      {task.dueDate ? fmt.taskDate(task.dueDate) : "sem horário"}
                    </RecordRow>
                    <RecordRow label="Participantes">
                      <span className="inline-flex items-center gap-1.5">
                        <Icone de={Users} tamanho="xs" />2
                      </span>
                    </RecordRow>
                  </dl>
                </RecordPanel>

                <RecordPanel
                  title="Resumo do Negócio"
                  icon={<Icone de={ScrollText} tamanho="sm" />}
                  action={
                    <Link
                      href={`/crm/negocios/${negocio.id}`}
                      className="app-sm hover:underline"
                      style={{ color: "var(--texto-3)" }}
                    >
                      Abrir Negócio
                    </Link>
                  }
                >
                  <dl className="grid gap-2">
                    <RecordRow label="Negócio">{negocio.titulo}</RecordRow>
                    <RecordRow label="Objeto">{negocio.objeto || "—"}</RecordRow>
                    <RecordRow label="Valor">
                      {negocio.valor
                        ? fmt.money({ amount: Number(negocio.valor), currency: negocio.moeda })
                        : "sem valor declarado"}
                    </RecordRow>
                    <RecordRow label="Funil">{lead.funil.nome}</RecordRow>
                    <RecordRow label="Etapa">{lead.etapa.nome}</RecordRow>
                    {nomeDaEmpresa ? (
                      <RecordRow label="Empresa">
                        {lead.empresa ? (
                          <Link
                            href={`/crm/empresas/${lead.empresa.id}`}
                            className="hover:underline"
                          >
                            {nomeDaEmpresa}
                          </Link>
                        ) : (
                          nomeDaEmpresa
                        )}
                      </RecordRow>
                    ) : null}
                    <RecordRow label="Fechamento previsto">
                      {negocio.dataPrevistaFechamento
                        ? fmt.civilDate(negocio.dataPrevistaFechamento)
                        : "—"}
                    </RecordRow>
                  </dl>
                </RecordPanel>
              </>
            ) : null}

            {contato ? (
              <RecordPanel
                title="Redes sociais"
                icon={<Icone de={Share2} tamanho="sm" />}
                count={perfis.length}
              >
                {perfis.length === 0 ? (
                  <EmptyState compact title="Este Contato não tem perfil público registrado." />
                ) : (
                  <ul className="grade-solta grid-cols-3">
                    {perfis.map(({ identificador, href, icone: Marca, rotulo }) => (
                      <li key={identificador.id}>
                        <a
                          href={href}
                          target="_blank"
                          rel="noreferrer"
                          title={identificador.valorExibido ?? identificador.valor}
                          className="item-solto"
                          data-bloco="true"
                          style={{ color: "var(--acento)" }}
                        >
                          <span className="grid justify-items-center gap-1">
                            <Marca className="size-5" />
                            <span className="app-meta">
                              {rotulo}
                            </span>
                          </span>
                        </a>
                      </li>
                    ))}
                  </ul>
                )}
                <p className="app-meta mt-3">
                  Abrem em outra aba: a call continua aqui.
                </p>
              </RecordPanel>
            ) : null}

            <RecordPanel
              title="Próximos passos"
              icon={<Icone de={Clock} tamanho="sm" />}
              count={proximas.length}
            >
              {proximas.length === 0 ? (
                <EmptyState compact title="Nenhuma Tarefa aberta do Proprietário." />
              ) : (
                <>
                  <ul className="pilha-solta">
                    {proximasVisiveis.map((t) => (
                      <li key={t.id}>
                        <Link
                          href={`/estrutura/tarefas/${t.id}`}
                          className="item-solto"
                          data-bloco="true"
                        >
                          <span className="app-base block truncate" style={{ color: "var(--texto)" }}>
                            {t.title}
                          </span>
                          <span className="app-meta app-numero block">
                            {t.dueDate ? fmt.taskDate(t.dueDate) : "sem data"}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                  {proximas.length > proximasVisiveis.length ? (
                    <p className="app-meta mt-2">
                      As {proximasVisiveis.length} mais próximas de {proximas.length}.{" "}
                      <Link href="/estrutura/tarefas" className="underline">
                        Ver todas
                      </Link>
                      .
                    </p>
                  ) : null}
                </>
              )}
            </RecordPanel>

            {lead ? (
              <RecordPanel
                title="Anotações e atividades"
                icon={<Icone de={ScrollText} tamanho="sm" />}
                count={atividadesDoLead.length}
              >
                {contato ? (
                  <form
                    className="grid gap-2"
                    onSubmit={(evento) => {
                      evento.preventDefault();
                      void registrarNota();
                    }}
                  >
                    <label className="sr-only" htmlFor="nota-da-call">
                      Anotação da call
                    </label>
                    <textarea
                      id="nota-da-call"
                      rows={3}
                      value={nota}
                      onChange={(evento) => setNota(evento.target.value)}
                      placeholder="O que apareceu nesta call…"
                      className="campo"
                    />
                    <span>
                      <Button
                        type="submit"
                        variant="secondary"
                        disabled={nota.trim() === "" || gravandoNota}
                        disabledReason={
                          gravandoNota
                            ? "Gravando a anotação…"
                            : "Escreva a anotação antes de salvar."
                        }
                      >
                        Registrar anotação
                      </Button>
                    </span>
                  </form>
                ) : null}

                <div className="mt-3 pt-3" style={{ borderTop: "1px solid var(--linha)" }}>
                  {historicoIncompleto ? (
                    <p className="app-meta mb-2" role="status">
                      Não foi possível carregar todo o histórico do lead agora.
                    </p>
                  ) : null}
                  <ActivityTimeline
                    entries={atividadesDoLead
                      .slice(0, atividadesVisiveis)
                      .map((registro) => ({
                        id: registro.id,
                        at: fmt.instant(registro.at),
                        actorName: actorLabel(state, registro.actor),
                        actorKind: registro.actor.kind,
                        ...(registro.delegate
                          ? { delegateName: actorLabel(state, registro.delegate) }
                          : {}),
                        action: registro.action,
                        // D-10: a descrição da Tarefa não derrama na frase da linha do tempo.
                        ...(registro.before && !ehAlteracaoDeDescricao(registro) ? { before: registro.before } : {}),
                        ...(registro.after && !ehAlteracaoDeDescricao(registro) ? { after: registro.after } : {}),
                        ...(registro.detail ? { detail: registro.detail } : {}),
                      }))}
                  />
                  {atividadesVisiveis < atividadesDoLead.length ? (
                    <div className="mt-3">
                      <Button
                        variant="secondary"
                        onClick={() =>
                          setAtividadesVisiveis(
                            (quantas) => quantas + ATIVIDADES_POR_VEZ,
                          )
                        }
                      >
                        Mostrar mais (
                        {atividadesDoLead.length - atividadesVisiveis})
                      </Button>
                    </div>
                  ) : null}
                </div>
              </RecordPanel>
            ) : null}
          </div>
        </div>
      </CorpoDeTela>
    </div>
  );
}
