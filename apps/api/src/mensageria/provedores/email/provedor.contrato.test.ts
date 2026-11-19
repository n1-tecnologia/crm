/**
 * O provedor de e-mail contra o conjunto de contrato do 16-02 (com `semWebhook`, D-17-10) e os casos que só ele tem: a recusa
 * de TODA chamada de webhook, a tradução do corpo que o leitor enfileira e o anexo relido da caixa pela referência
 * `<uidValidity>:<uid>:<índice>`. Os dublês de IMAP e SMTP no lugar do servidor da pessoa; sem banco (a conta é de memória).
 *
 *   DATABASE_URL= DATABASE_URL_MIGRACAO= npx vitest run src/mensageria/provedores/email/provedor.contrato.test.ts
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import MailComposer from "nodemailer/lib/mail-composer";
import type { Canal } from "@n1/dominio/crm/canais";
import { criarArmazenamentoFalso } from "../../../testes/armazenamento-falso";
import { iniciarServidorDeEmailFalso, PASTA_DE_ENVIADOS_FALSA, type ServidorDeEmailFalso } from "../../../testes/servidor-de-email-falso";
import { descreverContratoDoProvedor } from "../../contrato-do-provedor";
import { ErroDeProvedor, type CanalParaProvedor, type ChamadaDoWebhook, type ProvedorDeMensageria } from "../../provedor";
import { criarAcessoDoEmail } from "./credencial";
import { criarFabricaDeConexao, type FabricaDeConexao } from "./fabrica-de-conexao";
import { criarProvedorDeEmail } from "./provedor";
import { criarPoliticaDeRede, POLITICA_DE_PRODUCAO, type Resolvedor } from "./rede";
import type { ContaDeEmail } from "./repositorio";
import type { CorpoDoEmail } from "./traduzir";

const ENDERECO = "vendas@caixa.teste";
const SENHA = "senha-do-contrato-17-09";
const AGORA = new Date("2026-11-19T12:00:00.000Z").toISOString();

function canalDeEmail(): CanalParaProvedor {
  const canal: Canal = {
    id: "canal_contrato_email",
    nome: "Vendas",
    tipo: "email",
    provedor: "email-imap-smtp",
    identificadorExterno: ENDERECO,
    conexao: "conectada",
    conexaoSimulada: false,
    conectadaEm: AGORA,
    estado: "ativo",
    arquivadoEm: null,
    configuradoPor: "mem_teste",
    filaPadraoId: null,
    proprietarioPadraoId: null,
    origemPadraoId: null,
    gruposHabilitados: false,
    criadoPor: "mem_teste",
    criadoEm: AGORA,
    atualizadoEm: AGORA,
  };
  return {
    workspaceId: "ws_contrato_email",
    canal,
    segredoDoWebhook: "segredo-do-webhook-do-contrato",
    credencial: JSON.stringify({ v: 1, tipo: "senha", usuario: ENDERECO, senha: SENHA }),
  };
}

function contaDe(caixa: ServidorDeEmailFalso): ContaDeEmail {
  return {
    workspaceId: "ws_contrato_email",
    canalId: "canal_contrato_email",
    endereco: ENDERECO,
    tipoDeLogin: "senha",
    imap: { host: "imap.caixa.teste", porta: caixa.imap.porta },
    smtp: { host: "smtp.caixa.teste", porta: caixa.smtp.porta },
    contaExternaId: null,
    appendEnviados: "nao",
    pastaEnviados: PASTA_DE_ENVIADOS_FALSA,
    motivoDaQueda: null,
    caiuEm: null,
    conectadaPor: "mem_teste",
    conectadaEm: AGORA,
  };
}

function fabricaDe(caixa: ServidorDeEmailFalso): FabricaDeConexao {
  return criarFabricaDeConexao({
    resolver: vi.fn<Resolvedor>(async () => [{ address: "127.0.0.1", family: 4 }]),
    politica: criarPoliticaDeRede({ permitir: ["127.0.0.1"] }),
    portas: { imap: { [caixa.imap.porta]: "tls" }, smtp: { [caixa.smtp.porta]: "tls" } },
    ca: caixa.ca,
  });
}

async function montar(opcoes: { fabrica?: (caixa: ServidorDeEmailFalso) => FabricaDeConexao } = {}) {
  const caixa = await iniciarServidorDeEmailFalso({ usuarios: [{ usuario: ENDERECO, senha: SENHA }] });
  const fabrica = opcoes.fabrica?.(caixa) ?? fabricaDe(caixa);
  const provedor = criarProvedorDeEmail({
    fabrica,
    acesso: criarAcessoDoEmail(),
    armazenamento: criarArmazenamentoFalso(),
    contas: async () => contaDe(caixa),
    registrarQueda: async () => undefined,
  });
  return { caixa, fabrica, provedor };
}

/** O `UIDVALIDITY` da INBOX do dublê, como o leitor o lê. */
async function uidValidityDe(caixa: ServidorDeEmailFalso, fabrica: FabricaDeConexao): Promise<string> {
  const lido = await fabrica.verificarImap({
    host: "imap.caixa.teste",
    porta: caixa.imap.porta,
    auth: { tipo: "senha", usuario: ENDERECO, senha: SENHA },
  });
  return lido.uidValidity;
}

