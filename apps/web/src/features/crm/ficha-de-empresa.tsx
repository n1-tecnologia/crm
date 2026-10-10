"use client";

/**
 * A ficha nova de Empresa (D-04), na página e no popup da lista: dados,
 * Identificadores, Endereços, Campos adicionais, Contatos vinculados (com o
 * admin que ela nunca fica sem, D-08), matriz e filiais — e o ciclo de vida do
 * D-06 (Arquivar, Excluir = Lixeira, Restaurar, Excluir permanentemente) com as
 * recusas de RN-EMP-09/10 visíveis por `MensagemDeRecusa`, links incluídos.
 *
 * O que a 007 NÃO guarda não aparece aqui, nem desabilitado, nem como "em
 * breve" (D-02): Tags, Comentários, Anexos, mesclagem, Sugestões de Vínculo.
 * A seção "Negócios" chega no 07-11.
 *
 * Duas pontas do D-08 moram aqui: Excluir avisa que os vínculos vigentes serão
 * encerrados (e os Contatos continuam existindo), e restaurar da lixeira pede o
 * Contato admin — pré-preenchido com o último admin encerrado.
 *
 * A ficha recebe o `EmpresaDetalhada` pronto (a página lê por `useEmpresa`) e
 * toda gravação passa pelas mutações de `dados/crm/empresas.ts`, que revalidam
 * `/empresas` e `/contatos` — o dado novo volta pela mesma prop. Quem barra de
 * verdade é o backend (D-14): `usePodeNoCrm` só desliga o botão e diz por quê.
 *
 * Todo texto vindo da api é renderizado como texto React (escapado); links
 * saem de rota fixa + id; nada de `dangerouslySetInnerHTML` (T-07-30).
 */

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import type { CamposAdicionais, Endereco } from "@n1/dominio/crm/comum";
import {
  FRASE_EMPRESA_SEM_ADMIN,
  nomeDeExibicaoDaEmpresa,
  TIPOS_IDENTIFICADOR_EMPRESA,
  validarEmpresa,
  validarIdentificadorDeEmpresa,
  type EmpresaDetalhada,
  type IdentificadorDeEmpresa,
  type TipoIdentificadorEmpresa,
  type VinculoDaEmpresa,
} from "@n1/dominio/crm/empresas";
import type { ErroDeApi } from "@/dados/crm/cliente-crm";
import {
  adicionarIdentificadorDeEmpresa,
  arquivarEmpresa,
  editarEmpresa,
  editarIdentificadorDeEmpresa,
  enviarEmpresaParaLixeira,
  excluirEmpresaPermanentemente,
  removerIdentificadorDeEmpresa,
  restaurarEmpresa,
} from "@/dados/crm/empresas";
import { useNomeDoMembro, usePodeNoCrm } from "@/dados/crm/sessao";
import { AcoesDeCicloDeVida, MensagemDeRecusa, seloDoEstado } from "@/features/crm/ciclo-de-vida";
import { EditorDeCamposAdicionais } from "@/features/crm/editor-de-campos-adicionais";
import { EditorDeEnderecos } from "@/features/crm/editor-de-enderecos";
import { ADMIN_VAZIO, BlocoDoContatoAdmin, MOTIVO_SEM_ADMIN, type ValoresDoAdmin } from "@/features/crm/formulario-de-empresa";
import { comoErroDeApi } from "@/features/crm/formulario-de-contato";
import { SeletorDeProprietario } from "@/features/crm/seletor-de-proprietario";
import { SeletorDeRegistro, type RegistroEscolhido } from "@/features/crm/seletor-de-registro";
import { VinculosDaEmpresa } from "@/features/crm/vinculos-da-empresa";
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
  SidePanel,
  StateSeal,
  TextArea,
  TextInput,
  Toast,
} from "@/features/shell/ui";

type Empresa = EmpresaDetalhada["empresa"];

/**
 * Executa uma gravação: limpa os avisos, mostra o sucesso, ou a recusa. Devolve se deu certo.
 * `aoRecusar` pode tomar a recusa para si (devolvendo `true`): a tela não a repete em `Toast`.
 */
