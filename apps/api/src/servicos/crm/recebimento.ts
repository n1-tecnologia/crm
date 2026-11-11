/**
 * Serviço de recebimento (3.6.2, MSG-01): uma Mensagem que chega do provedor acha ou cria o Contato,
 * reaproveita, reabre ou abre a Conversa e grava a Mensagem, tudo numa transação só. É a regra que o
 * webhook (16-03) e os provedores usam, e a ÚNICA porta da `recebida` (a porta antiga, que só gravava
 * numa Conversa já aberta, saiu de `ServicoDeMensagens`).
 *
 * Ordem dentro da transação:
 *   1. o Canal vem de `(workspaceId, canalId)` de QUEM CHAMA — nunca do evento (T-16-01);
 *   2. o mesmo `idExterno` no mesmo Canal já gravado devolve a existente com `repetida: true` e não
 *      grava Contato, Conversa nem Mensagem (INV-CXE-08); só completa o anexo que estava `baixado: false` quando a
 *      entrada de mídia (16-10) o trouxe pronto numa passada seguinte;
 *   3. o Contato é achado por `detentorDoIdentificador` com o valor NORMALIZADO exato, ou criado com
 *      `modo_criacao = 'automatico_mensagem'`. Nada de casar por semelhança (T-16-03): a conversa de uma pessoa nunca cai
 *      no Contato de outra. A única junção é a do nono dígito do celular brasileiro (4.4.3, `variantesDoNumeroBrasileiro`):
 *      `+551187654321` e `+5511987654321` são o mesmo número, então o Contato que tem uma das duas formas recebe a Mensagem
 *      que chegou pela outra (a forma que chegou é procurada primeiro) e o Contato novo grava a forma com o 9;
 *   4. o Contato arquivado ou na lixeira volta a `ativo` (RN-CON-13); o mesclado é recusado;
 *   5. a Conversa é decidida por `destinoDaRecebida` (RN-CXE-09), com a janela de `inbox` em
 *      `plataforma.registros`;
 *   6. a Mensagem entra pelo `inserirRecebida` de sempre.
 *
 * A Mensagem digitada no celular do Canal (`digitadaNoAparelho`, 4.4.2) passa pelo mesmo caminho, com três diferenças: entra
 * `enviada` (Ator: o Canal), não reativa o Contato arquivado ou na lixeira (a pessoa não escreveu: o Contato não voltou) e a
 * Conversa vem de `destinoDaDigitadaNoAparelho`, que nunca reabre uma resolvida nem acorda uma pendente.
 *
 * A corrida (Pitfall 11): dois eventos do mesmo número novo disputam `contato_identificadores_unico`
 * (ou `conversas_nao_resolvida_uq`); quem perde leva `23505`, e a transação inteira é refeita uma vez
 * (agora o detentor ou a aberta já existem). A segunda falha, ou qualquer outro erro, sobe.
 *
 * Não sobe a revisão do Espaço (a função de `repositorios/crm/referencias.ts` que a avança): travaria a linha do Espaço a cada Mensagem
 * e faria toda aba reidratar o Espaço inteiro. O aviso à tela é o `avisarCrm` (16-07, SSE), no mesmo cliente da
 * transação: a Mensagem gravada vira `mensagem.nova`, e a repetida não avisa.
 *
 * Nem `conteudo`, nem `cargaBruta`, nem telefone são escritos em log (T-16-02): este módulo não loga.
 */

import { randomUUID } from "node:crypto";
import type { Pool, PoolClient } from "pg";
import type { Conversa, ParticipanteDaConversa } from "@n1/dominio/crm/conversas";
import { TIPO_DE_IDENTIFICADOR_DO_CANAL, tituloDaConversa } from "@n1/dominio/crm/conversas";
import type { AnexoDaMensagem, Mensagem } from "@n1/dominio/crm/mensagens";
import { normalizarIdentificadorDeContato, variantesDoNumeroBrasileiro } from "@n1/dominio/crm/normalizacao";
import {
  JANELA_DE_REABERTURA_PADRAO_HORAS,
  contatoDaRecebida,
  destinoDaDigitadaNoAparelho,
  destinoDaRecebida,
  type DestinoDaRecebida,
  type EntradaDoDestino,
  type RecebidaDoProvedor,
} from "@n1/dominio/crm/recebimento";
import { avisarCrm } from "../../mensageria/avisar";
import { criarRepositorioDeCanaisPg } from "../../repositorios/crm/canais";
import { criarRepositorioDeContatosPg } from "../../repositorios/crm/contatos";
import { criarRepositorioDeConversasPg } from "../../repositorios/crm/conversas";
import { criarRepositorioDeMensagensPg } from "../../repositorios/crm/mensagens";
import { recusa, sucesso, type ResultadoCrm } from "./resultado";
import { comTransacao } from "./transacao";

