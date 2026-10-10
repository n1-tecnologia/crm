"use client";

/**
 * A ficha nova de Contato (D-04): enxuta, sobre o que a 007 guarda — dados,
 * Identificadores, Endereços, Campos adicionais e Empresas vinculadas — e com o
 * ciclo de vida do D-06 (Arquivar, Excluir = Lixeira, Restaurar, Excluir
 * permanentemente) e as recusas do D-09 visíveis por `MensagemDeRecusa`.
 *
 * O que a 007 NÃO guarda não aparece aqui, nem desabilitado, nem como "em
 * breve" (D-02): Tags, Consentimentos, Comentários, Anexos, Conversas,
 * mesclagem e temperatura. A seção "Negócios" chega no 07-11.
 *
 * A ficha recebe o `ContatoDetalhado` pronto (a página lê por `useContato`) e
 * toda gravação passa pelas mutações de `dados/crm/contatos.ts`, que revalidam
 * `/contatos` — o dado novo volta pela mesma prop. Quem barra de verdade é o
 * backend (D-14): `usePodeNoCrm` só desliga o botão e diz por quê.
 *
 * Todo texto vindo da api é renderizado como texto React (escapado); nada de
 * `dangerouslySetInnerHTML` (T-07-21).
 */

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Endereco, CamposAdicionais } from "@n1/dominio/crm/comum";
import {
  nomeDeExibicaoDoContato,
  ROTULO_DO_TIPO_DE_IDENTIFICADOR,
  TIPOS_IDENTIFICADOR_CONTATO,
  validarIdentificadorDeContato,
  type ContatoDetalhado,
  type IdentificadorDeContato,
  type TipoIdentificadorContato,
} from "@n1/dominio/crm/contatos";
import type { ErroDeApi } from "@/dados/crm/cliente-crm";
import {
  adicionarIdentificador,
  arquivarContato,
  editarContato,
  editarIdentificador,
  enviarContatoParaLixeira,
  excluirContatoPermanentemente,
  removerIdentificador,
  restaurarContato,
} from "@/dados/crm/contatos";
import { useNomeDoMembro, usePodeNoCrm } from "@/dados/crm/sessao";
import { AcoesDeCicloDeVida, MensagemDeRecusa, seloDoEstado } from "@/features/crm/ciclo-de-vida";
import { EditorDeCamposAdicionais } from "@/features/crm/editor-de-campos-adicionais";
import { EditorDeEnderecos } from "@/features/crm/editor-de-enderecos";
import {
  comoErroDeApi,
  FormularioDeContato,
  montarEdicaoDeContato,
  type ErrosDoContato,
  type ValoresDoContato,
} from "@/features/crm/formulario-de-contato";
import {
  Button,
  ConfirmDialog,
  CorpoDeTela,
  EmptyState,
  Field,
  PageHeader,
  Painel,
  Pilula,
  Section,
  Select,
  StateSeal,
  TextInput,
  Toast,
} from "@/features/shell/ui";
import { useFormat } from "@/features/shell/use-format";

type Contato = ContatoDetalhado["contato"];

/** Executa uma gravação: limpa os avisos, mostra o sucesso, ou a recusa. Devolve se deu certo. */
type Agir = (acao: () => Promise<unknown>, sucesso?: string) => Promise<boolean>;

function valoresDoContato(contato: Contato): ValoresDoContato {
  return {
    nome: contato.nome ?? "",
    sobrenome: contato.sobrenome ?? "",
    email: "",
    telefone: "",
    whatsapp: "",
    instagram: "",
    dataNascimento: contato.dataNascimento ?? "",
    idioma: contato.idioma ?? "",
    fusoHorario: contato.fusoHorario ?? "",
    descricao: contato.descricao ?? "",
    origem: contato.origem ?? "",
    qualificacao: contato.qualificacao ?? "",
    proprietarioId: contato.proprietarioId,
  };
}

/** "Editar Contato": o mesmo corpo da criação, sem os Identificadores (que têm seção própria). */
function DialogoDeEdicao({
  detalhado,
  onFechar,
  agir,
}: {
  readonly detalhado: ContatoDetalhado;
  readonly onFechar: () => void;
  readonly agir: Agir;
}) {
  const [valores, setValores] = useState<ValoresDoContato>(() => valoresDoContato(detalhado.contato));
  const [erros, setErros] = useState<ErrosDoContato>({});
  const [salvando, setSalvando] = useState(false);

  const salvar = async () => {
    const montado = montarEdicaoDeContato(valores, detalhado.identificadores.length);
    if (!montado.ok) {
      setErros(montado.erros);
      return;
    }
    setErros({});
    setSalvando(true);
    const deuCerto = await agir(() => editarContato(detalhado.contato.id, montado.corpo), "Alterações salvas.");
    setSalvando(false);
    if (deuCerto) onFechar();
  };

  return (
    <ConfirmDialog
      open
      wide
      title="Editar Contato"
      description="Os Identificadores ficam na seção própria, logo abaixo."
      confirmLabel="Salvar alterações"
      {...(salvando ? { confirmDisabledReason: "Gravando o Contato…" } : {})}
      onConfirm={() => void salvar()}
      onCancel={onFechar}
    >
      <FormularioDeContato valores={valores} onChange={setValores} erros={erros} comIdentificadores={false} />
    </ConfirmDialog>
  );
}

