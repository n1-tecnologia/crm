/**
 * A FORMA dos `args` das operações de
 * `packages/dominio/src/operations/ferramentas/grupos.ts` — 22 operações.
 * `receberPedidoDeEntrada`, `registrarEntradaNoGrupo` e
 * `registrarSaidaDoGrupo` não entram em `OPERACOES` (Eventos do provedor,
 * sem `actingMemberId`) e por isso não têm schema aqui — nem
 * `conversaDoGrupoOuCriar` (2º parâmetro é `ActorRef`, não um Membro
 * chamando por si). Ver `../esquemas/CONTEXT.md` para a regra da pasta e
 * `./fragmentos.ts` para o porquê da validação ser de transporte, não de
 * regra de negócio.
 */

import { ACTOR_REF, ID, opcional, type Esquemas } from "./fragmentos";
import { z } from "zod";

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

const CRIAR_GRUPO_INPUT = z
  .object({
    nome: z.string(),
    descricao: z.string().optional(),
    canalId: ID,
    configuracoes: CONFIGURACOES_DO_GRUPO.optional(),
    participantesIniciaisContactIds: z.array(ID).optional(),
    administradoresContactIds: z.array(ID).optional(),
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
  criarGrupo: z.tuple([CRIAR_GRUPO_INPUT]),
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
