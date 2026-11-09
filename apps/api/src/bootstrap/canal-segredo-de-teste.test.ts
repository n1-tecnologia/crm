/**
 * `npm run canal:segredo-de-teste -w @n1/api -- --canal <id>` (16-02, D-16-03): gera o segredo do
 * webhook de um Canal SIMULADO, guarda no cofre (revogando o anterior) e o mostra uma vez; recusa
 * Canal real.
 *
 * Só Postgres LOCAL (Docker, porta 55717); as chaves do cofre são geradas aqui, nunca vêm do `.env`:
 *
 *   DATABASE_URL=postgres://postgres:x@localhost:55717/postgres \
 *   DATABASE_URL_MIGRACAO=postgres://postgres:x@localhost:55717/postgres npx vitest run src/bootstrap/canal-segredo-de-teste.test.ts
 */

import { randomBytes } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { encerrar, pool } from "../persistencia/conexao";
import { lerCredencial, type ChavesDoCofre } from "../servicos/cofre";
import { describeComBanco, limparEspaco, novoEspacoDeTeste, prepararBancoCrm, semearCanal } from "../testes/banco-crm";
import { CABECALHO_DO_SEGREDO, TIPO_DO_SEGREDO_DO_WEBHOOK } from "../mensageria/provedor";
import { lerArgumentos, principal, RecusaDoSegredo, USO, type DependenciasDoSegredo } from "./canal-segredo-de-teste";

const chaves: ChavesDoCofre = { atual: { versao: 1, chave: randomBytes(32) } };

function execucao() {
  const out: string[] = [];
  const err: string[] = [];
  const deps: DependenciasDoSegredo = {
    pool: () => pool(),
    chaves: () => chaves,
    saida: { out: (t) => out.push(t), err: (t) => err.push(t) },
  };
  return { deps, out, err, saidaCompleta: () => [...out, ...err].join("\n") };
}

describe("lerArgumentos — sem banco", () => {
  it("aceita --canal x e --canal=x", () => {
    expect(lerArgumentos(["--canal", "abc"])).toEqual({ canal: "abc" });
    expect(lerArgumentos(["--canal=abc"])).toEqual({ canal: "abc" });
  });

  it("recusa argumento ausente, sem valor, duplicado ou desconhecido", () => {
    expect(() => lerArgumentos([])).toThrow(RecusaDoSegredo);
    expect(() => lerArgumentos(["--canal"])).toThrow(RecusaDoSegredo);
    expect(() => lerArgumentos(["--canal", "--outro"])).toThrow(RecusaDoSegredo);
    expect(() => lerArgumentos(["--canal", "a", "--canal", "b"])).toThrow(RecusaDoSegredo);
    expect(() => lerArgumentos(["--canal=a", "--canal=b"])).toThrow(RecusaDoSegredo);
    expect(() => lerArgumentos(["--canal", "a", "--seco"])).toThrow(RecusaDoSegredo);
    expect(() => lerArgumentos(["abc"])).toThrow(RecusaDoSegredo);
    expect(() => lerArgumentos(["--canal="])).toThrow(RecusaDoSegredo);
  });
});

describe("principal: erro de uso — sem banco", () => {
  it("argumento errado sai com 2, mostra o USO e nem pede o pool nem as chaves", async () => {
    const e = execucao();
    let pediu = false;
    const deps: DependenciasDoSegredo = {
      ...e.deps,
      pool: () => {
        pediu = true;
        return pool();
      },
      chaves: () => {
        pediu = true;
        return chaves;
      },
    };
    expect(await principal(["--desconhecido"], deps)).toBe(2);
    expect(e.err.join("\n")).toContain(USO);
    expect(pediu).toBe(false);
  });
});

