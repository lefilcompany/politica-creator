import { useState, ChangeEvent, useEffect, useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { NativeSelect } from "@/components/ui/native-select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Skeleton } from "@/components/ui/skeleton";
import { Loader2, Image as ImageIcon, FileText, Type, Sparkles, CheckCircle, Zap } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { CREDIT_COSTS } from "@/lib/creditCosts";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useFormPersistence } from "@/hooks/useFormPersistence";
import { OnboardingTour } from "@/components/onboarding/OnboardingTour";
import { useOnboarding } from "@/hooks/useOnboarding";
import {
  reviewContentInitialSteps,
  reviewContentImageSteps,
  reviewContentCaptionSteps,
  reviewContentTextSteps,
} from "@/components/onboarding/tourSteps";
import { PageBreadcrumb } from "@/components/PageBreadcrumb";
import reviewBanner from "@/assets/review-banner.jpg";

type ReviewType = "image" | "caption" | "text-for-image";

const ReviewContent = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, refreshUserCredits } = useAuth();
  const { shouldShowTour } = useOnboarding();
  const [reviewType, setReviewType] = useState<ReviewType | null>(null);
  const [brand, setBrand] = useState("");
  const [theme, setTheme] = useState("");
  const [adjustmentsPrompt, setAdjustmentsPrompt] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [captionText, setCaptionText] = useState("");
  const [textForImage, setTextForImage] = useState("");
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // React Query for brands
  const { data: brands = [], isLoading: isLoadingBrands } = useQuery({
    queryKey: ['brands', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase.from("brands").select("id, name").eq("user_id", user.id);
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
    staleTime: 1000 * 60 * 5,
  });

  // React Query for themes
  const { data: themes = [], isLoading: isLoadingThemes } = useQuery({
    queryKey: ['themes', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase.from("strategic_themes").select("id, title, brand_id").eq("user_id", user.id);
      if (error) throw error;
      return (data || []).map((t) => ({ id: t.id, title: t.title, brandId: t.brand_id }));
    },
    enabled: !!user,
    staleTime: 1000 * 60 * 5,
  });

  const isLoadingData = isLoadingBrands || isLoadingThemes;

  // Filtered themes derived from brand selection
  const filteredThemes = useMemo(() => {
    if (!brand) return [];
    const selectedBrand = brands.find((b) => b.id === brand);
    return selectedBrand ? themes.filter((t) => t.brandId === selectedBrand.id) : [];
  }, [brand, brands, themes]);

  // Persistência de formulário
  const { loadPersistedData, clearPersistedData } = useFormPersistence({
    key: "review-content-form",
    formData: {
      reviewType,
      brand,
      theme,
      adjustmentsPrompt,
      captionText,
      textForImage,
    },
    excludeFields: ["imageFile", "previewUrl"],
  });

  // Limpar dados persistidos ao montar - sempre iniciar do zero
  useEffect(() => {
    clearPersistedData();
  }, []);

  // Detectar reset do sidebar
  useEffect(() => {
    const locationState = location.state as { reset?: boolean } | null;
    if (locationState?.reset) {
      handleReset();
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state]);

  const handleBrandChange = (value: string) => {
    setBrand(value);
    setTheme("");
  };

  // Auto-select single brand
  useEffect(() => {
    if (!isLoadingBrands && brands.length > 0 && !brand) {
      setBrand(brands[0].id);
    }
  }, [isLoadingBrands, brands, brand]);

  const handleImageChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 4 * 1024 * 1024) {
        setError("O arquivo de imagem não pode exceder 4MB.");
        return;
      }
      setImageFile(file);
      setPreviewUrl(URL.createObjectURL(file));
      setError(null);
    }
  };

  const convertImageToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleSubmit = async () => {
    if (!user) return;
    if (!brand) return setError("Cadastre uma identidade primeiro");

    if ((user.credits || 0) <= 0) {
      return toast.error("Seus créditos para revisões de conteúdo acabaram.");
    }

    setLoading(true);
    setError(null);

    try {
      let result;
      const selectedBrand = brands.find((b) => b.id === brand);
      const selectedTheme = theme ? themes.find((t) => t.id === theme) : null;

      if (reviewType === "image") {
        if (!imageFile || !adjustmentsPrompt) {
          setError("Por favor, envie uma imagem e descreva os ajustes");
          setLoading(false);
          return;
        }

        const base64Image = await convertImageToBase64(imageFile);

        const { data, error: functionError } = await supabase.functions.invoke("review-image", {
          body: {
            image: base64Image,
            prompt: adjustmentsPrompt,
            brandId: selectedBrand?.id,
            brandName: selectedBrand?.name,
            themeName: selectedTheme?.title,
          },
        });

        if (functionError) throw functionError;
        result = data;
      } else if (reviewType === "caption") {
        if (!captionText || !adjustmentsPrompt) {
          setError("Por favor, insira a legenda e descreva o que deseja melhorar");
          setLoading(false);
          return;
        }

        const { data, error: functionError } = await supabase.functions.invoke("review-caption", {
          body: {
            caption: captionText,
            prompt: adjustmentsPrompt,
            brandId: selectedBrand?.id,
            brandName: selectedBrand?.name,
            themeName: selectedTheme?.title,
          },
        });

        if (functionError) throw functionError;
        result = data;
      } else if (reviewType === "text-for-image") {
        if (!textForImage || !adjustmentsPrompt) {
          setError("Por favor, insira o texto e descreva o contexto desejado");
          setLoading(false);
          return;
        }

        const { data, error: functionError } = await supabase.functions.invoke("review-text-for-image", {
          body: {
            text: textForImage,
            prompt: adjustmentsPrompt,
            brandId: selectedBrand?.id,
            brandName: selectedBrand?.name,
            themeName: selectedTheme?.title,
          },
        });

        if (functionError) throw functionError;
        result = data;
      }

      if (result?.review) {
        clearPersistedData();

        try {
          await refreshUserCredits();
        } catch (error) {
          // Silent error
        }

        navigate("/review-result", {
          state: {
            reviewType,
            review: result.review,
            originalContent:
              reviewType === "image" ? previewUrl : reviewType === "caption" ? captionText : textForImage,
            brandName: selectedBrand?.name,
            themeName: selectedTheme?.title,
            actionId: result.actionId,
          },
        });
      }
    } catch (err: any) {
      console.error("Error during review:", err);
      toast.error("Erro ao processar revisão");
      setError("Erro ao processar revisão. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setReviewType(null);
    setBrand("");
    setTheme("");
    setAdjustmentsPrompt("");
    setImageFile(null);
    setPreviewUrl(null);
    setCaptionText("");
    setTextForImage("");
    setError(null);
  };

  const dynamicDescription = !reviewType
    ? "Escolha o tipo de revisão que deseja fazer"
    : reviewType === "image"
      ? "Receba sugestões da IA para aprimorar sua imagem"
      : reviewType === "caption"
        ? "Melhore sua legenda com sugestões da IA"
        : "Otimize seu texto para gerar imagens impactantes";

  return (
    <div className="flex flex-col -m-4 sm:-m-6 lg:-m-8 min-h-full">
      {/* Onboarding Tours */}
      {!reviewType && <OnboardingTour tourType="review_content" steps={reviewContentInitialSteps} />}
      {reviewType === "image" && (
        <OnboardingTour tourType="review_content_image" steps={reviewContentImageSteps} startDelay={500} />
      )}
      {reviewType === "caption" && (
        <OnboardingTour tourType="review_content_caption" steps={reviewContentCaptionSteps} startDelay={500} />
      )}
      {reviewType === "text-for-image" && (
        <OnboardingTour tourType="review_content_text" steps={reviewContentTextSteps} startDelay={500} />
      )}

      {/* Banner */}
      <div className="relative w-full h-48 md:h-56 flex-shrink-0 overflow-hidden">
        <PageBreadcrumb
          items={
            !reviewType
              ? [{ label: "Revisar Conteúdo" }]
              : [
                  { label: "Revisar Conteúdo", href: "/review", state: { reset: true } },
                  {
                    label:
                      reviewType === "image"
                        ? "Revisar Imagem"
                        : reviewType === "caption"
                          ? "Revisar Legenda"
                          : "Revisar Texto para Imagem",
                  },
                ]
          }
          variant="overlay"
        />
        <img
          src={reviewBanner}
          alt="Revisar Conteúdo"
          className="w-full h-full object-cover object-center"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-background/20 to-transparent" />
      </div>

      {/* Header Card */}
      <div className="relative px-4 sm:px-6 lg:px-8 -mt-12 flex-shrink-0 z-10">
        <div
          id="review-content-header"
          className="bg-card rounded-2xl shadow-lg p-4 lg:p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
        >
          <div className="flex items-center gap-3">
            <div className={`flex-shrink-0 ${
              reviewType === 'caption' ? 'bg-secondary/10 border-secondary/20 text-secondary' :
              reviewType === 'text-for-image' ? 'bg-accent/10 border-accent/20 text-accent' :
              'bg-primary/10 border-primary/20 text-primary'
            } border shadow-sm rounded-2xl p-3 lg:p-4`}>
              {reviewType === 'image' ? <ImageIcon className="h-8 w-8 lg:h-10 lg:w-10" /> :
               reviewType === 'caption' ? <FileText className="h-8 w-8 lg:h-10 lg:w-10" /> :
               reviewType === 'text-for-image' ? <Type className="h-8 w-8 lg:h-10 lg:w-10" /> :
               <CheckCircle className="h-8 w-8 lg:h-10 lg:w-10" />}
            </div>
            <div>
              <h1 className="text-2xl lg:text-3xl font-bold text-foreground">
                {!reviewType ? 'Revisar Conteúdo' :
                 reviewType === 'image' ? 'Revisar Imagem' :
                 reviewType === 'caption' ? 'Revisar Legenda' :
                 'Revisar Texto para Imagem'}
              </h1>
              <p className="text-sm lg:text-base text-muted-foreground">{dynamicDescription}</p>
            </div>
          </div>
          {isLoadingData ? (
            <Skeleton className="h-14 w-40 rounded-xl" />
          ) : (
            user && (
              <Card className="bg-gradient-to-br from-primary/10 to-secondary/10 border-primary/30 flex-shrink-0">
                <CardContent className="p-3">
                  <div className="flex items-center justify-center gap-4">
                    <div className="relative">
                      <div className="absolute inset-0 bg-gradient-to-r from-primary to-secondary rounded-full blur-sm opacity-40"></div>
                      <div className="relative bg-gradient-to-r from-primary to-secondary text-primary-foreground rounded-full p-2">
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
            )
          )}
        </div>
      </div>

      {/* Main Content */}
      <main className="px-4 sm:px-6 lg:px-8 pt-4 pb-4 sm:pb-6 lg:pb-8 flex-1">
        <div className={!reviewType ? "" : "max-w-7xl mx-auto space-y-4"}>
          {/* Review Type Selection */}
          {!reviewType && (
            <div id="review-type-selection" className="h-full">
              <RadioGroup value={reviewType || ""} onValueChange={(value) => setReviewType(value as ReviewType)} className="h-full">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 h-full">
                  <label htmlFor="image" className="cursor-pointer h-full">
                    <Card className="border-0 shadow-lg hover:shadow-xl hover:bg-primary/10 hover:border-primary/30 transition-all duration-300 h-full active:scale-[0.98] touch-manipulation rounded-2xl">
                      <CardContent className="p-6 flex flex-col items-center text-center gap-4 h-full justify-between">
                        <RadioGroupItem value="image" id="image" className="sr-only" />
                        <div className="flex flex-col items-center gap-4 flex-1 justify-center">
                          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                            <ImageIcon className="h-8 w-8 text-primary" />
                          </div>
                          <div className="space-y-1.5">
                            <h3 className="font-semibold text-lg">Revisar Imagem</h3>
                            <p className="text-sm text-muted-foreground leading-relaxed">
                              Envie uma imagem e receba sugestões de melhorias visuais
                            </p>
                          </div>
                        </div>
                        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/15 border border-primary/30">
                          <ImageIcon className="h-4 w-4 text-primary" />
                          <span className="text-sm font-bold text-primary">
                            {CREDIT_COSTS.IMAGE_REVIEW} créditos
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                  </label>

                  <label htmlFor="caption" className="cursor-pointer h-full">
                    <Card className="border-0 shadow-lg hover:shadow-xl hover:bg-secondary/10 hover:border-secondary/30 transition-all duration-300 h-full active:scale-[0.98] touch-manipulation rounded-2xl">
                      <CardContent className="p-6 flex flex-col items-center text-center gap-4 h-full justify-between">
                        <RadioGroupItem value="caption" id="caption" className="sr-only" />
                        <div className="flex flex-col items-center gap-4 flex-1 justify-center">
                          <div className="w-16 h-16 rounded-full bg-secondary/10 flex items-center justify-center flex-shrink-0">
                            <FileText className="h-8 w-8 text-secondary" />
                          </div>
                          <div className="space-y-1.5">
                            <h3 className="font-semibold text-lg">Revisar Legenda</h3>
                            <p className="text-sm text-muted-foreground leading-relaxed">
                              Melhore legendas existentes com sugestões da IA
                            </p>
                          </div>
                        </div>
                        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-secondary/15 border border-secondary/30">
                          <FileText className="h-4 w-4 text-secondary" />
                          <span className="text-sm font-bold text-secondary">
                            {CREDIT_COSTS.CAPTION_REVIEW} créditos
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                  </label>

                  <label htmlFor="text-for-image" className="cursor-pointer h-full">
                    <Card className="border-0 shadow-lg hover:shadow-xl hover:bg-accent/10 hover:border-accent/30 transition-all duration-300 h-full active:scale-[0.98] touch-manipulation rounded-2xl">
                      <CardContent className="p-6 flex flex-col items-center text-center gap-4 h-full justify-between">
                        <RadioGroupItem value="text-for-image" id="text-for-image" className="sr-only" />
                        <div className="flex flex-col items-center gap-4 flex-1 justify-center">
                          <div className="w-16 h-16 rounded-full bg-accent/10 flex items-center justify-center flex-shrink-0">
                            <Type className="h-8 w-8 text-accent" />
                          </div>
                          <div className="space-y-1.5">
                            <h3 className="font-semibold text-lg">Revisar Texto para Imagem</h3>
                            <p className="text-sm text-muted-foreground leading-relaxed">
                              Otimize textos que serão inseridos em imagens de posts
                            </p>
                          </div>
                        </div>
                        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent/15 border border-accent/30">
                          <Type className="h-4 w-4 text-accent" />
                          <span className="text-sm font-bold text-accent">
                            {CREDIT_COSTS.TEXT_REVIEW} créditos
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                  </label>
                </div>
              </RadioGroup>
            </div>
          )}

          {reviewType && (
            <>
              {/* Basic Config */}
              <Card className="border-0 shadow-lg rounded-2xl overflow-hidden">
                <CardHeader className="pb-4">
                  <h2 className="text-xl font-semibold flex items-center gap-3">
                    <div className="w-2 h-2 bg-primary rounded-full"></div>
                    Configuração Básica
                  </h2>
                  <p className="text-muted-foreground text-sm">Defina marca e tema para contextualizar a IA</p>
                </CardHeader>
                <CardContent className="p-6 pt-0">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Brand auto-selected */}
                    <div id="review-theme-field" className="space-y-3">
                      <Label htmlFor="theme" className="text-sm font-semibold text-foreground">
                        Tema Estratégico (Opcional)
                      </Label>
                      {isLoadingData ? (
                        <Skeleton className="h-11 w-full rounded-xl" />
                      ) : (
                        <NativeSelect
                          value={theme}
                          onValueChange={setTheme}
                          options={filteredThemes.map((t) => ({ value: t.id, label: t.title }))}
                          placeholder={!brand ? "Primeiro, escolha a marca" : "Selecione o tema"}
                          disabled={!brand || filteredThemes.length === 0}
                          triggerClassName="h-11 rounded-xl border-2 border-border/50 bg-background/50 disabled:opacity-50"
                        />
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Content Review */}
              <Card className="border-0 shadow-lg rounded-2xl overflow-hidden">
                <CardHeader className="pb-4">
                  <h2 className="text-xl font-semibold flex items-center gap-3">
                    <div className="w-2 h-2 bg-secondary rounded-full"></div>
                    {reviewType === "image" && "Análise da Imagem"}
                    {reviewType === "caption" && "Revisão da Legenda"}
                    {reviewType === "text-for-image" && "Revisão de Texto para Imagem"}
                  </h2>
                  <p className="text-muted-foreground text-sm">
                    {reviewType === "image" && "Envie a imagem e descreva o que precisa melhorar"}
                    {reviewType === "caption" && "Cole a legenda e descreva como quer melhorá-la"}
                    {reviewType === "text-for-image" && "Revise o texto que será inserido na imagem do post"}
                  </p>
                </CardHeader>
                <CardContent className="p-6 pt-0">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {reviewType === "image" && (
                      <>
                        <div id="review-content-input" className="space-y-3">
                          <Label htmlFor="file-upload" className="text-sm font-semibold text-foreground">
                            Sua Imagem *
                          </Label>
                          <div className="relative mt-2 flex justify-center rounded-xl border-2 border-dashed border-border/50 p-8 h-64 items-center">
                            <div className="text-center w-full">
                              {previewUrl ? (
                                <img
                                  src={previewUrl}
                                  alt="Pré-visualização"
                                  className="mx-auto h-48 w-auto rounded-lg object-contain"
                                />
                              ) : (
                                <>
                                  <ImageIcon className="mx-auto h-16 w-16 text-muted-foreground/50" />
                                  <p className="mt-4 text-base text-muted-foreground">
                                    Arraste e solte ou clique para enviar
                                  </p>
                                </>
                              )}
                              <input
                                id="file-upload"
                                type="file"
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                accept="image/png, image/jpeg"
                                onChange={handleImageChange}
                              />
                            </div>
                          </div>
                        </div>
                        <div id="review-adjustments-prompt" className="space-y-3">
                          <Label htmlFor="adjustmentsPrompt" className="text-sm font-semibold text-foreground">
                            O que você gostaria de ajustar? *
                          </Label>
                          <Textarea
                            id="adjustmentsPrompt"
                            placeholder="Descreva o objetivo e o que você espera da imagem. Ex: 'Quero que a imagem transmita mais energia e seja mais vibrante'"
                            value={adjustmentsPrompt}
                            onChange={(e) => setAdjustmentsPrompt(e.target.value)}
                            className="h-64 rounded-xl border-2 border-border/50 bg-background/50 resize-none"
                          />
                        </div>
                      </>
                    )}

                    {reviewType === "caption" && (
                      <>
                        <div id="review-content-input" className="space-y-3">
                          <Label htmlFor="captionText" className="text-sm font-semibold text-foreground">
                            Sua Legenda *
                            <span className="text-xs font-normal text-muted-foreground ml-2">
                              ({captionText.length}/8000)
                            </span>
                          </Label>
                          <Textarea
                            id="captionText"
                            placeholder="Cole aqui a legenda que você quer melhorar..."
                            value={captionText}
                            onChange={(e) => setCaptionText(e.target.value)}
                            maxLength={8000}
                            className="h-64 rounded-xl border-2 border-border/50 bg-background/50 resize-none"
                          />
                        </div>
                        <div id="review-adjustments-prompt" className="space-y-3">
                          <Label htmlFor="adjustmentsPrompt" className="text-sm font-semibold text-foreground">
                            O que você quer melhorar? *
                            <span className="text-xs font-normal text-muted-foreground ml-2">
                              ({adjustmentsPrompt.length}/5000)
                            </span>
                          </Label>
                          <Textarea
                            id="adjustmentsPrompt"
                            placeholder="Descreva como quer melhorar a legenda. Ex: 'Tornar mais engajadora e adicionar call-to-action'"
                            value={adjustmentsPrompt}
                            onChange={(e) => setAdjustmentsPrompt(e.target.value)}
                            maxLength={5000}
                            className="h-64 rounded-xl border-2 border-border/50 bg-background/50 resize-none"
                          />
                        </div>
                      </>
                    )}

                    {reviewType === "text-for-image" && (
                      <>
                        <div id="review-content-input" className="space-y-3">
                          <Label htmlFor="textForImage" className="text-sm font-semibold text-foreground">
                            Texto que Irá na Imagem *
                            <span className="text-xs font-normal text-muted-foreground ml-2">
                              ({textForImage.length}/8000)
                            </span>
                          </Label>
                          <Textarea
                            id="textForImage"
                            placeholder="Cole aqui o texto que será inserido na imagem do post (frase, citação, mensagem principal, etc.)..."
                            value={textForImage}
                            onChange={(e) => setTextForImage(e.target.value)}
                            maxLength={8000}
                            className="h-64 rounded-xl border-2 border-border/50 bg-background/50 resize-none"
                          />
                        </div>
                        <div id="review-adjustments-prompt" className="space-y-3">
                          <Label htmlFor="adjustmentsPrompt" className="text-sm font-semibold text-foreground">
                            Ajustes e Contexto da Imagem *
                            <span className="text-xs font-normal text-muted-foreground ml-2">
                              ({adjustmentsPrompt.length}/5000)
                            </span>
                          </Label>
                          <Textarea
                            id="adjustmentsPrompt"
                            placeholder="Descreva como quer melhorar o texto e o contexto da imagem onde ele será usado. Ex: 'Tornar o texto mais curto e impactante para Instagram, será usado em post motivacional com fundo azul'"
                            value={adjustmentsPrompt}
                            onChange={(e) => setAdjustmentsPrompt(e.target.value)}
                            maxLength={5000}
                            className="h-64 rounded-xl border-2 border-border/50 bg-background/50 resize-none"
                          />
                        </div>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Actions */}
              <div className="flex flex-col items-center gap-4">
                <Button
                  id="review-submit-button"
                  onClick={handleSubmit}
                  disabled={
                    loading ||
                    !brand ||
                    !adjustmentsPrompt ||
                    (reviewType === "image" && !imageFile) ||
                    (reviewType === "caption" && !captionText) ||
                    (reviewType === "text-for-image" && !textForImage)
                  }
                  className="w-full max-w-lg h-14 rounded-2xl text-lg font-bold bg-gradient-to-r from-primary via-purple-600 to-secondary hover:from-primary/90 shadow-xl transition-all duration-500 disabled:opacity-50"
                >
                  {loading ? (
                    <>
                      <Loader2 className="animate-spin mr-3 h-5 w-5" />
                      <span>Processando...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="mr-3 h-5 w-5" />
                      <span>Gerar Revisão</span>
                    </>
                  )}
                </Button>
                {error && <p className="text-destructive mt-4 text-center text-base">{error}</p>}
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
};

export default ReviewContent;
