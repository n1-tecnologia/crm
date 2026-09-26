/**
 * O MICROFONE do assistente de voz — abrir o que o navegador PERMITIU e, quando
 * ele não abre, dizer o motivo CERTO (2026-09-23: "deve ser possível usar o
 * microfone permitido pelo navegador").
 *
 * O caso que motivou: o navegador permite, mas o SISTEMA bloqueia (no Windows,
 * a privacidade do microfone para aplicativos da área de trabalho) — o Chrome
 * então recusa com "Permission denied by system", e o painel mandava a pessoa
 * liberar no navegador, que já estava liberado. Agora a permissão do navegador
 * é consultada, e cada recusa ganha o seu motivo e o seu caminho.
 *
 * Nada aqui grava nem guarda áudio: abrir o microfone devolve a trilha, que o
 * assistente liga SÓ a um analisador de nível.
 */

/** Por que o microfone não abriu. */
export type FalhaDoMicrofone =
  /** O navegador bloqueou (a pessoa recusou, ou bloqueou antes). */
  | "negado"
  /** O pedido fechou sem resposta. */
  | "dispensado"
  /** O navegador permitiu, mas o sistema (ou outra camada) bloqueou. */
  | "sistema"
  /** O microfone existe e está permitido, mas não abre (em uso por outro programa). */
  | "ocupado"
  | "sem-microfone"
  /** A página não é segura (http fora do localhost): o navegador nem oferece o microfone. */
  | "inseguro"
  /** O navegador não tem microfone nesta página. */
  | "indisponivel"
  | "erro";

export type EstadoDaPermissao = "granted" | "denied" | "prompt" | "desconhecido";

/**
 * O motivo de uma recusa do `getUserMedia`, pelo NOME do erro, pela
 * permissão do navegador naquele instante e pela mensagem (os navegadores dizem
 * "by system" e "dismissed" nela). Pura, testada ao lado.
 */
export function classificarFalha(nome: string, permissao: EstadoDaPermissao, mensagem = ""): FalhaDoMicrofone {
  if (nome === "NotAllowedError" || nome === "PermissionDeniedError" || nome === "SecurityError") {
    if (/system/i.test(mensagem) || permissao === "granted") return "sistema";
    if (/dismiss/i.test(mensagem) || permissao === "prompt") return "dispensado";
    return "negado";
  }
  if (nome === "NotReadableError" || nome === "TrackStartError" || nome === "AbortError") return "ocupado";
  if (nome === "NotFoundError" || nome === "DevicesNotFoundError" || nome === "OverconstrainedError") return "sem-microfone";
  return "erro";
}

/** Falhas em que vale tentar OUTRA forma de abrir (outro aparelho, sem restrições). */
function recuperavel(erro: unknown): boolean {
  const nome = erro instanceof DOMException ? erro.name : "";
  return (
    nome === "NotReadableError" ||
    nome === "TrackStartError" ||
    nome === "AbortError" ||
    nome === "OverconstrainedError" ||
    nome === "NotFoundError"
  );
}

/**
 * Das tentativas que falharam, qual erro conta a história: "em uso" diz mais
 * que "não encontrado", que diz mais que uma restrição recusada (um aparelho
 * da lista que já não existe). Antes o painel mostrava o ÚLTIMO erro, e uma
 * tentativa de reserva podia esconder o motivo real.
 */
function pesoDoErro(erro: unknown): number {
  const nome = erro instanceof DOMException ? erro.name : "";
  if (nome === "NotReadableError" || nome === "TrackStartError" || nome === "AbortError") return 3;
  if (nome === "NotFoundError") return 2;
  if (nome === "OverconstrainedError") return 1;
  return 0;
}

/** Quantos microfones o navegador enxerga agora (sem pedir nada). */
export async function contarEntradas(): Promise<number> {
  try {
    const lista = await navigator.mediaDevices.enumerateDevices();
    return lista.filter((aparelho) => aparelho.kind === "audioinput").length;
  } catch {
    return 0;
  }
}

/**
 * O que registrar quando o microfone não abre: o erro exato, a permissão do
 * navegador e quantos microfones ele enxerga. Vai ao console — no
 * desenvolvimento o Next o repassa ao terminal —, para a causa real de um
 * aparelho que não abre deixar de ser palpite.
 */
