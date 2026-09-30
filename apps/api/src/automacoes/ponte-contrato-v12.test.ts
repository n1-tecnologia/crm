/**
 * Contrato `contas-a-pagar-v1` v1.2 visto pela ponte (06-12 Task 3). O
 * `automation/` de 06-07/06-08 passou a comparar o título existente e a conta
 * corrente, e a devolver os anexos pelo status real; este arquivo prova que a
 * ponte age sobre isso como o contrato declara:
 *
 *   - `contaConfirmada` = a conta que o Financeiro conferiu
 *     (`origin.lancamento.conta`) em todo `/lancar`;
 *   - 422 `TITULO_EXISTENTE_DIVERGENTE` e 422 `CONTA_DIVERGENTE` são falhas
 *     permanentes com os textos do domínio (`tituloDivergente`,
 *     `contaDivergente`); a conta volta para "para pagar" (D6-03). Só
 *     `CONTA_DIVERGENTE` supera a Conferência (crm:CR-02, crm:WR-09);
 *   - os anexos da resposta são casados pelo `nome` com os enviados, o
 *     `erro` só vale se for um `CodigoDoAnexo`, e `url`/texto livre nunca
 *     chegam ao Comentário; `anexosPedidos` é o número enviado; o pedido nunca
 *     passa de 20 anexos (`LIMITE_DE_ANEXOS`).
 *
 * Onde há exemplo canônico v1.2 para o caso, a resposta programada É o
 * exemplo lido da pasta `contratos/contas-a-pagar-v1/`.
 *
 * Arquivo novo (CON-05). Sem banco e sem rede real.
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { decideProcessApproval } from "@n1/dominio/operations/ai";
import { TEXTOS_DA_CONFERENCIA, conferenciaDoResumo } from "@n1/dominio/operations/financeiro";
import type { DataState, Task } from "@n1/dominio";
import { criarServidorFalso, type ServidorFalso } from "../testes/servidor-falso";
import {
  F,
  LANCADO_200,
  LANCAR,
  MARYANE,
  RESOLVER,
  S,
  arquivo,
  buildSeed,
  comentariosDoAgente,
  conferidaEmLancamento,
  conta,
  dePara200,
  definir,
  mover,
  ponteSobre,
  resumosDe,
  vigente,
} from "../testes/fixtures-da-ponte";
import { textoDosAnexosAcimaDoLimite, type OpcoesDaPonte } from "./invocar-agente";

interface Exemplo {
  readonly requisicao: { readonly caminho: string; readonly body: Record<string, unknown> };
  readonly resposta: { readonly status: number; readonly corpo: Record<string, unknown> };
}

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const PASTA = path.resolve(AQUI, "../../../../contratos/contas-a-pagar-v1");
const exemplo = (nome: string): Exemplo => JSON.parse(readFileSync(path.join(PASTA, nome), "utf8")) as Exemplo;

type Registro = { readonly nivel: string; readonly mensagem: string; readonly dados?: Record<string, string | number> };

const ITAU = "TRIA COMPANY - ITAU";
const BRADESCO = "TRIA COMPANY - BRADESCO";

/** 422 com o envelope do contrato e `details` à escolha. */
function erro422(code: string, details?: unknown, message = "A plataforma recusou o lançamento.") {
  return { kind: "ok", status: 422, corpo: { error: { code, message, requestId: "req_v12", retryable: false, ...(details !== undefined ? { details } : {}) } } } as const;
}

function lancado(anexos: unknown[], reaproveitado = false) {
  return { kind: "ok", status: 200, corpo: { ...LANCADO_200.corpo, reaproveitado, anexos, ...(reaproveitado ? { dePara: dePara200("Impostos", { veredito: "resolvida" }).dePara } : {}) } } as const;
}

