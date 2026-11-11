/**
 * `npm run evolution:fumaca -w @n1/api` — a fumaça da Evolution REAL (Sessão 4): confere, contra o servidor de verdade, cada
 * chamada que o "Conectar" pelo CRM faz, ANTES de alguém escanear um QR code.
 *
 * Por que existe: os testes da Sessão 4 usam um servidor falso, e o formato de várias respostas da Evolution v2.4.0 (o `hash` do
 * `create`, o `base64` do QR, o `ownerJid` do `fetchInstances`, o `logout` de uma instância já fechada) vem do código de uma versão
 * vizinha, não da instalada. Este comando é a prova: cria UMA instância descartável, passa por todos os passos e a apaga.
 *
 * Passos: versão › criar (QR no `create`) › buscar (o `token` e o `ownerJid` aparecem?) › estado › pedir QR › sair da sessão ›
 * apagar › conferir que sumiu (por alguns segundos: a Evolution 2.4.0 ainda lista, como `close`, a instância que acabou de abrir
 * um QR por cerca de 1 s depois do `DELETE`). Cada passo é independente (um que falha não pula os outros) e a limpeza roda SEMPRE.
 *
 * SEGURANÇA: a instância se chama `n1-fumaca-<aleatório>` (o cliente só cria e apaga `n1-...`, nunca a `numeropvmarcos` do
 * Financeiro), não leva número (nenhum WhatsApp é tocado), e o webhook aponta para um Canal que não existe (a api o recusa).
 * A saída leva só passou/falhou, a versão e fatos como "o token apareceu: sim"; nunca chave, token, QR, número nem URL.
 */

import { randomBytes } from "node:crypto";
import type { ConfiguracaoDaEvolution } from "../mensageria/provedores/evolution/ambiente";
import { urlDoWebhookDoCanal } from "../mensageria/provedores/evolution/ambiente";
import { ErroDaEvolution, type ClienteDaEvolution } from "../mensageria/provedores/evolution/cliente";

export interface PassoDaFumaca {
  readonly nome: string;
  readonly ok: boolean;
  /** Um fato curto e sem segredo: "versão 2.4.0", "o token apareceu: sim". */
  readonly detalhe: string;
}

export interface ResultadoDaFumaca {
  readonly instancia: string;
  readonly passos: readonly PassoDaFumaca[];
  readonly ok: boolean;
}

export interface DependenciasDaFumaca {
  readonly cliente: ClienteDaEvolution;
  readonly configuracao: Pick<ConfiguracaoDaEvolution, "apikeyGlobal" | "urlPublica">;
  /** Os testes fixam o sufixo; o padrão é aleatório. */
  readonly sufixo?: string;
  readonly gerarToken?: () => string;
  /** Pausa entre as tentativas de pedir o QR (a Evolution leva uns segundos para gerá-lo). Padrão 2 s. */
  readonly esperar?: (ms: number) => Promise<void>;
}

const TENTATIVAS_DO_QR = 4;

/** Depois do `DELETE`, a Evolution leva ~1 s para tirar a instância da lista (medido na 2.4.0 real); confere até 6 vezes, de 2 em 2 s. */
const CONFERENCIAS_DA_EXCLUSAO = 6;
const PAUSA_DA_EXCLUSAO_MS = 2_000;

/** Uma falha que a própria fumaça lança, com uma frase escrita aqui (sem corpo, chave nem token): aparece na saída como está. */
class FalhaDaFumaca extends Error {}

/** O que um erro diz sem vazar nada: o tipo e o status HTTP, nunca a mensagem nem o corpo (a de `FalhaDaFumaca` é nossa e aparece). */
function resumoDoErro(erro: unknown): string {
  if (erro instanceof FalhaDaFumaca) return erro.message;
  if (erro instanceof ErroDaEvolution) return erro.tipo === "http" ? `a Evolution respondeu HTTP ${erro.status}` : `falha de transporte (${erro.tipo})`;
  return "erro inesperado";
}