type Agir = (acao: () => Promise<unknown>, sucesso?: string, aoRecusar?: (erro: ErroDeApi) => boolean) => Promise<boolean>;

const ROTULO_DO_TIPO: Record<TipoIdentificadorEmpresa, string> = {
  dominio: "Domínio",
  documento_fiscal: "Documento fiscal",
  telefone: "Telefone",
};

const AVISO_DA_LIXEIRA = "Os vínculos vigentes serão encerrados e os Contatos continuam existindo.";

interface ValoresDeEdicao {
  readonly nomeFantasia: string;
  readonly razaoSocial: string;
  readonly descricao: string;
  readonly origem: string;
  readonly proprietarioId: string;
  readonly matriz: RegistroEscolhido | null;
}

function valoresDeEdicao(detalhado: EmpresaDetalhada): ValoresDeEdicao {
  const { empresa, matriz } = detalhado;
  return {
    nomeFantasia: empresa.nomeFantasia ?? "",
    razaoSocial: empresa.razaoSocial ?? "",
    descricao: empresa.descricao ?? "",
    origem: empresa.origem ?? "",
    proprietarioId: empresa.proprietarioId,
    matriz: matriz ? { id: matriz.id, nome: matriz.nome } : null,
  };
}

/** "Editar Empresa": nome fantasia, razão social, descrição, origem, Proprietário e matriz. */
function DialogoDeEdicao({
  detalhado,
  onFechar,
  agir,
}: {
  readonly detalhado: EmpresaDetalhada;
  readonly onFechar: () => void;
  readonly agir: Agir;
}) {
  const [valores, setValores] = useState<ValoresDeEdicao>(() => valoresDeEdicao(detalhado));
  const [erroDeNome, setErroDeNome] = useState<string | undefined>(undefined);
  const [erroDaMatriz, setErroDaMatriz] = useState<string | undefined>(undefined);
  const [salvando, setSalvando] = useState(false);
  const { empresa } = detalhado;

  const salvar = async () => {
    const nome = validarEmpresa({ nomeFantasia: valores.nomeFantasia, razaoSocial: valores.razaoSocial });
    if (!nome.ok) {
      setErroDeNome(nome.error);
      return;
    }
    setErroDeNome(undefined);
    setErroDaMatriz(undefined);
    setSalvando(true);
    const deuCerto = await agir(
      () =>
        editarEmpresa(empresa.id, {
          nomeFantasia: valores.nomeFantasia.trim(),
          razaoSocial: valores.razaoSocial.trim(),
          descricao: valores.descricao.trim(),
          origem: valores.origem.trim(),
          proprietarioId: valores.proprietarioId,
          // "" limpa a matriz (contrato do 07-05).
          matrizId: valores.matriz?.id ?? "",
        }),
      "Alterações salvas.",
      (erro) => {
        if (erro.codigo !== "MATRIZ_INVALIDA") return false;
        setErroDaMatriz(erro.message);
        return true;
      },
    );
    setSalvando(false);
    if (deuCerto) onFechar();
  };

  return (
    <ConfirmDialog
      open
      wide
      title="Editar Empresa"
      description="Os Identificadores e os Contatos ficam nas seções próprias, logo abaixo."
      confirmLabel="Salvar alterações"
      {...(salvando ? { confirmDisabledReason: "Gravando a Empresa…" } : {})}
      onConfirm={() => void salvar()}
      onCancel={onFechar}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Nome fantasia" {...(erroDeNome ? { error: erroDeNome } : {})}>
          {(id) => (
            <TextInput id={id} value={valores.nomeFantasia} onChange={(nomeFantasia) => setValores({ ...valores, nomeFantasia })} invalid={erroDeNome !== undefined} />
          )}
        </Field>
        <Field label="Razão social">
          {(id) => <TextInput id={id} value={valores.razaoSocial} onChange={(razaoSocial) => setValores({ ...valores, razaoSocial })} />}
        </Field>
        <Field label="Origem">{(id) => <TextInput id={id} value={valores.origem} onChange={(origem) => setValores({ ...valores, origem })} />}</Field>
        <Field label="Proprietário">
          {(id) => (
            <SeletorDeProprietario id={id} valor={valores.proprietarioId} onChange={(proprietarioId) => setValores({ ...valores, proprietarioId })} rotuloVazio={null} />
          )}
        </Field>
        <div className="sm:col-span-2">
          <Field label="Empresa matriz" {...(erroDaMatriz ? { error: erroDaMatriz } : {})}>
            {(id) => (
              <SeletorDeRegistro
                id={id}
                recurso="empresas"
                rotulo="Empresa matriz"
                valor={valores.matriz}
                onChange={(matriz) => {
                  setErroDaMatriz(undefined);
                  setValores({ ...valores, matriz });
                }}
                excluirIds={[empresa.id]}
              />
            )}
          </Field>
        </div>
        <div className="sm:col-span-2">
          <Field label="Descrição">
            {(id) => <TextArea id={id} value={valores.descricao} onChange={(descricao) => setValores({ ...valores, descricao })} />}
          </Field>
        </div>
      </div>
    </ConfirmDialog>
  );
}

