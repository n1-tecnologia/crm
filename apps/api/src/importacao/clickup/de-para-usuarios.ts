/**
 * De-para de identidade: ClickUp user id → e-mail (a identidade) + Papel
 * esperado (D-09, D-10, D-11, PREP-04). Não chama `inviteMember` — só
 * descreve a correspondência. Quem convida é a importação (Fases 2/3): o
 * e-mail vira Membro `pendente` se a pessoa ainda não entrou, ou reativa o
 * Membro `removido` já existente (RN-ET-11, casando por `userId` OU
 * `invitedIdentity` desde 01-10) — não exige nenhum Membro existir agora.
 *
 * `roleIdEsperado` é uma união literal dos 4 Papéis de sistema que
 * `buildGestaoBootstrap()` cria de fato (`role_prop`/`role_adm`/`role_mem`/
 * `role_conv`, packages/dominio/src/bootstrap-gestao.ts linhas 113-116) — um
 * id fora desses 4 não compila, e o teste (c) cruza com o bootstrap real
 * para provar que os 4 continuam existindo lá.
 *
 * Colisão de identidade (RESEARCH.md Open Question 3): o ClickUp id
 * `81581816` ("Contas a Pagar", Financeiro) É a Maryane, já Membro de
 * produção com o id fixo `mem_maryane` — mas com e-mail de TESTE (D-09 da
 * Fase 1: "e-mail de teste por enquanto"). Esta entrada carrega o campo
 * `memberIdConhecido` apontando para esse id fixo: a importação DEVE checar
 * esse campo antes de chamar `inviteMember`, senão cria um segundo Membro
 * para a mesma pessoa. O e-mail real dela entra aqui, mas o `.email` do
 * Membro `mem_maryane` já gravado NÃO é alterado nesta fase — troca o
 * e-mail de teste fica para quando a Fase 1 resolver isso.
 *
 * Item em aberto (revisor FO, `81581802`): `usuarios.cli.ts` (Plan 00-02
 * Task 1) não encontrou este id em `GET /team`, nas 3 `GET /list/{id}/member`
 * do Financeiro Tria nem na 1ª página de Tarefas da Solicitação — 5/6
 * resolvidos. A hipótese mais provável é que esta pessoa pertence ao Team
 * Family Office/Marcos Paulo (`9011658148`), fora do alcance do token usado
 * (que só tem acesso confirmado ao Team Tria `9011731314`) e das 3 Listas do
 * Financeiro Tria. Em vez de inventar um e-mail plausível, esta entrada fica
 * com `fonteDoEmail: "nao-resolvido"` e `email: ""` — uma string vazia falha
 * a validação de e-mail de `inviteMember` (`fail("Informe um e-mail válido
 * para o convite.")`), então esta entrada não pode virar Membro por acidente
 * antes que o dono informe o e-mail real. Ver SUMMARY do Plan 00-02 para o
 * item em aberto.
 */

import type { Id } from "@n1/dominio/types/primitives";

export type RoleIdDeSistema = "role_prop" | "role_adm" | "role_mem" | "role_conv";
export type PapelNoProcesso = "financeiro" | "aprovador" | "revisor";

export interface EntradaDeParaUsuario {
  readonly clickupUserId: string;
  /** Username como aparece no ClickUp (ou uma nota, para o item em aberto). */
  readonly nome: string;
  /** Identidade — vira Membro por `inviteMember` (D-09); minúsculas; "" quando não resolvido. */
  readonly email: string;
  readonly roleIdEsperado: RoleIdDeSistema;
  readonly papelNoProcesso: PapelNoProcesso;
  /** Só quando já existe Membro na plataforma (81581816 → mem_maryane); a importação NÃO chama inviteMember. */
  readonly memberIdConhecido?: Id;
  /**
   * "clickup-api": resolvido por `usuarios.cli.ts` contra a API real.
   * "dono": o dono informou o e-mail diretamente (fallback do auth gate da Task 1).
   * "nao-resolvido": nenhuma das duas fontes deu certo ainda — item em aberto.
   */
  readonly fonteDoEmail: "clickup-api" | "dono" | "nao-resolvido";
}