describe("contrato v1.2 visto pela ponte — servidorFalso, sem DATABASE_URL", () => {
  let servidor: ServidorFalso;
  afterEach(async () => {
    await servidor?.fechar();
  });

  const lancamentos = () => servidor.recebidas.filter((r) => r.caminho === LANCAR);
  const confirmacao = (t: Task) => comentariosDoAgente(t).find((c) => c.content.startsWith("✅ Lançado no Omie"))?.content ?? "";

  async function montar(preparar?: (e: DataState, das: Task) => void, extra: Partial<OpcoesDaPonte> = {}) {
    servidor = await criarServidorFalso();
    const estado = buildSeed();
    preparar?.(estado, conta(estado, "tsk_cp_das"));
    const das = conferidaEmLancamento(estado);
    const registros: Registro[] = [];
    const ponte = ponteSobre(servidor, estado, {
      registrar: (nivel, mensagem, dados) => registros.push({ nivel, mensagem, ...(dados ? { dados } : {}) }),
      ...extra,
    });
    return { estado, das, ponte, registros };
  }

  /** Três arquivos, um em cada Campo de arquivo da conta: Anexo, Boleto e QR Code. */
  function tresAnexos(e: DataState, das: Task): void {
    arquivo(e, "fil_nf", "NFS-e 21.pdf");
    arquivo(e, "fil_boleto", "Boleto outubro.pdf");
    arquivo(e, "fil_qr", "QR.png");
    das.fieldValues = das.fieldValues.filter((v) => v.definitionId !== F.boleto);
    das.fieldValues.push({ definitionId: F.anexo, value: ["fil_nf"], state: "ativo" });
    das.fieldValues.push({ definitionId: F.boleto, value: ["fil_boleto"], state: "ativo" });
    das.fieldValues.push({ definitionId: F.qrCode, value: ["fil_qr"], state: "ativo" });
  }

  const DADOS = { payableId: "pay_das_1", conta: ITAU, categoria: "Impostos e taxas", codigo: "2.06.01" } as const;

  it("(a) o /lancar leva contaConfirmada = a conta conferida, e toda chave do corpo está declarada no exemplo lancar.sucesso-conta-confirmada", async () => {
    const { ponte } = await montar((_e, t) => {
      definir(t, F.forma, "Chave Pix");
      definir(t, F.chavePix, "financeiro@exemplo.com.br");
    });
    servidor.enfileirar(LANCADO_200);
    await ponte.processarContas();

    const corpo = lancamentos()[0]?.corpo as Record<string, unknown>;
    expect(corpo.contaConfirmada).toBe(ITAU);
    const declarados = Object.keys(exemplo("lancar.sucesso-conta-confirmada.json").requisicao.body);
    for (const chave of Object.keys(corpo)) expect(declarados, chave).toContain(chave);
  });

  it("(b) 422 TITULO_EXISTENTE_DIVERGENTE (exemplo canônico): o aviso do domínio, \"para pagar\", a Conferência fica; mover de novo ⇒ /lancar de novo", async () => {
    const { estado, das, ponte, registros } = await montar();
    const conferida = vigente(estado, das);
    const ex = exemplo("lancar.erro-422-titulo-existente-divergente.json").resposta;
    const detalhes = (ex.corpo.error as { details: { payableId: string; campos: ["valor", "vencimento"] } }).details;
    servidor.enfileirar({ kind: "ok", status: ex.status, corpo: ex.corpo });

    await ponte.processarContas();
    const falhas = comentariosDoAgente(das).filter((c) => c.content.includes("(TITULO_EXISTENTE_DIVERGENTE)"));
    expect(falhas).toHaveLength(1);
    expect(falhas[0]?.content).toContain(TEXTOS_DA_CONFERENCIA.tituloDivergente(detalhes.payableId, detalhes.campos));
    expect(falhas[0]?.mentions).toEqual([{ type: "member", id: MARYANE }]);
    expect(das.statusId).toBe(S.paraPagar);
    expect(conferenciaDoResumo(estado, das)).toMatchObject({ estado: "conferida", conferencia: { id: conferida.id } });
    const gravado = JSON.stringify(registros);
    expect(gravado).not.toContain(detalhes.payableId);
    expect(gravado).not.toContain("campos");

    await ponte.processarContas();
    expect(servidor.recebidas).toHaveLength(1);

    mover(estado, das.id, S.emLancamento); // o gesto humano depois de corrigir o Omie
    servidor.enfileirar(LANCADO_200);
    await ponte.processarContas();
    expect(lancamentos()).toHaveLength(2);
    expect(das.statusId).toBe(S.lancado);
  });

  it("(b) com avisarId de um Membro ativo, a Menção vai a ele", async () => {
    const { das, ponte } = await montar(undefined, { avisarId: "mem_marcos_paulo" });
    servidor.enfileirar(erro422("TITULO_EXISTENTE_DIVERGENTE", { payableId: "5872791251", campos: ["valor", "vencimento"] }));
    await ponte.processarContas();
    const falha = comentariosDoAgente(das).find((c) => c.content.includes("(TITULO_EXISTENTE_DIVERGENTE)"));
    expect(falha?.content).toContain(TEXTOS_DA_CONFERENCIA.tituloDivergente("5872791251", ["valor", "vencimento"]));
    expect(falha?.mentions).toEqual([{ type: "member", id: "mem_marcos_paulo" }]);
  });

  it("(c) campo fora dos cinco é descartado; details ausente ou malformado ⇒ o motivo genérico, ainda permanente e de volta a \"para pagar\"", async () => {
    const um = await montar();
    servidor.enfileirar(erro422("TITULO_EXISTENTE_DIVERGENTE", { payableId: "5872791251", campos: ["valor", "senha"] }));
    await um.ponte.processarContas();
    expect(comentariosDoAgente(um.das).at(-1)?.content).toBe(TEXTOS_DA_CONFERENCIA.falha(TEXTOS_DA_CONFERENCIA.tituloDivergente("5872791251", ["valor"]), "TITULO_EXISTENTE_DIVERGENTE"));
    await servidor.fechar();

    for (const details of [undefined, { payableId: 123, campos: "valor" }, { payableId: "", campos: ["valor"] }, { conferida: ITAU }]) {
      const code = details && "conferida" in details ? "CONTA_DIVERGENTE" : "TITULO_EXISTENTE_DIVERGENTE";
      const outro = await montar();
      servidor.enfileirar(erro422(code, details, "Mensagem fixa do envelope."));
      await outro.ponte.processarContas();
      expect(comentariosDoAgente(outro.das).at(-1)?.content, JSON.stringify(details)).toBe(TEXTOS_DA_CONFERENCIA.falha("Mensagem fixa do envelope.", code));
      expect(outro.das.statusId).toBe(S.paraPagar);
      if (code === "TITULO_EXISTENTE_DIVERGENTE") {
        await outro.ponte.processarContas();
        expect(servidor.recebidas).toHaveLength(1);
      } else {
        // CONTA_DIVERGENTE supera a Conferência pelo code, mesmo com details malformado.
        expect(conferenciaDoResumo(outro.estado, outro.das).estado).toBe("sem-resumo");
      }
      await servidor.fechar();
    }
    servidor = await criarServidorFalso();
  });

  it("(d) 422 CONTA_DIVERGENTE: o aviso do domínio, \"para pagar\", a Conferência superada; o ciclo seguinte publica um Resumo novo com a conta de agora, e o /lancar leva essa conta", async () => {
    const { estado, das, ponte } = await montar();
    const antiga = vigente(estado, das);
    const ex = exemplo("lancar.erro-422-conta-divergente.json").resposta;
    const erro = ex.corpo.error as { details: Record<string, unknown> };
    servidor.enfileirar({ kind: "ok", status: ex.status, corpo: { error: { ...erro, details: { ...erro.details, conferida: ITAU, resolvida: BRADESCO } } } });

    await ponte.processarContas();
    const falha = comentariosDoAgente(das).find((c) => c.content.includes("(CONTA_DIVERGENTE)"));
    expect(falha?.content).toContain(TEXTOS_DA_CONFERENCIA.contaDivergente(ITAU, BRADESCO));
    expect(das.statusId).toBe(S.paraPagar);
    expect(estado.approvals.find((a) => a.id === antiga.id)?.decision).toBe("cancelada");
    expect(conferenciaDoResumo(estado, das).estado).toBe("sem-resumo");

    servidor.enfileirar({
      kind: "ok",
      status: 200,
      corpo: { dePara: { contaPorTag: { "conta tria": BRADESCO }, categoriaPorCampo: { Impostos: { veredito: "resolvida", nome: "Impostos e taxas", codigo: "2.06.01", similaridade: 0.9 } }, origem: "omie" } },
    });
    await ponte.processarContas();
    expect(servidor.recebidas.map((r) => r.caminho)).toEqual([LANCAR, RESOLVER]);
    const nova = vigente(estado, das);
    expect(nova.id).not.toBe(antiga.id);
    expect(nova.origin.lancamento.conta).toBe(BRADESCO);
    expect(conferenciaDoResumo(estado, das).estado).toBe("pendente");
    expect(resumosDe(das)).toHaveLength(2);

    const d = decideProcessApproval(estado, MARYANE, nova.id, "aprovada", { source: "click" });
    expect(d.ok).toBe(true);
    mover(estado, das.id, S.emLancamento);
    servidor.enfileirar(LANCADO_200);
    await ponte.processarContas();
    expect(lancamentos()).toHaveLength(2);
    expect((lancamentos()[1]?.corpo as Record<string, unknown>).contaConfirmada).toBe(BRADESCO);
    expect(das.statusId).toBe(S.lancado);
  });

  it("(e) três anexos, a resposta v1.2 com ok, jaExistia e um código: a confirmação é exatamente a do domínio com anexosPedidos 3", async () => {
    const { das, ponte } = await montar(tresAnexos);
    const itens = [
      { nome: "NFS-e 21.pdf", ok: true },
      { nome: "Boleto outubro.pdf", ok: true, jaExistia: true },
      { nome: "QR.png", ok: false, erro: "ANEXO_TEMPO_ESGOTADO" },
    ];
    servidor.enfileirar(lancado(itens, true));
    await ponte.processarContas();
    expect((lancamentos()[0]?.corpo as { anexos: Array<{ nome: string }> }).anexos.map((a) => a.nome)).toEqual(["NFS-e 21.pdf", "Boleto outubro.pdf", "QR.png"]);
    expect(confirmacao(das)).toBe(TEXTOS_DA_CONFERENCIA.lancado({ ...DADOS, reaproveitado: true, anexosPedidos: 3, anexos: itens }));
  });

  it("(f) item com url e erro em texto livre: entra ok:false sem erro; nada da url nem do texto chega ao Comentário", async () => {
    const { das, ponte } = await montar((e, t) => {
      arquivo(e, "fil_nf", "NFS-e 21.pdf");
      t.fieldValues.push({ definitionId: F.anexo, value: ["fil_nf"], state: "ativo" });
    });
    servidor.enfileirar(
      lancado([{ url: "https://storage.exemplo.invalid/obj/fil_nf?token=segredo-assinado", nome: "NFS-e 21.pdf", ok: false, erro: "download 404 em https://storage.exemplo.invalid/x?token=segredo" }]),
    );
    await ponte.processarContas();
    expect(confirmacao(das)).toBe(TEXTOS_DA_CONFERENCIA.lancado({ ...DADOS, reaproveitado: false, anexosPedidos: 1, anexos: [{ nome: "NFS-e 21.pdf", ok: false }] }));
    const tudo = JSON.stringify(das.comments);
    expect(tudo).not.toContain("token=");
    expect(tudo).not.toContain("download 404");
    expect(tudo).not.toContain("storage.exemplo.invalid");
  });

  it("(g) reaproveitado com anexos: [] e dois anexos enviados: \"anexos do primeiro envio (título já existia)\", nunca \"sem anexos\"", async () => {
    const { das, ponte } = await montar((e, t) => {
      arquivo(e, "fil_nf", "NFS-e 21.pdf");
      arquivo(e, "fil_boleto", "Boleto outubro.pdf");
      t.fieldValues = t.fieldValues.filter((v) => v.definitionId !== F.boleto);
      t.fieldValues.push({ definitionId: F.anexo, value: ["fil_nf"], state: "ativo" });
      t.fieldValues.push({ definitionId: F.boleto, value: ["fil_boleto"], state: "ativo" });
    });
    servidor.enfileirar(lancado([], true));
    await ponte.processarContas();
    expect(confirmacao(das)).toContain("anexos do primeiro envio (título já existia)");
    expect(confirmacao(das)).not.toContain("sem anexos");
  });

  it("(h) três enviados e só dois casam pelo nome: anexosPedidos 3, \"de 3\" e \"1 anexo sem resposta do Omie\"; o sem par vira só contagem no log", async () => {
    const { das, ponte, registros } = await montar(tresAnexos);
    servidor.enfileirar(
      lancado([
        { nome: "NFS-e 21.pdf", ok: true },
        { nome: "Boleto outubro.pdf", ok: true },
        { nome: "outro-nome.png", ok: true },
      ]),
    );
    await ponte.processarContas();
    expect(confirmacao(das)).toBe(
      TEXTOS_DA_CONFERENCIA.lancado({ ...DADOS, reaproveitado: false, anexosPedidos: 3, anexos: [{ nome: "NFS-e 21.pdf", ok: true }, { nome: "Boleto outubro.pdf", ok: true }] }),
    );
    expect(confirmacao(das)).toContain("de 3");
    expect(confirmacao(das)).toContain("1 anexo sem resposta do Omie");
    expect(confirmacao(das)).not.toContain("outro-nome.png");
    const sucesso = registros.find((r) => r.mensagem.startsWith("Conta lançada no Omie"));
    expect(sucesso?.dados?.anexosSemPar).toBe(1);
    expect(JSON.stringify(registros)).not.toContain("outro-nome.png");
  });

  it("(i) nenhum anexo enviado: a confirmação de zero anexos (o único caso com \"sem anexos\")", async () => {
    const { das, ponte } = await montar();
    servidor.enfileirar(LANCADO_200);
    await ponte.processarContas();
    expect(lancamentos()[0]?.corpo).not.toHaveProperty("anexos");
    expect(confirmacao(das)).toBe(TEXTOS_DA_CONFERENCIA.lancado({ ...DADOS, reaproveitado: false, anexosPedidos: 0, anexos: [] }));
    expect(confirmacao(das)).toContain("sem anexos");
  });

  it("(j) 23 arquivos: o pedido leva 20, na ordem Campos e depois Tarefa; o log leva anexosAcimaDoLimite: 3; um aviso no fio da Conferência", async () => {
    const nomesDaTarefa = Array.from({ length: 20 }, (_, i) => `anexo-${String(i + 1).padStart(2, "0")}.pdf`);
    const { estado, das, ponte, registros } = await montar((e, t) => {
      tresAnexos(e, t);
      t.attachments = nomesDaTarefa.map((nome, i) => {
        arquivo(e, `fil_t${i}`, nome);
        return { fileId: `fil_t${i}`, order: i, mediaType: "document" as const, displayName: nome };
      });
    });
    const esperados = ["NFS-e 21.pdf", "Boleto outubro.pdf", "QR.png", ...nomesDaTarefa.slice(0, 17)];
    servidor.enfileirar(lancado(esperados.map((nome) => ({ nome, ok: true }))));
    await ponte.processarContas();

    const enviados = (lancamentos()[0]?.corpo as { anexos: Array<{ nome: string }> }).anexos;
    expect(enviados).toHaveLength(20);
    expect(enviados.map((a) => a.nome)).toEqual(esperados);
    const sucesso = registros.find((r) => r.mensagem.startsWith("Conta lançada no Omie"));
    expect(sucesso?.dados?.anexosAcimaDoLimite).toBe(3);
    expect(JSON.stringify(registros)).not.toContain("anexo-18.pdf");
    expect(das.statusId).toBe(S.lancado);
    expect(confirmacao(das)).toContain("anexos 20 de 20");
    const aviso = comentariosDoAgente(das).filter((c) => c.content === textoDosAnexosAcimaDoLimite(3));
    expect(aviso).toHaveLength(1);
    expect(aviso[0]?.parentCommentId).toBe(vigente(estado, das).origin.threadCommentId);
  });
});

describe("os textos do teto de anexos", () => {
  it("textoDosAnexosAcimaDoLimite — singular e plural", () => {
    expect(textoDosAnexosAcimaDoLimite(1)).toBe("1 anexo desta conta não foi enviado ao Omie: o limite é de 20 por lançamento. Se for necessário, suba-o no Omie à mão.");
    expect(textoDosAnexosAcimaDoLimite(3)).toBe("3 anexos desta conta não foram enviados ao Omie: o limite é de 20 por lançamento. Se forem necessários, suba-os no Omie à mão.");
  });
});
