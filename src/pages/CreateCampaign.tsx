import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useBrands } from "@/hooks/useBrands";
import { useThemes } from "@/hooks/useThemes";
import { usePersonas } from "@/hooks/usePersonas";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CREDIT_COSTS } from "@/lib/creditCosts";
import { PageBreadcrumb } from "@/components/PageBreadcrumb";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { NativeSelect } from "@/components/ui/native-select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Loader2, Sparkles, Zap, Target, Megaphone, FileText,
  ImageIcon, HelpCircle, Coins,
} from "lucide-react";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import createBanner from "@/assets/create-banner.jpg";

const POLITICAL_TONES = [
  { value: "combativo", label: "Combativo — urgência e força" },
  { value: "didatico", label: "Didático — dados e clareza" },
  { value: "emocional", label: "Emocional — conexão humana" },
  { value: "institucional", label: "Institucional — estabilidade" },
];

const PLATFORM_OPTIONS = [
  { value: "instagram", label: "Instagram" },
  { value: "facebook", label: "Facebook" },
  { value: "twitter", label: "Twitter/X" },
  { value: "linkedin", label: "LinkedIn" },
  { value: "youtube", label: "YouTube" },
  { value: "tiktok", label: "TikTok" },
];

const OBJECTIVE_OPTIONS = [
  { value: "engajamento", label: "Engajamento e visibilidade" },
  { value: "mobilizacao", label: "Mobilização e ação" },
  { value: "prestacao_contas", label: "Prestação de contas" },
  { value: "defesa", label: "Defesa e resposta a crise" },
  { value: "propositivo", label: "Propositivo — apresentar soluções" },
];

