/**
 * Serviço de Negócios (07-08, Task 2), contra o Postgres LOCAL.
 *
 * Os casos (a)-(h) do plano: criar com Funil padrão e Etapa inicial, Empresa
 * ou Contato inativos, valor e data como texto, mover, ganhar e perder com as
 * Regras de encerramento do Funil (D-05), reabrir com a restrição de `ganho`
 * (D-14), o Negócio arquivado como somente leitura (RN-NEG-16), restaurar da
 * lixeira (RN-NEG-18) e a leitura do quadro. Funis, Contatos e Empresas entram
 * pelos serviços de 07-03, 07-04 e 07-05.
 *
 * Rode com `TZ=America/Sao_Paulo` (Pitfall 5).
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { NovoFunil, FunilDetalhado } from "@n1/dominio/crm/funis";
import type { NegocioDetalhado, NovoNegocio } from "@n1/dominio/crm/negocios";
import type { MembroDaSessao } from "../../plugins/autenticacao";
import { encerrar, pool } from "../../persistencia/conexao";
import { describeComBanco, limparEspaco, novoEspacoDeTeste, prepararBancoCrm, semearMembro } from "../../testes/banco-crm";
import { criarAcessoAoCrmPg } from "./acesso";
import { criarServicoDeContatos } from "./contatos";
import { criarServicoDeEmpresas } from "./empresas";
import { criarServicoDeFunis } from "./funis";
import { criarServicoDeNegocios } from "./negocios";
import type { ResultadoCrm } from "./resultado";

const acesso = criarAcessoAoCrmPg(pool);
const servico = criarServicoDeNegocios({ pool, acesso });
const funis = criarServicoDeFunis({ pool, acesso });
const contatos = criarServicoDeContatos({ pool, acesso });
const empresas = criarServicoDeEmpresas({ pool, acesso });

const sessao = (workspaceId: string, id: string): MembroDaSessao => ({ id, workspaceId, state: "ativo" });

function valor<T>(resultado: ResultadoCrm<T>): T {
  if (!resultado.ok) throw new Error(`esperava sucesso, veio ${resultado.status} ${resultado.codigo ?? ""}: ${resultado.error}`);
  return resultado.valor;
}

function recusado(resultado: ResultadoCrm<unknown>) {
  if (resultado.ok) throw new Error("esperava recusa, veio sucesso");
  return resultado;
}

describeComBanco("ServicoDeNegocios — Postgres local", () => {
  const ws = novoEspacoDeTeste("svcnegocios");
  const outroWs = novoEspacoDeTeste("svcnegociosb");
  const admin = sessao(ws, "mem_admin");
  const membro = sessao(ws, "mem_ana");
  const convidado = sessao(ws, "mem_convidado");
  const adminDeFora = sessao(outroWs, "mem_admin");

  let vendas: FunilDetalhado; // padrão, sem Regras de encerramento
  let comRegras: FunilDetalhado; // exige valor no ganho e motivo na perda
  let contatoId: string;

  const funil = async (nome: string, etapas: readonly { nome: string; probabilidadePadrao?: number }[], extras: Partial<NovoFunil> = {}) =>
    valor(await funis.criar(admin, { nome, etapas, ...extras }));

  const contato = async (nome: string, quem = admin): Promise<string> => valor(await contatos.criar(quem, { nome })).contato.id;

  async function empresa(nome: string): Promise<string> {
    const adminDaEmpresa = await contato(`Admin de ${nome}`);
    return valor(await empresas.criar(admin, { empresa: { nomeFantasia: nome }, admin: { contatoId: adminDaEmpresa } })).empresa.id;
  }

  /** Um Negócio aberto do Contato do Espaço, no Funil padrão, salvo se `extra` disser outro. */
  const negocio = async (titulo: string, extra: Partial<NovoNegocio> = {}, quem = membro): Promise<NegocioDetalhado> =>
    valor(await servico.criar(quem, { titulo, contatoId, ...extra }));

  const linhaNoBanco = async (id: string) =>
    (
      await pool().query<{
        situacao: string;
        estado: string;
        etapa_id: string;
        funil_id: string;
        probabilidade: number | null;
        valor: string | null;
        motivo_perda: string | null;
        motivo_ganho: string | null;
        nota_encerramento: string | null;
        encerrado_em: Date | null;
        empresa_id: string | null;
        contato_id: string | null;
        criado_por: string;
        proprietario_id: string;
      }>("select * from plataforma.negocios where workspace_id = $1 and id = $2", [ws, id])
    ).rows[0];

  beforeAll(async () => {
    await prepararBancoCrm();
    for (const espaco of [ws, outroWs]) {
      await semearMembro(espaco, { id: "mem_admin", base: "administrador", state: "ativo" });
      await semearMembro(espaco, { id: "mem_ana", base: "membro", state: "ativo" });
      await semearMembro(espaco, { id: "mem_convidado", base: "convidado", state: "ativo" });
    }
    await semearMembro(ws, { id: "mem_bia", base: "membro", state: "ativo" });
    await semearMembro(ws, { id: "mem_inativa", base: "membro", state: "suspenso" });
    // O primeiro Funil não privado do Espaço vira o padrão (D-13).
    vendas = await funil("Vendas", [
      { nome: "Novo", probabilidadePadrao: 10 },
      { nome: "Proposta", probabilidadePadrao: 50 },
      { nome: "Fechamento", probabilidadePadrao: 80 },
    ]);
    comRegras = await funil("Com regras", [{ nome: "A", probabilidadePadrao: 20 }, { nome: "B" }], {
      exigeValorGanho: true,
      exigeMotivoPerda: true,
    });
    contatoId = await contato("Contato de apoio");
  });

  afterAll(async () => {
    await limparEspaco(ws);
    await limparEspaco(outroWs);
    await encerrar();
  });

  it("(a) criar sem Funil cai no padrão e na Etapa de menor ordem; Funil arquivado e Etapa de outro Funil são 409", async () => {
    const criado = await negocio("Contrato (a)");
    expect(criado.negocio.funilId).toBe(vendas.funil.id);
    expect(criado.negocio.etapaId).toBe(vendas.etapas[0]!.id);
    expect(criado.etapa.nome).toBe("Novo");
    expect(criado.negocio.situacao).toBe("aberto");
    expect(criado.negocio.estado).toBe("ativo");
    expect(criado.negocio.proprietarioId).toBe("mem_ana");
    expect(criado.negocio.criadoPor).toBe("mem_ana");
    expect(criado.probabilidadeEfetiva).toBe(10);
    expect(criado.etapasDoFunil.map((e) => e.nome)).toEqual(["Novo", "Proposta", "Fechamento"]);
    expect(criado.contato?.id).toBe(contatoId);

    const noMeio = await negocio("Contrato (a) no meio", { funilId: vendas.funil.id, etapaId: vendas.etapas[1]!.id });
    expect(noMeio.negocio.etapaId).toBe(vendas.etapas[1]!.id);

    const aposentado = await funil("Aposentado", [{ nome: "Única" }]);
    valor(await funis.arquivar(admin, aposentado.funil.id));
    const arquivado = recusado(await servico.criar(membro, { titulo: "x", contatoId, funilId: aposentado.funil.id }));
    expect(arquivado.status).toBe(409);
    expect(arquivado.codigo).toBe("FUNIL_INATIVO");

    const deOutroFunil = recusado(
      await servico.criar(membro, { titulo: "x", contatoId, funilId: vendas.funil.id, etapaId: comRegras.etapas[0]!.id }),
    );
    expect(deOutroFunil.status).toBe(409);
    expect(deOutroFunil.codigo).toBe("ETAPA_INVALIDA");
  });

  it("(a) sem Funil padrão no Espaço, criar sem Funil é 409 SEM_FUNIL_PADRAO", async () => {
    const contatoDeFora = valor(await contatos.criar(adminDeFora, { nome: "Contato sem funil" })).contato.id;
    const sem = recusado(await servico.criar(adminDeFora, { titulo: "x", contatoId: contatoDeFora }));
    expect(sem.status).toBe(409);
    expect(sem.codigo).toBe("SEM_FUNIL_PADRAO");
  });

  it("(b) Empresa ou Contato na lixeira é 409; de outro Espaço é 404; Empresa E Contato é 400", async () => {
    const naLixeira = await empresa("Empresa (b) na lixeira");
    valor(await empresas.enviarParaLixeira(admin, naLixeira));
    const empresaInativa = recusado(await servico.criar(membro, { titulo: "x", empresaId: naLixeira }));
    expect(empresaInativa.status).toBe(409);
    expect(empresaInativa.codigo).toBe("EMPRESA_INATIVA");

    const contatoNaLixeira = await contato("Contato (b) na lixeira");
    valor(await contatos.enviarParaLixeira(admin, contatoNaLixeira));
    const contatoInativo = recusado(await servico.criar(membro, { titulo: "x", contatoId: contatoNaLixeira }));
    expect(contatoInativo.status).toBe(409);
    expect(contatoInativo.codigo).toBe("CONTATO_INATIVO");

    const contatoDeFora = valor(await contatos.criar(adminDeFora, { nome: "Contato de fora" })).contato.id;
    const deOutroEspaco = recusado(await servico.criar(membro, { titulo: "x", contatoId: contatoDeFora }));
    expect(deOutroEspaco.status).toBe(404);

    const dois = recusado(await servico.criar(membro, { titulo: "x", contatoId, empresaId: await empresa("Empresa (b)") }));
    expect(dois.status).toBe(400);
    const nenhum = recusado(await servico.criar(membro, { titulo: "x" }));
    expect(nenhum.status).toBe(400);
  });

  it("(c) valor volta como texto decimal e a data civil volta igual", async () => {
    const criado = await negocio("Contrato (c)", { valor: "1234.50", dataPrevistaFechamento: "2026-12-01", moeda: "USD", probabilidade: 35 });
    expect(criado.negocio.valor).toBe("1234.50");
    expect(criado.negocio.dataPrevistaFechamento).toBe("2026-12-01");
    expect(criado.negocio.moeda).toBe("USD");
    expect(criado.probabilidadeEfetiva).toBe(35);
    const relido = valor(await servico.obter(membro, criado.negocio.id));
    expect(relido.negocio.valor).toBe("1234.50");
    expect(relido.negocio.dataPrevistaFechamento).toBe("2026-12-01");

    const semDecimais = await negocio("Contrato (c) inteiro", { valor: "1000" });
    expect(semDecimais.negocio.valor).toBe("1000.00");
    const ruim = recusado(await servico.criar(membro, { titulo: "x", contatoId, valor: "12,50" }));
    expect(ruim.status).toBe(400);
  });

  it("(d) mover grava a Etapa e zera a probabilidade sobrescrita; Funil arquivado e Negócio ganho são 409", async () => {
    const criado = await negocio("Contrato (d)", { probabilidade: 70 });
    expect((await linhaNoBanco(criado.negocio.id))?.probabilidade).toBe(70);

    const movido = valor(await servico.mover(membro, criado.negocio.id, { etapaId: vendas.etapas[2]!.id }));
    expect(movido.negocio.etapaId).toBe(vendas.etapas[2]!.id);
    expect(movido.negocio.probabilidade).toBeNull();
    expect(movido.probabilidadeEfetiva).toBe(80);
    expect((await linhaNoBanco(criado.negocio.id))?.probabilidade).toBeNull();

    const paraOutroFunil = valor(
      await servico.mover(membro, criado.negocio.id, { funilId: comRegras.funil.id, etapaId: comRegras.etapas[1]!.id }),
    );
    expect(paraOutroFunil.negocio.funilId).toBe(comRegras.funil.id);
    expect(paraOutroFunil.negocio.etapaId).toBe(comRegras.etapas[1]!.id);

    const doutroFunilSemDizer = recusado(await servico.mover(membro, criado.negocio.id, { etapaId: vendas.etapas[0]!.id }));
    expect(doutroFunilSemDizer.status).toBe(409);
    expect(doutroFunilSemDizer.codigo).toBe("ETAPA_INVALIDA");

    const fechado = await funil("Fechado para novos", [{ nome: "Única" }]);
    valor(await funis.arquivar(admin, fechado.funil.id));
    const paraArquivado = recusado(
      await servico.mover(membro, criado.negocio.id, { funilId: fechado.funil.id, etapaId: fechado.etapas[0]!.id }),
    );
    expect(paraArquivado.status).toBe(409);
    expect(paraArquivado.codigo).toBe("FUNIL_INATIVO");

    const ganho = await negocio("Contrato (d) ganho");
    valor(await servico.ganhar(membro, ganho.negocio.id, {}));
    const moverGanho = recusado(await servico.mover(membro, ganho.negocio.id, { etapaId: vendas.etapas[1]!.id }));
    expect(moverGanho.status).toBe(409);
    expect(moverGanho.codigo).toBe("NEGOCIO_ENCERRADO");

    const inexistente = recusado(await servico.mover(membro, criado.negocio.id, { etapaId: "etapa-que-nao-existe" }));
    expect(inexistente.status).toBe(404);
  });

  it("(e) D-05: ganhar sem valor e perder sem motivo são 409 e nada muda; com os dados, encerram", async () => {
    const aGanhar = await negocio("Contrato (e) ganho", { funilId: comRegras.funil.id });
    const semValor = recusado(await servico.ganhar(membro, aGanhar.negocio.id, {}));
    expect(semValor.status).toBe(409);
    expect(semValor.codigo).toBe("NEGOCIO_EXIGE_VALOR");
    expect(semValor.campo).toBe("valor");
    const zero = recusado(await servico.ganhar(membro, aGanhar.negocio.id, { valor: "0" }));
    expect(zero.codigo).toBe("NEGOCIO_EXIGE_VALOR");
    const intacto = await linhaNoBanco(aGanhar.negocio.id);
    expect(intacto?.situacao).toBe("aberto");
    expect(intacto?.encerrado_em).toBeNull();

    const ganho = valor(await servico.ganhar(membro, aGanhar.negocio.id, { valor: "500.00", motivoGanho: "Preço", notaEncerramento: "Fechou" }));
    expect(ganho.negocio.situacao).toBe("ganho");
    expect(ganho.negocio.valor).toBe("500.00");
    expect(ganho.negocio.motivoGanho).toBe("Preço");
    expect(ganho.negocio.notaEncerramento).toBe("Fechou");
    expect(ganho.negocio.encerradoEm).not.toBeNull();
    expect(ganho.negocio.probabilidade).toBeNull();
    expect(ganho.probabilidadeEfetiva).toBe(100);

    const jaGanho = recusado(await servico.ganhar(membro, aGanhar.negocio.id, { valor: "1.00" }));
    expect(jaGanho.status).toBe(409);
    expect(jaGanho.codigo).toBe("NEGOCIO_ENCERRADO");

    const aPerder = await negocio("Contrato (e) perdido", { funilId: comRegras.funil.id });
    for (const entrada of [{}, { motivoPerda: "   " }]) {
      const semMotivo = recusado(await servico.perder(membro, aPerder.negocio.id, entrada));
      expect(semMotivo.status).toBe(409);
      expect(semMotivo.codigo).toBe("NEGOCIO_EXIGE_MOTIVO");
      expect(semMotivo.campo).toBe("motivoPerda");
    }
    expect((await linhaNoBanco(aPerder.negocio.id))?.situacao).toBe("aberto");
    const perdido = valor(await servico.perder(membro, aPerder.negocio.id, { motivoPerda: "Concorrente", notaEncerramento: "Foi para a rival" }));
    expect(perdido.negocio.situacao).toBe("perdido");
    expect(perdido.negocio.motivoPerda).toBe("Concorrente");
    expect(perdido.negocio.encerradoEm).not.toBeNull();
    expect(perdido.probabilidadeEfetiva).toBe(0);

    // Sem as Regras de encerramento (Funil padrão), ganhar sem valor e perder sem motivo valem.
    const livre = await negocio("Contrato (e) livre");
    expect(valor(await servico.ganhar(membro, livre.negocio.id, {})).negocio.situacao).toBe("ganho");
    const livre2 = await negocio("Contrato (e) livre 2");
    expect(valor(await servico.perder(membro, livre2.negocio.id, {})).negocio.situacao).toBe("perdido");
  });

  it("(f) D-14: Membro reabre perdido, não reabre ganho; Administrador reabre ganho; reabrir limpa o encerramento", async () => {
    const perdido = await negocio("Contrato (f) perdido");
    valor(await servico.perder(membro, perdido.negocio.id, { motivoPerda: "Preço", notaEncerramento: "nota" }));
    const reaberto = valor(await servico.reabrir(membro, perdido.negocio.id, {}));
    expect(reaberto.negocio.situacao).toBe("aberto");
    expect(reaberto.negocio.motivoPerda).toBeNull();
    expect(reaberto.negocio.notaEncerramento).toBeNull();
    expect(reaberto.negocio.encerradoEm).toBeNull();
    const naoEncerrado = recusado(await servico.reabrir(membro, perdido.negocio.id, {}));
    expect(naoEncerrado.status).toBe(409);

    const ganho = await negocio("Contrato (f) ganho");
    valor(await servico.ganhar(membro, ganho.negocio.id, { valor: "10.00", motivoGanho: "Indicação" }));
    const negado = recusado(await servico.reabrir(membro, ganho.negocio.id, {}));
    expect(negado.status).toBe(403);
    expect(negado.codigo).toBe("PERMISSAO");
    expect((await linhaNoBanco(ganho.negocio.id))?.situacao).toBe("ganho");

    const porAdmin = valor(await servico.reabrir(admin, ganho.negocio.id, {}));
    expect(porAdmin.negocio.situacao).toBe("aberto");
    expect(porAdmin.negocio.motivoGanho).toBeNull();
    expect(porAdmin.negocio.encerradoEm).toBeNull();
    expect(porAdmin.negocio.valor).toBe("10.00");

    // Reabrir para outra Etapa grava a Etapa e zera a probabilidade sobrescrita.
    const paraEtapa = await negocio("Contrato (f) com destino", { probabilidade: 40 });
    valor(await servico.perder(membro, paraEtapa.negocio.id, {}));
    const noDestino = valor(await servico.reabrir(membro, paraEtapa.negocio.id, { etapaId: vendas.etapas[2]!.id }));
    expect(noDestino.negocio.etapaId).toBe(vendas.etapas[2]!.id);
    expect(noDestino.negocio.probabilidade).toBeNull();
  });

  it("(f) reabrir em Funil arquivado exige destino ativo com Etapa dele (RN-FUN-14)", async () => {
    const efemero = await funil("Efêmero", [{ nome: "Única" }]);
    const preso = await negocio("Contrato (f) em funil efêmero", { funilId: efemero.funil.id });
    valor(await servico.perder(membro, preso.negocio.id, {}));
    valor(await funis.arquivar(admin, efemero.funil.id)); // só há Negócio perdido: arquivar é permitido

    const semDestino = recusado(await servico.reabrir(membro, preso.negocio.id, {}));
    expect(semDestino.status).toBe(409);
    expect(semDestino.codigo).toBe("FUNIL_INATIVO");

    const comDestino = valor(
      await servico.reabrir(membro, preso.negocio.id, { funilId: vendas.funil.id, etapaId: vendas.etapas[0]!.id }),
    );
    expect(comDestino.negocio.situacao).toBe("aberto");
    expect(comDestino.negocio.funilId).toBe(vendas.funil.id);
  });

  it("(g) Negócio arquivado é somente leitura; restaurar volta; Empresa na lixeira segura a restauração; exclusão só da lixeira", async () => {
    const arquivavel = await negocio("Contrato (g)");
    const arquivado = valor(await servico.arquivar(membro, arquivavel.negocio.id));
    expect(arquivado.negocio.estado).toBe("arquivado");
    for (const resultado of [
      await servico.editar(membro, arquivavel.negocio.id, { titulo: "Outro" }),
      await servico.mover(membro, arquivavel.negocio.id, { etapaId: vendas.etapas[1]!.id }),
      await servico.ganhar(membro, arquivavel.negocio.id, {}),
    ]) {
      const recusa = recusado(resultado);
      expect(recusa.status).toBe(409);
      expect(recusa.codigo).toBe("NEGOCIO_INATIVO");
    }
    expect(valor(await servico.restaurar(membro, arquivavel.negocio.id)).negocio.estado).toBe("ativo");
    expect(recusado(await servico.restaurar(membro, arquivavel.negocio.id)).status).toBe(409);

    // RN-NEG-18: Negócio aberto na lixeira cuja Empresa foi para a lixeira não volta sozinho.
    const empresaId = await empresa("Empresa (g)");
    const daEmpresa = await negocio("Contrato (g) da Empresa", { empresaId, contatoId: undefined });
    valor(await servico.enviarParaLixeira(membro, daEmpresa.negocio.id));
    valor(await empresas.enviarParaLixeira(admin, empresaId));
    const bloqueado = recusado(await servico.restaurar(membro, daEmpresa.negocio.id));
    expect(bloqueado.status).toBe(409);
    expect(bloqueado.codigo).toBe("EMPRESA_NA_LIXEIRA");
    expect((await linhaNoBanco(daEmpresa.negocio.id))?.estado).toBe("na_lixeira");

    // Exclusão permanente: só da lixeira.
    const ativo = recusado(await servico.excluirPermanentemente(membro, arquivavel.negocio.id));
    expect(ativo.status).toBe(409);
    expect(ativo.codigo).toBe("NEGOCIO_FORA_DA_LIXEIRA");
    valor(await servico.enviarParaLixeira(membro, arquivavel.negocio.id));
    expect(recusado(await servico.enviarParaLixeira(membro, arquivavel.negocio.id)).status).toBe(409);
    expect(valor(await servico.excluirPermanentemente(membro, arquivavel.negocio.id))).toEqual({ id: arquivavel.negocio.id });
    expect(await linhaNoBanco(arquivavel.negocio.id)).toBeUndefined();
    expect(recusado(await servico.obter(membro, arquivavel.negocio.id)).status).toBe(404);
  });

  it("(h) listar traz só o quadro pedido, com nomes e probabilidade efetiva; q acha por título; outro Espaço é 404", async () => {
    const funilDoQuadro = await funil("Quadro", [{ nome: "Fria", probabilidadePadrao: 15 }, { nome: "Quente", probabilidadePadrao: 65 }]);
    const empresaId = await empresa("Quadro Ltda");
    const deContato = await negocio("Quadro alfa", { funilId: funilDoQuadro.funil.id, valor: "100.00" });
    const deEmpresa = await negocio("Quadro beta", {
      funilId: funilDoQuadro.funil.id,
      etapaId: funilDoQuadro.etapas[1]!.id,
      empresaId,
      contatoId: undefined,
    });
    const encerrado = await negocio("Quadro gama", { funilId: funilDoQuadro.funil.id });
    valor(await servico.perder(membro, encerrado.negocio.id, {}));
    const arquivado = await negocio("Quadro delta", { funilId: funilDoQuadro.funil.id });
    valor(await servico.arquivar(membro, arquivado.negocio.id));
    await negocio("Fora do quadro"); // Funil padrão

    const quadro = valor(
      await servico.listar(convidado, { funilId: funilDoQuadro.funil.id, situacao: "aberto", estado: "ativo", limite: 50, deslocamento: 0 }),
    );
    expect(quadro.total).toBe(2);
    expect(quadro.itens.map((n) => n.titulo).sort()).toEqual(["Quadro alfa", "Quadro beta"]);
    const alfa = quadro.itens.find((n) => n.id === deContato.negocio.id)!;
    expect(alfa.contato).toEqual({ id: contatoId, nome: "Contato de apoio" });
    expect(alfa.empresa).toBeNull();
    expect(alfa.probabilidadeEfetiva).toBe(15);
    expect(alfa.valor).toBe("100.00");
    const beta = quadro.itens.find((n) => n.id === deEmpresa.negocio.id)!;
    expect(beta.empresa).toEqual({ id: empresaId, nome: "Quadro Ltda" });
    expect(beta.contato).toBeNull();
    expect(beta.probabilidadeEfetiva).toBe(65);

    const todos = valor(await servico.listar(membro, { funilId: funilDoQuadro.funil.id, estado: "ativo", limite: 50, deslocamento: 0 }));
    expect(todos.total).toBe(3);
    const arquivados = valor(await servico.listar(membro, { funilId: funilDoQuadro.funil.id, estado: "arquivado", limite: 50, deslocamento: 0 }));
    expect(arquivados.itens.map((n) => n.titulo)).toEqual(["Quadro delta"]);
    const pagina = valor(await servico.listar(membro, { funilId: funilDoQuadro.funil.id, estado: "ativo", limite: 1, deslocamento: 0 }));
    expect(pagina.itens).toHaveLength(1);
    expect(pagina.total).toBe(3);

    const porTitulo = valor(await servico.listar(membro, { q: "quadro bet", estado: "ativo", limite: 50, deslocamento: 0 }));
    expect(porTitulo.itens.map((n) => n.titulo)).toEqual(["Quadro beta"]);
    const porEmpresa = valor(await servico.listar(membro, { empresaId, estado: "ativo", limite: 50, deslocamento: 0 }));
    expect(porEmpresa.itens.map((n) => n.titulo)).toEqual(["Quadro beta"]);
    const coringa = valor(await servico.listar(membro, { q: "%", estado: "ativo", limite: 50, deslocamento: 0 }));
    expect(coringa.total).toBe(0);

    expect(recusado(await servico.obter(adminDeFora, deContato.negocio.id)).status).toBe(404);
    expect(recusado(await servico.mover(adminDeFora, deContato.negocio.id, { etapaId: funilDoQuadro.etapas[1]!.id })).status).toBe(404);
    expect(recusado(await servico.editar(adminDeFora, deContato.negocio.id, { titulo: "invadido" })).status).toBe(404);
  });

  it("(h) Convidado lê e é 403 em toda escrita, sem tocar no banco", async () => {
    const alvo = await negocio("Contrato (h) convidado");
    expect(valor(await servico.obter(convidado, alvo.negocio.id)).negocio.titulo).toBe("Contrato (h) convidado");
    const escritas = [
      await servico.criar(convidado, { titulo: "x", contatoId }),
      await servico.editar(convidado, alvo.negocio.id, { titulo: "x" }),
      await servico.mover(convidado, alvo.negocio.id, { etapaId: vendas.etapas[1]!.id }),
      await servico.ganhar(convidado, alvo.negocio.id, {}),
      await servico.perder(convidado, alvo.negocio.id, {}),
      await servico.reabrir(convidado, alvo.negocio.id, {}),
      await servico.arquivar(convidado, alvo.negocio.id),
      await servico.restaurar(convidado, alvo.negocio.id),
      await servico.enviarParaLixeira(convidado, alvo.negocio.id),
      await servico.excluirPermanentemente(convidado, alvo.negocio.id),
    ];
    for (const resultado of escritas) {
      const recusa = recusado(resultado);
      expect(recusa.status).toBe(403);
      expect(recusa.codigo).toBe("PERMISSAO");
    }
    const intacto = await linhaNoBanco(alvo.negocio.id);
    expect(intacto?.situacao).toBe("aberto");
    expect(intacto?.estado).toBe("ativo");
  });

  it("editar muda escalares, troca o dono num comando só e valida o Proprietário", async () => {
    const criado = await negocio("Contrato (edição)", { valor: "10.00", probabilidade: 20 });
    const editado = valor(
      await servico.editar(membro, criado.negocio.id, {
        titulo: "Contrato (edição) v2",
        valor: null,
        probabilidade: null,
        descricao: "Texto",
        dataPrevistaFechamento: "2027-01-31",
        proprietarioId: "mem_bia",
      }),
    );
    expect(editado.negocio.titulo).toBe("Contrato (edição) v2");
    expect(editado.negocio.valor).toBeNull();
    expect(editado.negocio.probabilidade).toBeNull();
    expect(editado.negocio.descricao).toBe("Texto");
    expect(editado.negocio.dataPrevistaFechamento).toBe("2027-01-31");
    expect(editado.negocio.proprietarioId).toBe("mem_bia");

    const suspenso = recusado(await servico.editar(membro, criado.negocio.id, { proprietarioId: "mem_inativa" }));
    expect(suspenso.status).toBe(409);
    expect(suspenso.codigo).toBe("PROPRIETARIO_INVALIDO");

    const empresaId = await empresa("Empresa (edição)");
    const trocado = valor(await servico.editar(membro, criado.negocio.id, { empresaId, contatoId: null }));
    expect(trocado.negocio.empresaId).toBe(empresaId);
    expect(trocado.negocio.contatoId).toBeNull();
    expect(trocado.empresa?.nome).toBe("Empresa (edição)");

    const comOsDois = recusado(await servico.editar(membro, criado.negocio.id, { contatoId }));
    expect(comOsDois.status).toBe(409);
    expect(comOsDois.codigo).toBe("DONO_INVALIDO");
    const semNenhum = recusado(await servico.editar(membro, criado.negocio.id, { empresaId: null }));
    expect(semNenhum.status).toBe(409);

    const naLixeira = await empresa("Empresa (edição) na lixeira");
    valor(await empresas.enviarParaLixeira(admin, naLixeira));
    const paraLixeira = recusado(await servico.editar(membro, criado.negocio.id, { empresaId: naLixeira }));
    expect(paraLixeira.status).toBe(409);
    expect(paraLixeira.codigo).toBe("EMPRESA_INATIVA");
  });
});
