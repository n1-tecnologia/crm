/**
 * `npm run canal:atualizar-webhook-evolution` (Sessão 4, 4.4.5): reaplica nas instâncias já conectadas a lista atual de eventos
 * do webhook, sem trocar o segredo e sem escrever no banco.
 *
 * NUNCA fala com uma Evolution real nem com o banco do `.env`: a Evolution é o servidor HTTP falso e o banco é um Postgres LOCAL.
 * O ambiente do comando é um objeto de teste em `deps.env`. Nenhum teste configura webhook da instância `numeropvmarcos`.
 */

import { randomBytes } from "node:crypto";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { TIPO_DO_SEGREDO_DO_WEBHOOK } from "../mensageria/provedor";
import { criarClienteDaEvolution } from "../mensageria/provedores/evolution/cliente";
import { encerrar, pool } from "../persistencia/conexao";
import { guardarCredencial, lerCredencial, type ChavesDoCofre } from "../servicos/cofre";
import { criarServidorFalso, type ServidorFalso } from "../testes/servidor-falso";
import { describeComBanco, limparEspaco, novoEspacoDeTeste, prepararBancoCrm, semearCanal } from "../testes/banco-crm";
import { atualizarWebhooks, lerArgumentos, principal, USO, type DependenciasDoWebhook } from "./canal-atualizar-webhook-evolution";

const chaves: ChavesDoCofre = { atual: { versao: 1, chave: randomBytes(32) } };
const TOKEN = "tok-inst-secreto";
const SEGREDO = "segredo-do-webhook-secreto";
const URL_PUBLICA = "https://api.n1.teste";

describe("lerArgumentos — sem banco", () => {
  it("--canal <id> ou --todos, com --seco e --url-publica opcionais", () => {
    expect(lerArgumentos(["--canal", "c1"])).toEqual({ alvo: { tipo: "canal", canalId: "c1" }, seco: false });
    expect(lerArgumentos(["--canal=c1", "--seco", "--url-publica=https://a.teste"])).toEqual({ alvo: { tipo: "canal", canalId: "c1" }, seco: true, urlPublica: "https://a.teste" });
    expect(lerArgumentos(["--todos"])).toEqual({ alvo: { tipo: "todos" }, seco: false });
    expect(lerArgumentos(["--todos", "--espaco", "ws_1"])).toEqual({ alvo: { tipo: "todos", espacoId: "ws_1" }, seco: false });
  });

  it("recusa sem alvo, com os dois, repetido, desconhecido ou sem valor", () => {
    for (const argv of [[], ["--seco"], ["--canal", "c1", "--todos"], ["--todos", "--todos"], ["--canal", "a", "--canal", "b"], ["--instancia", "x", "--todos"], ["--canal"], ["--canal", "--todos"], ["--canal", "c1", "--espaco", "ws_1"], ["--espaco", "ws_1"]]) {
      expect(() => lerArgumentos(argv)).toThrow();
    }
  });
});

describe("principal — sem banco: o ambiente errado sai antes de abrir pool, cofre ou rede", () => {
  const saidas = () => {
    const out: string[] = [];
    const err: string[] = [];
    return { out, err, saida: { out: (t: string) => out.push(t), err: (t: string) => err.push(t) } };
  };
  const semAcesso: Pick<DependenciasDoWebhook, "pool" | "chaves" | "criarCliente"> = {
    pool: () => {
      throw new Error("abriu o pool");
    },
    chaves: () => {
      throw new Error("abriu o cofre");
    },
    criarCliente: () => {
      throw new Error("abriu a rede");
    },
  };

  it("sem alvo mostra o uso e sai com 2", async () => {
    const s = saidas();
    expect(await principal([], { env: {}, ...semAcesso, saida: s.saida })).toBe(2);
    expect(s.err.join("\n")).toContain(USO);
  });

  it("sem EVOLUTION_URL ou sem API_URL_PUBLICA sai com 2 dizendo o que falta", async () => {
    const a = saidas();
    expect(await principal(["--todos"], { env: { API_URL_PUBLICA: URL_PUBLICA }, ...semAcesso, saida: a.saida })).toBe(2);
    expect(a.err.join("")).toContain("EVOLUTION_URL");
    const b = saidas();
    expect(await principal(["--todos"], { env: { EVOLUTION_URL: "https://evo.teste" }, ...semAcesso, saida: b.saida })).toBe(2);
    expect(b.err.join("")).toContain("API_URL_PUBLICA");
  });
});

