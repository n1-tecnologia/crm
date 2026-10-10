"use client";

/**
 * O diálogo "Nova Empresa" (D-04, D-08, D-11).
 *
 * A Empresa nasce com o seu Contato admin: o bloco "Contato admin" é
 * OBRIGATÓRIO e vai no mesmo envio — um Contato que já existe (busca na api
 * pelo `SeletorDeRegistro`) ou um Novo Contato cadastrado ali mesmo — e tudo
 * sai num `POST /empresas` só (`criarEmpresa`). A Empresa sem admin não existe
 * nesta plataforma (decisão de produto, cabeçalho da 007): sem nome ou sem admin,
 * Criar fica desligado e diz o motivo.
 *
 * A pré-validação é a do domínio (`validarEmpresa`,
 * `validarIdentificadorDeEmpresa`, `validarContato` via `montarNovoContato`),
 * a mesma que o endpoint aplica: o erro cai no `Field` do campo antes de
 * qualquer ida ao servidor. O que vai para a api é o que a pessoa digitou —
 * quem normaliza (domínio em minúsculas, documento só com dígitos) é o
 * servidor, a autoridade (a unicidade depende do valor canônico).
 */

import { useState } from "react";
import {
  validarEmpresa,
  validarIdentificadorDeEmpresa,
  type AdminDaNovaEmpresa,
  type EmpresaDetalhada,
  type NovaEmpresa,
  type NovoIdentificadorDeEmpresa,
} from "@n1/dominio/crm/empresas";
import type { ErroDeApi } from "@/dados/crm/cliente-crm";
import { criarEmpresa, type EntradaDeNovaEmpresa } from "@/dados/crm/empresas";
import { MensagemDeRecusa } from "@/features/crm/ciclo-de-vida";
import { comoErroDeApi, montarNovoContato, VALORES_VAZIOS } from "@/features/crm/formulario-de-contato";
import { SeletorDeProprietario } from "@/features/crm/seletor-de-proprietario";
import { SeletorDeRegistro, type RegistroEscolhido } from "@/features/crm/seletor-de-registro";
import { ConfirmDialog, Field, ReguaDeSecao, Segmentos, TextArea, TextInput } from "@/features/shell/ui";

export const MOTIVO_SEM_NOME = "Informe o nome fantasia ou a razão social.";
export const MOTIVO_SEM_ADMIN = "Escolha ou crie o Contato admin da Empresa.";

export type ModoDoAdmin = "existente" | "novo";

export interface ValoresDaEmpresa {
  readonly nomeFantasia: string;
  readonly razaoSocial: string;
  readonly dominio: string;
  readonly documento: string;
  /** O país de emissão do documento fiscal (padrão BR). */
  readonly pais: string;
  readonly telefone: string;
  readonly descricao: string;
  readonly origem: string;
  readonly matriz: RegistroEscolhido | null;
  /** O id do Membro, ou `""` = quem cria (D-11). */
  readonly proprietarioId: string;
}

export interface ValoresDoAdmin {
  readonly modo: ModoDoAdmin;
  readonly existente: RegistroEscolhido | null;
  readonly cargo: string;
  readonly nome: string;
  readonly sobrenome: string;
  readonly email: string;
  readonly telefone: string;
}

export const EMPRESA_VAZIA: ValoresDaEmpresa = {
  nomeFantasia: "",
  razaoSocial: "",
  dominio: "",
  documento: "",
  pais: "BR",
  telefone: "",
  descricao: "",
  origem: "",
  matriz: null,
  proprietarioId: "",
};

export const ADMIN_VAZIO: ValoresDoAdmin = {
  modo: "existente",
  existente: null,
  cargo: "",
  nome: "",
  sobrenome: "",
  email: "",
  telefone: "",
};

export type ErrosDaEmpresa = Partial<
  Record<"nomeFantasia" | "dominio" | "documento" | "pais" | "telefone" | "admin" | "novoNome" | "novoEmail" | "novoTelefone", string>
