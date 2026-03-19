import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Loader2, Type, Zap, Send } from "lucide-react";
import { PageBreadcrumb } from "@/components/PageBreadcrumb";
import { CREDIT_COSTS } from "@/lib/creditCosts";
import { useAuth } from "@/hooks/useAuth";
import { useBrands } from "@/hooks/useBrands";
import { useThemes } from "@/hooks/useThemes";
import { usePersonas } from "@/hooks/usePersonas";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import createBanner from "@/assets/create-banner.jpg";

export default function CreateText() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: brands, isLoading: brandsLoading } = useBrands();
  const { data: themes, isLoading: themesLoading } = useThemes();
  const { data: personas, isLoading: personasLoading } = usePersonas();

  const [message, setMessage] = useState("");
  const [brandId, setBrandId] = useState<string>("");

  // Auto-select single brand
  useEffect(() => {
    if (!brandsLoading && brands && brands.length > 0 && !brandId) {
      setBrandId(brands[0].id);
    }
  }, [brandsLoading, brands, brandId]);
  const [themeId, setThemeId] = useState<string>("");
  const [personaId, setPersonaId] = useState<string>("");
  const [platform, setPlatform] = useState<string>("");
  const [tone, setTone] = useState<string>("");
  const [isGenerating, setIsGenerating] = useState(false);

  const isLoading = brandsLoading || themesLoading || personasLoading;
  const canSubmit = message.trim().length >= 5 && !isGenerating;

  const handleGenerate = async () => {
    if (!canSubmit) return;

    setIsGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-text", {
        body: {
          message: message.trim(),
          brandId: brandId || undefined,
          themeId: themeId || undefined,
          personaId: personaId || undefined,
          platform: platform || undefined,
          tone: tone || undefined,
          selectedThesis: selectedThesisId ? getThesisById(selectedThesisId) : undefined,
        },
      });

      if (error) throw error;
      if (data?.error) {
        toast.error(data.error);
        return;
      }

      navigate("/text-result", {
        state: {
          texts: data.texts,
          originalMessage: message.trim(),
          brandId,
          themeId,
          personaId,
          platform,
          tone,
        },
      });
    } catch (err: any) {
      console.error("Error generating text:", err);
      toast.error(err.message || "Erro ao gerar textos");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="flex flex-col -m-4 sm:-m-6 lg:-m-8">
      {/* Banner */}
      <div className="relative w-full h-56 md:h-64 lg:h-72 flex-shrink-0 overflow-hidden">
        <PageBreadcrumb
          items={[{ label: "Criar Conteúdo", href: "/create" }, { label: "Criar Texto" }]}
          variant="overlay"
        />
        <img src={createBanner} alt="" className="w-full h-full object-cover object-[center_55%]" loading="lazy" />
        <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-background/20 to-transparent" />
      </div>

      {/* Header */}
      <div className="relative px-4 sm:px-6 lg:px-8 -mt-12 flex-shrink-0">
        <div className="bg-card rounded-2xl shadow-lg p-4 lg:p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="bg-primary/10 border border-primary/20 shadow-sm rounded-2xl p-3 lg:p-4">
              <Type className="h-8 w-8 lg:h-10 lg:w-10 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl lg:text-3xl font-bold text-foreground">Criar Texto</h1>
              <p className="text-sm lg:text-base text-muted-foreground">
                Diga o que você quer falar — a IA gera 10 opções profissionais
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
      <main className="px-4 sm:px-6 lg:px-8 pt-6 pb-8 flex-1 max-w-3xl mx-auto w-full">
        <Card className="border-0 shadow-lg rounded-2xl">
          <CardContent className="p-6 space-y-6">
            {/* Main textarea */}
            <div className="space-y-2">
              <label className="text-base font-semibold text-foreground">
                💬 Diga o que você quer falar com seu futuro eleitor
              </label>
              <p className="text-sm text-muted-foreground">
                Escreva sua ideia, mensagem ou tema. Pode ser informal — a IA vai transformar em 10 textos profissionais.
              </p>
              <Textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Ex: Quero falar sobre as melhorias na saúde pública da minha cidade, como a reforma do hospital e a chegada de novos médicos..."
                className="min-h-[140px] text-base"
                maxLength={2000}
              />
              <p className="text-xs text-muted-foreground text-right">{message.length}/2000</p>
            </div>

            {/* Thesis selector */}
            <ThesisSelector
              selectedThesisId={selectedThesisId}
              onSelect={setSelectedThesisId}
              recommendedThesesIds={recommendedThesesIds}
            />

            {/* Optional selectors */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Brand auto-selected */}


              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">Persona (opcional)</label>
                {isLoading ? (
                  <Skeleton className="h-10 w-full" />
                ) : (
                  <Select value={personaId} onValueChange={setPersonaId}>
                    <SelectTrigger><SelectValue placeholder="Selecionar persona" /></SelectTrigger>
                    <SelectContent>
                      {personas?.map((p: any) => (
                        <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">Plataforma (opcional)</label>
                <Select value={platform} onValueChange={setPlatform}>
                  <SelectTrigger><SelectValue placeholder="Selecionar plataforma" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="instagram">Instagram</SelectItem>
                    <SelectItem value="whatsapp">WhatsApp</SelectItem>
                    <SelectItem value="facebook">Facebook</SelectItem>
                    <SelectItem value="twitter">Twitter/X</SelectItem>
                    <SelectItem value="linkedin">LinkedIn</SelectItem>
                    <SelectItem value="tiktok">TikTok</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Tom desejado (opcional)</label>
              <Select value={tone} onValueChange={setTone}>
                <SelectTrigger><SelectValue placeholder="A IA vai gerar vários tons automaticamente" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="combativo">Combativo</SelectItem>
                  <SelectItem value="emocional">Emocional</SelectItem>
                  <SelectItem value="didatico">Didático</SelectItem>
                  <SelectItem value="institucional">Institucional</SelectItem>
                  <SelectItem value="inspirador">Inspirador</SelectItem>
                  <SelectItem value="informal">Informal / Próximo</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Submit */}
            <Button
              onClick={handleGenerate}
              disabled={!canSubmit}
              className="w-full h-12 text-base font-semibold gap-2"
              size="lg"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Gerando 10 textos...
                </>
              ) : (
                <>
                  <Send className="h-5 w-5" />
                  Gerar Textos — {CREDIT_COSTS.GENERATE_TEXT} créditos
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