/** Os 6 ids de CON-11 — Elifas, Fabíola, Thiago, Iallas, Financeiro, revisor FO. */
export const DE_PARA_USUARIOS: readonly EntradaDeParaUsuario[] = [
  {
    clickupUserId: "81591229",
    nome: "Elifas Levi Fiszer Jr",
    email: "elifas.levi@triacompany.com.br",
    roleIdEsperado: "role_mem",
    papelNoProcesso: "aprovador",
    fonteDoEmail: "clickup-api",
  },
  {
    clickupUserId: "81581798",
    nome: "Fabíola Neves - Backoffice",
    email: "fabiola.neves@triacompany.com.br",
    roleIdEsperado: "role_mem",
    papelNoProcesso: "aprovador",
    fonteDoEmail: "clickup-api",
  },
  {
    clickupUserId: "81581826",
    nome: "Thiago Nascimento",
    email: "thiago.nascimento@triacompany.com.br",
    roleIdEsperado: "role_mem",
    papelNoProcesso: "aprovador",
    fonteDoEmail: "clickup-api",
  },
  {
    clickupUserId: "81582295",
    nome: "Iallas Oliveira",
    email: "iallas@triacompany.com.br",
    roleIdEsperado: "role_mem",
    papelNoProcesso: "aprovador",
    fonteDoEmail: "clickup-api",
  },
  {
    clickupUserId: "81581816",
    nome: "Maryane Generozo",
    email: "maryane.generozo@triacompany.com.br",
    roleIdEsperado: "role_prop",
    papelNoProcesso: "financeiro",
    memberIdConhecido: "mem_maryane",
    fonteDoEmail: "clickup-api",
  },
  {
    clickupUserId: "81581802",
    nome: "(não resolvido — ausente em GET /team, nas 3 GET /list/{id}/member do Financeiro Tria e na 1ª página de Tarefas da Solicitação; provavelmente do Team Family Office/Marcos Paulo 9011658148)",
    email: "",
    roleIdEsperado: "role_mem",
    papelNoProcesso: "revisor",
    fonteDoEmail: "nao-resolvido",
  },
];

export function entradaPorClickupId(id: string): EntradaDeParaUsuario | undefined {
  return DE_PARA_USUARIOS.find((entrada) => entrada.clickupUserId === id);
}

/**
 * As 38 variáveis `CLICKUP_*` do `automation/src` do tenant Tria (sem
 * prefixo) mais as variantes por tenant (`MP_` = Marcos Paulo, `FO_` =
 * Family Office) — 62 no total, contadas por
 * `grep -rhoE '[A-Z0-9_]*CLICKUP_[A-Z0-9_]+' ../financeiro-tria/automation/src | sort -u`
 * em 2026-09-16 (D-12). "38" é sempre o conjunto SEM prefixo (config do
 * tenant Tria); MP_/FO_ são a mesma forma de configuração repetida por
 * tenant, nunca um nome novo de variável.
 *
 * `valorConhecido` só para `id-de-team`/`id-de-lista`/`status`/`tag` — os
 * valores documentados em `docs/08-migracao-financeiro/01-inventario-*`
 * §3/§4.1; nunca para `token` nem para os demais tipos (mesmo quando o
 * inventário documenta um, como a opção "Manual" — a instrução deste plano
 * restringe `valorConhecido` a essas 4 categorias).
 *
 * `entraNoDePara` é sobre PRESENÇA no de-para (o id tem uma entrada em
 * `DE_PARA_USUARIOS`), não sobre a identidade estar 100% resolvida — por
 * isso variáveis que apontam para `81581802` (o item em aberto) valem
 * `true`: a entrada existe, só o e-mail que falta.
 */
export type TenantDoAutomation = "tria" | "marcos-paulo" | "family-office";
export type TipoDeVariavelClickUp =
  | "token"
  | "id-de-team"
  | "id-de-lista"
  | "id-de-usuario"
  | "ids-de-usuario"
  | "nome-de-usuario"
  | "mencao"
  | "status"
  | "tag"
  | "opcao-de-campo"
  | "nome-de-campo"
  | "limite-de-valor";

export interface VariavelClickUp {
  readonly nome: string;
  readonly tenant: TenantDoAutomation;
  readonly tipo: TipoDeVariavelClickUp;
  readonly uso: string;
  readonly clickupUserId?: string;
  readonly clickupUserIds?: readonly string[];
  readonly valorConhecido?: string;
  readonly entraNoDePara: boolean;
}

