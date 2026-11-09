/**
 * A coleta diária de órfãos (16-10, 3.9.6, T-16-39) contra o Postgres LOCAL (Docker, porta 55725):
 *
 *   DATABASE_URL=postgres://postgres:x@localhost:55725/postgres \
 *   DATABASE_URL_MIGRACAO=postgres://postgres:x@localhost:55725/postgres npx vitest run src/mensageria/coleta-de-orfaos.test.ts
 *
 * O armazenamento é o falso em memória (nunca o bucket real). Prova: a sessão de upload expirada e o objeto de `entrada/`
 * com mais de 1 h que nenhuma Mensagem cita somem; o objeto citado e o de 10 min ficam; duas coletas em paralelo rodam
 * uma só (`pg_try_advisory_lock`) e a trava volta no fim; o log leva só contagens.
 */

import { afterAll, beforeAll, expect, it } from "vitest";
import { encerrar, pool } from "../persistencia/conexao";
import { criarSessao, objetosDaSessao, reservarObjeto } from "../persistencia/sessoes-de-upload";
import { criarServicoDeRecebimento } from "../servicos/crm/recebimento";
import { criarArmazenamentoFalso, type ArmazenamentoFalso } from "../testes/armazenamento-falso";
import { describeComBanco, limparEspaco, novoEspacoDeTeste, prepararBancoCrm, semearCanal, semearMembro } from "../testes/banco-crm";
import { criarColetaDeOrfaos } from "./coleta-de-orfaos";

const HORA_MS = 3_600_000;
const dormir = (ms: number) => new Promise<void>((resolver) => setTimeout(resolver, ms));
const bytes = (n: number) => new Uint8Array(n);

