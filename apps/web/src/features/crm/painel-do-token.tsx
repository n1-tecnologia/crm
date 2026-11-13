"use client";

/**
 * O PAINEL DO TOKEN (Sessão 7, 7.2.5) — a conexão do WhatsApp oficial (Cloud API) pela ficha do Canal: a pessoa cola o
 * ID do número, o ID da conta do WhatsApp Business e o token do usuário do sistema da Meta, e a api (`conectarWhatsAppOficial`,
 * `POST /canais/:id/whatsapp-oficial/conectar`) confere o número na Meta, guarda o token cifrado e conecta o Canal.
 *
 * O token é o único segredo da tela, e este painel o trata assim:
 *   - o campo é de senha e sem `name`: o navegador não oferece guardá-lo nem sugerir um valor (`autoComplete="off"`);
 *   - o valor vive só no estado deste componente: não vai a store, a chave de SWR, a `localStorage`, a URL nem a log;
 *   - é apagado do estado quando a conexão dá certo e quando o painel fecha;
 *   - nenhuma frase de erro o repete: a da api já vem sem ele, e `semOToken` ainda o troca por `•••` se algum dia vier.
 *
 * Os valores colados são aparados (espaço e quebra de linha de quem copiou do painel da Meta) antes de ir à api, que recusa
 * token com espaço no meio. A recusa mostra a frase da api junto do campo que ela aponta (`token` ou `phoneNumberId`); uma
 * recusa sem campo (a Meta fora do ar, o servidor sem a integração) vai no topo. Nada é gravado até a api confirmar.
 */

import { useState } from "react";
import type { CanalNaFicha } from "@n1/dominio/crm/canais";
import { conectarWhatsAppOficial } from "@/dados/crm/canais";
import { ErroDeApi } from "@/dados/crm/cliente-crm";
import { ORIENTACAO_DO_PROVEDOR } from "@/features/crm/conectar-canal";
import { finalDoNumero } from "@/features/crm/painel-do-qrcode";
import { ConfirmDialog, Field, TextInput } from "@/features/shell/ui";

const FRASE_SEM_RESPOSTA = "Não foi possível conectar o WhatsApp agora. Tente de novo.";
const FRASE_DOS_CAMPOS = "Preencha o ID do número, o ID da conta do WhatsApp Business e o token.";

/** A frase de um erro nunca leva o token: se ele aparecer no texto, vira `•••`. */
export function semOToken(texto: string, token: string): string {
  return token === "" ? texto : texto.split(token).join("•••");
}

interface Erro {
  readonly texto: string;
  readonly campo: string | undefined;
}

export interface PropriedadesDoPainelDoToken {
  readonly canal: CanalNaFicha;
  /** Cancelar, o X e o fechamento depois de conectar. */
  readonly onFechar: () => void;
  /** Chamado uma vez quando a api confirma, antes de fechar (a ficha re-hidrata o espelho). */
  readonly onConectado?: () => void;
}

export function PainelDoTokenDoWhatsApp({ canal, onFechar, onConectado }: PropriedadesDoPainelDoToken) {
  const [numero, setNumero] = useState("");
  const [conta, setConta] = useState("");
  const [token, setToken] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<Erro | null>(null);

  const preenchido = numero.trim() !== "" && conta.trim() !== "" && token.trim() !== "";
  const motivo = ocupado ? "Conectando…" : !preenchido ? FRASE_DOS_CAMPOS : undefined;

  /** Apaga o que foi colado: depois do sucesso e ao fechar, o token não fica no estado. */
  const limpar = () => {
    setNumero("");
    setConta("");
    setToken("");
  };

  const fechar = () => {
    limpar();
    onFechar();
  };

  const enviar = async () => {
    if (ocupado || !preenchido) return;
    const colado = { phoneNumberId: numero.trim(), wabaId: conta.trim(), token: token.trim() };
    setErro(null);
    setOcupado(true);
    try {
      await conectarWhatsAppOficial(canal.id, colado);
      limpar();
      onConectado?.();
      onFechar();
    } catch (falha) {
      setOcupado(false);
      if (falha instanceof ErroDeApi) setErro({ texto: semOToken(falha.message, colado.token), campo: falha.campo });
      else setErro({ texto: FRASE_SEM_RESPOSTA, campo: undefined });
    }
  };

  const passos = ORIENTACAO_DO_PROVEDOR["whatsapp-cloud"].passos;
  // A recusa sem campo (ou de um campo que o painel não tem) vai no topo; a do campo, ao lado dele.
  const noCampo = (campo: string) => (erro?.campo === campo ? erro.texto : undefined);
  const noTopo = erro !== null && erro.campo !== "token" && erro.campo !== "phoneNumberId" ? erro.texto : undefined;

  return (
    <ConfirmDialog
      open
      wide
      title="Conectar o WhatsApp oficial"
      description={`Cole os dados do número deste Canal (final ${finalDoNumero(canal.identificadorExterno)}), como a Meta mostra.`}
      confirmLabel="Conectar"
      cancelLabel="Cancelar"
      confirmCarregando={ocupado}
      {...(motivo !== undefined ? { confirmDisabledReason: motivo } : {})}
      onConfirm={() => void enviar()}
      onCancel={fechar}
    >
      {/* Sem `name` e com `autoComplete="off"`: nada aqui é para o navegador lembrar. */}
      <form
        autoComplete="off"
        className="grid gap-4"
        onSubmit={(evento) => {
          evento.preventDefault();
          void enviar();
        }}
      >
        {noTopo !== undefined ? (
          <p role="alert" className="app-base" style={{ color: "var(--erro)" }}>
            {noTopo}
          </p>
        ) : null}

        <ol className="app-base list-decimal space-y-1 pl-5" style={{ color: "var(--texto-2)" }}>
          {passos.map((passo) => (
            <li key={passo}>{passo}</li>
          ))}
        </ol>

        <Field
          label="ID do número de telefone"
          required
          hint="No painel do app, em developers.facebook.com › WhatsApp › Configuração da API: “ID do número de telefone”. Só dígitos."
          {...(noCampo("phoneNumberId") !== undefined ? { error: noCampo("phoneNumberId")! } : {})}
        >
          {(id) => <TextInput id={id} value={numero} onChange={setNumero} invalid={noCampo("phoneNumberId") !== undefined} required />}
        </Field>

        <Field
          label="ID da conta do WhatsApp Business"
          required
          hint="No mesmo lugar: “ID da conta do WhatsApp Business”. Só dígitos."
          {...(noCampo("wabaId") !== undefined ? { error: noCampo("wabaId")! } : {})}
        >
          {(id) => <TextInput id={id} value={conta} onChange={setConta} invalid={noCampo("wabaId") !== undefined} required />}
        </Field>

        <Field
          label="Token de acesso"
          required
          hint="O token permanente do usuário do sistema (Meta Business › Configurações do negócio › Usuários do sistema), com as permissões whatsapp_business_messaging e whatsapp_business_management. Fica cifrado no servidor e não aparece de novo."
          {...(noCampo("token") !== undefined ? { error: noCampo("token")! } : {})}
        >
          {(id) => <TextInput id={id} type="password" autoComplete="off" value={token} onChange={setToken} invalid={noCampo("token") !== undefined} required />}
        </Field>

        {/* O Enter num campo envia: sem um botão de envio no formulário, vários campos de texto não o fazem. */}
        <button type="submit" hidden tabIndex={-1} aria-hidden="true" />
      </form>
    </ConfirmDialog>
  );
}
