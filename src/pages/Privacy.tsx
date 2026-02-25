import { useEffect } from "react";
import { Link } from "react-router-dom";
import { PrivacyHeader } from "@/components/privacy/PrivacyHeader";
import { PrivacySection } from "@/components/privacy/PrivacySection";
import { privacySections } from "@/components/privacy/privacyContent";

const Privacy = () => {
  useEffect(() => {
    document.documentElement.style.overflow = "auto";
    document.documentElement.style.height = "auto";
    document.body.style.overflow = "auto";
    document.body.style.height = "auto";
    return () => {
      document.documentElement.style.overflow = "";
      document.documentElement.style.height = "";
      document.body.style.overflow = "";
      document.body.style.height = "";
    };
  }, []);

  return (
    <div className="min-h-screen" style={{ background: "#f5f0eb" }}>
      {/* Newspaper-style top bar */}
      <div className="w-full border-b-2 border-double" style={{ borderColor: "#2c2c2c" }}>
        <div className="max-w-4xl mx-auto px-6 py-2 flex items-center justify-between">
          <span className="text-xs tracking-[0.3em] uppercase" style={{ color: "#6b6b6b", fontFamily: "'Georgia', serif" }}>
            Documento Legal
          </span>
          <span className="text-xs" style={{ color: "#6b6b6b", fontFamily: "'Georgia', serif" }}>
            Atualizado em Janeiro de 2025
          </span>
        </div>
      </div>

      <PrivacyHeader />

      {/* Content */}
      <div className="max-w-4xl mx-auto px-6 pb-16">
        {/* Decorative rule */}
        <div className="flex items-center gap-4 my-8">
          <div className="flex-1 h-px" style={{ background: "#c4b8a8" }} />
          <span className="text-xs tracking-[0.2em] uppercase" style={{ color: "#8a7e6e", fontFamily: "'Georgia', serif" }}>
            Índice de Seções
          </span>
          <div className="flex-1 h-px" style={{ background: "#c4b8a8" }} />
        </div>

        {/* Two-column newspaper layout for sections */}
        <div className="space-y-0">
          {privacySections.map((section, index) => (
            <PrivacySection key={index} section={section} index={index} />
          ))}
        </div>

        {/* Footer */}
        <div className="mt-12 pt-6 border-t-2 border-double" style={{ borderColor: "#2c2c2c" }}>
          <div className="flex items-center justify-between">
            <p className="text-xs" style={{ color: "#6b6b6b", fontFamily: "'Georgia', serif" }}>
              © 2025 Creator. Todos os direitos reservados.
            </p>
            <Link to="/contact" className="text-xs underline" style={{ color: "#6b6b6b", fontFamily: "'Georgia', serif" }}>
              Fale Conosco
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Privacy;
