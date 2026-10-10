"use client";

/**
 * O formulário de Contato (D-04, D-11): o diálogo de criação completo e o
 * corpo reutilizável que a ficha usa para editar.
 *
 * `FormularioDeContato` é o CORPO — campos controlados, sem botão de envio. A
 * criação (`DialogoNovoContato`) e a edição (na ficha) o embrulham num
 * `ConfirmDialog` cada uma; a edição liga `comIdentificadores={false}` porque
 * Identificador tem sub-recurso próprio na ficha.
 *
 * A pré-validação é a do domínio (`validarContato`,
 * `validarIdentificadorDeContato`), a mesma que o endpoint aplica: o erro cai
 * no `Field` do campo antes de qualquer ida ao servidor. O que vai para a api
 * é o que a pessoa digitou — quem normaliza (e-mail em minúsculas, telefone
 * com +55…) é o servidor, a autoridade (RN-CON-11 depende do valor canônico).
 */

import { useState } from "react";
import {
  validarContato,
  validarIdentificadorDeContato,
  type ContatoDetalhado,
  type EdicaoDeContato,
  type NovoContato,
  type NovoIdentificadorDeContato,
  type TipoIdentificadorContato,
} from "@n1/dominio/crm/contatos";
import { ErroDeApi } from "@/dados/crm/cliente-crm";
import { criarContato } from "@/dados/crm/contatos";
import { MensagemDeRecusa } from "@/features/crm/ciclo-de-vida";
import { SeletorDeProprietario } from "@/features/crm/seletor-de-proprietario";
import { ConfirmDialog, Field, TextArea, TextInput } from "@/features/shell/ui";

export interface ValoresDoContato {
  readonly nome: string;
  readonly sobrenome: string;
  readonly email: string;
  readonly telefone: string;
  readonly whatsapp: string;
  readonly instagram: string;
  /** `AAAA-MM-DD`, o valor de `input type="date"`. */
  readonly dataNascimento: string;
  readonly idioma: string;
  readonly fusoHorario: string;
  readonly descricao: string;
  readonly origem: string;
  readonly qualificacao: string;
  /** O id do Membro, ou `""` = quem cria (D-11). */
  readonly proprietarioId: string;
}

export const VALORES_VAZIOS: ValoresDoContato = {
  nome: "",
  sobrenome: "",
  email: "",
  telefone: "",
  whatsapp: "",
  instagram: "",
  dataNascimento: "",
  idioma: "",
  fusoHorario: "",
  descricao: "",
  origem: "",
  qualificacao: "",
  proprietarioId: "",
};

export type ErrosDoContato = Partial<Record<keyof ValoresDoContato, string>>;

const IDENTIFICADORES: ReadonlyArray<{ readonly campo: "email" | "telefone" | "whatsapp" | "instagram"; readonly tipo: TipoIdentificadorContato }> = [
  { campo: "email", tipo: "email" },
  { campo: "telefone", tipo: "telefone" },
  { campo: "whatsapp", tipo: "whatsapp" },
  { campo: "instagram", tipo: "instagram" },
];

export type ResultadoDoFormulario<T> =
  | { readonly ok: true; readonly corpo: T }
  | { readonly ok: false; readonly erros: ErrosDoContato };

const aparado = (texto: string): string => texto.trim();