const PDF = Buffer.from("%PDF-1.4\n" + "x".repeat(300), "utf8");

/** Um e-mail com um PDF anexado, em bytes. */
async function emailComAnexo(nome = "orçamento.pdf", conteudo: Buffer = PDF): Promise<Buffer> {
  return new MailComposer({
    from: "cliente@fora.teste",
    to: ENDERECO,
    subject: "Com anexo",
    messageId: "<com-anexo@fora.teste>",
    text: "Segue.",
    attachments: [{ filename: nome, contentType: "application/pdf", content: conteudo }],
  })
    .compile()
    .build();
}

/** O corpo `v: 1` que o leitor enfileira para um e-mail de texto. */
const corpoDeTexto = (): CorpoDoEmail => ({
  v: 1,
  messageId: "contrato-1@fora.teste",
  uid: 7,
  uidValidity: "1700000000",
  data: AGORA,
  de: { endereco: "pessoa@caixa.teste", nome: "Pessoa" },
  para: [{ endereco: ENDERECO }],
  cc: [],
  assunto: "Olá",
  inReplyTo: [],
  references: [],
  texto: "Bom dia.",
  anexos: [],
});

const chamadaDe = (corpo: unknown): ChamadaDoWebhook => ({
  cabecalhos: { "x-n1-webhook-segredo": "segredo-do-webhook-do-contrato" },
  corpoCru: Buffer.from(JSON.stringify(corpo)),
  corpo,
});

descreverContratoDoProvedor("e-mail", async () => {
  const { caixa, fabrica, provedor } = await montar();
  const canal = canalDeEmail();
  return {
    provedor,
    canal,
    semWebhook: true,
    chamadaDeTexto: () => chamadaDe(corpoDeTexto()),
    chamadasRecusadas: () => [
      { nome: "segredo errado no cabeçalho", chamada: { ...chamadaDe(corpoDeTexto()), cabecalhos: { "x-n1-webhook-segredo": "outro" } }, canal },
      { nome: "Canal sem segredo", chamada: chamadaDe(corpoDeTexto()), canal: { ...canal, segredoDoWebhook: undefined } as unknown as CanalParaProvedor },
      { nome: "corpo de leitor falsificado por quem chama", chamada: chamadaDe({ ...corpoDeTexto(), messageId: "forjado@fora.teste" }), canal },
    ],
    remetenteValido: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    destinoDoEnvio: { tipo: "email", valor: "pessoa@caixa.teste" },
    segredos: [SENHA],
    prepararEnvioAceito: async () => undefined,
    prepararMidiaGrande: async (tetoBytes) => {
      const uid = await caixa.adicionarMensagem(ENDERECO, await emailComAnexo("grande.pdf", Buffer.from("%PDF-" + "y".repeat(tetoBytes + 64), "utf8")));
      return `${await uidValidityDe(caixa, fabrica)}:${uid}:0`;
    },
    encerrar: async () => caixa.fechar(),
  };
});