export async function rodarFumacaDaEvolution(deps: DependenciasDaFumaca): Promise<ResultadoDaFumaca> {
  const { cliente, configuracao } = deps;
  const global = configuracao.apikeyGlobal;
  const sufixo = deps.sufixo ?? randomBytes(4).toString("hex");
  const nome = `n1-fumaca-${sufixo}`;
  const token = (deps.gerarToken ?? (() => randomBytes(24).toString("hex")))();
  const esperar = deps.esperar ?? ((ms: number) => new Promise<void>((resolver) => setTimeout(resolver, ms)));
  const passos: PassoDaFumaca[] = [];
  const passo = (nomeDoPasso: string, ok: boolean, detalhe: string) => passos.push({ nome: nomeDoPasso, ok, detalhe });

  async function tentar(nomeDoPasso: string, fazer: () => Promise<string>): Promise<void> {
    try {
      passo(nomeDoPasso, true, await fazer());
    } catch (erro) {
      passo(nomeDoPasso, false, resumoDoErro(erro));
    }
  }

  await tentar("versão da Evolution", async () => {
    const versao = await cliente.versao(global);
    if (!/^2\./.test(versao)) throw new FalhaDaFumaca("versão fora da 2.x");
    return `versão ${versao}`;
  });

  let criada = false;
  await tentar("criar a instância (POST /instance/create)", async () => {
    const resultado = await cliente.criarInstancia(global, {
      nome,
      token,
      webhook: { url: urlDoWebhookDoCanal(configuracao.urlPublica, `fumaca-${sufixo}`), segredo: randomBytes(16).toString("hex") },
    });
    criada = true;
    return `criada; QR já veio no create: ${resultado.qrcode ? "sim (imagem válida)" : "não (será pedido)"}`;
  });

  if (criada) {
    await tentar("achar a instância (GET /instance/fetchInstances)", async () => {
      const achada = await cliente.buscarInstancia(global, nome);
      if (!achada) throw new FalhaDaFumaca("não achou");
      return `achada; o token aparece: ${achada.token !== null ? "sim" : "NÃO (então um resto de tentativa não poderia ser retomado)"}; o dono do número aparece: ${achada.ownerJid !== null ? "sim" : "não (esperado: ninguém conectou)"}; estado: ${achada.connectionStatus}`;
    });

    await tentar("estado da conexão (GET /instance/connectionState)", async () => `estado: ${await cliente.estadoDaConexao(token, nome)} (com o token da instância)`);

    await tentar("pedir o QR code (GET /instance/connect)", async () => {
      for (let tentativa = 1; tentativa <= TENTATIVAS_DO_QR; tentativa += 1) {
        const resposta = await cliente.pedirQrCode(token, nome);
        if (resposta.tipo === "qrcode") return `QR válido na ${tentativa}ª tentativa; código de pareamento: ${resposta.qrcode.codigoDePareamento ? "sim" : "não (esperado sem número)"}`;
        if (resposta.tipo === "conectada") throw new FalhaDaFumaca("a instância apareceu aberta");
        if (tentativa < TENTATIVAS_DO_QR) await esperar(2_000);
      }
      throw new FalhaDaFumaca("sem QR");
    });

    await tentar("sair da sessão (DELETE /instance/logout, instância nunca conectada)", async () => {
      await cliente.sairDaSessao(token, nome);
      return "aceito (idempotente)";
    });
  }

  // A limpeza roda SEMPRE: um passo que falhou não pode deixar a instância descartável na Evolution.
  await tentar("apagar a instância (DELETE /instance/delete)", async () => {
    await cliente.apagarInstancia(global, nome);
    return "apagada";
  });
  await tentar("conferir que a instância sumiu", async () => {
    for (let conferencia = 1; conferencia <= CONFERENCIAS_DA_EXCLUSAO; conferencia += 1) {
      if (!(await cliente.buscarInstancia(global, nome))) {
        return conferencia === 1 ? "não existe mais" : `não existe mais (a Evolution a tirou da lista na ${conferencia}ª conferência)`;
      }
      if (conferencia < CONFERENCIAS_DA_EXCLUSAO) await esperar(PAUSA_DA_EXCLUSAO_MS);
    }
    throw new FalhaDaFumaca(`a instância continua na lista depois de ${CONFERENCIAS_DA_EXCLUSAO} conferências`);
  });

  return { instancia: nome, passos, ok: passos.every((p) => p.ok) };
}

export function descreverFumaca(resultado: ResultadoDaFumaca): string {
  const linhas = resultado.passos.map((p) => `  ${p.ok ? "✓" : "✗"} ${p.nome}: ${p.detalhe}`);
  return [
    "Fumaça da Evolution (instância descartável, apagada no fim):",
    ...linhas,
    "",
    resultado.ok
      ? "Tudo respondeu como o CRM espera. O \"Conectar\" pela tela pode ser testado."
      : "Algum passo FALHOU: o formato real da Evolution difere do que o CRM espera. Não use o \"Conectar\" antes de resolver (a saída acima diz qual).",
  ].join("\n");
}