export const CATALOGO_CLICKUP: readonly VariavelClickUp[] = [
  // --- Tria (sem prefixo) — 38 ---
  {
    nome: "CLICKUP_API_TOKEN",
    tenant: "tria",
    tipo: "token",
    uso: "adapters/clickup.ts — token de autenticação de todas as chamadas à API do ClickUp (fallback: CLICKUP_REPORTS_TOKEN)",
    entraNoDePara: false,
  },
  {
    nome: "CLICKUP_APROVADOR_VALOR_LIMITE",
    tenant: "tria",
    tipo: "limite-de-valor",
    uso: "tenants/tria/payment-rules.ts e config.ts — limite em R$ (padrão 5000) que decide a rota de aprovação alto/baixo por centro de custo",
    entraNoDePara: false,
  },
  {
    nome: "CLICKUP_CF_MANUAL_FIELD_NAME",
    tenant: "tria",
    tipo: "nome-de-campo",
    uso: "tenants/tria/config.ts e http/routes.ts — nome do Campo Personalizado 'Integração manual' na Lista, lido por nome",
    entraNoDePara: false,
  },
  {
    nome: "CLICKUP_CF_MANUAL_OPTION_ID",
    tenant: "tria",
    tipo: "opcao-de-campo",
    uso: "tenants/tria/config.ts, http/routes.ts, family-office/payment-automation-service.ts — id da opção 'Manual' desse Campo",
    entraNoDePara: false,
  },
  {
    nome: "CLICKUP_CONTAS_A_PAGAR_ID",
    tenant: "tria",
    tipo: "id-de-usuario",
    uso: "tenants/tria/config.ts (contasAPagarUserId) e payment-automation-service.ts — ClickUp user id do 'Financeiro' (Maryane), usado como atribuído/revisor/fallback",
    clickupUserId: "81581816",
    entraNoDePara: true,
  },
  {
    nome: "CLICKUP_LIST_CONTAS_PAGAR_ID",
    tenant: "tria",
    tipo: "id-de-lista",
    uso: "tenants/tria/config.ts e payment-automation-service.ts — id da Lista 'Contas a pagar' do Team Tria",
    valorConhecido: "901107637383",
    entraNoDePara: false,
  },
  {
    nome: "CLICKUP_LIST_SOLICITACAO_PAGAMENTO_ID",
    tenant: "tria",
    tipo: "id-de-lista",
    uso: "tenants/tria/config.ts, clickup-payment-mapper.ts, adapters/clickup.ts — id da Lista 'Solicitação de pagamento'",
    valorConhecido: "901109104938",
    entraNoDePara: false,
  },
  {
    nome: "CLICKUP_REPORTS_TOKEN",
    tenant: "tria",
    tipo: "token",
    uso: "adapters/clickup.ts — segundo token aceito como fallback de CLICKUP_API_TOKEN",
    entraNoDePara: false,
  },
  {
    nome: "CLICKUP_RESPONSAVEL_AUTON_ID",
    tenant: "tria",
    tipo: "id-de-usuario",
    uso: "tenants/tria/payment-rules.ts (APPROVAL_ROUTES, centro de custo 'auton health') — id do aprovador Thiago",
    clickupUserId: "81581826",
    entraNoDePara: true,
  },
  {
    nome: "CLICKUP_RESPONSAVEL_AUTON_NOME",
    tenant: "tria",
    tipo: "nome-de-usuario",
    uso: "tenants/tria/payment-rules.ts — nome exibido do aprovador da rota 'auton health' (Thiago)",
    entraNoDePara: false,
  },
  {
    nome: "CLICKUP_RESPONSAVEL_FINQ_ID",
    tenant: "tria",
    tipo: "id-de-usuario",
    uso: "tenants/tria/payment-rules.ts (centro de custo 'finq') — id do aprovador Elifas",
    clickupUserId: "81591229",
    entraNoDePara: true,
  },
  {
    nome: "CLICKUP_RESPONSAVEL_FINQ_NOME",
    tenant: "tria",
    tipo: "nome-de-usuario",
    uso: "tenants/tria/payment-rules.ts — nome exibido do aprovador da rota 'finq' (Elifas)",
    entraNoDePara: false,
  },
  {
    nome: "CLICKUP_RESPONSAVEL_IGOR_ID",
    tenant: "tria",
    tipo: "id-de-usuario",
    uso: "tenants/tria/payment-rules.ts (centro de custo 'igor alves') — id do aprovador Iallas",
    clickupUserId: "81582295",
    entraNoDePara: true,
  },
  {
    nome: "CLICKUP_RESPONSAVEL_IGOR_NOME",
    tenant: "tria",
    tipo: "nome-de-usuario",
    uso: "tenants/tria/payment-rules.ts — nome exibido do aprovador da rota 'igor alves' (Iallas)",
    entraNoDePara: false,
  },
  {
    nome: "CLICKUP_RESPONSAVEL_PRESIDENCIA_ALTO_ID",
    tenant: "tria",
    tipo: "id-de-usuario",
    uso: "tenants/tria/payment-rules.ts — rota 'presidência', valor ≥ limite — id do aprovador Elifas",
    clickupUserId: "81591229",
    entraNoDePara: true,
  },
  {
    nome: "CLICKUP_RESPONSAVEL_PRESIDENCIA_ALTO_NOME",
    tenant: "tria",
    tipo: "nome-de-usuario",
    uso: "tenants/tria/payment-rules.ts — nome exibido do aprovador da rota 'presidência' alto valor (Elifas)",
    entraNoDePara: false,
  },
  {
    nome: "CLICKUP_RESPONSAVEL_PRESIDENCIA_BAIXO_ID",
    tenant: "tria",
    tipo: "id-de-usuario",
    uso: "tenants/tria/payment-rules.ts — rota 'presidência', valor < limite — id da aprovadora Fabíola",
    clickupUserId: "81581798",
    entraNoDePara: true,
  },
  {
    nome: "CLICKUP_RESPONSAVEL_PRESIDENCIA_BAIXO_NOME",
    tenant: "tria",
    tipo: "nome-de-usuario",
    uso: "tenants/tria/payment-rules.ts — nome exibido do aprovador da rota 'presidência' baixo valor (Fabíola)",
    entraNoDePara: false,
  },
  {
    nome: "CLICKUP_RESPONSAVEL_ROBERTH_ID",
    tenant: "tria",
    tipo: "id-de-usuario",
    uso: "tenants/tria/payment-rules.ts (centro de custo 'roberth resende') — id do aprovador Iallas",
    clickupUserId: "81582295",
    entraNoDePara: true,
  },
  {
    nome: "CLICKUP_RESPONSAVEL_ROBERTH_NOME",
    tenant: "tria",
    tipo: "nome-de-usuario",
    uso: "tenants/tria/payment-rules.ts — nome exibido do aprovador da rota 'roberth resende' (Iallas)",
    entraNoDePara: false,
  },
  {
    nome: "CLICKUP_RESPONSAVEL_TRIA_ALTO_ID",
    tenant: "tria",
    tipo: "id-de-usuario",
    uso: "tenants/tria/payment-rules.ts — rota 'tria', valor ≥ limite — id do aprovador Thiago",
    clickupUserId: "81581826",
    entraNoDePara: true,
  },
  {
    nome: "CLICKUP_RESPONSAVEL_TRIA_ALTO_NOME",
    tenant: "tria",
    tipo: "nome-de-usuario",
    uso: "tenants/tria/payment-rules.ts — nome exibido do aprovador da rota 'tria' alto valor (Thiago)",
    entraNoDePara: false,
  },
  {
    nome: "CLICKUP_RESPONSAVEL_TRIA_BAIXO_ID",
    tenant: "tria",
    tipo: "id-de-usuario",
    uso: "tenants/tria/payment-rules.ts — rota 'tria', valor < limite — id da aprovadora Fabíola",
    clickupUserId: "81581798",
    entraNoDePara: true,
  },
  {
    nome: "CLICKUP_RESPONSAVEL_TRIA_BAIXO_NOME",
    tenant: "tria",
    tipo: "nome-de-usuario",
    uso: "tenants/tria/payment-rules.ts — nome exibido do aprovador da rota 'tria' baixo valor (Fabíola)",
    entraNoDePara: false,
  },
  {
    nome: "CLICKUP_RESPONSAVEL_TRIA_ID",
    tenant: "tria",
    tipo: "id-de-usuario",
    uso: "tenants/tria/payment-rules.ts (DEFAULT_RESPONSIBLE_ID) — fallback 'Financeiro TRIA' quando nenhuma rota de centro de custo casa",
    clickupUserId: "81581816",
    entraNoDePara: true,
  },
  {
    nome: "CLICKUP_RESPONSAVEL_TRIA_MENTION",
    tenant: "tria",
    tipo: "mencao",
    uso: "tenants/tria/payment-rules.ts — texto de menção do fallback 'Financeiro TRIA' no Comentário/RESUMO",
    entraNoDePara: false,
  },
  {
    nome: "CLICKUP_RESPONSAVEL_TRIA_NOME",
    tenant: "tria",
    tipo: "nome-de-usuario",
    uso: "tenants/tria/payment-rules.ts — nome exibido do fallback 'Financeiro TRIA'",
    entraNoDePara: false,
  },
  {
    nome: "CLICKUP_RESPONSAVEL_TRIA_TECH_ID",
    tenant: "tria",
    tipo: "id-de-usuario",
    uso: "tenants/tria/payment-rules.ts (centro de custo 'tria tech') — id do aprovador Thiago",
    clickupUserId: "81581826",
    entraNoDePara: true,
  },
  {
    nome: "CLICKUP_RESPONSAVEL_TRIA_TECH_NOME",
    tenant: "tria",
    tipo: "nome-de-usuario",
    uso: "tenants/tria/payment-rules.ts — nome exibido do aprovador da rota 'tria tech' (Thiago)",
    entraNoDePara: false,
  },
  {
    nome: "CLICKUP_REVIEWER_IDS",
    tenant: "tria",
    tipo: "ids-de-usuario",
    uso: "tenants/tria/payment-rules.ts e config.ts (DEFAULT_REVIEWER_IDS) — ids que podem revisar/reprocessar o RESUMO por Comentário no thread",
    clickupUserIds: ["81581816", "81581814"],
    entraNoDePara: false,
  },
  {
    nome: "CLICKUP_STATUS_APROVADO",
    tenant: "tria",
    tipo: "status",
    uso: "tenants/tria/config.ts e payment-automation-service.ts — nome do Status pós-aprovação",
    valorConhecido: "aprovado",
    entraNoDePara: false,
  },
  {
    nome: "CLICKUP_STATUS_EM_LANCAMENTO_OMIE",
    tenant: "tria",
    tipo: "status",
    uso: "tenants/tria/config.ts — nome do Status 'em lançamento no Omie'",
    valorConhecido: "em lançamento omie",
    entraNoDePara: false,
  },
  {
    nome: "CLICKUP_STATUS_LANCADO_OMIE",
    tenant: "tria",
    tipo: "status",
    uso: "tenants/tria/config.ts e payment-automation-service.ts — nome do Status pós-lançamento no Omie",
    valorConhecido: "lançado omie",
    entraNoDePara: false,
  },
  {
    nome: "CLICKUP_STATUS_PARA_PAGAR",
    tenant: "tria",
    tipo: "status",
    uso: "tenants/tria/payment-automation-service.ts — nome do Status 'pronto para pagar'",
    valorConhecido: "para pagar",
    entraNoDePara: false,
  },
  {
    nome: "CLICKUP_STATUS_REPROVADO",
    tenant: "tria",
    tipo: "status",
    uso: "tenants/tria/config.ts e payment-automation-service.ts — nome do Status de reprovação",
    valorConhecido: "não aprovado",
    entraNoDePara: false,
  },
  {
    nome: "CLICKUP_TAG_FINQ",
    tenant: "tria",
    tipo: "tag",
    uso: "tenants/tria/payment-rules.ts — Tag aplicada às contas do centro de custo 'finq'",
    valorConhecido: "finq",
    entraNoDePara: false,
  },
  {
    nome: "CLICKUP_TAG_TRIA",
    tenant: "tria",
    tipo: "tag",
    uso: "tenants/tria/payment-rules.ts — Tag aplicada às contas Tria",
    valorConhecido: "conta tria",
    entraNoDePara: false,
  },
  {
    nome: "CLICKUP_TEAM_ID",
    tenant: "tria",
    tipo: "id-de-team",
    uso: "tenants/tria/config.ts — id do Team/Workspace Tria no ClickUp",
    valorConhecido: "9011731314",
    entraNoDePara: false,
  },

  // --- Marcos Paulo (MP_) — 11 ---
  {
    nome: "MP_CLICKUP_CF_MANUAL_OPTION_ID",
    tenant: "marcos-paulo",
    tipo: "opcao-de-campo",
    uso: "tenants/marcos-paulo/config.ts — id da opção 'Manual' desse tenant (sem valor padrão hoje)",
    entraNoDePara: false,
  },
  {
    nome: "MP_CLICKUP_CONTAS_A_PAGAR_ID",
    tenant: "marcos-paulo",
    tipo: "id-de-usuario",
    uso: "tenants/marcos-paulo/config.ts (contasAPagarUserId) — mesmo Financeiro (Maryane) dos outros tenants",
    clickupUserId: "81581816",
    entraNoDePara: true,
  },
  {
    nome: "MP_CLICKUP_LIST_CONTAS_PAGAR_ID",
    tenant: "marcos-paulo",
    tipo: "id-de-lista",
    uso: "tenants/marcos-paulo/config.ts — id da Lista 'Contas a pagar' compartilhada entre Marcos Paulo e Family Office",
    valorConhecido: "901111928443",
    entraNoDePara: false,
  },
  {
    nome: "MP_CLICKUP_LIST_SOLICITACAO_ID",
    tenant: "marcos-paulo",
    tipo: "id-de-lista",
    uso: "tenants/marcos-paulo/config.ts — id da Lista de Solicitação (mesma Lista compartilhada MP+FO)",
    valorConhecido: "901111928443",
    entraNoDePara: false,
  },
  {
    nome: "MP_CLICKUP_REVIEWER_IDS",
    tenant: "marcos-paulo",
    tipo: "ids-de-usuario",
    uso: "tenants/marcos-paulo/config.ts — ids que podem revisar o RESUMO por Comentário neste tenant",
    clickupUserIds: ["81581816", "81581814"],
    entraNoDePara: false,
  },
  {
    nome: "MP_CLICKUP_STATUS_APROVADO",
    tenant: "marcos-paulo",
    tipo: "status",
    uso: "tenants/marcos-paulo/config.ts — nome do Status pós-aprovação",
    valorConhecido: "aprovado",
    entraNoDePara: false,
  },
  {
    nome: "MP_CLICKUP_STATUS_EM_LANCAMENTO_OMIE",
    tenant: "marcos-paulo",
    tipo: "status",
    uso: "tenants/marcos-paulo/config.ts — nome do Status 'em lançamento no Omie'",
    valorConhecido: "em lançamento omie",
    entraNoDePara: false,
  },
  {
    nome: "MP_CLICKUP_STATUS_LANCADO_OMIE",
    tenant: "marcos-paulo",
    tipo: "status",
    uso: "tenants/marcos-paulo/config.ts — nome do Status pós-lançamento no Omie",
    valorConhecido: "lançado omie",
    entraNoDePara: false,
  },
  {
    nome: "MP_CLICKUP_STATUS_PARA_PAGAR",
    tenant: "marcos-paulo",
    tipo: "status",
    uso: "tenants/marcos-paulo/payment-automation-service.ts — nome do Status 'pronto para pagar'",
    valorConhecido: "para pagar",
    entraNoDePara: false,
  },
  {
    nome: "MP_CLICKUP_STATUS_REPROVADO",
    tenant: "marcos-paulo",
    tipo: "status",
    uso: "tenants/marcos-paulo/config.ts — nome do Status de reprovação",
    valorConhecido: "não aprovado",
    entraNoDePara: false,
  },
  {
    nome: "MP_CLICKUP_TEAM_ID",
    tenant: "marcos-paulo",
    tipo: "id-de-team",
    uso: "tenants/marcos-paulo/config.ts — id do Team no ClickUp (compartilhado com Family Office)",
    valorConhecido: "9011658148",
    entraNoDePara: false,
  },

  // --- Family Office (FO_) — 13 ---
  {
    nome: "FO_CLICKUP_CONTAS_A_PAGAR_ID",
    tenant: "family-office",
    tipo: "id-de-usuario",
    uso: "tenants/family-office/config.ts (contasAPagarUserId) — mesmo Financeiro (Maryane) dos outros tenants",
    clickupUserId: "81581816",
    entraNoDePara: true,
  },
  {
    nome: "FO_CLICKUP_LIST_CONTAS_PAGAR_ID",
    tenant: "family-office",
    tipo: "id-de-lista",
    uso: "tenants/family-office/config.ts — id da Lista 'Contas a pagar' compartilhada com Marcos Paulo",
    valorConhecido: "901111928443",
    entraNoDePara: false,
  },
  {
    nome: "FO_CLICKUP_LIST_CONTAS_RECEBER_ID",
    tenant: "family-office",
    tipo: "id-de-lista",
    uso: "tenants/family-office/config.ts — id da Lista 'Contas a receber' do Family Office",
    valorConhecido: "901109642267",
    entraNoDePara: false,
  },
  {
    nome: "FO_CLICKUP_LIST_SOLICITACAO_ID",
    tenant: "family-office",
    tipo: "id-de-lista",
    uso: "tenants/family-office/config.ts — id da Lista de Solicitação de pagamento do Family Office",
    valorConhecido: "901109642259",
    entraNoDePara: false,
  },
  {
    nome: "FO_CLICKUP_REVIEWER_IDS",
    tenant: "family-office",
    tipo: "ids-de-usuario",
    uso: "tenants/family-office/config.ts — ids que podem revisar o RESUMO por Comentário neste tenant",
    clickupUserIds: ["81581816", "81581802"],
    entraNoDePara: true,
  },
  {
    nome: "FO_CLICKUP_REVIEWER_SECONDARY_ID",
    tenant: "family-office",
    tipo: "id-de-usuario",
    uso: "tenants/family-office/config.ts (reviewerSecondaryId) — revisor secundário do Family Office (item em aberto do de-para)",
    clickupUserId: "81581802",
    entraNoDePara: true,
  },
  {
    nome: "FO_CLICKUP_STATUS_APROVADO",
    tenant: "family-office",
    tipo: "status",
    uso: "tenants/family-office/config.ts — nome do Status pós-aprovação",
    valorConhecido: "aprovado",
    entraNoDePara: false,
  },
  {
    nome: "FO_CLICKUP_STATUS_EM_LANCAMENTO_OMIE",
    tenant: "family-office",
    tipo: "status",
    uso: "tenants/family-office/config.ts — nome do Status 'em lançamento no Omie'",
    valorConhecido: "em lançamento omie",
    entraNoDePara: false,
  },
  {
    nome: "FO_CLICKUP_STATUS_LANCADO_OMIE",
    tenant: "family-office",
    tipo: "status",
    uso: "tenants/family-office/config.ts — nome do Status pós-lançamento no Omie",
    valorConhecido: "lançado omie",
    entraNoDePara: false,
  },
  {
    nome: "FO_CLICKUP_STATUS_PARA_PAGAR",
    tenant: "family-office",
    tipo: "status",
    uso: "tenants/family-office/payment-automation-service.ts — nome do Status 'pronto para pagar'",
    valorConhecido: "para pagar",
    entraNoDePara: false,
  },
  {
    nome: "FO_CLICKUP_STATUS_REPROVADO",
    tenant: "family-office",
    tipo: "status",
    uso: "tenants/family-office/config.ts — nome do Status de reprovação (default diferente dos outros tenants: 'reprovado', não 'não aprovado')",
    valorConhecido: "reprovado",
    entraNoDePara: false,
  },
  {
    nome: "FO_CLICKUP_STATUS_REVISAO",
    tenant: "family-office",
    tipo: "status",
    uso: "tenants/family-office/config.ts — nome do Status 'em revisão', específico deste tenant (OQ-CMP-02 do plano da Fase 0)",
    valorConhecido: "em revisão",
    entraNoDePara: false,
  },
  {
    nome: "FO_CLICKUP_TEAM_ID",
    tenant: "family-office",
    tipo: "id-de-team",
    uso: "tenants/family-office/config.ts — id do Team no ClickUp (compartilhado com Marcos Paulo)",
    valorConhecido: "9011658148",
    entraNoDePara: false,
  },
];
