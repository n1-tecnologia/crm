"use client";

/**
 * O POPUP DA COMUNIDADE — a ficha no formato da Tarefa (25). As propriedades
 * espelhadas e as duas Configurações; a seção Grupos (o de avisos primeiro,
 * depois os comuns, cada um com a Ocupação e o Papel do Canal NAQUELE Grupo —
 * 20.3) com vincular e desvincular; e "Enviar à Comunidade", que fala no
 * Grupo de avisos (RN-COM-05) — com o botão desligado que explica por que
 * "enviar a todos os Grupos" é Automação, não Ferramenta (DO-COM-05).
 */

import Link from "next/link";
import { useId, useState } from "react";
import { ChevronRight, Fingerprint, Hash, Layers, Megaphone, Radio, RefreshCw, ShieldCheck, Type, UserPlus, Users, type LucideIcon } from "lucide-react";
import { useData, useRun } from "@/dados/store";
import {
  MOTIVO_SEM_ENVIO_A_TODOS,
  adicionarNotaNoAtivo,
  enviarMensagemAComunidade,
  alterarConfiguracoesDaComunidade,
  arquivarComunidade,
  desvincularGrupoDaComunidade,
  editarComunidade,
  enviarComunidadeALixeira,
  recusaDeAdministracao,
  recusaDeVinculo,
  recusaExternaNaComunidade,
  recusaExternaNoGrupo,
  restaurarComunidade,
  restaurarComunidadeDaLixeira,
  sairDaComunidade,
  sincronizarComunidade,
  vincularGrupoAComunidade,
} from "@n1/dominio/operations";
import { grupoDeAvisos, gruposDaComunidade, marcadoresDaComunidade, membrosDaComunidade, ocupacao, ocupacaoAgregada } from "@n1/dominio/derive-ferramentas";
import type { Comunidade, ConfiguracoesDaComunidade } from "@n1/dominio/types";
import { LinhaDeProp } from "@/features/estrutura/linha-de-propriedade";
import { AsideDeAtividade, EditorDeTexto, useAvisos, useNomeDoAtor, type Report } from "@/features/shell/ficha";
import { useFormat } from "@/features/shell/use-format";
import { useSession } from "@/dados/store";
import { ActionMenu, Button, ConditionMarker, ConfirmDialog, CorpoDeTela, EmptyState, Field, Icone, Pilula, ReguaDeSecao, Select, SidePanel, StateSeal, TextInput, Toggle } from "@/features/shell/ui";
import { ConversaDoGrupo } from "./conversa-do-grupo";
import {
  CONFIGURACAO_DA_COMUNIDADE_LABEL,
  FAIXA_DE_OCUPACAO_LABEL,
  FAIXA_DE_OCUPACAO_TOM,
  MARCADOR_DA_COMUNIDADE_LABEL,
  MARCADOR_DA_COMUNIDADE_TOM,
  ORIGEM_DE_CRIACAO_LABEL,
  PAPEL_DO_CANAL_LABEL,
  PAPEL_DO_CANAL_TOM,
  PAPEL_NA_COMUNIDADE_LABEL,
  SINCRONIZACAO_LABEL,
  SINCRONIZACAO_TOM,
  ocupacaoTexto,
} from "./rotulos";

export function ComunidadePopup({ comunidadeId, onClose }: { readonly comunidadeId: string | null; readonly onClose: () => void }) {
  if (comunidadeId === null) return null;
  return (
    <SidePanel
      title="Comunidade"
      open
      onClose={onClose}
      semRespiro
      footer={
        <span className="flex flex-1 items-center justify-end">
          <Link href={`/ferramentas/comunidades/${comunidadeId}`} className="btn btn-fantasma btn-sm">
            Abrir em página cheia
          </Link>
        </span>
      }
    >
      <ComunidadeCompleta comunidadeId={comunidadeId} modo="popup" onClose={onClose} />
    </SidePanel>
  );
}