describeComBanco("canal:segredo-de-teste — Postgres local", () => {
  const espacos: string[] = [];

  async function espacoComCanal(rotulo: string, opcoes: { simulado: boolean; arquivado?: boolean }) {
    const ws = novoEspacoDeTeste(rotulo);
    espacos.push(ws);
    const canalId = await semearCanal(ws, {
      nome: "Comercial",
      tipo: "whatsapp",
      provedor: "whatsapp-nao-oficial",
      identificadorExterno: "+5511977770001",
      conexao: opcoes.simulado ? "conectada" : "desconectada",
      conexaoSimulada: opcoes.simulado,
    });
    if (opcoes.arquivado) {
      await pool().query("update plataforma.canais set estado = 'arquivado', arquivado_em = now() where workspace_id = $1 and id = $2", [ws, canalId]);
    }
    return { ws, canalId };
  }

  const credenciais = async (ws: string, canalId: string) =>
    (
      await pool().query<{ ativas: number; total: number }>(
        `select count(*) filter (where revogado_em is null)::int as ativas, count(*)::int as total
           from plataforma.credenciais where workspace_id = $1 and dono_tipo = 'canal' and dono_id = $2 and tipo = $3`,
        [ws, canalId, TIPO_DO_SEGREDO_DO_WEBHOOK],
      )
    ).rows[0]!;

  beforeAll(async () => {
    await prepararBancoCrm();
  });

  afterAll(async () => {
    for (const ws of espacos) {
      await pool().query("delete from plataforma.credenciais where workspace_id = $1", [ws]);
      await limparEspaco(ws);
    }
    await encerrar();
  });

  it("Canal simulado: sai com 0, guarda o segredo no cofre e o mostra uma vez, com caminho, cabeçalho e curl", async () => {
    const { ws, canalId } = await espacoComCanal("segsim", { simulado: true });
    const e = execucao();

    expect(await principal(["--canal", canalId], e.deps)).toBe(0);

    const guardado = await lerCredencial(pool(), chaves, { workspaceId: ws, donoTipo: "canal", donoId: canalId, tipo: TIPO_DO_SEGREDO_DO_WEBHOOK });
    expect(guardado).toMatch(/^[0-9a-f]{64}$/);
    const saida = e.out.join("\n");
    expect(saida).toContain(guardado!);
    expect(saida).toContain(`/webhooks/mensageria/${canalId}`);
    expect(saida).toContain(CABECALHO_DO_SEGREDO);
    expect(saida).toMatch(/curl /);
    expect(e.err.join("\n")).not.toContain(guardado!);
    expect(await credenciais(ws, canalId)).toEqual({ ativas: 1, total: 1 });
  });

  it("rodar de novo revoga o anterior: um ativo só, e o segredo muda", async () => {
    const { ws, canalId } = await espacoComCanal("segdois", { simulado: true });
    const e1 = execucao();
    expect(await principal(["--canal=" + canalId], e1.deps)).toBe(0);
    const primeiro = await lerCredencial(pool(), chaves, { workspaceId: ws, donoTipo: "canal", donoId: canalId, tipo: TIPO_DO_SEGREDO_DO_WEBHOOK });

    const e2 = execucao();
    expect(await principal(["--canal", canalId], e2.deps)).toBe(0);
    const segundo = await lerCredencial(pool(), chaves, { workspaceId: ws, donoTipo: "canal", donoId: canalId, tipo: TIPO_DO_SEGREDO_DO_WEBHOOK });

    expect(segundo).not.toBe(primeiro);
    expect(e2.out.join("\n")).toContain(segundo!);
    expect(e2.out.join("\n")).not.toContain(primeiro!);
    expect(await credenciais(ws, canalId)).toEqual({ ativas: 1, total: 2 });
  });

  it("Canal real: sai com 2, diz por que e não grava nada no cofre", async () => {
    const { ws, canalId } = await espacoComCanal("segreal", { simulado: false });
    const e = execucao();

    expect(await principal(["--canal", canalId], e.deps)).toBe(2);

    expect(e.err.join("\n")).toContain(
      "Este comando só gera segredo para Canal simulado (D-16-03). Para um WhatsApp de verdade, use `canal:ligar-evolution`.",
    );
    expect(await credenciais(ws, canalId)).toEqual({ ativas: 0, total: 0 });
  });

  it("Canal arquivado: sai com 2 e não grava nada", async () => {
    const { ws, canalId } = await espacoComCanal("segarq", { simulado: true, arquivado: true });
    const e = execucao();
    expect(await principal(["--canal", canalId], e.deps)).toBe(2);
    expect(e.err.join("\n")).toMatch(/arquivado/i);
    expect(await credenciais(ws, canalId)).toEqual({ ativas: 0, total: 0 });
  });

  it("Canal inexistente: sai com 2 e diz \"Canal não encontrado.\"", async () => {
    const e = execucao();
    expect(await principal(["--canal", "canal-que-nao-existe"], e.deps)).toBe(2);
    expect(e.err.join("\n")).toContain("Canal não encontrado.");
  });

  it("o mesmo id em dois Espaços não é adivinhado: sai com 2 e não grava nada", async () => {
    const id = `canal_dup_${randomBytes(4).toString("hex")}`;
    const wss: string[] = [];
    for (const rotulo of ["dupa", "dupb"]) {
      const ws = novoEspacoDeTeste(rotulo);
      espacos.push(ws);
      wss.push(ws);
      await pool().query(
        `insert into plataforma.canais (id, workspace_id, nome, tipo, provedor, identificador_externo, conexao, conexao_simulada, configurado_por, criado_por)
         values ($1, $2, 'Dup', 'whatsapp', 'whatsapp-nao-oficial', '+5511977770002', 'conectada', true, 'mem_teste', 'mem_teste')`,
        [id, ws],
      );
    }
    const e = execucao();
    expect(await principal(["--canal", id], e.deps)).toBe(2);
    for (const ws of wss) expect(await credenciais(ws, id)).toEqual({ ativas: 0, total: 0 });
  });

  it("sem COFRE_CHAVE sai com 1 e nada vai ao cofre", async () => {
    const { ws, canalId } = await espacoComCanal("segsemchave", { simulado: true });
    const e = execucao();
    const deps: DependenciasDoSegredo = {
      ...e.deps,
      chaves: () => {
        throw new Error("COFRE_CHAVE não está configurada.");
      },
    };
    expect(await principal(["--canal", canalId], deps)).toBe(1);
    expect(e.err.join("\n")).toContain("COFRE_CHAVE não está configurada.");
    expect(await credenciais(ws, canalId)).toEqual({ ativas: 0, total: 0 });
  });
});
