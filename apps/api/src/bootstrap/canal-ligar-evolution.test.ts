/**
 * `npm run canal:ligar-evolution -w @n1/api -- --canal <id> --instancia <nome>` (16-13, D-16-05, D-16-06, MSG-06).
 *
 * NUNCA fala com uma Evolution real nem com o banco do `.env`: a Evolution é o servidor HTTP falso de
 * `testes/servidor-falso.ts` e o banco é um Postgres 16 LOCAL (Docker, porta 55728). O ambiente do comando é um
 * objeto de teste passado em `deps.env`, nunca `process.env`. Nenhum teste configura webhook nem guarda credencial da
 * instância `numeropvmarcos` (a do `automation/`).
 *
 *   DATABASE_URL=postgres://postgres:x@localhost:55728/postgres \
 *   DATABASE_URL_MIGRACAO=postgres://postgres:x@localhost:55728/postgres npx vitest run src/bootstrap/canal-ligar-evolution.test.ts
 */

import { randomBytes } from "node:crypto";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { criarClienteDaEvolution } from "../mensageria/provedores/evolution/cliente";
import { TIPO_DO_SEGREDO_DO_WEBHOOK } from "../mensageria/provedor";
import { encerrar, pool } from "../persistencia/conexao";
import { lerCredencial, type ChavesDoCofre } from "../servicos/cofre";
import { criarServidorFalso, type ServidorFalso } from "../testes/servidor-falso";
import { describeComBanco, limparEspaco, novoEspacoDeTeste, prepararBancoCrm, semearCanal } from "../testes/banco-crm";
import { ligarCanalAEvolution, lerArgumentos, principal, RecusaDaLigacao, USO, type DependenciasDaLigacao } from "./canal-ligar-evolution";

const chaves: ChavesDoCofre = { atual: { versao: 1, chave: randomBytes(32) } };
const CHAVE_GLOBAL = "chave-global-secreta-da-evolution";
const TOKEN_DA_INSTANCIA = "tok-inst-secreto";
const INSTANCIA = "inst-teste";
const URL_PUBLICA = "https://api.n1.teste";
const NUMERO_DO_CANAL = "+5511987654321";

const FRASE_DA_NUMEROPVMARCOS =
  "A instância numeropvmarcos é do automation/ (extratos e avisos do Financeiro) e não pode ser ligada a um Canal.";

describe("lerArgumentos — sem banco", () => {
  it("aceita --x valor e --x=valor, e --seco e --url-publica", () => {
    expect(lerArgumentos(["--canal", "c1", "--instancia", INSTANCIA])).toEqual({ canalId: "c1", instancia: INSTANCIA, seco: false });
    expect(lerArgumentos(["--canal=c1", "--instancia=" + INSTANCIA, "--seco", "--url-publica=https://a.teste"])).toEqual({
      canalId: "c1",
      instancia: INSTANCIA,
      seco: true,
      urlPublica: "https://a.teste",
    });
  });

  it("recusa argumento ausente, sem valor, repetido ou desconhecido", () => {
    expect(() => lerArgumentos([])).toThrow(RecusaDaLigacao);
    expect(() => lerArgumentos(["--canal", "c1"])).toThrow(RecusaDaLigacao);
    expect(() => lerArgumentos(["--instancia", INSTANCIA])).toThrow(RecusaDaLigacao);
    expect(() => lerArgumentos(["--canal", "--instancia", INSTANCIA])).toThrow(RecusaDaLigacao);
    expect(() => lerArgumentos(["--canal", "a", "--canal", "b", "--instancia", INSTANCIA])).toThrow(RecusaDaLigacao);
    expect(() => lerArgumentos(["--canal", "a", "--instancia", INSTANCIA, "--seco", "--seco"])).toThrow(RecusaDaLigacao);
    expect(() => lerArgumentos(["--canal", "a", "--instancia", INSTANCIA, "--outro"])).toThrow(RecusaDaLigacao);
    expect(() => lerArgumentos(["abc"])).toThrow(RecusaDaLigacao);
  });

  it.each(["numeropvmarcos", " NumeroPvMarcos ", "NUMEROPVMARCOS"])("recusa a instância do Financeiro (%j) com a frase pronta", (nome) => {
    expect(() => lerArgumentos(["--canal", "c1", "--instancia", nome])).toThrow(FRASE_DA_NUMEROPVMARCOS);
    expect(() => lerArgumentos([`--instancia=${nome}`, "--canal=c1"])).toThrow(FRASE_DA_NUMEROPVMARCOS);
  });
});