const ICONE_DA_CONFIGURACAO: Record<keyof ConfiguracoesDaComunidade, LucideIcon> = {
  somenteAdministradoresAdicionamGrupos: Layers,
  somenteAdministradoresAdicionamParticipantes: UserPlus,
};

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

export function ComunidadeCompleta({ comunidadeId, modo, onClose }: { readonly comunidadeId: string; readonly modo: "popup" | "pagina"; readonly onClose?: () => void }) {
  const state = useData((data) => data);
  const run = useRun();
  const fmt = useFormat();
  const { memberId } = useSession();
  const { avisos: toasts, report } = useAvisos();
  const authorLabel = useNomeDoAtor();
  const [confirmando, setConfirmando] = useState<"lixeira" | "sair" | null>(null);
  const [nomeDigitado, setNomeDigitado] = useState("");
  const [vinculando, setVinculando] = useState(false);

  const comunidade = state.comunidades.find((c) => c.id === comunidadeId);
  if (!comunidade) {
    return (
      <div className="p-6">
        <EmptyState title="Comunidade não encontrada." hint="Ela pode ter sido eliminada, ou você não tem permissão para vê-la." />
      </div>
    );
  }

  const canal = state.channels.find((c) => c.id === comunidade.canalId);
  const externa = recusaExternaNaComunidade(state, comunidade, "administrador");
  const adm = recusaDeAdministracao(state, memberId);
  const naLixeira = comunidade.lifecycle === "naLixeira";
  const somenteLeitura = naLixeira ? "Uma Comunidade na lixeira é somente leitura." : undefined;
  const grupos = gruposDaComunidade(state, comunidade.id).sort((a, b) => (a.papelNaComunidade === "avisos" ? 0 : 1) - (b.papelNaComunidade === "avisos" ? 0 : 1) || a.nome.localeCompare(b.nome, "pt-BR"));
  const avisos = grupoDeAvisos(state, comunidade.id);
  const membros = membrosDaComunidade(state, comunidade.id);
  const agregada = ocupacaoAgregada(state, comunidade.id);
  const marcas = marcadoresDaComunidade(state, comunidade);
  const activity = state.activity.filter((a) => a.objectId === comunidade.id);
  const sairIrreversivel = comunidade.sincronizacao.papelDoCanal === "administrador";

  const gravar = (patch: Parameters<typeof editarComunidade>[3], mensagem: string) => report(run((data, me) => editarComunidade(data, me, comunidade.id, patch)), mensagem);

  const menu = [
    { label: "Sincronizar", onSelect: () => report(run((data, me) => sincronizarComunidade(data, me, comunidade.id)), "Comunidade sincronizada."), ...(naLixeira ? { disabledReason: "Na lixeira." } : {}) },
    comunidade.lifecycle === "ativo"
      ? { label: "Arquivar", onSelect: () => report(run((data, me) => arquivarComunidade(data, me, comunidade.id)), "Comunidade arquivada. Os Grupos não mudam (INV-COM-01).") }
      : comunidade.lifecycle === "arquivado"
        ? { label: "Restaurar", onSelect: () => report(run((data, me) => restaurarComunidade(data, me, comunidade.id)), "Comunidade restaurada.") }
        : { label: "Restaurar da lixeira", onSelect: () => report(run((data, me) => restaurarComunidadeDaLixeira(data, me, comunidade.id)), "Comunidade restaurada: sincronize antes de qualquer Ferramenta externa.") },
    { label: "Sair da Comunidade", destructive: true, onSelect: () => setConfirmando("sair"), ...(adm ? { disabledReason: adm } : recusaExternaNaComunidade(state, comunidade, "participante") ? { disabledReason: recusaExternaNaComunidade(state, comunidade, "participante") } : {}) },
    { label: "Enviar à lixeira", destructive: true, onSelect: () => setConfirmando("lixeira"), ...(naLixeira ? { disabledReason: "Já está na lixeira." } : {}) },
  ];

  return (
    <div className="flex min-h-0 flex-1 flex-col" data-modo={modo}>
      <ConfirmDialog
        open={confirmando === "lixeira"}
        title={`Enviar “${comunidade.nome}” à lixeira?`}
        description="Nada muda no provedor nem nos Grupos (INV-ATV-05, INV-COM-01). O Grupo de avisos fica com a referência."
        confirmLabel="Enviar à lixeira"
        destructive
        onConfirm={() => {
          const r = run((data, me) => enviarComunidadeALixeira(data, me, comunidade.id));
          setConfirmando(null);
          report(r, "Comunidade enviada à lixeira.");
          if (r.ok) onClose?.();
        }}
        onCancel={() => setConfirmando(null)}
      />
      <ConfirmDialog
        open={confirmando === "sair"}
        title={`Sair de “${comunidade.nome}”?`}
        description={
          sairIrreversivel
            ? "O Canal administra a Comunidade: sair é irreversível — o provedor pode dissolvê-la e desvincular todos os grupos. O Canal sai também do Grupo de avisos; os Grupos comuns PERMANECEM com ele (RN-COM-08). Digite o nome para confirmar."
            : "O Canal sai da comunidade e do Grupo de avisos; os Grupos comuns permanecem com ele (RN-COM-08)."
        }
        confirmLabel="Sair da Comunidade"
        destructive
        {...(sairIrreversivel && nomeDigitado.trim() !== comunidade.nome ? { confirmDisabledReason: "Digite o nome exato da Comunidade." } : {})}
        onConfirm={() => {
          const r = run((data, me) => sairDaComunidade(data, me, comunidade.id, { entendiIrreversivel: true }));
          setConfirmando(null);
          setNomeDigitado("");
          report(r, "O Canal saiu da Comunidade. Ela ficou inacessível; arquive-a se não for voltar.");
        }}
        onCancel={() => {
          setConfirmando(null);
          setNomeDigitado("");
        }}
      >
        {sairIrreversivel ? <TextInput value={nomeDigitado} onChange={setNomeDigitado} placeholder={comunidade.nome} /> : null}
      </ConfirmDialog>
      {vinculando ? <VincularGrupoDialog comunidade={comunidade} onClose={() => setVinculando(false)} report={report} /> : null}

      <div className="@container flex min-h-0 flex-1">
        <div className="flex min-h-0 flex-1 flex-col @4xl:flex-row">
          <CorpoDeTela>
            {toasts}
            <div className="@container mx-auto w-full max-w-4xl">
              <div className="flex flex-wrap items-center gap-2">
                <Pilula cor="var(--info)" className="gap-1.5">
                  <Icone de={Layers} tamanho="xs" />
                  Comunidade
                </Pilula>
                <StateSeal state={comunidade.lifecycle} />
                {marcas.map((m) => (
                  <ConditionMarker key={m} tone={MARCADOR_DA_COMUNIDADE_TOM[m]}>
                    {MARCADOR_DA_COMUNIDADE_LABEL[m]}
                  </ConditionMarker>
                ))}
                <span className="ml-auto">
                  <ActionMenu items={menu} />
                </span>
              </div>

              <h1 className="ed-display mt-3 px-2 py-1">{comunidade.nome}</h1>
              <LinhaDeProp
                icone={Type}
                rotulo="Descrição"
                valor={comunidade.descricao || "Adicionar descrição…"}
                editavel={!naLixeira && !externa}
                motivo={somenteLeitura ?? externa}
                editor={<EditorDeTexto valor={comunidade.descricao} onSave={(v) => gravar({ descricao: v }, "Descrição alterada no provedor.")} placeholder="Para que serve esta Comunidade" />}
              />

              <div className="mt-4 grid gap-x-8 gap-y-0.5 @3xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                <div className="grid min-w-0 content-start gap-0.5">
                  <LinhaDeProp icone={Layers} rotulo="Nome" valor={comunidade.nome} editavel={!naLixeira && !externa} motivo={somenteLeitura ?? externa} editor={<EditorDeTexto valor={comunidade.nome} onSave={(v) => gravar({ nome: v }, "Nome alterado no provedor.")} />} />
                  <LinhaDeProp icone={Radio} rotulo="Canal administrador" valor={canal ? canal.name : "Nenhum — órfã"} motivo="A Comunidade nasce no Canal que a criou ou importou." />
                  <LinhaDeProp icone={ShieldCheck} rotulo="Papel do Canal" valor={<Pilula tom={PAPEL_DO_CANAL_TOM[comunidade.sincronizacao.papelDoCanal]}>{PAPEL_DO_CANAL_LABEL[comunidade.sincronizacao.papelDoCanal]}</Pilula>} motivo="Vem da Sincronização." />
                  <LinhaDeProp icone={Layers} rotulo="Grupos vinculados" valor={<span className="app-numero">{fmt.number(grupos.length)} / {fmt.number(comunidade.limiteDeGruposDoProvedor)}</span>} motivo="Inclui o Grupo de avisos; o limite é do provedor." />
                  <LinhaDeProp icone={Users} rotulo="Membros" valor={<span className="app-numero">{fmt.number(membros.length)}</span>} motivo="União das Participações vigentes dos Grupos comuns; um Contato conta uma vez (RN-COM-06)." />
                  <LinhaDeProp icone={Users} rotulo="Ocupação agregada" valor={<span className="app-numero">{ocupacaoTexto(agregada.vigentes, agregada.capacidade, fmt.number)}</span>} motivo="Soma das vigentes sobre a soma das Capacidades dos Grupos comuns." />
                </div>
                <div className="grid min-w-0 content-start gap-0.5">
                  {(Object.keys(CONFIGURACAO_DA_COMUNIDADE_LABEL) as Array<keyof ConfiguracoesDaComunidade>).map((chave) => (
                    <LinhaDeProp
                      key={chave}
                      icone={ICONE_DA_CONFIGURACAO[chave]}
                      rotulo={CONFIGURACAO_DA_COMUNIDADE_LABEL[chave].curto}
                      controle={
                        <ToggleDeLinha
                          rotulo={CONFIGURACAO_DA_COMUNIDADE_LABEL[chave].titulo}
                          ligado={comunidade.configuracoes[chave]}
                          onChange={(v) => report(run((data, me) => alterarConfiguracoesDaComunidade(data, me, comunidade.id, { [chave]: v })), `${CONFIGURACAO_DA_COMUNIDADE_LABEL[chave].titulo}: ${v ? "sim" : "não"} — alterado no provedor.`)}
                          motivo={somenteLeitura ?? externa}
                        />
                      }
                    />
                  ))}
                  <LinhaDeProp
                    icone={Megaphone}
                    rotulo="Grupo de avisos"
                    controle={avisos ? <Link href={`/ferramentas/grupos?grupo=${avisos.id}`} className="app-base hover:underline" style={{ color: "var(--texto)" }}>{avisos.nome}</Link> : <ConditionMarker tone="danger">ausente</ConditionMarker>}
                  />
                  <LinhaDeProp
                    icone={RefreshCw}
                    rotulo="Sincronização"
                    valor={
                      <span className="flex flex-wrap items-center gap-1.5">
                        <Pilula tom={SINCRONIZACAO_TOM[comunidade.sincronizacao.estado]}>{SINCRONIZACAO_LABEL[comunidade.sincronizacao.estado]}</Pilula>
                        {comunidade.sincronizacao.conferidoEm ? <span className="app-meta">{fmt.relative(comunidade.sincronizacao.conferidoEm)}</span> : null}
                        {comunidade.sincronizacao.detalhe ? <span className="app-meta">· {comunidade.sincronizacao.detalhe}</span> : null}
                      </span>
                    }
                    motivo="Muda por “Sincronizar”."
                  />
                  <LinhaDeProp icone={Fingerprint} rotulo="Identificador externo" valor={<span className="identificador">{comunidade.identificadorExterno ?? "—"}</span>} motivo="Como o provedor identifica a comunidade." />
                  <LinhaDeProp icone={Hash} rotulo="Origem" valor={ORIGEM_DE_CRIACAO_LABEL[comunidade.origemDeCriacao]} motivo="Imutável." />
                  <LinhaDeProp icone={ChevronRight} rotulo="Estado" valor={comunidade.lifecycle === "ativo" ? "Ativa" : <StateSeal state={comunidade.lifecycle} />} motivo="O estado muda por um ato." />
                </div>
              </div>

              <hr className="my-6 border-0" style={{ borderTop: "1px solid var(--linha)" }} />

              <div className="grid gap-6">
                <section>
                  <ReguaDeSecao
                    rotulo="Grupos"
                    contagem={grupos.length}
                    acao={
                      <Button size="sm" onClick={() => setVinculando(true)} disabled={(adm ?? externa) !== undefined} {...(adm ?? externa ? { disabledReason: adm ?? externa } : {})}>
                        Vincular Grupo
                      </Button>
                    }
                  />
                  {grupos.length === 0 ? (
                    <EmptyState compact title="Nenhum Grupo vinculado." hint="Vincule um Grupo existente do mesmo Canal, ou crie um Grupo já dentro da Comunidade." />
                  ) : (
                    <table className="tabela">
                      <thead>
                        <tr>
                          <th className="app-coluna">Nome</th>
                          <th className="app-coluna">Papel</th>
                          <th className="app-coluna">Ocupação</th>
                          <th className="app-coluna">Canal neste Grupo</th>
                          <th className="app-coluna">Vinculado</th>
                          <th className="app-coluna" data-vazia="true" aria-label="Ações" />
                        </tr>
                      </thead>
                      <tbody>
                        {grupos.map((g) => {
                          const o = ocupacao(g);
                          const ehAvisos = g.papelNaComunidade === "avisos";
                          return (
                            <tr key={g.id}>
                              <td className="max-w-[28ch] whitespace-nowrap">
                                <span className="flex min-w-0 items-center gap-1.5">
                                  <Link href={`/ferramentas/grupos?grupo=${g.id}`} className="app-md min-w-0 truncate hover:underline" style={{ color: "var(--texto)" }} title={g.nome}>
                                    {g.nome}
                                  </Link>
                                  <StateSeal state={g.lifecycle} />
                                </span>
                              </td>
                              <td className="whitespace-nowrap">
                                <Pilula tom={ehAvisos ? "info" : "neutro"}>{g.papelNaComunidade ? PAPEL_NA_COMUNIDADE_LABEL[g.papelNaComunidade] : "comum"}</Pilula>
                              </td>
                              <td className="whitespace-nowrap">
                                <span className="flex items-center gap-1.5">
                                  <span className="app-numero">{ocupacaoTexto(o.vigentes, o.teto, fmt.number)}</span>
                                  <Pilula tom={FAIXA_DE_OCUPACAO_TOM[o.faixa]}>{FAIXA_DE_OCUPACAO_LABEL[o.faixa]}</Pilula>
                                </span>
                              </td>
                              <td className="whitespace-nowrap">
                                <Pilula tom={PAPEL_DO_CANAL_TOM[g.sincronizacao.papelDoCanal]}>{PAPEL_DO_CANAL_LABEL[g.sincronizacao.papelDoCanal]}</Pilula>
                              </td>
                              <td className="whitespace-nowrap">
                                <span className="app-sm" style={{ color: "var(--texto-2)" }}>
                                  {g.vinculadoAComunidadeEm ? fmt.relative(g.vinculadoAComunidadeEm) : "—"}
                                </span>
                              </td>
                              <td>
                                <ActionMenu
                                  items={[
                                    {
                                      label: "Desvincular",
                                      destructive: true,
                                      onSelect: () => report(run((data, me) => desvincularGrupoDaComunidade(data, me, comunidade.id, g.id)), `${g.nome} desvinculado; Participações intactas.`),
                                      ...(ehAvisos ? { disabledReason: "O Grupo de avisos não é desvinculável (INV-COM-02)." } : adm ? { disabledReason: adm } : externa ? { disabledReason: externa } : {}),
                                    },
                                  ]}
                                />
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </section>

                <section>
                  <ReguaDeSecao
                    rotulo="Enviar à Comunidade"
                    acao={
                      <Button size="sm" variant="ghost" disabled disabledReason={MOTIVO_SEM_ENVIO_A_TODOS}>
                        Enviar a todos os Grupos
                      </Button>
                    }
                  />
                  {avisos ? (
                    <ConversaDoGrupo
                      grupoId={avisos.id}
                      report={report}
                      nota="Enviar à Comunidade é falar no Grupo de avisos: todos os membros leem, ninguém responde lá (RN-COM-05)."
                      enviar={(texto) => run((data, me) => enviarMensagemAComunidade(data, me, comunidade.id, { content: texto }))}
                      {...(naLixeira ? { recusaPorFora: "A Comunidade está na lixeira." } : {})}
                    />
                  ) : (
                    <EmptyState compact title="Sem Grupo de avisos." hint="Sincronize a Comunidade: sem o Grupo de avisos não há por onde falar com todos (INV-COM-02)." />
                  )}
                </section>
              </div>
            </div>
          </CorpoDeTela>

          <AsideDeAtividade
            comments={comunidade.comments}
            activity={activity}
            onAddNote={(texto) => run((data, me) => adicionarNotaNoAtivo(data, me, "comunidade", comunidade.id, texto))}
            editavel={!naLixeira}
            authorLabel={authorLabel}
            report={report}
            vazioDoRegistro="Nenhum Registro de Atividade nesta Comunidade."
          />
        </div>
      </div>
    </div>
  );
}

function VincularGrupoDialog({ comunidade, onClose, report }: { readonly comunidade: Comunidade; readonly onClose: () => void; readonly report: Report }) {
  const state = useData((data) => data);
  const run = useRun();
  const [grupoId, setGrupoId] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const opcoes = state.grupos
    .filter((g) => g.lifecycle !== "naLixeira")
    .map((g) => {
      // A mesma ordem da operação: primeiro o que o Grupo exige (sincronizado, Canal conectado), depois o vínculo.
      const recusa = recusaExternaNoGrupo(state, g, "administrador") ?? recusaDeVinculo(state, comunidade, g);
      return { value: g.id, label: g.nome, detail: state.channels.find((c) => c.id === g.canalId)?.name ?? "", ...(recusa ? { disabledReason: recusa } : {}) };
    });
  return (
    <ConfirmDialog
      open
      title={`Vincular Grupo a ${comunidade.nome}`}
      description="Ferramenta externa: o Grupo entra na comunidade no provedor, preserva identidade, histórico e Participações (RN-COM-02), e os membros passam a aparecer no Grupo de avisos."
      confirmLabel="Vincular"
      {...(grupoId ? {} : { confirmDisabledReason: "Escolha o Grupo." })}
      onConfirm={() => {
        const r = run((data, me) => vincularGrupoAComunidade(data, me, comunidade.id, grupoId));
        if (!r.ok) {
          // Um Toast na ficha ficaria atrás do véu deste diálogo: a recusa fica aqui dentro.
          setErro(r.error);
          return;
        }
        report(r, `${r.value.nome} vinculado à Comunidade.`);
        onClose();
      }}
      onCancel={onClose}
    >
      <div className="grid gap-3">
        <Field label="Grupo" required hint="Só Grupo ativo, do mesmo Canal, sem Comunidade e em que o Canal administra (25, 12.2).">
          {(id) => <Select id={id} value={grupoId} onChange={setGrupoId} searchable placeholder="Escolher o Grupo" options={opcoes} />}
        </Field>
        {erro ? (
          <p role="alert" className="app-base" style={{ color: "var(--erro)" }}>
            {erro}
          </p>
        ) : null}
      </div>
    </ConfirmDialog>
  );
}