function LinhaDeDado({ rotulo, children }: { readonly rotulo: string; readonly children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1">
      <dt className="app-meta shrink-0">{rotulo}</dt>
      <dd className="app-base min-w-0 break-words text-right" style={{ color: "var(--texto)" }}>
        {children}
      </dd>
    </div>
  );
}

function SecaoDeIdentificadores({
  detalhado,
  somenteLeitura,
  motivo,
  agir,
}: {
  readonly detalhado: ContatoDetalhado;
  readonly somenteLeitura: boolean;
  readonly motivo: string | undefined;
  readonly agir: Agir;
}) {
  const { contato, identificadores } = detalhado;
  const [adicionando, setAdicionando] = useState(false);
  const [tipo, setTipo] = useState<TipoIdentificadorContato>("email");
  const [valor, setValor] = useState("");
  const [erro, setErro] = useState<string | undefined>(undefined);
  const desligado = motivo ? { disabled: true, disabledReason: motivo } : {};

  const adicionar = async () => {
    const validacao = validarIdentificadorDeContato({ tipo, valor: valor.trim() });
    if (!validacao.ok) {
      setErro(validacao.error);
      return;
    }
    setErro(undefined);
    // O servidor normaliza e é a autoridade; a tela mandou só o que a pessoa digitou.
    const deuCerto = await agir(() => adicionarIdentificador(contato.id, { tipo, valor: valor.trim() }), "Identificador adicionado.");
    if (deuCerto) {
      setValor("");
      setAdicionando(false);
    }
  };

  const linha = (identificador: IdentificadorDeContato) => (
    <li key={identificador.id} className="flex flex-wrap items-center gap-2 py-2" style={{ borderBottom: "1px solid var(--linha-sutil)" }}>
      <Pilula>{ROTULO_DO_TIPO_DE_IDENTIFICADOR[identificador.tipo]}</Pilula>
      <span className="app-base min-w-0 flex-1 break-words">{identificador.valorExibido ?? identificador.valor}</span>
      {identificador.principal ? <Pilula tom="info">principal</Pilula> : null}
      {identificador.verificado ? <Pilula tom="sucesso">verificado</Pilula> : null}
      {somenteLeitura ? null : (
        <span className="flex items-center gap-1">
          {identificador.principal ? null : (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => void agir(() => editarIdentificador(contato.id, identificador.id, { principal: true }))}
              {...desligado}
            >
              Tornar principal
            </Button>
          )}
          {identificador.verificado ? null : (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => void agir(() => editarIdentificador(contato.id, identificador.id, { verificado: true }))}
              {...desligado}
            >
              Marcar como verificado
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            onClick={() => void agir(() => removerIdentificador(contato.id, identificador.id), "Identificador removido.")}
            {...desligado}
          >
            Remover
          </Button>
        </span>
      )}
    </li>
  );

  return (
    <Section
      title="Identificadores"
      count={identificadores.length}
      action={
        somenteLeitura ? undefined : (
          <Button size="sm" onClick={() => setAdicionando((aberto) => !aberto)} {...desligado}>
            Adicionar Identificador
          </Button>
        )
      }
    >
      {adicionando && !somenteLeitura ? (
        <Painel className="mb-3 grid gap-3 p-4 sm:grid-cols-[12rem_1fr_auto] sm:items-end">
          <Field label="Tipo">
            {(id) => (
              <Select
                id={id}
                value={tipo}
                options={TIPOS_IDENTIFICADOR_CONTATO.map((t) => ({ value: t, label: ROTULO_DO_TIPO_DE_IDENTIFICADOR[t] }))}
                onChange={(proximo) => setTipo(proximo as TipoIdentificadorContato)}
              />
            )}
          </Field>
          <Field label="Valor do Identificador" {...(erro ? { error: erro } : {})}>
            {(id) => <TextInput id={id} value={valor} onChange={setValor} invalid={erro !== undefined} />}
          </Field>
          <Button variant="primary" onClick={() => void adicionar()}>
            Adicionar
          </Button>
        </Painel>
      ) : null}
      {identificadores.length === 0 ? (
        <EmptyState compact title="Nenhum Identificador." hint="Adicione um e-mail, telefone, WhatsApp ou Instagram." />
      ) : (
        <Painel className="px-4">
          <ul>{identificadores.map(linha)}</ul>
        </Painel>
      )}
    </Section>
  );
}