describe("o provedor de e-mail: o que só ele tem", () => {
  let aFechar: ServidorDeEmailFalso | undefined;
  afterEach(async () => {
    await aFechar?.fechar();
    aFechar = undefined;
  });

  const codigoDe = async (promessa: Promise<unknown>): Promise<string | undefined> =>
    promessa.then(
      () => undefined,
      (erro: unknown) => (erro instanceof ErroDeProvedor ? erro.codigo : `outro:${String(erro)}`),
    );

  it("declara semWebhook e recusa TODA chamada, até a que traz o segredo certo do Canal", async () => {
    const m = await montar();
    aFechar = m.caixa;
    expect(m.provedor.provedor).toBe("email-imap-smtp");
    expect(m.provedor.semWebhook).toBe(true);
    const canal = canalDeEmail();
    expect(m.provedor.verificarChamada(chamadaDe(corpoDeTexto()), canal)).toBe(false);
    expect(m.provedor.verificarChamada({ ...chamadaDe(corpoDeTexto()), cabecalhos: {} }, canal)).toBe(false);
  });

  it("traduz o corpo do leitor em uma mensagem com id, assunto e remetente, e a chave da fila é o Message-ID", async () => {
    const m = await montar();
    aFechar = m.caixa;
    const eventos = m.provedor.interpretarChamada(corpoDeTexto(), canalDeEmail());
    expect(eventos).toHaveLength(1);
    expect(eventos[0]).toMatchObject({
      tipo: "mensagem",
      idExterno: "contrato-1@fora.teste",
      assunto: "Olá",
      conteudo: "Bom dia.",
      remetente: { tipo: "email", valor: "pessoa@caixa.teste" },
    });
    expect(m.provedor.chaveDaChamada?.(corpoDeTexto())).toBe("contrato-1@fora.teste");
    expect(m.provedor.chaveDaChamada?.({ lixo: true })).toBeUndefined();
  });

  it("o estado da conexão é o do Canal", async () => {
    const m = await montar();
    aFechar = m.caixa;
    const canal = canalDeEmail();
    expect(await m.provedor.estadoDaConexao(canal)).toBe("conectada");
    expect(await m.provedor.estadoDaConexao({ ...canal, canal: { ...canal.canal, conexao: "desconectada" } })).toBe("desconectada");
  });

  describe("baixarMidia relê o anexo da caixa pela referência uidValidity:uid:índice", () => {
    it("devolve os bytes, o tipo e o nome do anexo, mesmo sem ele ter sido guardado antes", async () => {
      const m = await montar();
      aFechar = m.caixa;
      const uid = await m.caixa.adicionarMensagem(ENDERECO, await emailComAnexo());
      const validity = await uidValidityDe(m.caixa, m.fabrica);

      const midia = await m.provedor.baixarMidia(canalDeEmail(), `${validity}:${uid}:0`, { tetoBytes: 1_000_000 });

      expect(Buffer.from(midia.bytes).equals(PDF)).toBe(true);
      expect(midia).toMatchObject({ tipoDeMidia: "application/pdf", nome: "orçamento.pdf" });
    });

    it("teto menor que o anexo é MIDIA_GRANDE_DEMAIS", async () => {
      const m = await montar();
      aFechar = m.caixa;
      const uid = await m.caixa.adicionarMensagem(ENDERECO, await emailComAnexo());
      const validity = await uidValidityDe(m.caixa, m.fabrica);
      expect(await codigoDe(m.provedor.baixarMidia(canalDeEmail(), `${validity}:${uid}:0`, { tetoBytes: 10 }))).toBe("MIDIA_GRANDE_DEMAIS");
    });

    it("UIDVALIDITY diferente (a caixa foi recriada), UID que sumiu, índice que não existe e referência torta são MIDIA_INDISPONIVEL", async () => {
      const m = await montar();
      aFechar = m.caixa;
      const uid = await m.caixa.adicionarMensagem(ENDERECO, await emailComAnexo());
      const validity = await uidValidityDe(m.caixa, m.fabrica);
      const canal = canalDeEmail();

      expect(await codigoDe(m.provedor.baixarMidia(canal, `${validity}:9999:0`, { tetoBytes: 1_000_000 }))).toBe("MIDIA_INDISPONIVEL");
      expect(await codigoDe(m.provedor.baixarMidia(canal, `${validity}:${uid}:5`, { tetoBytes: 1_000_000 }))).toBe("MIDIA_INDISPONIVEL");
      expect(await codigoDe(m.provedor.baixarMidia(canal, `${validity}:${uid}:texto`, { tetoBytes: 1_000_000 }))).toBe("MIDIA_INDISPONIVEL");
      expect(await codigoDe(m.provedor.baixarMidia(canal, "lixo", { tetoBytes: 1_000_000 }))).toBe("MIDIA_INDISPONIVEL");
      expect(await codigoDe(m.provedor.baixarMidia(canal, `${validity}:0:0`, { tetoBytes: 1_000_000 }))).toBe("MIDIA_INDISPONIVEL");

      await m.caixa.recriarCaixa(ENDERECO);
      expect(await codigoDe(m.provedor.baixarMidia(canal, `${validity}:${uid}:0`, { tetoBytes: 1_000_000 }))).toBe("MIDIA_INDISPONIVEL");
    });

    it("a caixa que não responde é PROVEDOR_INDISPONIVEL e o erro não carrega host nem usuário", async () => {
      const m = await montar();
      aFechar = m.caixa;
      const portaFechada = await montar();
      const referencia = "1:1:0";
      await portaFechada.caixa.fechar();
      const erro = await portaFechada.provedor.baixarMidia(canalDeEmail(), referencia, { tetoBytes: 1_000 }).then(
        () => undefined,
        (e: unknown) => e,
      );
      expect(erro).toBeInstanceOf(ErroDeProvedor);
      expect((erro as ErroDeProvedor).codigo).toBe("PROVEDOR_INDISPONIVEL");
      const texto = `${(erro as Error).message} ${(erro as Error).stack ?? ""}`;
      for (const segredo of [SENHA, ENDERECO, "caixa.teste", "127.0.0.1"]) expect(texto).not.toContain(segredo);
    });

    it("o servidor que passou a resolver para a rede interna é recusado (a guarda vale também para reler o anexo)", async () => {
      const m = await montar({
        fabrica: (caixa) =>
          criarFabricaDeConexao({
            resolver: async () => [{ address: "10.1.2.3", family: 4 }],
            politica: POLITICA_DE_PRODUCAO,
            portas: { imap: { [caixa.imap.porta]: "tls" }, smtp: { [caixa.smtp.porta]: "tls" } },
            ca: caixa.ca,
          }),
      });
      aFechar = m.caixa;
      expect(await codigoDe(m.provedor.baixarMidia(canalDeEmail(), "1:1:0", { tetoBytes: 1_000 }))).toBe("PROVEDOR_INDISPONIVEL");
      expect(m.caixa.conexoesImap()).toHaveLength(0);
    });

    it("a senha que a caixa recusa (ou a credencial ausente) nunca vira texto de erro com a senha", async () => {
      const m = await montar();
      aFechar = m.caixa;
      const canalComOutraSenha: CanalParaProvedor = {
        ...canalDeEmail(),
        credencial: JSON.stringify({ v: 1, tipo: "senha", usuario: ENDERECO, senha: "senha-errada-do-teste" }),
      };
      const erro = await m.provedor.baixarMidia(canalComOutraSenha, "1:1:0", { tetoBytes: 1_000 }).then(
        () => undefined,
        (e: unknown) => e,
      );
      expect(erro).toBeInstanceOf(ErroDeProvedor);
      expect(`${(erro as Error).message}`).not.toContain("senha-errada-do-teste");
      const semCredencial: CanalParaProvedor = { ...canalDeEmail() };
      delete (semCredencial as { credencial?: string }).credencial;
      expect(await codigoDe(m.provedor.baixarMidia(semCredencial, "1:1:0", { tetoBytes: 1_000 }))).toBe("CREDENCIAL_AUSENTE");
    });
  });

  it("o provedor é um ProvedorDeMensageria completo (idExternoDoEnvio inclusive)", async () => {
    const m = await montar();
    aFechar = m.caixa;
    const p: ProvedorDeMensageria = m.provedor;
    expect(p.idExternoDoEnvio?.(canalDeEmail(), { mensagemId: "m_9", destino: { tipo: "email", valor: "a@b.com" } })).toBe("n1.m_9@caixa.teste");
  });
});
