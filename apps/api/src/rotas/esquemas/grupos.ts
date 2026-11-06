/**
 * A FORMA dos `args` das operações de
 * `packages/dominio/src/operations/ferramentas/grupos.ts` — 23 operações.
 * `receberPedidoDeEntrada`, `registrarEntradaNoGrupo` e
 * `registrarSaidaDoGrupo` não entram em `OPERACOES` (Eventos do provedor,
 * sem `actingMemberId`) e por isso não têm schema aqui — nem
 * `conversaDoGrupoOuCriar` (2º parâmetro é `ActorRef`, não um Membro
 * chamando por si). Ver `../esquemas/CONTEXT.md` para a regra da pasta e
 * `./fragmentos.ts` para o porquê da validação ser de transporte, não de
 * regra de negócio.
 */

import { ACTOR_REF, CRM_DO_NAVEGADOR, ID, opcional, type Esquemas } from "./fragmentos";
import { z } from "zod";

/** Re-exportado aqui por ser o `crm` do módulo de Grupos; o fragmento vive em `fragmentos.ts` (usado também por Comunidades e Flows). */
export { CRM_DO_NAVEGADOR } from "./fragmentos";

const CONFIGURACOES_DO_GRUPO = z
  .object({
    somenteAdministradoresEnviam: z.boolean().optional(),
    somenteAdministradoresEditamDados: z.boolean().optional(),
    administradoresAprovamEntrada: z.boolean().optional(),
    somenteAdministradoresAdicionamParticipantes: z.boolean().optional(),
  })
  .strict();

const CAPTACAO = z
  .object({
    estado: z.enum(["ativa", "inativa"]).optional(),
    limiteDeCliques: z.number().optional(),
    tetoDeCaptacao: z.number().optional(),
    cliquesZeradosEm: z.string().optional(),
  })
  .strict();

/** A foto ou a capa, já recortada e reduzida na tela (`ImagemDoGrupo`, data URL). */
const IMAGEM_DO_GRUPO = z
  .object({
    nome: z.string(),
    url: z.string(),
    tamanhoBytes: z.number(),
  })
  .strict();

const CRIAR_GRUPO_INPUT = z
  .object({
    nome: z.string(),
    descricao: z.string().optional(),
    canalId: ID,
    configuracoes: CONFIGURACOES_DO_GRUPO.optional(),
    participantesIniciaisContactIds: z.array(ID).optional(),
    administradoresContactIds: z.array(ID).optional(),
    contatoCriadorId: ID.optional(),
    foto: IMAGEM_DO_GRUPO.optional(),
    capa: IMAGEM_DO_GRUPO.optional(),
    comunidadeId: ID.optional(),
    captacao: CAPTACAO.optional(),
  })
  .strict();

const EDITAR_GRUPO_INPUT = z
  .object({
    nome: z.string().optional(),
    descricao: z.string().optional(),
    configuracoes: CONFIGURACOES_DO_GRUPO.optional(),
  })
  .strict();

const ADICIONAR_PARTICIPANTES_INPUT = z
  .object({
    contactIds: z.array(ID),
    comoAdministrador: z.boolean().optional(),
  })
  .strict();

const SAIR_INPUT = z.object({ entendiIrreversivel: z.boolean().optional() }).strict();

const ENVIAR_MENSAGEM_AO_GRUPO_INPUT = z
  .object({
    content: z.string(),
    templateProviderId: z.string().optional(),
    actor: ACTOR_REF.optional(),
    delegate: ACTOR_REF.optional(),
  })
  .strict();

/**
 * `satisfies` (sobre o tipo `Esquemas` de `./fragmentos`) é o portão de
 * drift: uma entrada cuja aridade ou tipo não bata com `ArgumentosDe<N>` não
 * compila. Se uma entrada não compilar, o erro está na entrada — não relaxar
 * para `z.ZodTypeAny`.
 */
export const GRUPOS = {
  criarGrupo: z.tuple([CRIAR_GRUPO_INPUT, opcional(CRM_DO_NAVEGADOR)]),
  importarGruposDoCanal: z.tuple([ID, opcional(CRM_DO_NAVEGADOR)]),
  sincronizarGrupo: z.tuple([ID, opcional(CRM_DO_NAVEGADOR)]),
  editarGrupo: z.tuple([ID, EDITAR_GRUPO_INPUT, opcional(CRM_DO_NAVEGADOR)]),
  definirCanalDoGrupo: z.tuple([ID, ID, opcional(CRM_DO_NAVEGADOR)]),
  // Partial<Captacao> é posicional obrigatório (sem `?`), mas todos os seus
  // campos são opcionais — o mesmo schema de CRIAR_GRUPO_INPUT.captacao.
  editarCaptacaoDoGrupo: z.tuple([ID, CAPTACAO]),
  ativarCaptacao: z.tuple([ID]),
  inativarCaptacao: z.tuple([ID]),
  zerarCliques: z.tuple([ID]),
  regenerarLinkDeConvite: z.tuple([ID, opcional(CRM_DO_NAVEGADOR)]),
  enviarLinkDeConvite: z.tuple([ID, z.array(ID), opcional(CRM_DO_NAVEGADOR)]),
  adicionarParticipantes: z.tuple([ID, ADICIONAR_PARTICIPANTES_INPUT, opcional(CRM_DO_NAVEGADOR)]),
  removerParticipante: z.tuple([ID, ID, opcional(CRM_DO_NAVEGADOR)]),
  promoverParticipante: z.tuple([ID, ID, opcional(CRM_DO_NAVEGADOR)]),
  rebaixarParticipante: z.tuple([ID, ID, opcional(CRM_DO_NAVEGADOR)]),
  // `input: {...} = {}` — parâmetro posicional opcional no fim.
  sairDoGrupo: z.tuple([ID, opcional(SAIR_INPUT), opcional(CRM_DO_NAVEGADOR)]),
  arquivarGrupo: z.tuple([ID]),
  restaurarGrupo: z.tuple([ID]),
  enviarGrupoALixeira: z.tuple([ID]),
  restaurarGrupoDaLixeira: z.tuple([ID]),
  aprovarPedidoDeEntrada: z.tuple([ID, ID, opcional(CRM_DO_NAVEGADOR)]),
  recusarPedidoDeEntrada: z.tuple([ID, ID, opcional(ID), opcional(CRM_DO_NAVEGADOR)]),
  enviarMensagemAoGrupo: z.tuple([ID, ENVIAR_MENSAGEM_AO_GRUPO_INPUT, opcional(CRM_DO_NAVEGADOR)]),
} satisfies Esquemas;