function SecaoDeEnderecos({
  contato,
  somenteLeitura,
  motivo,
  agir,
}: {
  readonly contato: Contato;
  readonly somenteLeitura: boolean;
  readonly motivo: string | undefined;
  readonly agir: Agir;
}) {
  const [rascunho, setRascunho] = useState<readonly Endereco[]>(contato.enderecos);
  const [erro, setErro] = useState<string | undefined>(undefined);
  const sujo = JSON.stringify(rascunho) !== JSON.stringify(contato.enderecos);
  const porQueNao = motivo ?? erro ?? (sujo ? undefined : "Nada para salvar.");

  return (
    <Section title="Endereços" count={rascunho.length}>
      <EditorDeEnderecos
        valor={rascunho}
        onChange={(lista, frase) => {
          setRascunho(lista);
          setErro(frase);
        }}
        disabled={somenteLeitura || motivo !== undefined}
      />
      {somenteLeitura ? null : (
        <div className="mt-3">
          <Button
            variant="primary"
            onClick={() => void agir(() => editarContato(contato.id, { enderecos: [...rascunho] }), "Alterações salvas.")}
            {...(porQueNao ? { disabled: true, disabledReason: porQueNao } : {})}
          >
            Salvar endereços
          </Button>
        </div>
      )}
    </Section>
  );
}

function SecaoDeCamposAdicionais({
  contato,
  somenteLeitura,
  motivo,
  agir,
}: {
  readonly contato: Contato;
  readonly somenteLeitura: boolean;
  readonly motivo: string | undefined;
  readonly agir: Agir;
}) {
  const [rascunho, setRascunho] = useState<CamposAdicionais>(contato.camposAdicionais);
  const [erro, setErro] = useState<string | undefined>(undefined);
  const sujo = JSON.stringify(rascunho) !== JSON.stringify(contato.camposAdicionais);
  const porQueNao = motivo ?? erro ?? (sujo ? undefined : "Nada para salvar.");

  return (
    <Section title="Campos adicionais" count={Object.keys(rascunho).length}>
      <EditorDeCamposAdicionais
        valor={rascunho}
        onChange={(campos, frase) => {
          setRascunho(campos);
          setErro(frase);
        }}
        disabled={somenteLeitura || motivo !== undefined}
      />
      {somenteLeitura ? null : (
        <div className="mt-3">
          <Button
            variant="primary"
            onClick={() => void agir(() => editarContato(contato.id, { camposAdicionais: rascunho }), "Alterações salvas.")}
            {...(porQueNao ? { disabled: true, disabledReason: porQueNao } : {})}
          >
            Salvar campos adicionais
          </Button>
        </div>
      )}
    </Section>
  );
}

function SecaoDeEmpresas({ vinculos }: { readonly vinculos: ContatoDetalhado["vinculos"] }) {
  const fmt = useFormat();
  const vigentes = vinculos.filter((vinculo) => vinculo.fim === null);
  const encerrados = vinculos.filter((vinculo) => vinculo.fim !== null);

  const linha = (vinculo: ContatoDetalhado["vinculos"][number]) => (
    <li key={vinculo.id} className="flex flex-wrap items-center gap-2 py-2" style={{ borderBottom: "1px solid var(--linha-sutil)" }}>
      <Link href={`/crm/empresas/${vinculo.empresaId}`} className="app-base underline" style={{ color: "var(--texto)" }}>
        {vinculo.empresaNome}
      </Link>
      {vinculo.cargo ? <span className="app-base">{vinculo.cargo}</span> : null}
      {vinculo.admin ? <Pilula tom="info">admin</Pilula> : null}
      <span className="app-meta">
        {vinculo.fim !== null
          ? `encerrado em ${fmt.civilDate(vinculo.fim)}`
          : vinculo.inicio !== null
            ? `desde ${fmt.civilDate(vinculo.inicio)}`
            : null}
      </span>
    </li>
  );

  return (
    <Section title="Empresas" count={vigentes.length}>
      {vinculos.length === 0 ? (
        <EmptyState compact title="Este Contato não está vinculado a nenhuma Empresa." hint="O vínculo é feito na ficha da Empresa." />
      ) : (
        <Painel className="px-4">
          <ul>{vigentes.map(linha)}</ul>
          {encerrados.length > 0 ? (
            <details className="py-2">
              <summary className="app-meta cursor-pointer">{`Vínculos encerrados (${encerrados.length})`}</summary>
              <ul>{encerrados.map(linha)}</ul>
            </details>
          ) : null}
        </Painel>
      )}
    </Section>
  );
}

