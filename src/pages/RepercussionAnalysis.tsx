import React, { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Activity, Zap, ArrowLeft, Coins, HelpCircle } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useBrands } from "@/hooks/useBrands";
import { supabase } from "@/integrations/supabase/client";
import { CREDIT_COSTS } from "@/lib/creditCosts";
import { PageBreadcrumb } from "@/components/PageBreadcrumb";
import { CreditConfirmationDialog } from "@/components/CreditConfirmationDialog";
import createBanner from "@/assets/defense-banner.jpg";

export default function RepercussionAnalysis() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, refreshUserCredits } = useAuth();
  const { data: brands } = useBrands();
  const [content, setContent] = useState(location.state?.content || "");
  const [brandId, setBrandId] = useState(location.state?.brandId || "");
  const [context, setContext] = useState("");

  // Auto-select single brand
  React.useEffect(() => {
    if (brands && brands.length > 0 && !brandId) {
      setBrandId(brands[0].id);
    }
  }, [brands, brandId]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showCreditDialog, setShowCreditDialog] = useState(false);

  const handleAnalyze = async () => {
    if (!content || content.trim().length < 20) {
      toast.error("O texto precisa ter pelo menos 20 caracteres.");
      return;
    }
    setShowCreditDialog(true);
  };

  const handleConfirmAnalysis = async () => {
    setShowCreditDialog(false);
    setIsAnalyzing(true);

    try {
      const { data, error } = await supabase.functions.invoke("analyze-repercussion", {
        body: {
          content: content.trim(),
          brandId: brandId || null,
          context: context || null,
        },
      });

      if (error) throw error;
      if (data?.error) {
        if (data.required && data.available !== undefined) {
          toast.error(`Créditos insuficientes. Necessário: ${data.required}, disponível: ${data.available}`);
        } else {
          toast.error(data.error);
        }
        return;
      }

      await refreshUserCredits();

      navigate("/repercussion-result", {
        state: {
          analysis: data.analysis,
          originalContent: content,
          creditsUsed: data.creditsUsed,
          creditsRemaining: data.creditsRemaining,
        },
      });
    } catch (err: any) {
      console.error("Analysis error:", err);
      toast.error(err.message || "Erro ao analisar conteúdo");
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="flex flex-col -m-4 sm:-m-6 lg:-m-8">
      {/* Banner */}
      <div className="relative w-full h-56 md:h-64 lg:h-72 flex-shrink-0 overflow-hidden">
        <PageBreadcrumb items={[{ label: "Análise de Repercussão" }]} variant="overlay" />
        <img src={createBanner} alt="" className="w-full h-full object-cover object-[center_55%]" loading="lazy" />
        <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-background/20 to-transparent" />
      </div>

      {/* Header Card */}
      <div className="relative px-4 sm:px-6 lg:px-8 -mt-12 flex-shrink-0">
        <div className="bg-card rounded-2xl shadow-lg p-4 lg:p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="bg-orange-500/10 border border-orange-500/20 shadow-sm rounded-2xl p-3 lg:p-4">
              <Activity className="h-8 w-8 lg:h-10 lg:w-10 text-orange-500" />
            </div>
            <div>
              <h1 className="text-2xl lg:text-3xl font-bold text-foreground flex items-center gap-2">
                Análise de Repercussão
                <Popover>
                  <PopoverTrigger asChild>
                    <button className="text-muted-foreground hover:text-foreground transition-colors">
                      <HelpCircle className="h-5 w-5" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-80 text-sm" side="bottom" align="start">
                    <div className="space-y-2">
                      <h4 className="font-semibold">Como funciona?</h4>
                      <p className="text-muted-foreground">
                        A IA avalia seu conteúdo em 5 dimensões e classifica sua probabilidade
                        de repercussão como: substância positiva, risco negativo ou ruído efêmero.
                      </p>
                      <ul className="text-muted-foreground space-y-1 list-disc list-inside text-xs">
                        <li>Substância Pública (dado, entrega, proposta)</li>
                        <li>Conexão Local (território, problema real)</li>
                        <li>Novidade Legítima (fato novo, ângulo original)</li>
                        <li>Polarização e Risco (linguagem, acusações)</li>
                        <li>Aderência ao "Quem É" (coerência com perfil)</li>
                      </ul>
                    </div>
                  </PopoverContent>
                </Popover>
              </h1>
              <p className="text-sm lg:text-base text-muted-foreground">
                Avalie a probabilidade de repercussão com substância do seu conteúdo
              </p>
            </div>
          </div>

          {user && (
            <Card className="bg-gradient-to-br from-primary/10 to-secondary/10 border-primary/30 flex-shrink-0">
              <CardContent className="p-3">
                <div className="flex items-center justify-center gap-4">
                  <div className="relative">
                    <div className="absolute inset-0 bg-gradient-to-r from-primary to-secondary rounded-full blur-sm opacity-40" />
                    <div className="relative bg-gradient-to-r from-primary to-secondary text-white rounded-full p-2">
                      <Zap className="h-4 w-4" />
                    </div>
                  </div>
                  <div className="text-left gap-4 flex justify-center items-center">
                    <span className="text-xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                      {user.credits || 0}
                    </span>
                    <p className="text-xs text-muted-foreground font-medium leading-tight">Créditos</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Form */}
      <main className="px-4 sm:px-6 lg:px-8 pt-4 pb-4 sm:pb-6 lg:pb-8 flex-1">
        <div className="max-w-3xl mx-auto space-y-6">
          <Card className="rounded-2xl shadow-lg border-0">
            <CardContent className="p-6 space-y-5">
              <div className="space-y-2">
                <Label htmlFor="content" className="text-base font-semibold">
                  Texto para análise *
                </Label>
                <Textarea
                  id="content"
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Cole aqui o texto da postagem, discurso, legenda ou conteúdo que deseja analisar..."
                  rows={8}
                  className="resize-none"
                />
                <p className="text-xs text-muted-foreground">
                  {content.length} caracteres {content.length < 20 && content.length > 0 && "— mínimo 20"}
                </p>
              </div>

              {/* Brand auto-selected */}

              <div className="space-y-2">
                <Label htmlFor="context" className="text-base font-semibold">
                  Contexto adicional (opcional)
                </Label>
                <Textarea
                  id="context"
                  value={context}
                  onChange={(e) => setContext(e.target.value)}
                  placeholder="Ex: 'Este texto será postado após a inauguração da UPA no bairro X' ou 'Resposta a uma fake news que circulou ontem'"
                  rows={3}
                  className="resize-none"
                />
              </div>

              <div className="flex items-center justify-between pt-2">
                <Button variant="ghost" onClick={() => navigate(-1)}>
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Voltar
                </Button>
                <Button
                  onClick={handleAnalyze}
                  disabled={isAnalyzing || content.trim().length < 20}
                  className="bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white"
                >
                  {isAnalyzing ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Analisando...
                    </>
                  ) : (
                    <>
                      <Activity className="h-4 w-4 mr-2" />
                      Analisar Repercussão
                      <span className="ml-2 text-xs opacity-80">
                        ({CREDIT_COSTS.ANALYZE_REPERCUSSION} créditos)
                      </span>
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>

      <CreditConfirmationDialog
        isOpen={showCreditDialog}
        onOpenChange={setShowCreditDialog}
        onConfirm={handleConfirmAnalysis}
        cost={CREDIT_COSTS.ANALYZE_REPERCUSSION}
        resourceType="Análise de Repercussão"
        currentBalance={user?.credits || 0}
      />
    </div>
  );
}
