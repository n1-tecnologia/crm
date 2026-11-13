/**
 * O mockup por provedor da jornada de conexão (Fase 8, D-06, D-07): para cada um
 * dos quatro provedores, quando usá-lo, o passo a passo genérico e o texto do
 * espaço reservado do QR/token. É texto de tela — "como aparece" —, por isso
 * mora no web e não no domínio.
 *
 * O layout fica; o conteúdo do `espacoReservado` troca quando a integração com
 * o provedor chegar. Credenciais não são pedidas AQUI (D-03): nada neste arquivo
 * vira campo de formulário. O token do WhatsApp oficial (Sessão 7) é pedido na
 * ficha do Canal, depois de criá-lo (`PainelDoTokenDoWhatsApp`).
 */

import type { ProvedorDeCanal } from "@n1/dominio/types/crm";

export interface OrientacaoDoProvedor {
  readonly quandoUsar: string;
  readonly passos: readonly string[];
  readonly espacoReservado: { readonly titulo: string; readonly texto: string };
}

export const ORIENTACAO_DO_PROVEDOR: Readonly<Record<ProvedorDeCanal, OrientacaoDoProvedor>> = {
  "whatsapp-cloud": {
    quandoUsar: "Para atender em escala pela API oficial da Meta: janela de 24 horas e Mensagens de modelo aprovadas fora dela.",
    passos: [
      "Tenha a empresa verificada no Meta Business e o app da Meta no modo Ao vivo.",
      "Registre um número dedicado na plataforma do WhatsApp Business (Cloud API), fora do aplicativo WhatsApp, e confirme-o por SMS ou ligação.",
      "Crie um usuário do sistema no Meta Business e gere o token permanente, com as permissões whatsapp_business_messaging e whatsapp_business_management.",
    ],
    espacoReservado: {
      titulo: "Token de acesso e número verificado",
      texto:
        "Depois de criar o Canal, a ficha pede o ID do número, o ID da conta do WhatsApp Business e o token. O token fica cifrado no servidor e não volta à tela.",
    },
  },
  "whatsapp-nao-oficial": {
    quandoUsar: "Para conectar um número comum lendo um QR code: envio livre a qualquer hora, sem Mensagens de modelo.",
    passos: [
      "Use o celular com o WhatsApp do número que vai atender.",
      "No celular, abra Aparelhos conectados e toque em Conectar um aparelho.",
      "Leia o QR code que vai aparecer aqui.",
    ],
    espacoReservado: {
      titulo: "QR code da sessão",
      texto: "Depois de criar o Canal, o QR code aparece aqui.",
    },
  },
  "instagram-graph": {
    quandoUsar: "Para responder o Direct de uma conta profissional do Instagram, no mesmo lugar das outras conversas.",
    passos: [
      "A conta precisa ser profissional (Empresa ou Criador de conteúdo). Não precisa de Página do Facebook.",
      "No aplicativo do Instagram, nas configurações de mensagens, permita o acesso de ferramentas conectadas às mensagens.",
      "Crie o Canal aqui com o @ da conta. Depois, na ficha do Canal, use “Conectar com o Instagram” e entre com essa mesma conta.",
    ],
    espacoReservado: {
      titulo: "Login do Instagram",
      texto: "Depois de criar o Canal, a ficha dele tem o botão “Conectar com o Instagram”: ele abre o login do Instagram e volta conectado.",
    },
  },
  "email-imap-smtp": {
    quandoUsar: "Para receber e responder e-mails de uma caixa que já existe, com assunto e cópias.",
    passos: [
      "Tenha o endereço e a senha (ou senha de aplicativo) da caixa de e-mail.",
      "Anote o servidor de entrada IMAP: endereço, porta e segurança (SSL/TLS).",
      "Anote o servidor de saída SMTP: endereço, porta e segurança.",
    ],
    espacoReservado: {
      titulo: "Servidores IMAP e SMTP",
      texto: "Os dados dos servidores de entrada e saída são pedidos aqui quando a integração chegar.",
    },
  },
};
