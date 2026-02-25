import { ReactNode } from "react";

interface PrivacySection {
  title: string;
  content: ReactNode;
}

const bulletStyle = { color: "#8a7e6e" };

export const privacySections: PrivacySection[] = [
  {
    title: "1. Introdução",
    content: (
      <>
        <p>
          Esta Política de Privacidade tem como objetivo explicar, de forma clara e transparente, como coletamos, utilizamos, armazenamos e protegemos os dados dos usuários de nossa plataforma. Nosso compromisso é assegurar <strong>segurança, ética digital e conformidade com a Lei Geral de Proteção de Dados (Lei nº 13.709/2018 – LGPD)</strong> e demais legislações aplicáveis.
        </p>
        <p className="mt-3">
          Ao utilizar a plataforma, o usuário concorda com os termos descritos nesta Política.
        </p>
      </>
    ),
  },
  {
    title: "2. Definições",
    content: (
      <>
        <p className="mb-3">Para fins desta Política:</p>
        <ul className="space-y-1 ml-4">
          <li className="flex gap-2"><span style={bulletStyle}>—</span><span><strong>Usuário:</strong> qualquer pessoa que utilize a plataforma.</span></li>
          <li className="flex gap-2"><span style={bulletStyle}>—</span><span><strong>Dados Pessoais:</strong> informações que permitem identificar uma pessoa física.</span></li>
          <li className="flex gap-2"><span style={bulletStyle}>—</span><span><strong>Dados Sensíveis:</strong> dados que revelam origem racial/étnica, convicção religiosa, opinião política, saúde, biometria, entre outros.</span></li>
          <li className="flex gap-2"><span style={bulletStyle}>—</span><span><strong>Tratamento de Dados:</strong> qualquer operação realizada com dados pessoais.</span></li>
          <li className="flex gap-2"><span style={bulletStyle}>—</span><span><strong>Parceiros/Fornecedores:</strong> empresas que prestam serviços necessários para a operação da plataforma.</span></li>
        </ul>
      </>
    ),
  },
  {
    title: "3. Dados Coletados",
    content: (
      <>
        <p className="mb-3">Podemos coletar as seguintes categorias de dados:</p>
        <ul className="space-y-1 ml-4">
          <li className="flex gap-2"><span style={bulletStyle}>—</span><span><strong>Cadastro:</strong> nome, e-mail, telefone, CPF ou CNPJ.</span></li>
          <li className="flex gap-2"><span style={bulletStyle}>—</span><span><strong>Navegação e uso:</strong> endereço IP, cookies, localização aproximada, histórico de interações.</span></li>
          <li className="flex gap-2"><span style={bulletStyle}>—</span><span><strong>Transações:</strong> histórico de compras, assinaturas e métodos de pagamento.</span></li>
          <li className="flex gap-2"><span style={bulletStyle}>—</span><span><strong>Engajamento:</strong> interações em chat, feedbacks, upload de marcas e comunicações.</span></li>
        </ul>
        <p className="mt-3 italic">
          Observação: não coletamos dados sensíveis sem consentimento explícito do usuário.
        </p>
      </>
    ),
  },
  {
    title: "4. Bases Legais do Tratamento",
    content: (
      <>
        <p className="mb-3">O tratamento de dados é realizado com fundamento em bases legais da LGPD:</p>
        <ul className="space-y-1 ml-4">
          <li className="flex gap-2"><span style={bulletStyle}>—</span><span><strong>Execução de contrato:</strong> para oferecer os serviços contratados.</span></li>
          <li className="flex gap-2"><span style={bulletStyle}>—</span><span><strong>Consentimento:</strong> quando o usuário autoriza o uso de dados para fins específicos.</span></li>
          <li className="flex gap-2"><span style={bulletStyle}>—</span><span><strong>Obrigação legal/regulatória:</strong> cumprimento de normas aplicáveis.</span></li>
          <li className="flex gap-2"><span style={bulletStyle}>—</span><span><strong>Legítimo interesse:</strong> quando o uso dos dados é necessário para aprimorar serviços.</span></li>
        </ul>
      </>
    ),
  },
  {
    title: "5. Finalidades do Uso dos Dados",
    content: (
      <ul className="space-y-1 ml-4">
        <li className="flex gap-2"><span style={bulletStyle}>—</span><span>Disponibilizar e melhorar os serviços da plataforma.</span></li>
        <li className="flex gap-2"><span style={bulletStyle}>—</span><span>Personalizar a experiência do usuário.</span></li>
        <li className="flex gap-2"><span style={bulletStyle}>—</span><span>Comunicar atualizações, novidades e ofertas.</span></li>
        <li className="flex gap-2"><span style={bulletStyle}>—</span><span>Apoiar análises internas e geração de relatórios.</span></li>
        <li className="flex gap-2"><span style={bulletStyle}>—</span><span>Cumprir obrigações legais e regulatórias.</span></li>
        <li className="flex gap-2"><span style={bulletStyle}>—</span><span>Uso para campanhas de marketing para a plataforma.</span></li>
      </ul>
    ),
  },
  {
    title: "6. Uso de Inteligência Artificial (IA)",
    content: (
      <>
        <p className="mb-3">A plataforma utiliza algoritmos e modelos de IA para:</p>
        <ul className="space-y-1 ml-4">
          <li className="flex gap-2"><span style={bulletStyle}>—</span><span>Recomendar conteúdos e produtos personalizados.</span></li>
          <li className="flex gap-2"><span style={bulletStyle}>—</span><span>Apoiar atendimento e suporte via chatbots e análise preditiva.</span></li>
          <li className="flex gap-2"><span style={bulletStyle}>—</span><span>Gerar insights estratégicos a partir de dados agregados e anônimos.</span></li>
          <li className="flex gap-2"><span style={bulletStyle}>—</span><span>Auxiliar na criação de materiais digitais.</span></li>
        </ul>
        <p className="mt-4 mb-3 font-semibold">Compromissos sobre IA:</p>
        <ul className="space-y-1 ml-4">
          <li className="flex gap-2"><span style={bulletStyle}>—</span><span>A IA não substitui decisões humanas críticas.</span></li>
          <li className="flex gap-2"><span style={bulletStyle}>—</span><span>O usuário será informado quando interagir com sistemas automatizados.</span></li>
          <li className="flex gap-2"><span style={bulletStyle}>—</span><span>Nenhum dado pessoal sensível é utilizado sem consentimento.</span></li>
          <li className="flex gap-2"><span style={bulletStyle}>—</span><span>Aplicamos medidas para evitar vieses e discriminação algorítmica.</span></li>
        </ul>
      </>
    ),
  },
  {
    title: "7. Compartilhamento e Transferência de Dados",
    content: (
      <>
        <p className="mb-3">
          Os dados dos usuários não são vendidos a terceiros. Podem ser compartilhados somente com:
        </p>
        <ul className="space-y-1 ml-4">
          <li className="flex gap-2"><span style={bulletStyle}>—</span><span>LeFil Company, responsável pela tecnologia da plataforma.</span></li>
          <li className="flex gap-2"><span style={bulletStyle}>—</span><span>Fornecedores e parceiros tecnológicos estritamente necessários.</span></li>
          <li className="flex gap-2"><span style={bulletStyle}>—</span><span>Autoridades competentes, quando exigido por lei.</span></li>
        </ul>
        <p className="mt-3">
          Caso seja necessário transferir dados para fora do Brasil, garantimos conformidade com a LGPD e legislação aplicável.
        </p>
      </>
    ),
  },
  {
    title: "8. Cookies e Tecnologias de Rastreamento",
    content: (
      <p>
        Utilizamos cookies e ferramentas de monitoramento para melhorar a experiência de navegação. O usuário pode gerenciar suas preferências de cookies diretamente no navegador, podendo desativar rastreamentos não essenciais.
      </p>
    ),
  },
  {
    title: "9. Direitos dos Usuários",
    content: (
      <>
        <p className="mb-3">Em conformidade com a LGPD, o usuário pode:</p>
        <ul className="space-y-1 ml-4">
          <li className="flex gap-2"><span style={bulletStyle}>—</span><span>Solicitar acesso, correção ou exclusão de dados.</span></li>
          <li className="flex gap-2"><span style={bulletStyle}>—</span><span>Revogar consentimento a qualquer momento.</span></li>
          <li className="flex gap-2"><span style={bulletStyle}>—</span><span>Solicitar portabilidade de dados.</span></li>
          <li className="flex gap-2"><span style={bulletStyle}>—</span><span>Restringir ou se opor ao tratamento de dados pessoais.</span></li>
          <li className="flex gap-2"><span style={bulletStyle}>—</span><span>Optar por não receber comunicações de marketing.</span></li>
        </ul>
        <p className="mt-3 italic">
          As solicitações serão atendidas dentro do prazo legal de até 15 dias.
        </p>
      </>
    ),
  },
  {
    title: "10. Prazo de Armazenamento",
    content: (
      <p>
        Os dados são armazenados pelo tempo necessário para cumprimento das finalidades descritas nesta Política, durante o contrato com a plataforma ou conforme obrigações legais. Após esse período, os dados poderão ser anonimizados ou excluídos de forma segura.
      </p>
    ),
  },
  {
    title: "11. Segurança da Informação",
    content: (
      <>
        <p className="mb-3">Adotamos medidas técnicas e administrativas de segurança:</p>
        <ul className="space-y-1 ml-4">
          <li className="flex gap-2"><span style={bulletStyle}>—</span><span>Criptografia de dados.</span></li>
          <li className="flex gap-2"><span style={bulletStyle}>—</span><span>Controle de acessos restritos.</span></li>
          <li className="flex gap-2"><span style={bulletStyle}>—</span><span>Monitoramento contínuo de sistemas.</span></li>
          <li className="flex gap-2"><span style={bulletStyle}>—</span><span>Políticas internas de governança e proteção de dados.</span></li>
        </ul>
      </>
    ),
  },
  {
    title: "12. Alterações na Política",
    content: (
      <p>
        Podemos atualizar esta Política periodicamente. Em caso de alterações relevantes, os usuários serão notificados por meio da plataforma ou e-mail.
      </p>
    ),
  },
  {
    title: "13. Canal de Atendimento",
    content: (
      <p>
        Para dúvidas, solicitações ou exercício de direitos, entre em contato: {" "}
        <a href="mailto:contato@lefil.com.br" className="underline font-semibold" style={{ color: "#1a1a1a" }}>
          contato@lefil.com.br
        </a>
      </p>
    ),
  },
];
