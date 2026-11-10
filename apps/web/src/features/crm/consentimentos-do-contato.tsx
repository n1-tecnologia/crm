"use client";

/**
 * A seção "Consentimentos" da ficha nova de Contato (3.2.4): quem consentiu em
 * receber o quê, por qual tipo de Canal, e quando. Duas leituras do MESMO
 * histórico que a api devolve:
 *
 *   - o vigente, por finalidade e tipo de Canal, calculado aqui com
 *     `consentimentoVigente` do domínio — a api não guarda "o consentimento
 *     atual", a conta é a mesma dos dois lados;
 *   - o histórico, linha a linha, o mais recente primeiro.
 *
 * O histórico é só inserção: revogar é registrar um `revogado`, por isso a seção
 * não tem editar nem apagar, só "Registrar consentimento". A tela pré-valida com
 * `validarNovoConsentimento`; a recusa da api (400 com `campo`, 403, 409 de
 * Contato mesclado ou na lixeira) volta com a frase dela. Quem barra de verdade é
 * o backend: `motivo` só desliga o botão e diz por quê.
 *
 * As finalidades são itens `finalidadeConsentimento` do Catálogo, que continua no
 * store (OQ7): é a única leitura do store nesta seção. A api confere que a
 * finalidade existe e está ativa no Espaço.
 *
 * Todo texto vindo da api é renderizado como texto React (escapado).
 */

import { useState } from "react";
import {
  consentimentoVigente,
  DECISOES_DE_CONSENTIMENTO,
  ORIGENS_DE_CONSENTIMENTO,
  TIPOS_DE_CANAL_DO_CONSENTIMENTO,
  validarNovoConsentimento,
  type ConsentimentoDoContato,
  type DecisaoDeConsentimento,
  type OrigemDeConsentimento,
  type TipoDeCanalDoConsentimento,
} from "@n1/dominio/crm/consentimentos";
import type { EstadoDoContato } from "@n1/dominio/crm/contatos";
import type { TipoComProvedor } from "@n1/dominio/provedores-de-canal";
import type { ErroDeApi } from "@/dados/crm/cliente-crm";
import { registrarConsentimento, useConsentimentosDoContato } from "@/dados/crm/consentimentos";
import { useNomeDoMembro } from "@/dados/crm/sessao";
import { useData } from "@/dados/store";
import { MensagemDeRecusa } from "@/features/crm/ciclo-de-vida";
import { comoErroDeApi } from "@/features/crm/formulario-de-contato";
import { Button, EmptyState, EsqueletoDeLinhas, Field, Painel, Pilula, Section, Select, Toast } from "@/features/shell/ui";
import { useFormat } from "@/features/shell/use-format";

const ROTULO_DO_TIPO: Record<TipoDeCanalDoConsentimento, string> = {
  whatsapp: "WhatsApp",
  instagram: "Instagram",
  email: "E-mail",
  todos: "Todos os Canais",
};

const ROTULO_DA_DECISAO: Record<DecisaoDeConsentimento, string> = { concedido: "Concedido", revogado: "Revogado" };

const ROTULO_DA_ORIGEM: Record<OrigemDeConsentimento, string> = {
  mensagem: "Mensagem",
  formulario: "Formulário",
  verbal: "Verbal",
  importacao: "Importação",
  automacao: "Automação",
};

/** Os tipos concretos de Canal: `todos` vale para qualquer um deles e não tem coluna própria no vigente. */
const TIPOS_DO_VIGENTE: readonly TipoComProvedor[] = ["whatsapp", "instagram", "email"];

const OPCOES_DE_TIPO = TIPOS_DE_CANAL_DO_CONSENTIMENTO.map((tipo) => ({ value: tipo, label: ROTULO_DO_TIPO[tipo] }));
const OPCOES_DE_DECISAO = DECISOES_DE_CONSENTIMENTO.map((decisao) => ({ value: decisao, label: ROTULO_DA_DECISAO[decisao] }));
const OPCOES_DE_ORIGEM = ORIGENS_DE_CONSENTIMENTO.map((origem) => ({ value: origem, label: ROTULO_DA_ORIGEM[origem] }));

interface Finalidade {
  readonly id: string;
  readonly nome: string;
}

/** As finalidades `ativo` do Catálogo, na ordem do Catálogo: o que se pode escolher ao registrar. */
function useFinalidadesAtivas(): readonly Finalidade[] {
  const catalogo = useData((dados) => dados.catalog);
  return catalogo
    .filter((item) => item.kind === "finalidadeConsentimento" && item.lifecycle === "ativo")
    .sort((a, b) => a.order - b.order)
    .map((item) => ({ id: item.id, nome: item.name }));
}

/** O nome de qualquer finalidade do Catálogo, inclusive a que já saiu de uso: o histórico a guarda por id. */
function useNomeDaFinalidade(): (id: string) => string {
  const catalogo = useData((dados) => dados.catalog);
  return (id) => catalogo.find((item) => item.id === id)?.name ?? "Finalidade removida";
}

