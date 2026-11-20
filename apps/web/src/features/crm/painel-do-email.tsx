"use client";

/**
 * O PAINEL DO E-MAIL (Fase 17, 9.2.4) — a conexão da caixa de e-mail pela ficha do Canal, por um de três caminhos:
 *
 *   - "Entrar com o Google" e "Entrar com a Microsoft": a api devolve a URL do login (`autorizarEmail`) e o navegador vai
 *     para lá; a volta cai em `canais/email/retorno`, que conclui. Os dois botões só aparecem quando
 *     `GET /canais/:id/email/conta` diz que o servidor tem o serviço configurado (`servicosDisponiveis`);
 *   - "Outro servidor": usuário e senha (ou senha de app). Para Gmail e Outlook a tela manda SÓ o nome da predefinição
 *     (`gmail` ou `outlook`): quem escolhe host e porta é o servidor (D-17-07). Para qualquer outro domínio, pede host e
 *     porta do IMAP (993 ou 143) e do SMTP (465 ou 587).
 *
 * A senha é o único segredo da tela, e este painel o trata como o do token do WhatsApp (`painel-do-token.tsx`):
 *   - o campo é de senha e sem `name`, com `autoComplete="off"`; nunca vem preenchido e a api nunca o devolve;
 *   - o valor vive só no estado deste componente: não vai a store, a chave de SWR, a `localStorage`, à URL nem a log;
 *   - é apagado depois do envio (com erro ou com sucesso) e quando o painel fecha;
 *   - toda frase de erro é a da api, mostrada como TEXTO (nunca como HTML), e `semASenha` ainda troca a senha por `•••`
 *     se algum dia ela vier repetida.
 *
 * `ContaDoEmailNaFicha` é o outro lado: a ficha diz se a caixa está de pé (endereço e jeito de entrar) ou caiu (o motivo
 * da queda e "Entrar de novo").
 */

import { useState } from "react";
import type { CanalNaFicha } from "@n1/dominio/crm/canais";
import {
  autorizarEmail,
  conectarEmailPorSenha,
  useContaDoEmail,
  type ContaDoEmail,
  type EntradaDoEmailPorSenha,
  type ServicoDeLoginDoEmail,
} from "@/dados/crm/canais";
import { ErroDeApi } from "@/dados/crm/cliente-crm";
import { irParaForaDoApp } from "@/features/crm/ir-para-fora";
import { Button, ConfirmDialog, Field, RecordRow, Select, TextInput } from "@/features/shell/ui";

type Predefinicao = "gmail" | "outlook";

/** O Gmail e o Outlook, como a tela os conhece: o nome da predefinição e o que ela mostra e explica. */
const PREDEFINICOES: Readonly<
  Record<Predefinicao, { readonly rotulo: string; readonly imap: string; readonly smtp: string; readonly ajuda: string }>
> = {
  gmail: {
    rotulo: "Gmail",
    imap: "imap.gmail.com, porta 993",
    smtp: "smtp.gmail.com, porta 465",
    ajuda: "No Gmail, use uma senha de app (Conta do Google › Segurança › Senhas de app; exige a verificação em duas etapas).",
  },
  outlook: {
    rotulo: "Outlook",
    imap: "outlook.office365.com, porta 993",
    smtp: "smtp.office365.com, porta 587",
    ajuda: "No Microsoft 365, o SMTP autenticado pode estar desligado na caixa: se der erro, prefira Entrar com a Microsoft.",
  },
};

const DOMINIOS_DO_GMAIL: ReadonlySet<string> = new Set(["gmail.com", "googlemail.com"]);
const DOMINIOS_DO_OUTLOOK: ReadonlySet<string> = new Set(["outlook.com", "hotmail.com", "live.com", "msn.com"]);

/** A predefinição que o domínio do endereço sugere, ou `undefined` para qualquer outro servidor. */
export function predefinicaoDoEndereco(endereco: string): Predefinicao | undefined {
  const arroba = endereco.lastIndexOf("@");
  if (arroba < 0) return undefined;
  const dominio = endereco.slice(arroba + 1).trim().toLowerCase();
  if (DOMINIOS_DO_GMAIL.has(dominio)) return "gmail";
  if (DOMINIOS_DO_OUTLOOK.has(dominio)) return "outlook";
  return undefined;
}