/** O último Contato que foi admin e foi encerrado: o palpite para quem volta a administrar a Empresa. */
function ultimoAdminEncerrado(vinculos: readonly VinculoDaEmpresa[]): VinculoDaEmpresa | undefined {
  return vinculos
    .filter((vinculo) => vinculo.admin && vinculo.fim !== null && vinculo.contatoEstado !== "na_lixeira")
    .sort((a, b) => (b.fim ?? "").localeCompare(a.fim ?? ""))[0];
}

/** Restaurar da lixeira (D-08): uma Empresa precisa de ao menos um Contato admin, então a restauração o pede. Também serve a lista (Lixeira). */
export function DialogoDeRestauracao({
  detalhado,
  onFechar,
  avisar,
}: {
  readonly detalhado: EmpresaDetalhada;
  readonly onFechar: () => void;
  readonly avisar: (texto: string) => void;
}) {
  const { empresa, vinculos } = detalhado;
  const nome = nomeDeExibicaoDaEmpresa(empresa);
  const anterior = ultimoAdminEncerrado(vinculos);
  const [admin, setAdmin] = useState<ValoresDoAdmin>({
    ...ADMIN_VAZIO,
    existente: anterior ? { id: anterior.contatoId, nome: anterior.contatoNome } : null,
    cargo: anterior?.cargo ?? "",
  });
  const [recusa, setRecusa] = useState<ErroDeApi | null>(null);
  const [enviando, setEnviando] = useState(false);

  const motivo = enviando ? "Restaurando a Empresa…" : admin.existente === null ? MOTIVO_SEM_ADMIN : undefined;

  const restaurar = async () => {
    if (admin.existente === null) return;
    setRecusa(null);
    setEnviando(true);
    try {
      const cargo = admin.cargo.trim();
      await restaurarEmpresa(empresa.id, { admin: { contatoId: admin.existente.id, ...(cargo !== "" ? { cargo } : {}) } });
      avisar(`${nome} restaurada.`);
      onFechar();
    } catch (falha) {
      setRecusa(comoErroDeApi(falha, "Não foi possível restaurar a Empresa. Tente de novo."));
    } finally {
      setEnviando(false);
    }
  };

  return (
    <ConfirmDialog
      open
      wide
      title={`Restaurar ${nome}`}
      description={FRASE_EMPRESA_SEM_ADMIN}
      confirmLabel="Restaurar Empresa"
      {...(motivo ? { confirmDisabledReason: motivo } : {})}
      onConfirm={() => void restaurar()}
      onCancel={onFechar}
    >
      <MensagemDeRecusa erro={recusa} onFechar={() => setRecusa(null)} />
      <BlocoDoContatoAdmin valores={admin} onChange={setAdmin} semNovo />
    </ConfirmDialog>
  );
}

