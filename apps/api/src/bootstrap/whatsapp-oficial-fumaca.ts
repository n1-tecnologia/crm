/**
 * `npm run whatsapp-oficial:fumaca -w @n1/api` — a fumaça do WhatsApp oficial REAL (Sessão 7): confere, contra a Graph API de
 * verdade, o que o CRM lê da Meta, ANTES de alguém conectar um Canal ou mandar uma mensagem.
 *
 * Por que existe: o cliente e o tradutor da Sessão 7 foram escritos e testados contra um servidor falso, com os nomes de campo
 * da documentação da Cloud API. Nenhuma linha nunca falou com a Meta. Este comando é a prova do formato, no molde de
 * `evolution:fumaca`: usa o token de VERDADE, passa pelas leituras que o CRM faz e diz, em fatos curtos, se a Meta respondeu
 * como o código espera.
 *
 * Passos (cada um é independente: um que falha não pula os outros):
 *   1. o número (`GET /{phone-number-id}`): o `display_phone_number` aparece? o `verified_name`? é o número que se espera?
 *   2. os modelos (`GET /{waba-id}/message_templates`): quantos, em que estados e categorias, quais componentes a Meta devolve
 *      (e se algum o CRM não reconhece), e quantos o CRM sabe enviar;
 *   3. (só com `--inscrever`) inscrever o app na conta (`POST /{waba-id}/subscribed_apps`), o que faz os webhooks chegarem. É o
 *      único passo que ESCREVE na Meta, por isso não roda sozinho. É idempotente: inscrever de novo não muda nada.
 *
 * NÃO manda mensagem, NÃO baixa mídia, NÃO escreve no banco e NÃO conecta Canal nenhum.
 *
 * SEGURANÇA: a saída leva só passou/falhou e fatos ("12 modelos, 9 aprovados"). Nunca o token, o ID do número, o ID da conta, o
 * número de telefone inteiro (só o final) nem o texto de modelo algum. Um erro da Meta aparece só com o status HTTP e o código
 * numérico dela, nunca com a frase nem o corpo.
 */

import { modeloEnviavel } from "@n1/dominio/crm/modelos";
import { criarClienteDaCloudApi, ErroDaCloudApi, type ClienteDaCloudApi } from "../mensageria/provedores/whatsapp-cloud/cliente";
import { ENDERECO_DA_GRAPH, VERSAO_PADRAO, type ConfiguracaoDaCloudApi } from "../mensageria/provedores/whatsapp-cloud/configuracao";
import { traduzirModelo } from "../mensageria/provedores/whatsapp-cloud/modelos";

export interface PassoDaFumacaOficial {
  readonly nome: string;
  readonly ok: boolean;
  /** Um fato curto e sem segredo: "o número termina em 0001", "12 modelos, 9 aprovados". */
  readonly detalhe: string;
}

export interface ResultadoDaFumacaOficial {
  readonly versao: string;
  readonly passos: readonly PassoDaFumacaOficial[];
  readonly ok: boolean;
}

/** O que a fumaça lê do ambiente. O token e os IDs NUNCA vão à saída. */
export interface EntradaDaFumacaOficial {
  readonly token: string;
  readonly phoneNumberId: string;
  readonly wabaId: string;
  /** O número que se espera (opcional, com DDI): se vier, o passo 1 confere que a Meta devolveu o mesmo (só o final aparece). */
  readonly numeroEsperado?: string | undefined;
  /** Liga o único passo que escreve na Meta. */
  readonly inscrever?: boolean;
}

export interface DependenciasDaFumacaOficial {
  readonly entrada: EntradaDaFumacaOficial;
  /** Padrão: `criarClienteDaCloudApi` com a Graph de verdade; os testes apontam para o servidor falso. */
  readonly cliente: ClienteDaCloudApi;
  readonly versao: string;
}

/** Uma falha que a própria fumaça lança, com uma frase escrita aqui (sem corpo, token nem ID): aparece na saída como está. */
class FalhaDaFumaca extends Error {}

/** O que um erro diz sem vazar nada: o status HTTP e o código numérico da Meta, nunca a frase dela nem o corpo. */
function resumoDoErro(erro: unknown): string {
  if (erro instanceof FalhaDaFumaca) return erro.message;
  if (erro instanceof ErroDaCloudApi) {
    if (erro.transporte !== undefined) return `falha de transporte (${erro.transporte})`;
    const dica = erro.tokenInvalido ? " — token inválido, vencido ou sem acesso a este número" : "";
    return `a Meta respondeu HTTP ${erro.status}${erro.codigo !== undefined ? `, código ${erro.codigo}` : ""}${dica}`;
  }
  return "erro inesperado";
}

