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
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { criarClienteDaEvolution } from "../mensageria/provedores/evolution/cliente";
import { TIPO_DO_SEGREDO_DO_WEBHOOK } from "../mensageria/provedor";
import { encerrar, pool } from "../persistencia/conexao";
import { lerCredencial, type ChavesDoCofre } from "../servicos/cofre";
import { criarServidorFalso, type ServidorFalso } from "../testes/servidor-falso";
import { describeComBanco, limparEspaco, novoEspacoDeTeste, prepararBancoCrm, semearCanal } from "../testes/banco-crm";
import { lerArgumentos, principal, RecusaDaLigacao, type DependenciasDaLigacao } from "./canal-ligar-evolution";

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

  async function espacoComCanal(rotulo: string, opcoes: { identificador?: string; mensagemPendente?: boolean } = {}) {
    const ws = novoEspacoDeTeste(rotulo);
    espacos.push(ws);
    await pool().query("insert into plataforma.workspaces (workspace_id) values ($1)", [ws]);
    const canalId = await semearCanal(ws, {
      nome: "WhatsApp da Evolution",
      tipo: "whatsapp",
      provedor: "whatsapp-nao-oficial",
      identificadorExterno: opcoes.identificador ?? NUMERO_DO_CANAL,
      conexao: "desconectada",
    });
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
    falso = await criarServidorFalso();
  });

  afterAll(async () => {
    for (const ws of espacos) {
      await pool().query("delete from plataforma.integration_outbox where workspace_id = $1", [ws]);
      await pool().query("delete from plataforma.credenciais where workspace_id = $1", [ws]);
      await limparEspaco(ws);
    }
    await falso.fechar();
    await encerrar();
  });

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
});