function LinhaDeDado({ rotulo, children }: { readonly rotulo: string; readonly children: ReactNode }) {
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
  readonly detalhado: EmpresaDetalhada;
  readonly somenteLeitura: boolean;
  readonly motivo: string | undefined;
  readonly agir: Agir;
}) {
  const { empresa, identificadores } = detalhado;
  const [adicionando, setAdicionando] = useState(false);
  const [tipo, setTipo] = useState<TipoIdentificadorEmpresa>("dominio");
  const [valor, setValor] = useState("");
  const [pais, setPais] = useState("BR");
  const [erro, setErro] = useState<string | undefined>(undefined);
  const desligado = motivo ? { disabled: true, disabledReason: motivo } : {};

  const adicionar = async () => {
    const paisAparado = pais.trim().toUpperCase();
    const entrada = { tipo, valor: valor.trim(), ...(tipo === "documento_fiscal" ? { pais: paisAparado } : {}) };
    const validacao = validarIdentificadorDeEmpresa(entrada);
    if (!validacao.ok) {
      setErro(validacao.error);
      return;
    }
    setErro(undefined);
    // O servidor normaliza e é a autoridade; a tela mandou só o que a pessoa digitou.
    const deuCerto = await agir(() => adicionarIdentificadorDeEmpresa(empresa.id, entrada), "Identificador adicionado.");
    if (deuCerto) {
      setValor("");
      setAdicionando(false);
    }
  };

  const linha = (identificador: IdentificadorDeEmpresa) => (
    <li key={identificador.id} className="flex flex-wrap items-center gap-2 py-2" style={{ borderBottom: "1px solid var(--linha-sutil)" }}>
      <Pilula>{ROTULO_DO_TIPO[identificador.tipo]}</Pilula>
      <span className="app-base min-w-0 flex-1 break-words">
        {identificador.valor}
        {identificador.pais ? ` (${identificador.pais})` : ""}
      </span>
      {identificador.principal ? <Pilula tom="info">principal</Pilula> : null}
      {identificador.verificado ? <Pilula tom="sucesso">verificado</Pilula> : null}
      {somenteLeitura ? null : (
        <span className="flex items-center gap-1">
          {identificador.principal ? null : (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => void agir(() => editarIdentificadorDeEmpresa(empresa.id, identificador.id, { principal: true }))}
              {...desligado}
            >
              Tornar principal
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            onClick={() => void agir(() => removerIdentificadorDeEmpresa(empresa.id, identificador.id), "Identificador removido.")}
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
        <Painel className="mb-3 grid gap-3 p-4 sm:grid-cols-[12rem_1fr_6rem_auto] sm:items-end">
          <Field label="Tipo">
            {(id) => (
              <Select
                id={id}
                value={tipo}
                options={TIPOS_IDENTIFICADOR_EMPRESA.map((t) => ({ value: t, label: ROTULO_DO_TIPO[t] }))}
                onChange={(proximo) => setTipo(proximo as TipoIdentificadorEmpresa)}
              />
            )}
          </Field>
          <Field label="Valor do Identificador" {...(erro ? { error: erro } : {})}>
            {(id) => <TextInput id={id} value={valor} onChange={setValor} invalid={erro !== undefined} />}
          </Field>
          {tipo === "documento_fiscal" ? (
            <Field label="País">{(id) => <TextInput id={id} value={pais} onChange={setPais} />}</Field>
          ) : (
            <span aria-hidden="true" />
          )}
          <Button variant="primary" onClick={() => void adicionar()}>
            Adicionar
          </Button>
        </Painel>
      ) : null}
      {identificadores.length === 0 ? (
        <EmptyState compact title="Nenhum Identificador." hint="Adicione o domínio, o documento fiscal ou o telefone da Empresa." />
      ) : (
        <Painel className="px-4">
          <ul>{identificadores.map(linha)}</ul>
        </Painel>
      )}
    </Section>
  );
}

function SecaoDeEnderecos({
  empresa,
  somenteLeitura,
  motivo,
  agir,
}: {
  readonly empresa: Empresa;
  readonly somenteLeitura: boolean;
  readonly motivo: string | undefined;
  readonly agir: Agir;
}) {
  const [rascunho, setRascunho] = useState<readonly Endereco[]>(empresa.enderecos);
  const [erro, setErro] = useState<string | undefined>(undefined);
  const sujo = JSON.stringify(rascunho) !== JSON.stringify(empresa.enderecos);
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
            onClick={() => void agir(() => editarEmpresa(empresa.id, { enderecos: [...rascunho] }), "Alterações salvas.")}
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
  empresa,
  somenteLeitura,
  motivo,
  agir,
}: {
  readonly empresa: Empresa;
  readonly somenteLeitura: boolean;
  readonly motivo: string | undefined;
  readonly agir: Agir;
}) {
  const [rascunho, setRascunho] = useState<CamposAdicionais>(empresa.camposAdicionais);
  const [erro, setErro] = useState<string | undefined>(undefined);
  const sujo = JSON.stringify(rascunho) !== JSON.stringify(empresa.camposAdicionais);
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
            onClick={() => void agir(() => editarEmpresa(empresa.id, { camposAdicionais: rascunho }), "Alterações salvas.")}
            {...(porQueNao ? { disabled: true, disabledReason: porQueNao } : {})}
          >
            Salvar campos adicionais
          </Button>
        </div>
      )}
    </Section>
  );
}

