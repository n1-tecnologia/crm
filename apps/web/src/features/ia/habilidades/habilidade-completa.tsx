"use client";

/**
 * A FICHA DA HABILIDADE (18) no formato das fichas de IA: cabeçalho com o
 * estado, a Versão corrente e o rascunho; [Publicar vM] com a mesma recusa
 * que a operação daria; o menu de governança (rascunho, descartar, conceder,
 * arquivar); as propriedades; o rascunho editável; a Versão corrente em
 * leitura; a tabela de Versões; e, ao lado, a Validação viva (RN-HAB-06) e
 * os Agentes com Concessão (fixar, seguir a corrente, revogar).
 *
 * Uma Habilidade da plataforma é só leitura por aqui (INV-HAB-07): a ficha
 * diz o porquê em cada controle e oferece "Copiar para o Espaço de Trabalho".
 * Versões não têm id (D4): o realce de "acabou de mudar" acende a linha da
 * Versão tocada quando o último resultado é desta Habilidade.
 */

import Link from "next/link";
import { useState } from "react";
import { AlignLeft, Bot, Fingerprint, Landmark, Sparkles, Type, UserRound } from "lucide-react";
import { useData, useRun, useSession } from "@/dados/store";
import {
  arquivarHabilidade,
  criarRascunhoDaHabilidade,
  descartarRascunhoDaHabilidade,
  editarHabilidade,
  fixarVersaoDaConcessao,
  obsoletarVersaoDaHabilidade,
  recusaDeGovernarAgente,
  recusaDeGovernarHabilidade,
  restaurarHabilidade,
  revogarHabilidade,
  validarRascunhoDaHabilidade,
} from "@n1/dominio/operations";
import { disponibilidadeDaConcessao, efeitoDeclarado, rascunhoDaHabilidade, versaoCorrenteDaHabilidade } from "@n1/dominio/derive-ia";
import type { Skill, SkillGrant, SkillVersion } from "@n1/dominio/types";
import { LinhaDeProp } from "@/features/estrutura/linha-de-propriedade";
import { EditorDeTexto, useAvisos, useNomeDoAtor } from "@/features/shell/ficha";
import { EFFECT_CLASS_LABEL } from "@/features/shell/format";
import { marcarSeMuda, useNavegar } from "@/features/shell/navegacao";
import { marcarChegada, useRecente } from "@/features/shell/recente";
import { ActionMenu, Button, CabecalhoDePainel, ConditionMarker, ConfirmDialog, CorpoDeTela, EmptyState, Field, Icone, PageHeader, Painel, Pilula, RecordPanel, RecordRow, ReguaDeSecao, Select, StateSeal } from "@/features/shell/ui";
import { useFormat } from "@/features/shell/use-format";
import { DISPONIBILIDADE_TOM, EFEITO_LABEL, EFEITO_TOM, VERSAO_LABEL, VERSAO_TOM } from "../rotulos";
import { ConcederHabilidadeDialog, recusaDeConcederAAlgumAgente } from "./conceder-habilidade-dialog";
import { TIPO_DE_PARAMETRO_LABEL } from "./contrato-editor";
import { CopiarDaPlataformaDialog } from "./copiar-da-plataforma-dialog";
import { PublicarHabilidadeDialog } from "./publicar-habilidade-dialog";
import { RascunhoDaHabilidade } from "./rascunho-da-habilidade";

type Dialogo =
  | { readonly tipo: "publicar" }
  | { readonly tipo: "conceder" }
  | { readonly tipo: "copiar" }
  | { readonly tipo: "arquivar" }
  | { readonly tipo: "descartar" }
  | { readonly tipo: "obsoletar"; readonly numero: number }
  | { readonly tipo: "fixar"; readonly grantId: string }
  | { readonly tipo: "revogar"; readonly grantId: string };

