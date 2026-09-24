"use client";

/**
 * A FICHA DA COLEÇÃO (20): o cabeçalho com o estado e a privacidade, o
 * botão primário [Adicionar Documento] com o menu de governança, e quatro
 * abas — Documentos, Fontes, Acesso (as Concessões a Agentes, que vivem
 * aqui e não no Agente, DO-CNH-12) e Retenção (leitura). Cada controle
 * desligado repete a frase que a operação recusaria (`permissoes-ia`).
 */

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { Plus } from "lucide-react";
import { useData, useRun, useSession } from "@/data/store";
import {
  arquivarColecao,
  arquivarDocumento,
  editarColecao,
  recusaNaColecao,
  recusaNoDocumento,
  restaurarColecao,
  restaurarDocumento,
  revogarColecao,
} from "@/data/operations";
import type { Collection, KnowledgeDocument, KnowledgeSource } from "@/data/types";
import { LIFECYCLE_LABEL, PROCESSING_LABEL, SOURCE_KIND_LABEL } from "@/features/shell/format";
import { useAvisos } from "@/features/shell/ficha";
import { marcarSeMuda, useNavegar } from "@/features/shell/navegacao";
import { marcarChegada, useRecente } from "@/features/shell/recente";
import { useFormat } from "@/features/shell/use-format";
import {
  Abas,
  ActionMenu,
  Button,
  ConditionMarker,
  ConfirmDialog,
  CorpoDeTela,
  EmptyState,
  Icone,
  PageHeader,
  Painel,
  Pilula,
  ReguaDeSecao,
  StateSeal,
} from "@/features/shell/ui";
import { AdicionarDocumentoDialog } from "./adicionar-documento-dialog";
import { ConcederColecaoDialog } from "./conceder-colecao-dialog";
import { MoverDocumentoDialog } from "./mover-documento-dialog";
import { NovaFonteDialog } from "./nova-fonte-dialog";
import { NovaVersaoDialog } from "./nova-versao-dialog";
import { CONTENT_TYPE_LABEL, GRANT_ACTION_LABEL, PROCESSING_TOM, SOURCE_STATE_TOM, politicaDeAtualizacao } from "./rotulos";

type Aba = "documentos" | "fontes" | "acesso" | "retencao";

const ABAS: readonly Aba[] = ["documentos", "fontes", "acesso", "retencao"];

const ROTULO_DA_ABA: Record<Aba, string> = {
  documentos: "Documentos",
  fontes: "Fontes",
  acesso: "Acesso",
  retencao: "Retenção",
};

type Dialogo = "documento" | "fonte" | "conceder" | "mover" | "versao" | "arquivar" | "privar" | null;

/** 6.3 — o Documento de uma Fonte que não atualiza fica desatualizado; a Envio manual nunca desatualiza. */
const fonteDesatualiza = (fonte: KnowledgeSource | undefined): boolean => fonte !== undefined && fonte.kind !== "envioManual" && fonte.state !== "ativo";