const soDigitos = (texto: string) => texto.replace(/\D/g, "");
const finalDe = (texto: string) => soDigitos(texto).slice(-4);

function contagens(valores: readonly string[]): string {
  const por = new Map<string, number>();
  for (const v of valores) por.set(v, (por.get(v) ?? 0) + 1);
  return [...por.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([k, n]) => `${k} ${n}`).join(", ") || "nenhum";
}

export async function rodarFumacaDoWhatsAppOficial(deps: DependenciasDaFumacaOficial): Promise<ResultadoDaFumacaOficial> {
  const { entrada, cliente } = deps;
  const passos: PassoDaFumacaOficial[] = [];
  const passo = (nome: string, ok: boolean, detalhe: string) => passos.push({ nome, ok, detalhe });

  async function tentar(nome: string, fazer: () => Promise<string>): Promise<void> {
    try {
      passo(nome, true, await fazer());
    } catch (erro) {
      passo(nome, false, resumoDoErro(erro));
    }
  }

  await tentar("o número (GET /{phone-number-id})", async () => {
    const dados = await cliente.dadosDoNumero(entrada.token, entrada.phoneNumberId);
    const digitos = soDigitos(dados.numeroExibido);
    if (digitos.length < 10) throw new FalhaDaFumaca("o display_phone_number veio num formato estranho (poucos dígitos)");
    const verificado = dados.nomeVerificado ? "sim" : "NÃO (o nome ainda não foi verificado pela Meta)";
    if (entrada.numeroEsperado !== undefined && soDigitos(entrada.numeroEsperado) !== "") {
      const confere = digitos.endsWith(soDigitos(entrada.numeroEsperado).slice(-8));
      if (!confere) throw new FalhaDaFumaca(`o número da Meta (final ${finalDe(dados.numeroExibido)}) NÃO é o esperado (final ${finalDe(entrada.numeroEsperado)})`);
      return `o número termina em ${finalDe(dados.numeroExibido)} e é o esperado; ${digitos.length} dígitos; o nome verificado aparece: ${verificado}`;
    }
    return `o número termina em ${finalDe(dados.numeroExibido)} (${digitos.length} dígitos); o nome verificado aparece: ${verificado}`;
  });

  await tentar("os modelos (GET /{waba-id}/message_templates)", async () => {
    const lidos = await cliente.listarModelos(entrada.token, entrada.wabaId);
    if (lidos.length === 0) return "a conta não tem nenhum modelo (nada a conferir; crie um no Gerenciador do WhatsApp para testar o envio)";
    const traduzidos = lidos.map((m) => ({ da: m, traduzido: traduzirModelo(m) }));
    const reconhecidos = traduzidos.flatMap((t) => (t.traduzido ? [t.traduzido] : []));
    const ignorados = traduzidos.length - reconhecidos.length;
    const enviaveis = reconhecidos.filter((m) => modeloEnviavel({ estado: m.estado, categoria: m.categoria, componentes: m.componentes }));
    // Os tipos de componente e de cabeçalho que a Meta de fato devolve: é o que confirma (ou desmente) o que o tradutor assume.
    const tipos = reconhecidos.flatMap((m) => m.componentes.map((c) => c.type.toUpperCase()));
    const cabecalhos = reconhecidos.flatMap((m) => m.componentes.filter((c) => c.type.toUpperCase() === "HEADER").map((c) => (c.format ?? "TEXT").toUpperCase()));
    const sobraDeFormato = reconhecidos.filter((m) => !m.componentes.some((c) => c.type.toUpperCase() === "BODY")).length;
    if (sobraDeFormato > 0) throw new FalhaDaFumaca(`${sobraDeFormato} de ${lidos.length} modelos vieram SEM corpo (BODY): o formato dos componentes não é o que o CRM assume`);
    const nomes = enviaveis.slice(0, 8).map((m) => `${m.nome} (${m.idioma}, ${m.quantidadeDeVariaveis} variáv.)`);
    return [
      `${lidos.length} modelos: estados ${contagens(lidos.map((m) => m.status))}; categorias ${contagens(lidos.map((m) => m.category))}`,
      `o CRM reconhece ${reconhecidos.length}${ignorados > 0 ? ` e IGNORA ${ignorados} (categoria ou estado que ele não conhece)` : ""}`,
      `componentes vistos: ${contagens(tipos)}${cabecalhos.length > 0 ? `; cabeçalhos ${contagens(cabecalhos)}` : ""}`,
      `${enviaveis.length} enviáveis agora${nomes.length > 0 ? `: ${nomes.join("; ")}` : ""}`,
    ].join(" | ");
  });

  if (entrada.inscrever) {
    await tentar("inscrever o app na conta (POST /{waba-id}/subscribed_apps)", async () => {
      await cliente.inscreverApp(entrada.token, entrada.wabaId);
      return "a Meta confirmou a inscrição (success: true)";
    });
  } else {
    passo("inscrever o app na conta (POST /{waba-id}/subscribed_apps)", true, "pulado: escreve na Meta; rode com --inscrever para conferir");
  }

  return { versao: deps.versao, passos, ok: passos.every((p) => p.ok) };
}