function ambiente(extra: Record<string, string | undefined> = {}, falso?: ServidorFalso): Record<string, string | undefined> {
  return {
    EVOLUTION_URL: falso?.url ?? "http://127.0.0.1:1",
    EVOLUTION_API_KEY: CHAVE_GLOBAL,
    API_URL_PUBLICA: URL_PUBLICA,
    ...extra,
  };
}

function execucao(env: Record<string, string | undefined>) {
  const out: string[] = [];
  const err: string[] = [];
  const deps: DependenciasDaLigacao = {
    env,
    pool: () => pool(),
    chaves: () => chaves,
    criarCliente: (url) => criarClienteDaEvolution({ url }),
    saida: { out: (t) => out.push(t), err: (t) => err.push(t) },
  };
  return { deps, out, err, saidaCompleta: () => [...out, ...err].join("\n") };
}

describeComBanco("canal:ligar-evolution — Postgres local e Evolution falsa", () => {
  const espacos: string[] = [];
  let falso: ServidorFalso;

  async function espacoComCanal(
    rotulo: string,
    opcoes: { identificador?: string; mensagemPendente?: boolean; provedor?: string; arquivado?: boolean; conexaoSimulada?: boolean } = {},
  ) {
    const ws = novoEspacoDeTeste(rotulo);
    espacos.push(ws);
    await pool().query("insert into plataforma.workspaces (workspace_id) values ($1)", [ws]);
    const canalId = await semearCanal(ws, {
      nome: "WhatsApp da Evolution",
      tipo: "whatsapp",
      provedor: opcoes.provedor ?? "whatsapp-nao-oficial",
      identificadorExterno: opcoes.identificador ?? NUMERO_DO_CANAL,
      conexao: opcoes.conexaoSimulada ? "conectada" : "desconectada",
      conexaoSimulada: opcoes.conexaoSimulada ?? false,
    });
    if (opcoes.arquivado) {
      await pool().query(
        "update plataforma.canais set estado = 'arquivado', arquivado_em = now(), conexao = 'desconectada', conexao_simulada = false where workspace_id = $1 and id = $2",
        [ws, canalId],
      );
    }
    let mensagemId: string | undefined;
    if (opcoes.mensagemPendente) {
      const contato = await pool().query<{ id: string }>(
        "insert into plataforma.contatos (workspace_id, nome, proprietario_id, criado_por) values ($1, 'Ana', 'mem_teste', 'mem_teste') returning id",
        [ws],
      );
      const conversa = await pool().query<{ id: string }>(
        `insert into plataforma.conversas (workspace_id, canal_id, contato_id, titulo, situacao, criado_por_tipo, criado_por_id)
         values ($1, $2, $3, 'Conversa', 'aberta', 'system', 'sistema') returning id`,
        [ws, canalId, contato.rows[0]!.id],
      );
      const mensagem = await pool().query<{ id: string }>(
        `insert into plataforma.mensagens (workspace_id, conversa_id, canal_id, direcao, ator_tipo, ator_id, conteudo, status_entrega)
         values ($1, $2, $3, 'enviada', 'system', 'sistema', 'escrita com o Canal fora do ar', 'pendente') returning id`,
        [ws, conversa.rows[0]!.id, canalId],
      );
      mensagemId = mensagem.rows[0]!.id;
    }
    return { ws, canalId, mensagemId };
  }

  /** As três respostas de uma instância aberta e de um webhook aceito, na ordem em que o comando pergunta. */
  function programarInstanciaAberta(opcoes: { ownerJid?: string | null; token?: string | null; estado?: string } = {}) {
    falso.enfileirar({
      kind: "ok",
      status: 200,
      corpo: [
        {
          name: INSTANCIA,
          ownerJid: opcoes.ownerJid === undefined ? "5511987654321@s.whatsapp.net" : opcoes.ownerJid,
          token: opcoes.token === undefined ? TOKEN_DA_INSTANCIA : opcoes.token,
          connectionStatus: "open",
        },
      ],
    });
    falso.enfileirar({ kind: "ok", status: 200, corpo: { instance: { instanceName: INSTANCIA, state: opcoes.estado ?? "open" } } });
    falso.enfileirar({ kind: "ok", status: 201, corpo: { webhook: { enabled: true } } });
  }

  beforeAll(async () => {
    await prepararBancoCrm();
  });

  // Um servidor falso por teste: uma resposta programada que sobra não contamina o teste seguinte.
  beforeEach(async () => {
    falso = await criarServidorFalso();
  });

  afterEach(async () => {
    await falso.fechar();
  });

  afterAll(async () => {
    for (const ws of espacos) {
      await pool().query("delete from plataforma.integration_outbox where workspace_id = $1", [ws]);
      await pool().query("delete from plataforma.credenciais where workspace_id = $1", [ws]);
      await limparEspaco(ws);
    }
    await encerrar();
  });

  const credenciaisDoCanal = async (ws: string, canalId: string) =>
    (
      await pool().query<{ tipo: string; ativas: number; total: number }>(
        `select tipo, count(*) filter (where revogado_em is null)::int as ativas, count(*)::int as total
           from plataforma.credenciais where workspace_id = $1 and dono_tipo = 'canal' and dono_id = $2 group by tipo order by tipo`,
        [ws, canalId],
      )
    ).rows;

  const estadoDoCanal = async (ws: string, canalId: string) =>
    (
      await pool().query<{ conexao: string; conexao_simulada: boolean }>(
        "select conexao, conexao_simulada from plataforma.canais where workspace_id = $1 and id = $2",
        [ws, canalId],
      )
    ).rows[0]!;

  /** Nenhuma saída do comando mostra a chave global, o token da instância nem um segredo de 64 hex (T-16-50). */
  const semSegredos = (e: { saidaCompleta(): string }) => {
    expect(e.saidaCompleta()).not.toContain(CHAVE_GLOBAL);
    expect(e.saidaCompleta()).not.toContain(TOKEN_DA_INSTANCIA);
    expect(e.saidaCompleta()).not.toMatch(/[0-9a-f]{64}/);
  };

  it("liga o Canal à instância: webhook com o segredo, cofre com o token, Canal conectada de verdade e pendente reenfileirada", async () => {
    const { ws, canalId, mensagemId } = await espacoComCanal("ligar", { mensagemPendente: true });
    const antes = falso.recebidas.length;
    programarInstanciaAberta();
    const e = execucao(ambiente({}, falso));

    expect(await principal(["--canal", canalId, "--instancia", INSTANCIA], e.deps)).toBe(0);

    const pedidos = falso.recebidas.slice(antes);
    expect(pedidos.map((p) => `${p.metodo} ${p.caminho}`)).toEqual([
      `GET /instance/fetchInstances?instanceName=${INSTANCIA}`,
      `GET /instance/connectionState/${INSTANCIA}`,
      `POST /webhook/set/${INSTANCIA}`,
    ]);
    // A chave global só lê a instância; o resto usa o token da própria instância.
    expect(pedidos[0]!.cabecalhos.apikey).toBe(CHAVE_GLOBAL);
    expect(pedidos[1]!.cabecalhos.apikey).toBe(TOKEN_DA_INSTANCIA);
    expect(pedidos[2]!.cabecalhos.apikey).toBe(TOKEN_DA_INSTANCIA);
    const webhook = (pedidos[2]!.corpo as { webhook: { url: string; headers: Record<string, string> } }).webhook;
    expect(webhook.url).toBe(`${URL_PUBLICA}/webhooks/mensageria/${canalId}`);
    const segredoEnviado = webhook.headers["x-n1-webhook-segredo"]!;
    expect(segredoEnviado).toMatch(/^[0-9a-f]{64}$/);

    const dono = { workspaceId: ws, donoTipo: "canal", donoId: canalId } as const;
    expect(await lerCredencial(pool(), chaves, { ...dono, tipo: TIPO_DO_SEGREDO_DO_WEBHOOK })).toBe(segredoEnviado);
    const credencial = await lerCredencial(pool(), chaves, { ...dono, tipo: "whatsapp-nao-oficial" });
    expect(JSON.parse(credencial!)).toEqual({ instancia: INSTANCIA, apikey: TOKEN_DA_INSTANCIA });

    const canal = (
      await pool().query<{ conexao: string; conexao_simulada: boolean; conectada_em: Date | null }>(
        "select conexao, conexao_simulada, conectada_em from plataforma.canais where workspace_id = $1 and id = $2",
        [ws, canalId],
      )
    ).rows[0]!;
    expect(canal).toMatchObject({ conexao: "conectada", conexao_simulada: false });
    expect(canal.conectada_em).not.toBeNull();

    const revisao = (await pool().query<{ revisao: string }>("select revisao from plataforma.workspaces where workspace_id = $1", [ws])).rows[0]!;
    expect(Number(revisao.revisao)).toBe(2);

    const fila = await pool().query<{ event_type: string; status: string }>(
      "select event_type, status from plataforma.integration_outbox where workspace_id = $1 and aggregate_id = $2",
      [ws, mensagemId],
    );
    expect(fila.rows).toEqual([{ event_type: "mensagem.enviar.v1", status: "pending" }]);

    const saida = e.saidaCompleta();
    expect(saida).toContain("WhatsApp da Evolution");
    expect(saida).toContain(ws);
    expect(saida).toContain(INSTANCIA);
    expect(saida).toContain("4321");
    expect(saida).not.toContain(TOKEN_DA_INSTANCIA);
    expect(saida).not.toContain(CHAVE_GLOBAL);
    expect(saida).not.toContain(segredoEnviado);
    expect(saida).not.toContain("5511987654321");
  });

  describe("a instância do Financeiro", () => {
    it.each(["numeropvmarcos", " NumeroPvMarcos "])("%j sai com 2 e a frase pronta, sem pedir banco nem falar com a Evolution", async (nome) => {
      const e = execucao(ambiente({}, falso));
      let pediuBanco = false;
      const deps: DependenciasDaLigacao = {
        ...e.deps,
        pool: () => {
          pediuBanco = true;
          return pool();
        },
        chaves: () => {
          pediuBanco = true;
          return chaves;
        },
      };
      expect(await principal(["--canal", "qualquer", "--instancia", nome], deps)).toBe(2);
      expect(e.err.join("\n")).toContain(FRASE_DA_NUMEROPVMARCOS);
      expect(pediuBanco).toBe(false);
      expect(falso.recebidas).toHaveLength(0);
      semSegredos(e);
    });

    it("--instancia=numeropvmarcos, mesmo com --seco, sai com 2 e não fala com a Evolution", async () => {
      const e = execucao(ambiente({}, falso));
      expect(await principal(["--seco", "--instancia=numeropvmarcos", "--canal=qualquer"], e.deps)).toBe(2);
      expect(e.err.join("\n")).toContain(FRASE_DA_NUMEROPVMARCOS);
      expect(falso.recebidas).toHaveLength(0);
    });
  });

  it("quem chama ligarCanalAEvolution direto também não liga a instância do Financeiro: recusa antes de pedir conexão ou rede", async () => {
    let pediu = false;
    const alvo = ligarCanalAEvolution(
      {
        pool: {
          connect: (() => {
            pediu = true;
            return pool().connect();
          }) as ReturnType<DependenciasDaLigacao["pool"]>["connect"],
        },
        chaves,
        cliente: criarClienteDaEvolution({ url: falso.url }),
        apikeyGlobal: CHAVE_GLOBAL,
        urlPublica: URL_PUBLICA,
      },
      { canalId: "qualquer", instancia: " NUMEROPVMARCOS ", seco: false },
    );
    await expect(alvo).rejects.toThrow(FRASE_DA_NUMEROPVMARCOS);
    expect(pediu).toBe(false);
    expect(falso.recebidas).toHaveLength(0);
  });

  describe("recusas do Canal, antes de falar com a Evolution", () => {
    it("Canal de outro provedor: 2, nada gravado, nenhum pedido à Evolution", async () => {
      const { ws, canalId } = await espacoComCanal("outroprov", { provedor: "whatsapp-cloud" });
      const e = execucao(ambiente({}, falso));
      expect(await principal(["--canal", canalId, "--instancia", INSTANCIA], e.deps)).toBe(2);
      expect(e.err.join("\n")).toContain("só liga Canal do provedor whatsapp-nao-oficial");
      expect(falso.recebidas).toHaveLength(0);
      expect(await credenciaisDoCanal(ws, canalId)).toEqual([]);
      expect(await estadoDoCanal(ws, canalId)).toEqual({ conexao: "desconectada", conexao_simulada: false });
    });

    it("Canal arquivado: 2 e nada gravado", async () => {
      const { ws, canalId } = await espacoComCanal("arquivado", { arquivado: true });
      const e = execucao(ambiente({}, falso));
      expect(await principal(["--canal", canalId, "--instancia", INSTANCIA], e.deps)).toBe(2);
      expect(e.err.join("\n")).toContain("arquivado");
      expect(falso.recebidas).toHaveLength(0);
      expect(await credenciaisDoCanal(ws, canalId)).toEqual([]);
    });

    it("Canal inexistente: 2 com \"Canal não encontrado.\"", async () => {
      const e = execucao(ambiente({}, falso));
      expect(await principal(["--canal", "canal-que-nao-existe", "--instancia", INSTANCIA], e.deps)).toBe(2);
      expect(e.err.join("\n")).toContain("Canal não encontrado.");
      expect(falso.recebidas).toHaveLength(0);
    });
  });

  describe("recusas da instância, antes do webhook", () => {
    it("instância que não existe (404 e lista vazia): 2 com a frase pronta e nada gravado", async () => {
      const { ws, canalId } = await espacoComCanal("semInstancia");
      for (const resposta of [{ status: 404, corpo: { message: "not found" } }, { status: 200, corpo: [] }]) {
        falso.enfileirar({ kind: "ok", ...resposta });
        const e = execucao(ambiente({}, falso));
        expect(await principal(["--canal", canalId, "--instancia", INSTANCIA], e.deps)).toBe(2);
        expect(e.err.join("\n")).toContain(`A instância ${INSTANCIA} não existe nesta Evolution.`);
        semSegredos(e);
      }
      expect(falso.recebidas.every((p) => !p.caminho.startsWith("/webhook/set"))).toBe(true);
      expect(await credenciaisDoCanal(ws, canalId)).toEqual([]);
    });

    it("connectionState close: 2 com a frase pronta, sem webhook/set e Canal intacto", async () => {
      const { ws, canalId } = await espacoComCanal("fechada");
      programarInstanciaAberta({ estado: "close" });
      const e = execucao(ambiente({}, falso));
      expect(await principal(["--canal", canalId, "--instancia", INSTANCIA], e.deps)).toBe(2);
      expect(e.err.join("\n")).toContain("A instância não está conectada ao WhatsApp. Conecte o número na Evolution e rode de novo.");
      expect(falso.recebidas.map((p) => p.metodo + " " + p.caminho.split("/").slice(0, 3).join("/"))).toEqual([
        "GET /instance/fetchInstances?instanceName=" + INSTANCIA,
        "GET /instance/connectionState",
      ]);
      expect(await credenciaisDoCanal(ws, canalId)).toEqual([]);
      expect(await estadoDoCanal(ws, canalId)).toEqual({ conexao: "desconectada", conexao_simulada: false });
      semSegredos(e);
    });

    it("token nulo: 2 explicando que só o token da instância vai ao cofre; a chave global não é usada no lugar", async () => {
      const { ws, canalId } = await espacoComCanal("semtoken");
      programarInstanciaAberta({ token: null });
      const e = execucao(ambiente({}, falso));
      expect(await principal(["--canal", canalId, "--instancia", INSTANCIA], e.deps)).toBe(2);
      expect(e.err.join("\n")).toContain("não devolveu o token da instância");
      expect(e.err.join("\n")).toContain("decisão do dono");
      expect(falso.recebidas).toHaveLength(1);
      expect(await credenciaisDoCanal(ws, canalId)).toEqual([]);
      semSegredos(e);
    });

    it("ownerJid de outro número: 2 com a frase pronta (só os finais) e nenhum webhook/set", async () => {
      const { ws, canalId } = await espacoComCanal("outronumero");
      programarInstanciaAberta({ ownerJid: "5511999998888@s.whatsapp.net" });
      const e = execucao(ambiente({}, falso));
      expect(await principal(["--canal", canalId, "--instancia", INSTANCIA], e.deps)).toBe(2);
      expect(e.err.join("\n")).toContain("O número conectado na instância (final 8888) não é o deste Canal (final 4321).");
      expect(e.saidaCompleta()).not.toContain("5511999998888");
      expect(falso.recebidas.some((p) => p.caminho.startsWith("/webhook/set"))).toBe(false);
      expect(await credenciaisDoCanal(ws, canalId)).toEqual([]);
      expect(await estadoDoCanal(ws, canalId)).toEqual({ conexao: "desconectada", conexao_simulada: false });
      semSegredos(e);
    });

    it("ownerJid ausente: 2, não dá para conferir o número", async () => {
      const { canalId } = await espacoComCanal("semowner");
      programarInstanciaAberta({ ownerJid: null });
      const e = execucao(ambiente({}, falso));
      expect(await principal(["--canal", canalId, "--instancia", INSTANCIA], e.deps)).toBe(2);
      expect(e.err.join("\n")).toContain("não informou o número conectado");
      expect(falso.recebidas.some((p) => p.caminho.startsWith("/webhook/set"))).toBe(false);
    });

    it("o número sem o nono dígito é o mesmo número: liga", async () => {
      const { ws, canalId } = await espacoComCanal("semnono");
      programarInstanciaAberta({ ownerJid: "551187654321@s.whatsapp.net" });
      const e = execucao(ambiente({}, falso));
      expect(await principal(["--canal", canalId, "--instancia", INSTANCIA], e.deps)).toBe(0);
      expect(await estadoDoCanal(ws, canalId)).toEqual({ conexao: "conectada", conexao_simulada: false });
    });
  });

  describe("falhas no meio", () => {
    it("webhook/set respondendo 500: sai com 1, o Canal continua desconectada e o cofre sem credencial", async () => {
      const { ws, canalId } = await espacoComCanal("webhook500");
      // A terceira resposta programada (webhook/set 201) é trocada por um 500 que ecoa o token, como a Evolution real faz.
      falso.enfileirar({ kind: "ok", status: 200, corpo: [{ name: INSTANCIA, ownerJid: "5511987654321@s.whatsapp.net", token: TOKEN_DA_INSTANCIA, connectionStatus: "open" }] });
      falso.enfileirar({ kind: "ok", status: 200, corpo: { instance: { state: "open" } } });
      falso.enfileirar({ kind: "ok", status: 500, corpo: { message: `eco do cabeçalho apikey ${TOKEN_DA_INSTANCIA}` } });
      const e = execucao(ambiente({}, falso));
      expect(await principal(["--canal", canalId, "--instancia", INSTANCIA], e.deps)).toBe(1);
      expect(e.err.join("\n")).toContain("A Evolution recusou a chamada.");
      semSegredos(e);
      expect(falso.recebidas.some((p) => p.caminho === `/webhook/set/${INSTANCIA}`)).toBe(true);
      expect(await credenciaisDoCanal(ws, canalId)).toEqual([]);
      expect(await estadoDoCanal(ws, canalId)).toEqual({ conexao: "desconectada", conexao_simulada: false });
    });

    it("o banco falha depois do webhook/set: sai com 1 dizendo que a instância recebe 401 até rodar de novo, e nada é gravado", async () => {
      const { ws, canalId } = await espacoComCanal("bancocai");
      programarInstanciaAberta();
      const e = execucao(ambiente({}, falso));
      let conexoes = 0;
      const deps: DependenciasDaLigacao = {
        ...e.deps,
        // A primeira conexão lê o Canal; a segunda, da transação da ligação, falha.
        pool: () => ({
          connect: (() => {
            conexoes += 1;
            return conexoes === 1 ? pool().connect() : Promise.reject(new Error("banco fora do ar"));
          }) as ReturnType<DependenciasDaLigacao["pool"]>["connect"],
        }),
      };
      expect(await principal(["--canal", canalId, "--instancia", INSTANCIA], deps)).toBe(1);
      expect(e.err.join("\n")).toContain("recebem 401 até você rodar o comando de novo");
      expect(falso.recebidas.some((p) => p.caminho.startsWith("/webhook/set"))).toBe(true);
      expect(await credenciaisDoCanal(ws, canalId)).toEqual([]);
      expect(await estadoDoCanal(ws, canalId)).toEqual({ conexao: "desconectada", conexao_simulada: false });
      semSegredos(e);
    });

    it("sem COFRE_CHAVE sai com 1 ANTES de falar com a Evolution: o webhook nem chega a mudar", async () => {
      const { ws, canalId } = await espacoComCanal("semcofre");
      const e = execucao(ambiente({}, falso));
      const deps: DependenciasDaLigacao = {
        ...e.deps,
        chaves: () => {
          throw new Error("COFRE_CHAVE não está configurada.");
        },
      };
      expect(await principal(["--canal", canalId, "--instancia", INSTANCIA], deps)).toBe(1);
      expect(e.err.join("\n")).toContain("COFRE_CHAVE não está configurada.");
      expect(falso.recebidas).toHaveLength(0);
      expect(await credenciaisDoCanal(ws, canalId)).toEqual([]);
    });
  });

  describe("--seco", () => {
    it("mostra versão, estado, número que confere (só o final) e a URL do webhook; só lê, não escreve na Evolution nem no banco", async () => {
      const { ws, canalId, mensagemId } = await espacoComCanal("seco", { mensagemPendente: true });
      falso.enfileirar({ kind: "ok", status: 200, corpo: { status: 200, version: "2.3.7" } });
      programarInstanciaAberta();
      const e = execucao(ambiente({}, falso));
      // Sem COFRE_CHAVE: o --seco não escreve no cofre e não precisa dela.
      const deps: DependenciasDaLigacao = {
        ...e.deps,
        chaves: () => {
          throw new Error("o --seco não devia pedir a chave do cofre");
        },
      };

      expect(await principal(["--canal", canalId, "--instancia", INSTANCIA, "--seco"], deps)).toBe(0);

      expect(falso.recebidas.map((p) => `${p.metodo} ${p.caminho.split("/").slice(0, 3).join("/")}`)).toEqual([
        "GET /",
        "GET /instance/fetchInstances?instanceName=" + INSTANCIA,
        "GET /instance/connectionState",
      ]);
      const saida = e.out.join("\n");
      expect(saida).toContain("2.3.7");
      expect(saida).toContain("open");
      expect(saida).toContain("final 4321, confere");
      expect(saida).toContain(`${URL_PUBLICA}/webhooks/mensageria/${canalId}`);
      expect(saida).not.toContain("5511987654321");
      semSegredos(e);

      expect(await credenciaisDoCanal(ws, canalId)).toEqual([]);
      expect(await estadoDoCanal(ws, canalId)).toEqual({ conexao: "desconectada", conexao_simulada: false });
      const revisao = (await pool().query<{ revisao: string }>("select revisao from plataforma.workspaces where workspace_id = $1", [ws])).rows[0]!;
      expect(Number(revisao.revisao)).toBe(1);
      const fila = await pool().query("select 1 from plataforma.integration_outbox where workspace_id = $1 and aggregate_id = $2", [ws, mensagemId]);
      expect(fila.rowCount).toBe(0);
    });

    it("com o número de outro Canal recusa como o comando de verdade (2)", async () => {
      const { canalId } = await espacoComCanal("secooutro");
      falso.enfileirar({ kind: "ok", status: 200, corpo: { version: "2.3.7" } });
      programarInstanciaAberta({ ownerJid: "5511999998888@s.whatsapp.net" });
      const e = execucao(ambiente({}, falso));
      expect(await principal(["--canal", canalId, "--instancia", INSTANCIA, "--seco"], e.deps)).toBe(2);
      expect(e.err.join("\n")).toContain("final 8888");
    });
  });

  describe("variáveis de ambiente e URL pública", () => {
    it.each([
      ["EVOLUTION_URL", { EVOLUTION_URL: undefined }],
      ["EVOLUTION_API_KEY", { EVOLUTION_API_KEY: "  " }],
      ["API_URL_PUBLICA", { API_URL_PUBLICA: undefined }],
    ])("sem %s sai com 2 nomeando a variável, sem pedir banco nem falar com a Evolution", async (variavel, extra) => {
      const e = execucao(ambiente(extra, falso));
      let pediuBanco = false;
      const deps: DependenciasDaLigacao = {
        ...e.deps,
        pool: () => {
          pediuBanco = true;
          return pool();
        },
      };
      expect(await principal(["--canal", "c1", "--instancia", INSTANCIA], deps)).toBe(2);
      expect(e.err.join("\n")).toContain(variavel);
      expect(pediuBanco).toBe(false);
      expect(falso.recebidas).toHaveLength(0);
    });

    it("URL pública que não é http(s) ou traz usuário ou query é recusada com 2", async () => {
      for (const url of ["ftp://api.n1.teste", "https://u:p@api.n1.teste", "https://api.n1.teste/?x=1", "api.n1.teste"]) {
        const e = execucao(ambiente({ API_URL_PUBLICA: url }, falso));
        expect(await principal(["--canal", "c1", "--instancia", INSTANCIA], e.deps)).toBe(2);
        expect(e.err.join("\n")).toContain("API_URL_PUBLICA");
      }
      expect(falso.recebidas).toHaveLength(0);
    });

    it("--url-publica vale no lugar de API_URL_PUBLICA, e a barra final não duplica", async () => {
      const { canalId } = await espacoComCanal("urlflag");
      falso.enfileirar({ kind: "ok", status: 200, corpo: { version: "2.3.7" } });
      programarInstanciaAberta();
      const e = execucao(ambiente({ API_URL_PUBLICA: undefined }, falso));
      expect(await principal(["--canal", canalId, "--instancia", INSTANCIA, "--seco", "--url-publica", "https://outra.n1.teste/"], e.deps)).toBe(0);
      expect(e.out.join("\n")).toContain(`https://outra.n1.teste/webhooks/mensageria/${canalId}`);
    });

    it("erro de uso mostra o USO e sai com 2 sem pedir ambiente", async () => {
      const e = execucao({});
      expect(await principal(["--desconhecido"], e.deps)).toBe(2);
      expect(e.err.join("\n")).toContain(USO);
    });
  });

  describe("rodar de novo", () => {
    it("troca o segredo, revoga o anterior, reaponta o webhook e mantém o Canal conectada", async () => {
      const { ws, canalId } = await espacoComCanal("duasvezes");
      const segredos: string[] = [];
      for (let i = 0; i < 2; i += 1) {
        programarInstanciaAberta();
        const e = execucao(ambiente({}, falso));
        expect(await principal(["--canal", canalId, "--instancia", INSTANCIA], e.deps)).toBe(0);
        const webhook = falso.recebidas.filter((p) => p.caminho.startsWith("/webhook/set")).at(-1)!;
        segredos.push((webhook.corpo as { webhook: { headers: Record<string, string> } }).webhook.headers["x-n1-webhook-segredo"]!);
      }
      expect(segredos[0]).not.toBe(segredos[1]);
      const guardado = await lerCredencial(pool(), chaves, { workspaceId: ws, donoTipo: "canal", donoId: canalId, tipo: TIPO_DO_SEGREDO_DO_WEBHOOK });
      expect(guardado).toBe(segredos[1]);
      expect(await credenciaisDoCanal(ws, canalId)).toEqual([
        { tipo: "webhook_segredo", ativas: 1, total: 2 },
        { tipo: "whatsapp-nao-oficial", ativas: 1, total: 2 },
      ]);
      expect(await estadoDoCanal(ws, canalId)).toEqual({ conexao: "conectada", conexao_simulada: false });
    });

    it("um Canal simulado que a Evolution confirma deixa de ser simulado", async () => {
      const { ws, canalId } = await espacoComCanal("simulado", { conexaoSimulada: true });
      expect(await estadoDoCanal(ws, canalId)).toEqual({ conexao: "conectada", conexao_simulada: true });
      programarInstanciaAberta();
      const e = execucao(ambiente({}, falso));
      expect(await principal(["--canal", canalId, "--instancia", INSTANCIA], e.deps)).toBe(0);
      expect(await estadoDoCanal(ws, canalId)).toEqual({ conexao: "conectada", conexao_simulada: false });
    });
  });
});
