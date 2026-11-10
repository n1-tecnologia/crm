/**
 * O conjunto de contrato do provedor de mensageria (3.6.1): os casos que valem para QUALQUER
 * `ProvedorDeMensageria`. O provedor de teste o roda no CI (`provedor.test.ts`); as Sessões 4, 7, 8 e 9
 * rodam o mesmo contra o seu (a Evolution, no 16-12, com o servidor falso).
 *
 * Este arquivo importa o `vitest` fora de um `.test.ts`, como `testes/banco-crm.ts`: ele só registra
 * `describe`/`it` quando um teste o chama. A `fabrica` entrega o provedor, o `CanalParaProvedor` (com o
 * segredo do webhook e, se houver, a credencial) e os ganchos que cada implementação usa para
 * preparar o próprio mundo (memória do provedor de teste, servidor falso da Evolution).
 *
 * Nada aqui usa um segredo conhecido de antemão: quem monta a `fabrica` gera o do Canal.
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  CABECALHO_DO_SEGREDO,
  ErroDeProvedor,
  type CanalParaProvedor,
  type ChamadaDoWebhook,
  type ProvedorDeMensageria,
} from "./provedor";

export interface FabricaDoContrato {
  readonly provedor: ProvedorDeMensageria;
  /** Traz `segredoDoWebhook` (o certo) e, se a implementação usa uma, a `credencial`. */
  readonly canal: CanalParaProvedor;
  /** Uma chamada VÁLIDA de uma Mensagem de texto, com o cabeçalho do segredo certo. */
  chamadaDeTexto(): ChamadaDoWebhook;
  /** Deixa o provedor pronto para aceitar o próximo `enviar` de texto. */
  prepararEnvioAceito(): Promise<void>;
  /** Deixa uma mídia maior que `tetoBytes` à espera e devolve a referência dela no provedor. */
  prepararMidiaGrande(tetoBytes: number): Promise<string>;
  encerrar(): Promise<void>;
}

const E164 = /^\+[1-9]\d{7,14}$/;

function semSegredoDoWebhook(canal: CanalParaProvedor): CanalParaProvedor {
  const { segredoDoWebhook: _descartado, ...resto } = canal;
  return resto;
}

export function descreverContratoDoProvedor(nome: string, fabrica: () => Promise<FabricaDoContrato>): void {
  describe(`contrato do provedor: ${nome}`, () => {
    let f: FabricaDoContrato;

    beforeAll(async () => {
      f = await fabrica();
    });

    afterAll(async () => {
      await f.encerrar();
    });

    it("verificarChamada aceita o segredo certo e falha com segredo errado ou cabeçalho ausente", () => {
      const valida = f.chamadaDeTexto();
      expect(f.provedor.verificarChamada(valida, f.canal)).toBe(true);

      const errada: ChamadaDoWebhook = { ...valida, cabecalhos: { ...valida.cabecalhos, [CABECALHO_DO_SEGREDO]: "outro-segredo-qualquer" } };
      expect(f.provedor.verificarChamada(errada, f.canal)).toBe(false);

      const ausente: ChamadaDoWebhook = { ...valida, cabecalhos: {} };
      expect(f.provedor.verificarChamada(ausente, f.canal)).toBe(false);

      expect(f.provedor.verificarChamada(valida, semSegredoDoWebhook(f.canal))).toBe(false);
    });

    it("uma chamada válida de texto vira exatamente um evento mensagem, com idExterno, criadoEm ISO e remetente em E.164", () => {
      const eventos = f.provedor.interpretarChamada(f.chamadaDeTexto().corpo, f.canal);
      expect(eventos).toHaveLength(1);
      const evento = eventos[0]!;
      expect(evento.tipo).toBe("mensagem");
      if (evento.tipo !== "mensagem") return;
      expect(evento.idExterno).not.toBe("");
      expect(new Date(evento.criadoEm).toISOString()).toBe(evento.criadoEm);
      expect(evento.remetente.valor).toMatch(E164);
    });

    it("corpo inválido nunca lança: devolve só ignorado", () => {
      for (const corpo of [null, undefined, "texto", 42, [], {}, { lixo: true }]) {
        let eventos: ReturnType<ProvedorDeMensageria["interpretarChamada"]> | undefined;
        expect(() => {
          eventos = f.provedor.interpretarChamada(corpo, f.canal);
        }).not.toThrow();
        expect(eventos!.length).toBeGreaterThanOrEqual(1);
        for (const evento of eventos!) expect(evento.tipo).toBe("ignorado");
      }
    });

    it("enviar de texto devolve ok com idExterno, ou uma falha com código e motivo", async () => {
      await f.prepararEnvioAceito();
      const r = await f.provedor.enviar(f.canal, {
        mensagemId: "msg_contrato_1",
        destino: { tipo: "whatsapp", valor: "+5511987654321" },
        conteudo: "olá",
      });
      if (r.ok) {
        expect(r.idExterno).not.toBe("");
      } else {
        expect(r.codigo).not.toBe("");
        expect(r.motivo).not.toBe("");
        expect(typeof r.transitorio).toBe("boolean");
      }
    });

    it("baixarMidia acima do teto lança ErroDeProvedor MIDIA_GRANDE_DEMAIS", async () => {
      const teto = 16;
      const referencia = await f.prepararMidiaGrande(teto);
      await expect(f.provedor.baixarMidia(f.canal, referencia, { tetoBytes: teto })).rejects.toMatchObject({
        name: "ErroDeProvedor",
        codigo: "MIDIA_GRANDE_DEMAIS",
      });
    });

    it("nenhum resultado nem erro carrega o segredo do webhook nem a credencial", async () => {
      await f.prepararEnvioAceito();
      const resultado = await f.provedor.enviar(f.canal, {
        mensagemId: "msg_contrato_2",
        destino: { tipo: "whatsapp", valor: "+5511987654321" },
        conteudo: "olá",
      });
      const teto = 16;
      const referencia = await f.prepararMidiaGrande(teto);
      const erro = await f.provedor.baixarMidia(f.canal, referencia, { tetoBytes: teto }).then(
        () => undefined,
        (e: unknown) => e,
      );
      expect(erro).toBeInstanceOf(ErroDeProvedor);
      const desconhecida = await f.provedor.baixarMidia(f.canal, "referencia-que-nao-existe", { tetoBytes: teto }).then(
        () => undefined,
        (e: unknown) => e,
      );

      const serializado = [
        JSON.stringify(resultado),
        ...[erro, desconhecida].map((e) => (e instanceof Error ? `${e.name} ${e.message} ${e.stack ?? ""}` : String(e))),
      ].join("\n");
      for (const segredo of [f.canal.segredoDoWebhook, f.canal.credencial]) {
        if (segredo !== undefined && segredo !== "") expect(serializado).not.toContain(segredo);
      }
    });
  });
}
