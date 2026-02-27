import { useLocation, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, Activity, TrendingUp, AlertTriangle, Minus, Lightbulb, Copy, Check } from "lucide-react";
import { PageBreadcrumb } from "@/components/PageBreadcrumb";
import { useState } from "react";
import { toast } from "sonner";
import createBanner from "@/assets/defense-banner.jpg";

interface Dimensao {
  score: number;
  justificativa: string;
}

interface Sugestao {
  dimensao: string;
  sugestao: string;
}

interface Analysis {
  dimensoes: {
    substancia_publica: Dimensao;
    conexao_local: Dimensao;
    novidade_legitima: Dimensao;
    polarizacao_risco: Dimensao;
    aderencia_identidade: Dimensao;
  };
  classificacao: "repercussao_positiva" | "risco_negativo" | "ruido_efemero";
  resumo: string;
  sugestoes: Sugestao[];
}

const dimensionLabels: Record<string, { label: string; icon: string }> = {
  substancia_publica: { label: "Substância Pública", icon: "📊" },
  conexao_local: { label: "Conexão Local", icon: "📍" },
  novidade_legitima: { label: "Novidade Legítima", icon: "💡" },
  polarizacao_risco: { label: "Polarização e Risco", icon: "⚡" },
  aderencia_identidade: { label: 'Aderência ao "Quem É"', icon: "🎯" },
};

const classificationConfig = {
  repercussao_positiva: {
    label: "Repercussão com Substância Positiva",
    description: "Conteúdo com substância real que tende a gerar engajamento qualificado",
    icon: TrendingUp,
    color: "text-emerald-600",
    bg: "bg-emerald-50 border-emerald-200",
    badgeClass: "bg-emerald-100 text-emerald-700 border-emerald-300",
  },
  risco_negativo: {
    label: "Repercussão com Risco Negativo",
    description: "Pode viralizar mas com potencial dano à imagem",
    icon: AlertTriangle,
    color: "text-red-600",
    bg: "bg-red-50 border-red-200",
    badgeClass: "bg-red-100 text-red-700 border-red-300",
  },
  ruido_efemero: {
    label: '"Ruído de Enxame" Efêmero',
    description: "Não vai gerar dano mas também não vai repercutir",
    icon: Minus,
    color: "text-amber-600",
    bg: "bg-amber-50 border-amber-200",
    badgeClass: "bg-amber-100 text-amber-700 border-amber-300",
  },
};

function ScoreBar({ score, label, icon, justificativa }: { score: number; label: string; icon: string; justificativa: string }) {
  const pct = (score / 5) * 100;
  const color = score >= 4 ? "text-emerald-600" : score >= 3 ? "text-amber-600" : "text-red-600";

  return (
    <div className="space-y-2 p-4 rounded-xl bg-muted/30">
      <div className="flex items-center justify-between">
        <span className="font-semibold text-sm flex items-center gap-2">
          <span>{icon}</span> {label}
        </span>
        <span className={`text-lg font-bold ${color}`}>{score}/5</span>
      </div>
      <Progress value={pct} className="h-2" />
      <p className="text-xs text-muted-foreground leading-relaxed">{justificativa}</p>
    </div>
  );
}