function maisRecentePrimeiro(registros: readonly ConsentimentoDoContato[]): ConsentimentoDoContato[] {
  return [...registros].sort((a, b) => Date.parse(b.em) - Date.parse(a.em) || Date.parse(b.registradoEm) - Date.parse(a.registradoEm));
}

function PilulaDaDecisao({ decisao }: { readonly decisao: DecisaoDeConsentimento | undefined }) {
  if (decisao === undefined) return <Pilula>Sem registro</Pilula>;
  return <Pilula tom={decisao === "concedido" ? "sucesso" : "aviso"}>{ROTULO_DA_DECISAO[decisao]}</Pilula>;
}

/** Uma linha por finalidade, uma coluna por tipo de Canal, com o que vale agora. */
function QuadroDoVigente({
  finalidades,
  registros,
}: {
  readonly finalidades: readonly Finalidade[];
  readonly registros: readonly ConsentimentoDoContato[];
}) {
  if (finalidades.length === 0) return null;
  return (
    <Painel className="mb-3 overflow-x-auto p-4">
      <table className="w-full">
        <caption className="app-meta pb-2 text-left">O que vale agora, por finalidade e tipo de Canal</caption>
        <thead>
          <tr>
            <th scope="col" className="app-meta pb-1 text-left font-normal">
              Finalidade
            </th>
            {TIPOS_DO_VIGENTE.map((tipo) => (
              <th key={tipo} scope="col" className="app-meta pb-1 text-left font-normal">
                {ROTULO_DO_TIPO[tipo]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {finalidades.map((finalidade) => (
            <tr key={finalidade.id} style={{ borderTop: "1px solid var(--linha-sutil)" }}>
              <th scope="row" className="app-base py-2 pr-3 text-left font-normal">
                {finalidade.nome}
              </th>
              {TIPOS_DO_VIGENTE.map((tipo) => (
                <td key={tipo} className="py-2 pr-3" data-vigente={`${finalidade.id}:${tipo}`}>
                  <PilulaDaDecisao decisao={consentimentoVigente(registros, finalidade.id, tipo)?.decisao} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </Painel>
  );
}

function LinhaDoHistorico({ registro }: { readonly registro: ConsentimentoDoContato }) {
  const fmt = useFormat();
  const nomeDoMembro = useNomeDoMembro();
  const nomeDaFinalidade = useNomeDaFinalidade();
  return (
    <li className="flex flex-wrap items-center gap-2 py-2" style={{ borderBottom: "1px solid var(--linha-sutil)" }}>
      <span className="app-base min-w-0 flex-1 break-words">{nomeDaFinalidade(registro.finalidadeId)}</span>
      <Pilula>{ROTULO_DO_TIPO[registro.tipoDeCanal]}</Pilula>
      <PilulaDaDecisao decisao={registro.decisao} />
      <span className="app-meta">{`${fmt.instant(registro.em)} · ${ROTULO_DA_ORIGEM[registro.origem]} · registrado por ${nomeDoMembro(registro.registradoPor)}`}</span>
    </li>
  );
}

type ErrosDoRegistro = Partial<Record<"finalidadeId" | "tipoDeCanal" | "decisao" | "origem" | "em", string>>;

function FormularioDeRegistro({
  finalidades,
  contatoId,
  onRegistrado,
  onFechar,
}: {
  readonly finalidades: readonly Finalidade[];
  readonly contatoId: string;
  readonly onRegistrado: () => void;
  readonly onFechar: () => void;
}) {
  const [finalidadeId, setFinalidadeId] = useState("");
  const [tipoDeCanal, setTipoDeCanal] = useState("");
  const [decisao, setDecisao] = useState("");
  const [origem, setOrigem] = useState("");
  const [erros, setErros] = useState<ErrosDoRegistro>({});
  const [recusa, setRecusa] = useState<ErroDeApi | null>(null);
  const [salvando, setSalvando] = useState(false);

  const faltando = finalidadeId === ""
    ? "Escolha a finalidade."
    : tipoDeCanal === ""
      ? "Escolha o tipo de Canal."
      : decisao === ""
        ? "Escolha a decisão."
        : origem === ""
          ? "Informe de onde veio o consentimento."
          : salvando
            ? "Gravando o consentimento…"
            : undefined;

  const registrar = async () => {
    const entrada = {
      finalidadeId,
      tipoDeCanal: tipoDeCanal as TipoDeCanalDoConsentimento,
      decisao: decisao as DecisaoDeConsentimento,
      origem: origem as OrigemDeConsentimento,
    };
    const validacao = validarNovoConsentimento(entrada, new Date().toISOString());
    if (!validacao.ok) {
      setErros(validacao.field ? { [validacao.field]: validacao.error } : {});
      return;
    }
    setErros({});
    setRecusa(null);
    setSalvando(true);
    try {
      await registrarConsentimento(contatoId, validacao.value);
      onRegistrado();
    } catch (falha) {
      const erro = comoErroDeApi(falha, "Não foi possível registrar o consentimento. Tente de novo.");
      const campo = erro.campo;
      if (erro.status === 400 && campo !== undefined && ["finalidadeId", "tipoDeCanal", "decisao", "origem", "em"].includes(campo)) {
        setErros({ [campo]: erro.message });
      } else {
        setRecusa(erro);
      }
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Painel className="mb-3 grid gap-3 p-4 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <MensagemDeRecusa erro={recusa} onFechar={() => setRecusa(null)} />
      </div>
      <Field label="Finalidade" {...(erros.finalidadeId ? { error: erros.finalidadeId } : {})}>
        {(id) => (
          <Select
            id={id}
            value={finalidadeId}
            onChange={setFinalidadeId}
            placeholder="Escolher finalidade"
            options={finalidades.map((finalidade) => ({ value: finalidade.id, label: finalidade.nome }))}
            semOpcoes="Nenhuma finalidade no Catálogo."
          />
        )}
      </Field>
      <Field label="Tipo de Canal" {...(erros.tipoDeCanal ? { error: erros.tipoDeCanal } : {})}>
        {(id) => <Select id={id} value={tipoDeCanal} onChange={setTipoDeCanal} placeholder="Escolher tipo de Canal" options={OPCOES_DE_TIPO} />}
      </Field>
      <Field label="Decisão" {...(erros.decisao ? { error: erros.decisao } : {})}>
        {(id) => <Select id={id} value={decisao} onChange={setDecisao} placeholder="Escolher decisão" options={OPCOES_DE_DECISAO} />}
      </Field>
      <Field label="Origem" {...(erros.origem ? { error: erros.origem } : {})}>
        {(id) => <Select id={id} value={origem} onChange={setOrigem} placeholder="Escolher origem" options={OPCOES_DE_ORIGEM} />}
      </Field>
      <div className="flex items-center gap-2 sm:col-span-2">
        <Button variant="primary" onClick={() => void registrar()} {...(faltando ? { disabled: true, disabledReason: faltando } : {})}>
          Registrar
        </Button>
        <Button variant="ghost" onClick={onFechar}>
          Cancelar
        </Button>
      </div>
    </Painel>
  );
}

export function ConsentimentosDoContato({
  contatoId,
  estado,
  motivo,
}: {
  readonly contatoId: string;
  readonly estado: EstadoDoContato;
  /** A frase do Papel quando ele não deixa registrar (`usePodeNoCrm`); `undefined` quando deixa. */
  readonly motivo: string | undefined;
}) {
  const lista = useConsentimentosDoContato(contatoId);
  const finalidades = useFinalidadesAtivas();
  const [registrando, setRegistrando] = useState(false);
  const [registrado, setRegistrado] = useState(false);

  const registros = Array.isArray(lista.data?.itens) ? maisRecentePrimeiro(lista.data.itens) : [];
  // O Contato `mesclado` nunca chega aqui (a ficha não o desenha); a lixeira recusa como a api.
  const semEscrita =
    motivo ?? (estado === "na_lixeira" ? "Este Contato está na lixeira. Restaure-o antes de registrar o consentimento." : undefined);

  const historico = () => {
    if (lista.data === undefined) {
      if (lista.error) {
        return <EmptyState compact title="Não foi possível carregar os consentimentos." hint={comoErroDeApi(lista.error, "Tente de novo em instantes.").message} />;
      }
      return <EsqueletoDeLinhas quantidade={2} />;
    }
    if (registros.length === 0) {
      return <EmptyState compact title="Nenhum consentimento registrado." hint="Sem registro, nenhuma finalidade vale para este Contato." />;
    }
    return (
      <Painel className="px-4">
        <ul aria-label="Histórico de consentimento">
          {registros.map((registro) => (
            <LinhaDoHistorico key={registro.id} registro={registro} />
          ))}
        </ul>
      </Painel>
    );
  };

  return (
    <Section
      title="Consentimentos"
      {...(lista.data !== undefined ? { count: registros.length } : {})}
      action={
        <Button
          size="sm"
          onClick={() => setRegistrando((aberto) => !aberto)}
          {...(semEscrita ? { disabled: true, disabledReason: semEscrita } : {})}
        >
          Registrar consentimento
        </Button>
      }
    >
      {registrado ? (
        <Toast tone="success" onDismiss={() => setRegistrado(false)}>
          Consentimento registrado.
        </Toast>
      ) : null}
      {registrando && !semEscrita ? (
        <FormularioDeRegistro
          finalidades={finalidades}
          contatoId={contatoId}
          onRegistrado={() => {
            setRegistrando(false);
            setRegistrado(true);
          }}
          onFechar={() => setRegistrando(false)}
        />
      ) : null}
      {lista.data !== undefined ? <QuadroDoVigente finalidades={finalidades} registros={registros} /> : null}
      {historico()}
    </Section>
  );
}