/** O corpo de `POST /contatos`: campos vazios ficam de fora; cada Identificador preenchido vira um item. */
export function montarNovoContato(valores: ValoresDoContato): ResultadoDoFormulario<NovoContato> {
  const erros: Record<string, string> = {};
  const identificadores: NovoIdentificadorDeContato[] = [];
  for (const { campo, tipo } of IDENTIFICADORES) {
    const digitado = aparado(valores[campo]);
    if (digitado === "") continue;
    const validacao = validarIdentificadorDeContato({ tipo, valor: digitado });
    if (!validacao.ok) erros[campo] = validacao.error;
    else identificadores.push({ tipo, valor: digitado });
  }
  if (Object.keys(erros).length > 0) return { ok: false, erros };

  // A mesma regra do endpoint (INV-CON-01), sem ida ao servidor.
  const contato = validarContato({ nome: valores.nome, identificadores });
  if (!contato.ok) return { ok: false, erros: { nome: contato.error } };

  const texto = (chave: keyof ValoresDoContato) => (aparado(valores[chave]) !== "" ? { [chave]: aparado(valores[chave]) } : {});
  const corpo: NovoContato = {
    ...texto("nome"),
    ...texto("sobrenome"),
    ...texto("dataNascimento"),
    ...texto("idioma"),
    ...texto("fusoHorario"),
    ...texto("descricao"),
    ...texto("origem"),
    ...texto("qualificacao"),
    ...(valores.proprietarioId !== "" ? { proprietarioId: valores.proprietarioId } : {}),
    ...(identificadores.length > 0 ? { identificadores } : {}),
  };
  return { ok: true, corpo };
}

/**
 * O corpo de `PATCH /contatos/:id`: todos os campos de dados, e texto vazio
 * LIMPA a coluna (contrato do 07-03). `identificadoresExistentes` entra na
 * regra de INV-CON-01: tirar o Nome de quem não tem Identificador é recusado.
 */
export function montarEdicaoDeContato(
  valores: ValoresDoContato,
  identificadoresExistentes: number,
): ResultadoDoFormulario<EdicaoDeContato> {
  const contato = validarContato({ nome: valores.nome, identificadores: Array.from({ length: identificadoresExistentes }) });
  if (!contato.ok) return { ok: false, erros: { nome: contato.error } };
  return {
    ok: true,
    corpo: {
      nome: aparado(valores.nome),
      sobrenome: aparado(valores.sobrenome),
      dataNascimento: aparado(valores.dataNascimento),
      idioma: aparado(valores.idioma),
      fusoHorario: aparado(valores.fusoHorario),
      descricao: aparado(valores.descricao),
      origem: aparado(valores.origem),
      qualificacao: aparado(valores.qualificacao),
      ...(valores.proprietarioId !== "" ? { proprietarioId: valores.proprietarioId } : {}),
    },
  };
}

function CampoDeTexto({
  rotulo,
  campo,
  valores,
  erros,
  onChange,
  tipo,
}: {
  readonly rotulo: string;
  readonly campo: keyof ValoresDoContato;
  readonly valores: ValoresDoContato;
  readonly erros: ErrosDoContato;
  readonly onChange: (proximo: ValoresDoContato) => void;
  readonly tipo?: "email";
}) {
  const erro = erros[campo];
  return (
    <Field label={rotulo} {...(erro ? { error: erro } : {})}>
      {(id) => (
        <TextInput
          id={id}
          value={valores[campo]}
          onChange={(texto) => onChange({ ...valores, [campo]: texto })}
          invalid={erro !== undefined}
          {...(tipo ? { type: tipo } : {})}
        />
      )}
    </Field>
  );
}