export function HabilidadeCompleta({ skillId }: { readonly skillId: string }) {
  const state = useData((data) => data);
  const run = useRun();
  const fmt = useFormat();
  const { memberId } = useSession();
  const { avisos, report } = useAvisos();
  const authorLabel = useNomeDoAtor();
  const recente = useRecente();
  const [navegar] = useNavegar();
  const [dialogo, setDialogo] = useState<Dialogo | null>(null);
  // Versões não têm id: a ficha lembra qual foi tocada para acender a linha certa.
  const [versaoTocada, setVersaoTocada] = useState<number | null>(null);
  // A Concessão do último diálogo (fixar, revogar) fica lembrada para o diálogo sair animando em vez de desmontar.
  const [concessaoEmFoco, setConcessaoEmFoco] = useState<string | null>(null);

  const skill = state.skills.find((s) => s.id === skillId);
  if (!skill) {
    return (
      <div className="flex h-full flex-col">
        <PageHeader title="Registro não encontrado" />
        <CorpoDeTela>
          <EmptyState title="Habilidade não encontrada." hint="Ela pode ter sido eliminada, ou você não tem permissão para vê-la." />
        </CorpoDeTela>
      </div>
    );
  }

  const corrente = versaoCorrenteDaHabilidade(skill);
  const rascunho = rascunhoDaHabilidade(skill);
  const plataforma = skill.ownership === "plataforma";
  const recusaEditar = recusaDeGovernarHabilidade(state, memberId, skill, "editar");
  const recusaAdministrar = recusaDeGovernarHabilidade(state, memberId, skill, "administrar");
  const motivoLeitura = recusaEditar ?? (skill.lifecycle !== "ativo" ? "Restaure a Habilidade antes de editar." : undefined);
  const problemas = rascunho ? validarRascunhoDaHabilidade(state, skill, rascunho) : [];
  const n = problemas.length;
  const recusaPublicar =
    recusaAdministrar ??
    (skill.lifecycle !== "ativo" ? "Restaure a Habilidade antes de publicar." : undefined) ??
    (!rascunho ? "Não há rascunho para publicar." : undefined) ??
    (n > 0 ? `${n} problema${n > 1 ? "s" : ""} de validação (RN-HAB-06).` : undefined);
  const recusaRascunhoNovo = motivoLeitura ?? (rascunho ? "A Habilidade já tem um rascunho: edite-o ou descarte-o (RN-HAB-04)." : undefined);
  const recusaDescartar = recusaEditar ?? (!rascunho ? "Não há rascunho para descartar." : skill.versions.length === 1 ? "Este é a única Versão da Habilidade: descartá-la a deixaria vazia (INV-HAB-01)." : undefined);
  // Conceder sem Versão publicada é permitido: a Concessão nasce indisponível e o diálogo avisa (RN-HAB-03).
  // Mas sem Agente ao alcance (Convidado, ou Membro sem Agente próprio) não há a quem conceder: o botão diz por quê (§11).
  const recusaConceder = skill.lifecycle !== "ativo" ? "Só uma Habilidade ativa é concedida." : recusaDeConcederAAlgumAgente(state, memberId);
  const concessoes = state.skillGrants.filter((g) => g.skillId === skill.id);
  const versoes = [...skill.versions].sort((a, b) => b.number - a.number);
  const activity = state.activity.filter((a) => a.objectId === skill.id);
  const fechar = () => setDialogo(null);

  const gravar = (patch: Parameters<typeof editarHabilidade>[3], mensagem: string) => report(run((data, me) => editarHabilidade(data, me, skill.id, patch)), mensagem);
  const criarRascunhoDe = (numero?: number) => {
    const r = run((data, me) => criarRascunhoDaHabilidade(data, me, skill.id, numero));
    if (r.ok) setVersaoTocada(r.value.number);
    report(r, r.ok ? `Rascunho v${r.value.number} criado${numero !== undefined ? ` a partir da v${numero}` : " a partir da corrente"}.` : "");
  };

  const menu = [
    ...(plataforma ? [{ label: "Copiar para o Espaço de Trabalho", onSelect: () => setDialogo({ tipo: "copiar" }), ...(corrente ? {} : { disabledReason: "A Habilidade da plataforma não tem Versão publicada para copiar." }) }] : []),
    { label: "Criar rascunho a partir da corrente", onSelect: () => criarRascunhoDe(), ...(recusaRascunhoNovo ? { disabledReason: recusaRascunhoNovo } : !corrente ? { disabledReason: "Não há Versão publicada: parta de uma Versão na tabela." } : {}) },
    { label: "Descartar rascunho", destructive: true, onSelect: () => setDialogo({ tipo: "descartar" }), ...(recusaDescartar ? { disabledReason: recusaDescartar } : {}) },
    { label: "Conceder a um Agente", onSelect: () => setDialogo({ tipo: "conceder" }), ...(recusaConceder ? { disabledReason: recusaConceder } : {}) },
    skill.lifecycle === "arquivado"
      ? { label: "Restaurar", onSelect: () => report(run((data, me) => restaurarHabilidade(data, me, skill.id)), "Habilidade restaurada: as Concessões voltam a ser avaliadas."), ...(recusaAdministrar ? { disabledReason: recusaAdministrar } : {}) }
      : { label: "Arquivar", destructive: true, onSelect: () => setDialogo({ tipo: "arquivar" }), ...(recusaAdministrar ? { disabledReason: recusaAdministrar } : skill.lifecycle !== "ativo" ? { disabledReason: "Só uma Habilidade ativa é arquivada." } : {}) },
  ];

  const versaoObsoletando = dialogo?.tipo === "obsoletar" ? skill.versions.find((v) => v.number === dialogo.numero) : undefined;
  const fixadasNaObsoletando = versaoObsoletando ? concessoes.filter((g) => g.pinnedVersion === versaoObsoletando.number).length : 0;
  const concessaoEmDialogo = concessoes.find((g) => g.id === concessaoEmFoco);
  const abrirNaConcessao = (tipo: "fixar" | "revogar", grantId: string) => {
    setConcessaoEmFoco(grantId);
    setDialogo({ tipo, grantId });
  };

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        icon={<Icone de={Sparkles} tamanho="sm" />}
        title={skill.name}
        seal={
          <>
            <StateSeal state={skill.lifecycle} />
            {corrente ? <Pilula tom="sucesso">v{corrente.number} publicada</Pilula> : <ConditionMarker tone="neutral">sem Versão publicada</ConditionMarker>}
            {rascunho ? <Pilula tom="aviso">v{rascunho.number} em rascunho</Pilula> : null}
            {plataforma ? <Pilula tom="info">da plataforma</Pilula> : null}
          </>
        }
        actions={
          <>
            <Button variant="primary" size="sm" onClick={() => setDialogo({ tipo: "publicar" })} disabled={recusaPublicar !== undefined} {...(recusaPublicar ? { disabledReason: recusaPublicar } : {})}>
              Publicar v{rascunho?.number ?? (corrente ? corrente.number + 1 : 1)}
            </Button>
            <ActionMenu items={menu} />
          </>
        }
      />

      {motivoLeitura ? (
        <p className="app-base shrink-0 px-4 py-2" style={{ background: "var(--aviso-lavado)", color: "var(--aviso)", borderBottom: "1px solid var(--linha)" }}>
          {motivoLeitura}
        </p>
      ) : null}

      <CorpoDeTela>
        {avisos}
        <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_22rem] xl:items-start">
          {/* ------------------------------------------------ coluna principal */}
          <div className="grid min-w-0 content-start gap-3">
            <Painel className="@container min-w-0 p-2">
              <div className="grid gap-x-8 gap-y-0.5 @3xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                <div className="grid min-w-0 content-start gap-0.5">
                  <LinhaDeProp icone={Type} rotulo="Nome" valor={skill.name} editavel={!motivoLeitura} motivo={motivoLeitura} editor={<EditorDeTexto valor={skill.name} onSave={(v) => gravar({ name: v }, "Habilidade renomeada.")} />} />
                  <LinhaDeProp icone={AlignLeft} rotulo="Descrição" valor={skill.description || "Adicionar descrição…"} editavel={!motivoLeitura} motivo={motivoLeitura} editor={<EditorDeTexto valor={skill.description} onSave={(v) => gravar({ description: v }, "Descrição alterada.")} placeholder="O que a Habilidade faz" />} />
                  <LinhaDeProp icone={Landmark} rotulo="Pertencimento" valor={plataforma ? "plataforma" : "Espaço de Trabalho"} motivo={plataforma ? "Uma Habilidade da plataforma não é editada pelo Espaço de Trabalho: copie-a (INV-HAB-07)." : "Nasceu no Espaço de Trabalho."} />
                </div>
                <div className="grid min-w-0 content-start gap-0.5">
                  <LinhaDeProp icone={UserRound} rotulo="Criador" valor={`${authorLabel(skill.createdBy)} · ${fmt.relative(skill.createdAt)}`} motivo="Imutável: a Habilidade tem Criador e Publicador, nunca Proprietário (B71)." />
                  <LinhaDeProp icone={Fingerprint} rotulo="Proveniência" valor={skill.provenance ? `cópia de “${skill.provenance.sourceName}” · ${fmt.relative(skill.provenance.at)}` : "Nenhuma"} motivo="Sem vínculo vivo com a origem (DO-HAB-07)." />
                  <LinhaDeProp icone={Bot} rotulo="Agentes com Concessão" valor={<span className="app-numero">{concessoes.length}</span>} motivo="Muda por “Conceder” e “Revogar”." />
                </div>
              </div>
            </Painel>

            {rascunho && !motivoLeitura ? (
              <RascunhoDaHabilidade key={`${skill.id}-v${rascunho.number}`} skill={skill} rascunho={rascunho} report={report} />
            ) : rascunho ? (
              <VersaoEmLeitura skill={skill} versao={rascunho} titulo={`Rascunho v${rascunho.number}`} nota={motivoLeitura ?? "Só leitura."} />
            ) : null}

            {corrente ? (
              <VersaoEmLeitura skill={skill} versao={corrente} titulo={`Versão corrente · v${corrente.number}`} nota="Uma Versão publicada não é editada (RN-HAB-07): mudar é criar um rascunho a partir dela." />
            ) : (
              <Painel className="min-w-0">
                <CabecalhoDePainel titulo="Versão corrente" />
                <EmptyState compact title="Sem Versão publicada." hint="Nenhuma Concessão exerce esta Habilidade até publicar uma Versão (RN-HAB-03)." />
              </Painel>
            )}

            <Painel className="min-w-0">
              <CabecalhoDePainel titulo="Versões" contagem={versoes.length} />
              <table className="tabela">
                <thead>
                  <tr>
                    <th className="app-coluna">Versão</th>
                    <th className="app-coluna">Estado</th>
                    <th className="app-coluna">Publicada por/em</th>
                    <th className="app-coluna">Efeito</th>
                    <th className="app-coluna" data-vazia="true" aria-label="Ações" />
                  </tr>
                </thead>
                <tbody className="cascata">
                  {versoes.map((v) => {
                    const efeito = efeitoDeclarado(state, v);
                    const fixadas = concessoes.filter((g) => g.pinnedVersion === v.number).length;
                    return (
                      <tr key={v.number} data-recente={(recente === skill.id && versaoTocada === v.number) || undefined}>
                        <td className="whitespace-nowrap">
                          <span className="app-md" style={{ color: "var(--texto)" }}>
                            v{v.number}
                          </span>
                          {fixadas > 0 ? <span className="app-meta"> · {fixadas === 1 ? "1 Concessão fixada" : `${fixadas} Concessões fixadas`}</span> : null}
                        </td>
                        <td className="whitespace-nowrap">
                          <Pilula tom={VERSAO_TOM[v.state]}>{VERSAO_LABEL[v.state]}</Pilula>
                        </td>
                        <td className="whitespace-nowrap">
                          <span className="app-sm" style={{ color: "var(--texto-2)" }}>
                            {v.publishedAt ? `${v.publishedBy ? `${authorLabel({ kind: "member", id: v.publishedBy })} · ` : ""}${fmt.instant(v.publishedAt)}` : `criada ${fmt.relative(v.createdAt)}`}
                          </span>
                        </td>
                        <td className="whitespace-nowrap">
                          <Pilula tom={EFEITO_TOM[efeito]}>{EFEITO_LABEL[efeito]}</Pilula>
                        </td>
                        <td>
                          <ActionMenu
                            label={`Ações da v${v.number}`}
                            items={[
                              ...(v.state === "publicada"
                                ? [{ label: "Obsoletar", destructive: true, onSelect: () => setDialogo({ tipo: "obsoletar", numero: v.number }), ...(recusaAdministrar ? { disabledReason: recusaAdministrar } : {}) }]
                                : []),
                              { label: "Criar rascunho a partir desta", onSelect: () => criarRascunhoDe(v.number), ...(recusaRascunhoNovo ? { disabledReason: recusaRascunhoNovo } : {}) },
                              ...(v.state === "rascunho" ? [{ label: "Descartar", destructive: true, onSelect: () => setDialogo({ tipo: "descartar" }), ...(recusaDescartar ? { disabledReason: recusaDescartar } : {}) }] : []),
                            ]}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </Painel>
          </div>

          {/* ------------------------------------------------ coluna lateral */}
          <div className="grid min-w-0 content-start gap-3">
            <RecordPanel title="Validação" count={rascunho ? n : undefined}>
              {!rascunho ? (
                <p className="app-sm" style={{ color: "var(--texto-3)" }}>
                  Sem rascunho: nada a validar. Crie um a partir de uma Versão para editar.
                </p>
              ) : n === 0 ? (
                <p className="app-sm" style={{ color: "var(--sucesso)" }}>
                  Nenhum problema. O rascunho pode ser publicado.
                </p>
              ) : (
                <ol className="grid gap-2">
                  {problemas.map((p, i) => (
                    <li key={i} className="app-sm flex items-start gap-2" style={{ color: "var(--texto-2)" }}>
                      <ConditionMarker tone="danger">{p.regra}</ConditionMarker>
                      <span className="min-w-0 flex-1">{p.mensagem}</span>
                    </li>
                  ))}
                </ol>
              )}
              {rascunho ? (
                <div className="mt-3">
                  <Button variant="primary" full onClick={() => setDialogo({ tipo: "publicar" })} disabled={recusaPublicar !== undefined} {...(recusaPublicar ? { disabledReason: recusaPublicar } : {})}>
                    Publicar v{rascunho.number}
                  </Button>
                </div>
              ) : null}
            </RecordPanel>

            <RecordPanel
              title="Agentes com Concessão"
              count={concessoes.length}
              action={
                <Button size="sm" variant="ghost" onClick={() => setDialogo({ tipo: "conceder" })} disabled={recusaConceder !== undefined} {...(recusaConceder ? { disabledReason: recusaConceder } : {})}>
                  Conceder
                </Button>
              }
            >
              {concessoes.length === 0 ? (
                <EmptyState compact title="Nenhum Agente tem esta Habilidade concedida." hint="A Concessão é a única origem de executar (RN-HAB-12)." />
              ) : (
                <ul className="pilha-solta cascata">
                  {concessoes.map((grant) => (
                    <LinhaDeConcessao
                      key={grant.id}
                      grant={grant}
                      recente={grant.id === recente}
                      onFixar={() => abrirNaConcessao("fixar", grant.id)}
                      onSeguir={() => report(run((data, me) => fixarVersaoDaConcessao(data, me, grant.id, null)), "A Concessão passa a seguir a corrente.")}
                      onRevogar={() => abrirNaConcessao("revogar", grant.id)}
                    />
                  ))}
                </ul>
              )}
            </RecordPanel>

            <RecordPanel title="Registro de Atividade" count={activity.length} defaultOpen={false}>
              {activity.length === 0 ? (
                <EmptyState compact title="Nada registrado ainda." />
              ) : (
                <ol className="grid gap-2">
                  {[...activity]
                    .sort((a, b) => b.at.localeCompare(a.at))
                    .slice(0, 12)
                    .map((record) => (
                      <li key={record.id} className="app-sm" style={{ color: "var(--texto-2)" }}>
                        <span style={{ color: record.result === "failed" || record.result === "denied" ? "var(--erro)" : "var(--texto)" }}>{record.action}</span>
                        {record.detail ? <span className="app-meta block">{record.detail}</span> : null}
                        <span className="app-meta block">
                          {authorLabel(record.actor)} · {fmt.relative(record.at)}
                        </span>
                      </li>
                    ))}
                </ol>
              )}
            </RecordPanel>
          </div>
        </div>
      </CorpoDeTela>

      {/* ------------------------------------------------------- diálogos */}
      {rascunho ? (
        <PublicarHabilidadeDialog
          skill={skill}
          rascunho={rascunho}
          recusa={recusaAdministrar ?? (skill.lifecycle !== "ativo" ? "Restaure a Habilidade antes de publicar." : undefined)}
          open={dialogo?.tipo === "publicar"}
          onClose={fechar}
          onDone={(mensagem) => {
            setVersaoTocada(rascunho.number);
            fechar();
            report({ ok: true }, mensagem);
          }}
        />
      ) : null}
      <ConcederHabilidadeDialog
        skillId={skill.id}
        open={dialogo?.tipo === "conceder"}
        onClose={fechar}
        onDone={(mensagem) => {
          fechar();
          report({ ok: true }, mensagem);
        }}
      />
      {plataforma ? (
        <CopiarDaPlataformaDialog
          skillId={skill.id}
          open={dialogo?.tipo === "copiar"}
          onClose={fechar}
          onDone={(mensagem, novaId) => {
            fechar();
            // A cópia abre no ato: o Toast é da ficha de chegada, não desta.
            const href = `/ia/habilidades/${novaId}`;
            marcarChegada(href, mensagem);
            navegar(href);
          }}
        />
      ) : null}
      <ConfirmDialog
        open={dialogo?.tipo === "arquivar"}
        title={`Arquivar “${skill.name}”?`}
        description={`${concessoes.length === 0 ? "Nenhuma Concessão depende dela" : concessoes.length === 1 ? "A Concessão a um Agente fica indisponível" : `As ${concessoes.length} Concessões ficam indisponíveis`}; exercícios em curso terminam com a Versão carregada (RN-HAB-14). O rascunho fica preservado e o nome continua reservado (RN-HAB-02).`}
        confirmLabel="Arquivar"
        destructive
        onConfirm={() => {
          fechar();
          report(run((data, me) => arquivarHabilidade(data, me, skill.id)), "Habilidade arquivada.");
        }}
        onCancel={fechar}
      />
      <ConfirmDialog
        open={dialogo?.tipo === "descartar"}
        title={`Descartar o rascunho v${rascunho?.number ?? ""}?`}
        description="O que foi editado desde a última publicação se perde; a numeração não é reutilizada. Para voltar a editar, crie um rascunho a partir de uma Versão (12.2)."
        confirmLabel="Descartar"
        destructive
        onConfirm={() => {
          fechar();
          report(run((data, me) => descartarRascunhoDaHabilidade(data, me, skill.id)), "Rascunho descartado.");
        }}
        onCancel={fechar}
      />
      <ConfirmDialog
        open={dialogo?.tipo === "obsoletar"}
        title={`Obsoletar a Versão ${versaoObsoletando?.number ?? ""}?`}
        description={`Uma Versão obsoleta nunca é exercida (RN-HAB-03). ${fixadasNaObsoletando === 0 ? "Nenhuma Concessão está fixada nela." : fixadasNaObsoletando === 1 ? "A Concessão fixada nela fica indisponível." : `As ${fixadasNaObsoletando} Concessões fixadas nela ficam indisponíveis.`} Execuções passadas ficam íntegras (INV-HAB-03).`}
        confirmLabel="Obsoletar"
        destructive
        onConfirm={() => {
          if (dialogo?.tipo !== "obsoletar") return;
          const numero = dialogo.numero;
          fechar();
          setVersaoTocada(numero);
          report(run((data, me) => obsoletarVersaoDaHabilidade(data, me, skill.id, numero)), `v${numero} obsoletada.`);
        }}
        onCancel={fechar}
      />
      {concessaoEmDialogo ? (
        <FixarVersaoDialog
          key={concessaoEmDialogo.id}
          skill={skill}
          grant={concessaoEmDialogo}
          open={dialogo?.tipo === "fixar"}
          onClose={fechar}
          onDone={(r, mensagem) => {
            fechar();
            report(r, mensagem);
          }}
        />
      ) : null}
      <ConfirmDialog
        open={dialogo?.tipo === "revogar"}
        title={concessaoEmDialogo ? `Revogar de ${state.agents.find((a) => a.id === concessaoEmDialogo.agentId)?.name ?? "Agente"}?` : "Revogar a Concessão?"}
        description="O Agente deixa de exercer esta Habilidade a partir da próxima Execução; exercícios em curso terminam com a Versão carregada (RN-HAB-14). Isto cria a Versão seguinte do Agente (RN-AGE-06)."
        confirmLabel="Revogar"
        destructive
        onConfirm={() => {
          if (dialogo?.tipo !== "revogar") return;
          const grantId = dialogo.grantId;
          fechar();
          report(run((data, me) => revogarHabilidade(data, me, grantId)), "Concessão revogada.");
        }}
        onCancel={fechar}
      />
    </div>
  );
}

/** Uma Versão em leitura: instruções, contratos, Ferramentas, Dependências, Coleções recomendadas e o Efeito declarado. */
function VersaoEmLeitura({ skill, versao, titulo, nota }: { readonly skill: Skill; readonly versao: SkillVersion; readonly titulo: string; readonly nota: string }) {
  const state = useData((data) => data);
  const fmt = useFormat();
  const authorLabel = useNomeDoAtor();
  const efeito = efeitoDeclarado(state, versao);
  // Índice como chave: um rascunho em leitura pode repetir nomes (é o que a validação acusa).
  const parametro = (p: SkillVersion["inputContract"][number], i: number) => (
    <li key={i} className="app-sm flex flex-wrap items-baseline gap-x-2" style={{ color: "var(--texto-2)" }}>
      <span className="identificador">{p.name}</span>
      <span className="app-meta">{TIPO_DE_PARAMETRO_LABEL[p.type] ?? p.type}</span>
      {p.required ? <span className="app-coluna">obrigatório</span> : null}
      {p.description ? <span className="app-meta">— {p.description}</span> : null}
    </li>
  );
  return (
    <Painel className="min-w-0">
      <CabecalhoDePainel
        titulo={titulo}
        acao={
          <span className="flex items-center gap-2">
            <Pilula tom={VERSAO_TOM[versao.state]}>{VERSAO_LABEL[versao.state]}</Pilula>
            <Pilula tom={EFEITO_TOM[efeito]}>{EFEITO_LABEL[efeito]}</Pilula>
          </span>
        }
      />
      <div className="grid gap-4 p-4">
        <p className="app-meta">{nota}</p>
        <div>
          <ReguaDeSecao rotulo="Instruções" />
          {versao.instructions.trim() ? (
            <p className="app-base whitespace-pre-wrap" style={{ color: "var(--texto)" }}>
              {versao.instructions}
            </p>
          ) : (
            <ConditionMarker tone="warning">As Instruções estão vazias.</ConditionMarker>
          )}
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <ReguaDeSecao rotulo="Contrato de entrada" contagem={versao.inputContract.length} />
            {versao.inputContract.length === 0 ? <p className="app-meta">Só o pedido em texto.</p> : <ul className="grid gap-1">{versao.inputContract.map(parametro)}</ul>}
          </div>
          <div>
            <ReguaDeSecao rotulo="Contrato de saída" contagem={versao.outputContract.structured.length} />
            {versao.outputContract.structured.length === 0 ? null : <ul className="grid gap-1">{versao.outputContract.structured.map(parametro)}</ul>}
            <p className="app-meta mt-1">{versao.outputContract.text ? "Também devolve texto." : "Não devolve texto livre."}</p>
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <ReguaDeSecao rotulo="Ferramentas" contagem={versao.toolRequirements.length} />
            {versao.toolRequirements.length === 0 ? (
              <p className="app-meta">Nenhuma Ferramenta requerida.</p>
            ) : (
              <ul className="grid gap-1">
                {versao.toolRequirements.map((f) => {
                  const tool = state.tools.find((t) => t.id === f.toolId);
                  return (
                    <li key={f.toolId} className="app-sm flex flex-wrap items-center gap-x-2" style={{ color: "var(--texto-2)" }}>
                      <span style={{ color: "var(--texto)" }}>{tool?.name ?? f.toolId}</span>
                      {tool ? <span className="app-meta">{EFFECT_CLASS_LABEL[tool.effectClass] ?? tool.effectClass}</span> : <ConditionMarker tone="danger">não existe no Catálogo</ConditionMarker>}
                      {f.mandatory ? <Pilula tom="aviso">obrigatória</Pilula> : <Pilula tom="neutro">opcional</Pilula>}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
          <div>
            <ReguaDeSecao rotulo="Dependências" contagem={versao.dependencies.length} />
            {versao.dependencies.length === 0 ? (
              <p className="app-meta">Nenhuma.</p>
            ) : (
              <ul className="grid gap-1">
                {versao.dependencies.map((d) => {
                  const dep = state.skills.find((s) => s.id === d.skillId);
                  const href = `/ia/habilidades/${d.skillId}`;
                  return (
                    <li key={d.skillId} className="app-sm flex flex-wrap items-center gap-x-2" style={{ color: "var(--texto-2)" }}>
                      {dep ? (
                        <Link href={href} onNavigate={() => marcarSeMuda(href)} className="underline-offset-2 hover:underline" style={{ color: "var(--texto)" }}>
                          {dep.name}
                        </Link>
                      ) : (
                        <ConditionMarker tone="danger">“{d.skillId}” não existe</ConditionMarker>
                      )}
                      <span className="app-meta">{d.pinnedVersion !== undefined ? `fixada na v${d.pinnedVersion}` : "segue a corrente"}</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
          <div>
            <ReguaDeSecao rotulo="Coleções recomendadas" contagem={versao.recommendedCollectionIds.length} />
            {versao.recommendedCollectionIds.length === 0 ? (
              <p className="app-meta">Nenhuma.</p>
            ) : (
              <ul className="grid gap-1">
                {versao.recommendedCollectionIds.map((id) => {
                  const col = state.collections.find((c) => c.id === id);
                  return (
                    <li key={id} className="app-sm" style={{ color: "var(--texto-2)" }}>
                      {col ? <span style={{ color: "var(--texto)" }}>{col.name}</span> : <ConditionMarker tone="danger">“{id}” não existe</ConditionMarker>}
                    </li>
                  );
                })}
              </ul>
            )}
            <p className="app-meta mt-1">Declaração, não concessão (RN-HAB-10).</p>
          </div>
        </div>
        <dl className="grid gap-x-6 sm:grid-cols-2">
          <RecordRow label="Criada">{fmt.relative(versao.createdAt)}</RecordRow>
          <RecordRow label="Publicada">{versao.publishedAt ? `${versao.publishedBy ? `${authorLabel({ kind: "member", id: versao.publishedBy })} · ` : ""}${fmt.instant(versao.publishedAt)}` : "—"}</RecordRow>
        </dl>
        {skill.ownership === "plataforma" ? <p className="app-meta">Publicada pela plataforma; o Espaço de Trabalho só a referencia ou copia (INV-HAB-07).</p> : null}
      </div>
    </Painel>
  );
}

/** Uma Concessão no aside: o Agente, a Versão que exerce, a Disponibilidade com os motivos e o menu (fixar, seguir, revogar). */
function LinhaDeConcessao({
  grant,
  recente,
  onFixar,
  onSeguir,
  onRevogar,
}: {
  readonly grant: SkillGrant;
  readonly recente: boolean;
  readonly onFixar: () => void;
  readonly onSeguir: () => void;
  readonly onRevogar: () => void;
}) {
  const state = useData((data) => data);
  const { memberId } = useSession();
  const fmt = useFormat();
  const agent = state.agents.find((a) => a.id === grant.agentId);
  const skill = state.skills.find((s) => s.id === grant.skillId);
  const disponibilidade = disponibilidadeDaConcessao(state, grant);
  const governar = agent ? recusaDeGovernarAgente(state, memberId, agent, "editar") : "Agente não encontrado.";
  const publicadas = skill ? skill.versions.filter((v) => v.state === "publicada") : [];
  const href = `/ia/agentes/${grant.agentId}`;
  return (
    <li className={`item-solto${recente ? " surgir" : ""}`} data-bloco="true" data-estatico="true" data-recente={recente || undefined}>
      <div className="flex items-start gap-2">
        <span className="min-w-0 flex-1">
          <Link href={href} onNavigate={() => marcarSeMuda(href)} className="app-md block truncate underline-offset-2 hover:underline" style={{ color: "var(--texto)" }}>
            {agent?.name ?? "Agente eliminado"}
          </Link>
          <span className="app-meta block">concedida {fmt.relative(grant.grantedAt)}</span>
        </span>
        <ActionMenu
          label={`Ações da Concessão a ${agent?.name ?? "Agente"}`}
          items={[
            { label: "Fixar versão…", onSelect: onFixar, ...(governar ? { disabledReason: governar } : publicadas.length === 0 ? { disabledReason: "Não há Versão publicada para fixar (RN-HAB-03)." } : {}) },
            { label: "Seguir a corrente", onSelect: onSeguir, ...(governar ? { disabledReason: governar } : grant.pinnedVersion === undefined ? { disabledReason: "Já segue a corrente." } : {}) },
            { label: "Revogar", destructive: true, onSelect: onRevogar, ...(governar ? { disabledReason: governar } : {}) },
          ]}
        />
      </div>
      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
        <Pilula tom={grant.pinnedVersion !== undefined ? "info" : "neutro"}>{grant.pinnedVersion !== undefined ? `versão fixada ${grant.pinnedVersion}` : "segue a corrente"}</Pilula>
        <Pilula tom={DISPONIBILIDADE_TOM[disponibilidade.disponivel ? "disponivel" : "indisponivel"]}>{disponibilidade.disponivel ? "disponível" : "indisponível"}</Pilula>
      </div>
      {!disponibilidade.disponivel ? (
        <ul className="mt-1 grid gap-0.5">
          {disponibilidade.motivos.map((motivo) => (
            <li key={motivo} className="app-meta">
              · {motivo}
            </li>
          ))}
        </ul>
      ) : null}
    </li>
  );
}

/** Fixar a Concessão numa Versão publicada (RN-HAB-03); a Versão que valia até aqui fica dita no diálogo. */
function FixarVersaoDialog({
  skill,
  grant,
  open,
  onClose,
  onDone,
}: {
  readonly skill: Skill;
  readonly grant: SkillGrant;
  readonly open: boolean;
  readonly onClose: () => void;
  readonly onDone: (r: { ok: boolean; error?: string }, mensagem: string) => void;
}) {
  const state = useData((data) => data);
  const run = useRun();
  const [numero, setNumero] = useState(grant.pinnedVersion !== undefined ? String(grant.pinnedVersion) : "");
  const corrente = versaoCorrenteDaHabilidade(skill);
  const publicadas = skill.versions.filter((v) => v.state === "publicada").sort((a, b) => b.number - a.number);
  const agent = state.agents.find((a) => a.id === grant.agentId);
  const escolhida = numero ? Number(numero) : undefined;
  const motivo = escolhida === undefined ? "Escolha a Versão a fixar." : escolhida === grant.pinnedVersion ? "A Concessão já está fixada nesta Versão." : undefined;
  return (
    <ConfirmDialog
      open={open}
      title={`Fixar a Versão para ${agent?.name ?? "o Agente"}`}
      description={`Fixada, a Concessão não acompanha publicações futuras: só uma Versão publicada é exercível (RN-HAB-03), e obsoletar a fixada a torna indisponível. Hoje ${grant.pinnedVersion !== undefined ? `está fixada na v${grant.pinnedVersion}` : `segue a corrente${corrente ? ` (v${corrente.number})` : ""}`}.`}
      confirmLabel="Fixar"
      {...(motivo ? { confirmDisabledReason: motivo } : {})}
      onConfirm={() => {
        if (escolhida === undefined) return;
        const r = run((data, me) => fixarVersaoDaConcessao(data, me, grant.id, escolhida));
        onDone(r, `Concessão fixada na v${escolhida}.`);
      }}
      onCancel={onClose}
    >
      <Field label="Versão" required>
        {(id) => <Select id={id} value={numero} onChange={setNumero} placeholder="Escolher a Versão" options={publicadas.map((v) => ({ value: String(v.number), label: `Versão ${v.number}`, detail: v.number === corrente?.number ? "corrente" : "publicada" }))} />}
      </Field>
    </ConfirmDialog>
  );
}
