"use client";

/**
 * O POPUP DO GRUPO — a ficha no formato da Tarefa (24). No centro: o tipo, o
 * selo, os marcadores e o menu; o nome grande e a descrição; as
 * propriedades em duas colunas (o espelhado do provedor à esquerda, as
 * Configurações e a Captação à direita — Toggles desligados dizem por quê);
 * e as seções Participações, Pedidos de Entrada, Links de Captação e a
 * Conversa de grupo. À direita, a Atividade. O mesmo componente serve à
 * página cheia (`modo="pagina"`).
 */

import Link from "next/link";
import { useId, useState } from "react";
import {
  ChevronRight,
  Fingerprint,
  Hash,
  Layers,
  Link2,
  Lock,
  Megaphone,
  MousePointerClick,
  Radio,
  RefreshCw,
  ShieldCheck,
  Type,
  UserPlus,
  Users,
  type LucideIcon,
} from "lucide-react";
import { useData, useRun } from "@/data/store";
import {
  adicionarNotaNoAtivo,
  arquivarGrupo,
  definirCanalDoGrupo,
  editarCaptacaoDoGrupo,
  editarGrupo,
  enviarGrupoALixeira,
  recusaExternaNoGrupo,
  regenerarLinkDeConvite,
  restaurarGrupo,
  restaurarGrupoDaLixeira,
  sairDoGrupo,
  sincronizarGrupo,
  zerarCliques,
} from "@/data/operations";
import { cliquesContabilizados, linksDoGrupo, marcadoresDoGrupo, motivoDeInelegibilidade, ocupacao, participacoesVigentes } from "@/data/derive-ferramentas";
import type { ConfiguracoesDoGrupo } from "@/data/types";
import { LinhaDeProp } from "@/features/estrutura/linha-de-propriedade";
import { AsideDeAtividade, EditorDeNumero, EditorDeTexto, useAvisos, useNomeDoAtor } from "@/features/shell/ficha";
import { useFormat } from "@/features/shell/use-format";
import { ActionMenu, Button, ConditionMarker, ConfirmDialog, CorpoDeTela, EmptyState, Icone, Pilula, ReguaDeSecao, Select, SidePanel, StateSeal, TextInput, Toggle } from "@/features/shell/ui";
import { ConversaDoGrupo } from "./conversa-do-grupo";
import { SecaoDeParticipacoes } from "./participacoes";
import { SecaoDePedidosDeEntrada } from "./pedidos-de-entrada";
import {
  CONFIGURACAO_DO_GRUPO_LABEL,
  FAIXA_DE_OCUPACAO_LABEL,
  FAIXA_DE_OCUPACAO_TOM,
  MARCADOR_DO_GRUPO_LABEL,
  MARCADOR_DO_GRUPO_TOM,
  ORIGEM_DE_CRIACAO_LABEL,
  PAPEL_DO_CANAL_LABEL,
  PAPEL_DO_CANAL_TOM,
  PAPEL_NA_COMUNIDADE_LABEL,
  SINCRONIZACAO_LABEL,
  SINCRONIZACAO_TOM,
  ocupacaoTexto,
} from "./rotulos";

export function GrupoPopup({ grupoId, onClose }: { readonly grupoId: string | null; readonly onClose: () => void }) {
  if (grupoId === null) return null;
  return (
    <SidePanel
      title="Grupo"
      open
      onClose={onClose}
      semRespiro
      footer={
        <span className="flex flex-1 items-center justify-end">
          <Link href={`/ferramentas/grupos/${grupoId}`} className="btn btn-fantasma btn-sm">
            Abrir em página cheia
          </Link>
        </span>
      }
    >
      <GrupoCompleto grupoId={grupoId} modo="popup" onClose={onClose} />
    </SidePanel>
  );
}

const ICONE_DA_CONFIGURACAO: Record<keyof ConfiguracoesDoGrupo, LucideIcon> = {
  somenteAdministradoresEnviam: Megaphone,
  somenteAdministradoresEditamDados: Lock,
  administradoresAprovamEntrada: ShieldCheck,
  somenteAdministradoresAdicionamParticipantes: UserPlus,
};

