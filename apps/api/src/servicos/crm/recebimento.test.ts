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
    expect(r.mensagem.anexos).toEqual([{ tipoDeMidia: "audio/ogg", nome: "audio.ogg", referenciaExterna: "midia-9", baixado: false }]);
  });

  describe("opcoes.anexos: a entrada de mídia (16-10)", () => {
    const guardado = (chave: string) => ({ tipoDeMidia: "audio/ogg", nome: "audio.ogg", objectKey: chave, tamanhoBytes: 2048, baixado: true }) as const;
    const perdido = { tipoDeMidia: "audio/ogg", nome: "audio.ogg", referenciaExterna: "midia-9", baixado: false } as const;
    const eventoDeAudio = (): RecebidaDoProvedor => ({
      idExterno: "ext-audio",
      criadoEm: new Date().toISOString(),
      remetente: { tipo: "whatsapp", valor: WHATSAPP_DA_ANA },
      anexos: [{ referenciaNoProvedor: "midia-9", tipoDeMidia: "audio/ogg", nome: "audio.ogg" }],
      cargaBruta: {},
    });
    const anexosGravados = async (ws: string) =>
      (await pool().query<{ anexos: unknown }>("select anexos from plataforma.mensagens where workspace_id = $1 and id_externo = 'ext-audio'", [ws])).rows[0]!.anexos;

    it("a Mensagem nova grava os anexos que vieram prontos (baixado: true, com a chave), no lugar da referência provisória", async () => {
      const c = await espaco("anexopronto");
      const r = valor(await servico.receberMensagem(c.ws, c.canalId, eventoDeAudio(), { anexos: [guardado("workspace/x/entrada/y/z")] }));
      expect(r.repetida).toBe(false);
      expect(r.mensagem.anexos).toEqual([guardado("workspace/x/entrada/y/z")]);
      expect(await anexosGravados(c.ws)).toEqual([guardado("workspace/x/entrada/y/z")]);
    });

    it("a repetida completa o anexo que estava baixado: false e devolve a Mensagem já completa, sem gravar outra", async () => {
      const c = await espaco("anexocompleta");
      valor(await servico.receberMensagem(c.ws, c.canalId, eventoDeAudio(), { anexos: [perdido] }));
      const segunda = valor(await servico.receberMensagem(c.ws, c.canalId, eventoDeAudio(), { anexos: [guardado("workspace/x/entrada/y/z")] }));
      expect(segunda.repetida).toBe(true);
      expect(segunda.mensagem.anexos).toEqual([guardado("workspace/x/entrada/y/z")]);
      expect(await anexosGravados(c.ws)).toEqual([guardado("workspace/x/entrada/y/z")]);
      expect(await contar(c.ws, "mensagens")).toBe(1);
    });

    it("a repetida nunca troca um anexo que já estava guardado, nem volta atrás para baixado: false", async () => {
      const c = await espaco("anexonaotroca");
      valor(await servico.receberMensagem(c.ws, c.canalId, eventoDeAudio(), { anexos: [guardado("workspace/x/entrada/y/primeiro")] }));
      const duplicada = valor(await servico.receberMensagem(c.ws, c.canalId, eventoDeAudio(), { anexos: [guardado("workspace/x/entrada/y/segundo")] }));
      expect(duplicada.mensagem.anexos).toEqual([guardado("workspace/x/entrada/y/primeiro")]);
      const pior = valor(await servico.receberMensagem(c.ws, c.canalId, eventoDeAudio(), { anexos: [perdido] }));
      expect(pior.mensagem.anexos).toEqual([guardado("workspace/x/entrada/y/primeiro")]);
      expect(await anexosGravados(c.ws)).toEqual([guardado("workspace/x/entrada/y/primeiro")]);
    });
  });
  /** Põe a Conversa no estado de partida de um caso: situação, há quantas horas foi resolvida, lixeira, adiamento. */
  async function prepararConversa(
    ws: string,
    conversaId: string,
    estado: { situacao: "aberta" | "pendente" | "resolvida"; resolvidaHaHoras?: number; naLixeira?: boolean; adiada?: boolean },
  ) {
    await pool().query(
      `update plataforma.conversas
          set situacao = $3,
              resolvida_em = case when $4::numeric is null then null else now() - ($4::numeric * interval '1 hour') end,
              adiada_ate = case when $5::boolean then now() + interval '1 day' else null end,
              estado = case when $6::boolean then 'na_lixeira' else 'ativo' end,
              na_lixeira_em = case when $6::boolean then now() else null end
        where workspace_id = $1 and id = $2`,
      [ws, conversaId, estado.situacao, estado.resolvidaHaHoras ?? null, estado.adiada ?? false, estado.naLixeira ?? false],
    );
  }

  const lerConversa = async (ws: string, id: string) =>
    (
      await pool().query<{ situacao: string; reaberturas: number; adiada_ate: Date | null; estado: string }>(
        "select situacao, reaberturas, adiada_ate, estado from plataforma.conversas where workspace_id = $1 and id = $2",
        [ws, id],
      )
    ).rows[0]!;

  it("a Conversa aberta do par é reaproveitada: mesma Conversa, nenhuma reabertura", async () => {
    const c = await espaco("aberta");
    const a = valor(await servico.receberMensagem(c.ws, c.canalId, evento({ idExterno: "ext-a" })));
    const b = valor(await servico.receberMensagem(c.ws, c.canalId, evento({ idExterno: "ext-b" })));
    expect(b).toMatchObject({ conversaNova: false, conversaReaberta: false });
    expect(b.conversa.id).toBe(a.conversa.id);
    expect((await lerConversa(c.ws, a.conversa.id)).reaberturas).toBe(0);
  });

  it("a Conversa pendente com Adiamento volta a aberta, sem Adiamento e sem contar reabertura", async () => {
    const c = await espaco("pendente");
    const a = valor(await servico.receberMensagem(c.ws, c.canalId, evento({ idExterno: "ext-a" })));
    await prepararConversa(c.ws, a.conversa.id, { situacao: "pendente", adiada: true });

    const b = valor(await servico.receberMensagem(c.ws, c.canalId, evento({ idExterno: "ext-b" })));
    expect(b.conversa.id).toBe(a.conversa.id);
    expect(b).toMatchObject({ conversaNova: false, conversaReaberta: false });
    expect(await lerConversa(c.ws, a.conversa.id)).toMatchObject({ situacao: "aberta", adiada_ate: null, reaberturas: 0 });
  });

  it("a Conversa resolvida há 10 h (janela de 72 h) é reaberta: mesma Conversa, reaberturas soma 1", async () => {
    const c = await espaco("reabre");
    const a = valor(await servico.receberMensagem(c.ws, c.canalId, evento({ idExterno: "ext-a" })));
    await prepararConversa(c.ws, a.conversa.id, { situacao: "resolvida", resolvidaHaHoras: 10 });

    const b = valor(await servico.receberMensagem(c.ws, c.canalId, evento({ idExterno: "ext-b" })));
    expect(b).toMatchObject({ conversaNova: false, conversaReaberta: true });
    expect(b.conversa.id).toBe(a.conversa.id);
    expect(await lerConversa(c.ws, a.conversa.id)).toMatchObject({ situacao: "aberta", reaberturas: 1 });
    expect(await contar(c.ws, "conversas")).toBe(1);
  });

  it("a Conversa resolvida há 80 h passou da janela: abre outra e a antiga continua resolvida", async () => {
    const c = await espaco("janela80");
    const a = valor(await servico.receberMensagem(c.ws, c.canalId, evento({ idExterno: "ext-a" })));
    await prepararConversa(c.ws, a.conversa.id, { situacao: "resolvida", resolvidaHaHoras: 80 });

    const b = valor(await servico.receberMensagem(c.ws, c.canalId, evento({ idExterno: "ext-b" })));
    expect(b).toMatchObject({ conversaNova: true, conversaReaberta: false, contatoNovo: false });
    expect(b.conversa.id).not.toBe(a.conversa.id);
    expect(b.contatoId).toBe(a.contatoId);
    expect((await lerConversa(c.ws, a.conversa.id)).situacao).toBe("resolvida");
  });

  it("a janela do Espaço vem da linha inbox: 1 h e resolvida há 2 h abre outra", async () => {
    const c = await espaco("inbox");
    await pool().query(
      "insert into plataforma.registros (workspace_id, colecao, id, dados) values ($1, 'inbox', 'inbox_teste', $2::jsonb)",
      [c.ws, JSON.stringify({ id: "inbox_teste", reopenWindowHours: 1 })],
    );
    const a = valor(await servico.receberMensagem(c.ws, c.canalId, evento({ idExterno: "ext-a" })));
    await prepararConversa(c.ws, a.conversa.id, { situacao: "resolvida", resolvidaHaHoras: 2 });

    const b = valor(await servico.receberMensagem(c.ws, c.canalId, evento({ idExterno: "ext-b" })));
    expect(b.conversaNova).toBe(true);
    expect(b.conversa.id).not.toBe(a.conversa.id);
  });

  it("a janela do Espaço de 1 h reabre a resolvida há 30 minutos (o lado de dentro do limite)", async () => {
    const c = await espaco("inbox30");
    await pool().query(
      "insert into plataforma.registros (workspace_id, colecao, id, dados) values ($1, 'inbox', 'inbox_teste', $2::jsonb)",
      [c.ws, JSON.stringify({ id: "inbox_teste", reopenWindowHours: 1 })],
    );
    const a = valor(await servico.receberMensagem(c.ws, c.canalId, evento({ idExterno: "ext-a" })));
    await prepararConversa(c.ws, a.conversa.id, { situacao: "resolvida", resolvidaHaHoras: 0.5 });

    const b = valor(await servico.receberMensagem(c.ws, c.canalId, evento({ idExterno: "ext-b" })));
    expect(b).toMatchObject({ conversaNova: false, conversaReaberta: true });
    expect(b.conversa.id).toBe(a.conversa.id);
  });

  it("a Conversa resolvida que está na lixeira não é reaberta: abre outra e a da lixeira fica", async () => {
    const c = await espaco("lixeira");
    const a = valor(await servico.receberMensagem(c.ws, c.canalId, evento({ idExterno: "ext-a" })));
    await prepararConversa(c.ws, a.conversa.id, { situacao: "resolvida", resolvidaHaHoras: 1, naLixeira: true });

    const b = valor(await servico.receberMensagem(c.ws, c.canalId, evento({ idExterno: "ext-b" })));
    expect(b.conversaNova).toBe(true);
    expect(b.conversa.id).not.toBe(a.conversa.id);
    expect(await lerConversa(c.ws, a.conversa.id)).toMatchObject({ situacao: "resolvida", estado: "na_lixeira" });
  });

  it.each(["arquivado", "na_lixeira"] as const)("o Contato %s que recebe Mensagem volta a ativo na mesma transação (RN-CON-13)", async (estado) => {
    const c = await espaco(`rn13${estado}`);
    const a = valor(await servico.receberMensagem(c.ws, c.canalId, evento({ idExterno: "ext-a" })));
    await pool().query("update plataforma.contatos set estado = $3 where workspace_id = $1 and id = $2", [c.ws, a.contatoId, estado]);

    const b = valor(await servico.receberMensagem(c.ws, c.canalId, evento({ idExterno: "ext-b" })));
    expect(b.contatoNovo).toBe(false);
    expect(b.contatoId).toBe(a.contatoId);
    const contato = (await pool().query<{ estado: string }>("select estado from plataforma.contatos where workspace_id = $1 and id = $2", [c.ws, a.contatoId])).rows[0]!;
    expect(contato.estado).toBe("ativo");
    expect(await contar(c.ws, "mensagens")).toBe(2);
  });

  describe("a Mensagem digitada no celular do Canal (4.4.2)", () => {
    const doCelular = (extras: Partial<RecebidaDoProvedor> = {}) =>
      evento({ idExterno: "cel-1", conteudo: "respondi pelo celular", remetente: { tipo: "whatsapp", valor: WHATSAPP_DA_ANA }, digitadaNoAparelho: true, ...extras });

    it("para um número sem Contato: abre Contato (com o número por nome), Conversa e uma Mensagem `enviada` pelo Canal", async () => {
      const c = await espaco("cel-novo");
      const r = valor(await servico.receberMensagem(c.ws, c.canalId, doCelular()));
      expect(r).toMatchObject({ contatoNovo: true, conversaNova: true, conversaReaberta: false, repetida: false });
      expect(r.mensagem).toMatchObject({
        direcao: "enviada",
        ator: { tipo: "integration", id: c.canalId },
        statusEntrega: "enviada",
        conteudo: "respondi pelo celular",
        idExterno: "cel-1",
        remetenteExterno: null,
        identificadorId: null,
      });
      expect(r.conversa.titulo).toBe(WHATSAPP_DA_ANA);
      expect(await contar(c.ws, "mensagens")).toBe(1);
    });

    it("na Conversa aberta do par: entra no mesmo fio, depois da recebida, sem mexer no Contato nem na Conversa", async () => {
      const c = await espaco("cel-aberta");
      const a = valor(await servico.receberMensagem(c.ws, c.canalId, evento({ idExterno: "ext-a" })));
      const b = valor(await servico.receberMensagem(c.ws, c.canalId, doCelular({ criadoEm: new Date(Date.now() + 1_000).toISOString() })));
      expect(b).toMatchObject({ contatoNovo: false, conversaNova: false, conversaReaberta: false });
      expect(b.conversa.id).toBe(a.conversa.id);
      expect(b.contatoId).toBe(a.contatoId);
      const contato = (await pool().query<{ nome: string }>("select nome from plataforma.contatos where workspace_id = $1 and id = $2", [c.ws, a.contatoId])).rows[0]!;
      expect(contato.nome).toBe("Ana");
      expect((await lerConversa(c.ws, a.conversa.id)).reaberturas).toBe(0);
      const fio = (await pool().query<{ direcao: string }>("select direcao from plataforma.mensagens where workspace_id = $1 and conversa_id = $2 order by criado_em, seq", [c.ws, a.conversa.id])).rows;
      expect(fio.map((m) => m.direcao)).toEqual(["recebida", "enviada"]);
    });

    it("a Conversa resolvida dentro da janela NÃO é reaberta: a Mensagem entra nela e ela continua resolvida", async () => {
      const c = await espaco("cel-resolvida");
      const a = valor(await servico.receberMensagem(c.ws, c.canalId, evento({ idExterno: "ext-a" })));
      await prepararConversa(c.ws, a.conversa.id, { situacao: "resolvida", resolvidaHaHoras: 10 });
      const b = valor(await servico.receberMensagem(c.ws, c.canalId, doCelular()));
      expect(b).toMatchObject({ conversaNova: false, conversaReaberta: false });
      expect(b.conversa.id).toBe(a.conversa.id);
      expect(await lerConversa(c.ws, a.conversa.id)).toMatchObject({ situacao: "resolvida", reaberturas: 0 });
      expect(await contar(c.ws, "conversas")).toBe(1);
    });

    it("a Conversa pendente continua pendente e adiada (responder pelo celular não a acorda)", async () => {
      const c = await espaco("cel-pendente");
      const a = valor(await servico.receberMensagem(c.ws, c.canalId, evento({ idExterno: "ext-a" })));
      await prepararConversa(c.ws, a.conversa.id, { situacao: "pendente", adiada: true });
      const b = valor(await servico.receberMensagem(c.ws, c.canalId, doCelular()));
      expect(b.conversa.id).toBe(a.conversa.id);
      const depois = await lerConversa(c.ws, a.conversa.id);
      expect(depois).toMatchObject({ situacao: "pendente", reaberturas: 0 });
      expect(depois.adiada_ate).not.toBeNull();
    });

    it("a resolvida há 80 h (fora da janela de 72 h) ou na lixeira não recebe: abre outra Conversa e a antiga fica como está", async () => {
      const c = await espaco("cel-fora");
      const a = valor(await servico.receberMensagem(c.ws, c.canalId, evento({ idExterno: "ext-a" })));
      await prepararConversa(c.ws, a.conversa.id, { situacao: "resolvida", resolvidaHaHoras: 80 });
      const b = valor(await servico.receberMensagem(c.ws, c.canalId, doCelular({ idExterno: "cel-b" })));
      expect(b).toMatchObject({ conversaNova: true, contatoNovo: false });
      expect(b.conversa.id).not.toBe(a.conversa.id);
      expect((await lerConversa(c.ws, a.conversa.id)).situacao).toBe("resolvida");

      await prepararConversa(c.ws, b.conversa.id, { situacao: "resolvida", resolvidaHaHoras: 1, naLixeira: true });
      await prepararConversa(c.ws, a.conversa.id, { situacao: "resolvida", resolvidaHaHoras: 100 });
      const d = valor(await servico.receberMensagem(c.ws, c.canalId, doCelular({ idExterno: "cel-d" })));
      expect(d.conversaNova).toBe(true);
      expect(await lerConversa(c.ws, b.conversa.id)).toMatchObject({ situacao: "resolvida", estado: "na_lixeira" });
    });

    it.each(["arquivado", "na_lixeira"] as const)("o Contato %s NÃO volta a ativo por uma Mensagem que a pessoa digitou (quem escreveu foi ela, não o Contato)", async (estado) => {
      const c = await espaco(`cel-${estado}`);
      const a = valor(await servico.receberMensagem(c.ws, c.canalId, evento({ idExterno: "ext-a" })));
      await pool().query("update plataforma.contatos set estado = $3 where workspace_id = $1 and id = $2", [c.ws, a.contatoId, estado]);
      const b = valor(await servico.receberMensagem(c.ws, c.canalId, doCelular()));
      expect(b.contatoId).toBe(a.contatoId);
      const contato = (await pool().query<{ estado: string }>("select estado from plataforma.contatos where workspace_id = $1 and id = $2", [c.ws, a.contatoId])).rows[0]!;
      expect(contato.estado).toBe(estado);
      expect(await contar(c.ws, "mensagens")).toBe(2);
    });

    it("o mesmo id externo entregue duas vezes grava uma Mensagem só (repetida)", async () => {
      const c = await espaco("cel-repetida");
      valor(await servico.receberMensagem(c.ws, c.canalId, doCelular()));
      const segunda = valor(await servico.receberMensagem(c.ws, c.canalId, doCelular()));
      expect(segunda.repetida).toBe(true);
      expect(await contar(c.ws, "mensagens")).toBe(1);
      expect(await contar(c.ws, "contatos")).toBe(1);
    });

    it("o Contato mesclado continua recusado (409): a Mensagem não cai num Contato que já não existe", async () => {
      const c = await espaco("cel-mesclado");
      const a = valor(await servico.receberMensagem(c.ws, c.canalId, evento({ idExterno: "ext-a" })));
      const sobrevivente = valor(await servico.receberMensagem(c.ws, c.canalId, evento({ idExterno: "ext-s", remetente: { tipo: "whatsapp", valor: "+5511955556666", nomeExibido: "Bia" } })));
      await pool().query(
        "update plataforma.contatos set estado = 'mesclado', mesclado_em_id = $3, mesclado_em = now() where workspace_id = $1 and id = $2",
        [c.ws, a.contatoId, sobrevivente.contatoId],
      );
      expect(recusado(await servico.receberMensagem(c.ws, c.canalId, doCelular()))).toMatchObject({ status: 409, codigo: "CONTATO_MESCLADO" });
    });
  });

  it("o Contato mesclado recusa com 409 CONTATO_MESCLADO e não grava Mensagem", async () => {
    const c = await espaco("mesclado");
    const a = valor(await servico.receberMensagem(c.ws, c.canalId, evento({ idExterno: "ext-a" })));
    const sobrevivente = valor(await servico.receberMensagem(c.ws, c.canalId, evento({ idExterno: "ext-s", remetente: { tipo: "whatsapp", valor: "+5511955556666", nomeExibido: "Bia" } })));
    await pool().query(
      "update plataforma.contatos set estado = 'mesclado', mesclado_em_id = $3, mesclado_em = now() where workspace_id = $1 and id = $2",
      [c.ws, a.contatoId, sobrevivente.contatoId],
    );

    const r = recusado(await servico.receberMensagem(c.ws, c.canalId, evento({ idExterno: "ext-b" })));
    expect(r).toMatchObject({ status: 409, codigo: "CONTATO_MESCLADO" });
    expect(await contar(c.ws, "mensagens")).toBe(2);
  });

  it("dois recebimentos simultâneos do mesmo número novo terminam com um Contato, uma Conversa e duas Mensagens (Pitfall 11)", async () => {
    const c = await espaco("corrida");
    const [x, y] = await Promise.all([
      servico.receberMensagem(c.ws, c.canalId, evento({ idExterno: "ext-x", conteudo: "primeira" })),
      servico.receberMensagem(c.ws, c.canalId, evento({ idExterno: "ext-y", conteudo: "segunda" })),
    ]);
    const a = valor(x);
    const b = valor(y);

    expect(a.contatoId).toBe(b.contatoId);
    expect(a.conversa.id).toBe(b.conversa.id);
    expect([a.contatoNovo, b.contatoNovo].filter(Boolean)).toHaveLength(1);
    expect(await contar(c.ws, "contatos")).toBe(1);
    expect(await contar(c.ws, "conversas")).toBe(1);
    expect(await contar(c.ws, "mensagens")).toBe(2);
  });

  it("dois recebimentos simultâneos do mesmo id externo gravam uma Mensagem só e um deles volta repetida", async () => {
    const c = await espaco("corridamesmoid");
    const [x, y] = await Promise.all([
      servico.receberMensagem(c.ws, c.canalId, evento({ idExterno: "ext-igual" })),
      servico.receberMensagem(c.ws, c.canalId, evento({ idExterno: "ext-igual" })),
    ]);
    const resultados = [valor(x), valor(y)];

    expect(resultados.filter((r) => r.repetida)).toHaveLength(1);
    expect(await contar(c.ws, "contatos")).toBe(1);
    expect(await contar(c.ws, "conversas")).toBe(1);
    expect(await contar(c.ws, "mensagens")).toBe(1);
  });

  it("dois recebimentos simultâneos de um Contato que já existe, sem Conversa aberta, abrem uma Conversa só", async () => {
    const c = await espaco("corridaconversa");
    const a = valor(await servico.receberMensagem(c.ws, c.canalId, evento({ idExterno: "ext-a" })));
    await prepararConversa(c.ws, a.conversa.id, { situacao: "resolvida", resolvidaHaHoras: 200 });

    const [x, y] = await Promise.all([
      servico.receberMensagem(c.ws, c.canalId, evento({ idExterno: "ext-x" })),
      servico.receberMensagem(c.ws, c.canalId, evento({ idExterno: "ext-y" })),
    ]);
    expect(valor(x).conversa.id).toBe(valor(y).conversa.id);
    expect(await contar(c.ws, "contatos")).toBe(1);
    expect(await contar(c.ws, "conversas")).toBe(2);
    expect(await contar(c.ws, "mensagens")).toBe(3);
  });

  /** Espera até uma consulta estar bloqueada esperando um lock (a corrida foi montada de verdade). */
  async function esperarBloqueio() {
    for (let i = 0; i < 60; i += 1) {
      const { rows } = await pool().query("select 1 from pg_stat_activity where wait_event_type = 'Lock' and datname = current_database()");
      if (rows.length > 0) return;
      await new Promise((resolver) => setTimeout(resolver, 50));
    }
    throw new Error("a corrida não bloqueou: o recebimento não chegou ao INSERT");
  }

  it("perder a corrida do Identificador (23505 em contato_identificadores_unico) refaz a transação e cai no Contato que ganhou", async () => {
    const c = await espaco("retryident");
    const rival = await pool().connect();
    try {
      await rival.query("begin");
      const { rows } = await rival.query<{ id: string }>(
        `insert into plataforma.contatos (workspace_id, nome, modo_criacao, proprietario_id, criado_por)
         values ($1, 'Rival', 'automatico_mensagem', 'mem_dona', 'mem_dona') returning id`,
        [c.ws],
      );
      const rivalId = rows[0]!.id;
      await rival.query("insert into plataforma.contato_identificadores (workspace_id, contato_id, tipo, valor, principal) values ($1, $2, 'whatsapp', $3, true)", [
        c.ws,
        rivalId,
        WHATSAPP_DA_ANA,
      ]);

      const pendente = servico.receberMensagem(c.ws, c.canalId, evento({ idExterno: "ext-r" }));
      await esperarBloqueio();
      await rival.query("commit");

      const r = valor(await pendente);
      expect(r).toMatchObject({ contatoNovo: false, conversaNova: true, repetida: false });
      expect(r.contatoId).toBe(rivalId);
      expect(await contar(c.ws, "contatos")).toBe(1);
      expect(await contar(c.ws, "mensagens")).toBe(1);
    } finally {
      rival.release();
    }
  });

  // A FK da Conversa nova pega `for key share` no Contato, e o `for update` do recebimento espera por ela:
  // a corrida da Conversa se resolve ali, sem chegar ao 23505 de conversas_nao_resolvida_uq (que fica de rede).
  it("uma Conversa aberta por outra transação no meio do recebimento é usada, não duplicada", async () => {
    const c = await espaco("retryconversa");
    const a = valor(await servico.receberMensagem(c.ws, c.canalId, evento({ idExterno: "ext-a" })));
    await prepararConversa(c.ws, a.conversa.id, { situacao: "resolvida", resolvidaHaHoras: 200 });

    const rival = await pool().connect();
    try {
      await rival.query("begin");
      const { rows } = await rival.query<{ id: string }>(
        `insert into plataforma.conversas (workspace_id, canal_id, contato_id, titulo, criado_por_tipo, criado_por_id)
         values ($1, $2, $3, 'Rival', 'integration', $2) returning id`,
        [c.ws, c.canalId, a.contatoId],
      );
      const rivalId = rows[0]!.id;

      const pendente = servico.receberMensagem(c.ws, c.canalId, evento({ idExterno: "ext-b" }));
      await esperarBloqueio();
      await rival.query("commit");

      const r = valor(await pendente);
      expect(r).toMatchObject({ conversaNova: false, contatoNovo: false });
      expect(r.conversa.id).toBe(rivalId);
      expect(await contar(c.ws, "conversas")).toBe(2);
    } finally {
      rival.release();
    }
  });
});
