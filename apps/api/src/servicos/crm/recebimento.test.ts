/**
 * Serviço de recebimento (16-01, MSG-01), contra o Postgres LOCAL (Docker, porta 55716):
 *
 *   DATABASE_URL=postgres://postgres:x@localhost:55716/postgres npx vitest run src/servicos/crm/recebimento.test.ts
 *
 * Uma Mensagem do provedor acha ou cria o Contato, reaproveita, reabre ou abre a Conversa e grava
 * a Mensagem numa transação só (3.6.2); a repetida não grava nada.
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { RecebidaDoProvedor } from "@n1/dominio/crm/recebimento";
import { encerrar, pool } from "../../persistencia/conexao";
import { describeComBanco, limparEspaco, novoEspacoDeTeste, prepararBancoCrm, semearCanal, semearMembro } from "../../testes/banco-crm";
import { criarServicoDeRecebimento } from "./recebimento";
import type { ResultadoCrm } from "./resultado";

const servico = criarServicoDeRecebimento({ pool });

function valor<T>(resultado: ResultadoCrm<T>): T {
  if (!resultado.ok) throw new Error(`esperava sucesso, veio ${resultado.status} ${resultado.codigo ?? ""}: ${resultado.error}`);
  return resultado.valor;
}

function recusado(resultado: ResultadoCrm<unknown>) {
  if (resultado.ok) throw new Error("esperava recusa, veio sucesso");
  return resultado;
}

const WHATSAPP_DA_ANA = "+5511987654321";

function evento(extras: Partial<RecebidaDoProvedor> = {}): RecebidaDoProvedor {
  return {
    idExterno: "ext-1",
    criadoEm: new Date().toISOString(),
    remetente: { tipo: "whatsapp", valor: WHATSAPP_DA_ANA, nomeExibido: "Ana" },
    conteudo: "oi",
    cargaBruta: { texto: "oi" },
    ...extras,
  };
}

const contar = async (ws: string, tabela: "contatos" | "conversas" | "mensagens") =>
  (await pool().query<{ n: number }>(`select count(*)::int as n from plataforma.${tabela} where workspace_id = $1`, [ws])).rows[0]!.n;

describeComBanco("ServicoDeRecebimento — Postgres local", () => {
  const espacos: string[] = [];

  /** Um Espaço com um Canal conectado que tem Fila e Proprietário padrão (o Membro "mem_dona"). */
  async function espaco(rotulo: string) {
    const ws = novoEspacoDeTeste(rotulo);
    espacos.push(ws);
    await semearMembro(ws, { id: "mem_dona", base: "membro", state: "ativo" });
    const canalId = await semearCanal(ws, {
      nome: "Comercial",
      tipo: "whatsapp",
      provedor: "whatsapp-nao-oficial",
      identificadorExterno: "+5511977770001",
      conexao: "conectada",
      configuradoPor: "mem_dona",
    });
    await pool().query(
      "update plataforma.canais set fila_padrao_id = 'fila_vendas', proprietario_padrao_id = 'mem_dona' where workspace_id = $1 and id = $2",
      [ws, canalId],
    );
    return { ws, canalId };
  }

  beforeAll(async () => {
    await prepararBancoCrm();
  });

  afterAll(async () => {
    for (const ws of espacos) await limparEspaco(ws);
    await encerrar();
  });

  it("um número desconhecido vira Contato, Conversa e Mensagem recebida", async () => {
    const c = await espaco("novo");
    const r = valor(await servico.receberMensagem(c.ws, c.canalId, evento()));

    expect(r).toMatchObject({ contatoNovo: true, conversaNova: true, conversaReaberta: false, repetida: false });
    expect(r.mensagem).toMatchObject({
      direcao: "recebida",
      canalId: c.canalId,
      conteudo: "oi",
      idExterno: "ext-1",
      statusEntrega: null,
      remetenteExterno: WHATSAPP_DA_ANA,
      ator: { tipo: "integration", id: c.canalId },
    });
    expect(r.mensagem.identificadorId).not.toBeNull();
    expect(await contar(c.ws, "contatos")).toBe(1);
    expect(await contar(c.ws, "conversas")).toBe(1);
    expect(await contar(c.ws, "mensagens")).toBe(1);
  });

  it("o Contato novo nasce automatico_mensagem, dono do Canal, com o Identificador whatsapp normalizado", async () => {
    const c = await espaco("contato");
    const r = valor(await servico.receberMensagem(c.ws, c.canalId, evento({ remetente: { tipo: "whatsapp", valor: "+55 (11) 98765-4321", nomeExibido: "Ana" } })));

    const contato = (
      await pool().query<{ nome: string | null; modo_criacao: string; proprietario_id: string; estado: string }>(
        "select nome, modo_criacao, proprietario_id, estado from plataforma.contatos where workspace_id = $1 and id = $2",
        [c.ws, r.contatoId],
      )
    ).rows[0]!;
    expect(contato).toMatchObject({ nome: "Ana", modo_criacao: "automatico_mensagem", proprietario_id: "mem_dona", estado: "ativo" });

    const identificadores = (
      await pool().query<{ tipo: string; valor: string; principal: boolean }>(
        "select tipo, valor, principal from plataforma.contato_identificadores where workspace_id = $1 and contato_id = $2",
        [c.ws, r.contatoId],
      )
    ).rows;
    expect(identificadores).toEqual([{ tipo: "whatsapp", valor: WHATSAPP_DA_ANA, principal: true }]);
  });

  it("a Conversa nova leva a Fila do Canal, nenhum atribuído e o Contato como participante principal", async () => {
    const c = await espaco("conversa");
    const r = valor(await servico.receberMensagem(c.ws, c.canalId, evento()));

    expect(r.conversa).toMatchObject({
      canalId: c.canalId,
      contatoId: r.contatoId,
      situacao: "aberta",
      filaId: "fila_vendas",
      atribuido: null,
      criadoPor: { tipo: "integration", id: c.canalId },
    });
    expect(r.conversa.participantes).toHaveLength(1);
    expect(r.conversa.participantes[0]).toMatchObject({ sujeito: { tipo: "contato", id: r.contatoId }, papel: "contato", principal: true });
    expect(r.conversa.titulo).toBe("Ana");
  });

  it("sem nome do remetente, o Contato e o título usam o próprio valor do Identificador", async () => {
    const c = await espaco("semnome");
    const r = valor(await servico.receberMensagem(c.ws, c.canalId, evento({ remetente: { tipo: "whatsapp", valor: WHATSAPP_DA_ANA } })));
    expect(r.conversa.titulo).toBe(WHATSAPP_DA_ANA);
  });

  it("a mesma Mensagem entregue de novo devolve repetida e não grava Contato, Conversa nem Mensagem", async () => {
    const c = await espaco("repetida");
    const primeira = valor(await servico.receberMensagem(c.ws, c.canalId, evento()));
    const segunda = valor(await servico.receberMensagem(c.ws, c.canalId, evento()));

    expect(segunda.repetida).toBe(true);
    expect(segunda.mensagem.id).toBe(primeira.mensagem.id);
    expect(segunda.conversa.id).toBe(primeira.conversa.id);
    expect(segunda.contatoId).toBe(primeira.contatoId);
    expect(await contar(c.ws, "contatos")).toBe(1);
    expect(await contar(c.ws, "conversas")).toBe(1);
    expect(await contar(c.ws, "mensagens")).toBe(1);
  });

  it("a repetida de um número que ainda não tem Contato (id externo já gravado) também não grava nada", async () => {
    const c = await espaco("repetidaesc");
    valor(await servico.receberMensagem(c.ws, c.canalId, evento({ idExterno: "ext-7" })));
    const outroRemetente = evento({ idExterno: "ext-7", remetente: { tipo: "whatsapp", valor: "+5511911112222", nomeExibido: "Bia" } });
    const r = valor(await servico.receberMensagem(c.ws, c.canalId, outroRemetente));

    expect(r.repetida).toBe(true);
    expect(await contar(c.ws, "contatos")).toBe(1);
    expect(await contar(c.ws, "mensagens")).toBe(1);
  });

  it("a Mensagem seguinte do mesmo número cai no mesmo Contato e na mesma Conversa", async () => {
    const c = await espaco("seguinte");
    const a = valor(await servico.receberMensagem(c.ws, c.canalId, evento({ idExterno: "ext-a" })));
    const b = valor(await servico.receberMensagem(c.ws, c.canalId, evento({ idExterno: "ext-b", conteudo: "tudo bem?" })));

    expect(b).toMatchObject({ contatoNovo: false, conversaNova: false, repetida: false });
    expect(b.contatoId).toBe(a.contatoId);
    expect(b.conversa.id).toBe(a.conversa.id);
    expect(await contar(c.ws, "mensagens")).toBe(2);
  });

  it("um Canal de outro Espaço dá 404 e não grava nada (T-16-01)", async () => {
    const c = await espaco("ws1");
    const outro = await espaco("ws2");
    const r = recusado(await servico.receberMensagem(outro.ws, c.canalId, evento()));
    expect(r).toMatchObject({ status: 404, codigo: "CANAL_NAO_ENCONTRADO" });
    expect(await contar(outro.ws, "contatos")).toBe(0);
    expect(await contar(outro.ws, "mensagens")).toBe(0);
  });

  it("um Canal arquivado dá 409 CANAL_ARQUIVADO", async () => {
    const c = await espaco("arquivado");
    await pool().query(
      "update plataforma.canais set estado = 'arquivado', arquivado_em = now(), conexao = 'desconectada', conectada_em = null where workspace_id = $1 and id = $2",
      [c.ws, c.canalId],
    );
    expect(recusado(await servico.receberMensagem(c.ws, c.canalId, evento()))).toMatchObject({ status: 409, codigo: "CANAL_ARQUIVADO" });
    expect(await contar(c.ws, "contatos")).toBe(0);
  });

  it("recusa com 400 o evento que o banco recusaria: id externo vazio, instante inválido, sem conteúdo nem anexo", async () => {
    const c = await espaco("guarda");
    expect(recusado(await servico.receberMensagem(c.ws, c.canalId, evento({ idExterno: " " })))).toMatchObject({ status: 400, codigo: "VALOR_INVALIDO", campo: "idExterno" });
    expect(recusado(await servico.receberMensagem(c.ws, c.canalId, evento({ criadoEm: "ontem" })))).toMatchObject({ status: 400, campo: "criadoEm" });
    expect(recusado(await servico.receberMensagem(c.ws, c.canalId, evento({ conteudo: "  " })))).toMatchObject({ status: 400, campo: "conteudo" });
    expect(await contar(c.ws, "contatos")).toBe(0);
  });

  it("recusa o remetente cujo tipo o Canal não resolve (RN-CXE-21: telefone não é WhatsApp)", async () => {
    const c = await espaco("tipo");
    const r = recusado(await servico.receberMensagem(c.ws, c.canalId, evento({ remetente: { tipo: "email", valor: "ana@exemplo.com.br" } })));
    expect(r).toMatchObject({ status: 400, campo: "remetente" });
    expect(await contar(c.ws, "contatos")).toBe(0);
  });

  it("o anexo entra na Mensagem com a referência do provedor", async () => {
    const c = await espaco("anexo");
    const soAnexo: RecebidaDoProvedor = {
      idExterno: "ext-audio",
      criadoEm: new Date().toISOString(),
      remetente: { tipo: "whatsapp", valor: WHATSAPP_DA_ANA },
      anexos: [{ referenciaNoProvedor: "midia-9", tipoDeMidia: "audio/ogg", nome: "audio.ogg" }],
      cargaBruta: {},
    };
    const r = valor(await servico.receberMensagem(c.ws, c.canalId, soAnexo));
    expect(r.mensagem.anexos).toEqual([{ tipoDeMidia: "audio/ogg", nome: "audio.ogg", referenciaExterna: "midia-9" }]);
  });
});