describeComBanco("coleta de órfãos — Postgres local, armazenamento falso", () => {
  const espacos: string[] = [];

  async function cenario(rotulo: string) {
    const ws = novoEspacoDeTeste(rotulo);
    espacos.push(ws);
    await semearMembro(ws, { id: "mem_dona", base: "membro", state: "ativo" });
    const canalId = await semearCanal(ws, {
      nome: "Comercial",
      tipo: "whatsapp",
      provedor: "whatsapp-nao-oficial",
      identificadorExterno: "+5511977770001",
      conexao: "conectada",
      conexaoSimulada: true,
      configuradoPor: "mem_dona",
    });
    const chaveDeEntrada = (nome: string) => `workspace/${ws}/entrada/${canalId}/${nome}`;
    return { ws, canalId, chaveDeEntrada };
  }

  /** Uma Mensagem recebida que cita `objectKey` no anexo (o que a entrada de mídia grava). */
  async function mensagemQueCita(c: { ws: string; canalId: string }, objectKey: string) {
    const r = await criarServicoDeRecebimento({ pool }).receberMensagem(
      c.ws,
      c.canalId,
      {
        idExterno: "audio-citado",
        criadoEm: new Date().toISOString(),
        remetente: { tipo: "whatsapp", valor: "+5511987654321", nomeExibido: "Ana" },
        anexos: [{ referenciaNoProvedor: "ref", tipoDeMidia: "audio/ogg", nome: "audio.ogg" }],
        cargaBruta: {},
      },
      { anexos: [{ tipoDeMidia: "audio/ogg", nome: "audio.ogg", objectKey, tamanhoBytes: 10, baixado: true }] },
    );
    if (!r.ok) throw new Error(`o recebimento recusou: ${r.error}`);
  }

  /** Uma sessão de upload expirada, nunca consumida, com um objeto reservado (o que um anexo abandonado deixa). */
  async function sessaoAbandonada(ws: string, chave: string) {
    const sessao = await criarSessao({ workspaceId: ws, formId: "conversa-qualquer", ttlSegundos: 3600 });
    await pool().query("update plataforma.upload_sessions set expires_at = now() - interval '2 hours' where id = $1", [sessao.id]);
    await reservarObjeto({ sessionId: sessao.id, objectKey: chave, displayName: "foto.png", mediaType: "image/png" });
    return sessao.id;
  }

  const velhoEm = (armazenamento: ArmazenamentoFalso, chave: string, horas: number) =>
    armazenamento.colocarPorChave(chave, bytes(10), "audio/ogg", new Date(Date.now() - horas * HORA_MS));

  beforeAll(async () => {
    await prepararBancoCrm();
  });

  afterAll(async () => {
    for (const ws of espacos) {
      await pool().query("delete from plataforma.upload_sessions where workspace_id = $1", [ws]);
      await limparEspaco(ws);
    }
    await encerrar();
  });

  it("apaga a sessão expirada e o objeto de entrada/ com mais de 1 h que nenhuma Mensagem cita; o citado e o de 10 min ficam", async () => {
    const c = await cenario("coleta");
    const armazenamento = criarArmazenamentoFalso();
    const orfao = c.chaveDeEntrada("orfao-de-2h");
    const citado = c.chaveDeEntrada("citado-de-2h");
    const recente = c.chaveDeEntrada("recente-de-10min");
    velhoEm(armazenamento, orfao, 2);
    velhoEm(armazenamento, citado, 2);
    armazenamento.colocarPorChave(recente, bytes(10), "audio/ogg", new Date(Date.now() - 10 * 60_000));
    await mensagemQueCita(c, citado);
    const chaveDaSessao = `workspace/${c.ws}/conversas/conv/abandonado`;
    armazenamento.colocarPorChave(chaveDaSessao, bytes(10), "image/png", new Date(Date.now() - 3 * HORA_MS));
    const sessaoId = await sessaoAbandonada(c.ws, chaveDaSessao);

    const resultado = await criarColetaDeOrfaos({ armazenamento }).rodarUmaVez();

    expect(resultado.rodou).toBe(true);
    expect(resultado.objetosDeEntradaRemovidos).toBe(1);
    expect(resultado.sessoesExpiradas).toBeGreaterThanOrEqual(1);
    expect(resultado.objetosRemovidos).toBeGreaterThanOrEqual(1);
    expect(armazenamento.chavesGuardadas().sort()).toEqual([citado, recente].sort());
    expect(armazenamento.removidos).toEqual(expect.arrayContaining([orfao, chaveDaSessao]));
    expect(armazenamento.removidos).not.toContain(citado);
    expect(armazenamento.removidos).not.toContain(recente);
    expect((await objetosDaSessao(sessaoId)).map((o) => o.state)).toEqual(["expirado"]);
  });

  it("uma sessão cujo objeto não pôde ser removido não é marcada como expirada: a próxima rodada tenta de novo", async () => {
    const c = await cenario("coletafalha");
    const armazenamento = criarArmazenamentoFalso();
    const chave = `workspace/${c.ws}/conversas/conv/abandonado-2`;
    armazenamento.colocarPorChave(chave, bytes(10), "image/png");
    const sessaoId = await sessaoAbandonada(c.ws, chave);
    // O bucket falha na primeira remoção DESTA chave (e só nela): sessões de outros testes no mesmo banco não gastam a falha.
    let falhou = false;
    const instavel = {
      ...armazenamento,
      remover: async (chaves: readonly string[]) => {
        if (chaves.includes(chave) && !falhou) {
          falhou = true;
          throw new Error("storage fora do ar");
        }
        return armazenamento.remover(chaves);
      },
    };
    const coleta = criarColetaDeOrfaos({ armazenamento: instavel });

    await coleta.rodarUmaVez();
    expect((await objetosDaSessao(sessaoId)).map((o) => o.state)).toEqual(["reservado"]);
    expect(armazenamento.chavesGuardadas()).toContain(chave);

    await coleta.rodarUmaVez();
    expect((await objetosDaSessao(sessaoId)).map((o) => o.state)).toEqual(["expirado"]);
    expect(armazenamento.chavesGuardadas()).not.toContain(chave);
  });

  it("duas coletas em paralelo: só uma roda (a outra devolve rodou: false) e a trava volta no fim", async () => {
    const c = await cenario("coletatrava");
    const armazenamento = criarArmazenamentoFalso();
    velhoEm(armazenamento, c.chaveDeEntrada("orfao"), 2);
    // Segura a listagem para a primeira coleta ficar com a trava enquanto a segunda tenta.
    const lenta = {
      ...armazenamento,
      listar: async (...argumentos: Parameters<typeof armazenamento.listar>) => {
        if (argumentos[0].includes(c.canalId)) await dormir(150);
        return armazenamento.listar(...argumentos);
      },
    };
    const coleta = criarColetaDeOrfaos({ armazenamento: lenta });

    const resultados = await Promise.all([coleta.rodarUmaVez(), coleta.rodarUmaVez()]);
    expect(resultados.map((r) => r.rodou).sort()).toEqual([false, true]);
    expect(resultados.find((r) => !r.rodou)).toEqual({ rodou: false, sessoesExpiradas: 0, objetosRemovidos: 0, objetosDeEntradaRemovidos: 0 });
    expect(resultados.find((r) => r.rodou)!.objetosDeEntradaRemovidos).toBe(1);

    // A trava foi devolvida: uma terceira coleta roda.
    expect((await coleta.rodarUmaVez()).rodou).toBe(true);
  });

  it("o log leva só contagens e a idade mínima é configurável", async () => {
    const c = await cenario("coletalog");
    const armazenamento = criarArmazenamentoFalso();
    const chave = c.chaveDeEntrada("de-30min");
    armazenamento.colocarPorChave(chave, bytes(10), "audio/ogg", new Date(Date.now() - 30 * 60_000));
    const registros: Array<{ mensagem: string; dados?: Record<string, unknown> }> = [];
    const coleta = criarColetaDeOrfaos({
      armazenamento,
      idadeMinimaMs: 10 * 60_000,
      registrar: (_nivel, mensagem, dados) => registros.push({ mensagem, ...(dados ? { dados } : {}) }),
    });

    const resultado = await coleta.rodarUmaVez();
    expect(resultado.objetosDeEntradaRemovidos).toBe(1);
    expect(armazenamento.removidos).toContain(chave);
    expect(registros).toHaveLength(1);
    const dados = registros[0]!.dados!;
    expect(Object.keys(dados).sort()).toEqual(["objetosDeEntradaRemovidos", "objetosRemovidos", "sessoesExpiradas"]);
    for (const valor of Object.values(dados)) expect(typeof valor).toBe("number");
    expect(JSON.stringify(registros)).not.toContain("workspace/");
  });

  it("iniciar() agenda a coleta a cada intervalo e parar() espera a rodada em voo", async () => {
    const c = await cenario("coletaciclo");
    const armazenamento = criarArmazenamentoFalso();
    velhoEm(armazenamento, c.chaveDeEntrada("orfao-agendado"), 2);
    const coleta = criarColetaDeOrfaos({ armazenamento, intervaloMs: 30 });

    coleta.iniciar();
    coleta.iniciar();
    const limite = Date.now() + 3_000;
    while (armazenamento.removidos.length === 0 && Date.now() < limite) await dormir(10);
    await coleta.parar();

    expect(armazenamento.removidos).toContain(c.chaveDeEntrada("orfao-agendado"));
  });
});
