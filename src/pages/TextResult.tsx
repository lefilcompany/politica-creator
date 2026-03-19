import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageBreadcrumb } from "@/components/PageBreadcrumb";
import { Check, Copy, ImageIcon, RefreshCw, ArrowLeft, Type, Loader2, Sparkles, Download, Coins } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { CREDIT_COSTS } from "@/lib/creditCosts";
import { CreditConfirmationDialog } from "@/components/CreditConfirmationDialog";
import createBanner from "@/assets/create-banner.jpg";

interface TextOption {
  id: number;
  style: string;
  text: string;
  character_count?: number;
  best_for?: string;
  thesis_reference?: string;
}

interface GeneratedImage {
  textId: number;
  imageUrl: string;
  caption?: string;
}

export default function TextResult() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, refreshUserCredits } = useAuth();
  const state = location.state as {
    texts: TextOption[];
    originalMessage: string;
    brandId?: string;
    themeId?: string;
    personaId?: string;
    platform?: string;
    tone?: string;
  } | null;

  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [generatingId, setGeneratingId] = useState<number | null>(null);
  const [generatedImages, setGeneratedImages] = useState<GeneratedImage[]>([]);

  if (!state?.texts) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Type className="h-12 w-12 text-muted-foreground" />
        <p className="text-muted-foreground">Nenhum texto gerado. Volte e tente novamente.</p>
        <Button variant="outline" onClick={() => navigate("/create/text")}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Voltar
        </Button>
      </div>
    );
  }

  const handleCopy = async (text: string, id: number) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      toast.success("Texto copiado!");
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      toast.error("Erro ao copiar");
    }
  };

  const handleGenerateImage = async (text: string, textId: number) => {
    if (!user) return toast.error("Usuário não encontrado.");
    
    const availableCredits = user?.credits || 0;
    if (availableCredits < CREDIT_COSTS.COMPLETE_IMAGE) {
      return toast.error(`Créditos insuficientes. Necessário: ${CREDIT_COSTS.COMPLETE_IMAGE}, disponível: ${availableCredits}.`);
    }

    setGeneratingId(textId);
    const toastId = toast.loading("🎨 Gerando imagem com IA...", {
      description: "Isso pode levar alguns segundos...",
    });

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Sessão não encontrada");

      const requestData = {
        brandId: state.brandId || '',
        themeId: state.themeId || '',
        personaId: state.personaId || '',
        objective: text,
        description: text,
        platform: state.platform || '',
        contentType: 'organic',
        tone: state.tone ? [state.tone] : [],
        vibeStyle: 'professional',
        visualStyle: 'professional',
        fontStyle: 'modern',
        politicalTone: 'institucional',
        includeText: false,
        textContent: '',
        textPosition: 'center',
        preserveImages: [],
        styleReferenceImages: [],
        brandImagesCount: 0,
        userImagesCount: 0,
        teamId: user?.teamId || '',
        promptContext: `### DESCRIÇÃO VISUAL\n${text}`,
      };

      const imageResponse = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-image`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify(requestData),
        }
      );

      if (!imageResponse.ok) {
        const errorText = await imageResponse.text();
        throw new Error(`Erro ao gerar imagem: ${errorText}`);
      }

      const imageResult = await imageResponse.json();
      
      setGeneratedImages(prev => [
        ...prev.filter(g => g.textId !== textId),
        { textId, imageUrl: imageResult.imageUrl },
      ]);

      if (refreshUserCredits) await refreshUserCredits();

      toast.success("✅ Imagem gerada com sucesso!", {
        id: toastId,
        duration: 3000,
      });
    } catch (err: any) {
      console.error("Erro ao gerar imagem:", err);
      toast.error("Erro ao gerar imagem", {
        id: toastId,
        description: err.message || "Tente novamente.",
      });
    } finally {
      setGeneratingId(null);
    }
  };

  const handleDownloadImage = async (imageUrl: string) => {
    try {
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `imagem-gerada-${Date.now()}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      toast.success("Download iniciado!");
    } catch {
      toast.error("Erro ao baixar imagem");
    }
  };

  const handleRefine = () => {
    navigate("/create/text", {
      state: {
        prefillMessage: state.originalMessage,
        brandId: state.brandId,
        themeId: state.themeId,
        personaId: state.personaId,
        platform: state.platform,
        tone: state.tone,
      },
    });
  };

  const styleColors: Record<string, string> = {
    formal: "bg-blue-500/15 text-blue-700 border-blue-500/30",
    informal: "bg-green-500/15 text-green-700 border-green-500/30",
    emotivo: "bg-rose-500/15 text-rose-700 border-rose-500/30",
    "didático": "bg-cyan-500/15 text-cyan-700 border-cyan-500/30",
    combativo: "bg-red-500/15 text-red-700 border-red-500/30",
    institucional: "bg-indigo-500/15 text-indigo-700 border-indigo-500/30",
    narrativo: "bg-purple-500/15 text-purple-700 border-purple-500/30",
    inspirador: "bg-amber-500/15 text-amber-700 border-amber-500/30",
    urgente: "bg-orange-500/15 text-orange-700 border-orange-500/30",
    "comunitário": "bg-teal-500/15 text-teal-700 border-teal-500/30",
  };

  const getStyleColor = (style: string) => {
    const lower = style.toLowerCase();
    for (const [key, val] of Object.entries(styleColors)) {
      if (lower.includes(key)) return val;
    }
    return "bg-muted text-muted-foreground";
  };

  const getGeneratedImage = (textId: number) => generatedImages.find(g => g.textId === textId);

  return (
    <div className="flex flex-col -m-4 sm:-m-6 lg:-m-8">
      {/* Banner */}
      <div className="relative w-full h-48 md:h-56 flex-shrink-0 overflow-hidden">
        <PageBreadcrumb
          items={[
            { label: "Criar Conteúdo", href: "/create" },
            { label: "Criar Texto", href: "/create/text" },
            { label: "Resultados" },
          ]}
          variant="overlay"
        />
        <img src={createBanner} alt="" className="w-full h-full object-cover object-[center_55%]" loading="lazy" />
        <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-background/20 to-transparent" />
      </div>

      {/* Header */}
      <div className="relative px-4 sm:px-6 lg:px-8 -mt-10 flex-shrink-0">
        <div className="bg-card rounded-2xl shadow-lg p-4 lg:p-5">
          <div className="flex items-center gap-4">
            <div className="bg-primary/10 border border-primary/20 rounded-2xl p-3">
              <Type className="h-8 w-8 text-primary" />
            </div>
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-foreground">10 Opções de Texto</h1>
              <p className="text-sm text-muted-foreground">
                Escolha, copie ou gere uma imagem diretamente
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleRefine} className="gap-1.5">
                <RefreshCw className="h-4 w-4" /> Gerar novamente
              </Button>
              <Button variant="outline" size="sm" onClick={() => navigate("/create")} className="gap-1.5">
                <ArrowLeft className="h-4 w-4" /> Voltar
              </Button>
            </div>
          </div>
          {/* Original message */}
          <div className="mt-3 p-3 bg-muted/50 rounded-xl">
            <p className="text-xs font-medium text-muted-foreground mb-1">Sua ideia original:</p>
            <p className="text-sm text-foreground italic">"{state.originalMessage}"</p>
          </div>
        </div>
      </div>

      {/* Text cards */}
      <main className="px-4 sm:px-6 lg:px-8 pt-6 pb-8 max-w-4xl mx-auto w-full">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {state.texts.map((item) => {
            const generated = getGeneratedImage(item.id);
            const isGenerating = generatingId === item.id;

            return (
              <Card
                key={item.id}
                className={`border shadow-sm hover:shadow-md transition-all duration-200 rounded-2xl cursor-pointer ${
                  selectedId === item.id ? "ring-2 ring-primary border-primary" : ""
                }`}
                onClick={() => setSelectedId(selectedId === item.id ? null : item.id)}
              >
                <CardContent className="p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <Badge variant="outline" className={`text-xs ${getStyleColor(item.style)}`}>
                      {item.style}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      #{item.id}
                    </span>
                  </div>

                  <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                    {item.text}
                  </p>

                  {item.thesis_reference && (
                    <p className="text-xs text-primary/80 italic">
                      📖 {item.thesis_reference}
                    </p>
                  )}

                  {item.best_for && (
                    <p className="text-xs text-muted-foreground">
                      📌 Ideal para: {item.best_for}
                    </p>
                  )}

                  {/* Generated image inline */}
                  {generated && (
                    <div className="relative rounded-xl overflow-hidden border bg-muted/30">
                      <img
                        src={generated.imageUrl}
                        alt="Imagem gerada"
                        className="w-full h-auto rounded-xl"
                      />
                      <div className="absolute top-2 right-2">
                        <Button
                          variant="default"
                          size="sm"
                          className="h-9 gap-2 text-xs font-semibold shadow-lg backdrop-blur-md bg-primary/90 hover:bg-primary text-primary-foreground rounded-xl px-4 transition-all duration-200 hover:scale-105 hover:shadow-xl"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDownloadImage(generated.imageUrl);
                          }}
                        >
                          <Download className="h-4 w-4" /> Baixar imagem
                        </Button>
                      </div>
                      <div className="absolute bottom-2 left-2">
                        <Badge className="bg-green-600/90 text-white text-xs backdrop-blur-sm">
                          <Check className="h-3 w-3 mr-1" /> Gerada
                        </Badge>
                      </div>
                    </div>
                  )}

                  <div className="flex gap-2 pt-1">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 gap-1.5 text-xs"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCopy(item.text, item.id);
                      }}
                    >
                      {copiedId === item.id ? (
                        <><Check className="h-3.5 w-3.5" /> Copiado</>
                      ) : (
                        <><Copy className="h-3.5 w-3.5" /> Copiar</>
                      )}
                    </Button>
                    <Button
                      variant={generated ? "outline" : "default"}
                      size="sm"
                      className="flex-1 gap-1.5 text-xs"
                      disabled={isGenerating}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleGenerateImage(item.text, item.id);
                      }}
                    >
                      {isGenerating ? (
                        <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Gerando...</>
                      ) : generated ? (
                        <><RefreshCw className="h-3.5 w-3.5" /> Gerar nova</>
                      ) : (
                        <>
                          <Sparkles className="h-3.5 w-3.5" /> Gerar Imagem
                          <Badge variant="secondary" className="ml-1 text-[10px] px-1 py-0">
                            <Coins className="h-2.5 w-2.5 mr-0.5" />
                            {CREDIT_COSTS.COMPLETE_IMAGE}
                          </Badge>
                        </>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </main>
    </div>
  );
}
