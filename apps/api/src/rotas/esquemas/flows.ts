/**
 * A FORMA dos `args` das operações de
 * `packages/dominio/src/operations/ferramentas/flows.ts` — 26 operações.
 * `validarVersaoDoFlow` não entra em `OPERACOES` (o 2º parâmetro é
 * `flowId`, não `actingMemberId`: é leitura) nem `receberRespostaDeFlow`
 * (Evento do provedor, sem `actingMemberId`) — nenhum dos dois tem schema
 * aqui. Ver `../esquemas/CONTEXT.md` para a regra da pasta e
 * `./fragmentos.ts` para o porquê da validação ser de transporte, não de
 * regra de negócio.
 */

import type {
  CategoriaDeFlow,
  OperadorDeCondicao,
  TipoDeAcao,
  TipoDeComponente,
  TipoDeDadoDeTela,
  TipoDeEntradaDeTexto,
} from "@n1/dominio";
import { ACTOR_REF, ID, opcional, type Confere, type Esquemas, type Igual } from "./fragmentos";
import { z } from "zod";

const CATEGORIA_DE_FLOW = z.enum(["formularioDeCadastro", "agendamento", "pesquisa", "outro"]);

const TIPO_DE_COMPONENTE = z.enum([
  "titulo",
  "subtitulo",
  "paragrafo",
  "legenda",
  "textoRico",
  "imagem",
  "carrosselDeImagens",
  "campoDeTexto",
  "areaDeTexto",
  "escolhaUnica",
  "multiplaEscolha",
  "menuSuspenso",
  "chips",
  "consentimento",
  "seletorDeData",
  "calendario",
  "coletaDeFotos",
  "listaDeNavegacao",
  "formulario",
  "condicional",
  "linkIncorporado",
  "rodape",
]);

const TIPO_DE_ACAO = z.enum(["navegar", "concluir", "trocaDeDados", "abrirEndereco", "atualizarDados"]);

const OPERADOR_DE_CONDICAO = z.enum(["igual", "diferente", "contem", "naoContem", "maior", "menor", "preenchido"]);

const TIPO_DE_ENTRADA_DE_TEXTO = z.enum(["texto", "numero", "email", "senha", "codigo", "telefone"]);

const TIPO_DE_DADO_DE_TELA = z.enum(["texto", "numero", "booleano", "lista"]);

const ACAO_DE_COMPONENTE = z
  .object({
    tipo: TIPO_DE_ACAO,
    telaDeDestino: z.string().optional(),
    cargaUtil: z.record(z.string(), z.string()).optional(),
    endereco: z.string().optional(),
  })
  .strict();

const OPCAO_DE_COMPONENTE = z
  .object({
    id: z.string(),
    titulo: z.string(),
    descricao: z.string().optional(),
    imagemFileId: ID.optional(),
    habilitada: z.boolean().optional(),
    acao: ACAO_DE_COMPONENTE.optional(),
  })
  .strict();

const CONDICAO_DE_COMPONENTE = z
  .object({
    variavel: z.string().optional(),
    operador: OPERADOR_DE_CONDICAO.optional(),
    valor: z.string().optional(),
    expressao: z.string().optional(),
  })
  .strict();

// `Partial<PropriedadesDeComponente>` (EditarComponenteInput.propriedades) é
// o mesmo shape: toda a interface já nasce com campos opcionais.
const PROPRIEDADES_DE_COMPONENTE = z
  .object({
    texto: z.string().optional(),
    rotulo: z.string().optional(),
    obrigatorio: z.boolean().optional(),
    opcoes: z.array(OPCAO_DE_COMPONENTE).optional(),
    minimo: z.number().optional(),
    maximo: z.number().optional(),
    padrao: z.string().optional(),
    textoDeAjuda: z.string().optional(),
    valorInicial: z.string().optional(),
    mensagemDeErro: z.string().optional(),
    habilitado: z.union([z.boolean(), z.string()]).optional(),
    visivel: z.union([z.boolean(), z.string()]).optional(),
    tipoDeEntrada: TIPO_DE_ENTRADA_DE_TEXTO.optional(),
    peso: z.enum(["normal", "negrito", "italico"]).optional(),
    tachado: z.boolean().optional(),
    markdown: z.boolean().optional(),
    imagemFileId: ID.optional(),
    imagensFileIds: z.array(ID).optional(),
    textoAlternativo: z.string().optional(),
    proporcao: z.string().optional(),
    modo: z.enum(["unico", "intervalo"]).optional(),
    origemDaFoto: z.enum(["cameraEGaleria", "galeria", "camera"]).optional(),
    legendasDoRodape: z.object({ esquerda: z.string().optional(), centro: z.string().optional(), direita: z.string().optional() }).strict().optional(),
  })
  .strict();

const DADO_DE_TELA = z
  .object({
    nome: z.string(),
    tipo: TIPO_DE_DADO_DE_TELA,
    exemplo: z.string().optional(),
  })
  .strict();