export interface ResultadoDoRecebimento {
  readonly mensagem: Mensagem;
  readonly conversa: Conversa;
  readonly contatoId: string;
  readonly contatoNovo: boolean;
  readonly conversaNova: boolean;
  readonly conversaReaberta: boolean;
  readonly repetida: boolean;
}

/** O que a entrada de mídia (16-10) já fez com os anexos do evento, antes da transação. */
export interface OpcoesDoRecebimento {
  /** Um item por anexo do evento, na mesma ordem; sem isto o anexo grava só a referência do provedor (`baixado: false`). */
  readonly anexos?: readonly AnexoDaMensagem[];
}

export interface ServicoDeRecebimento {
  receberMensagem(
    workspaceId: string,
    canalId: string,
    evento: RecebidaDoProvedor,
    opcoes?: OpcoesDoRecebimento,
  ): Promise<ResultadoCrm<ResultadoDoRecebimento>>;
}

/** Os dois índices únicos que a corrida do número novo pode estourar (Pitfall 11). */
const CONSTRAINTS_DA_CORRIDA: ReadonlySet<string> = new Set(["contato_identificadores_unico", "conversas_nao_resolvida_uq"]);

/** Sentinela interna: o `idExterno` foi gravado por outra transação entre a checagem e o INSERT. */
const REPETIDA_NA_CORRIDA = "RECEBIMENTO_REPETIDA_NA_CORRIDA";

const TENTATIVAS = 2;

function valorInvalido(falha: { readonly error: string; readonly field: string }) {
  return recusa<never>(400, falha.error, { codigo: "VALOR_INVALIDO", campo: falha.field });
}

/** O evento vem de terceiro: confere o que o banco recusaria com 500. Sem log do conteúdo. */
function validarEvento(evento: RecebidaDoProvedor): { readonly error: string; readonly field: string } | undefined {
  if (evento.idExterno.trim() === "") return { error: "A Mensagem recebida precisa do identificador do provedor.", field: "idExterno" };
  if (Number.isNaN(Date.parse(evento.criadoEm))) return { error: "O instante da Mensagem recebida é inválido.", field: "criadoEm" };
  const semTexto = (evento.conteudo ?? "").trim() === "";
  if (semTexto && (evento.anexos ?? []).length === 0) return { error: "A Mensagem recebida precisa de conteúdo ou anexo.", field: "conteudo" };
  return undefined;
}

function ehErroDaCorrida(erro: unknown): boolean {
  if (typeof erro !== "object" || erro === null) return false;
  const { code, constraint } = erro as { code?: unknown; constraint?: unknown };
  return code === "23505" && typeof constraint === "string" && CONSTRAINTS_DA_CORRIDA.has(constraint);
}

/**
 * Os anexos da Mensagem já gravada com o que a passada nova baixou: só entra o anexo que estava `baixado: false` e agora veio
 * `baixado: true`. Um anexo já guardado nunca é trocado (a passada nova subiu outro objeto, que a coleta de órfãos apaga) nem
 * volta atrás. `undefined` quando nada mudou.
 */
function completarComOsNovos(atuais: readonly AnexoDaMensagem[], novos: readonly AnexoDaMensagem[] | undefined): readonly AnexoDaMensagem[] | undefined {
  if (!novos) return undefined;
  let mudou = false;
  const completos = atuais.map((atual, i) => {
    const novo = novos[i];
    if (atual.baixado || !novo?.baixado) return atual;
    mudou = true;
    return novo;
  });
  return mudou ? completos : undefined;
}

