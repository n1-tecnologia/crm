"use client";

/**
 * O POPUP DA EMPRESA — a ficha no formato da Tarefa. Aberto da lista de
 * Empresas por `?empresa=<id>`: no centro, o tipo e o selo, o nome grande, a
 * razão social e a descrição, as propriedades em linhas compactas (ícone ·
 * rótulo · valor; o editor só ao clicar) e as seções Contatos, Negócios,
 * Filiais e Identificadores; à direita, a Atividade — as notas como conversa
 * e o registro recolhido. Tudo o que a página cheia sabe, sem sair da lista.
 */

import Link from "next/link";
import { useState } from "react";
import {
  Building2,
  Briefcase,
  ChevronRight,
  Fingerprint,
  Globe,
  Landmark,
  Network,
  Phone,
  Type,
  UserRound,
  Users,
} from "lucide-react";
import { useData, useRun } from "@/data/store";
import { addCompanyIdentifier, addCompanyNote, trashCompany, updateCompany } from "@/data/operations";
import { contactDisplayName } from "@/data/derive";
import type { CompanyIdentifier } from "@/data/types";
import { COMPANY_IDENTIFIER_LABEL, DEAL_SITUATION_LABEL } from "@/features/shell/format";
import { useFormat } from "@/features/shell/use-format";
import {
  ActionMenu,
  ActorAvatar,
  ConfirmDialog,
  CorpoDeTela,
  EmptyState,
  Icone,
  Pilula,
  ReguaDeSecao,
  Select,
  SidePanel,
  StateSeal,
} from "@/features/shell/ui";
import { LinhaDeProp } from "@/features/estrutura/linha-de-propriedade";
import { AsideDeAtividade, EditorDeIdentificador, EditorDeTexto, useAvisos, useNomeDoAtor } from "@/features/shell/ficha";

export function EmpresaPopup({ companyId, onClose }: { readonly companyId: string | null; readonly onClose: () => void }) {
  if (companyId === null) return null;
  return (
    <SidePanel
      title="Empresa"
      open
      onClose={onClose}
      semRespiro
      footer={
        <span className="flex flex-1 items-center justify-end">
          <Link href={`/crm/empresas/${companyId}`} className="btn btn-fantasma btn-sm">
            Abrir em página cheia
          </Link>
        </span>
      }
    >
      <EmpresaCompleta companyId={companyId} onClose={onClose} />
    </SidePanel>
  );
}