export default function CreateCampaign() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const brandsQuery = useBrands();
  const themesQuery = useThemes();
  const personasQuery = usePersonas();
  const [isGenerating, setIsGenerating] = useState(false);

  const brands = brandsQuery.data || [];
  const themes = themesQuery.data || [];
  const personas = personasQuery.data || [];

  const [formData, setFormData] = useState({
    brand: "",
    theme: "",
    persona: "",
    objective: "",
    platform: "instagram",
    politicalTone: "institucional",
    description: "",
    additionalInfo: "",
  });

  // Auto-select single brand

  const filteredThemes = themes.filter((t) => !formData.brand || t.brand_id === formData.brand);
  const filteredPersonas = personas.filter((p) => !formData.brand || p.brand_id === formData.brand);

  // Auto-select single brand
  React.useEffect(() => {
    if (!brandsQuery.isLoading && brands.length > 0 && !formData.brand) {
      setFormData(prev => ({ ...prev, brand: brands[0].id }));
    }
  }, [brandsQuery.isLoading, brands, formData.brand]);

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleGenerate = async () => {
    if (!user) return toast.error("Usuário não encontrado.");
    if (!formData.brand) return toast.error("Cadastre uma Identidade primeiro.");
    if (!formData.description.trim()) return toast.error("Descreva o contexto da campanha.");

    const credits = user.credits || 0;
    if (credits < CREDIT_COSTS.CAMPAIGN_PACKAGE) {
      return toast.error(`Créditos insuficientes. Necessário: ${CREDIT_COSTS.CAMPAIGN_PACKAGE}, disponível: ${credits}`);
    }

    setIsGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-campaign", {
        body: {
          brandId: formData.brand,
          themeId: formData.theme || null,
          personaId: formData.persona || null,
          objective: formData.objective,
          platform: formData.platform,
          description: formData.description,
          politicalTone: formData.politicalTone,
          additionalInfo: formData.additionalInfo,
        },
      });

      if (error) throw error;
      if (data?.error) {
        toast.error(data.error);
        return;
      }

      navigate("/campaign-result", {
        state: {
          campaignPackage: data.package,
          creditsUsed: data.creditsUsed,
          creditsRemaining: data.creditsRemaining,
        },
      });
    } catch (err: any) {
      console.error("Campaign generation error:", err);
      toast.error(err.message || "Erro ao gerar pacote de campanha.");
    } finally {
      setIsGenerating(false);
    }
  };

  const isLoading = brandsQuery.isLoading || themesQuery.isLoading || personasQuery.isLoading;

  const brandOptions = brands.map((b) => ({ value: b.id, label: b.name }));
  const themeOptions = filteredThemes.map((t) => ({ value: t.id, label: t.title }));
  const personaOptions = filteredPersonas.map((p) => ({ value: p.id, label: p.name }));

  return (
    <div className="flex flex-col -m-4 sm:-m-6 lg:-m-8">
      {/* Banner */}
      <div className="relative w-full h-56 md:h-64 lg:h-72 flex-shrink-0 overflow-hidden">
        <PageBreadcrumb items={[{ label: "Criar Conteúdo", href: "/create" }, { label: "Pacote de Campanha" }]} variant="overlay" />
        <img src={createBanner} alt="" className="w-full h-full object-cover object-[center_55%]" loading="lazy" />
        <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-background/20 to-transparent" />
      </div>

      {/* Header */}
      <div className="relative px-4 sm:px-6 lg:px-8 -mt-12 flex-shrink-0">
        <div className="bg-card rounded-2xl shadow-lg p-4 lg:p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="bg-primary/10 border border-primary/20 shadow-sm rounded-2xl p-3 lg:p-4">
              <Megaphone className="h-8 w-8 lg:h-10 lg:w-10 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl lg:text-3xl font-bold text-foreground flex items-center gap-2">
                Pacote de Campanha
                <Popover>
                  <PopoverTrigger asChild>
                    <button className="text-muted-foreground hover:text-foreground transition-colors">
                      <HelpCircle className="h-5 w-5" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-80 text-sm" side="bottom" align="start">
                    <div className="space-y-2">
                      <h4 className="font-semibold">O que é gerado?</h4>
                      <ul className="text-muted-foreground space-y-1 list-disc list-inside text-xs">
                        <li>10 micro-narrativas com briefing visual</li>
                        <li>2 propostas de ação com custo político</li>
                        <li>2 discursos para eventos</li>
                        <li>3 anúncios (vídeo, carrossel, banner)</li>
                      </ul>
                    </div>
                  </PopoverContent>
                </Popover>
              </h1>
              <p className="text-sm lg:text-base text-muted-foreground">Gere um pacote completo de comunicação política</p>
            </div>
          </div>
          {user && (
            <Card className="bg-gradient-to-br from-primary/10 to-secondary/10 border-primary/30 flex-shrink-0">
              <CardContent className="p-3">
                <div className="flex items-center gap-4">
                  <div className="relative">
                    <div className="absolute inset-0 bg-gradient-to-r from-primary to-secondary rounded-full blur-sm opacity-40" />
                    <div className="relative bg-gradient-to-r from-primary to-secondary text-white rounded-full p-2">
                      <Zap className="h-4 w-4" />
                    </div>
                  </div>
                  <div className="text-left gap-4 flex items-center">
                    <span className="text-xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">{user.credits || 0}</span>
                    <p className="text-xs text-muted-foreground font-medium">Créditos</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Form */}
      <main className="px-4 sm:px-6 lg:px-8 pt-4 pb-8 flex-1">
        <div className="max-w-2xl mx-auto space-y-6">
          {/* Brand auto-selected */}

          {/* Agenda + Audiência */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Agenda</Label>
              <NativeSelect
                options={themeOptions}
                placeholder="Opcional"
                value={formData.theme}
                onValueChange={(v) => handleChange("theme", v)}
                disabled={false}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">Audiência</Label>
              <NativeSelect
                options={personaOptions}
                placeholder="Opcional"
                value={formData.persona}
                onValueChange={(v) => handleChange("persona", v)}
                disabled={false}
              />
            </div>
          </div>

          {/* Tom + Plataforma */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Tom Político</Label>
              <NativeSelect
                options={POLITICAL_TONES}
                value={formData.politicalTone}
                onValueChange={(v) => handleChange("politicalTone", v)}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">Plataforma Principal</Label>
              <NativeSelect
                options={PLATFORM_OPTIONS}
                value={formData.platform}
                onValueChange={(v) => handleChange("platform", v)}
              />
            </div>
          </div>

          {/* Objetivo */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Objetivo da Campanha</Label>
            <NativeSelect
              options={OBJECTIVE_OPTIONS}
              placeholder="Selecione..."
              value={formData.objective}
              onValueChange={(v) => handleChange("objective", v)}
            />
          </div>

          {/* Descrição */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Contexto da Campanha *</Label>
            <Textarea
              value={formData.description}
              onChange={(e) => handleChange("description", e.target.value)}
              placeholder="Descreva o tema central, a situação política atual, o que motivou esta campanha..."
              rows={4}
              className="resize-none"
            />
          </div>

          {/* Info adicional */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Informações Adicionais</Label>
            <Textarea
              value={formData.additionalInfo}
              onChange={(e) => handleChange("additionalInfo", e.target.value)}
              placeholder="Dados, fatos, nomes, datas relevantes... (opcional)"
              rows={3}
              className="resize-none"
            />
          </div>

          {/* Entregas */}
          <Card className="bg-muted/30 border-dashed">
            <CardContent className="p-4 space-y-3">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Target className="h-4 w-4 text-primary" />
                O que será gerado:
              </h3>
              <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                <div className="flex items-center gap-2">
                  <FileText className="h-3.5 w-3.5 text-primary" />
                  <span>10 micro-narrativas</span>
                </div>
                <div className="flex items-center gap-2">
                  <Target className="h-3.5 w-3.5 text-primary" />
                  <span>2 propostas de ação</span>
                </div>
                <div className="flex items-center gap-2">
                  <Megaphone className="h-3.5 w-3.5 text-primary" />
                  <span>2 discursos para eventos</span>
                </div>
                <div className="flex items-center gap-2">
                  <ImageIcon className="h-3.5 w-3.5 text-primary" />
                  <span>3 anúncios (vídeo, carrossel, banner)</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Generate Button */}
          <Button
            onClick={handleGenerate}
            disabled={isGenerating || !formData.brand || !formData.description.trim()}
            className="w-full h-14 text-base font-semibold gap-3 rounded-xl"
            size="lg"
          >
            {isGenerating ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                Gerando Pacote de Campanha...
              </>
            ) : (
              <>
                <Sparkles className="h-5 w-5" />
                Gerar Pacote de Campanha
                <div className="flex items-center gap-1 text-xs opacity-80 ml-2 bg-white/20 rounded-full px-2 py-0.5">
                  <Coins className="h-3 w-3" />
                  {CREDIT_COSTS.CAMPAIGN_PACKAGE}
                </div>
              </>
            )}
          </Button>
        </div>
      </main>
    </div>
  );
}
