/**
 * A mídia da mensageria, ponta a ponta (16-10, 3.9.4 e 3.9.5, MSG-04, D-16-08), contra o Postgres LOCAL (Docker, porta 55725):
 *
 *   DATABASE_URL=postgres://postgres:x@localhost:55725/postgres \
 *   DATABASE_URL_MIGRACAO=postgres://postgres:x@localhost:55725/postgres npx vitest run src/e2e/mensageria-midia.test.ts
 *
 * Nunca toca o Storage real nem um provedor real: o armazenamento é o falso em memória e o provedor é o de teste.
 *
 * Entrada: o webhook de um áudio vira Mensagem com o arquivo JÁ guardado (a chave é de `entrada/`), e o arquivo continua abrindo
 * por `GET /mensagens/:id/anexos/0` depois de o provedor esquecer a mídia (o link dele expirou).
 * Saída: uma imagem anexada na Caixa chega ao provedor de teste com a URL assinada do arquivo guardado.
 */

import { randomBytes } from "node:crypto";
import { afterAll, beforeAll, beforeEach, expect, it } from "vitest";
import { buildSeed } from "@n1/dominio/seed";
import type { Mensagem } from "@n1/dominio/crm/mensagens";
import { buildApp } from "../app";
import { criarWorkerDeSaida, FRASES_DA_SAIDA } from "../mensageria/entregar-mensagem";
import { criarProcessadorDeEntrada } from "../mensageria/processador-de-entrada";
import { CABECALHO_DO_SEGREDO, TIPO_DO_SEGREDO_DO_WEBHOOK } from "../mensageria/provedor";
import { provedorDeTeste } from "../mensageria/provedores/teste";
import { encerrar, pool } from "../persistencia/conexao";
import { criarRepositorioDeContatosPg } from "../repositorios/crm/contatos";
import { criarRepositorioDeConversasPg } from "../repositorios/crm/conversas";
import { criarRepositorioDeMensagensPg } from "../repositorios/crm/mensagens";
import { guardarCredencial, type ChavesDoCofre } from "../servicos/cofre";
import { criarAcessoAoCrmPg } from "../servicos/crm/acesso";
import { criarServicoDeMensagens } from "../servicos/crm/mensagens";
import { criarArmazenamentoFalso } from "../testes/armazenamento-falso";
import { describeComBanco, limparEspaco, novoEspacoDeTeste, prepararBancoCrm, semearCanal, semearMembro } from "../testes/banco-crm";

const chaves: ChavesDoCofre = { atual: { versao: 1, chave: randomBytes(32) } };
const SEGREDO = "s1-do-canal-da-midia";
const WHATSAPP_DA_ANA = "+5511987654321";
const MEMBRO = { authorization: "Bearer token-ana" };
const membroBase = buildSeed().members.find((m) => m.id === "mem_maryane")!;

/** Um Ogg de verdade só no começo (`OggS`): é o que a conferência de assinatura lê. */
function ogg(bytes: number): Uint8Array {
  const conteudo = new Uint8Array(bytes);
  conteudo.set(Buffer.from("OggS"));
  return conteudo;
}

/** Um PNG de 1x1 pixel de verdade. */
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");