function EmpresaCompleta({ companyId, onClose }: { readonly companyId: string; readonly onClose: () => void }) {
  const state = useData((data) => data);
  const run = useRun();
  const fmt = useFormat();
  const { avisos, report } = useAvisos();
  const authorLabel = useNomeDoAtor();
  const [confirmingTrash, setConfirmingTrash] = useState(false);

  const company = state.companies.find((c) => c.id === companyId);
  if (!company) {
    return (
      <div className="p-6">
        <EmptyState title="Empresa não encontrada." hint="Ela pode ter sido eliminada, ou você não tem permissão para vê-la." />
      </div>
    );
  }

  const editavel = company.lifecycle === "ativo";
  const somenteLeitura = editavel ? undefined : company.lifecycle === "mesclado" ? "Uma Empresa mesclada é somente leitura." : "Uma Empresa arquivada ou na lixeira é somente leitura.";
  const gravar = (patch: Parameters<typeof updateCompany>[3], mensagem: string) =>
    report(run((data, me) => updateCompany(data, me, company.id, patch)), mensagem);

  const nome = company.tradeName || company.legalName;
  const proprietario = state.members.find((m) => m.id === company.ownerMemberId);
  const matriz = company.parentCompanyId ? state.companies.find((c) => c.id === company.parentCompanyId) : undefined;
  const vinculos = state.contactCompanyLinks.filter((l) => l.companyId === company.id && !l.end);
  const negocios = state.deals.filter((d) => d.companyId === company.id && d.lifecycle === "ativo");
  const filiais = state.companies.filter((c) => c.parentCompanyId === company.id && c.lifecycle === "ativo");
  const identificador = (tipo: CompanyIdentifier["type"]) => company.identifiers.filter((i) => i.type === tipo);
  const activity = state.activity.filter((a) => a.objectId === company.id);

  const linhaDeIdentificador = (tipo: CompanyIdentifier["type"], icone: typeof Globe) => {
    const valores = identificador(tipo);
    return (
      <LinhaDeProp
        icone={icone}
        rotulo={COMPANY_IDENTIFIER_LABEL[tipo] ?? tipo}
        valor={valores.length === 0 ? "Vazio" : valores.map((i) => i.value).join(" · ")}
        editavel={editavel}
        motivo={somenteLeitura}
        editor={
          <EditorDeIdentificador
            placeholder={`Novo ${(COMPANY_IDENTIFIER_LABEL[tipo] ?? tipo).toLocaleLowerCase("pt-BR")}`}
            onAdd={(valor) => report(run((data, me) => addCompanyIdentifier(data, me, company.id, tipo, valor)), `${COMPANY_IDENTIFIER_LABEL[tipo]} acrescentado.`)}
          />
        }
      />
    );
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ConfirmDialog
        open={confirmingTrash}
        title={`Enviar “${nome}” à lixeira?`}
        description="A Empresa sai das listas e pode ser restaurada na Lixeira. Os Contatos e Negócios continuam existindo."
        confirmLabel="Enviar à lixeira"
        destructive
        onConfirm={() => {
          const r = run((data, me) => trashCompany(data, me, company.id));
          setConfirmingTrash(false);
          report(r, "Empresa enviada à lixeira.");
          if (r.ok) onClose();
        }}
        onCancel={() => setConfirmingTrash(false)}
      />

      <div className="@container flex min-h-0 flex-1">
        <div className="flex min-h-0 flex-1 flex-col @4xl:flex-row">
          <CorpoDeTela>
            {avisos}

            <div className="@container mx-auto w-full max-w-4xl">
              {/* ── o tipo, o selo, o menu ── */}
              <div className="flex flex-wrap items-center gap-2">
                <Pilula cor="var(--info)" className="gap-1.5">
                  <Icone de={Building2} tamanho="xs" />
                  Empresa
                </Pilula>
                <StateSeal state={company.lifecycle} />
                <span className="ml-auto">
                  <ActionMenu
                    items={[
                      {
                        label: "Enviar à lixeira",
                        onSelect: () => setConfirmingTrash(true),
                        destructive: true,
                        ...(company.lifecycle === "naLixeira" ? { disabledReason: "Já está na lixeira." } : {}),
                      },
                    ]}
                  />
                </span>
              </div>

              {/* ── o nome grande, a razão social, a descrição ── */}
              <h1 className="ed-display mt-3 px-2 py-1">{nome}</h1>
              {company.legalName && company.legalName !== company.tradeName ? (
                <p className="app-base px-2" style={{ color: "var(--texto-3)" }}>
                  {company.legalName}
                </p>
              ) : null}
              <LinhaDeProp
                icone={Type}
                rotulo="Descrição"
                valor={company.description || "Adicionar descrição…"}
                editavel={editavel}
                motivo={somenteLeitura}
                editor={<EditorDeTexto valor={company.description} onSave={(v) => gravar({ description: v }, "Descrição alterada.")} placeholder="Para que serve esta Empresa" />}
              />

              {/* ── as propriedades, em duas colunas ── */}
              <div className="mt-4 grid gap-x-8 gap-y-0.5 @3xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                <div className="grid min-w-0 content-start gap-0.5">
                  <LinhaDeProp
                    icone={Building2}
                    rotulo="Nome de exibição"
                    valor={company.tradeName || "Vazio"}
                    editavel={editavel}
                    motivo={somenteLeitura}
                    editor={<EditorDeTexto valor={company.tradeName} onSave={(v) => gravar({ tradeName: v }, "Nome de exibição alterado.")} placeholder="Como a Empresa é chamada" />}
                  />
                  <LinhaDeProp
                    icone={Landmark}
                    rotulo="Razão social"
                    valor={company.legalName || "Vazio"}
                    editavel={editavel}
                    motivo={somenteLeitura}
                    editor={<EditorDeTexto valor={company.legalName} onSave={(v) => gravar({ legalName: v }, "Razão social alterada.")} placeholder="Nome no registro" />}
                  />
                  {linhaDeIdentificador("dominio", Globe)}
                  {linhaDeIdentificador("documentoFiscal", Fingerprint)}
                  {linhaDeIdentificador("telefone", Phone)}
                </div>
                <div className="grid min-w-0 content-start gap-0.5">
                  <LinhaDeProp
                    icone={UserRound}
                    rotulo="Proprietário"
                    valor={
                      proprietario ? (
                        <span className="flex items-center gap-1.5">
                          <ActorAvatar kind="member" name={proprietario.displayName} {...(proprietario.photoFileId ? { photoFileId: proprietario.photoFileId } : {})} />
                          {proprietario.displayName}
                        </span>
                      ) : (
                        "Vazio"
                      )
                    }
                    editavel={editavel}
                    motivo={somenteLeitura}
                    editor={
                      <span className="block w-56">
                        <Select
                          value={company.ownerMemberId}
                          onChange={(v) => gravar({ ownerMemberId: v }, "Proprietário alterado.")}
                          options={state.members.filter((m) => m.state === "ativo").map((m) => ({ value: m.id, label: m.displayName }))}
                        />
                      </span>
                    }
                  />
                  <LinhaDeProp
                    icone={Network}
                    rotulo="Empresa matriz"
                    valor={matriz ? matriz.tradeName || matriz.legalName : "Nenhuma"}
                    editavel={editavel}
                    motivo={somenteLeitura}
                    editor={
                      <span className="block w-64">
                        <Select
                          value={company.parentCompanyId ?? ""}
                          onChange={(v) => gravar({ parentCompanyId: v || null }, v ? "Empresa matriz alterada." : "Empresa matriz desfeita.")}
                          searchable
                          placeholder="Nenhuma"
                          options={[
                            { value: "", label: "Nenhuma" },
                            ...state.companies
                              .filter((c) => c.id !== company.id && c.lifecycle === "ativo")
                              .map((c) => ({ value: c.id, label: c.tradeName || c.legalName })),
                          ]}
                        />
                      </span>
                    }
                  />
                  <LinhaDeProp icone={Briefcase} rotulo="Negócios" valor={`${negocios.length} ${negocios.length === 1 ? "aberto ou fechado" : "no total"}`} />
                  <LinhaDeProp icone={Users} rotulo="Contatos" valor={`${vinculos.length} ${vinculos.length === 1 ? "vinculado" : "vinculados"}`} />
                  <LinhaDeProp
                    icone={ChevronRight}
                    rotulo="Estado"
                    valor={company.lifecycle === "ativo" ? "Ativa" : <StateSeal state={company.lifecycle} />}
                    motivo="O estado muda por um ato: a lixeira, a restauração, a mesclagem."
                  />
                </div>
              </div>

              <hr className="my-6 border-0" style={{ borderTop: "1px solid var(--linha)" }} />

              {/* ── as seções ── */}
              <div className="grid gap-6">
                <section>
                  <ReguaDeSecao rotulo="Contatos" contagem={vinculos.length} />
                  {vinculos.length === 0 ? (
                    <EmptyState compact title="Nenhum Contato vinculado." hint="Vincule um Contato na página cheia." />
                  ) : (
                    <ul className="pilha-solta">
                      {vinculos.map((link) => {
                        const contact = state.contacts.find((c) => c.id === link.contactId);
                        if (!contact) return null;
                        return (
                          <li key={link.id}>
                            <Link href={`/crm/contatos/${contact.id}`} className="item-solto">
                              <ActorAvatar kind="member" name={contactDisplayName(contact)} />
                              <span className="min-w-0 flex-1">
                                <span className="app-md block truncate" style={{ color: "var(--texto)" }}>
                                  {contactDisplayName(contact)}
                                </span>
                                <span className="app-meta block truncate">
                                  {link.role || "sem cargo"}
                                  {link.principalForCompany ? " · principal" : ""}
                                </span>
                              </span>
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </section>

                <section>
                  <ReguaDeSecao rotulo="Negócios" contagem={negocios.length} />
                  {negocios.length === 0 ? (
                    <EmptyState compact title="Nenhum Negócio." />
                  ) : (
                    <ul className="pilha-solta">
                      {negocios.map((deal) => (
                        <li key={deal.id}>
                          <Link href={`/crm/negocios/${deal.id}`} className="item-solto">
                            <span className="min-w-0 flex-1">
                              <span className="app-md block truncate" style={{ color: "var(--texto)" }}>
                                {deal.title}
                              </span>
                              <span className="app-meta block truncate">
                                {state.funnels.find((f) => f.id === deal.funnelId)?.name ?? "Funil"} · {deal.value ? fmt.money(deal.value) : "sem valor declarado"}
                              </span>
                            </span>
                            <Pilula tom={deal.situation === "ganho" ? "sucesso" : deal.situation === "perdido" ? "neutro" : "info"}>
                              {DEAL_SITUATION_LABEL[deal.situation]}
                            </Pilula>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>

                <section>
                  <ReguaDeSecao rotulo="Filiais" contagem={filiais.length} />
                  {filiais.length === 0 ? (
                    <EmptyState compact title="Nenhuma filial." hint="Uma filial é a Empresa que tem esta como matriz." />
                  ) : (
                    <ul className="pilha-solta">
                      {filiais.map((filial) => (
                        <li key={filial.id}>
                          <Link href={`/crm/empresas?empresa=${filial.id}`} className="item-solto">
                            <Icone de={Building2} tamanho="xs" style={{ color: "var(--texto-3)" }} />
                            <span className="app-md min-w-0 flex-1 truncate" style={{ color: "var(--texto)" }}>
                              {filial.tradeName || filial.legalName}
                            </span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>

                <section>
                  <ReguaDeSecao rotulo="Identificadores" contagem={company.identifiers.length} />
                  {company.identifiers.length === 0 ? (
                    <EmptyState compact title="Nenhum identificador cadastrado." />
                  ) : (
                    <ul className="grid gap-1">
                      {company.identifiers.map((i) => (
                        <li key={i.id} className="app-base flex items-center gap-2" style={{ color: "var(--texto)" }}>
                          <span className="app-meta w-32 shrink-0">{COMPANY_IDENTIFIER_LABEL[i.type] ?? i.type}</span>
                          <span className="identificador">{i.value}</span>
                          {i.principal ? <span className="app-meta">· principal</span> : null}
                          {i.verified ? <span className="app-meta">· verificado</span> : null}
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              </div>
            </div>
          </CorpoDeTela>

          {/* ── à direita: a Atividade — notas como conversa, registro recolhido ── */}
          <AsideDeAtividade
            comments={company.comments}
            activity={activity}
            onAddNote={(texto) => run((data, me) => addCompanyNote(data, me, company.id, texto))}
            editavel={editavel}
            authorLabel={authorLabel}
            report={report}
            vazioDoRegistro="Nenhum Registro de Atividade nesta Empresa."
            vazioDica="O que você escrever aqui fica na Empresa, com autor e hora — não sai da plataforma."
          />
        </div>
      </div>
    </div>
  );
}