>;

export type ResultadoDaMontagem =
  | { readonly ok: true; readonly corpo: EntradaDeNovaEmpresa }
  | { readonly ok: false; readonly erros: ErrosDaEmpresa };

const aparado = (texto: string): string => texto.trim();

/** `undefined` quando dá para criar; senão o motivo que o botão mostra. */
export function motivoParaNaoCriar(empresa: ValoresDaEmpresa, admin: ValoresDoAdmin): string | undefined {
  if (!validarEmpresa({ nomeFantasia: empresa.nomeFantasia, razaoSocial: empresa.razaoSocial }).ok) return MOTIVO_SEM_NOME;
  const escolhido =
    admin.modo === "existente"
      ? admin.existente !== null
      : [admin.nome, admin.sobrenome, admin.email, admin.telefone].some((campo) => aparado(campo) !== "");
  return escolhido ? undefined : MOTIVO_SEM_ADMIN;
}

/** O corpo de `POST /empresas`: campos vazios ficam de fora; cada Identificador preenchido vira um item. */
export function montarNovaEmpresa(empresa: ValoresDaEmpresa, admin: ValoresDoAdmin): ResultadoDaMontagem {
  const erros: Record<string, string> = {};

  const nome = validarEmpresa({ nomeFantasia: empresa.nomeFantasia, razaoSocial: empresa.razaoSocial });
  if (!nome.ok) erros.nomeFantasia = nome.error;

  const identificadores: NovoIdentificadorDeEmpresa[] = [];
  const identificador = (campo: "dominio" | "documento" | "telefone", entrada: NovoIdentificadorDeEmpresa) => {
    const validacao = validarIdentificadorDeEmpresa(entrada);
    if (!validacao.ok) erros[campo] = validacao.error;
    else identificadores.push(entrada);
  };
  if (aparado(empresa.dominio) !== "") identificador("dominio", { tipo: "dominio", valor: aparado(empresa.dominio) });
  if (aparado(empresa.documento) !== "") {
    const pais = aparado(empresa.pais).toUpperCase();
    if (!/^[A-Z]{2}$/.test(pais)) erros.pais = "Use o código do país com 2 letras (ex.: BR).";
    else identificador("documento", { tipo: "documento_fiscal", valor: aparado(empresa.documento), pais });
  }
  if (aparado(empresa.telefone) !== "") identificador("telefone", { tipo: "telefone", valor: aparado(empresa.telefone) });

  let adminDaApi: AdminDaNovaEmpresa | null = null;
  const cargo = aparado(admin.cargo);
  if (admin.modo === "existente") {
    if (admin.existente === null) erros.admin = MOTIVO_SEM_ADMIN;
    else adminDaApi = { contatoId: admin.existente.id, ...(cargo !== "" ? { cargo } : {}) };
  } else {
    const novo = montarNovoContato({
      ...VALORES_VAZIOS,
      nome: admin.nome,
      sobrenome: admin.sobrenome,
      email: admin.email,
      telefone: admin.telefone,
    });
    if (!novo.ok) {
      if (novo.erros.nome) erros.novoNome = novo.erros.nome;
      if (novo.erros.email) erros.novoEmail = novo.erros.email;
      if (novo.erros.telefone) erros.novoTelefone = novo.erros.telefone;
    } else {
      adminDaApi = { novoContato: novo.corpo, ...(cargo !== "" ? { cargo } : {}) };
    }
  }

  if (Object.keys(erros).length > 0 || adminDaApi === null) return { ok: false, erros };

  const texto = (chave: "nomeFantasia" | "razaoSocial" | "descricao" | "origem") =>
    aparado(empresa[chave]) !== "" ? { [chave]: aparado(empresa[chave]) } : {};
  const corpoDaEmpresa: NovaEmpresa = {
    ...texto("nomeFantasia"),
    ...texto("razaoSocial"),
    ...texto("descricao"),
    ...texto("origem"),
    ...(empresa.matriz !== null ? { matrizId: empresa.matriz.id } : {}),
    ...(empresa.proprietarioId !== "" ? { proprietarioId: empresa.proprietarioId } : {}),
    ...(identificadores.length > 0 ? { identificadores } : {}),
  };
  return { ok: true, corpo: { empresa: corpoDaEmpresa, admin: adminDaApi } };
}

