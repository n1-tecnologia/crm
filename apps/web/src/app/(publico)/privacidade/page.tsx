/**
 * `/privacidade` — a Política de Privacidade. Pública (sem sessão): é o endereço
 * que a Meta pede no cadastro do app e o que o titular abre antes de ter conta.
 * O texto segue a LGPD (Lei 13.709/2018) e o Marco Civil da Internet.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { EMPRESA } from "@/features/legal/dados-da-empresa";
import { ComoFalarConosco, DocumentoLegal, Identificacao, Itens, type SecaoLegal } from "@/features/legal/documento-legal";

export const metadata: Metadata = {
  title: "Política de Privacidade",
  description: `Como a ${EMPRESA.nome} trata dados pessoais no ${EMPRESA.produto}: o que coleta, para quê, com quem compartilha e como você exerce seus direitos.`,
};

const secoes: readonly SecaoLegal[] = [
  {
    id: "quem-somos",
    titulo: "Quem somos e a quem este documento se aplica",
    conteudo: (
      <>
        <p>
          O {EMPRESA.produto} é uma plataforma de trabalho, CRM e Caixa de Entrada operada pela {EMPRESA.nome}. Esta Política explica como tratamos dados
          pessoais quando você usa a plataforma, visita este site ou conversa com uma empresa que usa o {EMPRESA.produto}.
        </p>
        <Identificacao />
        <p>Nosso papel muda conforme o dado:</p>
        <Itens>
          <li>
            <strong>Controladora</strong>, quando decidimos por que e como tratar o dado: o cadastro de quem usa a plataforma, os registros de acesso e a
            segurança do serviço.
          </li>
          <li>
            <strong>Operadora</strong>, quando tratamos dados em nome da empresa cliente: os Contatos, Empresas, Negócios, Conversas, Mensagens e documentos
            que ela coloca no Espaço de Trabalho. Quem decide o que fazer com eles é a empresa cliente, que é a controladora desses dados.
          </li>
        </Itens>
      </>
    ),
  },
  {
    id: "dados-tratados",
    titulo: "Quais dados tratamos",
    conteudo: (
      <>
        <Itens>
          <li>
            <strong>Conta:</strong> nome, e-mail, Papel e vínculo com o Espaço de Trabalho. A senha é guardada pelo serviço de autenticação já protegida; nós
            não a lemos.
          </li>
          <li>
            <strong>Conteúdo do Espaço de Trabalho:</strong> Tarefas, Listas, comentários, anexos, Formulários e o que mais a equipe registrar.
          </li>
          <li>
            <strong>CRM:</strong> Contatos, Empresas, Funis e Negócios, com os campos que a empresa cliente preenche (nome, telefone, e-mail, cargo, valores
            e anotações).
          </li>
          <li>
            <strong>Caixa de Entrada:</strong> Canais conectados (WhatsApp, Instagram, E-mail), o identificador da conta em cada provedor, as credenciais ou
            tokens de acesso que o provedor concede, e as Conversas e Mensagens trocadas, com seus anexos.
          </li>
          <li>
            <strong>Financeiro:</strong> solicitações e contas a pagar e a receber, dados de fornecedores e clientes (nome, CPF ou CNPJ, dados de pagamento) e
            documentos fiscais que a empresa cliente anexa.
          </li>
          <li>
            <strong>Dados técnicos:</strong> endereço IP, data e hora de acesso, navegador e sistema do aparelho, e registros de ações dentro da plataforma.
          </li>
        </Itens>
        <p>
          Não pedimos dados pessoais sensíveis (como saúde, biometria ou origem racial). Se a empresa cliente os registrar em campos livres ou em conversas, é
          ela quem responde por ter base legal para isso.
        </p>
      </>
    ),
  },
  {
    id: "finalidades",
    titulo: "Para que usamos os dados e em que base legal",
    conteudo: (
      <>
        <Itens>
          <li>
            <strong>Entregar o serviço</strong> — criar a conta, autenticar, mostrar o que cada Papel pode ver, receber e enviar mensagens pelos Canais,
            registrar Negócios e operar o Financeiro. Base: execução de contrato (LGPD, art. 7º, V).
          </li>
          <li>
            <strong>Segurança e prevenção a fraudes</strong> — detectar acesso indevido, abuso e falhas. Base: legítimo interesse (art. 7º, IX) e proteção do
            crédito e da segurança.
          </li>
          <li>
            <strong>Cumprir obrigações legais</strong> — guarda de registros de acesso (Marco Civil da Internet, art. 15), obrigações fiscais e ordens de
            autoridades. Base: obrigação legal (art. 7º, II).
          </li>
          <li>
            <strong>Suporte e melhoria do produto</strong> — responder pedidos, corrigir erros e entender quais recursos funcionam, preferindo dados
            agregados. Base: legítimo interesse.
          </li>
          <li>
            <strong>Comunicações sobre o serviço</strong> — avisos de segurança, mudanças nestes documentos e convites para um Espaço de Trabalho. Quando
            alguma comunicação depender de consentimento, pediremos e você poderá retirá-lo.
          </li>
        </Itens>
        <p>
          Não vendemos dados pessoais, não os usamos para publicidade de terceiros e não formamos perfis para fins que você não esperaria ao usar a
          plataforma.
        </p>
      </>
    ),
  },
  {
    id: "canais-de-terceiros",
    titulo: "Canais conectados: WhatsApp, Instagram e E-mail",
    conteudo: (
      <>
        <p>
          Quando a empresa cliente conecta um Canal, ela nos autoriza a acessar a conta correspondente no provedor — por exemplo, a WhatsApp Business Platform
          e o Instagram, da Meta, ou uma caixa de e-mail por IMAP e SMTP. Com essa autorização:
        </p>
        <Itens>
          <li>lemos e enviamos mensagens, e consultamos os dados básicos da conta, só para exibir e responder as Conversas dentro do {EMPRESA.produto};</li>
          <li>guardamos o token de acesso apenas enquanto o Canal estiver conectado, e o apagamos quando ele for desconectado;</li>
          <li>
            não usamos o conteúdo das mensagens nem os dados recebidos da Meta para publicidade, não os vendemos nem os repassamos a corretores de dados;
          </li>
          <li>
            tratamos os dados dos contatos da empresa cliente como operadora, nas instruções dela. É a empresa que define a quem escreve e deve ter base legal
            e, quando exigido pelo provedor, o consentimento do contato.
          </li>
        </Itens>
        <p>
          O {EMPRESA.produto} é um serviço independente e não é afiliado, patrocinado nem endossado pela Meta. O tratamento feito pelo próprio provedor
          segue a política dele.
        </p>
      </>
    ),
  },
  {
    id: "compartilhamento",
    titulo: "Com quem compartilhamos",
    conteudo: (
      <>
        <p>Compartilhamos dados só na medida necessária, com:</p>
        <Itens>
          <li>
            <strong>Provedores de infraestrutura</strong> que hospedam e operam a plataforma, como a Supabase (autenticação e banco de dados) e a Vercel
            (hospedagem da interface), além do ambiente em que roda o servidor da aplicação;
          </li>
          <li>
            <strong>Provedores dos Canais</strong> que a empresa cliente conectou (Meta, provedores de e-mail e equivalentes), para entregar e receber
            mensagens;
          </li>
          <li>
            <strong>Provedores de recursos opcionais</strong>, como modelos de inteligência artificial ou serviços de pagamento, apenas quando a empresa
            cliente ativa um recurso que dependa deles, e só com o conteúdo que o recurso precisa;
          </li>
          <li>
            <strong>Autoridades</strong>, quando a lei ou uma ordem judicial exigir, ou para defender nossos direitos em processo;
          </li>
          <li>
            <strong>Sucessores</strong>, em caso de fusão, aquisição ou reorganização, mantidas as garantias desta Política.
          </li>
        </Itens>
        <p>Exigimos desses parceiros que protejam os dados em nível compatível com esta Política.</p>
      </>
    ),
  },
  {
    id: "transferencia-internacional",
    titulo: "Transferência internacional",
    conteudo: (
      <p>
        Alguns provedores de infraestrutura mantêm servidores fora do Brasil. Nesses casos, a transferência acontece com as garantias da LGPD (art. 33), como
        cláusulas contratuais adequadas, e apenas para os dados necessários à operação do serviço.
      </p>
    ),
  },
  {
    id: "retencao",
    titulo: "Por quanto tempo guardamos",
    conteudo: (
      <>
        <Itens>
          <li>
            <strong>Conta e conteúdo do Espaço:</strong> enquanto a conta estiver ativa. Depois do encerramento, removemos em até 30 dias; cópias de segurança
            deixam de existir em até 90 dias.
          </li>
          <li>
            <strong>Registros de acesso:</strong> seis meses, como o Marco Civil da Internet determina.
          </li>
          <li>
            <strong>Dados fiscais e financeiros:</strong> pelo prazo exigido em lei, ainda que a conta tenha sido encerrada.
          </li>
          <li>
            <strong>Tokens de um Canal:</strong> apagados quando o Canal é desconectado.
          </li>
        </Itens>
        <p>Dados que a lei nos obriga a manter ficam separados e só são usados para essa finalidade.</p>
      </>
    ),
  },
  {
    id: "seguranca",
    titulo: "Como protegemos",
    conteudo: (
      <>
        <p>Adotamos medidas técnicas e administrativas proporcionais ao risco, entre elas:</p>
        <Itens>
          <li>conexão cifrada (HTTPS) entre o navegador e a plataforma;</li>
          <li>autenticação por conta individual, com sessão de vida curta e renovada em uso;</li>
          <li>isolamento entre Espaços de Trabalho e controle de acesso por Papel, aplicado também no servidor, não só na tela;</li>
          <li>registro das ações dentro da plataforma, para auditoria e investigação de incidentes.</li>
        </Itens>
        <p>
          Nenhum sistema é totalmente imune a falhas. Se houver um incidente que possa causar risco ou dano relevante, comunicaremos a Autoridade Nacional de
          Proteção de Dados (ANPD) e as pessoas afetadas, nos termos do art. 48 da LGPD.
        </p>
      </>
    ),
  },
  {
    id: "direitos",
    titulo: "Seus direitos como titular",
    conteudo: (
      <>
        <p>Nos termos do art. 18 da LGPD, você pode pedir:</p>
        <Itens>
          <li>confirmação de que tratamos seus dados e acesso a eles;</li>
          <li>correção de dados incompletos, inexatos ou desatualizados;</li>
          <li>anonimização, bloqueio ou eliminação de dados desnecessários ou tratados fora da lei;</li>
          <li>portabilidade dos dados;</li>
          <li>eliminação dos dados tratados com o seu consentimento;</li>
          <li>informação sobre com quem compartilhamos seus dados;</li>
          <li>informação sobre a possibilidade de não consentir e sobre as consequências;</li>
          <li>revogação do consentimento e oposição a tratamento feito com base em outra hipótese legal;</li>
          <li>revisão de decisões tomadas apenas por tratamento automatizado.</li>
        </Itens>
        <p>
          <ComoFalarConosco /> Podemos pedir informações para confirmar quem você é antes de atender. Respondemos dentro do prazo legal. Se discordar da
          resposta, você pode reclamar à ANPD.
        </p>
        <p>
          Se o seu dado está no CRM ou numa conversa de uma empresa que usa o {EMPRESA.produto}, essa empresa é a controladora. Encaminhamos seu pedido a ela
          e a ajudamos a atendê-lo.
        </p>
      </>
    ),
  },
  {
    id: "exclusao-de-dados",
    titulo: "Como pedir a exclusão dos seus dados",
    conteudo: (
      <>
        <p>Para excluir dados que tratamos como controladora ou desfazer a conexão de um Canal:</p>
        <Itens>
          <li>
            <strong>Quem tem conta:</strong> peça o encerramento ao responsável pelo Espaço de Trabalho ou escreva para nós. Removemos os dados nos prazos da
            seção “Por quanto tempo guardamos”.
          </li>
          <li>
            <strong>Quem conectou um Canal da Meta:</strong> desconecte o Canal em Caixa de Entrada › Configurações › Canais e, se quiser, remova o aplicativo
            nas configurações da sua conta Facebook ou Instagram (Configurações › Aplicativos e sites). Isso encerra o acesso na hora; peça a exclusão do que
            já foi gravado pelos meios acima.
          </li>
          <li>
            <strong>Quem é Contato de uma empresa:</strong> fale com a própria empresa. Se não souber quem é, escreva para nós, informando o telefone, o
            e-mail ou o perfil pelo qual você conversou.
          </li>
        </Itens>
        <p>Confirmaremos o recebimento e, concluída a exclusão, avisaremos você.</p>
      </>
    ),
  },
  {
    id: "cookies",
    titulo: "Cookies",
    conteudo: (
      <p>
        Usamos apenas cookies essenciais: o que mantém sua sessão aberta depois do login e o que renova essa sessão com segurança. Não usamos cookies de
        publicidade nem ferramentas de rastreamento de terceiros. Bloquear os cookies essenciais impede o uso da área logada.
      </p>
    ),
  },
  {
    id: "menores",
    titulo: "Crianças e adolescentes",
    conteudo: (
      <p>
        O {EMPRESA.produto} é voltado a empresas e profissionais maiores de 18 anos. Não coletamos dados de crianças e adolescentes de propósito. Se
        percebermos que isso aconteceu, excluiremos os dados.
      </p>
    ),
  },
  {
    id: "mudancas",
    titulo: "Mudanças nesta Política",
    conteudo: (
      <p>
        Podemos atualizar esta Política para refletir mudanças no serviço ou na lei. A data no topo mostra a versão vigente. Quando a mudança for relevante,
        avisaremos por e-mail ou dentro da plataforma antes de ela valer.
      </p>
    ),
  },
  {
    id: "contato",
    titulo: "Contato",
    conteudo: (
      <>
        <p>
          Dúvidas sobre esta Política ou sobre o tratamento dos seus dados? <ComoFalarConosco />
        </p>
        <p>
          Os termos de uso do serviço estão em <Link href="/termos" className="hover:underline" style={{ color: "var(--acento)" }}>Termos e Condições</Link>.
        </p>
      </>
    ),
  },
];

export default function PrivacidadePage() {
  return (
    <DocumentoLegal
      titulo="Política de Privacidade"
      resumo={`Esta Política conta, sem rodeios, quais dados pessoais o ${EMPRESA.produto} trata, para quê, com quem os compartilha e como você exerce seus direitos.`}
      secoes={secoes}
      outro={{ href: "/termos", rotulo: "Termos e Condições" }}
    />
  );
}
