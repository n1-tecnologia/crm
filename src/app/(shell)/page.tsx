"use client";

/**
 * T02 — Início: a APRESENTAÇÃO do produto, não a quinquagésima lista.
 *
 * Um palco só, sem rolagem, PRETO de borda a borda, e nele só o ROBÔ: uma cena
 * 3D do Spline (a do componente `splite` do 21st.dev, `design/cena-spline.tsx`),
 * de perto, da cintura para cima, acompanhando o cursor com a cabeça.
 *
 * Como chegou aqui, tudo a pedido e no mesmo dia (2026-09-23): saíram a marca
 * 3D, o campo vivo (as ondas), os orbes e as estrelas ("quero tudo preto, sem
 * a logo N1 e o efeito animado… crie o robô"); o holofote do componente
 * original entrou por cima do palco e saiu ("por que o efeito de hover do
 * brilho voltou?"); e saíram a saudação e o campo da pergunta ao Assistente
 * ("remova"). No fim do dia o holofote VOLTOU, a pedido, ATRÁS do robô
 * ("quero que o efeito de luz esteja vinculado ao mouse… a luz deve passar
 * sempre atrás do robô"): primeiro no palco, antes da cena — o canvas é
 * transparente fora do robô, e a luz contorna a silhueta sem nunca cobri-la.
 * O Assistente segue no menu (IA › Chat). No fim do dia, a logo da N1 no peito do robô, e ela abre o ASSISTENTE: uma
 * caixa pequena no pé do palco, para digitar a pergunta ou falar pelo microfone
 * (só o botão dele abre o microfone); o robô responde com um som de robô e
 * mexe a boca de pontos (`features/inicio/`) — e, SILENCIADO ou com LEGENDA,
 * em texto, num balão ao lado da cabeça, com o que o app já sabe (tarefas,
 * notificações, negócios, contatos, conversas). E, no centro à esquerda, o
 * BOTÃO DE VOZ: um microfone grande que inicia o bate-papo por voz — aberto,
 * ondas em volta do ícone reagem ao som captado e o robô responde
 * (`botao-de-voz.tsx`). Nada é gravado nem enviado.
 *
 * Nenhum número, nenhuma lista, nenhum atalho: quem navega usa o menu lateral.
 * Nada aqui é conceito novo (PRD I.1): a tela não inventa dado nenhum.
 */

import { CenaSpline } from "@/design/cena-spline";
import { Holofote } from "@/design/holofote";
import { BalaoDoRobo } from "@/features/inicio/balao-do-robo";
import { BotaoDeVoz } from "@/features/inicio/botao-de-voz";
import { CaixaDoAssistente } from "@/features/inicio/caixa-do-assistente";
import { useRespostaDoRobo } from "@/features/inicio/panorama-do-robo";
import { useAssistenteDoRobo } from "@/features/inicio/use-assistente-do-robo";
import { MONOGRAMA } from "@/features/shell/brand";
import { CorpoDeTela } from "@/features/shell/ui";

/** A cena do robô no Spline: a mesma do componente `splite` (21st.dev). */
const CENA_DO_ROBO = "https://prod.spline.design/kZDDjO5HuC9GJUM2/scene.splinecode";

/**
 * O ENQUADRAMENTO do robô (2026-09-23: "bem maior… só a parte da cintura pra
 * cima, meio da barriga, bem close"). A cena abre com a câmera colada no rosto
 * (0, 249, 360) e em ~4 s recua sozinha até o corpo inteiro (0, 147, 1000).
 * Aqui a câmera PARA na pose final: a cabeça no alto, com uma folga, e o meio
 * da barriga na borda de baixo. A ENTRADA continua (a pedido: "volte o efeito
 * de entrada dele com zoom out, porém bem mais fechado"): parte do mesmo rosto
 * da abertura da cena e recua só até a pose final. Unidades do mundo do
 * Spline, o robô em z = 0. A abertura da câmera é vertical, então o corte vale
 * para qualquer largura de tela; numa tela estreita os braços passam das
 * bordas — é um retrato.
 */
const CAMERA_DO_ROBO = { nome: "Camera 2", y: 212, z: 471, partida: { y: 249, z: 360 } } as const;

/**
 * Os REFLEXOS ROXOS (2026-09-23: "algumas luzes no robô, apenas alguns
 * reflexos, não todos, sejam roxos… no tom da N1"). A cena tem uma luz só, um
 * contraluz por trás do robô, no alto à esquerda. Tingida no roxo da marca
 * (`--reflexo-robo` = `--roxo-500`, a ponta clara do gradiente), ela pinta só
 * as bordas que alcança — ombros, braços, pescoço. Uma luz roxa a mais, de
 * frente, foi testada e descartada: tingia o tronco inteiro.
 */
const LUZES_DO_ROBO = [{ luz: "Point Light", token: "--reflexo-robo" }] as const;

/**
 * O REFLEXO DO ROSTO também roxo (a seguir, no mesmo dia: "o reflexo branco da
 * cara deve ser roxo também"). Ele não vem de luz: é o matcap do cromo da
 * cabeça ("Head 2"), uma textura só dela — retingida do preto ao roxo da marca
 * e, no brilho mais forte, ao lilás do acento. O corpo tem o próprio matcap e
 * fica como está.
 */
const REFLEXOS_DO_ROBO = [{ objeto: "Head 2", cor: "--reflexo-robo", brilho: "--reflexo-robo-brilho" }] as const;