export function ColecaoCompleta({ colecaoId }: { readonly colecaoId: string }) {
  const state = useData((data) => data);
  const run = useRun();
  const { memberId } = useSession();
  const { avisos, report } = useAvisos();
  const recente = useRecente();
  const [navegar] = useNavegar();
  const query = useSearchParams();
  const [aba, setAba] = useState<Aba>(() => {
    const pedida = query.get("aba");
    return ABAS.find((a) => a === pedida) ?? "documentos";
  });
  const [dialogo, setDialogo] = useState<Dialogo>(null);
  // O Documento alvo de "Mover" e "Nova Versão" fica depois de fechar: o diálogo ainda sai animando.
  const [documentoAlvo, setDocumentoAlvo] = useState<string>("");

  const colecao = state.collections.find((c) => c.id === colecaoId);

  if (!colecao) {
    return (
      <div className="flex h-full flex-col">
        <PageHeader title="Registro não encontrado" />
        <CorpoDeTela>
          <EmptyState title="Coleção não encontrada." hint="Ela pode ter sido eliminada, ou você não tem permissão para vê-la." />
        </CorpoDeTela>
      </div>
    );
  }

  const documentos = state.documents.filter((d) => d.collectionId === colecao.id);
  const documentosAtivos = documentos.filter((d) => d.lifecycle === "ativo");
  const concessoes = state.collectionGrants.filter((g) => g.collectionId === colecao.id);
  const proprietario = state.members.find((m) => m.id === colecao.ownerMemberId);
  const ativa = colecao.lifecycle === "ativo";
  const naLixeira = colecao.lifecycle === "naLixeira";

  // As mesmas frases de `permissoes-ia`: o botão desligado diz o que a operação diria.
  const recusaAdministrar = recusaNaColecao(state, memberId, colecao, "administrar");
  const recusaCriar = recusaNaColecao(state, memberId, colecao, "criar") ?? (ativa ? undefined : "Restaure a Coleção antes.");
  const recusaFonte = recusaAdministrar ?? (ativa ? undefined : "Restaure a Coleção antes.");
  const recusaConceder = recusaAdministrar ?? (naLixeira ? "Restaure a Coleção antes." : undefined);
  const somenteLeitura = naLixeira
    ? "Esta Coleção está na lixeira: nada aqui é editável até restaurá-la."
    : colecao.lifecycle === "arquivado"
      ? "Coleção arquivada: as Fontes estão pausadas e os Agentes não a consultam. Restaure para voltar a editar (12.5)."
      : recusaNaColecao(state, memberId, colecao, "criar");

  const abrirDoDocumento = (tipo: "mover" | "versao", documentId: string) => {
    setDocumentoAlvo(documentId);
    setDialogo(tipo);
  };

  const menu = [
    { label: "Nova Fonte", onSelect: () => setDialogo("fonte"), ...(recusaFonte ? { disabledReason: recusaFonte } : {}) },
    { label: "Dar acesso a um Agente", onSelect: () => setDialogo("conceder"), ...(recusaConceder ? { disabledReason: recusaConceder } : {}) },
    colecao.isPrivate
      ? {
          label: "Tornar pública",
          onSelect: () => report(run((data, me) => editarColecao(data, me, colecao.id, { isPrivate: false })), "Coleção tornada pública."),
          ...(recusaFonte ? { disabledReason: recusaFonte } : {}),
        }
      : { label: "Tornar privada", onSelect: () => setDialogo("privar"), ...(recusaFonte ? { disabledReason: recusaFonte } : {}) },
    ativa
      ? { label: "Arquivar", onSelect: () => setDialogo("arquivar"), ...(recusaAdministrar ? { disabledReason: recusaAdministrar } : {}) }
      : {
          label: naLixeira ? "Restaurar da lixeira" : "Restaurar",
          onSelect: () => report(run((data, me) => restaurarColecao(data, me, colecao.id)), "Coleção restaurada."),
          ...(recusaNaColecao(state, memberId, colecao, naLixeira ? "excluir" : "administrar")
            ? { disabledReason: recusaNaColecao(state, memberId, colecao, naLixeira ? "excluir" : "administrar") }
            : {}),
        },
  ];

  const fechar = () => setDialogo(null);

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        path={
          <Link href="/ia/personalizar/conhecimento" onNavigate={() => marcarSeMuda("/ia/personalizar/conhecimento")} className="hover:underline">
            Conhecimento
          </Link>
        }
        title={colecao.name}
        seal={
          <>
            <StateSeal state={colecao.lifecycle} />
            {colecao.isPrivate ? <Pilula tom="aviso">privada</Pilula> : null}
          </>
        }
        meta={`${documentosAtivos.length} Documento${documentosAtivos.length === 1 ? "" : "s"}`}
        actions={
          <>
            <Button
              variant="primary"
              size="sm"
              icon={<Icone de={Plus} tamanho="xs" />}
              onClick={() => setDialogo("documento")}
              disabled={recusaCriar !== undefined}
              {...(recusaCriar ? { disabledReason: recusaCriar } : {})}
            >
              Adicionar Documento
            </Button>
            <ActionMenu items={menu} />
          </>
        }
        {...(colecao.description || proprietario
          ? {
              details: (
                <>
                  {colecao.description ? (
                    <span className="app-base" style={{ color: "var(--texto-2)" }}>
                      {colecao.description}
                    </span>
                  ) : null}
                  <span className="app-meta">Proprietário: {proprietario?.displayName ?? "—"}</span>
                </>
              ),
            }
          : {})}
      />

      {somenteLeitura ? (
        <p className="app-base shrink-0 px-4 py-2" style={{ background: "var(--aviso-lavado)", color: "var(--aviso)", borderBottom: "1px solid var(--linha)" }}>
          {somenteLeitura}
        </p>
      ) : null}

      <Abas
        rotulo="Seções da Coleção"
        abas={ABAS.map((chave) => ({
          chave,
          rotulo: ROTULO_DA_ABA[chave],
          ...(chave === "documentos" ? { contador: documentosAtivos.length } : chave === "fontes" ? { contador: colecao.sources.length } : chave === "acesso" ? { contador: concessoes.length } : {}),
        }))}
        ativa={aba}
        aoTrocar={(chave) => setAba(chave as Aba)}
      />

      <CorpoDeTela>
        {avisos}
        <div key={aba} className="aparecer">
          {aba === "documentos" ? (
            <AbaDocumentos
              colecao={colecao}
              documentos={documentos}
              recente={recente}
              onAdicionar={() => setDialogo("documento")}
              onNovaFonte={() => setDialogo("fonte")}
              onMover={(id) => abrirDoDocumento("mover", id)}
              onNovaVersao={(id) => abrirDoDocumento("versao", id)}
              {...(recusaCriar ? { recusaCriar } : {})}
              {...(recusaFonte ? { recusaFonte } : {})}
              report={report}
            />
          ) : aba === "fontes" ? (
            <AbaFontes colecao={colecao} recente={recente} onNovaFonte={() => setDialogo("fonte")} {...(recusaFonte ? { recusaFonte } : {})} />
          ) : aba === "acesso" ? (
            <AbaAcesso colecao={colecao} recente={recente} onConceder={() => setDialogo("conceder")} {...(recusaConceder ? { recusaConceder } : {})} report={report} />
          ) : (
            <AbaRetencao colecao={colecao} />
          )}
        </div>
      </CorpoDeTela>

      <AdicionarDocumentoDialog
        colecaoId={colecao.id}
        open={dialogo === "documento"}
        onClose={fechar}
        onDone={(mensagem, documentId) => {
          fechar();
          // O Documento recém-criado é o que interessa: a ficha dele abre no ato — e é ela quem mostra o Toast.
          const href = `/ia/conhecimento/documentos/${documentId}`;
          marcarChegada(href, mensagem);
          navegar(href);
        }}
      />
      <NovaFonteDialog
        colecaoId={colecao.id}
        open={dialogo === "fonte"}
        onClose={fechar}
        onDone={(mensagem) => {
          fechar();
          setAba("fontes");
          report({ ok: true }, mensagem);
        }}
      />
      <ConcederColecaoDialog
        colecaoId={colecao.id}
        open={dialogo === "conceder"}
        onClose={fechar}
        onDone={(mensagem) => {
          fechar();
          setAba("acesso");
          report({ ok: true }, mensagem);
        }}
      />
      <MoverDocumentoDialog
        documentId={documentoAlvo}
        open={dialogo === "mover"}
        onClose={fechar}
        onDone={(mensagem) => {
          fechar();
          report({ ok: true }, mensagem);
        }}
      />
      <NovaVersaoDialog
        documentId={documentoAlvo}
        open={dialogo === "versao"}
        onClose={fechar}
        onDone={(mensagem) => {
          fechar();
          report({ ok: true }, mensagem);
        }}
      />
      <ConfirmDialog
        open={dialogo === "privar"}
        title={`Tornar “${colecao.name}” privada?`}
        description="Interrompe as origens Papel e herança: só você, o Proprietário, age nela — nem Administradores nem o Proprietário do Espaço de Trabalho (17.2). As Concessões a Agentes permanecem."
        confirmLabel="Tornar privada"
        {...(recusaFonte ? { confirmDisabledReason: recusaFonte } : {})}
        onConfirm={() => {
          fechar();
          report(run((data, me) => editarColecao(data, me, colecao.id, { isPrivate: true })), "Coleção tornada privada.");
        }}
        onCancel={fechar}
      />
      <ConfirmDialog
        open={dialogo === "arquivar"}
        title={`Arquivar “${colecao.name}”?`}
        description="Arquivar pausa as Fontes e tira a Coleção das consultas dos Agentes no mesmo ato; os Documentos e as Concessões ficam guardados (12.5). Restaurar desfaz."
        confirmLabel="Arquivar"
        {...(recusaAdministrar ? { confirmDisabledReason: recusaAdministrar } : {})}
        onConfirm={() => {
          fechar();
          report(run((data, me) => arquivarColecao(data, me, colecao.id)), "Coleção arquivada.");
        }}
        onCancel={fechar}
      />
    </div>
  );
}