export default function RepercussionResult() {
  const location = useLocation();
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);

  const { analysis, originalContent, creditsUsed, creditsRemaining } = (location.state || {}) as {
    analysis?: Analysis;
    originalContent?: string;
    creditsUsed?: number;
    creditsRemaining?: number;
  };

  if (!analysis) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Activity className="h-12 w-12 text-muted-foreground" />
        <p className="text-muted-foreground">Nenhuma análise encontrada</p>
        <Button onClick={() => navigate("/repercussion")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Nova Análise
        </Button>
      </div>
    );
  }

  const config = classificationConfig[analysis.classificacao];
  const ClassificationIcon = config.icon;

  const totalScore = Object.values(analysis.dimensoes).reduce((sum, d) => sum + d.score, 0);
  const avgScore = (totalScore / 5).toFixed(1);

  const handleCopyReport = () => {
    const dims = Object.entries(analysis.dimensoes)
      .map(([key, d]) => `${dimensionLabels[key]?.label || key}: ${d.score}/5 — ${d.justificativa}`)
      .join("\n");
    const suggestions = analysis.sugestoes.map((s) => `• ${s.dimensao}: ${s.sugestao}`).join("\n");
    const report = `📊 ANÁLISE DE REPERCUSSÃO\n\nClassificação: ${config.label}\nScore médio: ${avgScore}/5\n\n${analysis.resumo}\n\n--- DIMENSÕES ---\n${dims}\n\n--- SUGESTÕES ---\n${suggestions}\n\n--- TEXTO ORIGINAL ---\n${originalContent}`;
    navigator.clipboard.writeText(report);
    setCopied(true);
    toast.success("Relatório copiado!");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-col -m-4 sm:-m-6 lg:-m-8">
      {/* Banner */}
      <div className="relative w-full h-48 md:h-56 flex-shrink-0 overflow-hidden">
        <PageBreadcrumb items={[{ label: "Análise de Repercussão", href: "/repercussion" }, { label: "Resultado" }]} variant="overlay" />
        <img src={createBanner} alt="" className="w-full h-full object-cover object-[center_55%]" loading="lazy" />
        <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-background/20 to-transparent" />
      </div>

      <main className="px-4 sm:px-6 lg:px-8 -mt-10 pb-8 space-y-6 max-w-4xl mx-auto w-full">
        {/* Classification Hero Card */}
        <Card className={`rounded-2xl shadow-lg border ${config.bg}`}>
          <CardContent className="p-6 flex flex-col md:flex-row items-start md:items-center gap-4">
            <div className={`p-4 rounded-2xl ${config.bg}`}>
              <ClassificationIcon className={`h-10 w-10 ${config.color}`} />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <Badge className={config.badgeClass}>{config.label}</Badge>
                <span className="text-sm font-bold text-muted-foreground">Score médio: {avgScore}/5</span>
              </div>
              <p className="text-sm text-muted-foreground">{analysis.resumo}</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleCopyReport}>
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Dimensions */}
        <Card className="rounded-2xl shadow-lg border-0">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Activity className="h-5 w-5 text-primary" />
              Dimensões de Avaliação
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {Object.entries(analysis.dimensoes).map(([key, dim]) => (
              <ScoreBar
                key={key}
                score={dim.score}
                label={dimensionLabels[key]?.label || key}
                icon={dimensionLabels[key]?.icon || "📊"}
                justificativa={dim.justificativa}
              />
            ))}
          </CardContent>
        </Card>

        {/* Suggestions */}
        {analysis.sugestoes && analysis.sugestoes.length > 0 && (
          <Card className="rounded-2xl shadow-lg border-0">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Lightbulb className="h-5 w-5 text-amber-500" />
                Sugestões de Ajuste
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {analysis.sugestoes.map((s, i) => (
                <div key={i} className="p-4 rounded-xl bg-amber-50/50 dark:bg-amber-900/10 border border-amber-200/50">
                  <p className="text-xs font-semibold text-amber-600 mb-1">{s.dimensao}</p>
                  <p className="text-sm text-foreground">{s.sugestao}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Original Content */}
        {originalContent && (
          <Card className="rounded-2xl shadow-lg border-0">
            <CardHeader>
              <CardTitle className="text-lg">Texto Analisado</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
                {originalContent}
              </p>
            </CardContent>
          </Card>
        )}

        {/* Actions */}
        <div className="flex items-center justify-between">
          <Button variant="ghost" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar
          </Button>
          <Button onClick={() => navigate("/repercussion", { state: { content: originalContent } })}>
            <Activity className="h-4 w-4 mr-2" />
            Nova Análise
          </Button>
        </div>
      </main>
    </div>
  );
}
