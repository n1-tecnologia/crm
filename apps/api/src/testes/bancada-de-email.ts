/**
 * A bancada dos testes do leitor de e-mail (Fase 17, 17-10): o que `leitor.test.ts` e `e2e/email-entrada.test.ts` repetiriam.
 * Um Canal de e-mail REAL conectado por senha (`conectarPorSenha`, que grava o cursor no `UIDNEXT`) a uma caixa do dublê de IMAP
 * e SMTP (`servidor-de-email-falso.ts`), a fábrica que só abre `127.0.0.1` com a CA do dublê, o provedor, o processador de
 * entrada e uma função que cria leitores já ligados a tudo isso.
 *
 * Só existe no teste: o `describeComBanco` do arquivo que a usa decide se o Postgres local está de pé. Nada aqui toca rede de
 * verdade, Supabase nem credencial real.
 */

import { randomBytes } from "node:crypto";
import { vi } from "vitest";
import type { MembroDaSessao } from "../plugins/autenticacao";
import { criarProcessadorDeEntrada } from "../mensageria/processador-de-entrada";
import { criarServicoDeConexaoDoEmail } from "../mensageria/provedores/email/conexao";
import { criarAcessoDoEmail, type AcessoDoEmail } from "../mensageria/provedores/email/credencial";
import { criarFabricaDeConexao, type FabricaDeConexao } from "../mensageria/provedores/email/fabrica-de-conexao";
import { criarLeitorDeEmail, type LeitorDeEmail, type OpcoesDoLeitorDeEmail } from "../mensageria/provedores/email/leitor";
import { criarProvedorDeEmail } from "../mensageria/provedores/email/provedor";
import { criarPoliticaDeRede, type Resolvedor } from "../mensageria/provedores/email/rede";
import { provedorDeTeste } from "../mensageria/provedores/teste";
import { pool } from "../persistencia/conexao";
import type { ArmazenamentoDeAnexos } from "../servicos/armazenamento-de-anexos";
import type { ChavesDoCofre } from "../servicos/cofre";
import { criarAcessoAoCrmPg } from "../servicos/crm/acesso";
import { criarServicoDeCanais } from "../servicos/crm/canais";
import type { ResultadoCrm } from "../servicos/crm/resultado";
import { criarArmazenamentoFalso } from "./armazenamento-falso";
import { iniciarServidorDeEmailFalso, type ServidorDeEmailFalso } from "./servidor-de-email-falso";

export const CHAVES_DA_BANCADA: ChavesDoCofre = { atual: { versao: 1, chave: randomBytes(32) } };
export const SENHA_DA_BANCADA = "senha-da-bancada-17-10";
export const DOMINIO_DA_BANCADA = "caixa.teste";

export function valor<T>(resultado: ResultadoCrm<T>): T {
  if (!resultado.ok) throw new Error(`esperava sucesso, veio ${resultado.status} ${resultado.codigo ?? ""}: ${resultado.error}`);
  return resultado.valor;
}

/** Espera até `condicao` devolver verdadeiro (ou lança com o rótulo), olhando de 50 em 50 ms. */
export async function ate(rotulo: string, condicao: () => Promise<boolean> | boolean, limiteMs = 10_000): Promise<void> {
  const limite = Date.now() + limiteMs;
  while (Date.now() < limite) {
    if (await condicao()) return;
    await new Promise((resolver) => setTimeout(resolver, 50));
  }
  throw new Error(`não aconteceu a tempo: ${rotulo}`);
}

export const dormir = (ms: number): Promise<void> => new Promise((resolver) => setTimeout(resolver, ms));

export interface EmailDeTeste {
  readonly de: string;
  readonly para: string;
  readonly assunto: string;
  readonly messageId: string;
  readonly inReplyTo?: string;
  readonly references?: string;
  readonly texto: string;
}

/** Um e-mail de texto simples, sintético (domínios de exemplo). */
export function mime(e: EmailDeTeste): string {
  return [
    `From: ${e.de}`,
    `To: ${e.para}`,
    `Subject: ${e.assunto}`,
    `Message-ID: <${e.messageId}>`,
    ...(e.inReplyTo ? [`In-Reply-To: <${e.inReplyTo}>`] : []),
    ...(e.references ? [`References: ${e.references}`] : []),
    "Date: Thu, 19 Nov 2026 10:00:00 +0000",
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=utf-8",
    "",
    e.texto,
    "",
  ].join("\r\n");
}

export interface RegistroColetado {
  readonly nivel: "info" | "warn" | "error";
  readonly mensagem: string;
  readonly dados?: Record<string, unknown> | undefined;
}

export interface OpcoesDaBancada {
  /** Quantos e-mails já estão na INBOX ANTES de conectar o Canal (o "histórico", que não pode entrar). */
  readonly antigas?: number;
  /** O IMAP do dublê não anuncia `IDLE`. */
  readonly semIdle?: boolean;
  /** Tokens XOAUTH2 que o dublê aceita para o usuário da caixa (login por Google ou Microsoft). */
  readonly tokens?: readonly string[];
  readonly armazenamento?: ArmazenamentoDeAnexos;
  /** A porta de acesso das credenciais. Padrão: a do cofre do teste, sem renovadores. */
  readonly acesso?: AcessoDoEmail;
}

