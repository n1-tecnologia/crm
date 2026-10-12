/**
 * O mockup por provedor da jornada de conexão (Fase 8, D-06, D-07): para cada um
 * dos quatro provedores, quando usá-lo, o passo a passo genérico e o texto do
 * espaço reservado do QR/token. É texto de tela — "como aparece" —, por isso
 * mora no web e não no domínio.
 *
 * O layout fica; o conteúdo do `espacoReservado` troca quando a integração com
 * o provedor chegar. Credenciais não são pedidas nesta fase (D-03): nada aqui
 * vira campo de formulário.
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
      "Tenha uma conta no Meta Business com a empresa verificada.",
      "Registre o número na plataforma do WhatsApp Business (Cloud API) e confirme-o por SMS ou ligação.",
      "Gere o token de acesso permanente do aplicativo — ele será pedido aqui quando a integração existir.",
    ],
    espacoReservado: {
      titulo: "Token de acesso e número verificado",
      texto: "Aqui entram o token da Cloud API e o número confirmado pela Meta, quando a integração chegar.",
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
      texto: "O QR code para parear o celular aparece aqui quando a integração chegar.",
    },
  },
  "instagram-graph": {
    quandoUsar: "Para responder o Direct de uma conta profissional do Instagram.",
    passos: [
      "A conta precisa ser profissional (Empresa ou Criador de conteúdo).",
      "Vincule a conta a uma Página do Facebook no Meta Business.",
      "Autorize o acesso às mensagens do Direct quando a integração pedir.",
    ],
    espacoReservado: {
      titulo: "Autorização da conta",
      texto: "O login da Meta para autorizar a conta aparece aqui quando a integração chegar.",
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
