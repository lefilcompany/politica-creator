import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { NativeSelect } from "@/components/ui/native-select";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Loader2, Zap, X, ImageIcon, Settings2, Info, Coins, HelpCircle } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CREDIT_COSTS } from "@/lib/creditCosts";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Brand } from "@/types/brand";
import type { Persona } from "@/types/persona";
import type { StrategicTheme } from "@/types/theme";
import { getPlatformImageSpec, platformSpecs } from "@/lib/platformSpecs";
import { useFormPersistence } from '@/hooks/useFormPersistence';
import { TourSelector } from "@/components/onboarding/TourSelector";
import { quickContentSteps, navbarSteps } from "@/components/onboarding/tourSteps";
import { PageBreadcrumb } from "@/components/PageBreadcrumb";
import { CreationProgressBar } from "@/components/CreationProgressBar";
import createBanner from "@/assets/create-banner.jpg";

export default function QuickContent() {
  const navigate = useNavigate();
  const { user, refreshUserCredits } = useAuth();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    prompt: "",
    brandId: "",
    themeId: "",
    personaId: "",
    platform: "",
    aspectRatio: "1:1",
    visualStyle: "realistic",
    style: "auto",
    quality: "standard",
    negativePrompt: "",
    colorPalette: "auto",
    lighting: "natural",
    composition: "auto",
    cameraAngle: "eye_level",
    detailLevel: 7,
    mood: "auto",
    width: "",
    height: ""
  });
  const [referenceFiles, setReferenceFiles] = useState<File[]>([]);
  const [preserveImageIndices, setPreserveImageIndices] = useState<number[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pasteAreaRef = useRef<HTMLDivElement>(null);

  // React Query for brands, themes, personas
  const userId = user?.id;

  const { data: brands = [], isLoading: loadingBrands } = useQuery({
    queryKey: ['brands', userId],
    queryFn: async () => {
      if (!userId) return [];
      const { data, error } = await supabase.from("brands").select("*").eq("user_id", userId).order("name");
      if (error) throw error;
      return (data || []) as any as Brand[];
    },
    enabled: !!userId,
    staleTime: 1000 * 60 * 5,
  });

  const { data: themes = [], isLoading: loadingThemes } = useQuery({
    queryKey: ['themes', userId],
    queryFn: async () => {
      if (!userId) return [];
      const { data, error } = await supabase.from("strategic_themes").select("*").eq("user_id", userId).order("title");
      if (error) throw error;
      return (data || []) as any as StrategicTheme[];
    },
    enabled: !!userId,
    staleTime: 1000 * 60 * 5,
  });

  const { data: personas = [], isLoading: loadingPersonas } = useQuery({
    queryKey: ['personas', userId],
    queryFn: async () => {
      if (!userId) return [];
      const { data, error } = await supabase.from("personas").select("*").eq("user_id", userId).order("name");
      if (error) throw error;
      return (data || []) as any as Persona[];
    },
    enabled: !!userId,
    staleTime: 1000 * 60 * 5,
  });

  const loadingData = loadingBrands || loadingThemes || loadingPersonas;

  // Auto-select single brand
  useEffect(() => {
    if (!loadingBrands && brands.length > 0 && !formData.brandId) {
      setFormData(prev => ({ ...prev, brandId: brands[0].id }));
    }
  }, [loadingBrands, brands]);

  // Filtered themes/personas based on brand
  const filteredThemes = formData.brandId
    ? themes.filter((t: any) => t.brand_id === formData.brandId || t.brandId === formData.brandId)
    : [];
  const filteredPersonas = formData.brandId
    ? personas.filter((p: any) => p.brand_id === formData.brandId || p.brandId === formData.brandId)
    : [];

  // Persistência de formulário
  const { loadPersistedData, clearPersistedData, hasRelevantData } = useFormPersistence({
    key: 'quick-content-form',
    formData,
    excludeFields: ['referenceFiles']
  });

  useEffect(() => {
    const persisted = loadPersistedData();
    if (persisted) {
      setFormData(prev => ({ ...prev, ...persisted }));
    }
  }, []);

  // Clear theme/persona when brand changes
  useEffect(() => {
    if (!formData.brandId) {
      setFormData(prev => ({ ...prev, themeId: "", personaId: "" }));
    }
  }, [formData.brandId]);

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    const files: File[] = [];
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf("image") !== -1) {
        const file = items[i].getAsFile();
        if (file) files.push(file);
      }
    }
    if (files.length > 0) {
      setReferenceFiles(prev => [...prev, ...files].slice(0, 5));
      toast.success(`${files.length} imagem(ns) adicionada(s)`);
    }
  };

  const handleRemoveFile = (indexToRemove: number) => {
    const updatedFiles = referenceFiles.filter((_, index) => index !== indexToRemove);
    setReferenceFiles(updatedFiles);
    setPreserveImageIndices(prev => prev.filter(idx => idx !== indexToRemove).map(idx => idx > indexToRemove ? idx - 1 : idx));
    if (updatedFiles.length === 0 && fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleTogglePreserve = (index: number) => {
    setPreserveImageIndices(prev => {
      if (prev.includes(index)) {
        return prev.filter(idx => idx !== index);
      } else {
        return [...prev, index];
      }
    });
  };

  const generateQuickContent = async () => {
    if (!formData.prompt.trim()) {
      toast.error("Por favor, descreva o que deseja criar");
      return;
    }
    if ((user?.credits || 0) <= 0) {
      toast.error("Você não possui créditos suficientes para criação rápida");
      return;
    }
    try {
      setLoading(true);
      const toastId = toast.loading("Preparando criação...", {
        description: "Processando suas configurações."
      });

      const referenceImagesBase64: string[] = [];
      const preserveImages: string[] = [];
      const styleReferenceImages: string[] = [];
      if (referenceFiles.length > 0) {
        toast.loading("Processando imagens de referência...", {
          id: toastId,
          description: `${referenceFiles.length} imagem(ns) sendo processadas.`
        });
        for (let i = 0; i < referenceFiles.length; i++) {
          const file = referenceFiles[i];
          const base64 = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(file);
          });
          referenceImagesBase64.push(base64);
          if (preserveImageIndices.includes(i)) {
            preserveImages.push(base64);
          } else {
            styleReferenceImages.push(base64);
          }
        }
      }
      toast.loading("Gerando conteúdo com IA...", {
        id: toastId,
        description: "Criando sua imagem personalizada."
      });
      const { data, error } = await supabase.functions.invoke("generate-quick-content", {
        body: {
          prompt: formData.prompt,
          brandId: formData.brandId || null,
          themeId: formData.themeId || null,
          personaId: formData.personaId || null,
          platform: formData.platform || null,
          referenceImages: referenceImagesBase64,
          preserveImages,
          styleReferenceImages,
          aspectRatio: formData.aspectRatio,
          visualStyle: formData.visualStyle,
          style: formData.style,
          quality: formData.quality,
          negativePrompt: formData.negativePrompt,
          colorPalette: formData.colorPalette,
          lighting: formData.lighting,
          composition: formData.composition,
          cameraAngle: formData.cameraAngle,
          detailLevel: formData.detailLevel,
          mood: formData.mood,
          width: formData.width,
          height: formData.height
        }
      });
      if (error) {
        console.error("Error generating content:", error);
        throw error;
      }
      toast.success("Conteúdo gerado com sucesso!", { id: toastId });
      clearPersistedData();

      try {
        await refreshUserCredits();
      } catch (error) {
        // Silent error
      }

      navigate("/quick-content-result", {
        state: {
          imageUrl: data.imageUrl,
          description: data.description,
          actionId: data.actionId,
          prompt: formData.prompt,
          brandName: data.brandName,
          themeName: data.themeName,
          personaName: data.personaName,
          platform: formData.platform
        }
      });
    } catch (error: any) {
      console.error("Error:", error);
      if (error.message?.includes('compliance_violation')) {
        try {
          const errorMatch = error.message.match(/\{.*\}/);
          if (errorMatch) {
            const errorData = JSON.parse(errorMatch[0]);
            toast.error("Solicitação não permitida", {
              description: errorData.message || "A solicitação viola regulamentações publicitárias brasileiras",
              duration: 8000
            });
            if (errorData.recommendation) {
              setTimeout(() => {
                toast.info("Sugestão", {
                  description: errorData.recommendation,
                  duration: 10000
                });
              }, 500);
            }
            return;
          }
        } catch (parseError) {
          console.error("Erro ao parsear erro de compliance:", parseError);
        }
      }
      toast.error(error.message || "Erro ao gerar conteúdo");
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
      <TourSelector tours={[{
        tourType: 'navbar',
        steps: navbarSteps,
        label: 'Tour da Navegação',
        targetElement: '#sidebar-logo'
      }, {
        tourType: 'quick_content',
        steps: quickContentSteps,
        label: 'Tour da Criação Rápida',
        targetElement: '#quick-content-form'
      }]} startDelay={500} />

      {/* Banner */}
      <div className="relative h-48 md:h-64 lg:h-72 overflow-hidden">
        <PageBreadcrumb
          items={[{ label: "Criar Conteúdo", href: "/create" }, { label: "Criação Rápida" }]}
          variant="overlay"
        />
        <img
          src={createBanner}
          alt="Criação Rápida"
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
                  <Zap className="h-5 w-5 md:h-6 md:w-6 lg:h-8 lg:w-8" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h1 className="text-xl md:text-2xl lg:text-3xl font-bold text-foreground">
                      Criação Rápida
                    </h1>
                    <Popover>
                      <PopoverTrigger asChild>
                        <button className="text-muted-foreground hover:text-foreground transition-colors">
                          <HelpCircle className="h-4 w-4" />
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="text-sm w-72" side="bottom">
                        <p className="font-medium mb-1">Criação Rápida</p>
                        <p className="text-muted-foreground text-xs">
                          Gere imagens rapidamente com IA. Descreva o que deseja criar, selecione opcionalmente uma marca, persona e tema estratégico para personalizar o resultado.
                        </p>
                      </PopoverContent>
                    </Popover>
                  </div>
                  <p className="text-muted-foreground text-xs md:text-sm">
                    Gere imagens rapidamente com IA
                  </p>
                </div>
              </div>
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
            </div>
          </div>
        </div>
      </div>

      {/* Main Form */}
      <main className="px-4 sm:px-6 lg:px-8 pt-4 pb-8 flex-1">
        <div className="max-w-7xl mx-auto space-y-4 mt-4">
          {/* Progress Bar */}
          <CreationProgressBar currentStep={loading ? "generating" : "config"} className="max-w-xs mx-auto" />

          <div id="quick-content-form" className="space-y-4">
            {/* 1. Prompt */}
            <Card className="border-0 shadow-lg rounded-2xl overflow-hidden">
              <CardContent className="p-4 md:p-5 space-y-2">
                <Label htmlFor="quick-description" className="text-sm font-bold text-foreground">
                  Descreva o que você quer criar <span className="text-destructive">*</span>
                </Label>
                <Textarea
                  id="quick-description"
                  placeholder="Ex: Uma imagem de um café sendo servido numa manhã ensolarada, com uma estética minimalista e moderna. Cores quentes, iluminação natural suave..."
                  value={formData.prompt}
                  onChange={e => setFormData({ ...formData, prompt: e.target.value })}
                  rows={5}
                  className="resize-none rounded-xl border-2 border-border/50 bg-background/50 hover:border-border/70 focus:border-primary/50 transition-colors"
                />
                <p className="text-xs text-muted-foreground flex items-start gap-1.5">
                  <Info className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                  <span>Seja específico sobre cena, iluminação, cores e estilo desejado</span>
                </p>
              </CardContent>
            </Card>

            {/* 2. Contexto Criativo */}
            <Card className="border-0 shadow-lg rounded-2xl overflow-hidden">
              <CardContent className="p-4 md:p-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Marca */}
                  {loadingData ? <SelectSkeleton /> : (
                  {/* Brand auto-selected */}

                  {/* Persona */}
                  {loadingData ? <SelectSkeleton /> : (
                    <div className="space-y-1.5">
                      <Label htmlFor="persona" className="text-sm font-bold text-foreground">
                        Persona <span className="text-muted-foreground font-normal text-xs">(opcional)</span>
                      </Label>
                      <NativeSelect
                        value={formData.personaId}
                        onValueChange={value => setFormData({ ...formData, personaId: value })}
                        options={filteredPersonas.map(persona => ({ value: persona.id, label: persona.name }))}
                        placeholder={!formData.brandId ? "Selecione uma marca primeiro" : filteredPersonas.length === 0 ? "Nenhuma persona cadastrada para esta marca" : "Nenhuma persona selecionada"}
                        disabled={!formData.brandId || filteredPersonas.length === 0}
                        triggerClassName="h-10 rounded-lg border-2 border-border/50 bg-background/50 hover:border-border/70 transition-colors"
                      />
                      <p className="text-xs text-muted-foreground flex items-start gap-1.5">
                        <Info className="h-3 w-3 mt-0.5 flex-shrink-0" />
                        <span>A persona ajuda a IA a criar conteúdo direcionado ao seu público-alvo</span>
                      </p>
                    </div>
                  )}

                  {/* Tema Estratégico */}
                  {loadingData ? <SelectSkeleton /> : (
                    <div className="space-y-1.5">
                      <Label htmlFor="theme" className="text-sm font-bold text-foreground">
                        Tema Estratégico <span className="text-muted-foreground font-normal text-xs">(opcional)</span>
                      </Label>
                      <NativeSelect
                        value={formData.themeId}
                        onValueChange={value => setFormData({ ...formData, themeId: value })}
                        options={filteredThemes.map(theme => ({ value: theme.id, label: theme.title }))}
                        placeholder={!formData.brandId ? "Selecione uma marca primeiro" : filteredThemes.length === 0 ? "Nenhum tema cadastrado para esta marca" : "Nenhum tema selecionado"}
                        disabled={!formData.brandId || filteredThemes.length === 0}
                        triggerClassName="h-10 rounded-lg border-2 border-border/50 bg-background/50 hover:border-border/70 transition-colors"
                      />
                      <p className="text-xs text-muted-foreground flex items-start gap-1.5">
                        <Info className="h-3 w-3 mt-0.5 flex-shrink-0" />
                        <span>O tema estratégico define tom de voz, público-alvo e objetivos da criação</span>
                      </p>
                    </div>
                  )}

                  {/* Plataforma */}
                  <div className="space-y-1.5">
                    <Label htmlFor="platform" className="text-sm font-bold text-foreground">
                      Plataforma <span className="text-muted-foreground font-normal text-xs">(opcional)</span>
                    </Label>
                    <NativeSelect
                      value={formData.platform}
                      onValueChange={value => {
                        setFormData({ ...formData, platform: value });
                        const imageSpec = getPlatformImageSpec(value, "feed", "organic");
                        if (imageSpec) {
                          setFormData(prev => ({ ...prev, aspectRatio: imageSpec.aspectRatio }));
                          toast.info(`Proporção ajustada para ${value}`, {
                            description: `${imageSpec.aspectRatio} (${imageSpec.width}x${imageSpec.height}px)`,
                            duration: 3000
                          });
                        }
                      }}
                      options={[
                        { value: "Instagram", label: "Instagram" },
                        { value: "Facebook", label: "Facebook" },
                        { value: "TikTok", label: "TikTok" },
                        { value: "Twitter/X", label: "Twitter/X" },
                        { value: "LinkedIn", label: "LinkedIn" },
                        { value: "Comunidades", label: "Comunidades" },
                      ]}
                      placeholder="Nenhuma plataforma selecionada"
                      triggerClassName="h-10 rounded-lg border-2 border-border/50 bg-background/50 hover:border-border/70 transition-colors"
                    />
                    <p className="text-xs text-muted-foreground flex items-start gap-1.5">
                      <Info className="h-3 w-3 mt-0.5 flex-shrink-0" />
                      <span>Selecionar plataforma ajusta automaticamente a proporção ideal</span>
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* 3. Estilo Visual */}
            <Card className="border-0 shadow-lg rounded-2xl overflow-hidden">
              <CardContent className="p-4 md:p-5 space-y-2">
                <Label htmlFor="visualStyle" className="text-sm font-bold text-foreground">
                  Estilo Visual
                </Label>
                <NativeSelect
                  value={formData.visualStyle}
                  onValueChange={value => setFormData({ ...formData, visualStyle: value })}
                  options={[
                    { value: "realistic", label: "Fotorealístico" },
                    { value: "animated", label: "Animado / 3D" },
                    { value: "cartoon", label: "Cartoon / Desenho" },
                    { value: "anime", label: "Anime / Mangá" },
                    { value: "watercolor", label: "Aquarela" },
                    { value: "oil_painting", label: "Pintura a Óleo" },
                    { value: "digital_art", label: "Arte Digital" },
                    { value: "sketch", label: "Esboço / Rascunho" },
                    { value: "minimalist", label: "Minimalista" },
                    { value: "vintage", label: "Vintage / Retrô" },
                  ]}
                  placeholder="Selecione um estilo"
                  triggerClassName="h-10 rounded-lg border-2 border-border/50 bg-background/50 hover:border-border/70 transition-colors"
                />
                <p className="text-xs text-muted-foreground flex items-start gap-1.5">
                  <Info className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                  <span>O estilo visual define a aparência da imagem gerada (ex: foto, cartoon, pintura)</span>
                </p>
              </CardContent>
            </Card>

            {/* 4. Imagens de Referência */}
            <Card className="border-0 shadow-lg rounded-2xl overflow-hidden">
              <CardContent className="p-4 md:p-5 space-y-3">
                <Label className="text-sm font-bold text-foreground flex items-center gap-2">
                  <ImageIcon className="h-4 w-4" />
                  Imagens de Referência <span className="text-muted-foreground font-normal text-xs">(opcional, máx. 5)</span>
                </Label>

                <div id="quick-reference-images" className="space-y-3">
                  <Input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={e => {
                      const files = Array.from(e.target.files || []);
                      setReferenceFiles(prev => [...prev, ...files].slice(0, 5));
                    }}
                    className="h-11 rounded-xl border-2 border-border/50 bg-background/50 file:mr-4 file:h-full file:py-0 file:px-5 file:rounded-l-[10px] file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90 hover:border-primary/30 transition-all cursor-pointer"
                  />

                  <div
                    ref={pasteAreaRef}
                    tabIndex={0}
                    onPaste={handlePaste}
                    className="border-2 border-dashed border-border/50 rounded-xl p-4 text-center bg-muted/20 hover:bg-muted/30 transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/50"
                  >
                    <ImageIcon className="h-8 w-8 mx-auto mb-2 text-muted-foreground/60" />
                    <p className="text-sm text-muted-foreground font-medium">
                      Cole suas imagens aqui (Ctrl+V)
                    </p>
                    <p className="text-xs text-muted-foreground/70 mt-1">
                      ou clique para selecionar arquivos
                    </p>
                  </div>

                  {referenceFiles.length > 0 && (
                    <div className="space-y-2 p-3 bg-primary/5 rounded-xl border border-primary/20">
                      <p className="text-xs font-semibold text-primary mb-2">
                        {referenceFiles.length} imagem(ns) selecionada(s):
                      </p>
                      <div className="space-y-2">
                        {referenceFiles.map((file, idx) => (
                          <div key={idx} className="bg-background/50 rounded-lg p-3 group hover:bg-background transition-colors">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-sm text-foreground font-medium flex items-center gap-2 min-w-0 flex-1">
                                <div className="w-2 h-2 bg-primary rounded-full flex-shrink-0"></div>
                                <span className="truncate">{file.name}</span>
                              </span>
                              <Button type="button" variant="ghost" size="sm" onClick={() => handleRemoveFile(idx)} className="h-7 w-7 p-0 hover:bg-destructive/10 hover:text-destructive flex-shrink-0">
                                <X className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                            <div className="flex items-center gap-2 pl-4">
                              <input
                                type="checkbox"
                                id={idx === 0 ? "quick-preserve-traits" : `preserve-${idx}`}
                                checked={preserveImageIndices.includes(idx)}
                                onChange={() => handleTogglePreserve(idx)}
                                className="h-4 w-4 rounded border-border/50 text-primary focus:ring-2 focus:ring-primary/50"
                              />
                              <Label htmlFor={idx === 0 ? "quick-preserve-traits" : `preserve-${idx}`} className="text-xs text-muted-foreground cursor-pointer">
                                Preservar traços desta imagem na geração final
                              </Label>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="bg-accent/30 border border-accent/50 rounded-lg p-3 space-y-2">
                  <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    <Info className="h-3.5 w-3.5 flex-shrink-0" />
                    Como usar imagens de referência:
                  </p>
                  <ul className="text-xs text-muted-foreground space-y-1 pl-5 list-disc">
                    <li><strong>Sem marcação:</strong> A IA usa apenas como inspiração de estilo, cores e composição</li>
                    <li><strong>Com marcação "Preservar traços":</strong> A IA mantém os elementos visuais originais da imagem no resultado final</li>
                  </ul>
                </div>
              </CardContent>
            </Card>

            {/* 5. Opções Avançadas */}
            <Accordion type="single" collapsible className="border-0 shadow-lg rounded-2xl overflow-hidden bg-card">
              <AccordionItem value="advanced" className="border-0">
                <AccordionTrigger id="advanced-options" className="px-4 md:px-5 py-3 hover:bg-muted/50 transition-colors hover:no-underline">
                  <div className="flex items-center gap-2 text-sm font-bold">
                    <Settings2 className="h-4 w-4 text-primary" />
                    <span>Opções Avançadas</span>
                    <span className="text-xs text-muted-foreground font-normal">(opcional)</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-4 md:px-5 pb-5 space-y-4 bg-muted/20">
                  <p className="text-xs text-muted-foreground mb-4">
                    Controles profissionais para designers. Deixe em "Auto" para resultados inteligentes.
                  </p>

                  <div className="space-y-2">
                    <Label htmlFor="advanced-negative-prompt" className="text-xs font-medium flex items-center gap-2">
                      Prompt Negativo
                      <Info className="h-3 w-3 text-muted-foreground" />
                    </Label>
                    <Textarea
                      id="advanced-negative-prompt"
                      placeholder="O que NÃO incluir (ex: texto, pessoas, fundo branco...)"
                      value={formData.negativePrompt}
                      onChange={e => setFormData({ ...formData, negativePrompt: e.target.value })}
                      className="min-h-[60px] rounded-lg border-2 border-border/50 bg-background/50 resize-none text-xs"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-xs font-medium">Paleta de Cores</Label>
                      <Select value={formData.colorPalette} onValueChange={value => setFormData(prev => ({ ...prev, colorPalette: value }))}>
                        <SelectTrigger id="advanced-color-palette" className="h-9 rounded-lg border-2 border-border/50 bg-background/50 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="auto">Automático</SelectItem>
                          <SelectItem value="warm">Quente (Laranja, Vermelho, Amarelo)</SelectItem>
                          <SelectItem value="cool">Frio (Azul, Verde, Roxo)</SelectItem>
                          <SelectItem value="monochrome">Monocromático</SelectItem>
                          <SelectItem value="vibrant">Vibrante</SelectItem>
                          <SelectItem value="pastel">Pastel</SelectItem>
                          <SelectItem value="earth">Tons Terrosos</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs font-medium">Iluminação</Label>
                      <Select value={formData.lighting} onValueChange={value => setFormData(prev => ({ ...prev, lighting: value }))}>
                        <SelectTrigger id="advanced-lighting" className="h-9 rounded-lg border-2 border-border/50 bg-background/50 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="natural">Natural (Luz do Dia)</SelectItem>
                          <SelectItem value="studio">Estúdio (Controlada)</SelectItem>
                          <SelectItem value="golden_hour">Golden Hour (Dourada)</SelectItem>
                          <SelectItem value="dramatic">Dramática (Alto Contraste)</SelectItem>
                          <SelectItem value="soft">Suave (Difusa)</SelectItem>
                          <SelectItem value="backlight">Contraluz</SelectItem>
                          <SelectItem value="neon">Neon</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs font-medium">Composição</Label>
                      <Select value={formData.composition} onValueChange={value => setFormData(prev => ({ ...prev, composition: value }))}>
                        <SelectTrigger className="h-9 rounded-lg border-2 border-border/50 bg-background/50 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="auto">Automático</SelectItem>
                          <SelectItem value="center">Centralizado</SelectItem>
                          <SelectItem value="rule_of_thirds">Regra dos Terços</SelectItem>
                          <SelectItem value="symmetric">Simétrico</SelectItem>
                          <SelectItem value="asymmetric">Assimétrico</SelectItem>
                          <SelectItem value="dynamic">Dinâmico</SelectItem>
                          <SelectItem value="minimalist">Minimalista</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs font-medium">Ângulo da Câmera</Label>
                      <Select value={formData.cameraAngle} onValueChange={value => setFormData(prev => ({ ...prev, cameraAngle: value }))}>
                        <SelectTrigger className="h-9 rounded-lg border-2 border-border/50 bg-background/50 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="eye_level">Nível dos Olhos</SelectItem>
                          <SelectItem value="top_down">Vista Superior</SelectItem>
                          <SelectItem value="low_angle">Ângulo Baixo</SelectItem>
                          <SelectItem value="high_angle">Ângulo Alto</SelectItem>
                          <SelectItem value="close_up">Close-up</SelectItem>
                          <SelectItem value="wide_shot">Plano Geral</SelectItem>
                          <SelectItem value="dutch_angle">Ângulo Holandês</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs font-medium">Atmosfera</Label>
                      <Select value={formData.mood} onValueChange={value => setFormData(prev => ({ ...prev, mood: value }))}>
                        <SelectTrigger className="h-9 rounded-lg border-2 border-border/50 bg-background/50 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="auto">Automático</SelectItem>
                          <SelectItem value="professional">Profissional</SelectItem>
                          <SelectItem value="casual">Casual</SelectItem>
                          <SelectItem value="elegant">Elegante</SelectItem>
                          <SelectItem value="playful">Divertido</SelectItem>
                          <SelectItem value="serious">Sério</SelectItem>
                          <SelectItem value="mysterious">Misterioso</SelectItem>
                          <SelectItem value="energetic">Energético</SelectItem>
                          <SelectItem value="calm">Calmo</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs font-medium flex items-center gap-2">
                        Dimensões da Imagem
                        <Info className="h-3 w-3 text-muted-foreground" />
                      </Label>
                      <Select
                        value={formData.width && formData.height ? `${formData.width}x${formData.height}` : ''}
                        onValueChange={value => {
                          const [width, height] = value.split('x');
                          setFormData(prev => ({ ...prev, width, height }));
                        }}
                      >
                        <SelectTrigger className="h-9 rounded-lg border-2 border-border/50 bg-background/50 text-xs">
                          <SelectValue placeholder="Selecione as dimensões" />
                        </SelectTrigger>
                        <SelectContent>
                          {formData.platform && platformSpecs[formData.platform] && (
                            <>
                              {platformSpecs[formData.platform].organic?.image.dimensions.map(dim => (
                                <SelectItem key={`${dim.width}x${dim.height}`} value={`${dim.width}x${dim.height}`}>
                                  {dim.width}x{dim.height} ({dim.aspectRatio}) - {dim.description}
                                </SelectItem>
                              ))}
                            </>
                          )}
                          {!formData.platform && (
                            <SelectItem value="1080x1080" disabled>
                              Selecione uma plataforma primeiro
                            </SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                      {formData.width && formData.height && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Selecionado: {formData.width}x{formData.height}px
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <Label className="text-xs font-medium">Nível de Detalhes</Label>
                      <span className="text-xs text-muted-foreground font-medium">{formData.detailLevel}/10</span>
                    </div>
                    <Slider
                      id="advanced-detail-level"
                      value={[formData.detailLevel || 7]}
                      onValueChange={value => setFormData(prev => ({ ...prev, detailLevel: value[0] }))}
                      min={1}
                      max={10}
                      step={1}
                      className="w-full"
                    />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Minimalista</span>
                      <span>Equilibrado</span>
                      <span>Muito Detalhado</span>
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>

          {/* Generate Button */}
          <div className="flex justify-end pb-6">
            <Button id="quick-generate-button" onClick={generateQuickContent} disabled={loading || !formData.prompt.trim() || (user?.credits || 0) < CREDIT_COSTS.QUICK_IMAGE} size="lg" className="bg-gradient-to-r from-primary via-accent to-primary bg-[length:200%_100%] animate-gradient text-primary-foreground hover:opacity-90 transition-opacity shadow-lg gap-2">
              {loading ? <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Gerando...
              </> : <>
                <Zap className="mr-2 h-5 w-5" />
                Gerar Imagem Rápida
                <Badge variant="secondary" className="ml-2 bg-primary-foreground/20 text-primary-foreground border-primary-foreground/30 gap-1">
                  <Coins className="h-3 w-3" />
                  {CREDIT_COSTS.QUICK_IMAGE}
                </Badge>
              </>}
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}