export async function diagnosticoDaFalha(erro: unknown): Promise<{ readonly erro: string; readonly permissao: EstadoDaPermissao; readonly entradas: number }> {
  const nome = erro instanceof Error ? erro.name : typeof erro;
  const mensagem = erro instanceof Error ? erro.message : String(erro);
  return { erro: `${nome}: ${mensagem}`, permissao: await lerPermissao(), entradas: await contarEntradas() };
}

/** A permissão do microfone no navegador agora (sem pedir nada). */
export async function lerPermissao(): Promise<EstadoDaPermissao> {
  try {
    const status = await navigator.permissions?.query({ name: "microphone" as PermissionName });
    return status ? (status.state as EstadoDaPermissao) : "desconhecido";
  } catch {
    return "desconhecido";
  }
}

/** O sistema de quem usa, para o aviso dar o caminho certo das configurações. */
export type Sistema = "windows" | "mac" | "outro";

export function sistemaAtual(): Sistema {
  if (typeof navigator === "undefined") return "outro";
  const dica = (
    (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData?.platform ??
    navigator.platform ??
    navigator.userAgent
  ).toLowerCase();
  if (dica.includes("win")) return "windows";
  if (dica.includes("mac")) return "mac";
  return "outro";
}

/** Antes de pedir: a página pode pedir o microfone? */
export function falhaAntesDePedir(): FalhaDoMicrofone | null {
  if (typeof window === "undefined") return "indisponivel";
  if (window.isSecureContext === false) return "inseguro";
  if (!window.AudioContext || !navigator.mediaDevices?.getUserMedia) return "indisponivel";
  return null;
}

/**
 * Abre o microfone permitido. Primeiro o que o NAVEGADOR escolhe (o do pedido
 * ou das configurações do site), com cancelamento de eco; se esse não abre
 * (ocupado, restrição que o aparelho não aceita), o mesmo sem restrição
 * nenhuma; e, ainda sem sucesso, cada microfone da lista, um a um. Uma recusa
 * de permissão não tenta de novo — ela vale para todos.
 */
export async function abrirMicrofone(continuar: () => boolean = () => true): Promise<MediaStream> {
  const dispositivos = navigator.mediaDevices;
  // Cada tentativa confere se ainda vale: desligar ou sair da tela no meio das
  // reservas não pode deixar uma delas abrir o microfone (achado da revisão).
  const seguir = () => {
    if (!continuar()) throw new DOMException("A tentativa de abrir o microfone foi cancelada.", "AbortError");
  };
  let ultimo: unknown;
  const guardar = (erro: unknown) => {
    if (ultimo === undefined || pesoDoErro(erro) > pesoDoErro(ultimo)) ultimo = erro;
  };
  const tentativas: MediaStreamConstraints[] = [
    { audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } },
    { audio: true },
  ];
  for (const restricoes of tentativas) {
    seguir();
    try {
      return await dispositivos.getUserMedia(restricoes);
    } catch (erro) {
      if (!recuperavel(erro)) throw erro;
      guardar(erro);
    }
  }
  seguir();
  const lista = await dispositivos.enumerateDevices().catch(() => [] as MediaDeviceInfo[]);
  for (const aparelho of lista) {
    // "default" e "communications" são apelidos de aparelhos que já estão na lista.
    if (aparelho.kind !== "audioinput" || !aparelho.deviceId || aparelho.deviceId === "default" || aparelho.deviceId === "communications") {
      continue;
    }
    seguir();
    try {
      return await dispositivos.getUserMedia({ audio: { deviceId: { exact: aparelho.deviceId } } });
    } catch (erro) {
      if (!recuperavel(erro)) throw erro;
      guardar(erro);
    }
  }
  throw ultimo;
}

/** O motivo de um erro do `abrirMicrofone`, consultando a permissão do navegador. */
export async function motivoDaFalha(erro: unknown): Promise<FalhaDoMicrofone> {
  const nome = erro instanceof DOMException ? erro.name : erro instanceof Error ? erro.name : "";
  const mensagem = erro instanceof Error ? erro.message : "";
  return classificarFalha(nome, await lerPermissao(), mensagem);
}
