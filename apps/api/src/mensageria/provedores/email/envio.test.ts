/**
 * A saída do e-mail (Fase 17, 17-09) contra os dublês de IMAP e SMTP de 17-02, SEM banco: a conta e a queda são injetadas.
 *
 *   DATABASE_URL= DATABASE_URL_MIGRACAO= npx vitest run src/mensageria/provedores/email/envio.test.ts
 *
 * O que está em jogo é o que sai e o que nunca pode sair: a cópia oculta só no envelope (A6), o cabeçalho que ninguém forja por
 * assunto, endereço ou nome de arquivo, os arquivos do bucket pela chave, o teto de 20 MB, o desfecho de cada resposta do
 * servidor (recusa limpa x ambíguo, que nunca é reenviado), a senha que mudou e a cópia em Enviados.
 */

import { simpleParser } from "mailparser";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Canal } from "@n1/dominio/crm/canais";
import { FRASE_DO_TETO_DO_EMAIL, TETO_DO_EMAIL_ENVIADO_BYTES } from "@n1/dominio/crm/mensagens";
import { criarArmazenamentoFalso, type ArmazenamentoFalso } from "../../../testes/armazenamento-falso";
import { iniciarServidorDeEmailFalso, PASTA_DE_ENVIADOS_FALSA, type ServidorDeEmailFalso } from "../../../testes/servidor-de-email-falso";
import { CODIGO_DO_CANAL_DESCONECTADO } from "../../fila-de-saida";
import type { CanalParaProvedor, EnvioAoProvedor, ResultadoDoEnvio } from "../../provedor";
import { criarAcessoDoEmail, type AcessoDoEmail } from "./credencial";
import { criarEnvioDeEmail, deveGuardarEmEnviados, FRASE_DA_SENHA_RECUSADA_NO_ENVIO, type DependenciasDoEnvioDeEmail } from "./envio";
import { criarFabricaDeConexao, type FabricaDeConexao } from "./fabrica-de-conexao";
import { criarPoliticaDeRede, POLITICA_DE_PRODUCAO, type Resolvedor } from "./rede";
import type { ContaDeEmail } from "./repositorio";

const ENDERECO = "vendas@caixa.teste";
const SENHA = "senha-secreta-do-envio-17-09";
const CLIENTE = "cliente@empresa.com";
const AGORA = new Date("2026-11-19T12:00:00.000Z").toISOString();

const PDF = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34, 0x0a, 1, 2, 3, 4, 5]);
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 9, 8, 7, 6]);