describeComBanco("Fase 16 ponta a ponta: a mídia que chega é guardada e a que sai leva a URL assinada", () => {
  const ws = novoEspacoDeTeste("msgmidia");
  const armazenamento = criarArmazenamentoFalso();
  let canalId: string;
  let conversaDaSaida: string;

  const app = () =>
    buildApp({
      logger: false,
      workspaceId: ws,
      webhooksDeMensageria: { chaves },
      verificarToken: async (token) => (token === "token-ana" ? { sub: "usuario-ana" } : null),
      resolverMembro: async (_workspaceId, userId) =>
        userId === "usuario-ana" ? { ...membroBase, id: "mem_ana", userId, state: "ativo" as const } : undefined,
      crm: { mensagens: criarServicoDeMensagens({ pool, acesso: criarAcessoAoCrmPg(pool), armazenamento }) },
    });

  const processador = () => criarProcessadorDeEntrada({ workerId: "teste-midia", chaves, armazenamento });

  const chegar = (idExterno: string, anexos: Array<{ referenciaNoProvedor: string; tipoDeMidia: string; nome: string }>, conteudo?: string) =>
    app().inject({
      method: "POST",
      url: `/webhooks/mensageria/${canalId}`,
      headers: { [CABECALHO_DO_SEGREDO]: SEGREDO },
      payload: {
        eventos: [
          { tipo: "mensagem", idExterno, remetente: { tipo: "whatsapp", valor: WHATSAPP_DA_ANA, nomeExibido: "Ana" }, anexos, ...(conteudo === undefined ? {} : { conteudo }) },
        ],
      },
    });

  const mensagemPorIdExterno = async (idExterno: string): Promise<Mensagem> => {
    const { rows } = await pool().query<{ id: string }>("select id from plataforma.mensagens where workspace_id = $1 and id_externo = $2", [ws, idExterno]);
    const id = rows[0]?.id;
    if (!id) throw new Error(`a Mensagem ${idExterno} não foi gravada`);
    return (await criarRepositorioDeMensagensPg(pool()).obter(ws, id))!;
  };

  beforeAll(async () => {
    await prepararBancoCrm();
    await semearMembro(ws, { id: "mem_ana", base: "membro", state: "ativo" });
    canalId = await semearCanal(ws, {
      nome: "Comercial",
      tipo: "whatsapp",
      provedor: "whatsapp-nao-oficial",
      identificadorExterno: "+5511977770001",
      conexao: "conectada",
      conexaoSimulada: true,
      configuradoPor: "mem_ana",
    });
    await guardarCredencial(pool(), chaves, { workspaceId: ws, donoTipo: "canal", donoId: canalId, tipo: TIPO_DO_SEGREDO_DO_WEBHOOK, segredo: SEGREDO });
    // Uma Conversa à parte para a saída (o Contato dela é outro número).
    const contato = await criarRepositorioDeContatosPg(pool()).inserir(ws, { nome: "Beto", proprietarioId: "mem_ana", criadoPor: "mem_ana" });
    await criarRepositorioDeContatosPg(pool()).inserirIdentificador(ws, contato.id, { tipo: "whatsapp", valor: "+5511955550002", principal: true });
    const conversa = await criarRepositorioDeConversasPg(pool()).inserir(ws, {
      canalId,
      contatoId: contato.id,
      titulo: "Beto — Comercial",
      filaId: null,
      atribuido: { tipo: "membro", id: "mem_ana" },
      participantes: [],
      criadoPor: { tipo: "member", id: "mem_ana" },
    });
    conversaDaSaida = conversa.id;
  });

  beforeEach(() => {
    provedorDeTeste.limpar();
  });

  afterAll(async () => {
    await pool().query("delete from plataforma.integration_outbox where workspace_id = $1", [ws]);
    await pool().query("delete from plataforma.credenciais where workspace_id = $1", [ws]);
    await limparEspaco(ws);
    await encerrar();
  });

  it("3.9.4: um áudio recebido é baixado e guardado em `entrada/`, e continua abrindo depois de o provedor esquecer a mídia", async () => {
    const bytes = ogg(4096);
    provedorDeTeste.guardarMidia("ref-audio-1", { bytes, tipoDeMidia: "audio/ogg; codecs=opus" });

    const resposta = await chegar("audio-1", [{ referenciaNoProvedor: "ref-audio-1", tipoDeMidia: "audio/ogg; codecs=opus", nome: "audio.ogg" }]);
    expect(resposta.statusCode).toBe(200);
    expect(await processador().processarUm()).toBe(true);

    const mensagem = await mensagemPorIdExterno("audio-1");
    expect(mensagem.anexos).toHaveLength(1);
    const anexo = mensagem.anexos[0]!;
    expect(anexo).toEqual({
      tipoDeMidia: "audio/ogg",
      nome: "audio.ogg",
      objectKey: expect.stringMatching(new RegExp(`^workspace/${ws}/entrada/${canalId}/[0-9a-f-]{36}$`)),
      tamanhoBytes: 4096,
      baixado: true,
    });
    expect(armazenamento.chavesGuardadas()).toContain(anexo.objectKey);

    // O link do provedor expirou: a mídia dele some, e o arquivo guardado segue abrindo.
    provedorDeTeste.esquecerMidia("ref-audio-1");
    const aberto = await app().inject({ method: "GET", url: `/mensagens/${mensagem.id}/anexos/0`, headers: MEMBRO });
    expect(aberto.statusCode).toBe(200);
    const corpo = aberto.json() as { ok: true; dados: { url: string } };
    expect(corpo.dados.url.startsWith("https://armazenamento-falso.test/objeto/")).toBe(true);
    expect(armazenamento.urlsEmitidas.at(-1)).toEqual({ objectKey: anexo.objectKey });
  });

  // --- Saída (3.9.5): o arquivo anexado na Caixa chega ao provedor com a URL assinada ---

  const worker = () => criarWorkerDeSaida({ workerId: "teste-saida-midia", workspaceId: ws, chaves, armazenamento });

  /** Pede o ticket, põe os bytes no falso (o navegador no `uploadUrl`) e escreve a Mensagem só com o anexo. */
  async function anexarNaCaixa(bytes: Uint8Array, anexo: { nome: string; tipoDeMidia: string }): Promise<Mensagem> {
    const ticket = await app().inject({
      method: "POST",
      url: "/mensagens/anexos",
      headers: MEMBRO,
      payload: { conversaId: conversaDaSaida, ...anexo, tamanhoBytes: bytes.byteLength },
    });
    expect(ticket.statusCode).toBe(200);
    const { submissionId, objectId } = (ticket.json() as { dados: { submissionId: string; objectId: string } }).dados;
    armazenamento.colocarBytes(objectId, bytes);
    const criada = await app().inject({
      method: "POST",
      url: "/mensagens",
      headers: MEMBRO,
      payload: { conversaId: conversaDaSaida, direcao: "enviada", conteudo: "", anexos: [{ submissionId, objectId }] },
    });
    expect(criada.statusCode).toBe(201);
    return (criada.json() as { dados: Mensagem }).dados;
  }

  const estadoDaMensagem = async (id: string) =>
    (await pool().query<{ status_entrega: string; motivo_falha: string | null }>("select status_entrega, motivo_falha from plataforma.mensagens where workspace_id = $1 and id = $2", [ws, id])).rows[0]!;

  it("3.9: uma imagem anexada na Caixa chega ao provedor de teste com a URL assinada, o tipo e o nome", async () => {
    const criada = await anexarNaCaixa(PNG, { nome: "foto.png", tipoDeMidia: "image/png" });
    const antes = armazenamento.urlsEmitidas.length;

    expect(await worker().processarUm()).toBe(true);

    expect(provedorDeTeste.enviados).toHaveLength(1);
    expect(provedorDeTeste.enviados[0]).toMatchObject({ mensagemId: criada.id, destino: { tipo: "whatsapp", valor: "+5511955550002" } });
    const anexo = provedorDeTeste.enviados[0]!.anexos;
    expect(anexo).toHaveLength(1);
    expect(anexo![0]).toEqual({
      urlAssinada: `https://armazenamento-falso.test/objeto/${encodeURIComponent(criada.anexos[0]!.objectKey!)}`,
      tipoDeMidia: "image/png",
      nome: "foto.png",
    });
    // A imagem abre no <img>: sem `download`.
    expect(armazenamento.urlsEmitidas.slice(antes)).toEqual([{ objectKey: criada.anexos[0]!.objectKey }]);
    expect(await estadoDaMensagem(criada.id)).toMatchObject({ status_entrega: "enviada" });
  });

  it("um documento sai com a URL assinada de download (Content-Disposition: attachment) com o nome do arquivo", async () => {
    const pdf = Buffer.from("%PDF-1.4\n1 0 obj\n<<>>\nendobj\n%%EOF\n", "ascii");
    const criada = await anexarNaCaixa(pdf, { nome: "proposta.pdf", tipoDeMidia: "application/pdf" });
    const antes = armazenamento.urlsEmitidas.length;

    expect(await worker().processarUm()).toBe(true);

    expect(provedorDeTeste.enviados[0]!.anexos).toEqual([
      {
        urlAssinada: `https://armazenamento-falso.test/objeto/${encodeURIComponent(criada.anexos[0]!.objectKey!)}?download=proposta.pdf`,
        tipoDeMidia: "application/pdf",
        nome: "proposta.pdf",
      },
    ]);
    expect(armazenamento.urlsEmitidas.slice(antes)).toEqual([{ objectKey: criada.anexos[0]!.objectKey, download: "proposta.pdf" }]);
  });

  it("um anexo baixado: false numa Mensagem enviada não sai: falhou com a frase do produto e o provedor não é chamado", async () => {
    const criada = await anexarNaCaixa(PNG, { nome: "foto.png", tipoDeMidia: "image/png" });
    await pool().query("update plataforma.mensagens set anexos = $3::jsonb where workspace_id = $1 and id = $2", [
      ws,
      criada.id,
      JSON.stringify([{ tipoDeMidia: "image/png", nome: "foto.png", referenciaExterna: "ref", baixado: false }]),
    ]);

    expect(await worker().processarUm()).toBe(true);

    expect(provedorDeTeste.enviados).toHaveLength(0);
    expect(await estadoDaMensagem(criada.id)).toEqual({ status_entrega: "falhou", motivo_falha: "O arquivo desta Mensagem não está disponível." });
    expect(FRASES_DA_SAIDA.arquivoIndisponivel).toBe("O arquivo desta Mensagem não está disponível.");
  });

  it("o bucket fora do ar na hora de assinar não perde a Mensagem: nada sai e ela volta à fila (transitório)", async () => {
    const criada = await anexarNaCaixa(PNG, { nome: "foto.png", tipoDeMidia: "image/png" });
    armazenamento.falharNaProxima(new Error("storage fora do ar"));

    expect(await worker().processarUm()).toBe(true);
    expect(provedorDeTeste.enviados).toHaveLength(0);
    expect(await estadoDaMensagem(criada.id)).toMatchObject({ status_entrega: "pendente" });

    await pool().query("update plataforma.integration_outbox set available_at = now() where workspace_id = $1 and aggregate_id = $2", [ws, criada.id]);
    expect(await worker().processarUm()).toBe(true);
    expect(provedorDeTeste.enviados).toHaveLength(1);
    expect(await estadoDaMensagem(criada.id)).toMatchObject({ status_entrega: "enviada" });
  });
});