/** Um Toggle que cabe numa LinhaDeProp: o rótulo acessível é o da linha. */
function ToggleDeLinha({ rotulo, ligado, onChange, motivo }: { readonly rotulo: string; readonly ligado: boolean; readonly onChange: (v: boolean) => void; readonly motivo?: string }) {
  const id = useId();
  return (
    <span className="flex items-center gap-2" title={motivo}>
      <span id={id} hidden>
        {rotulo}
      </span>
      <Toggle checked={ligado} onChange={onChange} labelledBy={id} disabled={motivo !== undefined} />
      <span className="app-sm" style={{ color: "var(--texto-3)" }}>
        {ligado ? "sim" : "não"}
      </span>
    </span>
  );
}

export function GrupoCompleto({ grupoId, modo, onClose }: { readonly grupoId: string; readonly modo: "popup" | "pagina"; readonly onClose?: () => void }) {
  const state = useData((data) => data);
  const run = useRun();
  const fmt = useFormat();
  // Os avisos moram na própria ficha: um Toast na página ficaria atrás do véu do popup.
  const { avisos, report } = useAvisos();
  const authorLabel = useNomeDoAtor();
  const [confirmando, setConfirmando] = useState<"lixeira" | "sair" | "regenerar" | null>(null);
  const [nomeDigitado, setNomeDigitado] = useState("");

  const grupo = state.grupos.find((g) => g.id === grupoId);
  if (!grupo) {
    return (
      <div className="p-6">
        <EmptyState title="Grupo não encontrado." hint="Ele pode ter sido eliminado, ou você não tem permissão para vê-lo." />
      </div>
    );
  }

  const canal = state.channels.find((c) => c.id === grupo.canalId);
  const comunidade = state.comunidades.find((c) => c.id === grupo.comunidadeId);
  const externa = recusaExternaNoGrupo(state, grupo, "administrador");
  const naLixeira = grupo.lifecycle === "naLixeira";
  const editavelInterno = !naLixeira;
  const somenteLeitura = naLixeira ? "Um Grupo na lixeira é somente leitura." : undefined;
  const motivoAvisosCaptacao = grupo.papelNaComunidade === "avisos" ? "O Grupo de avisos não admite Captação ativa (INV-GRP-06)." : undefined;
  const o = ocupacao(grupo);
  const marcas = marcadoresDoGrupo(state, grupo);
  const activity = state.activity.filter((a) => a.objectId === grupo.id);
  const links = linksDoGrupo(state, grupo.id);
  const inelegivel = motivoDeInelegibilidade(state, grupo);
  const outrosAdmins = participacoesVigentes(grupo).filter((p) => p.papel === "administrador" && p.canalParticipanteId !== grupo.canalId).length;
  const sairIrreversivel = grupo.sincronizacao.papelDoCanal === "administrador" && outrosAdmins === 0;

  const gravar = (patch: Parameters<typeof editarGrupo>[3], mensagem: string) => report(run((data, me) => editarGrupo(data, me, grupo.id, patch)), mensagem);
  const gravarCaptacao = (patch: Parameters<typeof editarCaptacaoDoGrupo>[3], mensagem: string) => report(run((data, me) => editarCaptacaoDoGrupo(data, me, grupo.id, patch)), mensagem);

  const menu = [
    { label: "Sincronizar", onSelect: () => report(run((data, me) => sincronizarGrupo(data, me, grupo.id)), "Grupo sincronizado."), ...(naLixeira ? { disabledReason: "Na lixeira." } : {}) },
    grupo.lifecycle === "ativo"
      ? { label: "Arquivar", onSelect: () => report(run((data, me) => arquivarGrupo(data, me, grupo.id)), "Grupo arquivado. O grupo no provedor não muda (RN-GRP-04).") }
      : grupo.lifecycle === "arquivado"
        ? { label: "Restaurar", onSelect: () => report(run((data, me) => restaurarGrupo(data, me, grupo.id)), "Grupo restaurado.") }
        : { label: "Restaurar da lixeira", onSelect: () => report(run((data, me) => restaurarGrupoDaLixeira(data, me, grupo.id)), "Grupo restaurado: sincronize antes de qualquer Ferramenta externa.") },
    {
      label: "Sair do Grupo",
      destructive: true,
      onSelect: () => setConfirmando("sair"),
      ...(recusaExternaNoGrupo(state, grupo, "participante") ? { disabledReason: recusaExternaNoGrupo(state, grupo, "participante") } : {}),
    },
    {
      label: "Enviar à lixeira",
      destructive: true,
      onSelect: () => setConfirmando("lixeira"),
      ...(naLixeira ? { disabledReason: "Já está na lixeira." } : {}),
    },
  ];

  return (
    <div className="flex min-h-0 flex-1 flex-col" data-modo={modo}>
      <ConfirmDialog
        open={confirmando === "lixeira"}
        title={`Enviar “${grupo.nome}” à lixeira?`}
        description="O Grupo sai das listas e dos Links de Captação; o grupo no provedor e os participantes não mudam (RN-GRP-04). As Participações ficam na história."
        confirmLabel="Enviar à lixeira"
        destructive
        onConfirm={() => {
          const r = run((data, me) => enviarGrupoALixeira(data, me, grupo.id));
          setConfirmando(null);
          report(r, "Grupo enviado à lixeira.");
          if (r.ok) onClose?.();
        }}
        onCancel={() => setConfirmando(null)}
      />
      <ConfirmDialog
        open={confirmando === "sair"}
        title={`Sair de “${grupo.nome}”?`}
        description={
          sairIrreversivel
            ? "O Canal é o ÚNICO administrador: sair é irreversível, a plataforma perde o controle e o provedor pode dissolver o grupo (24, 20.6). Digite o nome do Grupo para confirmar."
            : `Há ${outrosAdmins} outro${outrosAdmins > 1 ? "s" : ""} administrador${outrosAdmins > 1 ? "es" : ""}: o grupo continua com ${outrosAdmins > 1 ? "eles" : "ele"}. O Grupo fica inacessível aqui; arquivar é outro ato.`
        }
        confirmLabel="Sair do Grupo"
        destructive
        {...(sairIrreversivel && nomeDigitado.trim() !== grupo.nome ? { confirmDisabledReason: "Digite o nome exato do Grupo." } : {})}
        onConfirm={() => {
          const r = run((data, me) => sairDoGrupo(data, me, grupo.id, { entendiIrreversivel: true }));
          setConfirmando(null);
          setNomeDigitado("");
          report(r, "O Canal saiu do Grupo. Ele ficou inacessível; arquive-o se não for voltar.");
        }}
        onCancel={() => {
          setConfirmando(null);
          setNomeDigitado("");
        }}
      >
        {sairIrreversivel ? <TextInput value={nomeDigitado} onChange={setNomeDigitado} placeholder={grupo.nome} /> : null}
      </ConfirmDialog>
      <ConfirmDialog
        open={confirmando === "regenerar"}
        title="Regenerar o Link de convite?"
        description="O endereço atual deixa de valer no provedor: quem o tem guardado não entra mais. Os Links de Captação não mudam — eles referenciam o Grupo, não o endereço (RN-GRP-06)."
        confirmLabel="Regenerar"
        destructive
        onConfirm={() => {
          setConfirmando(null);
          report(run((data, me) => regenerarLinkDeConvite(data, me, grupo.id)), "Link de convite regenerado.");
        }}
        onCancel={() => setConfirmando(null)}
      />

      <div className="@container flex min-h-0 flex-1">
        <div className="flex min-h-0 flex-1 flex-col @4xl:flex-row">
          <CorpoDeTela>
            {avisos}

            <div className="@container mx-auto w-full max-w-4xl">
              <div className="flex flex-wrap items-center gap-2">
                <Pilula cor="var(--info)" className="gap-1.5">
                  <Icone de={Users} tamanho="xs" />
                  Grupo
                </Pilula>
                <StateSeal state={grupo.lifecycle} />
                {grupo.papelNaComunidade === "avisos" ? <Pilula tom="info">Grupo de avisos</Pilula> : null}
                {marcas.map((m) => (
                  <ConditionMarker key={m} tone={MARCADOR_DO_GRUPO_TOM[m]}>
                    {MARCADOR_DO_GRUPO_LABEL[m]}
                  </ConditionMarker>
                ))}
                <span className="ml-auto flex items-center gap-1">
                  <ActionMenu items={menu} />
                </span>
              </div>

              <h1 className="ed-display mt-3 px-2 py-1">{grupo.nome}</h1>
              <LinhaDeProp
                icone={Type}
                rotulo="Descrição"
                valor={grupo.descricao || "Adicionar descrição…"}
                editavel={editavelInterno && !externa}
                motivo={somenteLeitura ?? externa}
                editor={<EditorDeTexto valor={grupo.descricao} onSave={(v) => gravar({ descricao: v }, "Descrição alterada no provedor.")} placeholder="Para que serve este grupo" />}
              />

              <div className="mt-4 grid gap-x-8 gap-y-0.5 @3xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                <div className="grid min-w-0 content-start gap-0.5">
                  <LinhaDeProp
                    icone={Users}
                    rotulo="Nome"
                    valor={grupo.nome}
                    editavel={editavelInterno && !externa}
                    motivo={somenteLeitura ?? externa}
                    editor={<EditorDeTexto valor={grupo.nome} onSave={(v) => gravar({ nome: v }, "Nome alterado no provedor.")} placeholder="Nome do grupo" />}
                  />
                  <LinhaDeProp
                    icone={Radio}
                    rotulo="Canal administrador"
                    valor={canal ? canal.name : "Nenhum — órfão"}
                    editavel={editavelInterno}
                    motivo={somenteLeitura ?? "Trocar o Canal exige administrar; o novo Canal precisa conferir o Grupo."}
                    editor={
                      <span className="block w-64">
                        <Select
                          value={grupo.canalId ?? ""}
                          onChange={(v) => report(run((data, me) => definirCanalDoGrupo(data, me, grupo.id, v)), "Canal administrador alterado: sincronize.")}
                          placeholder="Escolher o Canal"
                          options={state.channels.filter((c) => c.channelType === "whatsapp" && c.lifecycle === "ativo").map((c) => ({ value: c.id, label: c.name, detail: c.connection }))}
                        />
                      </span>
                    }
                  />
                  <LinhaDeProp icone={ShieldCheck} rotulo="Papel do Canal" valor={<Pilula tom={PAPEL_DO_CANAL_TOM[grupo.sincronizacao.papelDoCanal]}>{PAPEL_DO_CANAL_LABEL[grupo.sincronizacao.papelDoCanal]}</Pilula>} motivo="Vem da Sincronização: o provedor diz o que o Canal é no grupo." />
                  <LinhaDeProp
                    icone={Users}
                    rotulo="Ocupação"
                    valor={
                      <span className="flex items-center gap-1.5">
                        <span className="app-numero">{ocupacaoTexto(o.vigentes, o.teto, fmt.number)}</span>
                        <Pilula tom={FAIXA_DE_OCUPACAO_TOM[o.faixa]}>{FAIXA_DE_OCUPACAO_LABEL[o.faixa]}</Pilula>
                        {o.teto !== o.capacidade ? <span className="app-meta">· Capacidade {fmt.number(o.capacidade)}</span> : null}
                      </span>
                    }
                    motivo="Participações vigentes sobre o teto: derivada, nunca gravada (24, 6)."
                  />
                  <LinhaDeProp
                    icone={Link2}
                    rotulo="Link de convite"
                    controle={
                      grupo.linkDeConvite ? (
                        <span className="flex min-w-0 flex-wrap items-center gap-1.5">
                          <span className="identificador min-w-0 break-all">{grupo.linkDeConvite.endereco}</span>
                          <Pilula tom={grupo.linkDeConvite.estado === "valido" ? "sucesso" : grupo.linkDeConvite.estado === "invalido" ? "erro" : "neutro"}>{grupo.linkDeConvite.estado === "valido" ? "válido" : grupo.linkDeConvite.estado === "invalido" ? "inválido" : "desconhecido"}</Pilula>
                          <Button size="sm" variant="ghost" onClick={() => setConfirmando("regenerar")} disabled={externa !== undefined} {...(externa ? { disabledReason: externa } : {})}>
                            Regenerar
                          </Button>
                        </span>
                      ) : (
                        <span className="app-base" style={{ color: "var(--texto)" }}>
                          Ausente — o provedor só entrega a administradores
                        </span>
                      )
                    }
                  />
                  <LinhaDeProp
                    icone={RefreshCw}
                    rotulo="Sincronização"
                    valor={
                      <span className="flex flex-wrap items-center gap-1.5">
                        <Pilula tom={SINCRONIZACAO_TOM[grupo.sincronizacao.estado]}>{SINCRONIZACAO_LABEL[grupo.sincronizacao.estado]}</Pilula>
                        {grupo.sincronizacao.conferidoEm ? <span className="app-meta">{fmt.relative(grupo.sincronizacao.conferidoEm)}</span> : null}
                        {grupo.sincronizacao.detalhe ? <span className="app-meta">· {grupo.sincronizacao.detalhe}</span> : null}
                      </span>
                    }
                    motivo="Muda por “Sincronizar”."
                  />
                  <LinhaDeProp icone={Fingerprint} rotulo="Identificador externo" valor={<span className="identificador">{grupo.identificadorExterno ?? "—"}</span>} motivo="Como o provedor identifica o grupo (INV-GRP-01)." />
                  <LinhaDeProp icone={Hash} rotulo="Origem" valor={ORIGEM_DE_CRIACAO_LABEL[grupo.origemDeCriacao]} motivo="Imutável." />
                </div>

                <div className="grid min-w-0 content-start gap-0.5">
                  {(Object.keys(CONFIGURACAO_DO_GRUPO_LABEL) as Array<keyof ConfiguracoesDoGrupo>).map((chave) => (
                    <LinhaDeProp
                      key={chave}
                      icone={ICONE_DA_CONFIGURACAO[chave]}
                      rotulo={CONFIGURACAO_DO_GRUPO_LABEL[chave].curto}
                      controle={
                        <ToggleDeLinha
                          rotulo={CONFIGURACAO_DO_GRUPO_LABEL[chave].titulo}
                          ligado={grupo.configuracoes[chave]}
                          onChange={(v) => gravar({ configuracoes: { [chave]: v } }, `${CONFIGURACAO_DO_GRUPO_LABEL[chave].titulo}: ${v ? "sim" : "não"} — alterado no provedor.`)}
                          motivo={somenteLeitura ?? externa}
                        />
                      }
                    />
                  ))}
                  <LinhaDeProp
                    icone={MousePointerClick}
                    rotulo="Captação ativa"
                    controle={<ToggleDeLinha rotulo="Captação ativa" ligado={grupo.captacao.estado === "ativa"} onChange={(v) => gravarCaptacao({ estado: v ? "ativa" : "inativa" }, v ? "Captação ativada." : "Captação inativada: o Grupo sai dos Links, nada muda no provedor.")} motivo={somenteLeitura ?? motivoAvisosCaptacao} />}
                  />
                  <LinhaDeProp
                    icone={MousePointerClick}
                    rotulo="Limite de cliques"
                    valor={grupo.captacao.limiteDeCliques !== undefined ? fmt.number(grupo.captacao.limiteDeCliques) : "Sem limite"}
                    editavel={editavelInterno}
                    motivo={somenteLeitura}
                    editor={<EditorDeNumero valor={grupo.captacao.limiteDeCliques} onSave={(n) => gravarCaptacao({ limiteDeCliques: n ?? 0 }, "Limite de cliques alterado.")} placeholder="Sem limite" />}
                  />
                  <LinhaDeProp
                    icone={Users}
                    rotulo="Teto de captação"
                    valor={grupo.captacao.tetoDeCaptacao !== undefined ? fmt.number(grupo.captacao.tetoDeCaptacao) : `A Capacidade (${fmt.number(grupo.capacidade)})`}
                    editavel={editavelInterno}
                    motivo={somenteLeitura}
                    editor={<EditorDeNumero valor={grupo.captacao.tetoDeCaptacao} onSave={(n) => gravarCaptacao(n === undefined ? { tetoDeCaptacao: undefined } : { tetoDeCaptacao: n }, "Teto de captação alterado (RN-GRP-09).")} placeholder="A Capacidade" />}
                  />
                  <LinhaDeProp
                    icone={MousePointerClick}
                    rotulo="Cliques contabilizados"
                    controle={
                      <span className="flex items-center gap-1.5">
                        <span className="app-numero">{fmt.number(cliquesContabilizados(state, grupo))}</span>
                        <Button size="sm" variant="ghost" onClick={() => report(run((data, me) => zerarCliques(data, me, grupo.id)), "Cliques zerados (RN-GRP-08).")} disabled={naLixeira} disabledReason="Na lixeira.">
                          Zerar
                        </Button>
                      </span>
                    }
                  />
                  <LinhaDeProp
                    icone={Layers}
                    rotulo="Comunidade"
                    controle={
                      comunidade ? (
                        <span className="flex items-center gap-1.5">
                          <Link href={`/ferramentas/comunidades?comunidade=${comunidade.id}`} className="hover:underline">
                            {comunidade.nome}
                          </Link>
                          {grupo.papelNaComunidade ? <Pilula tom={grupo.papelNaComunidade === "avisos" ? "info" : "neutro"}>{PAPEL_NA_COMUNIDADE_LABEL[grupo.papelNaComunidade]}</Pilula> : null}
                          {comunidade.lifecycle === "arquivado" ? <ConditionMarker tone="warning">Comunidade arquivada</ConditionMarker> : null}
                        </span>
                      ) : (
                        <span className="app-base" style={{ color: "var(--texto)" }}>
                          Nenhuma
                        </span>
                      )
                    }
                  />
                  <LinhaDeProp icone={ChevronRight} rotulo="Estado" valor={grupo.lifecycle === "ativo" ? "Ativo" : <StateSeal state={grupo.lifecycle} />} motivo="O estado muda por um ato: arquivar, a lixeira, a restauração." />
                </div>
              </div>

              <hr className="my-6 border-0" style={{ borderTop: "1px solid var(--linha)" }} />

              <div className="grid gap-6">
                <SecaoDeParticipacoes grupo={grupo} report={report} />
                <SecaoDePedidosDeEntrada grupo={grupo} report={report} />

                <section>
                  <ReguaDeSecao rotulo="Links de Captação" contagem={links.length} />
                  {inelegivel ? (
                    <p className="app-sm mb-2" style={{ color: "var(--aviso)" }}>
                      Não recebe cliques agora: {inelegivel}
                    </p>
                  ) : null}
                  {links.length === 0 ? (
                    <EmptyState compact title="Nenhum Link aponta para este Grupo." hint={grupo.papelNaComunidade === "avisos" ? "O Grupo de avisos nunca é elegível (RN-COM-07)." : "Crie um Link na aba Grupos e escolha este Grupo como elegível."} />
                  ) : (
                    <ul className="pilha-solta">
                      {links.map((l) => (
                        <li key={l.id} className="item-solto">
                          <Icone de={Link2} tamanho="xs" style={{ color: "var(--texto-3)" }} />
                          <span className="min-w-0 flex-1">
                            <span className="app-md block truncate" style={{ color: "var(--texto)" }}>
                              {l.nome}
                            </span>
                            <span className="app-meta block truncate">
                              /l/{l.slug} · {l.cliques.filter((c) => c.grupoId === grupo.id).length} clique(s) para este Grupo
                            </span>
                          </span>
                          <Pilula tom={l.ativo ? "sucesso" : "neutro"}>{l.ativo ? "ativo" : "inativo"}</Pilula>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>

                <section>
                  <ReguaDeSecao rotulo="Conversa de grupo" />
                  <ConversaDoGrupo grupoId={grupo.id} report={report} {...(grupo.papelNaComunidade === "avisos" ? { nota: "Todos os membros da Comunidade leem; só administradores publicam." } : {})} />
                </section>
              </div>
            </div>
          </CorpoDeTela>

          <AsideDeAtividade
            comments={grupo.comments}
            activity={activity}
            onAddNote={(texto) => run((data, me) => adicionarNotaNoAtivo(data, me, "grupo", grupo.id, texto))}
            editavel={editavelInterno}
            authorLabel={authorLabel}
            report={report}
            vazioDoRegistro="Nenhum Registro de Atividade neste Grupo."
            vazioDica="O que você escrever aqui fica no Grupo, com autor e hora — não vai para o grupo do WhatsApp."
          />
        </div>
      </div>
    </div>
  );
}