/** O corpo do formulário: campos na ordem do contrato (UI-SPEC §2), duas colunas a partir de `sm`. */
export function FormularioDeContato({
  valores,
  onChange,
  erros = {},
  comIdentificadores,
}: {
  readonly valores: ValoresDoContato;
  readonly onChange: (proximo: ValoresDoContato) => void;
  readonly erros?: ErrosDoContato;
  /** Na criação os Identificadores nascem junto; na edição eles têm seção própria. */
  readonly comIdentificadores: boolean;
}) {
  const campo = (rotulo: string, chave: keyof ValoresDoContato, tipo?: "email") => (
    <CampoDeTexto rotulo={rotulo} campo={chave} valores={valores} erros={erros} onChange={onChange} {...(tipo ? { tipo } : {})} />
  );
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {campo("Nome", "nome")}
      {campo("Sobrenome", "sobrenome")}
      {comIdentificadores ? (
        <>
          {campo("E-mail", "email", "email")}
          {campo("Telefone", "telefone")}
          {campo("WhatsApp", "whatsapp")}
          {campo("Instagram", "instagram")}
        </>
      ) : null}
      <Field label="Data de nascimento" {...(erros.dataNascimento ? { error: erros.dataNascimento } : {})}>
        {(id) => (
          <input
            id={id}
            type="date"
            value={valores.dataNascimento}
            onChange={(evento) => onChange({ ...valores, dataNascimento: evento.target.value })}
            className="campo alvo-toque"
          />
        )}
      </Field>
      {campo("Idioma", "idioma")}
      {campo("Fuso horário", "fusoHorario")}
      {campo("Origem", "origem")}
      {campo("Qualificação", "qualificacao")}
      <Field label="Proprietário">
        {(id) => (
          <SeletorDeProprietario
            id={id}
            valor={valores.proprietarioId}
            onChange={(proprietarioId) => onChange({ ...valores, proprietarioId })}
            rotuloVazio={comIdentificadores ? undefined : null}
          />
        )}
      </Field>
      <div className="sm:col-span-2">
        <Field label="Descrição">
          {(id) => <TextArea id={id} value={valores.descricao} onChange={(descricao) => onChange({ ...valores, descricao })} />}
        </Field>
      </div>
    </div>
  );
}

/** Uma falha qualquer vira `ErroDeApi` para a `MensagemDeRecusa` mostrar a frase certa. */
export function comoErroDeApi(falha: unknown, padrao: string): ErroDeApi {
  return falha instanceof ErroDeApi ? falha : new ErroDeApi(0, padrao);
}

/**
 * O diálogo "Novo Contato" (CTA "Criar Contato"). Em erro, o diálogo fica
 * aberto com os campos preservados; a recusa da api (409 com bloqueios, 403…)
 * aparece por `MensagemDeRecusa` logo abaixo do cabeçalho.
 */
export function DialogoNovoContato({
  open,
  onClose,
  onCriado,
}: {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly onCriado: (detalhado: ContatoDetalhado) => void;
}) {
  const [valores, setValores] = useState<ValoresDoContato>(VALORES_VAZIOS);
  const [erros, setErros] = useState<ErrosDoContato>({});
  const [recusa, setRecusa] = useState<ErroDeApi | null>(null);
  const [enviando, setEnviando] = useState(false);

  const limpar = () => {
    setValores(VALORES_VAZIOS);
    setErros({});
    setRecusa(null);
  };

  const cancelar = () => {
    limpar();
    onClose();
  };

  const enviar = async () => {
    const montado = montarNovoContato(valores);
    if (!montado.ok) {
      setErros(montado.erros);
      return;
    }
    setErros({});
    setRecusa(null);
    setEnviando(true);
    try {
      const detalhado = await criarContato(montado.corpo);
      limpar();
      onCriado(detalhado);
    } catch (falha) {
      // Diálogo aberto, campos preenchidos: a pessoa corrige e tenta de novo.
      setRecusa(comoErroDeApi(falha, "Não foi possível criar o Contato. Tente de novo."));
    } finally {
      setEnviando(false);
    }
  };

  return (
    <ConfirmDialog
      open={open}
      wide
      title="Novo Contato"
      description="Nome ou Identificador — um dos dois basta, e sem nenhum dos dois o Contato não é ninguém."
      confirmLabel="Criar Contato"
      {...(enviando ? { confirmDisabledReason: "Gravando o Contato…" } : {})}
      onConfirm={() => void enviar()}
      onCancel={cancelar}
    >
      <MensagemDeRecusa erro={recusa} onFechar={() => setRecusa(null)} />
      <FormularioDeContato valores={valores} onChange={setValores} erros={erros} comIdentificadores />
    </ConfirmDialog>
  );
}