/* ------------------------------------------------------------ documentos */

function AbaDocumentos({
  colecao,
  documentos,
  recente,
  recusaCriar,
  recusaFonte,
  onAdicionar,
  onNovaFonte,
  onMover,
  onNovaVersao,
  report,
}: {
  readonly colecao: Collection;
  readonly documentos: readonly KnowledgeDocument[];
  readonly recente: string | null;
  readonly recusaCriar?: string;
  readonly recusaFonte?: string;
  readonly onAdicionar: () => void;
  readonly onNovaFonte: () => void;
  readonly onMover: (documentId: string) => void;
  readonly onNovaVersao: (documentId: string) => void;
  readonly report: (result: { ok: boolean; error?: string }, message: string) => void;
}) {
  const state = useData((data) => data);
  const run = useRun();
  const { memberId } = useSession();

  if (documentos.length === 0) {
    return (
      <EmptyState
        title="Nenhum Documento."
        hint="Envie um arquivo ou configure uma Fonte."
        action={
          <span className="flex flex-wrap items-center justify-center gap-2">
            <Button variant="primary" onClick={onAdicionar} disabled={recusaCriar !== undefined} {...(recusaCriar ? { disabledReason: recusaCriar } : {})}>
              Adicionar Documento
            </Button>
            <Button onClick={onNovaFonte} disabled={recusaFonte !== undefined} {...(recusaFonte ? { disabledReason: recusaFonte } : {})}>
              Nova Fonte
            </Button>
          </span>
        }
      />
    );
  }

  return (
    <ul className="pilha-solta cascata">
      {documentos.map((documento) => {
        const corrente = documento.versions.find((v) => v.number === documento.currentVersion);
        const fonte = colecao.sources.find((s) => s.id === documento.sourceId);
        const href = `/ia/conhecimento/documentos/${documento.id}`;
        const arquivadoOuNaLixeira = documento.lifecycle !== "ativo";
        const estadoEfetivoAtivo = documento.lifecycle === "ativo" && colecao.lifecycle === "ativo";

        const recusaMover =
          recusaNoDocumento(state, memberId, documento, "excluir") ??
          (documento.lifecycle === "naLixeira"
            ? "Restaure o Documento da lixeira antes de mover."
            : fonte?.kind !== "envioManual"
              ? "Só Documentos de envio manual são movidos; os sincronizados seriam recriados pela Fonte (RN-CNH-08)."
              : undefined);
        const recusaVersao = recusaNoDocumento(state, memberId, documento, "editar") ?? (estadoEfetivoAtivo ? undefined : "Um Documento arquivado não recebe Versão nova.");
        const recusaArquivar = recusaNoDocumento(state, memberId, documento, "editar") ?? (colecao.lifecycle === "ativo" ? undefined : "Restaure a Coleção antes.");
        const recusaRestaurar =
          recusaNoDocumento(state, memberId, documento, documento.lifecycle === "naLixeira" ? "excluir" : "editar") ??
          (colecao.lifecycle === "naLixeira" ? "Restaure a Coleção antes." : undefined);

        const menu = [
          { label: "Mover para outra Coleção", onSelect: () => onMover(documento.id), ...(recusaMover ? { disabledReason: recusaMover } : {}) },
          { label: "Nova Versão", onSelect: () => onNovaVersao(documento.id), ...(recusaVersao ? { disabledReason: recusaVersao } : {}) },
          arquivadoOuNaLixeira
            ? {
                label: documento.lifecycle === "naLixeira" ? "Restaurar da lixeira" : "Restaurar",
                onSelect: () => report(run((data, me) => restaurarDocumento(data, me, documento.id)), "Documento restaurado."),
                ...(recusaRestaurar ? { disabledReason: recusaRestaurar } : {}),
              }
            : {
                label: "Arquivar",
                onSelect: () => report(run((data, me) => arquivarDocumento(data, me, documento.id)), "Documento arquivado."),
                ...(recusaArquivar ? { disabledReason: recusaArquivar } : {}),
              },
        ];

        return (
          <li key={documento.id} className="item-solto" data-recente={documento.id === recente || undefined} data-atenuado={arquivadoOuNaLixeira ? "true" : undefined}>
            <Link href={href} onNavigate={() => marcarSeMuda(href)} className="app-base min-w-0 flex-1 truncate" style={{ color: "var(--texto)" }}>
              {documento.title}
            </Link>
            <span className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
              <Pilula>{CONTENT_TYPE_LABEL[documento.contentType]}</Pilula>
              {corrente ? <Pilula tom={PROCESSING_TOM[corrente.processing]}>{PROCESSING_LABEL[corrente.processing] ?? corrente.processing}</Pilula> : null}
              <span className="app-meta">{fonte?.name ?? "Fonte eliminada"}</span>
              {fonteDesatualiza(fonte) ? (
                <ConditionMarker tone="warning" title={`A Fonte “${fonte?.name}” está ${LIFECYCLE_LABEL[fonte?.state ?? ""] ?? fonte?.state}: o Documento não atualiza (6.3).`}>
                  desatualizado
                </ConditionMarker>
              ) : null}
              <StateSeal state={documento.lifecycle} />
            </span>
            <ActionMenu label={`Ações de ${documento.title}`} items={menu} />
          </li>
        );
      })}
    </ul>
  );
}