function canalDeEmail(senha = SENHA): CanalParaProvedor {
  const canal: Canal = {
    id: "canal_email_envio",
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
  return { workspaceId: "ws_email_envio", canal, credencial: JSON.stringify({ v: 1, tipo: "senha", usuario: ENDERECO, senha }) };
}

function conta(caixa: ServidorDeEmailFalso, extras: Partial<ContaDeEmail> = {}): ContaDeEmail {
  return {
    workspaceId: "ws_email_envio",
    canalId: "canal_email_envio",
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
    ...extras,
  };
}

const envio = (extras: Partial<EnvioAoProvedor> = {}): EnvioAoProvedor => ({
  mensagemId: "msg_1",
  destino: { tipo: "email", valor: CLIENTE },
  conteudo: "Segue o orçamento.",
  assunto: "Re: Pedido 42",
  ...extras,
});

let servidores: ServidorDeEmailFalso[] = [];
afterEach(async () => {
  for (const s of servidores) await s.fechar();
  servidores = [];
});

async function montar(
  opcoes: {
    senhaDoServidor?: string;
    conta?: Partial<ContaDeEmail>;
    acesso?: AcessoDoEmail;
    fabrica?: (caixa: ServidorDeEmailFalso) => FabricaDeConexao;
    socketMs?: number;
    registrarQueda?: DependenciasDoEnvioDeEmail["registrarQueda"];
    contas?: DependenciasDoEnvioDeEmail["contas"];
  } = {},
) {
  const caixa = await iniciarServidorDeEmailFalso({ usuarios: [{ usuario: ENDERECO, senha: opcoes.senhaDoServidor ?? SENHA }] });
  servidores.push(caixa);
  const fabrica =
    opcoes.fabrica?.(caixa) ??
    criarFabricaDeConexao({
      resolver: vi.fn<Resolvedor>(async () => [{ address: "127.0.0.1", family: 4 }]),
      politica: criarPoliticaDeRede({ permitir: ["127.0.0.1"] }),
      portas: { imap: { [caixa.imap.porta]: "tls" }, smtp: { [caixa.smtp.porta]: "tls" } },
      ca: caixa.ca,
      ...(opcoes.socketMs === undefined ? {} : { tempos: { envio: { conectarMs: 5_000, saudacaoMs: 5_000, socketMs: opcoes.socketMs } } }),
    });
  const armazenamento: ArmazenamentoFalso = criarArmazenamentoFalso();
  const quedas: { alvo: { workspaceId: string; canalId: string }; motivo: string }[] = [];
  const registros: { nivel: string; mensagem: string; dados?: Record<string, unknown> | undefined }[] = [];
  const dependencias: DependenciasDoEnvioDeEmail = {
    fabrica,
    acesso: opcoes.acesso ?? criarAcessoDoEmail(),
    armazenamento,
    contas: opcoes.contas ?? (async () => conta(caixa, opcoes.conta)),
    registrarQueda:
      opcoes.registrarQueda ??
      (async (alvo, motivo) => {
        quedas.push({ alvo, motivo });
      }),
    registrar: (nivel, mensagem, dados) => registros.push({ nivel, mensagem, dados }),
  };
  const provedor = criarEnvioDeEmail(dependencias);
  const resultados: ResultadoDoEnvio[] = [];
  const enviar = async (canal: CanalParaProvedor, e: EnvioAoProvedor) => {
    const r = await provedor.enviar(canal, e);
    resultados.push(r);
    return r;
  };
  return { caixa, armazenamento, quedas, registros, provedor, enviar, resultados };
}

/** O bloco de cabeçalhos do `DATA` (até a primeira linha em branco). */
function cabecalhosDo(dados: Buffer): string {
  const texto = dados.toString("utf8");
  const fim = texto.search(/\r?\n\r?\n/);
  return fim === -1 ? texto : texto.slice(0, fim);
}

describe("o envelope e o que NUNCA vai ao MIME (A6, T-17-35)", () => {
  it("a cópia oculta entra no envelope e o DATA não tem Bcc nem o endereço dela", async () => {
    const m = await montar();
    const r = await m.enviar(
      canalDeEmail(),
      envio({
        enderecosAdicionais: [
          { tipo: "copia", endereco: "socio@empresa.com" },
          { tipo: "copiaOculta", endereco: "oculto@empresa.com" },
        ],
      }),
    );

    expect(r).toMatchObject({ ok: true });
    const entrega = m.caixa.entregues[0]!;
    expect(entrega.envelope.de).toBe(ENDERECO);
    expect([...entrega.envelope.para].sort()).toEqual(["cliente@empresa.com", "oculto@empresa.com", "socio@empresa.com"]);
    const texto = entrega.dados.toString("utf8");
    expect(texto).not.toMatch(/^bcc:/im);
    expect(texto).not.toContain("oculto@empresa.com");
    expect(cabecalhosDo(entrega.dados)).toMatch(/^Cc: socio@empresa\.com\r?$/m);
    expect(cabecalhosDo(entrega.dados)).toMatch(/^To: cliente@empresa\.com\r?$/m);
  });

  it("o mesmo endereço em Para, Cópia e Cópia oculta vai uma vez só, e o destinatário nunca é rebaixado a oculto", async () => {
    const m = await montar();
    await m.enviar(
      canalDeEmail(),
      envio({
        enderecosAdicionais: [
          { tipo: "copiaOculta", endereco: "CLIENTE@empresa.com" },
          { tipo: "para", endereco: "outro@empresa.com" },
          { tipo: "copia", endereco: "Outro@empresa.com" },
        ],
      }),
    );
    const entrega = m.caixa.entregues[0]!;
    expect([...entrega.envelope.para].sort()).toEqual(["cliente@empresa.com", "outro@empresa.com"]);
    expect(cabecalhosDo(entrega.dados)).toMatch(/^To: cliente@empresa\.com, outro@empresa\.com\r?$/m);
  });
});

describe("cabeçalho e comando não se forjam (injeção por CRLF)", () => {
  it("quebra de linha no assunto, no nome do endereço e no nome do arquivo nunca cria cabeçalho nem parte nova", async () => {
    const m = await montar();
    m.armazenamento.colocarPorChave("k/pdf", PDF, "application/pdf");
    const r = await m.enviar(
      canalDeEmail(),
      envio({
        assunto: "Orçamento\r\nBcc: alvo@fora.com\r\nX-Forjado: sim",
        enderecosAdicionais: [{ tipo: "copia", endereco: "socio@empresa.com", nomeExibido: "Sócio\r\nBcc: alvo2@fora.com" }],
        anexos: [{ urlAssinada: "https://x", tipoDeMidia: "application/pdf", nome: 'a"\r\nContent-Type: text/html\r\n\r\n<script>.pdf', objectKey: "k/pdf", tamanhoBytes: PDF.byteLength }],
      }),
    );

    expect(r).toMatchObject({ ok: true });
    const entrega = m.caixa.entregues[0]!;
    const cabecalhos = cabecalhosDo(entrega.dados);
    expect(cabecalhos).not.toMatch(/^bcc:/im);
    expect(cabecalhos).not.toMatch(/^x-forjado:/im);
    expect(entrega.dados.toString("utf8")).not.toMatch(/^bcc:/im);
    expect(entrega.envelope.para).not.toContain("alvo@fora.com");
    expect(entrega.envelope.para).not.toContain("alvo2@fora.com");

    const lido = await simpleParser(entrega.dados);
    expect(lido.subject).toBe("Orçamento Bcc: alvo@fora.com X-Forjado: sim");
    expect(lido.attachments).toHaveLength(1);
    expect(lido.attachments[0]!.filename).not.toMatch(/[\r\n]/);
    expect(lido.attachments[0]!.contentType).toBe("application/pdf");
  });

  it("endereço de destino, de cópia ou do Canal com CRLF, vírgula ou colchete é recusado sem abrir conexão", async () => {
    const m = await montar();
    const ruins = ["a@b.com\r\nBcc: x@y.com", "a@b.com>,x@y.com", "<a@b.com>", 'a"b@c.com', "a@b.com;x@y.com", "a b@c.com"];
    for (const ruim of ruins) {
      expect(await m.enviar(canalDeEmail(), envio({ destino: { tipo: "email", valor: ruim } })), ruim).toMatchObject({
        ok: false,
        transitorio: false,
        codigo: "DESTINO_INVALIDO",
      });
      expect(
        await m.enviar(canalDeEmail(), envio({ enderecosAdicionais: [{ tipo: "copiaOculta", endereco: ruim }] })),
        `oculto ${ruim}`,
      ).toMatchObject({ ok: false, transitorio: false, codigo: "DESTINO_INVALIDO" });
    }
    const canalRuim = canalDeEmail();
    const comEnderecoRuim: CanalParaProvedor = { ...canalRuim, canal: { ...canalRuim.canal, identificadorExterno: "a@b.com\r\nBcc: x@y.com" } };
    expect(await m.enviar(comEnderecoRuim, envio())).toMatchObject({ ok: false, transitorio: false, codigo: "REMETENTE_INVALIDO" });
    expect(m.caixa.conexoesSmtp()).toHaveLength(0);
    expect(m.caixa.entregues).toHaveLength(0);
  });

  it("o corpo vira HTML simples com tudo escapado: nenhuma tag do texto chega como tag", async () => {
    const m = await montar();
    await m.enviar(canalDeEmail(), envio({ conteudo: "<script>alert(1)</script> & \"aspas\" 'x'\nsegunda linha" }));
    const lido = await simpleParser(m.caixa.entregues[0]!.dados);
    expect(lido.text).toContain("<script>alert(1)</script>");
    expect(lido.html).not.toContain("<script");
    expect(lido.html).toContain("&lt;script&gt;alert(1)&lt;/script&gt; &amp; &quot;aspas&quot; &#39;x&#39;");
    expect(lido.html).toContain("<br>");
  });
});

describe("o fio: Message-ID, In-Reply-To e References", () => {
  it("o Message-ID é o idExternoDoEnvio (sem colchetes) e o fio leva os ids do mais antigo ao mais novo", async () => {
    const m = await montar();
    const e = envio({ referencias: ["a@x", "n1.b@caixa.teste", "c@x"], emRespostaAIdExterno: "c@x" });
    const r = await m.enviar(canalDeEmail(), e);

    expect(m.provedor.idExternoDoEnvio(canalDeEmail(), e)).toBe("n1.msg_1@caixa.teste");
    expect(r).toEqual({ ok: true, idExterno: "n1.msg_1@caixa.teste" });
    const cabecalhos = cabecalhosDo(m.caixa.entregues[0]!.dados);
    expect(cabecalhos).toMatch(/^Message-ID: <n1\.msg_1@caixa\.teste>\r?$/m);
    expect(cabecalhos).toMatch(/^In-Reply-To: <c@x>\r?$/m);
    expect(cabecalhos.replace(/\r?\n\s+/g, " ")).toMatch(/^References: <a@x> <n1\.b@caixa\.teste> <c@x>\r?$/m);
  });

  it("um id do fio com caractere de controle ou colchete é descartado, nunca vai ao cabeçalho", async () => {
    const m = await montar();
    await m.enviar(canalDeEmail(), envio({ referencias: ["a@x", "b@x\u0001y", "ok@x"], emRespostaAIdExterno: "ok@x" }));
    const cabecalhos = cabecalhosDo(m.caixa.entregues[0]!.dados);
    expect(cabecalhos).toMatch(/^In-Reply-To: <ok@x>\r?$/m);
    expect(cabecalhos).not.toContain("\u0001");
  });
});

describe("os anexos vêm do bucket pela chave (T-17-36, D-17-18)", () => {
  it("dois arquivos saem como partes com nome e tipo certos e os bytes do bucket, sem pedir URL", async () => {
    const m = await montar();
    m.armazenamento.colocarPorChave("ws/conversas/c1/orcamento.pdf", PDF, "application/pdf");
    m.armazenamento.colocarPorChave("ws/conversas/c1/logo.png", PNG, "image/png");

    const r = await m.enviar(
      canalDeEmail(),
      envio({
        anexos: [
          { urlAssinada: "https://nao-deve-ser-seguida.invalid/a", tipoDeMidia: "application/pdf", nome: "orçamento.pdf", objectKey: "ws/conversas/c1/orcamento.pdf", tamanhoBytes: PDF.byteLength },
          { urlAssinada: "https://nao-deve-ser-seguida.invalid/b", tipoDeMidia: "image/png", nome: "logo.png", objectKey: "ws/conversas/c1/logo.png", tamanhoBytes: PNG.byteLength },
        ],
      }),
    );

    expect(r).toMatchObject({ ok: true });
    const lido = await simpleParser(m.caixa.entregues[0]!.dados);
    expect(lido.attachments.map((a) => [a.filename, a.contentType])).toEqual([
      ["orçamento.pdf", "application/pdf"],
      ["logo.png", "image/png"],
    ]);
    expect(new Uint8Array(lido.attachments[0]!.content)).toEqual(PDF);
    expect(new Uint8Array(lido.attachments[1]!.content)).toEqual(PNG);
    expect(m.armazenamento.urlsEmitidas).toEqual([]);
  });

  it("a soma dos tamanhos acima de 20 MB é recusa permanente, sem baixar nada e sem abrir o SMTP", async () => {
    const m = await montar();
    const r = await m.enviar(
      canalDeEmail(),
      envio({
        anexos: [
          { urlAssinada: "x", tipoDeMidia: "application/pdf", nome: "a.pdf", objectKey: "k/a", tamanhoBytes: 12 * 1024 * 1024 },
          { urlAssinada: "x", tipoDeMidia: "application/pdf", nome: "b.pdf", objectKey: "k/b", tamanhoBytes: 9 * 1024 * 1024 },
        ],
      }),
    );
    expect(r).toEqual({ ok: false, transitorio: false, codigo: "EMAIL_GRANDE_DEMAIS", motivo: FRASE_DO_TETO_DO_EMAIL });
    expect(FRASE_DO_TETO_DO_EMAIL).toBe("O e-mail passa de 20 MB: muitos servidores recusam.");
    expect(m.caixa.conexoesSmtp()).toHaveLength(0);
  });

  it("o tamanho que o bucket de fato entrega é conferido de novo: o declarado menor não passa um arquivo maior", async () => {
    const m = await montar();
    m.armazenamento.colocarPorChave("k/grande", new Uint8Array(TETO_DO_EMAIL_ENVIADO_BYTES + 1), "application/pdf");
    const r = await m.enviar(
      canalDeEmail(),
      envio({ anexos: [{ urlAssinada: "x", tipoDeMidia: "application/pdf", nome: "g.pdf", objectKey: "k/grande", tamanhoBytes: 10 }] }),
    );
    expect(r).toEqual({ ok: false, transitorio: false, codigo: "EMAIL_GRANDE_DEMAIS", motivo: FRASE_DO_TETO_DO_EMAIL });
    expect(m.caixa.entregues).toHaveLength(0);
  });

  it("o bucket fora do ar é transitório (nada saiu) e a mensagem do erro dele nunca sobe", async () => {
    const m = await montar();
    const r = await m.enviar(
      canalDeEmail(),
      envio({ anexos: [{ urlAssinada: "x", tipoDeMidia: "application/pdf", nome: "a.pdf", objectKey: "chave/que/nao/existe", tamanhoBytes: 3 }] }),
    );
    expect(r).toMatchObject({ ok: false, transitorio: true, codigo: "ARMAZENAMENTO_INDISPONIVEL" });
    expect(JSON.stringify(r)).not.toContain("chave/que/nao/existe");
    expect(m.caixa.entregues).toHaveLength(0);
  });

  it("anexo sem chave do bucket nunca sai (o SMTP não segue URL)", async () => {
    const m = await montar();
    const r = await m.enviar(
      canalDeEmail(),
      envio({ anexos: [{ urlAssinada: "https://exemplo.invalid/a", tipoDeMidia: "application/pdf", nome: "a.pdf" }] }),
    );
    expect(r).toMatchObject({ ok: false, transitorio: false, codigo: "ANEXO_INDISPONIVEL" });
    expect(m.caixa.conexoesSmtp()).toHaveLength(0);
  });

  it("um tipo de mídia malformado vira application/octet-stream", async () => {
    const m = await montar();
    m.armazenamento.colocarPorChave("k/x", PDF, "application/pdf");
    await m.enviar(canalDeEmail(), envio({ anexos: [{ urlAssinada: "x", tipoDeMidia: "x\r\nBcc: a@b.com", nome: "x.bin", objectKey: "k/x", tamanhoBytes: 1 }] }));
    const lido = await simpleParser(m.caixa.entregues[0]!.dados);
    expect(lido.attachments[0]!.contentType).toBe("application/octet-stream");
    expect(m.caixa.entregues[0]!.dados.toString("utf8")).not.toMatch(/^bcc:/im);
  });
});

describe("o desfecho de cada resposta do servidor (D-17-16, T-17-37)", () => {
  it("destinatário recusado com 550 é permanente; com 450, transitório", async () => {
    const m = await montar();
    m.caixa.programarSmtp({ tipo: "recusarRcpt", codigo: 550 });
    expect(await m.enviar(canalDeEmail(), envio())).toMatchObject({ ok: false, transitorio: false, codigo: "SMTP_550" });
    m.caixa.programarSmtp({ tipo: "recusarRcpt", codigo: 450 });
    expect(await m.enviar(canalDeEmail(), envio())).toMatchObject({ ok: false, transitorio: true, codigo: "SMTP_450" });
    expect(m.caixa.entregues).toHaveLength(0);
  });

  it("recusa no DATA: 451 é transitório, 554 é permanente", async () => {
    const m = await montar();
    m.caixa.programarSmtp({ tipo: "recusarData", codigo: 451 });
    const transitoria = await m.enviar(canalDeEmail(), envio());
    expect(transitoria).toMatchObject({ ok: false, transitorio: true, codigo: "SMTP_451" });
    expect(transitoria).not.toHaveProperty("ambiguo");
    m.caixa.programarSmtp({ tipo: "recusarData", codigo: 554 });
    expect(await m.enviar(canalDeEmail(), envio())).toMatchObject({ ok: false, transitorio: false, codigo: "SMTP_554" });
  });

  it("o servidor mudo depois do DATA é ambíguo: o DATA chegou e nada é reenviado sozinho", async () => {
    const m = await montar({ socketMs: 700 });
    m.caixa.programarSmtp({ tipo: "mudoNoData" });
    const r = await m.enviar(canalDeEmail(), envio());
    expect(r).toMatchObject({ ok: false, transitorio: false, ambiguo: true });
    expect(m.caixa.entregues).toHaveLength(1);
    // Uma única tentativa: o provedor não repete (quem decide é a pessoa, por "Tentar de novo").
    expect(m.caixa.conexoesSmtp()).toHaveLength(1);
  }, 15_000);

  it("a conexão derrubada com o envio em curso também é ambígua", async () => {
    const m = await montar({ socketMs: 5_000 });
    m.caixa.programarSmtp({ tipo: "mudoNoData" });
    const pendente = m.enviar(canalDeEmail(), envio());
    await vi.waitFor(() => expect(m.caixa.entregues).toHaveLength(1), { timeout: 5_000 });
    m.caixa.derrubarConexoes();
    expect(await pendente).toMatchObject({ ok: false, transitorio: false, ambiguo: true });
  }, 15_000);

  it("dois destinatários, um recusado com 550 e o outro aceito: ok, e só a contagem é registrada", async () => {
    const m = await montar();
    m.caixa.programarSmtp({ tipo: "recusarRcpt", codigo: 550, enderecos: ["ruim@empresa.com"] });
    const r = await m.enviar(canalDeEmail(), envio({ enderecosAdicionais: [{ tipo: "para", endereco: "ruim@empresa.com" }] }));
    expect(r).toMatchObject({ ok: true });
    expect(m.caixa.entregues[0]!.envelope.para).toEqual(["cliente@empresa.com"]);
    expect(m.registros).toContainEqual({ nivel: "warn", mensagem: "email.envio.destinatarios_recusados", dados: { recusados: 1 } });
    expect(JSON.stringify(m.registros)).not.toContain("ruim@empresa.com");
  });

  it("servidor que não conecta (porta fechada) é transitório; certificado que não confere é permanente: nada saiu", async () => {
    const mFechado = await montar();
    const porta = mFechado.caixa.smtp.porta;
    await mFechado.caixa.fechar();
    servidores = servidores.filter((s) => s !== mFechado.caixa);
    const semServidor = await mFechado.enviar(canalDeEmail(), envio());
    expect(semServidor).toMatchObject({ ok: false, transitorio: true });
    expect(semServidor).not.toHaveProperty("ambiguo");
    expect(porta).toBeGreaterThan(0);

    const mSemCa = await montar({
      fabrica: (caixa) =>
        criarFabricaDeConexao({
          resolver: async () => [{ address: "127.0.0.1", family: 4 }],
          politica: criarPoliticaDeRede({ permitir: ["127.0.0.1"] }),
          portas: { imap: { [caixa.imap.porta]: "tls" }, smtp: { [caixa.smtp.porta]: "tls" } },
        }),
    });
    const r = await mSemCa.enviar(canalDeEmail(), envio());
    expect(r).toMatchObject({ ok: false, transitorio: false, codigo: "SMTP_CERTIFICADO" });
    expect(mSemCa.caixa.entregues).toHaveLength(0);
  });
});

describe("a senha que mudou derruba a caixa e a Mensagem espera (D-17-20, EML-07)", () => {
  it("o SMTP recusando o login (EAUTH) registra a queda com o motivo e devolve o código de Canal desconectado", async () => {
    const m = await montar();
    m.caixa.programarSmtp({ tipo: "recusarAuth" });
    const r = await m.enviar(canalDeEmail(), envio());
    expect(r).toEqual({ ok: false, transitorio: false, codigo: CODIGO_DO_CANAL_DESCONECTADO, motivo: FRASE_DA_SENHA_RECUSADA_NO_ENVIO });
    expect(FRASE_DA_SENHA_RECUSADA_NO_ENVIO).toBe("O servidor SMTP recusou o usuário ou a senha: conecte a caixa de novo.");
    expect(m.quedas).toEqual([{ alvo: { workspaceId: "ws_email_envio", canalId: "canal_email_envio" }, motivo: FRASE_DA_SENHA_RECUSADA_NO_ENVIO }]);
    expect(m.caixa.entregues).toHaveLength(0);
  });

  it("a senha guardada que já não vale no servidor tem o mesmo desfecho, e a senha não aparece em nada", async () => {
    const m = await montar({ senhaDoServidor: "outra-senha-agora" });
    const r = await m.enviar(canalDeEmail(), envio());
    expect(r).toMatchObject({ ok: false, codigo: CODIGO_DO_CANAL_DESCONECTADO });
    expect(m.quedas).toHaveLength(1);
    expect(JSON.stringify({ r, quedas: m.quedas, registros: m.registros })).not.toContain(SENHA);
  });

  it("a porta de acesso devolvendo AUTORIZACAO_RECUSADA derruba a caixa sem abrir conexão", async () => {
    const acesso: AcessoDoEmail = {
      async acessoParaUsar() {
        return { ok: false, permanente: true, codigo: "AUTORIZACAO_RECUSADA", motivo: "O serviço de e-mail retirou a autorização: conecte o Canal de novo pela ficha dele." };
      },
    };
    const m = await montar({ acesso });
    const r = await m.enviar(canalDeEmail(), envio());
    expect(r).toMatchObject({ ok: false, transitorio: false, codigo: CODIGO_DO_CANAL_DESCONECTADO });
    expect(m.quedas).toEqual([expect.objectContaining({ motivo: "O serviço de e-mail retirou a autorização: conecte o Canal de novo pela ficha dele." })]);
    expect(m.caixa.conexoesSmtp()).toHaveLength(0);
  });

  it("OAUTH_NAO_CONFIGURADO e RENOVACAO_FALHOU são transitórios e não derrubam a caixa", async () => {
    for (const codigo of ["OAUTH_NAO_CONFIGURADO", "RENOVACAO_FALHOU"] as const) {
      const acesso: AcessoDoEmail = { async acessoParaUsar() { return { ok: false, permanente: false, codigo, motivo: "frase fixa" }; } };
      const m = await montar({ acesso });
      expect(await m.enviar(canalDeEmail(), envio())).toEqual({ ok: false, transitorio: true, codigo, motivo: "frase fixa" });
      expect(m.quedas).toHaveLength(0);
    }
  });

  it("Canal sem credencial é permanente e não é queda; Canal sem conta é permanente", async () => {
    const m = await montar();
    const semCredencial: CanalParaProvedor = { ...canalDeEmail() };
    delete (semCredencial as { credencial?: string }).credencial;
    expect(await m.enviar(semCredencial, envio())).toMatchObject({ ok: false, transitorio: false, codigo: "CREDENCIAL_AUSENTE" });
    expect(m.quedas).toHaveLength(0);

    const semConta = await montar({ contas: async () => undefined });
    expect(await semConta.enviar(canalDeEmail(), envio())).toMatchObject({ ok: false, transitorio: false, codigo: "CONTA_NAO_ENCONTRADA" });
  });

  it("se a queda não pôde ser registrada, a Mensagem tenta de novo (transitório) em vez de ficar à espera de uma reconexão que não vem", async () => {
    const m = await montar({
      registrarQueda: async () => {
        throw new Error("banco fora do ar");
      },
    });
    m.caixa.programarSmtp({ tipo: "recusarAuth" });
    expect(await m.enviar(canalDeEmail(), envio())).toMatchObject({ ok: false, transitorio: true, codigo: "ERRO_AO_REGISTRAR_QUEDA" });
  });
});

describe("a guarda de rede reaplicada em todo envio (T-17-40)", () => {
  it("o servidor que passou a resolver para a rede interna é recusado sem abrir conexão e sem registrar nada do endereço", async () => {
    const m = await montar({
      fabrica: (caixa) =>
        criarFabricaDeConexao({
          resolver: async () => [{ address: "10.0.0.5", family: 4 }],
          politica: POLITICA_DE_PRODUCAO,
          portas: { imap: { [caixa.imap.porta]: "tls" }, smtp: { [caixa.smtp.porta]: "tls" } },
          ca: caixa.ca,
        }),
    });
    const r = await m.enviar(canalDeEmail(), envio());
    expect(r).toMatchObject({ ok: false, transitorio: false, codigo: "SMTP_REDE_RECUSADA" });
    expect(m.caixa.conexoesSmtp()).toHaveLength(0);
    expect(JSON.stringify(r)).not.toContain("10.0.0.5");
    expect(JSON.stringify(r)).not.toContain("smtp.caixa.teste");
  });
});

describe("o que o provedor recusa sem abrir conexão", () => {
  it("destino que não é e-mail e Mensagem vazia", async () => {
    const m = await montar();
    expect(await m.enviar(canalDeEmail(), envio({ destino: { tipo: "whatsapp", valor: "+5511987654321" } }))).toMatchObject({
      ok: false,
      transitorio: false,
      codigo: "DESTINO_INVALIDO",
    });
    expect(await m.enviar(canalDeEmail(), envio({ conteudo: "   " }))).toMatchObject({ ok: false, transitorio: false, codigo: "MENSAGEM_VAZIA" });
    expect(m.caixa.conexoesSmtp()).toHaveLength(0);
  });

  it("e-mail só com arquivo (sem texto) sai", async () => {
    const m = await montar();
    m.armazenamento.colocarPorChave("k/a", PDF, "application/pdf");
    const r = await m.enviar(canalDeEmail(), envio({ conteudo: "", anexos: [{ urlAssinada: "x", tipoDeMidia: "application/pdf", nome: "a.pdf", objectKey: "k/a", tamanhoBytes: PDF.byteLength }] }));
    expect(r).toMatchObject({ ok: true });
  });
});

describe("a senha nunca aparece num resultado, num erro ou num registro", () => {
  it("todos os desfechos de uma bateria de falhas, serializados, não têm a senha nem o texto do servidor", async () => {
    const m = await montar({ socketMs: 700 });
    m.caixa.programarSmtp({ tipo: "recusarAuth" });
    await m.enviar(canalDeEmail(), envio());
    m.caixa.programarSmtp({ tipo: "recusarRcpt", codigo: 550 });
    await m.enviar(canalDeEmail(), envio());
    m.caixa.programarSmtp({ tipo: "recusarData", codigo: 451 });
    await m.enviar(canalDeEmail(), envio());
    m.caixa.programarSmtp({ tipo: "mudoNoData" });
    await m.enviar(canalDeEmail(), envio());
    await m.enviar(canalDeEmail(), envio({ destino: { tipo: "email", valor: "ruim" } }));

    expect(m.resultados.length).toBeGreaterThanOrEqual(5);
    const serializado = JSON.stringify({ resultados: m.resultados, quedas: m.quedas, registros: m.registros });
    expect(serializado).not.toContain(SENHA);
    expect(serializado).not.toContain("programado");
    expect(serializado).not.toContain("Credenciais inválidas");
    expect(serializado).not.toContain(CLIENTE);
  }, 20_000);
});

describe("deveGuardarEmEnviados (D-17-17, pressupostos A4 e A5)", () => {
  const base: ContaDeEmail = {
    workspaceId: "w",
    canalId: "c",
    endereco: ENDERECO,
    tipoDeLogin: "senha",
    imap: { host: "imap.caixa.teste", porta: 993 },
    smtp: { host: "smtp.caixa.teste", porta: 465 },
    contaExternaId: null,
    appendEnviados: "auto",
    pastaEnviados: "Enviados",
    motivoDaQueda: null,
    caiuEm: null,
    conectadaPor: "m",
    conectadaEm: AGORA,
  };
  const com = (extras: Partial<ContaDeEmail>): ContaDeEmail => ({ ...base, ...extras });

  it("auto: o Gmail e o Microsoft 365 guardam sozinhos; os outros não", () => {
    expect(deveGuardarEmEnviados(com({ imap: { host: "imap.gmail.com", porta: 993 } }))).toBe(false);
    expect(deveGuardarEmEnviados(com({ imap: { host: "IMAP.GMAIL.COM", porta: 993 } }))).toBe(false);
    expect(deveGuardarEmEnviados(com({ imap: { host: "outlook.office365.com", porta: 993 } }))).toBe(false);
    expect(deveGuardarEmEnviados(com({ imap: { host: "imap.locaweb.com.br", porta: 993 } }))).toBe(true);
    expect(deveGuardarEmEnviados(base)).toBe(true);
  });

  it("sim e nao mandam, seja qual for o servidor", () => {
    expect(deveGuardarEmEnviados(com({ appendEnviados: "sim", imap: { host: "imap.gmail.com", porta: 993 } }))).toBe(true);
    expect(deveGuardarEmEnviados(com({ appendEnviados: "nao" }))).toBe(false);
  });

  it("auto com o login do Google ou da Microsoft não guarda: o servidor é o deles", () => {
    expect(deveGuardarEmEnviados(com({ tipoDeLogin: "google", imap: { host: "imap.exemplo.teste", porta: 993 } }))).toBe(false);
    expect(deveGuardarEmEnviados(com({ tipoDeLogin: "microsoft", imap: { host: "imap.exemplo.teste", porta: 993 } }))).toBe(false);
  });
});

describe("a cópia em Enviados por APPEND (D-17-17)", () => {
  it("o MESMO MIME enviado (mesmo Message-ID, sem Bcc), marcado como lido, vai à pasta de enviados", async () => {
    const m = await montar({ conta: { appendEnviados: "auto" } });
    const r = await m.enviar(
      canalDeEmail(),
      envio({ enderecosAdicionais: [{ tipo: "copiaOculta", endereco: "oculto@empresa.com" }] }),
    );

    expect(r).toMatchObject({ ok: true });
    const copias = await m.caixa.mensagensDaPasta(ENDERECO, PASTA_DE_ENVIADOS_FALSA);
    expect(copias).toHaveLength(1);
    expect(copias[0]!.equals(m.caixa.entregues[0]!.dados)).toBe(true);
    const texto = copias[0]!.toString("utf8");
    expect(texto).toMatch(/^Message-ID: <n1\.msg_1@caixa\.teste>\r?$/m);
    expect(texto).not.toMatch(/^bcc:/im);
    expect(texto).not.toContain("oculto@empresa.com");
  });

  it("o servidor do Gmail em auto não recebe a cópia: ele já guarda", async () => {
    const m = await montar({ conta: { appendEnviados: "auto", imap: { host: "imap.gmail.com", porta: 0 } } });
    await m.enviar(canalDeEmail(), envio());
    expect(m.caixa.conexoesImap()).toHaveLength(0);
  });

  it("sem pasta de enviados conhecida, pula o APPEND e registra, sem endereço; o envio é ok", async () => {
    const m = await montar({ conta: { appendEnviados: "sim", pastaEnviados: null } });
    const r = await m.enviar(canalDeEmail(), envio());
    expect(r).toMatchObject({ ok: true });
    expect(m.caixa.conexoesImap()).toHaveLength(0);
    expect(m.registros).toContainEqual({ nivel: "info", mensagem: "email.enviados.sem_pasta", dados: undefined });
    expect(JSON.stringify(m.registros)).not.toContain(ENDERECO);
  });

  it("o APPEND que falha (a conexão cai, ou o IMAP recusa o login) não faz o envio falhar", async () => {
    const m = await montar({
      conta: { appendEnviados: "sim" },
      fabrica: (caixa) => {
        const real = criarFabricaDeConexao({
          resolver: async () => [{ address: "127.0.0.1", family: 4 }],
          politica: criarPoliticaDeRede({ permitir: ["127.0.0.1"] }),
          portas: { imap: { [caixa.imap.porta]: "tls" }, smtp: { [caixa.smtp.porta]: "tls" } },
          ca: caixa.ca,
        });
        return {
          ...real,
          async abrirImap(entrada) {
            const cliente = await real.abrirImap(entrada);
            caixa.derrubarConexoes();
            return cliente;
          },
        };
      },
    });
    const r = await m.enviar(canalDeEmail(), envio());
    expect(r).toMatchObject({ ok: true });
    expect(m.caixa.entregues).toHaveLength(1);
    expect(m.registros.some((x) => x.mensagem === "email.enviados.falhou")).toBe(true);
    expect(JSON.stringify(m.registros)).not.toContain(SENHA);
  });

  it("a guarda de rede também vale para o APPEND (T-17-40)", async () => {
    const m = await montar({
      conta: { appendEnviados: "sim" },
      fabrica: (caixa) => {
        const real = criarFabricaDeConexao({
          resolver: async () => [{ address: "127.0.0.1", family: 4 }],
          politica: criarPoliticaDeRede({ permitir: ["127.0.0.1"] }),
          portas: { imap: { [caixa.imap.porta]: "tls" }, smtp: { [caixa.smtp.porta]: "tls" } },
          ca: caixa.ca,
        });
        const interna = criarFabricaDeConexao({
          resolver: async () => [{ address: "169.254.169.254", family: 4 }],
          politica: POLITICA_DE_PRODUCAO,
          portas: { imap: { [caixa.imap.porta]: "tls" }, smtp: { [caixa.smtp.porta]: "tls" } },
        });
        return { ...real, abrirImap: interna.abrirImap };
      },
    });
    expect(await m.enviar(canalDeEmail(), envio())).toMatchObject({ ok: true });
    expect(m.caixa.conexoesImap()).toHaveLength(0);
    expect(m.registros.some((x) => x.mensagem === "email.enviados.falhou" && JSON.stringify(x.dados) === '{"tipo":"rede_recusada"}')).toBe(true);
  });
});
