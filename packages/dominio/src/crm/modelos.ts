/**
 * A Mensagem de modelo do WhatsApp oficial (Sessão 7, 7.3): o texto aprovado pela Meta que a empresa pode mandar fora da
 * janela de 24 h e antes da primeira mensagem do Contato (RN-CXE-19, `validarEnvio`). O modelo é CRIADO e APROVADO na Meta;
 * o CRM o sincroniza (`plataforma.modelos_de_mensagem`, migração 016) e escolhe um para enviar.
 *
 * `componentes` é o que a Meta devolve (`HEADER`, `BODY`, `FOOTER`, `BUTTONS`), sem tradução: guardar o formato dela evita
 * perder campo que ainda não usamos. As regras daqui são puras e leem só esse formato:
 *
 *   - as variáveis do corpo são `{{1}}`, `{{2}}`… (a Meta as exige em sequência); `quantidadeDeVariaveis` é a maior delas;
 *   - só se ENVIA o que o CRM sabe preencher: corpo com variáveis de texto, cabeçalho de texto SEM variável, rodapé e
 *     botões fixos. Cabeçalho de imagem, vídeo ou documento, variável no cabeçalho ou num botão de link, código de
 *     autenticação e os formatos novos (carrossel, oferta por tempo) ficam listados mas não enviáveis
 *     (`motivoDeNaoEnviavel`), para a tela dizer por quê em vez de a Meta recusar depois;
 *   - o valor de uma variável não leva quebra de linha nem tabulação (a Meta recusa) e vai até `MAX_DA_VARIAVEL`.
 *
 * Domínio puro: sem rede, sem banco. Quem fala com a Meta é `apps/api` (`mensageria/provedores/whatsapp-cloud/`).
 */

import { fail, ok, type OperationResult } from "../state";

export const CATEGORIAS_DE_MODELO = ["utilidade", "marketing", "autenticacao"] as const;
export type CategoriaDeModelo = (typeof CATEGORIAS_DE_MODELO)[number];

export const ESTADOS_DE_MODELO = ["aprovado", "pendente", "rejeitado", "pausado", "desativado"] as const;
export type EstadoDeModelo = (typeof ESTADOS_DE_MODELO)[number];

/** Um botão como a Meta o descreve; só `type` e `text` são lidos, o resto passa intacto. */
export interface BotaoDeModelo {
  readonly type: string;
  readonly text?: string;
  readonly url?: string;
  readonly phone_number?: string;
}

/** Um componente como a Meta o devolve (`type` em maiúsculas: `HEADER`, `BODY`, `FOOTER`, `BUTTONS`). */
export interface ComponenteDeModelo {
  readonly type: string;
  readonly format?: string;
  readonly text?: string;
  readonly buttons?: readonly BotaoDeModelo[];
}

export interface ModeloDeMensagem {
  readonly id: string;
  readonly canalId: string;
  /** O id do modelo na Meta; vai em `modelo_usado` da Mensagem. */
  readonly idNoProvedor: string;
  /** O nome do modelo na Meta (`boas_vindas`): é por ele e pelo idioma que a Cloud API envia. */
  readonly nome: string;
  /** O código de idioma da Meta (`pt_BR`). */
  readonly idioma: string;
  readonly categoria: CategoriaDeModelo;
  readonly estado: EstadoDeModelo;
  /** O motivo da rejeição que a Meta deu, só quando `estado` é `rejeitado`. */
  readonly motivoDeRejeicao: string | null;
  readonly componentes: readonly ComponenteDeModelo[];
  readonly quantidadeDeVariaveis: number;
  /** ISO 8601: quando a lista deste Canal foi lida da Meta pela última vez. */
  readonly sincronizadoEm: string;
}

/** A Meta aceita até 1024 caracteres no corpo do modelo; o valor de uma variável cabe dentro disso. */
export const MAX_DA_VARIAVEL = 1024;

const VARIAVEL = /\{\{\s*(\d+)\s*\}\}/g;

const doTipo = (componentes: readonly ComponenteDeModelo[], tipo: string) =>
  componentes.find((c) => c.type.toUpperCase() === tipo);

/** Os números das variáveis de um texto (`{{1}}`, `{{2}}`), sem repetir, em ordem crescente. */
export function variaveisDoTexto(texto: string): readonly number[] {
  const achadas = new Set<number>();
  for (const m of texto.matchAll(VARIAVEL)) achadas.add(Number(m[1]));
  return [...achadas].sort((a, b) => a - b);
}

/** O corpo do modelo, ou `""` se a Meta não mandou um. */
export function corpoDoModelo(componentes: readonly ComponenteDeModelo[]): string {
  return doTipo(componentes, "BODY")?.text ?? "";
}

/** Quantas variáveis o corpo pede: a maior delas (a Meta as exige em sequência, de `{{1}}` até `{{n}}`). */
export function quantidadeDeVariaveis(componentes: readonly ComponenteDeModelo[]): number {
  const numeros = variaveisDoTexto(corpoDoModelo(componentes));
  return numeros.length === 0 ? 0 : numeros[numeros.length - 1]!;
}

const COMPONENTES_CONHECIDOS: ReadonlySet<string> = new Set(["HEADER", "BODY", "FOOTER", "BUTTONS"]);
const BOTOES_FIXOS: ReadonlySet<string> = new Set(["QUICK_REPLY", "PHONE_NUMBER", "URL"]);

/**
 * Por que o CRM ainda não sabe enviar este modelo, em português de produto, ou `undefined` se sabe. Cada recusa é um
 * pedaço que o envio não preenche hoje; nenhum esconde o modelo da lista.
 */