/** A frase de um erro nunca leva a senha: se ela aparecer no texto, vira `•••`. */
export function semASenha(texto: string, senha: string): string {
  return senha === "" ? texto : texto.split(senha).join("•••");
}

const PORTAS_DO_IMAP = [
  { value: "993", label: "993 (SSL/TLS)" },
  { value: "143", label: "143 (STARTTLS)" },
] as const;

const PORTAS_DO_SMTP = [
  { value: "465", label: "465 (SSL/TLS)" },
  { value: "587", label: "587 (STARTTLS)" },
] as const;

const FRASE_SEM_RESPOSTA = "Não foi possível conectar a caixa agora. Tente de novo.";
const FRASE_DOS_CAMPOS = "Preencha o usuário e a senha.";
const FRASE_DOS_SERVIDORES = "Preencha os servidores IMAP e SMTP.";
const FRASE_DA_ESCOLHA = "Escolha como entrar.";

const NOME_DO_SERVICO: Readonly<Record<ServicoDeLoginDoEmail, string>> = { google: "o Google", microsoft: "a Microsoft" };

interface Erro {
  readonly texto: string;
  readonly campo: string | undefined;
}

export interface PropriedadesDoPainelDoEmail {
  readonly canal: CanalNaFicha;
  /** Cancelar, o X e o fechamento depois de conectar. */
  readonly onFechar: () => void;
  /** Chamado uma vez quando a api confirma a senha, antes de fechar (a ficha re-hidrata o espelho). */
  readonly onConectado?: () => void;
}