/** `inbox.reopenWindowHours` do Espaço (coleção `inbox` de `plataforma.registros`); ausente ou inválido, o padrão do seed. */
async function janelaDeReaberturaHoras(cliente: PoolClient, workspaceId: string): Promise<number> {
  const { rows } = await cliente.query<{ horas: string | null }>(
    "select dados->>'reopenWindowHours' as horas from plataforma.registros where workspace_id = $1 and colecao = 'inbox' limit 1",
    [workspaceId],
  );
  const horas = Number(rows[0]?.horas);
  return Number.isFinite(horas) && horas >= 0 ? horas : JANELA_DE_REABERTURA_PADRAO_HORAS;
}

/** A última Conversa resolvida do par, com a marca de lixeira (a lixeira só guarda resolvidas, `conversas_lixeira_ck`). */
async function ultimaResolvidaDoPar(cliente: PoolClient, workspaceId: string, contatoId: string, canalId: string) {
  const { rows } = await cliente.query<{ id: string; resolvida_em: Date; estado: string }>(
    `select id, resolvida_em, estado
       from plataforma.conversas
      where workspace_id = $1 and contato_id = $2 and canal_id = $3
        and situacao = 'resolvida' and resolvida_em is not null
      order by resolvida_em desc, id
      limit 1`,
    [workspaceId, contatoId, canalId],
  );
  const linha = rows[0];
  return linha ? { id: linha.id, resolvidaEm: linha.resolvida_em.toISOString(), naLixeira: linha.estado === "na_lixeira" } : null;
}

/** O destino da Mensagem: a regra da `recebida`, ou a da digitada no celular (que só usa a Conversa que já existe, sem mudar o estado dela). */
function destinoDoEvento(evento: RecebidaDoProvedor, entrada: EntradaDoDestino): DestinoDaRecebida {
  if (evento.digitadaNoAparelho !== true) return destinoDaRecebida(entrada);
  const destino = destinoDaDigitadaNoAparelho(entrada);
  return destino.acao === "usar" ? { acao: "usar", conversaId: destino.conversaId, voltaParaAberta: false } : destino;
}

