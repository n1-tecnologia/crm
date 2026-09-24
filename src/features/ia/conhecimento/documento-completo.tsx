"use client";

/**
 * A FICHA DO DOCUMENTO (20): o título e o Metadado editam-se em linha, sem
 * criar Versão (RN-CNH-12); o Conteúdo é da Versão corrente e só muda por
 * [Nova Versão] ou por restauração (RN-CNH-14). Os Fragmentos são o que
 * entra em Contexto — sem eles a Versão está pendente ou com erro (11.3).
 * Comentários como conversa; Proveniência e Metadado no aside.
 */

import Link from "next/link";
import { useState } from "react";
import { FileStack, FileText, Layers, Plus, Tag, Type } from "lucide-react";
import { useData, useRun, useSession } from "@/data/store";
import {
  arquivarDocumento,
  comentarDocumento,
  editarDocumento,
  enviarDocumentoALixeira,
  recusaNoDocumento,
  restaurarDocumento,
  restaurarVersaoDoDocumento,
} from "@/data/operations";
import type { DocumentVersion } from "@/data/types";
import { LinhaDeProp } from "@/features/estrutura/linha-de-propriedade";
import { EditorDeTexto, NotasDoRegistro, RegistroRecolhido, useAvisos, useNomeDoAtor } from "@/features/shell/ficha";
import { LIFECYCLE_LABEL, PROCESSING_LABEL, SOURCE_KIND_LABEL } from "@/features/shell/format";
import { marcarSeMuda } from "@/features/shell/navegacao";
import { useRecente } from "@/features/shell/recente";
import { useFormat } from "@/features/shell/use-format";
import {
  ActionMenu,
  Button,
  CabecalhoDePainel,
  ConfirmDialog,
  CorpoDeTela,
  EmptyState,
  Field,
  Icone,
  PageHeader,
  Painel,
  Pilula,
  RecordPanel,
  RecordRow,
  Select,
  StateSeal,
} from "@/features/shell/ui";
import { MoverDocumentoDialog } from "./mover-documento-dialog";
import { NovaVersaoDialog } from "./nova-versao-dialog";
import { CONTENT_TYPE_LABEL, MEDIA_TYPE_LABEL, PROCESSING_TOM, VERSION_ORIGIN_LABEL, tamanhoDoArquivo } from "./rotulos";

type Dialogo = "versao" | "mover" | "restaurar" | "lixeira" | null;

/** 11.3 — por que a Versão não tem Fragmentos, na voz da ontologia. */
function motivoSemFragmentos(versao: DocumentVersion | undefined): string {
  switch (versao?.processing) {
    case "pendente":
      return "Sem Fragmentos: a Versão está pendente e não entra em Contexto (11.3).";
    case "comErro":
      return "Sem Fragmentos: a Versão está com erro e não entra em Contexto (11.3).";
    default:
      return "Sem Fragmentos: a Versão foi processada sem gerar trechos e não entra em Contexto (11.3).";
  }
}