/**
 * A LOGO DA N1 NO PEITO (2026-09-23: "no peito do robô a logo da N1, porém com
 * efeito de sobrepor"): o monograma oficial (`MONOGRAMA`, o mesmo da marca na
 * casca) em modo SOBREPOR sobre o carbono — a trama aparece por dentro dela,
 * como tinta no tecido — e preso ao tronco ("Body"): quando o robô gira com o
 * cursor, a logo gira junto. O ponto e a largura estão no espaço local da
 * malha (a caixa dela vai de y 100 a 287 e a frente fica em z ≈ 56): o alto do
 * peito, logo abaixo da gola, com ~⅓ da largura do tronco.
 */
const SELO_DO_ROBO = { objeto: "Body", ponto: [0, 252, 57], largura: 44, desenho: MONOGRAMA } as const;

/**
 * A BOCA do robô (2026-09-23: "crie uma boca no robô no mesmo padrão gráfico
 * dos olhos; ela só deve mexer quando a opção de fala for ativa"): pontos
 * brancos como os dos olhos, no rosto ("Head 2"), entre os olhos (y ≈ 10 no
 * espaço da cabeça) e a borda do visor (y ≈ −40), ENCOSTADA na superfície do
 * visor ali (z = 39,4, medido nos vértices da malha) — à frente dela, a boca
 * escorregava pelo rosto quando a cabeça girava; a largura dá o mesmo passo
 * dos pontos dos olhos na tela. Fechada é uma linha; mexe DE LEVE com o volume
 * da voz do robô quando ele responde ("conforme ele fizer o som ela deve mexer
 * levemente") — e só aí, porque só aí há voz.
 */
const BOCA_DO_ROBO = { objeto: "Head 2", ponto: [0, -18, 39.4], largura: 29 } as const;

/**
 * O BALÃO DE CHAT ao lado da cabeça (2026-09-23: "deve aparecer ao lado da
 * cabeça dele em um balão de chat"): ancorado num ponto à direita da cabeça
 * ("Head 2", cuja caixa vai de x −39 a 39 e de y −41 a 62) — e no espelho à
 * esquerda quando não cabe à direita (`minimo`, em px: a largura mínima útil
 * do balão). A seguir, no mesmo dia ("isto deve estar mais para cima e pode
 * crescer mais para a esquerda"): o alto do balão no alto da cabeça (y 58,
 * era 24) e a âncora para DENTRO, sobre a borda cromada (x 34, era 46 — o olho
 * vai até ~32), com o balão mais largo (`--balao-robo-w`): ele ganha ~45 px
 * para a esquerda e a borda direita fica onde estava.
 */
const BALAO_DO_ROBO = { objeto: "Head 2", ponto: [34, 58, 0], espelho: [-34, 58, 0], minimo: 224 } as const;

/** A logo do peito, para o foco voltar a ela quando a caixa do assistente fecha. */
const focoNaLogo = () => document.querySelector<HTMLButtonElement>(".inicio-robo button.cena-spline-selo-luz");

export default function InicioPage() {
  const responder = useRespostaDoRobo();
  const assistente = useAssistenteDoRobo(responder);
  return (
    <div className="flex h-full flex-col">
      {/*
        O Início não tem cabeçalho de tela nem HUD: a capa É a tela — sem
        card, sem cantos, sem respiro, de borda a borda do que a casca deixa
        (trilho, painel e barra global ficam). A pedido: "quero que tome todo o
        espaço da tela inicial, porém sem as bordas arredondadas".
      */}
      <CorpoDeTela className="inicio-corpo">
        <div className="inicio">
          <section className="capa inicio-capa revelar" aria-labelledby="inicio-titulo">
            {/* O título existe para quem navega por leitor de tela e pelos
                cabeçalhos; na vista, o palco é só o robô. */}
            <h1 id="inicio-titulo" className="sr-only">
              Início
            </h1>

            {/* A luz que segue o mouse, ATRÁS do robô: antes da cena no DOM,
                ela pinta no preto e o corpo do robô a encobre. */}
            <Holofote />

            {/* O robô ocupa o palco inteiro e acompanha o cursor em qualquer
                ponto da janela. É decoração (o canvas, a boca e as camadas da
                logo são `aria-hidden`), com UMA exceção: a logo do peito é um
                botão — abre e fecha a caixa do assistente. */}
            <div className="inicio-robo">
              <CenaSpline
                cena={CENA_DO_ROBO}
                camera={CAMERA_DO_ROBO}
                luzes={LUZES_DO_ROBO}
                reflexos={REFLEXOS_DO_ROBO}
                selo={{
                  ...SELO_DO_ROBO,
                  // A logo abre e fecha a CAIXA do assistente (o microfone
                  // só abre pelo botão dele, na caixa); acesa com ela aberta.
                  acao: {
                    rotulo: assistente.aberto ? "Fechar o assistente" : "Falar com o assistente",
                    ativo: assistente.aberto,
                    aoAcionar: assistente.alternarCaixa,
                  },
                }}
                // A boca mexe a cada quadro com a caixa aberta OU com o robô
                // respondendo — pelo botão de voz do palco ele fala com a
                // caixa fechada, e a cena parada (movimento reduzido) não
                // desenharia a boca sozinha.
                boca={{ ...BOCA_DO_ROBO, abertura: assistente.lerBoca, ativa: assistente.aberto || assistente.respondendo }}
                balao={BALAO_DO_ROBO}
                className="inicio-cena"
                eventosGlobais
              >
                {/* O balão de chat: as respostas em texto, ao lado da cabeça. */}
                <BalaoDoRobo assistente={assistente} focoAoFechar={focoNaLogo} />
              </CenaSpline>
            </div>
            {/* O botão de voz, no centro à esquerda: inicia a conversa por voz
                sem a caixa — o mesmo microfone que o botão dela liga. */}
            <BotaoDeVoz assistente={assistente} />
            <CaixaDoAssistente assistente={assistente} focoAoFechar={focoNaLogo} />
          </section>
        </div>
      </CorpoDeTela>
    </div>
  );
}
