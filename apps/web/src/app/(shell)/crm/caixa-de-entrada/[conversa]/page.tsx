"use client";

/**
 * T26 — Conversa.
 *
 * Fase 15 (3.4.1, UCR-05): a Conversa vem de `GET /conversas/:id` (`useConversa`) e
 * cada gesto do cabeçalho — atribuir, resolver, reabrir, mover e mandar para a
 * lixeira — é uma rota de `/conversas/:id/*`. Nada disso passa por `POST /operacoes`
 * nem pelo store, então `plataforma.registros` não muda. Quem decide o que é
 * permitido é a api (`podeNoCrm`); a tela só desliga o item, com a mesma função do
 * domínio, e mostra a recusa dela. O fio está em `ConversationThread` (15-20).
 *
 * F14-D-05: Grupo e Flow ficam no modelo antigo. Um id que a api não conhece (404) e
 * que o store conhece como Conversa de grupo abre `ConversaDeGrupoNaCaixa`; qualquer
 * outro 404 é "Conversa não encontrada." — sem ponte de id antigo para novo (F14-D-01).
 *
 * B67 — uma nota interna é uma Mensagem com `direction: "interna"`; ela nunca chega ao
 * Contato, e a tela precisa tornar impossível confundir as duas.
 */

import Link from "next/link";
import { Briefcase, Link2, MessageSquare, PanelRight, Radio, User as UserIcon, Users, Wallet } from "lucide-react";
import { use, useRef, useState } from "react";
import { useData } from "@/dados/store";
import { ErroDeApi, invalidarCrm } from "@/dados/crm/cliente-crm";
import { useContato } from "@/dados/crm/contatos";
import { atribuirConversa, conversaParaLixeira, reabrirConversa, resolverConversa, useConversa } from "@/dados/crm/conversas";
import { useNegocio, useNegocios } from "@/dados/crm/negocios";
import { useNomeDoMembro, usePodeNoCrm } from "@/dados/crm/sessao";
import { AvatarDoContato } from "@/features/crm/avatar-do-contato";
import { ColunaDoContato } from "@/features/crm/coluna-do-contato";
import { ConversaDeGrupoNaCaixa } from "@/features/crm/conversa-de-grupo-na-caixa";
import { ConversationThread } from "@/features/crm/conversation-thread";
import { empresaDoContato } from "@/features/crm/empresa-do-contato";
import { InboxColumns } from "@/features/crm/inbox-columns";
import { MoveConversationDialog, useMoveConversationDialog } from "@/features/crm/move-conversation-dialog";
import { TarefasDoContato } from "@/features/crm/tarefas-do-contato";
import { NovaTarefaConversacionalDialog } from "@/features/estrutura/nova-tarefa-conversacional-dialog";
import { CONVERSATION_STATE_LABEL } from "@/features/shell/format";
import { useFormat } from "@/features/shell/use-format";
import {
  ActionMenu,
  Button,
  ConditionMarker,
  ConfirmDialog,
  CorpoDeTela,
  EmptyState,
  Icone,
  PageHeader,
  RecordPanel,
  RecordRow,
  Select,
  StateSeal,
  Toast,
} from "@/features/shell/ui";
import { actorLabel } from "@n1/dominio/derive";
import { nomeDeExibicaoDoContato } from "@n1/dominio/crm/contatos";
import type { Atribuicao, ConversaDetalhada } from "@n1/dominio/crm/conversas";
import { capacidadesDoCanal } from "@n1/dominio/crm/capacidades";
import type { Id } from "@n1/dominio/types";

export default function ConversaPage({ params }: { params: Promise<{ conversa: string }> }) {
  const { conversa } = use(params);
  const lida = useConversa(conversa);
  const eDeGrupo = useData((data) => data.conversations.some((c) => c.id === conversa && c.groupIdentifier !== undefined));

  if (lida.data) return <ConversaAberta key={conversa} detalhe={lida.data} />;

  if (lida.error === undefined) {
    return (
      <InboxColumns>
        <PageHeader title="Conversa" />
        <CorpoDeTela>
          <p className="app-base" style={{ color: "var(--texto-3)" }}>
            Carregando a conversa…
          </p>
        </CorpoDeTela>
      </InboxColumns>
    );
  }

  // Só o 404 recua para o Grupo: uma recusa de permissão ou de rede não é "não existe".
  const naoExiste = lida.error instanceof ErroDeApi && lida.error.status === 404;
  if (naoExiste && eDeGrupo) return <ConversaDeGrupoNaCaixa key={conversa} conversaId={conversa} />;

  return (
    <InboxColumns>
      <PageHeader title={naoExiste ? "Conversa não encontrada" : "Conversa"} />
      <CorpoDeTela>
        {naoExiste ? (
          <EmptyState title="Conversa não encontrada." hint="Ela pode ter sido eliminada, ou você não tem permissão para vê-la." />
        ) : (
          <EmptyState title="Não foi possível abrir a Conversa." hint={lida.error.message} />
        )}
      </CorpoDeTela>
    </InboxColumns>
  );
}