const CRIAR_FLOW_INPUT = z
  .object({
    nome: z.string(),
    descricao: z.string().optional(),
    categoria: CATEGORIA_DE_FLOW,
    canalId: ID.optional(),
  })
  .strict();

const EDITAR_FLOW_INPUT = z
  .object({
    nome: z.string().optional(),
    descricao: z.string().optional(),
    categoria: CATEGORIA_DE_FLOW.optional(),
    canalId: ID.nullable().optional(),
  })
  .strict();

const ADICIONAR_TELA_INPUT = z
  .object({
    identificador: z.string(),
    titulo: z.string(),
    terminal: z.boolean().optional(),
  })
  .strict();

const EDITAR_TELA_INPUT = z
  .object({
    identificador: z.string().optional(),
    titulo: z.string().optional(),
    terminal: z.boolean().optional(),
    dados: z.array(DADO_DE_TELA).optional(),
  })
  .strict();

const ADICIONAR_COMPONENTE_INPUT = z
  .object({
    tipo: TIPO_DE_COMPONENTE,
    paiId: ID.optional(),
  })
  .strict();

const EDITAR_COMPONENTE_INPUT = z
  .object({
    nome: z.string().optional(),
    propriedades: PROPRIEDADES_DE_COMPONENTE.optional(),
    acao: ACAO_DE_COMPONENTE.nullable().optional(),
    condicao: CONDICAO_DE_COMPONENTE.nullable().optional(),
  })
  .strict();

// `MoverComponenteInput` é a união de duas formas, nunca as duas juntas —
// mover entre irmãos (`direcao`) ou mudar de contêiner (`paraDentroDe`).
const MOVER_COMPONENTE_INPUT = z.union([
  z.object({ direcao: z.enum(["subir", "descer"]) }).strict(),
  z.object({ paraDentroDe: ID.nullable() }).strict(),
]);

const PUBLICAR_VERSAO_INPUT = z.object({ notas: z.string().optional() }).strict();

const ENVIAR_FLOW_INPUT = z
  .object({
    flowId: ID,
    conversationId: ID,
    corpo: z.string(),
    rotuloDoBotao: z.string().optional(),
    cabecalho: z.string().optional(),
    rodape: z.string().optional(),
    telaInicial: z.string().optional(),
    dadosIniciais: z.record(z.string(), z.string()).optional(),
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
export const FLOWS = {
  criarFlow: z.tuple([CRIAR_FLOW_INPUT]),
  editarFlow: z.tuple([ID, EDITAR_FLOW_INPUT]),
  definirPontoDeTrocaDeDados: z.tuple([ID, z.string()]),
  regenerarChavesDoPonto: z.tuple([ID]),
  removerPontoDeTrocaDeDados: z.tuple([ID]),
  adicionarTela: z.tuple([ID, ADICIONAR_TELA_INPUT]),
  editarTela: z.tuple([ID, ID, EDITAR_TELA_INPUT]),
  reordenarTela: z.tuple([ID, ID, z.enum(["subir", "descer"])]),
  duplicarTela: z.tuple([ID, ID]),
  removerTela: z.tuple([ID, ID]),
  adicionarComponente: z.tuple([ID, ID, ADICIONAR_COMPONENTE_INPUT]),
  editarComponente: z.tuple([ID, ID, ID, EDITAR_COMPONENTE_INPUT]),
  moverComponente: z.tuple([ID, ID, ID, MOVER_COMPONENTE_INPUT]),
  duplicarComponente: z.tuple([ID, ID, ID]),
  removerComponente: z.tuple([ID, ID, ID]),
  // `input: {...} = {}` — parâmetro posicional opcional no fim.
  publicarVersao: z.tuple([ID, opcional(PUBLICAR_VERSAO_INPUT)]),
  despublicarFlow: z.tuple([ID]),
  descartarRascunho: z.tuple([ID]),
  criarRascunhoAPartirDe: z.tuple([ID, ID]),
  copiarFlow: z.tuple([ID]),
  arquivarFlow: z.tuple([ID]),
  restaurarFlow: z.tuple([ID]),
  enviarFlowALixeira: z.tuple([ID]),
  restaurarFlowDaLixeira: z.tuple([ID]),
  sincronizarFlow: z.tuple([ID]),
  enviarFlow: z.tuple([ENVIAR_FLOW_INPUT]),
} satisfies Esquemas;

// ── Portão de enum bidirecional — falta ou sobra de membro não compila ──

type _EnumsCompletos = Confere<
  [
    Igual<z.infer<typeof CATEGORIA_DE_FLOW>, CategoriaDeFlow>,
    Igual<z.infer<typeof TIPO_DE_COMPONENTE>, TipoDeComponente>,
    Igual<z.infer<typeof TIPO_DE_ACAO>, TipoDeAcao>,
    Igual<z.infer<typeof OPERADOR_DE_CONDICAO>, OperadorDeCondicao>,
    Igual<z.infer<typeof TIPO_DE_ENTRADA_DE_TEXTO>, TipoDeEntradaDeTexto>,
    Igual<z.infer<typeof TIPO_DE_DADO_DE_TELA>, TipoDeDadoDeTela>,
  ]
>;
