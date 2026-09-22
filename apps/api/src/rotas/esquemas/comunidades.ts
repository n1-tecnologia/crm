/**
 * A FORMA dos `args` das operações de
 * `packages/dominio/src/operations/ferramentas/comunidades.ts` — 12
 * operações. Ver `../esquemas/CONTEXT.md` para a regra da pasta e
 * `./fragmentos.ts` para o porquê da validação ser de transporte, não de
 * regra de negócio.
 */

import { ID, opcional, type Esquemas } from "./fragmentos";
import { z } from "zod";

const CONFIGURACOES_DA_COMUNIDADE = z
  .object({
    somenteAdministradoresAdicionamGrupos: z.boolean().optional(),
    somenteAdministradoresAdicionamParticipantes: z.boolean().optional(),
  })
  .strict();

const CRIAR_COMUNIDADE_INPUT = z
  .object({
    nome: z.string(),
    descricao: z.string().optional(),
    canalId: ID,
    configuracoes: CONFIGURACOES_DA_COMUNIDADE.optional(),
  })
  .strict();

const EDITAR_COMUNIDADE_INPUT = z
  .object({
    nome: z.string().optional(),
    descricao: z.string().optional(),
  })
  .strict();

const ENVIAR_MENSAGEM_INPUT = z
  .object({
    content: z.string(),
    templateProviderId: z.string().optional(),
  })
  .strict();

const SAIR_INPUT = z.object({ entendiIrreversivel: z.boolean().optional() }).strict();

/**
 * `satisfies` (sobre o tipo `Esquemas` de `./fragmentos`) é o portão de
 * drift: uma entrada cuja aridade ou tipo não bata com `ArgumentosDe<N>` não
 * compila. Se uma entrada não compilar, o erro está na entrada — não relaxar
 * para `z.ZodTypeAny`.
 */
export const COMUNIDADES = {
  criarComunidade: z.tuple([CRIAR_COMUNIDADE_INPUT]),
  sincronizarComunidade: z.tuple([ID]),
  editarComunidade: z.tuple([ID, EDITAR_COMUNIDADE_INPUT]),
  // Partial<ConfiguracoesDaComunidade> é posicional obrigatório (sem `?`),
  // mas todos os seus campos são opcionais — o mesmo schema de dentro de
  // CRIAR_COMUNIDADE_INPUT.configuracoes, aqui não-`.optional()` na tupla.
  alterarConfiguracoesDaComunidade: z.tuple([ID, CONFIGURACOES_DA_COMUNIDADE]),
  vincularGrupoAComunidade: z.tuple([ID, ID]),
  desvincularGrupoDaComunidade: z.tuple([ID, ID]),
  enviarMensagemAComunidade: z.tuple([ID, ENVIAR_MENSAGEM_INPUT]),
  // `input: {...} = {}` — parâmetro posicional opcional no fim.
  sairDaComunidade: z.tuple([ID, opcional(SAIR_INPUT)]),
  arquivarComunidade: z.tuple([ID]),
  restaurarComunidade: z.tuple([ID]),
  enviarComunidadeALixeira: z.tuple([ID]),
  restaurarComunidadeDaLixeira: z.tuple([ID]),
} satisfies Esquemas;