function ConversaAberta({ detalhe }: { readonly detalhe: ConversaDetalhada }) {
  const { conversa: conversation, canal: channel } = detalhe;
  const members = useData((data) => data.members);
  const agents = useData((data) => data.agents);
  const queues = useData((data) => data.queues);
  const state = useData((data) => data);
  const fmt = useFormat();
  const nomeDoMembro = useNomeDoMembro();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmingTrash, setConfirmingTrash] = useState(false);
  const [showingContact, setShowingContact] = useState(false);
  // C35 — a Tarefa nasce desta Conversa: Contato e Canal já dados, só a Lista é escolha.
  const [criandoTarefa, setCriandoTarefa] = useState(false);
  /*
    A aba de Canal começa na Conversa aberta e depois é livre: passar o Canal
    como prop controlada SEM o `onCanalChange` deixava a aba presa — o clique
    mudava o estado interno do thread e a prop o desfazia. A página é chaveada
    pela Conversa, então trocar de Conversa pela lista volta a aba para o Canal
    da nova.
  */
  const [canal, setCanal] = useState<Id | null>(null);
  // Um gesto por vez: o segundo clique, antes da resposta do primeiro, não grava de novo.
  const gravando = useRef(false);
  const { moving, openMoveConversation, closeMoveConversation } = useMoveConversationDialog();

  const lidoContato = useContato(conversation.contatoId);
  const contato = lidoContato.data?.contato;
  const nomeDoContato = contato ? nomeDeExibicaoDoContato(contato) : conversation.titulo;
  const empresa = lidoContato.data ? empresaDoContato(lidoContato.data.vinculos) : undefined;

  /*
    O que o cabeçalho precisa dizer é o NEGÓCIO, não a ficha inteira do Contato:
    quem abre a Conversa quer saber com quem fala, sobre o quê e quanto vale,
    e o resto entra sob demanda pelo botão de dados do Contato. A api devolve os
    Negócios por última alteração, então o primeiro é o que a pessoa está tratando.
  */
  const negociosAbertos = useNegocios({ contatoId: conversation.contatoId, situacao: "aberto" });
  const resumoDoNegocio = negociosAbertos.data?.itens[0];
  const negocioDetalhado = useNegocio(resumoDoNegocio?.id);
  const outrosNegocios = (negociosAbertos.data?.total ?? 0) - 1;
  const queue = queues.find((q) => q.id === conversation.filaId);
  const capabilities = capacidadesDoCanal({ channelType: channel.tipo, provider: channel.provedor });
  const inTrash = conversation.estado === "na_lixeira";
  const canalQuebrado = channel.conexao !== "conectada";

  const semEditar = usePodeNoCrm("editar", "conversa");
  const semResolver = usePodeNoCrm("resolver", "conversa");
  const semReabrir = usePodeNoCrm("reabrir", "conversa");
  const semMover = usePodeNoCrm("mover", "conversa");
  const semLixeira = usePodeNoCrm("enviar_para_lixeira", "conversa");
  const naLixeira = "Esta Conversa está na lixeira.";

  /*
    Executa um gesto da api. A recusa dela (ex.: resolver o que outra aba já
    resolveu) vira o aviso de erro e a Conversa é lida de novo, para o menu e o
    Atribuído voltarem a dizer o estado real.
  */
  const agir = async (gesto: () => Promise<unknown>, sucesso: string) => {
    if (gravando.current) return;
    gravando.current = true;
    try {
      await gesto();
      setError(null);
      setNotice(sucesso);
    } catch (falha) {
      setNotice(null);
      setError(falha instanceof Error ? falha.message : "Não foi possível concluir a operação.");
      void invalidarCrm("/conversas");
    } finally {
      gravando.current = false;
    }
  };

  const assignTo = (value: string) => {
    const atribuido: Atribuicao = value === "" ? null : { tipo: members.some((m) => m.id === value) ? "membro" : "agente", id: value };
    void agir(() => atribuirConversa(conversation.id, atribuido), atribuido ? "Conversa atribuída." : "Atribuição removida.");
  };

  // Sob a identidade do Contato, como "Etapa · Qualificação" na ficha do
  // Negócio: quem atende e em que situação a Conversa está.
  const atribuidoESituacao = (
    <div className="grid grid-cols-2 items-end gap-2">
      <span className="grid min-w-0 gap-1.5">
        <label className="app-sm" style={{ color: "var(--texto-3)" }} htmlFor="atribuido-da-conversa">
          Atribuído
        </label>
        {/* Membros e Agentes na mesma lista: o detalhe de cada opção diz qual é qual. */}
        <Select
          id="atribuido-da-conversa"
          value={conversation.atribuido?.id ?? ""}
          onChange={assignTo}
          disabled={inTrash || semEditar !== undefined}
          disabledReason={inTrash ? naLixeira : semEditar}
          options={[
            { value: "", label: "Sem Atribuído" },
            ...members.filter((member) => member.state === "ativo").map((member) => ({ value: member.id, label: member.displayName, detail: "Membro" })),
            ...agents.filter((agent) => agent.lifecycle === "ativo").map((agent) => ({ value: agent.id, label: agent.name, detail: "Agente" })),
          ]}
        />
      </span>
      <span className="grid min-w-0 gap-1.5">
        <span className="app-sm" style={{ color: "var(--texto-3)" }}>
          Situação
        </span>
        <span className="campo flex items-center" style={{ color: "var(--texto)" }}>
          {CONVERSATION_STATE_LABEL[conversation.situacao]}
        </span>
      </span>
    </div>
  );

  return (
    <InboxColumns>
      <PageHeader
        icon={<AvatarDoContato nome={contato?.nome} sobrenome={contato?.sobrenome} tamanho="grande" />}
        title={nomeDoContato}
        seal={<StateSeal state={inTrash ? "naLixeira" : conversation.estado} />}
        {...(empresa || canalQuebrado
          ? {
              meta: (
                /*
                  Só a Empresa. Situação, Canal, Fila e contagem de reaberturas são
                  roteamento, não o assunto da conversa — elas continuam na coluna de
                  dados do Contato. O aviso de Canal quebrado fica: esconder uma falha
                  faria a pessoa escrever para um Canal que não entrega.
                */
                <span className="flex flex-wrap items-center gap-3">
                  {empresa ? (
                    <span className="app-sm" style={{ color: "var(--texto-1)" }}>
                      {empresa.empresaNome}
                    </span>
                  ) : null}
                  {canalQuebrado ? (
                    <ConditionMarker tone={channel.conexao === "com_erro" ? "danger" : "warning"}>
                      Canal {channel.conexao === "com_erro" ? "com erro" : "desconectado"}
                    </ConditionMarker>
                  ) : null}
                </span>
              ),
            }
          : {})}
        details={
          resumoDoNegocio ? (
            /*
              Uma linha só: estes cinco são a leitura de relance do lead, e quebrar
              em duas fileiras faz o olho procurar onde a anterior terminou. Se a
              janela for estreita, a faixa rola na horizontal em vez de quebrar.
              A temperatura não está mais aqui: o Contato novo não a guarda (D-15-06).
            */
            <dl className="flex items-start gap-x-6 overflow-x-auto whitespace-nowrap pb-1">
              {[
                { rotulo: "Produto", valor: negocioDetalhado.data?.negocio.objeto || "—", icone: Briefcase },
                {
                  rotulo: "Valor do negócio",
                  valor: resumoDoNegocio.valor ? fmt.money({ amount: Number(resumoDoNegocio.valor), currency: resumoDoNegocio.moeda }) : "sem valor declarado",
                  icone: Wallet,
                },
                { rotulo: "Proprietário", valor: nomeDoMembro(resumoDoNegocio.proprietarioId), icone: UserIcon },
                { rotulo: "Origem", valor: negocioDetalhado.data?.negocio.origem || "—", icone: Link2 },
                {
                  rotulo: outrosNegocios > 0 ? `Negócio (+${outrosNegocios} aberto${outrosNegocios > 1 ? "s" : ""})` : "Negócio",
                  valor: resumoDoNegocio.titulo,
                  icone: Briefcase,
                  href: `/crm/negocios/${resumoDoNegocio.id}`,
                },
              ].map(({ rotulo, valor, icone, href }) => (
                <div key={rotulo} className="shrink-0">
                  <dt className="app-meta flex items-center gap-1.5">
                    <Icone de={icone} tamanho="xs" />
                    {rotulo}
                  </dt>
                  <dd className="app-md mt-0.5" style={{ color: "var(--texto)" }}>
                    {href ? (
                      <Link href={href} className="hover:underline">
                        {valor}
                      </Link>
                    ) : (
                      valor
                    )}
                  </dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="app-meta">
              {nomeDoContato} não tem Negócio aberto.{" "}
              <Link href="/crm/negocios?criar=negocio" className="underline" style={{ color: "var(--acento)" }}>
                Criar um Negócio
              </Link>
              .
            </p>
          )
        }
        actions={
          <>
            <Button onClick={() => setShowingContact((aberto) => !aberto)} icon={<Icone de={PanelRight} tamanho="sm" />}>
              {showingContact ? "Ocultar dados do Contato" : "Dados do Contato"}
            </Button>
            {/*
              Resolver, mover e descartar saíram da barra: são atos sobre a
              Conversa, não sobre o atendimento em curso, e ocupavam o cabeçalho
              inteiro. Ficam num só menu — sumir com eles tiraria do produto as
              únicas vias de fechar, reatribuir e descartar uma Conversa.
            */}
            <ActionMenu
              label="Ações da Conversa"
              items={[
                conversation.situacao === "resolvida"
                  ? {
                      label: "Reabrir",
                      onSelect: () => void agir(() => reabrirConversa(conversation.id), "Conversa reaberta."),
                      ...(inTrash ? { disabledReason: naLixeira } : semReabrir ? { disabledReason: semReabrir } : {}),
                    }
                  : {
                      label: "Resolver",
                      onSelect: () => void agir(() => resolverConversa(conversation.id), "Conversa resolvida."),
                      ...(inTrash ? { disabledReason: naLixeira } : semResolver ? { disabledReason: semResolver } : {}),
                    },
                {
                  label: "Mover para outro Contato",
                  onSelect: openMoveConversation,
                  ...(inTrash ? { disabledReason: naLixeira } : semMover ? { disabledReason: semMover } : {}),
                },
                {
                  label: "Enviar à lixeira",
                  onSelect: () => setConfirmingTrash(true),
                  destructive: true,
                  ...(conversation.situacao !== "resolvida" || inTrash
                    ? { disabledReason: inTrash ? "Já está na lixeira." : "Só uma Conversa resolvida pode ir para a lixeira." }
                    : semLixeira
                      ? { disabledReason: semLixeira }
                      : {}),
                },
              ]}
            />
          </>
        }
      />

      <MoveConversationDialog
        conversationId={conversation.id}
        contatoAtualId={conversation.contatoId}
        canalNome={channel.nome}
        open={moving}
        onClose={closeMoveConversation}
        onDone={(mensagem) => {
          setError(null);
          setNotice(mensagem);
        }}
      />

      {/* Chaveado pela Conversa: o Contato e o Canal iniciais do diálogo são os dela. */}
      <NovaTarefaConversacionalDialog
        key={conversation.id}
        open={criandoTarefa}
        contactId={conversation.contatoId}
        channelId={conversation.canalId}
        onClose={() => setCriandoTarefa(false)}
        onDone={(mensagem) => {
          setCriandoTarefa(false);
          setError(null);
          setNotice(mensagem);
        }}
      />

      <ConfirmDialog
        open={confirmingTrash}
        title="Enviar esta Conversa à lixeira?"
        description="As Mensagens continuam existindo e a Conversa pode ser restaurada enquanto estiver lá."
        confirmLabel="Enviar à lixeira"
        destructive
        onConfirm={() => {
          void agir(() => conversaParaLixeira(conversation.id), "Conversa enviada à lixeira.");
          setConfirmingTrash(false);
        }}
        onCancel={() => setConfirmingTrash(false)}
      />

      {/*
        Modelo do WhatsApp: a conversa ocupa o painel inteiro, sem moldura nem
        margem, e o compositor fica colado no rodapé. Os dados do Contato, quando
        pedidos, abrem como coluna à direita — não empurram a conversa para baixo.
      */}
      <div className="flex min-h-0 flex-1">
        {/* Chaveado pela Conversa: trocar de Conversa esmaece só este painel (150ms), nunca a coluna. */}
        <div key={conversation.id} className="aparecer flex min-h-0 min-w-0 flex-1 flex-col">
          {notice ? (
            <div className="shrink-0 px-4 pt-3">
              <Toast tone="success" onDismiss={() => setNotice(null)}>
                {notice}
              </Toast>
            </div>
          ) : null}
          {error ? (
            <div className="shrink-0 px-4 pt-3">
              <Toast tone="error" onDismiss={() => setError(null)}>
                {error}
              </Toast>
            </div>
          ) : null}

          {/*
            O mesmo thread da ficha do Contato e do Negócio: abas por Canal,
            anexos e janela de resposta. Uma Conversa é UM Canal, então a aba
            dele já abre selecionada.
          */}
          <div className="min-h-0 flex-1">
            <ConversationThread
              conversaId={conversation.id}
              contatoId={conversation.contatoId}
              canalPreferidoId={channel.id}
              canalSelecionado={canal ?? channel.id}
              onCanalChange={setCanal}
              flush
            />
          </div>
        </div>

        {/* A lateral é o CARTÃO DO CONTATO — o mesmo da ficha do Contato e do
            Negócio: identidade, ações rápidas, dados, resumo. O que é só da
            Conversa (Atribuído, Situação, Canal, Fila, Participantes,
            Capacidades) vem depois, na mesma família de painéis. */}
        <aside hidden={!showingContact} className="relative w-[22rem] shrink-0 overflow-y-auto p-3" style={{ borderLeft: "1px solid var(--linha)" }}>
          <div className="grid content-start gap-3">
            <ColunaDoContato contatoId={conversation.contatoId} somenteLeitura={inTrash} abaixo={atribuidoESituacao} onCanal={setCanal} />
            <TarefasDoContato
              contatoId={conversation.contatoId}
              onCriar={() => setCriandoTarefa(true)}
              rotuloDoBotao="Criar Tarefa a partir da Conversa"
            />

            <RecordPanel title="Conversa" icon={<Icone de={MessageSquare} tamanho="sm" />}>
              <dl>
                {[
                  { rotulo: "Canal", valor: channel.nome },
                  { rotulo: "Fila", valor: queue?.name ?? "sem Fila" },
                  ...(conversation.reaberturas > 0 ? [{ rotulo: "Reaberturas", valor: `${conversation.reaberturas}×` }] : []),
                ].map(({ rotulo, valor }) => (
                  <RecordRow key={rotulo} label={rotulo}>
                    {valor}
                  </RecordRow>
                ))}
              </dl>
              <p className="ajuda">Ser Atribuído não concede permissão de ver: o acesso vem do Papel e da Fila.</p>
            </RecordPanel>

            <RecordPanel title="Participantes" count={conversation.participantes.length} icon={<Icone de={Users} tamanho="sm" />}>
              {conversation.participantes.length === 0 ? (
                <EmptyState compact title="Nenhum Participante registrado." />
              ) : (
                <ul className="app-base grid gap-1" style={{ color: "var(--texto)" }}>
                  {conversation.participantes.map((participante) => (
                    <li key={participante.id}>
                      {rotuloDoParticipante(state, participante.sujeito, conversation.contatoId, nomeDoContato)}
                      {participante.principal ? " · principal" : ""}
                      {participante.saiuEm ? " · saiu" : ""}
                    </li>
                  ))}
                </ul>
              )}
            </RecordPanel>

            <RecordPanel title="Capacidades do Canal" icon={<Icone de={Radio} tamanho="sm" />}>
              <dl>
                <RecordRow label="Janela de resposta">
                  {capabilities.responseWindowHours === undefined ? "sem janela" : `${capabilities.responseWindowHours}h`}
                </RecordRow>
                <RecordRow label="Reações">{capabilities.reactions ? "sim" : "não"}</RecordRow>
                <RecordRow label="Grupos">{capabilities.groups ? "sim" : "não"}</RecordRow>
                <RecordRow label="Assunto e cópias">{capabilities.hasSubjectAndCopies ? "sim" : "não"}</RecordRow>
                <RecordRow label="Identidade anônima">{capabilities.anonymousIdentity ? "sim" : "não"}</RecordRow>
              </dl>
              <p className="ajuda">As capacidades são do tipo de Canal, não deste Canal nem desta Conversa.</p>
            </RecordPanel>
          </div>
        </aside>
      </div>
    </InboxColumns>
  );
}

function rotuloDoParticipante(
  state: Parameters<typeof actorLabel>[0],
  sujeito: { readonly tipo: "contato" | "membro" | "agente"; readonly id: string },
  contatoId: string,
  nomeDoContato: string,
): string {
  if (sujeito.tipo === "contato") return sujeito.id === contatoId ? nomeDoContato : "Contato";
  return actorLabel(state, { kind: sujeito.tipo === "membro" ? "member" : "agent", id: sujeito.id });
}