describeComBanco("atualizarWebhooks — Postgres local e Evolution falsa", () => {
  const espacoPadrao = novoEspacoDeTeste("atualizarwebhook");
  let falso: ServidorFalso;
  const cliente = () => criarClienteDaEvolution({ url: falso.url, timeoutMs: 2_000 });
  const ambiente = () => ({ pool: pool(), chaves, cliente: cliente(), urlPublica: URL_PUBLICA });
  let sequencia = 0;

  /** Um Canal WhatsApp não oficial; `credencial` e `segredo` dizem o que o cofre tem dele. */
  const espacosExtras: string[] = [];
  /** Um Espaço só para o teste: o `--todos` olha o banco inteiro, e os Canais dos outros testes não podem entrar na fila da Evolution falsa. */
  const espacoNovo = (rotulo: string) => {
    const novo = novoEspacoDeTeste(rotulo);
    espacosExtras.push(novo);
    return novo;
  };

  async function canal(opcoes: { ws?: string; instancia?: string; credencial?: boolean; segredo?: boolean; simulado?: boolean; estado?: "ativo" | "arquivado" } = {}) {
    sequencia += 1;
    const ws = opcoes.ws ?? espacoPadrao;
    const id = await semearCanal(ws, {
      nome: `Canal ${sequencia}`,
      tipo: "whatsapp",
      provedor: "whatsapp-nao-oficial",
      identificadorExterno: `+55119777${String(sequencia).padStart(5, "0")}`,
      conexao: opcoes.estado === "arquivado" ? "desconectada" : "conectada",
      conexaoSimulada: opcoes.simulado ?? false,
    });
    // Um Canal arquivado é sempre desconectado (`canais_arquivado_desconectado_ck`).
    if (opcoes.estado === "arquivado") await pool().query("update plataforma.canais set estado = 'arquivado', arquivado_em = now() where workspace_id = $1 and id = $2", [ws, id]);
    const dono = { workspaceId: ws, donoTipo: "canal", donoId: id } as const;
    const instancia = opcoes.instancia ?? `inst-${sequencia}`;
    if (opcoes.credencial !== false) await guardarCredencial(pool(), chaves, { ...dono, tipo: "whatsapp-nao-oficial", segredo: JSON.stringify({ instancia, apikey: TOKEN }) });
    if (opcoes.segredo !== false) await guardarCredencial(pool(), chaves, { ...dono, tipo: TIPO_DO_SEGREDO_DO_WEBHOOK, segredo: SEGREDO });
    return { id, instancia };
  }

  beforeAll(async () => {
    await prepararBancoCrm();
  });
  beforeEach(async () => {
    falso = await criarServidorFalso();
  });
  afterEach(async () => {
    await falso.fechar();
  });
  afterAll(async () => {
    for (const espaco of [espacoPadrao, ...espacosExtras]) {
      await pool().query("delete from plataforma.credenciais where workspace_id = $1", [espaco]);
      await limparEspaco(espaco);
    }
    await encerrar();
  });

  it("--canal: reaplica o webhook da instância com o token dela, o endereço do Canal, o segredo do cofre e a lista atual de eventos", async () => {
    const c = await canal();
    falso.enfileirar({ kind: "ok", status: 201, corpo: { enabled: true } });
    const resumo = await atualizarWebhooks(ambiente(), { alvo: { tipo: "canal", canalId: c.id }, seco: false });

    expect(resumo.canais).toEqual([{ canalId: c.id, instancia: c.instancia, resultado: "atualizado" }]);
    expect(falso.recebidas).toHaveLength(1);
    expect(falso.recebidas[0]).toMatchObject({ metodo: "POST", caminho: `/webhook/set/${c.instancia}`, cabecalhos: { apikey: TOKEN } });
    expect(falso.recebidas[0]!.corpo).toEqual({
      webhook: {
        enabled: true,
        url: `${URL_PUBLICA}/webhooks/mensageria/${c.id}`,
        headers: { "x-n1-webhook-segredo": SEGREDO },
        byEvents: false,
        base64: false,
        events: ["MESSAGES_UPSERT", "CONNECTION_UPDATE", "MESSAGES_UPDATE", "MESSAGES_DELETE", "MESSAGES_EDITED"],
      },
    });
  });

  it("não troca o segredo do webhook nem escreve no banco: o cofre fica como estava", async () => {
    const c = await canal();
    const antes = await lerCredencial(pool(), chaves, { workspaceId: espacoPadrao, donoTipo: "canal", donoId: c.id, tipo: TIPO_DO_SEGREDO_DO_WEBHOOK });
    const linhasAntes = (await pool().query("select id, atualizado_em from plataforma.credenciais where workspace_id = $1 and dono_id = $2 order by id", [espacoPadrao, c.id])).rows;
    falso.enfileirar({ kind: "ok", status: 201, corpo: {} });
    await atualizarWebhooks(ambiente(), { alvo: { tipo: "canal", canalId: c.id }, seco: false });
    expect(await lerCredencial(pool(), chaves, { workspaceId: espacoPadrao, donoTipo: "canal", donoId: c.id, tipo: TIPO_DO_SEGREDO_DO_WEBHOOK })).toBe(antes);
    expect((await pool().query("select id, atualizado_em from plataforma.credenciais where workspace_id = $1 and dono_id = $2 order by id", [espacoPadrao, c.id])).rows).toEqual(linhasAntes);
  });

  it("--seco percorre o caminho e não chama a Evolution", async () => {
    const c = await canal();
    const resumo = await atualizarWebhooks(ambiente(), { alvo: { tipo: "canal", canalId: c.id }, seco: true });
    expect(resumo.canais).toEqual([{ canalId: c.id, instancia: c.instancia, resultado: "seco" }]);
    expect(falso.recebidas).toHaveLength(0);
  });

  it("--todos pega só o WhatsApp não oficial ativo e de verdade (o simulado e o arquivado ficam de fora) e --espaco limita a um Espaço", async () => {
    const espaco = espacoNovo("atualizarwebhooktodos");
    const outro = espacoNovo("atualizarwebhookoutro");
    const real = await canal({ ws: espaco });
    await canal({ ws: espaco, simulado: true });
    await canal({ ws: espaco, estado: "arquivado" });
    await canal({ ws: outro });
    falso.enfileirar({ kind: "ok", status: 201, corpo: {} });
    const resumo = await atualizarWebhooks(ambiente(), { alvo: { tipo: "todos", espacoId: espaco }, seco: false });
    expect(resumo.canais).toEqual([{ canalId: real.id, instancia: real.instancia, resultado: "atualizado" }]);
    expect(falso.recebidas).toHaveLength(1);
  });

  it("o Canal sem credencial da instância ou sem segredo do webhook é PULADO com o motivo, sem nenhuma chamada", async () => {
    const semCredencial = await canal({ credencial: false });
    const semSegredo = await canal({ segredo: false });
    const resumo = await atualizarWebhooks(ambiente(), { alvo: { tipo: "canal", canalId: semCredencial.id }, seco: false });
    expect(resumo.canais[0]).toMatchObject({ resultado: "pulado", motivo: expect.stringContaining("credencial") });
    const resumo2 = await atualizarWebhooks(ambiente(), { alvo: { tipo: "canal", canalId: semSegredo.id }, seco: false });
    expect(resumo2.canais[0]).toMatchObject({ resultado: "pulado", motivo: expect.stringContaining("segredo") });
    expect(falso.recebidas).toHaveLength(0);
  });

  it("a instância numeropvmarcos nunca é tocada, em qualquer grafia", async () => {
    const c = await canal({ instancia: "  NumeroPVMarcos " });
    const resumo = await atualizarWebhooks(ambiente(), { alvo: { tipo: "canal", canalId: c.id }, seco: false });
    expect(resumo.canais[0]).toMatchObject({ resultado: "pulado", motivo: expect.stringContaining("Financeiro") });
    expect(falso.recebidas).toHaveLength(0);
  });

  it("a Evolution que falha vira falhou naquele Canal e não derruba os outros; o comando sai com 1 e não mostra token nem segredo", async () => {
    const espaco = espacoNovo("atualizarwebhookfalha");
    const a = await canal({ ws: espaco });
    const b = await canal({ ws: espaco });
    falso.enfileirar({ kind: "ok", status: 500, corpo: { erro: "boom" } });
    falso.enfileirar({ kind: "ok", status: 201, corpo: {} });
    const resumo = await atualizarWebhooks(ambiente(), { alvo: { tipo: "todos", espacoId: espaco }, seco: false });
    expect(resumo.canais.map((r) => r.canalId).sort()).toEqual([a.id, b.id].sort());
    expect(resumo.canais.map((r) => r.resultado).sort()).toEqual(["atualizado", "falhou"]);
    expect(JSON.stringify(resumo)).not.toContain(TOKEN);
    expect(JSON.stringify(resumo)).not.toContain(SEGREDO);

    const saidas: string[] = [];
    const deps: DependenciasDoWebhook = {
      env: { EVOLUTION_URL: falso.url, API_URL_PUBLICA: URL_PUBLICA },
      pool: () => pool(),
      chaves: () => chaves,
      criarCliente: () => cliente(),
      saida: { out: (t) => saidas.push(t), err: (t) => saidas.push(t) },
    };
    falso.enfileirar({ kind: "ok", status: 500, corpo: {} });
    const c = await canal({ ws: espaco });
    expect(await principal(["--canal", c.id], deps)).toBe(1);
    const texto = saidas.join("\n");
    expect(texto).toContain("FALHOU");
    expect(texto).not.toContain(TOKEN);
    expect(texto).not.toContain(SEGREDO);
  });

  it("--canal que não existe, arquivado ou simulado é recusado (2), e a saída de sucesso não mostra token nem segredo", async () => {
    const saidas: string[] = [];
    const deps: DependenciasDoWebhook = {
      env: { EVOLUTION_URL: falso.url, API_URL_PUBLICA: URL_PUBLICA },
      pool: () => pool(),
      chaves: () => chaves,
      criarCliente: () => cliente(),
      saida: { out: (t) => saidas.push(t), err: (t) => saidas.push(t) },
    };
    expect(await principal(["--canal", "nao-existe"], deps)).toBe(2);
    const simulado = await canal({ simulado: true });
    expect(await principal(["--canal", simulado.id], deps)).toBe(2);

    const ok = await canal();
    falso.enfileirar({ kind: "ok", status: 201, corpo: {} });
    expect(await principal(["--canal", ok.id], deps)).toBe(0);
    const texto = saidas.join("\n");
    expect(texto).toContain("webhook atualizado");
    expect(texto).not.toContain(TOKEN);
    expect(texto).not.toContain(SEGREDO);
  });
});
