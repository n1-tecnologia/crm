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

import type { CrmDasFerramentas } from "@n1/dominio";
import { ACTOR_REF, ID, opcional, type Esquemas } from "./fragmentos";
import { z } from "zod";

/**
 * O `crm` que o navegador manda como ÚLTIMO argumento das operações de
 * Ferramentas (Grupo, Comunidade, Flow), só para a execução local: o servidor o
 * DESCARTA e troca a posição pelo que leu de `plataforma.canais` e
 * `plataforma.contatos` (`gesto-no-crm/ferramentas.ts`, T-15-20). Aqui só a
 * forma de transporte, com tetos; o tipo de saída declarado é o do domínio
 * apenas para o esquema satisfazer a assinatura da operação (`Esquemas`) — o
 * valor que sai daqui nunca chega ao domínio.
 */
export const CRM_DO_NAVEGADOR = z
  .object({
    canais: z.array(z.object({ id: ID }).passthrough()).max(200),
    contatos: z.array(z.object({ id: ID }).passthrough()).max(200),
    contatosACriar: z.array(z.object({ id: ID }).passthrough()).max(200).optional(),
  })
  .passthrough() as unknown as z.ZodType<CrmDasFerramentas>;

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
  importarGruposDoCanal: z.tuple([ID]),
  sincronizarGrupo: z.tuple([ID]),
  editarGrupo: z.tuple([ID, EDITAR_GRUPO_INPUT]),
  definirCanalDoGrupo: z.tuple([ID, ID]),
  // Partial<Captacao> é posicional obrigatório (sem `?`), mas todos os seus
  // campos são opcionais — o mesmo schema de CRIAR_GRUPO_INPUT.captacao.
  editarCaptacaoDoGrupo: z.tuple([ID, CAPTACAO]),
  ativarCaptacao: z.tuple([ID]),
  inativarCaptacao: z.tuple([ID]),
  zerarCliques: z.tuple([ID]),
  regenerarLinkDeConvite: z.tuple([ID]),
  enviarLinkDeConvite: z.tuple([ID, z.array(ID)]),
  adicionarParticipantes: z.tuple([ID, ADICIONAR_PARTICIPANTES_INPUT]),
  removerParticipante: z.tuple([ID, ID]),
  promoverParticipante: z.tuple([ID, ID]),
  rebaixarParticipante: z.tuple([ID, ID]),
  // `input: {...} = {}` — parâmetro posicional opcional no fim.
  sairDoGrupo: z.tuple([ID, opcional(SAIR_INPUT)]),
  arquivarGrupo: z.tuple([ID]),
  restaurarGrupo: z.tuple([ID]),
  enviarGrupoALixeira: z.tuple([ID]),
  restaurarGrupoDaLixeira: z.tuple([ID]),
  aprovarPedidoDeEntrada: z.tuple([ID, ID]),
  recusarPedidoDeEntrada: z.tuple([ID, ID, opcional(ID)]),
  enviarMensagemAoGrupo: z.tuple([ID, ENVIAR_MENSAGEM_AO_GRUPO_INPUT]),
} satisfies Esquemas;
