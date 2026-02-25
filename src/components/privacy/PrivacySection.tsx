import { ReactNode } from "react";

interface PrivacySectionProps {
  section: {
    title: string;
    content: ReactNode;
  };
  index: number;
}

export const PrivacySection = ({ section, index }: PrivacySectionProps) => (
  <article
    className="py-6"
    style={{
      borderBottom: "1px solid #d4cabb",
    }}
  >
    <h2
      className="text-lg font-bold uppercase tracking-wide mb-3"
      style={{ fontFamily: "'Georgia', serif", color: "#1a1a1a", letterSpacing: "0.05em" }}
    >
      {section.title}
    </h2>
    <div
      className="text-sm leading-relaxed text-justify"
      style={{
        fontFamily: "'Georgia', serif",
        color: "#3a3a3a",
        columnCount: index === 0 ? 1 : undefined,
      }}
    >
      {section.content}
    </div>
  </article>
);