export function PainelDoEmail({ canal, onFechar, onConectado }: PropriedadesDoPainelDoEmail) {
  const conta = useContaDoEmail(canal.id);
  const servicos = conta.data?.servicosDisponiveis;
  const sugerida = predefinicaoDoEndereco(canal.identificadorExterno);

  const [etapa, setEtapa] = useState<"escolha" | "senha">("escolha");
  const [usuario, setUsuario] = useState(canal.identificadorExterno);
  const [senha, setSenha] = useState("");
  // Gmail e Outlook usam a predefinição do servidor; "Usar outros servidores" abre os campos manuais.
  const [manual, setManual] = useState(false);
  const [imapHost, setImapHost] = useState("");
  const [imapPorta, setImapPorta] = useState("993");
  const [smtpHost, setSmtpHost] = useState("");
  const [smtpPorta, setSmtpPorta] = useState("465");
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<Erro | null>(null);

  const comPredefinicao = sugerida !== undefined && !manual;
  const camposDoServidor = comPredefinicao || (imapHost.trim() !== "" && smtpHost.trim() !== "");
  const preenchido = usuario.trim() !== "" && senha !== "";
  const motivo = ocupado
    ? "Conectando…"
    : etapa === "escolha"
      ? FRASE_DA_ESCOLHA
      : !preenchido
        ? FRASE_DOS_CAMPOS
        : !camposDoServidor
          ? FRASE_DOS_SERVIDORES
          : undefined;

  /** Apaga o que foi digitado: depois do envio e ao fechar, a senha não fica no estado. */
  const limparASenha = () => setSenha("");

  const fechar = () => {
    limparASenha();
    onFechar();
  };

  const entrarCom = async (servico: ServicoDeLoginDoEmail) => {
    if (ocupado) return;
    setErro(null);
    setOcupado(true);
    try {
      irParaForaDoApp(await autorizarEmail(canal.id, servico));
    } catch (falha) {
      setOcupado(false);
      setErro({
        texto: falha instanceof ErroDeApi ? falha.message : `Não foi possível abrir o login d${NOME_DO_SERVICO[servico]}. Tente de novo.`,
        campo: undefined,
      });
    }
  };

  const enviar = async () => {
    if (ocupado || etapa !== "senha" || !preenchido || !camposDoServidor) return;
    const digitada = senha;
    const entrada: EntradaDoEmailPorSenha =
      comPredefinicao && sugerida !== undefined
        ? { usuario: usuario.trim(), senha: digitada, predefinicao: sugerida }
        : {
            usuario: usuario.trim(),
            senha: digitada,
            imap: { host: imapHost.trim(), porta: Number(imapPorta) },
            smtp: { host: smtpHost.trim(), porta: Number(smtpPorta) },
          };
    setErro(null);
    setOcupado(true);
    try {
      await conectarEmailPorSenha(canal.id, entrada);
      limparASenha();
      onConectado?.();
      onFechar();
    } catch (falha) {
      limparASenha();
      setOcupado(false);
      if (falha instanceof ErroDeApi) setErro({ texto: semASenha(falha.message, digitada), campo: falha.campo });
      else setErro({ texto: FRASE_SEM_RESPOSTA, campo: undefined });
    }
  };

  // A recusa de um campo que o painel mostra vai junto dele; a sem campo (ou de um bloco escondido) vai no topo.
  const noImap = !comPredefinicao && erro?.campo === "imap" ? erro.texto : undefined;
  const noSmtp = !comPredefinicao && erro?.campo === "smtp" ? erro.texto : undefined;
  const noTopo = erro !== null && noImap !== erro.texto && noSmtp !== erro.texto ? erro.texto : undefined;

  return (
    <ConfirmDialog
      open
      wide
      title="Conectar a caixa de e-mail"
      description={`Escolha como entrar na caixa ${canal.identificadorExterno}.`}
      confirmLabel="Conectar"
      cancelLabel="Cancelar"
      confirmCarregando={ocupado}
      {...(motivo !== undefined ? { confirmDisabledReason: motivo } : {})}
      onConfirm={() => void enviar()}
      onCancel={fechar}
    >
      <div className="grid gap-4">
        {noTopo !== undefined ? (
          <p role="alert" className="app-base" style={{ color: "var(--erro)" }}>
            {noTopo}
          </p>
        ) : null}

        {etapa === "escolha" ? (
          <div className="grid gap-2">
            {servicos?.google ? (
              <Button variant="primary" onClick={() => void entrarCom("google")} disabled={ocupado} disabledReason="Abrindo o login…">
                Entrar com o Google
              </Button>
            ) : null}
            {servicos?.microsoft ? (
              <Button variant="primary" onClick={() => void entrarCom("microsoft")} disabled={ocupado} disabledReason="Abrindo o login…">
                Entrar com a Microsoft
              </Button>
            ) : null}
            <Button
              {...(servicos?.google || servicos?.microsoft ? {} : { variant: "primary" as const })}
              onClick={() => {
                setErro(null);
                setEtapa("senha");
              }}
              disabled={ocupado}
              disabledReason="Abrindo o login…"
            >
              Outro servidor
            </Button>
            <p className="app-meta">
              Outro servidor serve para qualquer caixa que tenha IMAP e SMTP: você entra com o usuário e a senha (ou a senha de
              app) da caixa. A senha fica cifrada no servidor e não aparece de novo.
            </p>
          </div>
        ) : (
          // Sem `name` e com `autoComplete="off"`: nada aqui é para o navegador lembrar.
          <form
            autoComplete="off"
            className="grid gap-4"
            onSubmit={(evento) => {
              evento.preventDefault();
              void enviar();
            }}
          >
            <p className="app-md" style={{ color: "var(--texto)" }}>
              Outro servidor
            </p>

            <Field label="Usuário" required>
              {(id) => <TextInput id={id} value={usuario} onChange={setUsuario} autoComplete="off" required />}
            </Field>

            <Field
              label="Senha ou senha de app"
              required
              hint="A senha vai só ao servidor, cifrada, e não aparece de novo."
            >
              {(id) => <TextInput id={id} type="password" autoComplete="off" value={senha} onChange={setSenha} required />}
            </Field>

            {comPredefinicao && sugerida !== undefined ? (
              <div className="grid gap-1">
                <p className="app-base" style={{ color: "var(--texto)" }}>
                  {PREDEFINICOES[sugerida].rotulo}
                </p>
                <p className="app-meta">Entrada (IMAP): {PREDEFINICOES[sugerida].imap}</p>
                <p className="app-meta">Saída (SMTP): {PREDEFINICOES[sugerida].smtp}</p>
                <p className="app-meta">{PREDEFINICOES[sugerida].ajuda}</p>
                <span>
                  <Button size="sm" onClick={() => setManual(true)} disabled={ocupado} disabledReason="Conectando…">
                    Usar outros servidores
                  </Button>
                </span>
              </div>
            ) : (
              <>
                <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_12rem]">
                  <Field label="Servidor IMAP" required hint="Onde a caixa recebe os e-mails." {...(noImap !== undefined ? { error: noImap } : {})}>
                    {(id) => <TextInput id={id} value={imapHost} onChange={setImapHost} placeholder="imap.empresa.com.br" invalid={noImap !== undefined} required />}
                  </Field>
                  <Field label="Porta do IMAP" required>
                    {(id) => <Select id={id} value={imapPorta} onChange={setImapPorta} options={PORTAS_DO_IMAP} required />}
                  </Field>
                </div>
                <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_12rem]">
                  <Field label="Servidor SMTP" required hint="Por onde a caixa envia os e-mails." {...(noSmtp !== undefined ? { error: noSmtp } : {})}>
                    {(id) => <TextInput id={id} value={smtpHost} onChange={setSmtpHost} placeholder="smtp.empresa.com.br" invalid={noSmtp !== undefined} required />}
                  </Field>
                  <Field label="Porta do SMTP" required>
                    {(id) => <Select id={id} value={smtpPorta} onChange={setSmtpPorta} options={PORTAS_DO_SMTP} required />}
                  </Field>
                </div>
                {sugerida !== undefined ? (
                  <span>
                    <Button size="sm" onClick={() => setManual(false)} disabled={ocupado} disabledReason="Conectando…">
                      Usar o servidor do {PREDEFINICOES[sugerida].rotulo}
                    </Button>
                  </span>
                ) : null}
              </>
            )}

            {/* O Enter num campo envia: sem um botão de envio no formulário, vários campos de texto não o fazem. */}
            <button type="submit" hidden tabIndex={-1} aria-hidden="true" />
          </form>
        )}
      </div>
    </ConfirmDialog>
  );
}

