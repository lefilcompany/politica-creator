import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { NativeSelect } from "@/components/ui/native-select";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Loader2, Sparkles, Zap, Video, Coins, Info, ImagePlus, X, HelpCircle } from "lucide-react";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CREDIT_COSTS } from "@/lib/creditCosts";
import { toast } from "sonner";
import type { BrandSummary } from "@/types/brand";
import type { StrategicThemeSummary } from "@/types/theme";
import type { PersonaSummary } from "@/types/persona";
import { useAuth } from "@/hooks/useAuth";
import { TourSelector } from "@/components/onboarding/TourSelector";
import { navbarSteps } from "@/components/onboarding/tourSteps";
import { PageBreadcrumb } from "@/components/PageBreadcrumb";

import createBanner from "@/assets/create-banner.jpg";

interface FormData {
  brand: string;
  theme: string;
  persona: string;
  objective: string;
  platform: string;
  description: string;
  tone: string[];
  additionalInfo: string;
  videoGenerationType: 'text_to_video' | 'image_to_video';
  videoAudioStyle: 'dialogue' | 'sound_effects' | 'music' | 'none';
  videoVisualStyle: 'cinematic' | 'animation' | 'realistic' | 'creative';
  videoAspectRatio: '16:9' | '9:16';
  videoResolution: '720p' | '1080p';
  videoDuration: number;
  videoModel: 'sora';
}

const toneOptions = ["inspirador", "motivacional", "profissional", "casual", "elegante", "moderno", "tradicional", "divertido", "sério"];

