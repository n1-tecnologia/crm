/**
 * O e-mail lido vira linha da fila e, traduzido, Conversa (Fase 17, 17-08, D-17-10), contra o Postgres LOCAL:
 *
 *   DATABASE_URL=postgres://postgres:x@localhost:55749/postgres \
 *   DATABASE_URL_MIGRACAO=postgres://postgres:x@localhost:55749/postgres \
 *   npx vitest run src/mensageria/provedores/email/entrada.test.ts
 *
 * O traçador: um `.eml` com PDF e HTML passa por `prepararEmailRecebido` (guarda de mídia da Fase 16 + bucket falso),
 * `enfileirarEmailEAvancar` grava a linha e o cursor numa transação, `eventosDoCorpo` traduz o corpo e `receberMensagem`
 * cria Contato, Conversa e Mensagem com o arquivo e o HTML. Os `.eml` são sintéticos (`example` e `.test`).
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { Canal } from "@n1/dominio/crm/canais";
import { encerrar, pool } from "../../../persistencia/conexao";
import { criarRepositorioDeCanaisPg } from "../../../repositorios/crm/canais";
import { criarServicoDeRecebimento } from "../../../servicos/crm/recebimento";
import { criarArmazenamentoFalso } from "../../../testes/armazenamento-falso";
import { describeComBanco, limparEspaco, novoEspacoDeTeste, prepararBancoCrm, semearCanal, semearMembro } from "../../../testes/banco-crm";
import { criarGuardaDeMidia } from "../../midia";
import type { CanalParaProvedor } from "../../provedor";
import { enfileirarEmailEAvancar } from "./entrada";
import { gravarConta, lerCursor } from "./repositorio";
import { chaveDoCorpo, eventosDoCorpo, prepararEmailRecebido } from "./traduzir";

const ENDERECO_DO_CANAL = "vendas@caixa.test";
const UID_VALIDITY = "9007199254740993";

const eml = (nome: string): Uint8Array => new Uint8Array(readFileSync(join(__dirname, "exemplos", nome)));

describeComBanco("e-mail lido → fila → Conversa — Postgres local", () => {
  const espacos: string[] = [];
  const servico = criarServicoDeRecebimento({ pool });

  beforeAll(async () => {
    await prepararBancoCrm();
  });

  afterAll(async () => {
    for (const ws of espacos) await limparEspaco(ws);
    await encerrar();
  });

  async function cenario(rotulo: string) {
    const ws = novoEspacoDeTeste(rotulo);
    espacos.push(ws);
    await semearMembro(ws, { id: "mem_dona", base: "membro", state: "ativo" });
    const canalId = await semearCanal(ws, {
      nome: "Vendas",
      tipo: "email",
      provedor: "email-imap-smtp",
      identificadorExterno: ENDERECO_DO_CANAL,
      conexao: "conectada",
      configuradoPor: "mem_dona",
    });
    await pool().query(
      "update plataforma.canais set fila_padrao_id = 'fila_vendas', proprietario_padrao_id = 'mem_dona' where workspace_id = $1 and id = $2",
      [ws, canalId],
    );
    await gravarConta(pool(), {
      workspaceId: ws,
      canalId,
      endereco: ENDERECO_DO_CANAL,
      tipoDeLogin: "senha",
      imap: { host: "imap.caixa.test", porta: 993 },
      smtp: { host: "smtp.caixa.test", porta: 465 },
      pastaEnviados: "Sent",
      conectadaPor: "mem_dona",
    });
    const canal = (await criarRepositorioDeCanaisPg(pool()).obter(ws, canalId)) as Canal;
    const paraOProvedor: CanalParaProvedor = { workspaceId: ws, canal };
    const armazenamento = criarArmazenamentoFalso();
    const subir = vi.spyOn(armazenamento, "subir");
    const guarda = criarGuardaDeMidia({ armazenamento });
    return { ws, canalId, paraOProvedor, armazenamento, subir, guarda };
  }

  it("traçador: um e-mail com PDF vira linha da fila (cursor junto) e, traduzido, Conversa com o PDF e o HTML guardados", async () => {
    const c = await cenario("em_traco");
    const preparado = await prepararEmailRecebido({
      bytes: eml("com-anexo.eml"),
      uid: 7,
      uidValidity: UID_VALIDITY,
      recebidoEm: "2026-11-19T13:05:00.000Z",
      workspaceId: c.ws,
      canal: c.paraOProvedor,
      guarda: c.guarda,
      armazenamento: c.armazenamento,
    });

    expect(preparado.chave).toBe("pedido-42@empresa.example");
    expect(preparado.algumTransitorio).toBe(false);
    const corpo = preparado.corpo;
    if (!("de" in corpo)) throw new Error("esperava um e-mail interpretado");
    expect(corpo).toMatchObject({
      v: 1,
      messageId: "pedido-42@empresa.example",
      uid: 7,
      uidValidity: UID_VALIDITY,
      data: "2026-11-19T13:05:00.000Z",
      de: { endereco: "cliente@empresa.example", nome: "Cliente" },
      assunto: "Pedido 42",
    });
    expect(corpo.anexos).toHaveLength(1);
    expect(corpo.anexos[0]).toMatchObject({ tipoDeMidia: "application/pdf", nome: "pedido-42.pdf", baixado: true });
    expect(corpo.anexos[0]?.objectKey?.startsWith(`workspace/${c.ws}/entrada/${c.canalId}/`)).toBe(true);
    expect(corpo.corpoHtml?.objectKey.startsWith(`workspace/${c.ws}/entrada/${c.canalId}/`)).toBe(true);
    // O HTML foi subido como `text/html` e está no bucket.
    expect(c.subir).toHaveBeenCalledWith(corpo.corpoHtml?.objectKey, expect.anything(), "text/html");
    const html = Buffer.from(await c.armazenamento.baixar(corpo.corpoHtml!.objectKey, { tetoBytes: 1_000_000 })).toString("utf8");
    expect(html).toContain("<b>pedido 42</b>");

    // A fila: uma linha só, com o e-mail já interpretado e sem MIME cru.
    expect(await enfileirarEmailEAvancar(pool, { workspaceId: c.ws, canalId: c.canalId }, preparado, { pasta: "INBOX", uidValidity: UID_VALIDITY, proximoUid: 8 })).toBe("guardada");
    const { rows } = await pool().query<{ provedor: string; chave: string; v: string; corpo: string }>(
      "select provedor, chave, corpo->>'v' as v, corpo::text as corpo from plataforma.webhooks_recebidos where workspace_id = $1",
      [c.ws],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ provedor: "email-imap-smtp", chave: "pedido-42@empresa.example", v: "1" });
    expect(rows[0]?.corpo).not.toContain("multipart/");
    expect(rows[0]?.corpo).not.toContain("JVBERi0x");
    expect(rows[0]?.corpo).not.toContain("<b>pedido 42</b>");
    expect(await lerCursor(pool(), c.ws, c.canalId, "INBOX")).toEqual({ pasta: "INBOX", uidValidity: UID_VALIDITY, proximoUid: 8 });

    // O mesmo e-mail de novo: nenhuma linha nova, cursor avançado do mesmo jeito.
    expect(await enfileirarEmailEAvancar(pool, { workspaceId: c.ws, canalId: c.canalId }, preparado, { pasta: "INBOX", uidValidity: UID_VALIDITY, proximoUid: 9 })).toBe("repetida");
    const { rows: depois } = await pool().query("select 1 from plataforma.webhooks_recebidos where workspace_id = $1", [c.ws]);
    expect(depois).toHaveLength(1);
    expect((await lerCursor(pool(), c.ws, c.canalId, "INBOX"))?.proximoUid).toBe(9);

    // O que a linha guardou traduz no evento que `receberMensagem` entende.
    expect(chaveDoCorpo(JSON.parse(rows[0]!.corpo))).toBe("pedido-42@empresa.example");
    const eventos = eventosDoCorpo(JSON.parse(rows[0]!.corpo), ENDERECO_DO_CANAL);
    expect(eventos).toHaveLength(1);
    const evento = eventos[0]!;
    if (evento.tipo !== "mensagem") throw new Error("esperava um evento de mensagem");
    expect(evento.remetente).toEqual({ tipo: "email", valor: "cliente@empresa.example", nomeExibido: "Cliente" });
    expect(evento.assunto).toBe("Pedido 42");
    expect(evento.idExterno).toBe("pedido-42@empresa.example");
    expect(evento.anexosGuardados).toHaveLength(1);
    expect(evento.corpoHtml).toEqual(corpo.corpoHtml);
    // Para e cópia, sem o endereço do próprio Canal (D-17-12).
    expect(evento.enderecosAdicionais).toEqual([
      { tipo: "para", endereco: "outra@empresa.example" },
      { tipo: "copia", endereco: "socio@empresa.example" },
    ]);
    expect(JSON.stringify(evento.cargaBruta)).not.toContain("Segue o pedido");

    const r = await servico.receberMensagem(c.ws, c.canalId, evento, { anexos: evento.anexosGuardados! });
    if (!r.ok) throw new Error(`esperava sucesso, veio ${r.status}: ${r.error}`);
    expect(r.valor.contatoNovo).toBe(true);
    expect(r.valor.conversaNova).toBe(true);
    const mensagem = r.valor.mensagem;
    expect(mensagem.idExterno).toBe("pedido-42@empresa.example");
    expect(mensagem.anexos).toHaveLength(1);
    expect(mensagem.anexos[0]).toMatchObject({ tipoDeMidia: "application/pdf", baixado: true, objectKey: corpo.anexos[0]?.objectKey });
    expect(mensagem.corpoHtml).toEqual(corpo.corpoHtml);
    expect(mensagem.enderecosAdicionais.map((e) => e.endereco)).toEqual(["outra@empresa.example", "socio@empresa.example"]);
  });

  it("o INSERT e o cursor são uma transação só: se o cursor falha (sem conta), a linha não fica", async () => {
    const c = await cenario("em_atomica");
    // Um Canal sem conta de e-mail: `gravarCursor` quebra na FK depois do INSERT da fila.
    const semConta = await semearCanal(c.ws, { nome: "Sem conta", tipo: "email", provedor: "email-imap-smtp", identificadorExterno: "sem@caixa.test", conexao: "conectada" });
    const preparado = await prepararEmailRecebido({
      bytes: eml("resposta.eml"),
      uid: 1,
      uidValidity: UID_VALIDITY,
      workspaceId: c.ws,
      canal: c.paraOProvedor,
      guarda: c.guarda,
      armazenamento: c.armazenamento,
    });
    await expect(
      enfileirarEmailEAvancar(pool, { workspaceId: c.ws, canalId: semConta }, preparado, { pasta: "INBOX", uidValidity: UID_VALIDITY, proximoUid: 2 }),
    ).rejects.toThrow();
    const { rows } = await pool().query("select 1 from plataforma.webhooks_recebidos where workspace_id = $1 and canal_id = $2", [c.ws, semConta]);
    expect(rows).toHaveLength(0);
  });

  describe("eventosDoCorpo nunca lança", () => {
    it.each([[null], [undefined], [{}], [{ v: 2 }], [[]], ["texto"], [{ v: 1 }], [{ v: 1, ignorado: "inventado", uid: 1, uidValidity: "1" }]])("corpo %j vira só `ignorado`", (corpo) => {
      const eventos = eventosDoCorpo(corpo, ENDERECO_DO_CANAL);
      expect(eventos).toHaveLength(1);
      expect(eventos[0]?.tipo).toBe("ignorado");
      expect(chaveDoCorpo(corpo)).toBeUndefined();
    });
  });
});

describe("eventosDoCorpo sem banco", () => {
  it("um corpo `v: 1` de e-mail comum vira um evento de mensagem", () => {
    const eventos = eventosDoCorpo(
      {
        v: 1,
        messageId: "a@x.example",
        uid: 1,
        uidValidity: "1",
        data: "2026-11-19T10:00:00.000Z",
        de: { endereco: "pessoa@example.test" },
        para: [],
        cc: [],
        inReplyTo: [],
        references: [],
        texto: "oi",
        anexos: [],
      },
      ENDERECO_DO_CANAL,
    );
    expect(eventos).toEqual([
      {
        tipo: "mensagem",
        idExterno: "a@x.example",
        criadoEm: "2026-11-19T10:00:00.000Z",
        remetente: { tipo: "email", valor: "pessoa@example.test" },
        conteudo: "oi",
        cargaBruta: { messageId: "a@x.example", uid: 1, uidValidity: "1" },
      },
    ]);
  });
});