/* ---------------------------------------------------------------- fontes */

function AbaFontes({ colecao, recente, recusaFonte, onNovaFonte }: { readonly colecao: Collection; readonly recente: string | null; readonly recusaFonte?: string; readonly onNovaFonte: () => void }) {
  const state = useData((data) => data);
  const fmt = useFormat();
  return (
    <div className="grid gap-2">
      <ReguaDeSecao
        rotulo="Fontes"
        contagem={colecao.sources.length}
        acao={
          <Button size="sm" onClick={onNovaFonte} disabled={recusaFonte !== undefined} {...(recusaFonte ? { disabledReason: recusaFonte } : {})}>
            Nova Fonte
          </Button>
        }
      />
      <p className="app-meta">
        A Envio manual veio com a Coleção e não se remove, pausa nem reconfigura (RN-CNH-04). Uma Fonte pausada ou com erro deixa os seus Documentos desatualizados (6.3).
      </p>
      {/* Quatro colunas que quebram linha: a tabela cabe em 1024 sem rolar de lado. */}
      <table className="tabela">
        <thead>
          <tr>
            <th className="app-coluna">Fonte</th>
            <th className="app-coluna">Tipo · estado</th>
            <th className="app-coluna">Política · configurada por</th>
            <th className="app-coluna">Último resultado</th>
          </tr>
        </thead>
        <tbody className="cascata">
          {colecao.sources.map((fonte) => {
            const configurador = fonte.configuredByMemberId ? state.members.find((m) => m.id === fonte.configuredByMemberId)?.displayName : undefined;
            const manual = fonte.kind === "envioManual";
            return (
              <tr key={fonte.id} data-recente={fonte.id === recente || undefined} title={manual ? "Fonte implícita: não pode ser removida, pausada nem reconfigurada (RN-CNH-04)." : undefined}>
                <td className="py-2">
                  <span className="app-base block" style={{ color: "var(--texto)" }}>
                    {fonte.name}
                  </span>
                  {fonte.config ? <span className="app-meta block max-w-64 truncate">{fonte.config}</span> : null}
                </td>
                <td className="py-2">
                  <span className="flex flex-wrap gap-1">
                    <Pilula>{SOURCE_KIND_LABEL[fonte.kind] ?? fonte.kind}</Pilula>
                    <Pilula tom={SOURCE_STATE_TOM[fonte.state]}>{LIFECYCLE_LABEL[fonte.state] ?? fonte.state}</Pilula>
                  </span>
                </td>
                <td className="py-2">
                  <span className="app-base block" style={{ color: "var(--texto)" }}>
                    {manual ? "—" : politicaDeAtualizacao(fonte.updatePolicy)}
                  </span>
                  <span className="app-meta block">{manual ? "a plataforma" : (configurador ?? "—")}</span>
                </td>
                <td className="app-meta py-2">
                  {fonte.lastUpdateResult ?? (manual ? "—" : "ainda não atualizou")}
                  {fonte.lastUpdateAt ? <span className="block">{fmt.relative(fonte.lastUpdateAt)}</span> : null}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* ---------------------------------------------------------------- acesso */

function AbaAcesso({
  colecao,
  recente,
  recusaConceder,
  onConceder,
  report,
}: {
  readonly colecao: Collection;
  readonly recente: string | null;
  readonly recusaConceder?: string;
  readonly onConceder: () => void;
  readonly report: (result: { ok: boolean; error?: string }, message: string) => void;
}) {
  const state = useData((data) => data);
  const run = useRun();
  const fmt = useFormat();
  const { memberId } = useSession();
  const concessoes = state.collectionGrants.filter((g) => g.collectionId === colecao.id);
  const proprietario = state.members.find((m) => m.id === colecao.ownerMemberId);
  const recusaRevogar = recusaNaColecao(state, memberId, colecao, "administrar");

  return (
    <div className="grid gap-3">
      <Painel className="p-4">
        <dl className="grid gap-x-8 gap-y-1 sm:grid-cols-2">
          <div className="flex items-baseline justify-between gap-3">
            <dt className="app-meta">Proprietário</dt>
            <dd className="app-base truncate" style={{ color: "var(--texto)" }}>
              {proprietario?.displayName ?? "—"}
            </dd>
          </div>
          <div className="flex items-baseline justify-between gap-3">
            <dt className="app-meta">Privada</dt>
            <dd className="app-base" style={{ color: "var(--texto)" }}>
              {colecao.isPrivate ? "sim — só o Proprietário age nela (17.2)" : "não"}
            </dd>
          </div>
        </dl>
        <p className="app-meta mt-2">
          A Coleção é o único Recurso de permissão do Conhecimento: Documento, Versão e Fragmento herdam e nunca têm permissão própria.
        </p>
      </Painel>

      <ReguaDeSecao
        rotulo="Agentes com acesso"
        contagem={concessoes.length}
        acao={
          <Button size="sm" variant="primary" onClick={onConceder} disabled={recusaConceder !== undefined} {...(recusaConceder ? { disabledReason: recusaConceder } : {})}>
            Dar acesso a um Agente
          </Button>
        }
      />
      <p className="app-meta">A Concessão é gravada aqui e o Agente a exibe como Conhecimento acessível (DO-CNH-12); na consulta vale a interseção com quem delega (A9.3).</p>

      {concessoes.length === 0 ? (
        <EmptyState compact title="Nenhum Agente tem acesso a esta Coleção." hint="Sem Concessão, nenhum Agente consulta os Documentos daqui." />
      ) : (
        <table className="tabela">
          <thead>
            <tr>
              <th className="app-coluna">Agente</th>
              <th className="app-coluna">Ações</th>
              <th className="app-coluna">Concedido por</th>
              <th className="app-coluna">Em</th>
              <th className="app-coluna" data-vazia="true" aria-label="Ações" />
            </tr>
          </thead>
          <tbody className="cascata">
            {concessoes.map((grant) => {
              const agente = state.agents.find((a) => a.id === grant.agentId);
              const concedente = state.members.find((m) => m.id === grant.grantedBy);
              const href = `/ia/agentes/${grant.agentId}`;
              return (
                <tr key={grant.id} data-recente={grant.id === recente || undefined}>
                  <td>
                    <span className="flex items-center gap-2">
                      <Link href={href} onNavigate={() => marcarSeMuda(href)} className="app-base truncate hover:underline" style={{ color: "var(--texto)" }}>
                        {agente?.name ?? grant.agentId}
                      </Link>
                      {agente ? <StateSeal state={agente.lifecycle} /> : null}
                    </span>
                  </td>
                  <td>
                    <span className="flex flex-wrap gap-1">
                      {grant.actions.map((acao) => (
                        <Pilula key={acao} tom={acao === "ver" ? "info" : "neutro"}>
                          {GRANT_ACTION_LABEL[acao]}
                        </Pilula>
                      ))}
                    </span>
                  </td>
                  <td className="app-meta">{concedente?.displayName ?? grant.grantedBy}</td>
                  <td className="app-meta whitespace-nowrap">{fmt.relative(grant.grantedAt)}</td>
                  <td className="w-12 text-right">
                    <ActionMenu
                      label={`Ações da Concessão a ${agente?.name ?? grant.agentId}`}
                      items={[
                        {
                          label: "Revogar",
                          destructive: true,
                          onSelect: () => report(run((data, me) => revogarColecao(data, me, grant.id)), `Acesso de ${agente?.name ?? grant.agentId} revogado.`),
                          ...(recusaRevogar ? { disabledReason: recusaRevogar } : {}),
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
    </div>
  );
}

/* -------------------------------------------------------------- retenção */

function AbaRetencao({ colecao }: { readonly colecao: Collection }) {
  const { maxSuperseded, maxDays } = colecao.versionRetention;
  return (
    <Painel className="p-4">
      <dl className="grid gap-x-8 gap-y-1 sm:grid-cols-2">
        <div className="flex items-baseline justify-between gap-3">
          <dt className="app-meta">Versões superadas retidas por Documento</dt>
          <dd className="app-base app-numero" style={{ color: "var(--texto)" }}>
            {maxSuperseded}
          </dd>
        </div>
        <div className="flex items-baseline justify-between gap-3">
          <dt className="app-meta">Prazo desde “Superada em”</dt>
          <dd className="app-base app-numero" style={{ color: "var(--texto)" }}>
            {maxDays} dias
          </dd>
        </div>
      </dl>
      <p className="app-meta mt-3">
        Política de retenção de versões (7.5): padrão da plataforma, dentro dos tetos dela (B34). A Versão corrente nunca é alcançada (INV-CNH-06); uma Versão eliminada por
        retenção deixa as Referências que a citam com marcador (RN-CNH-22). Ajustá-la fica para uma próxima versão do protótipo.
      </p>
    </Painel>
  );
}