export function criarBancadaDeEmail(base: { readonly ws: string; readonly admin: MembroDaSessao }) {
  const acessoAoCrm = criarAcessoAoCrmPg(pool);
  const canais = criarServicoDeCanais({ pool, acesso: acessoAoCrm });
  const abertos: Array<{ caixa: ServidorDeEmailFalso; leitores: LeitorDeEmail[] }> = [];
  let sequencia = 0;

  async function cenario(opcoes: OpcoesDaBancada = {}) {
    sequencia += 1;
    const endereco = `vendas${sequencia}@${DOMINIO_DA_BANCADA}`;
    const cliente = `cliente${sequencia}@empresa.com`;
    const armazenamento = opcoes.armazenamento ?? criarArmazenamentoFalso();
    const caixa = await iniciarServidorDeEmailFalso({
      usuarios: [{ usuario: endereco, senha: SENHA_DA_BANCADA, ...(opcoes.tokens ? { tokens: opcoes.tokens } : {}) }],
      ...(opcoes.semIdle ? { semIdle: true } : {}),
    });
    const aberto = { caixa, leitores: [] as LeitorDeEmail[] };
    abertos.push(aberto);

    for (let n = 1; n <= (opcoes.antigas ?? 0); n += 1) {
      await caixa.adicionarMensagem(
        endereco,
        mime({ de: `Antigo <antigo${n}@empresa.com>`, para: endereco, assunto: `Antiga ${n}`, messageId: `antiga-${sequencia}-${n}@empresa.example`, texto: `Histórico ${n}.` }),
      );
    }

    const resolver = vi.fn<Resolvedor>(async () => [{ address: "127.0.0.1", family: 4 }]);
    const fabrica: FabricaDeConexao = criarFabricaDeConexao({
      resolver,
      politica: criarPoliticaDeRede({ permitir: ["127.0.0.1"] }),
      portas: { imap: { [caixa.imap.porta]: "tls" }, smtp: { [caixa.smtp.porta]: "tls" } },
      ca: caixa.ca,
    });
    const acesso = opcoes.acesso ?? criarAcessoDoEmail({ pool, chaves: () => CHAVES_DA_BANCADA });
    const provedor = criarProvedorDeEmail({ fabrica, acesso, armazenamento, pool });
    const registro = { teste: provedorDeTeste, porProvedor: { "email-imap-smtp": provedor } } as const;
    const processador = criarProcessadorDeEntrada({
      workerId: `teste-bancada-${base.ws}-${sequencia}`,
      chaves: CHAVES_DA_BANCADA,
      registro,
      armazenamento,
    });

    const canal = valor(await canais.criar(base.admin, { provedor: "email-imap-smtp", nome: `Vendas ${sequencia}`, identificador: endereco }));
    const conexao = criarServicoDeConexaoDoEmail({ pool, acesso: acessoAoCrm, fabrica, chaves: () => CHAVES_DA_BANCADA });
    /** (Re)conecta o Canal por senha: grava credencial, conta, cursor no `UIDNEXT` de agora e o Canal `conectada`. */
    const conectar = async (senha = SENHA_DA_BANCADA) =>
      valor(
        await conexao.conectarPorSenha(base.admin, canal.id, {
          usuario: endereco,
          senha,
          imap: { host: "imap.caixa.teste", porta: caixa.imap.porta },
          smtp: { host: "smtp.caixa.teste", porta: caixa.smtp.porta },
        }),
      );
    await conectar();

    const registros: RegistroColetado[] = [];
    const criarLeitor = (extras: Partial<OpcoesDoLeitorDeEmail> = {}): LeitorDeEmail => {
      const leitor = criarLeitorDeEmail({
        url: process.env.DATABASE_URL!,
        pool,
        fabrica,
        acesso,
        armazenamento,
        chaves: CHAVES_DA_BANCADA,
        aoEnfileirar: () => processador.acordar(),
        intervaloDoSupervisorMs: 200,
        intervaloDeConferenciaMs: 1_000,
        esperaInicialMs: 50,
        // Só o Canal deste cenário: os dos cenários anteriores seguem no banco (o Espaço é limpo só no fim do arquivo).
        filtrarContas: (conta) => conta.workspaceId === base.ws && conta.canalId === canal.id,
        ...extras,
        registrar: (nivel, mensagem, dados) => {
          registros.push({ nivel, mensagem, dados });
          extras.registrar?.(nivel, mensagem, dados);
        },
      });
      aberto.leitores.push(leitor);
      return leitor;
    };

    return { ws: base.ws, canalId: canal.id, endereco, cliente, caixa, fabrica, resolver, acesso, armazenamento, processador, registro, registros, conectar, criarLeitor };
  }

  /** Para os leitores e fecha as caixas; o `afterEach` do arquivo chama. */
  async function fechar(): Promise<void> {
    while (abertos.length > 0) {
      const aberto = abertos.pop()!;
      for (const leitor of aberto.leitores) await leitor.parar();
      await aberto.caixa.fechar();
    }
  }

  return { cenario, fechar, acessoAoCrm };
}