export function motivoDeNaoEnviavel(modelo: Pick<ModeloDeMensagem, "categoria" | "componentes">): string | undefined {
  if (modelo.categoria === "autenticacao") return "Modelo de autenticação (código de uso único): o CRM ainda não o envia.";
  if (!doTipo(modelo.componentes, "BODY")) return "Modelo sem corpo.";
  for (const componente of modelo.componentes) {
    const tipo = componente.type.toUpperCase();
    if (!COMPONENTES_CONHECIDOS.has(tipo)) return "Este formato de modelo (carrossel, oferta por tempo…) o CRM ainda não envia.";
    if (tipo === "HEADER") {
      if ((componente.format ?? "TEXT").toUpperCase() !== "TEXT") return "Modelo com cabeçalho de imagem, vídeo ou documento: o CRM ainda não envia a mídia do cabeçalho.";
      if (variaveisDoTexto(componente.text ?? "").length > 0) return "Modelo com variável no cabeçalho: o CRM só preenche as variáveis do corpo.";
    }
    if (tipo === "BUTTONS") {
      for (const botao of componente.buttons ?? []) {
        if (!BOTOES_FIXOS.has(botao.type.toUpperCase())) return "Modelo com botão de código, catálogo ou Flow: o CRM ainda não envia.";
        if (variaveisDoTexto(botao.url ?? "").length > 0) return "Modelo com variável no endereço de um botão: o CRM só preenche as variáveis do corpo.";
      }
    }
  }
  return undefined;
}

/** Aprovado pela Meta E um tipo que o CRM sabe preencher: é o que a Caixa de Entrada oferece para enviar. */
export function modeloEnviavel(modelo: Pick<ModeloDeMensagem, "estado" | "categoria" | "componentes">): boolean {
  return modelo.estado === "aprovado" && motivoDeNaoEnviavel(modelo) === undefined;
}

/**
 * Os valores que a pessoa preencheu: na quantidade certa, nenhum vazio, sem quebra de linha nem tabulação (a Meta recusa o
 * valor com elas) e dentro de `MAX_DA_VARIAVEL`. Devolve os valores aparados.
 */
export function validarVariaveis(
  modelo: Pick<ModeloDeMensagem, "nome" | "quantidadeDeVariaveis">,
  valores: readonly string[],
): OperationResult<readonly string[]> {
  const esperadas = modelo.quantidadeDeVariaveis;
  if (valores.length !== esperadas) {
    return fail(
      esperadas === 0
        ? `O modelo “${modelo.nome}” não tem variáveis para preencher.`
        : `O modelo “${modelo.nome}” pede ${esperadas} ${esperadas === 1 ? "variável" : "variáveis"}, e vieram ${valores.length}.`,
      "variaveis",
    );
  }
  const aparados: string[] = [];
  for (const [i, valor] of valores.entries()) {
    const limpo = valor.trim();
    if (limpo === "") return fail(`Preencha a variável {{${i + 1}}} do modelo.`, "variaveis");
    if (/[\n\r\t]/.test(limpo)) return fail(`A variável {{${i + 1}}} não pode ter quebra de linha nem tabulação.`, "variaveis");
    if (limpo.length > MAX_DA_VARIAVEL) return fail(`A variável {{${i + 1}}} vai até ${MAX_DA_VARIAVEL} caracteres.`, "variaveis");
    aparados.push(limpo);
  }
  return ok(aparados);
}

/** Troca `{{n}}` pelo valor de índice `n - 1`; uma variável sem valor fica como está (a validação vem antes). */
function preencher(texto: string, valores: readonly string[]): string {
  return texto.replace(VARIAVEL, (achado, n: string) => valores[Number(n) - 1] ?? achado);
}

/**
 * O texto que o Contato recebe, para o fio mostrar: o cabeçalho de texto, o corpo com as variáveis preenchidas e o rodapé,
 * separados por uma linha em branco. Os botões não entram (o fio não os mostra). Quem grava a Mensagem usa isto como
 * `conteudo`: o atendente lê o que foi mandado, não `{{1}}`.
 */
export function textoDoModelo(modelo: Pick<ModeloDeMensagem, "componentes">, valores: readonly string[]): string {
  const partes = [doTipo(modelo.componentes, "HEADER")?.text, corpoDoModelo(modelo.componentes), doTipo(modelo.componentes, "FOOTER")?.text]
    .filter((p): p is string => typeof p === "string" && p.trim() !== "")
    .map((p) => preencher(p, valores));
  return partes.join("\n\n");
}

/**
 * O modelo como a lista da tela o recebe: ele mesmo mais o que o CRM decide sobre ele (a regra é do domínio, e a tela não
 * a refaz). `enviavel` é o que a Caixa oferece; `motivoDeNaoEnviavel` explica por que um modelo aprovado ainda não sai.
 */
export interface ModeloNaLista extends ModeloDeMensagem {
  readonly enviavel: boolean;
  /** Preenchido só quando o modelo é APROVADO e mesmo assim não sai (cabeçalho de mídia…); nos outros estados o estado já explica. */
  readonly motivoDeNaoEnviavel: string | null;
}

export function modeloNaLista(modelo: ModeloDeMensagem): ModeloNaLista {
  return {
    ...modelo,
    enviavel: modeloEnviavel(modelo),
    motivoDeNaoEnviavel: modelo.estado === "aprovado" ? (motivoDeNaoEnviavel(modelo) ?? null) : null,
  };
}