function CampoDeTexto({
  rotulo,
  valor,
  onChange,
  erro,
  tipo,
}: {
  readonly rotulo: string;
  readonly valor: string;
  readonly onChange: (texto: string) => void;
  readonly erro?: string | undefined;
  readonly tipo?: "email";
}) {
  return (
    <Field label={rotulo} {...(erro ? { error: erro } : {})}>
      {(id) => <TextInput id={id} value={valor} onChange={onChange} invalid={erro !== undefined} {...(tipo ? { type: tipo } : {})} />}
    </Field>
  );
}

/**
 * O bloco "Contato admin" (D-08), obrigatório: `Segmentos` entre um Contato que
 * já existe e um Novo Contato (Nome + e-mail, o resto o Contato completa depois),
 * mais o Cargo. Reaproveitado pelo pedido de admin na restauração da lixeira
 * (só o modo `existente`, `semNovo`).
 */
export function BlocoDoContatoAdmin({
  valores,
  onChange,
  erros = {},
  semNovo = false,
}: {
  readonly valores: ValoresDoAdmin;
  readonly onChange: (proximo: ValoresDoAdmin) => void;
  readonly erros?: ErrosDaEmpresa;
  readonly semNovo?: boolean;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {semNovo ? null : (
        <div className="sm:col-span-2">
          <Segmentos
            rotulo="Como indicar o Contato admin"
            opcoes={[
              { valor: "existente", rotulo: "Contato existente" },
              { valor: "novo", rotulo: "Novo Contato" },
            ]}
            valor={valores.modo}
            aoTrocar={(modo) => onChange({ ...valores, modo })}
          />
        </div>
      )}
      {valores.modo === "existente" ? (
        <div className="sm:col-span-2">
          <Field label="Buscar Contato admin" {...(erros.admin ? { error: erros.admin } : {})}>
            {(id) => (
              <SeletorDeRegistro
                id={id}
                recurso="contatos"
                rotulo="Buscar Contato admin"
                valor={valores.existente}
                onChange={(existente) => onChange({ ...valores, existente })}
              />
            )}
          </Field>
        </div>
      ) : (
        <>
          <CampoDeTexto rotulo="Nome do Contato" valor={valores.nome} onChange={(nome) => onChange({ ...valores, nome })} erro={erros.novoNome} />
          <CampoDeTexto
            rotulo="Sobrenome do Contato"
            valor={valores.sobrenome}
            onChange={(sobrenome) => onChange({ ...valores, sobrenome })}
          />
          <CampoDeTexto
            rotulo="E-mail do Contato"
            valor={valores.email}
            onChange={(email) => onChange({ ...valores, email })}
            erro={erros.novoEmail}
            tipo="email"
          />
          <CampoDeTexto
            rotulo="Telefone do Contato"
            valor={valores.telefone}
            onChange={(telefone) => onChange({ ...valores, telefone })}
            erro={erros.novoTelefone}
          />
        </>
      )}
      <CampoDeTexto rotulo="Cargo" valor={valores.cargo} onChange={(cargo) => onChange({ ...valores, cargo })} />
    </div>
  );
}

/**
 * O diálogo "Nova Empresa" (CTA "Criar Empresa"). Em erro, o diálogo fica
 * aberto com os campos preservados; a recusa da api (409 com bloqueios, 403…)
 * aparece por `MensagemDeRecusa` logo abaixo do cabeçalho.
 */