function SecaoDeMatrizEFiliais({ detalhado }: { readonly detalhado: EmpresaDetalhada }) {
  const { matriz, filiais } = detalhado;
  const link = (item: { readonly id: string; readonly nome: string; readonly estado: "ativo" | "arquivado" | "na_lixeira" }) => (
    <li key={item.id} className="flex items-center gap-2 py-1">
      <Link href={`/crm/empresas/${item.id}`} className="app-base underline" style={{ color: "var(--texto)" }}>
        {item.nome}
      </Link>
      {item.estado !== "ativo" ? <StateSeal state={seloDoEstado(item.estado)} /> : null}
    </li>
  );
  return (
    <Section title="Matriz e filiais" count={filiais.length}>
      <Painel className="px-4 py-2">
        <p className="app-meta pt-1">Empresa matriz</p>
        {matriz ? <ul>{link(matriz)}</ul> : <p className="app-base py-1">Esta Empresa não tem matriz.</p>}
        <p className="app-meta pt-2">Filiais</p>
        {filiais.length > 0 ? <ul>{filiais.map(link)}</ul> : <p className="app-base py-1">Esta Empresa não tem filiais.</p>}
      </Painel>
    </Section>
  );
}

export function FichaDeEmpresa({
  empresaId,
  detalhado,
  modo,
  onFechar,
}: {
  readonly empresaId: string;
  readonly detalhado: EmpresaDetalhada;
  /** `popup` é a ficha sobre a lista (`?empresa=<id>`); o rodapé leva à página cheia. */
  readonly modo: "pagina" | "popup";
  /** Fechar o popup (também depois de excluir de vez). */
  readonly onFechar?: () => void;
}) {
  const { empresa } = detalhado;
  const router = useRouter();
  const nomeDoMembro = useNomeDoMembro();
  const motivoDeEscrita = usePodeNoCrm("editar", "empresa");
  const [editando, setEditando] = useState(false);
  const [restaurando, setRestaurando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [recusa, setRecusa] = useState<ErroDeApi | null>(null);

  const nome = nomeDeExibicaoDaEmpresa(empresa);
  const ativa = empresa.estado === "ativo";

  const agir: Agir = async (acao, sucesso, aoRecusar) => {
    setRecusa(null);
    setAviso(null);
    try {
      await acao();
      if (sucesso) setAviso(sucesso);
      return true;
    } catch (falha) {
      const erro = comoErroDeApi(falha, "Não foi possível concluir a ação. Tente de novo.");
      if (!aoRecusar?.(erro)) setRecusa(erro);
      return false;
    }
  };

  const restaurar = () => {
    // Da lixeira a Empresa volta com um admin (D-08); de arquivada volta direto.
    if (empresa.estado === "na_lixeira") {
      setRestaurando(true);
      return;
    }
    void agir(() => restaurarEmpresa(empresaId), `${nome} restaurada.`, (erro) => {
      if (erro.codigo !== "EMPRESA_SEM_ADMIN") return false;
      setRestaurando(true);
      return true;
    });
  };

  const desligado = motivoDeEscrita ? { disabled: true, disabledReason: motivoDeEscrita } : {};

  const corpo = (
    <div className="flex h-full flex-col">
      <PageHeader
        title={nome}
        seal={<StateSeal state={seloDoEstado(empresa.estado)} />}
        meta={`Proprietário: ${nomeDoMembro(empresa.proprietarioId)}`}
        actions={
          <AcoesDeCicloDeVida
            estado={empresa.estado}
            rotulo={nome}
            motivoSemPermissao={motivoDeEscrita}
            avisoDaLixeira={AVISO_DA_LIXEIRA}
            onArquivar={() => void agir(() => arquivarEmpresa(empresaId), `${nome} arquivada.`)}
            onRestaurar={restaurar}
            onEnviarParaLixeira={() => void agir(() => enviarEmpresaParaLixeira(empresaId), `${nome} foi para a Lixeira.`)}
            onExcluirPermanentemente={async () => {
              if (await agir(() => excluirEmpresaPermanentemente(empresaId))) {
                if (modo === "popup" && onFechar) onFechar();
                else router.push("/crm/empresas");
              }
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
            ativa ? (
              <Button size="sm" onClick={() => setEditando(true)} {...desligado}>
                Editar
              </Button>
            ) : undefined
          }
        >
          <Painel className="p-4">
            <dl>
              <LinhaDeDado rotulo="Nome fantasia">{empresa.nomeFantasia ?? "—"}</LinhaDeDado>
              <LinhaDeDado rotulo="Razão social">{empresa.razaoSocial ?? "—"}</LinhaDeDado>
              <LinhaDeDado rotulo="Origem">{empresa.origem ?? "—"}</LinhaDeDado>
              <LinhaDeDado rotulo="Proprietário">{nomeDoMembro(empresa.proprietarioId)}</LinhaDeDado>
              <LinhaDeDado rotulo="Descrição">{empresa.descricao ?? "—"}</LinhaDeDado>
            </dl>
          </Painel>
        </Section>
        {editando ? <DialogoDeEdicao detalhado={detalhado} onFechar={() => setEditando(false)} agir={agir} /> : null}
        {restaurando ? <DialogoDeRestauracao detalhado={detalhado} onFechar={() => setRestaurando(false)} avisar={setAviso} /> : null}

        <SecaoDeIdentificadores detalhado={detalhado} somenteLeitura={!ativa} motivo={motivoDeEscrita} agir={agir} />
        <SecaoDeEnderecos
          key={`enderecos-${JSON.stringify(empresa.enderecos)}`}
          empresa={empresa}
          somenteLeitura={!ativa}
          motivo={motivoDeEscrita}
          agir={agir}
        />
        <SecaoDeCamposAdicionais
          key={`campos-${JSON.stringify(empresa.camposAdicionais)}`}
          empresa={empresa}
          somenteLeitura={!ativa}
          motivo={motivoDeEscrita}
          agir={agir}
        />
        <VinculosDaEmpresa detalhado={detalhado} podeEditar={ativa} motivo={motivoDeEscrita} avisar={setAviso} />
        <SecaoDeMatrizEFiliais detalhado={detalhado} />
      </CorpoDeTela>
    </div>
  );

  if (modo === "pagina") return corpo;

  return (
    <SidePanel
      title="Empresa"
      open
      onClose={onFechar ?? (() => undefined)}
      semRespiro
      footer={
        <span className="flex flex-1 items-center justify-end">
          <Link href={`/crm/empresas/${empresaId}`} className="btn btn-fantasma btn-sm">
            Abrir página cheia
          </Link>
        </span>
      }
    >
      {corpo}
    </SidePanel>
  );
}