export function DocumentoCompleto({ documentId }: { readonly documentId: string }) {
  const state = useData((data) => data);
  const run = useRun();
  const fmt = useFormat();
  const { memberId } = useSession();
  const { avisos, report } = useAvisos();
  const authorLabel = useNomeDoAtor();
  const recente = useRecente();
  const [dialogo, setDialogo] = useState<Dialogo>(null);
  const [versaoARestaurar, setVersaoARestaurar] = useState("");

  const documento = state.documents.find((d) => d.id === documentId);

  if (!documento) {
    return (
      <div className="flex h-full flex-col">
        <PageHeader title="Registro não encontrado" />
        <CorpoDeTela>
          <EmptyState title="Documento não encontrado." hint="Ele pode ter sido eliminado, ou você não tem permissão para vê-lo." />
        </CorpoDeTela>
      </div>
    );
  }

  const colecao = state.collections.find((c) => c.id === documento.collectionId);
  const fonte = colecao?.sources.find((s) => s.id === documento.sourceId);
  const corrente = documento.versions.find((v) => v.number === documento.currentVersion);
  const versoes = [...documento.versions].sort((a, b) => b.number - a.number);
  const arquivo = corrente?.content.fileId ? state.files.find((f) => f.id === corrente.content.fileId) : undefined;
  const activity = state.activity.filter((a) => a.objectId === documento.id);
  // B36 — o Documento segue a Coleção: o estado efetivo é o mais restritivo dos dois.
  const naLixeira = documento.lifecycle === "naLixeira" || colecao?.lifecycle === "naLixeira";
  const estadoEfetivoAtivo = documento.lifecycle === "ativo" && colecao?.lifecycle === "ativo";

  // As mesmas frases de `permissoes-ia` e das operações: o controle desligado diz o que a operação diria.
  const recusaEditar = recusaNoDocumento(state, memberId, documento, "editar") ?? (naLixeira ? "Restaure o Documento antes de editar." : undefined);
  const recusaVersao = recusaNoDocumento(state, memberId, documento, "editar") ?? (estadoEfetivoAtivo ? undefined : "Um Documento arquivado não recebe Versão nova.");
  const recusaMover =
    recusaNoDocumento(state, memberId, documento, "excluir") ??
    (documento.lifecycle === "naLixeira"
      ? "Restaure o Documento da lixeira antes de mover."
      : fonte?.kind !== "envioManual"
        ? "Só Documentos de envio manual são movidos; os sincronizados seriam recriados pela Fonte (RN-CNH-08)."
        : undefined);
  const recusaArquivar = recusaNoDocumento(state, memberId, documento, "editar") ?? (documento.lifecycle !== "ativo" ? "Só um Documento ativo é arquivado." : colecao?.lifecycle !== "ativo" ? "Restaure a Coleção antes." : undefined);
  const recusaRestaurar =
    recusaNoDocumento(state, memberId, documento, documento.lifecycle === "naLixeira" ? "excluir" : "editar") ?? (colecao?.lifecycle === "naLixeira" ? "Restaure a Coleção antes." : undefined);
  const recusaLixeira = recusaNoDocumento(state, memberId, documento, "excluir") ?? (documento.lifecycle === "naLixeira" ? "O Documento já está na lixeira." : undefined);
  const recusaComentar = recusaNoDocumento(state, memberId, documento, "comentar") ?? (naLixeira ? "Um Documento na lixeira não recebe Comentários." : undefined);
  const restauraveis = versoes.filter((v) => v.number !== documento.currentVersion && (v.content.text !== undefined || v.content.fileId !== undefined));
  const recusaRestaurarVersao = recusaVersao ?? (restauraveis.length === 0 ? "Não há outra Versão para restaurar." : undefined);
  const somenteLeitura = naLixeira
    ? "Este Documento está na lixeira: nada aqui é editável até restaurá-lo."
    : !estadoEfetivoAtivo
      ? "Documento arquivado: a Versão corrente não entra em Contexto até restaurar (12.5)."
      : recusaNoDocumento(state, memberId, documento, "comentar");

  const gravar = (patch: Parameters<typeof editarDocumento>[3], mensagem: string) => report(run((data, me) => editarDocumento(data, me, documento.id, patch)), mensagem);

  const restaurarVersao = (numero: number) => {
    setDialogo(null);
    setVersaoARestaurar("");
    report(run((data, me) => restaurarVersaoDoDocumento(data, me, documento.id, numero)), `Versão ${numero} restaurada como a Versão seguinte.`);
  };

  const menu = [
    { label: "Restaurar Versão…", onSelect: () => setDialogo("restaurar"), ...(recusaRestaurarVersao ? { disabledReason: recusaRestaurarVersao } : {}) },
    { label: "Mover para outra Coleção", onSelect: () => setDialogo("mover"), ...(recusaMover ? { disabledReason: recusaMover } : {}) },
    documento.lifecycle === "ativo"
      ? {
          label: "Arquivar",
          onSelect: () => report(run((data, me) => arquivarDocumento(data, me, documento.id)), "Documento arquivado."),
          ...(recusaArquivar ? { disabledReason: recusaArquivar } : {}),
        }
      : {
          label: documento.lifecycle === "naLixeira" ? "Restaurar da lixeira" : "Restaurar",
          onSelect: () => report(run((data, me) => restaurarDocumento(data, me, documento.id)), "Documento restaurado."),
          ...(recusaRestaurar ? { disabledReason: recusaRestaurar } : {}),
        },
    { label: "Enviar à lixeira", destructive: true, onSelect: () => setDialogo("lixeira"), ...(recusaLixeira ? { disabledReason: recusaLixeira } : {}) },
  ];

  const fechar = () => setDialogo(null);
  const hrefDaColecao = `/ia/conhecimento/${documento.collectionId}`;

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        path={
          <>
            <Link href="/ia/personalizar/conhecimento" onNavigate={() => marcarSeMuda("/ia/personalizar/conhecimento")} className="hover:underline">
              Conhecimento
            </Link>
            {" › "}
            <Link href={hrefDaColecao} onNavigate={() => marcarSeMuda(hrefDaColecao)} className="hover:underline">
              {colecao?.name ?? "Coleção"}
            </Link>
          </>
        }
        title={documento.title}
        seal={
          <>
            <StateSeal state={documento.lifecycle} />
            {corrente ? <Pilula tom={PROCESSING_TOM[corrente.processing]}>{PROCESSING_LABEL[corrente.processing] ?? corrente.processing}</Pilula> : null}
            <Pilula tom="acento">v{documento.currentVersion} corrente</Pilula>
          </>
        }
        actions={
          <>
            <Button variant="primary" size="sm" icon={<Icone de={Plus} tamanho="xs" />} onClick={() => setDialogo("versao")} disabled={recusaVersao !== undefined} {...(recusaVersao ? { disabledReason: recusaVersao } : {})}>
              Nova Versão
            </Button>
            <ActionMenu items={menu} />
          </>
        }
      />

      {somenteLeitura ? (
        <p className="app-base shrink-0 px-4 py-2" style={{ background: "var(--aviso-lavado)", color: "var(--aviso)", borderBottom: "1px solid var(--linha)" }}>
          {somenteLeitura}
        </p>
      ) : null}

      <CorpoDeTela>
        {avisos}
        <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_22rem]">
          {/* ------------------------------------------------ coluna principal */}
          <div className="grid min-w-0 content-start gap-3">
            <Painel className="px-2 py-2">
              <LinhaDeProp
                icone={Type}
                rotulo="Título"
                valor={documento.title}
                editavel={recusaEditar === undefined}
                {...(recusaEditar ? { motivo: recusaEditar } : {})}
                editor={<EditorDeTexto valor={documento.title} onSave={(v) => gravar({ title: v }, "Título alterado.")} />}
                obrigatorio
              />
              <LinhaDeProp
                icone={FileStack}
                rotulo="Coleção"
                valor={
                  <Link href={hrefDaColecao} onNavigate={() => marcarSeMuda(hrefDaColecao)} className="hover:underline">
                    {colecao?.name ?? "—"}
                  </Link>
                }
                motivo="Muda por “Mover para outra Coleção” (RN-CNH-08)."
              />
              <LinhaDeProp icone={FileText} rotulo="Tipo" valor={CONTENT_TYPE_LABEL[documento.contentType]} motivo="Acompanha a Versão corrente: nova Versão e restauração recalculam o Tipo (INV-CNH-07)." />
              <LinhaDeProp
                icone={Layers}
                rotulo="Fonte"
                valor={fonte ? (fonte.kind === "envioManual" ? fonte.name : `${fonte.name} · ${SOURCE_KIND_LABEL[fonte.kind] ?? fonte.kind}`) : "Fonte eliminada"}
                motivo="Referência obrigatória e imutável (INV-CNH-03)."
              />
            </Painel>

            <Painel>
              <CabecalhoDePainel
                titulo={`Conteúdo da Versão ${documento.currentVersion}`}
                acao={corrente ? <span className="app-meta">{VERSION_ORIGIN_LABEL[corrente.origin.kind]} · {authorLabel(corrente.origin.by)} · {fmt.relative(corrente.createdAt)}</span> : undefined}
              />
              <div className="p-4">
                {corrente?.content.text !== undefined ? (
                  <p className="app-base whitespace-pre-wrap break-words" style={{ color: "var(--texto)" }}>
                    {corrente.content.text}
                  </p>
                ) : arquivo ? (
                  <p className="app-base" style={{ color: "var(--texto)" }}>
                    Arquivo “{arquivo.name}” · {tamanhoDoArquivo(arquivo.sizeBytes)} · {MEDIA_TYPE_LABEL[arquivo.mediaType]}
                    <span className="app-meta block">A Versão referencia o Arquivo do Espaço de Trabalho, não o contém (6.3).</span>
                  </p>
                ) : (
                  <EmptyState compact title="O conteúdo desta Versão não está mais disponível." />
                )}
                {corrente && corrente.derivedRepresentations.length > 0 ? (
                  <ul className="mt-3 grid gap-2">
                    {corrente.derivedRepresentations.map((rep, i) => (
                      <li key={i} className="app-sm" style={{ color: "var(--texto-2)" }}>
                        <span className="app-meta">{rep.kind} · {authorLabel(rep.by)} · {fmt.relative(rep.at)}</span>
                        <span className="block whitespace-pre-wrap">{rep.text}</span>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            </Painel>

            <Painel>
              <CabecalhoDePainel titulo="Fragmentos" contagem={corrente?.fragments.length ?? 0} />
              <div className="p-3">
                {!corrente || corrente.fragments.length === 0 ? (
                  <EmptyState compact title={motivoSemFragmentos(corrente)} />
                ) : (
                  <ol className="pilha-solta cascata">
                    {corrente.fragments.map((fragmento) => (
                      <li key={fragmento.id} className="item-solto" data-estatico="true" data-alinhamento="topo">
                        <span className="app-meta app-numero w-8 shrink-0 text-right">{fragmento.position.order + 1}</span>
                        <span className="identificador shrink-0">{fragmento.position.locator}</span>
                        <span className="app-base min-w-0 flex-1 whitespace-pre-wrap break-words" style={{ color: "var(--texto)" }}>
                          {fragmento.derivedContent}
                        </span>
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            </Painel>

            <Painel>
              <CabecalhoDePainel titulo="Versões" contagem={documento.versions.length} />
              <div className="p-3">
                {/* Cinco colunas que quebram linha: a tabela nunca passa da coluna e nunca cobre o aside. */}
                <table className="tabela">
                  <thead>
                    <tr>
                      <th className="app-coluna">Versão</th>
                      <th className="app-coluna">Origem</th>
                      <th className="app-coluna">Por · quando</th>
                      <th className="app-coluna">Processamento</th>
                      <th className="app-coluna" data-vazia="true" aria-label="Ações" />
                    </tr>
                  </thead>
                  <tbody className="cascata">
                    {versoes.map((versao) => {
                      const corrente_ = versao.number === documento.currentVersion;
                      const semConteudo = versao.content.text === undefined && versao.content.fileId === undefined;
                      const recusaEsta = recusaVersao ?? (corrente_ ? "Esta já é a Versão corrente." : semConteudo ? `O conteúdo da Versão ${versao.number} não está mais disponível.` : undefined);
                      return (
                        <tr key={versao.number} data-selecionada={corrente_ ? "true" : undefined} data-recente={corrente_ && documento.id === recente ? "true" : undefined}>
                          <td className="py-2">
                            <span className="app-md block" style={{ color: "var(--texto)" }}>
                              v{versao.number}
                            </span>
                            {corrente_ ? <Pilula tom="acento">corrente</Pilula> : versao.supersededAt ? <span className="app-meta block">superada {fmt.relative(versao.supersededAt)}</span> : null}
                          </td>
                          <td className="app-meta">{VERSION_ORIGIN_LABEL[versao.origin.kind]}</td>
                          <td className="py-2">
                            <span className="app-base block" style={{ color: "var(--texto)" }}>
                              {authorLabel(versao.origin.by)}
                            </span>
                            <span className="app-meta block">{fmt.relative(versao.createdAt)}</span>
                          </td>
                          <td className="py-2">
                            <Pilula tom={PROCESSING_TOM[versao.processing]}>{PROCESSING_LABEL[versao.processing] ?? versao.processing}</Pilula>
                            <span className="app-meta app-numero block">{versao.fragments.length} Fragmento(s)</span>
                          </td>
                          <td className="w-12 text-right">
                            <ActionMenu
                              label={`Ações da Versão ${versao.number}`}
                              items={[{ label: "Restaurar esta Versão", onSelect: () => restaurarVersao(versao.number), ...(recusaEsta ? { disabledReason: recusaEsta } : {}) }]}
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Painel>

            <Painel className="flex flex-col">
              <CabecalhoDePainel titulo="Comentários" contagem={documento.comments.length} />
              <NotasDoRegistro
                comments={documento.comments}
                onAdd={(texto) => run((data, me) => comentarDocumento(data, me, documento.id, texto))}
                editavel={recusaComentar === undefined}
                authorLabel={authorLabel}
                report={report}
                vazioDica="Comentar exige comentar na Coleção: qualquer Membro; privada, só o Proprietário (RN-CNH-06)."
                antes={<RegistroRecolhido activity={activity} authorLabel={authorLabel} vazio="Nenhum registro ainda." />}
              />
              {recusaComentar ? (
                <p className="app-meta px-3 pb-3" title={recusaComentar}>
                  {recusaComentar}
                </p>
              ) : null}
            </Painel>
          </div>

          {/* ------------------------------------------------ coluna lateral */}
          <div className="grid min-w-0 content-start gap-3">
            <RecordPanel title="Proveniência">
              <dl>
                <RecordRow label="Coleção">{colecao?.name ?? "—"}</RecordRow>
                <RecordRow label="Fonte">{documento.provenance.sourceName}</RecordRow>
                <RecordRow label="Tipo de Fonte">{SOURCE_KIND_LABEL[documento.provenance.sourceKind] ?? documento.provenance.sourceKind}</RecordRow>
                <RecordRow label="Origem específica">{documento.provenance.specificOrigin}</RecordRow>
                <RecordRow label="Adicionado por">{authorLabel(documento.createdBy)}</RecordRow>
                <RecordRow label="Em">{fmt.instant(documento.provenance.at)}</RecordRow>
              </dl>
              <p className="app-meta mt-2">Preenchida na criação e nunca esvaziada (RN-CNH-09); sobrevive à eliminação da origem como valor histórico.</p>
            </RecordPanel>

            <RecordPanel title="Metadado">
              <div className="grid gap-0.5">
                <LinhaDeProp
                  icone={Tag}
                  rotulo="Rótulos"
                  valor={documento.metadata.labels.length > 0 ? documento.metadata.labels.join(", ") : "Adicionar rótulos…"}
                  editavel={recusaEditar === undefined}
                  {...(recusaEditar ? { motivo: recusaEditar } : {})}
                  editor={
                    <EditorDeTexto
                      valor={documento.metadata.labels.join(", ")}
                      onSave={(v) => gravar({ labels: v.split(",").map((r) => r.trim()).filter((r) => r.length > 0) }, "Rótulos alterados.")}
                      placeholder="Separados por vírgula"
                    />
                  }
                />
                <LinhaDeProp
                  icone={FileText}
                  rotulo="Resumo"
                  valor={documento.metadata.summary ?? "Adicionar resumo…"}
                  editavel={recusaEditar === undefined}
                  {...(recusaEditar ? { motivo: recusaEditar } : {})}
                  editor={<EditorDeTexto valor={documento.metadata.summary ?? ""} onSave={(v) => gravar({ summary: v }, v.trim() ? "Resumo alterado." : "Resumo apagado.")} placeholder="Uma frase sobre o Documento" />}
                />
              </div>
              <dl className="mt-2">
                {documento.metadata.language ? <RecordRow label="Idioma">{documento.metadata.language}</RecordRow> : null}
                {documento.metadata.originalAuthor ? <RecordRow label="Autor original">{documento.metadata.originalAuthor}</RecordRow> : null}
                {documento.metadata.contentDate ? <RecordRow label="Data do conteúdo">{fmt.civilDate(documento.metadata.contentDate)}</RecordRow> : null}
                <RecordRow label="Estado">{LIFECYCLE_LABEL[documento.lifecycle] ?? documento.lifecycle}</RecordRow>
                <RecordRow label="Criado">{fmt.instant(documento.createdAt)}</RecordRow>
              </dl>
              <p className="app-meta mt-2">Título, rótulos e resumo mudam sem criar Versão (RN-CNH-12).</p>
            </RecordPanel>
          </div>
        </div>
      </CorpoDeTela>

      <NovaVersaoDialog
        documentId={documento.id}
        open={dialogo === "versao"}
        onClose={fechar}
        onDone={(mensagem) => {
          fechar();
          report({ ok: true }, mensagem);
        }}
      />
      <MoverDocumentoDialog
        documentId={documento.id}
        open={dialogo === "mover"}
        onClose={fechar}
        onDone={(mensagem) => {
          fechar();
          report({ ok: true }, mensagem);
        }}
      />
      <ConfirmDialog
        open={dialogo === "restaurar"}
        title="Restaurar uma Versão"
        description="Restaurar é criar: a Versão escolhida vira a Versão seguinte, com o mesmo Conteúdo e Origem “restauração” (RN-CNH-14). A corrente nunca volta para trás."
        confirmLabel="Restaurar"
        {...(recusaRestaurarVersao ? { confirmDisabledReason: recusaRestaurarVersao } : !versaoARestaurar ? { confirmDisabledReason: "Escolha a Versão." } : {})}
        onConfirm={() => restaurarVersao(Number(versaoARestaurar))}
        onCancel={() => {
          setVersaoARestaurar("");
          fechar();
        }}
      >
        <Field label="Versão" required>
          {(id) => (
            <Select
              id={id}
              value={versaoARestaurar}
              onChange={setVersaoARestaurar}
              placeholder="Escolher a Versão"
              options={restauraveis.map((v) => ({
                value: String(v.number),
                label: `v${v.number}`,
                detail: `${VERSION_ORIGIN_LABEL[v.origin.kind]} · ${fmt.relative(v.createdAt)} · ${v.fragments.length} Fragmento(s)`,
              }))}
            />
          )}
        </Field>
      </ConfirmDialog>
      <ConfirmDialog
        open={dialogo === "lixeira"}
        title={`Enviar “${documento.title}” à lixeira?`}
        description="As Referências de Conhecimento que o citam passam a resolver com marcador (RN-CNH-22). Restaurar devolve o estado anterior (B43)."
        confirmLabel="Enviar à lixeira"
        destructive
        {...(recusaLixeira ? { confirmDisabledReason: recusaLixeira } : {})}
        onConfirm={() => {
          fechar();
          report(run((data, me) => enviarDocumentoALixeira(data, me, documento.id)), "Documento enviado à lixeira.");
        }}
        onCancel={fechar}
      />
    </div>
  );
}