export function FichaDeContato({ contatoId, detalhado }: { readonly contatoId: string; readonly detalhado: ContatoDetalhado }) {
  const { contato, identificadores, vinculos } = detalhado;
  const router = useRouter();
  const fmt = useFormat();
  const nomeDoMembro = useNomeDoMembro();
  const motivoDeEscrita = usePodeNoCrm("editar", "contato");
  const [editando, setEditando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [recusa, setRecusa] = useState<ErroDeApi | null>(null);

  const principal = identificadores.find((identificador) => identificador.principal);
  const nome = nomeDeExibicaoDoContato(contato, principal ? (principal.valorExibido ?? principal.valor) : null);
  const ativo = contato.estado === "ativo";

  const agir: Agir = async (acao, sucesso) => {
    setRecusa(null);
    setAviso(null);
    try {
      await acao();
      if (sucesso) setAviso(sucesso);
      return true;
    } catch (falha) {
      setRecusa(comoErroDeApi(falha, "Não foi possível concluir a ação. Tente de novo."));
      return false;
    }
  };

  const desligado = motivoDeEscrita ? { disabled: true, disabledReason: motivoDeEscrita } : {};

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title={nome}
        seal={<StateSeal state={seloDoEstado(contato.estado)} />}
        meta={`Proprietário: ${nomeDoMembro(contato.proprietarioId)}`}
        actions={
          <AcoesDeCicloDeVida
            estado={contato.estado}
            rotulo={nome}
            motivoSemPermissao={motivoDeEscrita}
            onArquivar={() => void agir(() => arquivarContato(contatoId), `${nome} arquivado.`)}
            onRestaurar={() => void agir(() => restaurarContato(contatoId), `${nome} restaurado.`)}
            onEnviarParaLixeira={() => void agir(() => enviarContatoParaLixeira(contatoId), `${nome} foi para a Lixeira.`)}
            onExcluirPermanentemente={async () => {
              if (await agir(() => excluirContatoPermanentemente(contatoId))) router.push("/crm/contatos");
            }}
          />
        }
      />

      <CorpoDeTela>
        {aviso ? (
          <Toast tone="success" onDismiss={() => setAviso(null)}>
            {aviso}
          </Toast>
        ) : null}
        <MensagemDeRecusa erro={recusa} onFechar={() => setRecusa(null)} />

        <Section
          title="Dados"
          action={
            ativo ? (
              <Button size="sm" onClick={() => setEditando(true)} {...desligado}>
                Editar
              </Button>
            ) : undefined
          }
        >
          <Painel className="p-4">
            <dl>
              <LinhaDeDado rotulo="Nome">{contato.nome ?? "—"}</LinhaDeDado>
              <LinhaDeDado rotulo="Sobrenome">{contato.sobrenome ?? "—"}</LinhaDeDado>
              <LinhaDeDado rotulo="Data de nascimento">{contato.dataNascimento ? fmt.civilDate(contato.dataNascimento) : "—"}</LinhaDeDado>
              <LinhaDeDado rotulo="Idioma">{contato.idioma ?? "—"}</LinhaDeDado>
              <LinhaDeDado rotulo="Fuso horário">{contato.fusoHorario ?? "—"}</LinhaDeDado>
              <LinhaDeDado rotulo="Origem">{contato.origem ?? "—"}</LinhaDeDado>
              <LinhaDeDado rotulo="Qualificação">{contato.qualificacao ?? "—"}</LinhaDeDado>
              <LinhaDeDado rotulo="Proprietário">{nomeDoMembro(contato.proprietarioId)}</LinhaDeDado>
              <LinhaDeDado rotulo="Descrição">{contato.descricao ?? "—"}</LinhaDeDado>
            </dl>
          </Painel>
        </Section>
        {editando ? <DialogoDeEdicao detalhado={detalhado} onFechar={() => setEditando(false)} agir={agir} /> : null}

        <SecaoDeIdentificadores detalhado={detalhado} somenteLeitura={!ativo} motivo={motivoDeEscrita} agir={agir} />
        <SecaoDeEnderecos
          key={`enderecos-${JSON.stringify(contato.enderecos)}`}
          contato={contato}
          somenteLeitura={!ativo}
          motivo={motivoDeEscrita}
          agir={agir}
        />
        <SecaoDeCamposAdicionais
          key={`campos-${JSON.stringify(contato.camposAdicionais)}`}
          contato={contato}
          somenteLeitura={!ativo}
          motivo={motivoDeEscrita}
          agir={agir}
        />
        <SecaoDeEmpresas vinculos={vinculos} />
      </CorpoDeTela>
    </div>
  );
}
