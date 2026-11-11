"use client";

/**
 * O PAINEL DO QR CODE (Sessão 4, 4.2.4) — a conexão do WhatsApp não oficial pela ficha do Canal.
 *
 * Enquanto está montado, o painel:
 *   - pede o QR code à api (`conectarCanal`, `POST /canais/:id/conectar`) ao abrir, e de novo a cada
 *     `RENOVAR_O_QR_A_CADA_MS`: o QR vale poucos segundos, e quem o gera é a Evolution. Se a api responde
 *     `aguardando` (a Evolution ainda não gerou), repete em `REPETIR_SE_AGUARDANDO_EM_MS`;
 *   - relê o Canal (`useCanal`, `GET /canais/:id`) a cada `RELER_O_CANAL_A_CADA_MS`: é por aí que a tela percebe o
 *     provedor confirmar. A rota nunca diz "conectada" por QR lido; o Canal muda no banco quando a Evolution avisa a
 *     api por webhook. Conectado de verdade, mostra "Conectado" e fecha sozinho (`FECHAR_DEPOIS_DE_CONECTAR_EM_MS`);
 *   - mostra a falha sem inventar motivo: se o Canal passa a `com_erro` DEPOIS de o QR ser pedido (a api sai da sessão
 *     quando o QR é lido por outro número), a frase manda conferir o aparelho, com o final do número do Canal.
 *
 * Quem monta o painel só o faz enquanto está aberto: fechar desmonta, e o cleanup do efeito para todos os temporizadores
 * e ignora qualquer resposta que chegue depois. O QR é um `data:image/png` que a api conferiu; nada dele vai a log. O
 * fundo claro do QR (`--papel-do-qrcode`) é de propósito: a câmera do celular não lê QR claro sobre fundo escuro.
 */

import { useEffect, useRef, useState } from "react";
import type { CanalNaFicha, QrCodeDoCanal } from "@n1/dominio/crm/canais";
import { conectarCanal, useCanal } from "@/dados/crm/canais";
import { ErroDeApi } from "@/dados/crm/cliente-crm";
import { ORIENTACAO_DO_PROVEDOR } from "@/features/crm/conectar-canal";
import { ConfirmDialog } from "@/features/shell/ui";

export const RENOVAR_O_QR_A_CADA_MS = 25_000;
export const REPETIR_SE_AGUARDANDO_EM_MS = 2_000;
export const RELER_O_CANAL_A_CADA_MS = 3_000;
export const FECHAR_DEPOIS_DE_CONECTAR_EM_MS = 1_500;

/** Só os 4 últimos dígitos: o painel diz qual celular ler sem repetir o número inteiro na tela. */
export function finalDoNumero(identificador: string): string {
  return identificador.replace(/\D/g, "").slice(-4);
}

const FRASE_SEM_RESPOSTA = "Não foi possível pedir o QR code. Tente de novo.";
const FRASE_DE_IMAGEM_INESPERADA = "O QR code veio num formato inesperado. Gere outro.";

export interface PropriedadesDoPainelDoQrCode {
  readonly canal: CanalNaFicha;
  /** Cancelar, o X e o fechamento automático depois de conectar. */
  readonly onFechar: () => void;
  /** Chamado uma vez quando o Canal confirma, antes de fechar (a ficha re-hidrata o espelho). */
  readonly onConectado?: () => void;
}