/** A saída que o comando imprime: um passo por linha e o veredito. Só fatos curtos. */
export function descreverFumacaOficial(resultado: ResultadoDaFumacaOficial): string {
  const linhas = [`Fumaça do WhatsApp oficial (Cloud API da Meta, Graph ${resultado.versao})`];
  for (const p of resultado.passos) linhas.push(`  ${p.ok ? "✓" : "✗"} ${p.nome} — ${p.detalhe}`);
  linhas.push(resultado.ok ? "PASSOU: a Meta respondeu como o CRM espera." : "FALHOU: veja os passos marcados com ✗ antes de conectar o Canal.");
  return linhas.join("\n");
}

/** A configuração da Graph para a fumaça: a versão do ambiente (ou a padrão) e o host de verdade. Não exige `META_APP_SECRET`. */
export function configuracaoDaFumaca(env: NodeJS.ProcessEnv = process.env): { readonly ok: true; readonly configuracao: ConfiguracaoDaCloudApi } | { readonly ok: false; readonly erro: string } {
  const versao = env.META_GRAPH_VERSAO?.trim() || VERSAO_PADRAO;
  if (!/^v\d+\.\d+$/.test(versao)) return { ok: false, erro: "META_GRAPH_VERSAO precisa ter a forma v26.0." };
  return { ok: true, configuracao: { appSecret: "", versao, graph: ENDERECO_DA_GRAPH } };
}

/** O que a fumaça pede do ambiente, e o que falta. O token entra só por variável de ambiente, nunca por argumento. */
export function lerEntradaDaFumaca(env: NodeJS.ProcessEnv, argumentos: readonly string[]): { readonly ok: true; readonly entrada: EntradaDaFumacaOficial } | { readonly ok: false; readonly faltam: readonly string[]; readonly invalida?: string } {
  const token = env.WHATSAPP_FUMACA_TOKEN?.trim() ?? "";
  const phoneNumberId = env.WHATSAPP_FUMACA_PHONE_NUMBER_ID?.trim() ?? "";
  const wabaId = env.WHATSAPP_FUMACA_WABA_ID?.trim() ?? "";
  const faltam = [["WHATSAPP_FUMACA_TOKEN", token], ["WHATSAPP_FUMACA_PHONE_NUMBER_ID", phoneNumberId], ["WHATSAPP_FUMACA_WABA_ID", wabaId]].filter(([, v]) => v === "").map(([k]) => k as string);
  if (faltam.length > 0) return { ok: false, faltam };
  if (!/^\d{5,30}$/.test(phoneNumberId)) return { ok: false, faltam: [], invalida: "WHATSAPP_FUMACA_PHONE_NUMBER_ID tem só dígitos." };
  if (!/^\d{5,30}$/.test(wabaId)) return { ok: false, faltam: [], invalida: "WHATSAPP_FUMACA_WABA_ID tem só dígitos." };
  if (/\s/.test(token)) return { ok: false, faltam: [], invalida: "WHATSAPP_FUMACA_TOKEN tem espaço ou quebra de linha (cole só o token)." };
  const esperado = env.WHATSAPP_FUMACA_NUMERO?.trim();
  return { ok: true, entrada: { token, phoneNumberId, wabaId, ...(esperado ? { numeroEsperado: esperado } : {}), inscrever: argumentos.includes("--inscrever") } };
}

/** Cliente de verdade para a CLI; os testes passam o deles. */
export function clienteDaFumaca(configuracao: ConfiguracaoDaCloudApi): ClienteDaCloudApi {
  return criarClienteDaCloudApi(configuracao);
}