export function DialogoNovaEmpresa({
  open,
  onClose,
  onCriado,
}: {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly onCriado: (detalhado: EmpresaDetalhada) => void;
}) {
  const [empresa, setEmpresa] = useState<ValoresDaEmpresa>(EMPRESA_VAZIA);
  const [admin, setAdmin] = useState<ValoresDoAdmin>(ADMIN_VAZIO);
  const [erros, setErros] = useState<ErrosDaEmpresa>({});
  const [recusa, setRecusa] = useState<ErroDeApi | null>(null);
  const [enviando, setEnviando] = useState(false);

  const motivo = enviando ? "Gravando a Empresa…" : motivoParaNaoCriar(empresa, admin);

  const limpar = () => {
    setEmpresa(EMPRESA_VAZIA);
    setAdmin(ADMIN_VAZIO);
    setErros({});
    setRecusa(null);
  };

  const cancelar = () => {
    limpar();
    onClose();
  };

  const enviar = async () => {
    const montado = montarNovaEmpresa(empresa, admin);
    if (!montado.ok) {
      setErros(montado.erros);
      return;
    }
    setErros({});
    setRecusa(null);
    setEnviando(true);
    try {
      // D-08: a Empresa e o admin num envio só.
      const detalhado = await criarEmpresa(montado.corpo);
      limpar();
      onCriado(detalhado);
    } catch (falha) {
      // Diálogo aberto, campos preenchidos: a pessoa corrige e tenta de novo.
      setRecusa(comoErroDeApi(falha, "Não foi possível criar a Empresa. Tente de novo."));
    } finally {
      setEnviando(false);
    }
  };

  const campo = (rotulo: string, chave: keyof Pick<ValoresDaEmpresa, "nomeFantasia" | "razaoSocial" | "dominio" | "documento" | "pais" | "telefone" | "origem">, erro?: string) => (
    <CampoDeTexto rotulo={rotulo} valor={empresa[chave]} onChange={(texto) => setEmpresa({ ...empresa, [chave]: texto })} erro={erro} />
  );

  return (
    <ConfirmDialog
      open={open}
      wide
      title="Nova Empresa"
      description="A Empresa nasce com um Contato admin: escolha um existente ou crie um novo aqui mesmo."
      confirmLabel="Criar Empresa"
      {...(motivo ? { confirmDisabledReason: motivo } : {})}
      onConfirm={() => void enviar()}
      onCancel={cancelar}
    >
      <MensagemDeRecusa erro={recusa} onFechar={() => setRecusa(null)} />
      <div className="grid gap-3 sm:grid-cols-2">
        {campo("Nome fantasia", "nomeFantasia", erros.nomeFantasia)}
        {campo("Razão social", "razaoSocial")}
        {campo("Domínio", "dominio", erros.dominio)}
        {campo("Documento fiscal", "documento", erros.documento)}
        {campo("País do documento", "pais", erros.pais)}
        {campo("Telefone", "telefone", erros.telefone)}
        {campo("Origem", "origem")}
        <Field label="Proprietário">
          {(id) => (
            <SeletorDeProprietario id={id} valor={empresa.proprietarioId} onChange={(proprietarioId) => setEmpresa({ ...empresa, proprietarioId })} />
          )}
        </Field>
        <div className="sm:col-span-2">
          <Field label="Empresa matriz">
            {(id) => (
              <SeletorDeRegistro
                id={id}
                recurso="empresas"
                rotulo="Empresa matriz"
                valor={empresa.matriz}
                onChange={(matriz) => setEmpresa({ ...empresa, matriz })}
              />
            )}
          </Field>
        </div>
        <div className="sm:col-span-2">
          <Field label="Descrição">
            {(id) => <TextArea id={id} value={empresa.descricao} onChange={(descricao) => setEmpresa({ ...empresa, descricao })} />}
          </Field>
        </div>
      </div>
      <ReguaDeSecao rotulo="Contato admin" />
      <BlocoDoContatoAdmin valores={admin} onChange={setAdmin} erros={erros} />
    </ConfirmDialog>
  );
}