const JEITO_DE_ENTRAR: Readonly<Record<ContaDoEmail["tipoDeLogin"], string>> = {
  senha: "senha",
  google: "Google",
  microsoft: "Microsoft",
};

export interface PropriedadesDaContaDoEmailNaFicha {
  readonly canal: CanalNaFicha;
  /** Sem ele (quem não pode conectar o Canal) o botão "Entrar de novo" não aparece. */
  readonly onEntrarDeNovo?: () => void;
}

/**
 * As linhas da ficha para a conta do e-mail (vão dentro do `<dl>` da Configuração): "Conectada" com o endereço e o jeito de
 * entrar, ou "Desconectada" com o motivo da queda e "Entrar de novo". Sem conta (Canal que nunca conectou ou que foi
 * desconectado de propósito) não mostra nada: a ficha só oferece "Conectar". Nada aqui é campo: usuário e senha nunca voltam.
 */
export function ContaDoEmailNaFicha({ canal, onEntrarDeNovo }: PropriedadesDaContaDoEmailNaFicha) {
  const resposta = useContaDoEmail(canal.id);
  const conta = resposta.data?.conta ?? null;
  if (conta === null) return null;

  if (canal.conexao === "conectada") {
    return (
      <>
        <RecordRow label="Caixa de e-mail">
          <span>
            Conectada: <span className="identificador">{conta.endereco}</span> ({JEITO_DE_ENTRAR[conta.tipoDeLogin]})
          </span>
        </RecordRow>
        <RecordRow label="Servidor IMAP">
          <span className="identificador">
            {conta.imap.host}:{conta.imap.porta}
          </span>
        </RecordRow>
        <RecordRow label="Servidor SMTP">
          <span className="identificador">
            {conta.smtp.host}:{conta.smtp.porta}
          </span>
        </RecordRow>
      </>
    );
  }

  return (
    <RecordRow label="Caixa de e-mail">
      <span className="grid gap-1">
        <span style={{ color: "var(--aviso)" }}>Desconectada</span>
        {conta.motivoDaQueda !== null ? <span className="app-meta">{conta.motivoDaQueda}</span> : null}
        {onEntrarDeNovo !== undefined ? (
          <span>
            <Button size="sm" variant="primary" onClick={onEntrarDeNovo}>
              Entrar de novo
            </Button>
          </span>
        ) : null}
      </span>
    </RecordRow>
  );
}
