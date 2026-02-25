export const PrivacyHeader = () => (
  <div className="max-w-4xl mx-auto px-6 pt-12 pb-4 text-center">
    {/* Newspaper masthead style */}
    <div className="mb-4">
      <div className="h-px w-full mb-3" style={{ background: "#2c2c2c" }} />
      <h1
        className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-none"
        style={{ fontFamily: "'Georgia', serif", color: "#1a1a1a" }}
      >
        Política de Privacidade
      </h1>
      <p
        className="text-base sm:text-lg mt-3 italic"
        style={{ fontFamily: "'Georgia', serif", color: "#5a5a5a" }}
      >
        Uso de Dados e Inteligência Artificial
      </p>
      <div className="h-px w-full mt-3" style={{ background: "#2c2c2c" }} />
    </div>

    <p
      className="text-sm max-w-2xl mx-auto leading-relaxed"
      style={{ fontFamily: "'Georgia', serif", color: "#4a4a4a" }}
    >
      Transparência e segurança no tratamento dos seus dados pessoais, em conformidade com a Lei Geral de Proteção de Dados (LGPD).
    </p>
  </div>
);