export default function CreateVideo() {
  const { user, session, refreshUserCredits } = useAuth();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [formData, setFormData] = useState<FormData>({
    brand: "",
    theme: "",
    persona: "",
    objective: "",
    platform: "",
    description: "",
    tone: [],
    additionalInfo: "",
    videoGenerationType: 'text_to_video',
    videoAudioStyle: 'sound_effects',
    videoVisualStyle: 'cinematic',
    videoAspectRatio: '9:16',
    videoResolution: '1080p',
    videoDuration: 5,
    videoModel: 'sora',
  });

  const [loading, setLoading] = useState<boolean>(false);
  const [referenceImage, setReferenceImage] = useState<string | null>(null);
  const [referenceImageFile, setReferenceImageFile] = useState<File | null>(null);
  

  // React Query for brands, themes, personas
  const userId = user?.id;

  const { data: brands = [], isLoading: loadingBrands } = useQuery({
    queryKey: ['brands', userId],
    queryFn: async () => {
      if (!userId) return [];
      const { data, error } = await supabase
        .from('brands')
        .select('id, name, responsible, created_at, updated_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []).map((b: any) => ({
        id: b.id, name: b.name, responsible: b.responsible,
        brandColor: null, avatarUrl: null, createdAt: b.created_at, updatedAt: b.updated_at,
      })) as BrandSummary[];
    },
    enabled: !!userId,
    staleTime: 1000 * 60 * 5,
  });

  const { data: themes = [], isLoading: loadingThemes } = useQuery({
    queryKey: ['themes', userId],
    queryFn: async () => {
      if (!userId) return [];
      const { data, error } = await supabase
        .from('strategic_themes')
        .select('id, brand_id, title, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []).map((t: any) => ({
        id: t.id, brandId: t.brand_id, title: t.title, createdAt: t.created_at,
      })) as StrategicThemeSummary[];
    },
    enabled: !!userId,
    staleTime: 1000 * 60 * 5,
  });

  const { data: personas = [], isLoading: loadingPersonas } = useQuery({
    queryKey: ['personas', userId],
    queryFn: async () => {
      if (!userId) return [];
      const { data, error } = await supabase
        .from('personas')
        .select('id, brand_id, name, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []).map((p: any) => ({
        id: p.id, brandId: p.brand_id, name: p.name, createdAt: p.created_at,
      })) as PersonaSummary[];
    },
    enabled: !!userId,
    staleTime: 1000 * 60 * 5,
  });

  const isLoadingData = loadingBrands || loadingThemes || loadingPersonas;

  // Filtered themes/personas based on brand
  const filteredThemes = formData.brand ? themes.filter((t) => t.brandId === formData.brand) : [];
  const filteredPersonas = formData.brand ? personas.filter((p) => p.brandId === formData.brand) : [];

  // Redimensionar imagem para resolução exata (necessário para Sora 2)
  const resizeImageToDataUrl = (dataUrl: string, targetWidth: number, targetHeight: number): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = targetWidth;
        canvas.height = targetHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject(new Error('Canvas not supported'));
        ctx.drawImage(img, 0, 0, targetWidth, targetHeight);
        resolve(canvas.toDataURL('image/jpeg', 0.92));
      };
      img.onerror = reject;
      img.src = dataUrl;
    });
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error("Por favor, selecione um arquivo de imagem válido.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error("A imagem deve ter no máximo 10MB.");
      return;
    }
    setReferenceImageFile(file);
    const reader = new FileReader();
    reader.onload = (event) => {
      setReferenceImage(event.target?.result as string);
      setFormData(prev => ({ ...prev, videoGenerationType: 'image_to_video' }));
    };
    reader.readAsDataURL(file);
  };

  const removeReferenceImage = () => {
    setReferenceImage(null);
    setReferenceImageFile(null);
    setFormData(prev => ({ ...prev, videoGenerationType: 'text_to_video' }));
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleGenerateVideo = async () => {
    if (!user) return toast.error("Usuário não encontrado.");
    if (!formData.objective || !formData.description || formData.tone.length === 0) {
      return toast.error("Preencha todos os campos obrigatórios.");
    }

    // Check credits
    const requiredCredits = CREDIT_COSTS.VIDEO_GENERATION;
    if ((user.credits || 0) < requiredCredits) {
      return toast.error(`Créditos insuficientes. Você precisa de ${requiredCredits} créditos para gerar um vídeo.`);
    }

    setLoading(true);
    const toastId = toast.loading("Iniciando geração de vídeo...");

    try {
      const videoPrompt = `${formData.objective}. ${formData.description}. Tom: ${formData.tone.join(", ")}.`;
      
      const { data: actionData } = await supabase.from('actions').insert({
        type: 'GERAR_VIDEO',
        brand_id: formData.brand || null,
        team_id: user?.teamId,
        user_id: user?.id,
        status: 'pending',
        details: {
          prompt: videoPrompt,
          objective: formData.objective,
          platform: formData.platform,
          tone: formData.tone,
          audioStyle: formData.videoAudioStyle,
          visualStyle: formData.videoVisualStyle,
          aspectRatio: formData.videoAspectRatio,
          resolution: formData.videoResolution,
          duration: formData.videoDuration,
          hasReferenceImage: !!referenceImage,
        }
      }).select().single();

      if (!actionData?.id) {
        throw new Error("Não foi possível iniciar a geração (ação não registrada).");
      }

      let preserveImages: string[] = [];
      if (referenceImage) {
        // Sora 2 exige que a imagem tenha exatamente a resolução do vídeo
        const [w, h] = formData.videoAspectRatio === '9:16' ? [720, 1280] : [1280, 720];
        const resized = await resizeImageToDataUrl(referenceImage, w, h);
        preserveImages = [resized];
      }

      const { data: responseData, error: invokeError } = await supabase.functions.invoke('generate-video', {
        body: {
          prompt: videoPrompt,
          generationType: referenceImage ? 'image_to_video' : 'text_to_video',
          actionId: actionData.id,
          audioStyle: formData.videoAudioStyle,
          visualStyle: formData.videoVisualStyle,
          aspectRatio: formData.videoAspectRatio,
          resolution: formData.videoResolution,
          duration: formData.videoDuration,
          preserveImages,
          videoModel: formData.videoModel,
        },
      });

      try { await refreshUserCredits(); } catch { /* noop */ }

      if (invokeError) {
        console.error('Erro ao chamar generate-video:', invokeError);
        toast.error(invokeError.message || "Erro ao iniciar geração de vídeo", { id: toastId });
        return;
      }

      if (!responseData || responseData.status === 'failed') {
        toast.error(responseData?.error || "Erro ao iniciar geração de vídeo", { id: toastId });
        return;
      }

      toast.success("Vídeo sendo gerado!", { id: toastId, duration: 3000 });
      navigate("/video-result", { state: { contentData: { actionId: actionData.id, isProcessing: true } } });
    } catch (err: any) {
      console.error("Erro:", err);
      toast.error(err?.message || "Erro ao gerar vídeo", { id: toastId });
    } finally {
      setLoading(false);
    }
  };

  const SelectSkeleton = () => (
    <div className="space-y-1.5">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-10 w-full rounded-lg" />
      <Skeleton className="h-3 w-48" />
    </div>
  );

  return (
    <div className="flex flex-col -m-4 sm:-m-6 lg:-m-8 min-h-full">
      <TourSelector 
        tours={[{
          tourType: 'navbar',
          steps: navbarSteps,
          label: 'Tour da Navegação',
          targetElement: '#sidebar-logo'
        }]}
        startDelay={500}
      />

      {/* Banner */}
      <div className="relative h-48 md:h-64 lg:h-72 overflow-hidden">
        <PageBreadcrumb
          items={[{ label: "Criar Conteúdo", href: "/create" }, { label: "Criar Vídeo" }]}
          variant="overlay"
        />
        <img
          src={createBanner}
          alt="Criar Vídeo"
          className="w-full h-full object-cover object-center"
          loading="eager"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
      </div>

      {/* Header Card */}
      <div className="relative px-4 sm:px-6 lg:px-8 -mt-12 z-10">
        <div className="max-w-7xl mx-auto">
          <div className="bg-card rounded-2xl shadow-lg p-4 md:p-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 md:gap-4">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className="flex-shrink-0 bg-primary/10 text-primary rounded-xl p-2.5 md:p-3">
                  <Video className="h-5 w-5 md:h-6 md:w-6 lg:h-8 lg:w-8" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h1 className="text-xl md:text-2xl lg:text-3xl font-bold text-foreground">
                      Criar Vídeo
                    </h1>
                    <Popover>
                      <PopoverTrigger asChild>
                        <button className="text-muted-foreground hover:text-foreground transition-colors">
                          <HelpCircle className="h-4 w-4" />
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="text-sm w-72" side="bottom">
                        <p className="font-medium mb-1">Criar Vídeo</p>
                        <p className="text-muted-foreground text-xs">
                          Gere vídeos profissionais com IA. Descreva o que deseja criar, selecione marca e persona para personalizar o resultado.
                        </p>
                      </PopoverContent>
                    </Popover>
                  </div>
                  <p className="text-muted-foreground text-xs md:text-sm">
                    Gere vídeos profissionais com IA
                  </p>
                </div>
              </div>
              {user && (
                <Card className="bg-gradient-to-br from-primary/10 to-secondary/10 border-primary/20 flex-shrink-0">
                  <CardContent className="p-2.5 md:p-3">
                    <div className="flex items-center justify-center gap-3">
                      <div className="relative flex-shrink-0">
                        <div className="absolute inset-0 bg-gradient-to-r from-primary to-secondary rounded-full blur-sm opacity-40"></div>
                        <div className="relative bg-gradient-to-r from-primary to-secondary text-white rounded-full p-2">
                          <Zap className="h-4 w-4" />
                        </div>
                      </div>
                      <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                          <span className="text-xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent whitespace-nowrap">
                            {user?.credits || 0}
                          </span>
                          <p className="text-sm text-muted-foreground font-medium leading-tight whitespace-nowrap">
                            Créditos
                          </p>
                        </div>
                        <p className="text-xs text-muted-foreground">Disponíveis</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Form */}
      <main className="px-4 sm:px-6 lg:px-8 pt-4 pb-8 flex-1">
        <div className="max-w-7xl mx-auto space-y-4 mt-4">

          {/* 1. Descrição do Vídeo */}
          <Card className="border-0 shadow-lg rounded-2xl overflow-hidden">
            <CardContent className="p-4 md:p-5 space-y-4">
              <div className="space-y-2">
                <Label className="text-sm font-bold text-foreground">
                  Descreva o que você quer criar <span className="text-destructive">*</span>
                </Label>
                <Textarea
                  placeholder="Ex: Um vídeo mostrando um produto sendo usado em diferentes cenários, com transições suaves e música de fundo inspiradora..."
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  rows={5}
                  className="resize-none rounded-xl border-2 border-border/50 bg-background/50 hover:border-border/70 focus:border-primary/50 transition-colors"
                />
                <p className="text-xs text-muted-foreground flex items-start gap-1.5">
                  <Info className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                  <span>Seja específico sobre cenas, movimentos, estilo e mood desejado</span>
                </p>
                <div className="mt-2 p-3 rounded-xl bg-primary/5 border border-primary/10">
                  <p className="text-xs font-semibold text-foreground mb-2 flex items-center gap-1.5">
                    <Sparkles className="h-3.5 w-3.5 flex-shrink-0 text-primary" />
                    Dicas para um prompt eficaz
                  </p>
                  <div className="space-y-1.5 text-xs text-muted-foreground">
                    <p>🎭 <strong>Sujeito genérico:</strong> "Um homem de meia-idade com expressão determinada..."</p>
                    <p>🎬 <strong>Ação/Movimento:</strong> "...caminhando por uma praça movimentada..."</p>
                    <p>📷 <strong>Câmera:</strong> "...plano sequência com iluminação de golden hour."</p>
                    <p>🎨 <strong>Clima:</strong> "Estilo cinematográfico, cores vibrantes, alta fidelidade."</p>
                  </div>
                  <div className="mt-2 pt-2 border-t border-border/50">
                    <p className="text-xs font-medium text-amber-600 dark:text-amber-400 flex items-center gap-1.5 mb-1">
                      <HelpCircle className="h-3 w-3 flex-shrink-0" />
                      Evite nomes de pessoas reais
                    </p>
                    <p className="text-xs text-muted-foreground">
                      A IA bloqueia nomes e rostos reais. Descreva características físicas em vez de citar nomes:
                    </p>
                    <div className="mt-1 space-y-0.5 text-xs">
                      <p className="text-destructive/70 line-through">❌ "Lionel Messi jogando futebol"</p>
                      <p className="text-green-600 dark:text-green-400">✅ "Um jogador com camisa 10, barba curta, driblando em estádio lotado"</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-bold text-foreground">
                  Objetivo <span className="text-destructive">*</span>
                </Label>
                <Textarea
                  placeholder="Qual a principal meta deste vídeo?"
                  value={formData.objective}
                  onChange={(e) => setFormData(prev => ({ ...prev, objective: e.target.value }))}
                  rows={2}
                  className="resize-none rounded-xl border-2 border-border/50 bg-background/50 hover:border-border/70 focus:border-primary/50 transition-colors"
                />
              </div>
            </CardContent>
          </Card>

          {/* 2. Contexto Criativo */}
          <Card className="border-0 shadow-lg rounded-2xl overflow-hidden">
            <CardContent className="p-4 md:p-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Marca */}
                {isLoadingData ? <SelectSkeleton /> : (
                  <div className="space-y-1.5">
                    <Label className="text-sm font-bold text-foreground">
                      Marca <span className="text-muted-foreground font-normal text-xs">(opcional)</span>
                    </Label>
                    <NativeSelect
                      value={formData.brand}
                      onValueChange={(value) => setFormData(prev => ({ ...prev, brand: value, theme: "", persona: "" }))}
                      options={brands.map((b) => ({ value: b.id, label: b.name }))}
                      placeholder={brands.length === 0 ? "Nenhuma marca cadastrada" : "Nenhuma marca selecionada"}
                      disabled={brands.length === 0}
                      triggerClassName="h-10 rounded-lg border-2 border-border/50 bg-background/50 hover:border-border/70 transition-colors"
                    />
                    <p className="text-xs text-muted-foreground flex items-start gap-1.5">
                      <Info className="h-3 w-3 mt-0.5 flex-shrink-0" />
                      <span>{brands.length === 0 ? "Cadastre uma marca para conteúdo personalizado" : "Selecionar uma marca ajuda a IA a criar conteúdo alinhado"}</span>
                    </p>
                  </div>
                )}

                {/* Persona */}
                {isLoadingData ? <SelectSkeleton /> : (
                  <div className="space-y-1.5">
                    <Label className="text-sm font-bold text-foreground">
                      Persona <span className="text-muted-foreground font-normal text-xs">(opcional)</span>
                    </Label>
                    <NativeSelect
                      value={formData.persona}
                      onValueChange={(value) => setFormData(prev => ({ ...prev, persona: value }))}
                      options={filteredPersonas.map((p) => ({ value: p.id, label: p.name }))}
                      placeholder={!formData.brand ? "Selecione uma marca primeiro" : filteredPersonas.length === 0 ? "Nenhuma persona para esta marca" : "Nenhuma persona selecionada"}
                      disabled={!formData.brand || filteredPersonas.length === 0}
                      triggerClassName="h-10 rounded-lg border-2 border-border/50 bg-background/50 hover:border-border/70 transition-colors"
                    />
                    <p className="text-xs text-muted-foreground flex items-start gap-1.5">
                      <Info className="h-3 w-3 mt-0.5 flex-shrink-0" />
                      <span>A persona ajuda a IA a criar conteúdo direcionado ao seu público-alvo</span>
                    </p>
                  </div>
                )}

                {/* Tema Estratégico */}
                {isLoadingData ? <SelectSkeleton /> : (
                  <div className="space-y-1.5">
                    <Label className="text-sm font-bold text-foreground">
                      Tema Estratégico <span className="text-muted-foreground font-normal text-xs">(opcional)</span>
                    </Label>
                    <NativeSelect
                      value={formData.theme}
                      onValueChange={(value) => setFormData(prev => ({ ...prev, theme: value }))}
                      options={filteredThemes.map((t) => ({ value: t.id, label: t.title }))}
                      placeholder={!formData.brand ? "Selecione uma marca primeiro" : filteredThemes.length === 0 ? "Nenhum tema para esta marca" : "Nenhum tema selecionado"}
                      disabled={!formData.brand || filteredThemes.length === 0}
                      triggerClassName="h-10 rounded-lg border-2 border-border/50 bg-background/50 hover:border-border/70 transition-colors"
                    />
                    <p className="text-xs text-muted-foreground flex items-start gap-1.5">
                      <Info className="h-3 w-3 mt-0.5 flex-shrink-0" />
                      <span>O tema estratégico define tom de voz, público-alvo e objetivos</span>
                    </p>
                  </div>
                )}

                {/* Plataforma */}
                <div className="space-y-1.5">
                  <Label className="text-sm font-bold text-foreground">
                    Plataforma <span className="text-muted-foreground font-normal text-xs">(opcional)</span>
                  </Label>
                  <NativeSelect
                    value={formData.platform}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, platform: value }))}
                    options={[
                      { value: "Instagram", label: "Instagram" },
                      { value: "Facebook", label: "Facebook" },
                      { value: "TikTok", label: "TikTok" },
                      { value: "Twitter/X", label: "Twitter (X)" },
                      { value: "LinkedIn", label: "LinkedIn" },
                    ]}
                    placeholder="Nenhuma plataforma selecionada"
                    triggerClassName="h-10 rounded-lg border-2 border-border/50 bg-background/50 hover:border-border/70 transition-colors"
                  />
                  <p className="text-xs text-muted-foreground flex items-start gap-1.5">
                    <Info className="h-3 w-3 mt-0.5 flex-shrink-0" />
                    <span>Selecionar plataforma ajuda a IA a otimizar o formato</span>
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 3. Configurações do Vídeo */}
          <Card className="border-0 shadow-lg rounded-2xl overflow-hidden">
            <CardContent className="p-4 md:p-5 space-y-3">
              <Label className="text-sm font-bold text-foreground flex items-center gap-2">
                <Video className="h-4 w-4 text-primary" />
                Configurações do Vídeo
              </Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* Modelo de IA */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-foreground">Modelo de IA</Label>
                  <div className="h-10 rounded-lg border-2 border-border/50 bg-background/50 px-3 flex items-center">
                    <span className="text-sm">OpenAI Sora 2</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Sora 2: vídeos com áudio sincronizado e imagem de referência
                  </p>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-foreground">Estilo Visual</Label>
                  <NativeSelect
                    value={formData.videoVisualStyle}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, videoVisualStyle: value as any }))}
                    options={[
                      { value: "cinematic", label: "Cinemático" },
                      { value: "animation", label: "Animação" },
                      { value: "realistic", label: "Realístico" },
                      { value: "creative", label: "Criativo" },
                    ]}
                    placeholder="Selecione o estilo"
                    triggerClassName="h-10 rounded-lg border-2 border-border/50 bg-background/50 hover:border-border/70 transition-colors"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-foreground">Proporção</Label>
                  <NativeSelect
                    value={formData.videoAspectRatio}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, videoAspectRatio: value as any }))}
                    options={[
                      { value: "16:9", label: "16:9 (Horizontal)" },
                      { value: "9:16", label: "9:16 (Vertical)" },
                    ]}
                    placeholder="Selecione a proporção"
                    triggerClassName="h-10 rounded-lg border-2 border-border/50 bg-background/50 hover:border-border/70 transition-colors"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-foreground">Resolução</Label>
                  <NativeSelect
                    value={formData.videoResolution}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, videoResolution: value as any }))}
                    options={[
                      { value: "720p", label: "720p (HD)" },
                      { value: "1080p", label: "1080p (Full HD)" },
                    ]}
                    placeholder="Selecione a resolução"
                    triggerClassName="h-10 rounded-lg border-2 border-border/50 bg-background/50 hover:border-border/70 transition-colors"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-foreground">Duração</Label>
                  <NativeSelect
                    value={String(formData.videoDuration)}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, videoDuration: Number(value) as any }))}
                    options={[
                      { value: "5", label: "5 segundos" },
                      { value: "10", label: "10 segundos" },
                      { value: "15", label: "15 segundos" },
                      { value: "20", label: "20 segundos" },
                    ]}
                    placeholder="Selecione a duração"
                    triggerClassName="h-10 rounded-lg border-2 border-border/50 bg-background/50 hover:border-border/70 transition-colors"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-foreground">Estilo de Áudio</Label>
                  <NativeSelect
                    value={formData.videoAudioStyle}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, videoAudioStyle: value as any }))}
                    options={[
                      { value: "dialogue", label: "Diálogo" },
                      { value: "sound_effects", label: "Efeitos Sonoros" },
                      { value: "music", label: "Música" },
                      { value: "none", label: "Sem Áudio" },
                    ]}
                    placeholder="Selecione o áudio"
                    triggerClassName="h-10 rounded-lg border-2 border-border/50 bg-background/50 hover:border-border/70 transition-colors"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 4. Tom de Voz */}
          <Card className="border-0 shadow-lg rounded-2xl overflow-hidden">
            <CardContent className="p-4 md:p-5 space-y-2">
              <Label className="text-sm font-bold text-foreground">
                Tom de Voz <span className="text-destructive">*</span>
              </Label>
              <NativeSelect
                value=""
                onValueChange={(tone) => { if (!formData.tone.includes(tone) && formData.tone.length < 4) setFormData(prev => ({ ...prev, tone: [...prev.tone, tone] })); }}
                options={toneOptions.map((t) => ({ value: t, label: t.charAt(0).toUpperCase() + t.slice(1) }))}
                placeholder="Selecione um tom"
                triggerClassName="h-10 rounded-lg border-2 border-border/50 bg-background/50 hover:border-border/70 transition-colors"
              />
              {formData.tone.length > 0 && (
                <div className="flex flex-wrap gap-2 p-3 bg-primary/5 rounded-xl border border-primary/20">
                  {formData.tone.map((t) => (
                    <Badge key={t} variant="secondary" className="bg-primary/10 text-primary border-primary/30 capitalize gap-1">
                      {t}
                      <button onClick={() => setFormData(prev => ({ ...prev, tone: prev.tone.filter(x => x !== t) }))} className="ml-1 hover:text-destructive">
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
              <p className="text-xs text-muted-foreground flex items-start gap-1.5">
                <Info className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                <span>Selecione até 4 tons de voz para guiar a criação do vídeo</span>
              </p>
            </CardContent>
          </Card>

          {/* 5. Imagem de Referência */}
          {(
          <Card className="border-0 shadow-lg rounded-2xl overflow-hidden">
            <CardContent className="p-4 md:p-5 space-y-3">
              <Label className="text-sm font-bold text-foreground flex items-center gap-2">
                <ImagePlus className="h-4 w-4 text-primary" />
                Imagem de Referência <span className="text-muted-foreground font-normal text-xs">(opcional)</span>
              </Label>
              <div className="flex items-start gap-2 text-xs text-muted-foreground bg-muted/50 dark:bg-muted/30 rounded-lg p-3">
                <Info className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <p>Adicione uma imagem para criar um vídeo baseado nela. A IA usará a imagem como referência visual.</p>
              </div>
              
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
              />
              
              {referenceImage ? (
                <div className="relative rounded-xl overflow-hidden border-2 border-border/50 bg-muted/30">
                  <img 
                    src={referenceImage} 
                    alt="Imagem de referência" 
                    className="w-full max-h-[200px] object-contain"
                  />
                  <Button
                    type="button"
                    variant="destructive"
                    size="icon"
                    className="absolute top-2 right-2 h-8 w-8 rounded-full shadow-lg"
                    onClick={removeReferenceImage}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                  <div className="absolute bottom-2 left-2">
                    <Badge className="bg-primary text-primary-foreground border-0">
                      Imagem para vídeo
                    </Badge>
                  </div>
                </div>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full h-24 rounded-xl border-2 border-dashed border-border/50 hover:border-primary/50 hover:bg-muted/30 transition-all"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <ImagePlus className="h-8 w-8" />
                    <span className="text-sm">Clique para adicionar imagem de referência</span>
                  </div>
                </Button>
              )}
            </CardContent>
          </Card>
          )}

          {/* Generate Button */}
          <div className="flex justify-end pb-6">
            <Button
              onClick={handleGenerateVideo}
              disabled={loading}
              size="lg"
              className="bg-gradient-to-r from-primary via-accent to-primary bg-[length:200%_100%] animate-gradient text-primary-foreground hover:opacity-90 transition-opacity shadow-lg gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="animate-spin h-5 w-5" />
                  <span>Gerando vídeo...</span>
                </>
              ) : (
                <>
                  <Sparkles className="h-5 w-5" />
                  <span>Gerar Vídeo</span>
                  <Badge variant="secondary" className="ml-2 bg-primary-foreground/20 text-primary-foreground border-primary-foreground/30 gap-1">
                    <Coins className="h-3 w-3" />
                    {CREDIT_COSTS.VIDEO_GENERATION}
                  </Badge>
                </>
              )}
            </Button>
          </div>
        </div>
      </main>

    </div>
  );
}