async function processar(
  cliente: PoolClient,
  workspaceId: string,
  canalId: string,
  evento: RecebidaDoProvedor,
  opcoes: OpcoesDoRecebimento,
): Promise<ResultadoCrm<ResultadoDoRecebimento>> {
  const canais = criarRepositorioDeCanaisPg(cliente);
  const contatos = criarRepositorioDeContatosPg(cliente);
  const conversas = criarRepositorioDeConversasPg(cliente);
  const mensagens = criarRepositorioDeMensagensPg(cliente);

  const canal = await canais.obter(workspaceId, canalId);
  if (!canal) return recusa<never>(404, "Canal não encontrado.", { codigo: "CANAL_NAO_ENCONTRADO", campo: "canalId" });
  if (canal.estado === "arquivado") {
    return recusa<never>(409, "Um Canal arquivado não recebe Mensagem.", { codigo: "CANAL_ARQUIVADO", campo: "canalId" });
  }

  // RN-CXE-21: o Canal só resolve o Identificador do seu tipo (telefone não é WhatsApp).
  if (TIPO_DE_IDENTIFICADOR_DO_CANAL[canal.tipo] !== evento.remetente.tipo) {
    return valorInvalido({ error: "O remetente não é do tipo que este Canal resolve.", field: "remetente" });
  }
  const normalizado = normalizarIdentificadorDeContato(evento.remetente.tipo, evento.remetente.valor);
  if (!normalizado.ok) return valorInvalido({ error: normalizado.error, field: "remetente" });
  const valor = normalizado.value;
  // 4.4.3: o celular brasileiro tem duas formas no WhatsApp (com e sem o nono dígito); a que chegou é procurada primeiro, e o
  // Contato novo grava a forma com o 9. Qualquer outro número tem uma forma só.
  const formasDoNumero = evento.remetente.tipo === "whatsapp" ? variantesDoNumeroBrasileiro(valor) : [valor];
  const formasParaProcurar = [valor, ...formasDoNumero.filter((forma) => forma !== valor)];
  const valorParaCriar = formasDoNumero[0] ?? valor;

  // INV-CXE-08: a repetida não grava Contato, Conversa nem Mensagem.
  const existente = await mensagens.obterPorIdExterno(workspaceId, canal.id, evento.idExterno);
  if (existente) {
    const daExistente = await conversas.obter(workspaceId, existente.conversaId);
    if (!daExistente) return recusa<never>(404, "Conversa não encontrada.", { codigo: "CONVERSA_NAO_ENCONTRADA" });
    // 16-10: a mídia que não tinha baixado e agora baixou completa o anexo da Mensagem já gravada (nunca grava outra).
    let mensagem = existente;
    const completados = completarComOsNovos(existente.anexos, opcoes.anexos);
    if (completados) {
      const atualizada = await mensagens.completarAnexos(workspaceId, existente.id, completados);
      if (atualizada) {
        mensagem = atualizada;
        await avisarCrm(cliente, { workspaceId, tipo: "mensagem.status", conversaId: existente.conversaId, mensagemId: existente.id });
      }
    }
    return sucesso({
      mensagem,
      conversa: daExistente,
      contatoId: daExistente.contatoId,
      contatoNovo: false,
      conversaNova: false,
      conversaReaberta: false,
      repetida: true,
    });
  }

  // O Contato: o detentor do valor normalizado exato, ou um novo (T-16-03).
  let detentor: Awaited<ReturnType<typeof contatos.detentorDoIdentificador>> = undefined;
  let valorDoDetentor = valor;
  for (const forma of formasParaProcurar) {
    detentor = await contatos.detentorDoIdentificador(workspaceId, evento.remetente.tipo, forma);
    if (detentor) {
      valorDoDetentor = forma;
      break;
    }
  }
  let contatoId: string;
  let identificadorId: string;
  let nomeDoContato: { readonly nome: string | null; readonly sobrenome: string | null };
  let contatoNovo = false;
  if (detentor) {
    const contato = await contatos.obter(workspaceId, detentor.contatoId, { travar: true });
    if (!contato) return recusa<never>(404, "Contato não encontrado.", { codigo: "CONTATO_NAO_ENCONTRADO" });
    const decisao = contatoDaRecebida(contato.estado);
    if (decisao.acao === "recusar") {
      return recusa<never>(409, "Este Contato foi mesclado e agora é somente leitura.", { codigo: "CONTATO_MESCLADO" });
    }
    // RN-CON-13: quem escreve volta à ativa. A Mensagem digitada no celular é nossa, não do Contato: não o reativa.
    if (decisao.acao === "reativar" && evento.digitadaNoAparelho !== true) await contatos.definirEstado(workspaceId, contato.id, "ativo");
    const doBanco = (await contatos.listarIdentificadores(workspaceId, contato.id)).find((i) => i.tipo === evento.remetente.tipo && i.valor === valorDoDetentor);
    if (!doBanco) return recusa<never>(404, "Identificador não encontrado.", { codigo: "IDENTIFICADOR_NAO_ENCONTRADO" });
    contatoId = contato.id;
    identificadorId = doBanco.id;
    nomeDoContato = { nome: contato.nome, sobrenome: contato.sobrenome };
  } else {
    const proprietarioId = canal.proprietarioPadraoId ?? canal.configuradoPor;
    const nomeExibido = (evento.remetente.nomeExibido ?? "").trim();
    const nome = nomeExibido === "" ? valorParaCriar : nomeExibido;
    const contato = await contatos.inserir(workspaceId, {
      nome,
      modoCriacao: "automatico_mensagem",
      proprietarioId,
      criadoPor: proprietarioId,
      ...(canal.origemPadraoId !== null ? { origem: canal.origemPadraoId } : {}),
    });
    const identificador = await contatos.inserirIdentificador(workspaceId, contato.id, { tipo: evento.remetente.tipo, valor: valorParaCriar, principal: true });
    contatoId = contato.id;
    identificadorId = identificador.id;
    nomeDoContato = { nome: contato.nome, sobrenome: contato.sobrenome };
    contatoNovo = true;
  }

  const valorDoIdentificador = detentor ? valorDoDetentor : valorParaCriar;

  // A Conversa (RN-CXE-09): reaproveita a aberta/pendente, reabre a resolvida na janela, ou abre outra.
  const aberta = await conversas.abertaDoPar(workspaceId, contatoId, canal.id);
  const ultimaResolvida = aberta ? null : await ultimaResolvidaDoPar(cliente, workspaceId, contatoId, canal.id);
  const destino = destinoDoEvento(evento, {
    aberta: aberta ? { id: aberta.id, situacao: aberta.situacao === "pendente" ? "pendente" : "aberta" } : null,
    ultimaResolvida,
    janelaDeReaberturaHoras: await janelaDeReaberturaHoras(cliente, workspaceId),
    agora: Date.now(),
  });

  let conversa: Conversa | undefined;
  let conversaNova = false;
  let conversaReaberta = false;
  if (destino.acao === "usar") {
    if (destino.voltaParaAberta) {
      // Pendente → aberta: o Adiamento acaba (`conversas_adiamento_ck`) e não conta como reabertura.
      await cliente.query(
        `update plataforma.conversas
            set situacao = 'aberta', adiada_ate = null, adiamento_motivo = null
          where workspace_id = $1 and id = $2`,
        [workspaceId, destino.conversaId],
      );
    }
    conversa = await conversas.obter(workspaceId, destino.conversaId);
  } else if (destino.acao === "reabrir") {
    conversa = await conversas.definirSituacao(workspaceId, destino.conversaId, "aberta");
    conversaReaberta = true;
  } else {
    const agora = new Date().toISOString();
    const participantes: ParticipanteDaConversa[] = [
      { id: randomUUID(), sujeito: { tipo: "contato", id: contatoId }, papel: "contato", principal: true, entrouEm: agora, saiuEm: null },
    ];
    conversa = await conversas.inserir(workspaceId, {
      canalId: canal.id,
      contatoId,
      titulo: tituloDaConversa(nomeDoContato, valorDoIdentificador),
      filaId: canal.filaPadraoId,
      atribuido: null,
      participantes,
      criadoPor: { tipo: "integration", id: canal.id },
    });
    conversaNova = true;
  }
  if (!conversa) return recusa<never>(404, "Conversa não encontrada.", { codigo: "CONVERSA_NAO_ENCONTRADA" });

  const gravada = await mensagens.inserirRecebida(workspaceId, {
    conversaId: conversa.id,
    canalId: canal.id,
    idExterno: evento.idExterno,
    criadoEm: evento.criadoEm,
    conteudo: evento.conteudo ?? null,
    // Com a entrada de mídia (16-10) os anexos chegam prontos (`baixado: true` e a chave); sem ela, só a referência do provedor.
    anexos:
      opcoes.anexos ??
      (evento.anexos ?? []).map((anexo) => ({ tipoDeMidia: anexo.tipoDeMidia, nome: anexo.nome, referenciaExterna: anexo.referenciaNoProvedor, baixado: false })),
    assunto: evento.assunto ?? null,
    enderecosAdicionais: [],
    remetenteExterno: evento.remetente.valor,
    identificadorId,
    cargaBruta: evento.cargaBruta,
    ...(evento.digitadaNoAparelho === true ? { digitadaNoAparelho: true } : {}),
  });
  // Outra transação gravou este `idExterno` depois da checagem: desfaz o que esta criou e relê a repetida.
  if (!gravada) return recusa<never>(409, "Mensagem já recebida.", { codigo: REPETIDA_NA_CORRIDA });

  // 16-07 / 3.8.2: a Mensagem recebida avisa as abas do Espaço no mesmo cliente da transação (só chega depois do
  // `commit`). A repetida (acima) não grava nada e por isso não avisa.
  await avisarCrm(cliente, { workspaceId, tipo: "mensagem.nova", conversaId: conversa.id, mensagemId: gravada.id });

  return sucesso({ mensagem: gravada, conversa, contatoId, contatoNovo, conversaNova, conversaReaberta, repetida: false });
}

export function criarServicoDeRecebimento(deps: { readonly pool: () => Pool }): ServicoDeRecebimento {
  return {
    async receberMensagem(workspaceId, canalId, evento, opcoes = {}) {
      const invalida = validarEvento(evento);
      if (invalida) return valorInvalido(invalida);

      for (let tentativa = 1; ; tentativa += 1) {
        try {
          const resultado = await comTransacao(deps.pool, (cliente) => processar(cliente, workspaceId, canalId, evento, opcoes));
          if (resultado.ok || resultado.codigo !== REPETIDA_NA_CORRIDA) return resultado;
          if (tentativa >= TENTATIVAS) throw new Error("recebimento: a Mensagem recebida disputou o mesmo id externo em todas as tentativas");
        } catch (erro) {
          if (tentativa >= TENTATIVAS || !ehErroDaCorrida(erro)) throw erro;
        }
      }
    },
  };
}
