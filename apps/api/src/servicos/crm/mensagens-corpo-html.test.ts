/**
 * `ServicoDeMensagens.corpoHtml` (17-11, D-17-13, EML-03), contra o Postgres LOCAL e o armazenamento falso.
 *
 *   DATABASE_URL=postgres://postgres:x@localhost:55753/postgres npx vitest run src/servicos/crm/mensagens-corpo-html.test.ts
 *
 * O HTML de e-mail é entrada hostil: o que a tela recebe é só o limpo, de uma Mensagem que o Membro pode ler no Espaço
 * dele (T-17-41, T-17-43). A limpeza em si (vetores de XSS e de rastreio) está provada em `html.test.ts`.
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { RecebidaDoProvedor } from "@n1/dominio/crm/recebimento";
import type { MembroDaSessao } from "../../plugins/autenticacao";
import { TETO_DO_HTML_GUARDADO_BYTES } from "../../mensageria/provedores/email/traduzir";
import { encerrar, pool } from "../../persistencia/conexao";
import { criarArmazenamentoFalso } from "../../testes/armazenamento-falso";
import { describeComBanco, limparEspaco, novoEspacoDeTeste, prepararBancoCrm, semearCanal, semearMembro } from "../../testes/banco-crm";
import { criarAcessoAoCrmPg } from "./acesso";
import { criarServicoDeMensagens } from "./mensagens";
import { criarServicoDeRecebimento } from "./recebimento";
import type { ResultadoCrm } from "./resultado";

const armazenamento = criarArmazenamentoFalso();
const servico = criarServicoDeMensagens({ pool, acesso: criarAcessoAoCrmPg(pool), armazenamento });
const recebimento = criarServicoDeRecebimento({ pool });

const CLIENTE = "cliente@empresa.com";
const sessao = (workspaceId: string, id: string): MembroDaSessao => ({ id, workspaceId, state: "ativo" });
const bytes = (texto: string) => new TextEncoder().encode(texto);

function valor<T>(resultado: ResultadoCrm<T>): T {
  if (!resultado.ok) throw new Error(`esperava sucesso, veio ${resultado.status} ${resultado.codigo ?? ""}: ${resultado.error}`);
  return resultado.valor;
}

function recusado(resultado: ResultadoCrm<unknown>) {
  if (resultado.ok) throw new Error("esperava recusa, veio sucesso");
  return resultado;
}

describeComBanco("ServicoDeMensagens.corpoHtml — Postgres local", () => {
  const espacos: string[] = [];

  /** Um Espaço com um Canal de e-mail e uma recebida cujo HTML (se vier) já está no bucket falso. */
  async function espaco(rotulo: string, html?: string | Uint8Array, extras: Partial<RecebidaDoProvedor> = {}) {
    const ws = novoEspacoDeTeste(rotulo);
    espacos.push(ws);
    await semearMembro(ws, { id: "mem_ana", base: "membro", state: "ativo" });
    await semearMembro(ws, { id: "mem_convidado", base: "convidado", state: "ativo" });
    const canalId = await semearCanal(ws, {
      nome: "Atendimento",
      tipo: "email",
      provedor: "email-imap-smtp",
      identificadorExterno: "atendimento@nossa.com",
      conexao: "conectada",
      configuradoPor: "mem_ana",
    });
    await pool().query(
      "update plataforma.canais set fila_padrao_id = 'fila_vendas', proprietario_padrao_id = 'mem_ana' where workspace_id = $1 and id = $2",
      [ws, canalId],
    );

    let corpoHtml: RecebidaDoProvedor["corpoHtml"];
    if (html !== undefined) {
      const objectKey = `workspace/${ws}/entrada/${canalId}/corpo-${rotulo}`;
      const conteudo = typeof html === "string" ? bytes(html) : html;
      armazenamento.colocarPorChave(objectKey, conteudo, "text/html");
      corpoHtml = { objectKey, tamanhoBytes: conteudo.byteLength };
    }
    const recebida = valor(
      await recebimento.receberMensagem(ws, canalId, {
        idExterno: `${rotulo}@x`,
        criadoEm: new Date().toISOString(),
        remetente: { tipo: "email", valor: CLIENTE, nomeExibido: "Cliente" },
        conteudo: "Texto simples",
        assunto: "Orçamento",
        cargaBruta: { raw: "..." },
        ...(corpoHtml ? { corpoHtml } : {}),
        ...extras,
      }),
    );
    return { ws, canalId, mensagemId: recebida.mensagem.id, membro: sessao(ws, "mem_ana"), convidado: sessao(ws, "mem_convidado"), corpoHtml };
  }

  beforeAll(async () => {
    await prepararBancoCrm();
  });

  afterAll(async () => {
    for (const ws of espacos) await limparEspaco(ws);
    await encerrar();
  });

  it("devolve o HTML guardado já limpo: sem script nem on*, com o link em nova aba e sem referrer", async () => {
    const c = await espaco(
      "limpo",
      '<p onclick="x()">Olá <script>alert(1)</script><a href="https://exemplo.com">link</a></p>',
    );
    const { html } = valor(await servico.corpoHtml(c.membro, c.mensagemId));
    expect(html).toBe('<p>Olá <a href="https://exemplo.com" rel="noopener noreferrer" target="_blank">link</a></p>');
    expect(html).not.toMatch(/script|onclick/i);
  });

  it("decodifica UTF-8 (acentos e emoji) antes de limpar", async () => {
    const c = await espaco("utf8", "<p>Ação — olá 😀</p>");
    expect(valor(await servico.corpoHtml(c.membro, c.mensagemId)).html).toBe("<p>Ação — olá 😀</p>");
  });

  it("Mensagem sem corpo_html responde 404 SEM_CORPO_HTML", async () => {
    const c = await espaco("sem-html");
    expect(recusado(await servico.corpoHtml(c.membro, c.mensagemId))).toMatchObject({ status: 404, codigo: "SEM_CORPO_HTML" });
  });

  it("Mensagem inexistente responde 404 MENSAGEM_NAO_ENCONTRADA", async () => {
    const c = await espaco("inexistente", "<p>oi</p>");
    expect(recusado(await servico.corpoHtml(c.membro, "msg_que_nao_existe"))).toMatchObject({ status: 404, codigo: "MENSAGEM_NAO_ENCONTRADA" });
  });

  it("Mensagem de outro Espaço responde 404, nunca 403, e o HTML dela não sai (T-17-43)", async () => {
    const a = await espaco("espaco-a", "<p>segredo do Espaço A</p>");
    const b = await espaco("espaco-b", "<p>do Espaço B</p>");
    const resposta = recusado(await servico.corpoHtml(b.membro, a.mensagemId));
    expect(resposta).toMatchObject({ status: 404, codigo: "MENSAGEM_NAO_ENCONTRADA" });
    expect(JSON.stringify(resposta)).not.toContain("segredo");
  });

  it("chave do HTML fora do Espaço da sessão (linha adulterada) responde 404 e não toca o bucket", async () => {
    const a = await espaco("chave-a", "<p>do Espaço A</p>");
    const b = await espaco("chave-b");
    await pool().query("update plataforma.mensagens set corpo_html = $3::jsonb where workspace_id = $1 and id = $2", [
      b.ws,
      b.mensagemId,
      JSON.stringify(a.corpoHtml),
    ]);
    expect(recusado(await servico.corpoHtml(b.membro, b.mensagemId))).toMatchObject({ status: 404, codigo: "SEM_CORPO_HTML" });
  });

  it("Membro sem permissão de ler Mensagem responde 403", async () => {
    const c = await espaco("sem-permissao", "<p>oi</p>");
    // Quem não é Membro do Espaço (sem Papel) não lê nada, nem com o id certo da Mensagem.
    const estranho = sessao(c.ws, "mem_que_nao_existe");
    expect(recusado(await servico.corpoHtml(estranho, c.mensagemId))).toMatchObject({ status: 403, codigo: "PERMISSAO" });
    // O Convidado lê (a regra é a mesma do fio e da URL do anexo).
    expect(valor(await servico.corpoHtml(c.convidado, c.mensagemId)).html).toBe("<p>oi</p>");
  });

  it("objeto maior que o teto do leitor responde 404 SEM_CORPO_HTML (não serve o que o leitor não guardaria)", async () => {
    const grande = new Uint8Array(TETO_DO_HTML_GUARDADO_BYTES + 1).fill(0x61);
    const c = await espaco("grande", grande);
    expect(recusado(await servico.corpoHtml(c.membro, c.mensagemId))).toMatchObject({ status: 404, codigo: "SEM_CORPO_HTML" });
  });

  it("objeto ausente do bucket sobe como falha do armazenamento (sem a chave na mensagem), não como 404 mudo", async () => {
    const c = await espaco("ausente", "<p>oi</p>");
    armazenamento.falharNaProxima(new Error("falha_ao_baixar_objeto"));
    // `exigir` e o repositório não tocam o bucket; a primeira chamada ao armazenamento é o `baixar`.
    await expect(servico.corpoHtml(c.membro, c.mensagemId)).rejects.toThrow(/^armazenamento_indisponivel: falha_ao_baixar_objeto$/);
  });
});