export function PainelDoQrCode({ canal, onFechar, onConectado }: PropriedadesDoPainelDoQrCode) {
  // Lê o mesmo Canal da ficha (a mesma chave de SWR) com o intervalo de leitura só enquanto o painel existe.
  const lido = useCanal(canal.id, { atualizarACadaMs: RELER_O_CANAL_A_CADA_MS });
  const atual = lido.data ?? canal;
  // O Canal pode já estar `com_erro` ao abrir (o botão serve de "Reconectar"): só uma MUDANÇA para `com_erro` é falha nova.
  const [conexaoAoAbrir] = useState(canal.conexao);

  const [qrcode, setQrcode] = useState<QrCodeDoCanal | null>(null);
  const [aguardando, setAguardando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [conectadoPelaApi, setConectadoPelaApi] = useState(false);
  const pedirRef = useRef<(() => Promise<void>) | null>(null);
  const pararRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    let ativo = true;
    let emVoo = false;
    let repetir: ReturnType<typeof setTimeout> | undefined;
    let renovar: ReturnType<typeof setInterval> | undefined;

    const parar = () => {
      if (repetir !== undefined) clearTimeout(repetir);
      if (renovar !== undefined) clearInterval(renovar);
      repetir = undefined;
      renovar = undefined;
    };

    /** (Re)arma a renovação a partir de agora: um QR recém-pedido vale por mais um intervalo inteiro. */
    const armar = () => {
      if (renovar !== undefined) clearInterval(renovar);
      renovar = setInterval(() => void pedir(), RENOVAR_O_QR_A_CADA_MS);
    };

    const pedir = async (): Promise<void> => {
      if (!ativo || emVoo) return;
      emVoo = true;
      setOcupado(true);
      try {
        const resposta = await conectarCanal(canal.id);
        if (!ativo) return;
        setErro(null);
        if (resposta.situacao === "qrcode") {
          setQrcode(resposta.qrcode);
          setAguardando(false);
          armar();
        } else if (resposta.situacao === "aguardando") {
          setAguardando(true);
          armar();
          repetir = setTimeout(() => void pedir(), REPETIR_SE_AGUARDANDO_EM_MS);
        } else {
          // O aparelho já estava ligado e o número conferiu: nada mais a ler.
          setConectadoPelaApi(true);
          parar();
        }
      } catch (falha) {
        if (!ativo) return;
        // 403, 409, 503 e 502 não melhoram sozinhos a cada 25 s: para e deixa "Tentar de novo" na mão da pessoa.
        parar();
        setErro(falha instanceof ErroDeApi ? falha.message : FRASE_SEM_RESPOSTA);
      } finally {
        emVoo = false;
        if (ativo) setOcupado(false);
      }
    };

    pedirRef.current = pedir;
    pararRef.current = parar;
    void pedir();
    return () => {
      ativo = false;
      pedirRef.current = null;
      pararRef.current = null;
      parar();
    };
    // O painel é montado por Canal e só enquanto aberto: `canal.id` não muda durante a vida dele.
  }, [canal.id]);

  const conectadoDeVerdade = atual.conexao === "conectada" && !atual.conexaoSimulada;
  const conectado = conectadoDeVerdade || conectadoPelaApi;

  // Fecha sozinho depois de mostrar "Conectado". Os callbacks entram por ref: a ficha rende a cada leitura do Canal, e a
  // identidade deles não pode reiniciar o relógio de fechamento.
  const aoTerminar = useRef({ onFechar, onConectado });
  useEffect(() => {
    aoTerminar.current = { onFechar, onConectado };
  });
  useEffect(() => {
    if (!conectado) return;
    // Conectado: nenhum QR novo a pedir enquanto o painel mostra "Conectado" e se despede.
    pararRef.current?.();
    const relogio = setTimeout(() => {
      aoTerminar.current.onConectado?.();
      aoTerminar.current.onFechar();
    }, FECHAR_DEPOIS_DE_CONECTAR_EM_MS);
    return () => clearTimeout(relogio);
  }, [conectado]);

  const final = finalDoNumero(canal.identificadorExterno);
  const falhou = qrcode !== null && atual.conexao === "com_erro" && conexaoAoAbrir !== "com_erro";
  const passos = ORIENTACAO_DO_PROVEDOR["whatsapp-nao-oficial"].passos;
  const imagemConfiavel = qrcode !== null && qrcode.imagem.startsWith("data:image/");

  return (
    <ConfirmDialog
      open
      wide
      title="Conectar o WhatsApp"
      description={`Leia o QR code com o WhatsApp do número deste Canal (final ${final}).`}
      confirmLabel={conectado ? "Fechar" : erro !== null ? "Tentar de novo" : "Gerar outro QR code"}
      cancelLabel="Cancelar"
      confirmCarregando={ocupado && !conectado}
      {...(ocupado && !conectado ? { confirmDisabledReason: "Gerando o QR code…" } : {})}
      onConfirm={() => {
        if (conectado) onFechar();
        else void pedirRef.current?.();
      }}
      onCancel={onFechar}
    >
      <div className="grid gap-4">
        {conectado ? (
          <p role="status" className="app-md" style={{ color: "var(--sucesso)" }}>
            Conectado
          </p>
        ) : (
          <>
            {erro !== null ? (
              <p role="alert" className="app-base" style={{ color: "var(--erro)" }}>
                {erro}
              </p>
            ) : null}

            {falhou ? (
              <p role="alert" className="app-base" style={{ color: "var(--erro)" }}>
                A conexão não foi concluída. Confira se leu o QR code com o celular do número deste Canal (final {final}) e tente de novo.
              </p>
            ) : null}

            {erro === null ? (
              <div
                className="mx-auto grid size-72 place-items-center rounded-[var(--raio-superficie)] p-3"
                style={{ background: "var(--papel-do-qrcode)" }}
              >
                {qrcode !== null && imagemConfiavel ? (
                  // O QR é um `data:` gerado na hora: não há o que otimizar nem endereço a guardar.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={qrcode.imagem} alt="QR code para conectar o WhatsApp deste Canal" width={256} height={256} className="size-full" />
                ) : (
                  <p role="status" className="app-base text-center" style={{ color: "var(--cinza-900)" }}>
                    {qrcode !== null ? FRASE_DE_IMAGEM_INESPERADA : aguardando ? "A Evolution está preparando o QR code…" : "Gerando o QR code…"}
                  </p>
                )}
              </div>
            ) : null}

            {qrcode?.codigoDePareamento ? (
              <p className="app-base" style={{ color: "var(--texto-2)" }}>
                Ou, no celular, escolha “Conectar com número de telefone” e digite o código{" "}
                <span className="identificador" style={{ color: "var(--texto)" }}>
                  {qrcode.codigoDePareamento}
                </span>
                .
              </p>
            ) : null}

            <ol className="app-base list-decimal space-y-1 pl-5" style={{ color: "var(--texto-2)" }}>
              {passos.map((passo) => (
                <li key={passo}>{passo}</li>
              ))}
            </ol>
            <p className="app-meta">O QR code muda a cada poucos segundos: se não der tempo de ler, o painel mostra outro sozinho.</p>
          </>
        )}
      </div>
    </ConfirmDialog>
  );
}
