import { useState, useEffect, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { NativeSelect } from "@/components/ui/native-select";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Loader2, Sparkles, Zap, X, Info, ImagePlus, Coins, Image as ImageIcon, HelpCircle, Eye } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { CREDIT_COSTS } from "@/lib/creditCosts";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import type { BrandSummary } from "@/types/brand";
import type { StrategicThemeSummary } from "@/types/theme";
import type { PersonaSummary } from "@/types/persona";
import type { Team } from "@/types/theme";
import { useAuth } from "@/hooks/useAuth";
import { getPlatformImageSpec, getCaptionGuidelines } from "@/lib/platformSpecs";
import { useFormPersistence } from '@/hooks/useFormPersistence';
import { TourSelector } from '@/components/onboarding/TourSelector';
import { createContentSteps, navbarSteps } from '@/components/onboarding/tourSteps';
import { PageBreadcrumb } from "@/components/PageBreadcrumb";
import { CreationProgressBar } from "@/components/CreationProgressBar";
import { buildRequestPayload, buildImagePromptString, type PromptFormFields } from "@/lib/buildImagePrompt";
import createBanner from "@/assets/create-banner.jpg";
import { ThesisRecommendationModal } from "@/components/criar-imagem/ThesisRecommendationModal";
import { type Thesis } from "@/lib/theses";

enum GenerationStep {
  IDLE = "IDLE",
  GENERATING_IMAGE = "GENERATING_IMAGE",
  GENERATING_CAPTION = "GENERATING_CAPTION",
  SAVING = "SAVING",
  COMPLETE = "COMPLETE"
}

interface FormData {
  brand: string;
  theme: string;
  persona: string;
  objective: string;
  platform: string;
  description: string;
  tone: string[];
  additionalInfo: string;
  contentType: 'organic' | 'ads';
  visualStyle: string;
  vibeStyle: string;
  fontStyle: string;
  politicalTone: string;
  negativePrompt?: string;
  colorPalette?: string;
  lighting?: string;
  composition?: string;
  cameraAngle?: string;
  detailLevel?: number;
  mood?: string;
  width?: string;
  height?: string;
  imageIncludeText?: boolean;
  imageTextContent?: string;
  imageTextPosition?: 'top' | 'center' | 'bottom' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
}

const POLITICAL_TONE_OPTIONS = [
  { value: 'combativo', label: '⚔️ Combativo / Responder Ataque', description: 'Gera urgência e força. Contraste alto, cores intensas.' },
  { value: 'didatico', label: '📊 Didático / Prestação de Contas', description: 'Layout limpo, infográficos, compreensão de dados.' },
  { value: 'emocional', label: '💛 Emocional / Mobilização', description: 'Iluminação quente, foco em pessoas e expressões.' },
  { value: 'institucional', label: '🏛️ Institucional / Governo', description: 'Minimalista, simétrico, estabilidade e ordem.' },
] as const;

const toneOptions = [
  "inspirador",
  "motivacional", 
  "profissional",
  "casual",
  "elegante",
  "moderno",
  "tradicional",
  "divertido",
  "sério",
];

export default function CreateImage() {
  const { user, session, refreshUserCredits } = useAuth();
  const navigate = useNavigate();
  const [formData, setFormData] = useState<FormData>({
    brand: "",
    theme: "",
    persona: "",
    objective: "",
    platform: "",
    description: "",
    tone: [],
    additionalInfo: "",
    contentType: "organic",
    visualStyle: "professional",
    vibeStyle: "professional",
    fontStyle: "modern",
    politicalTone: "institucional",
    negativePrompt: "",
    colorPalette: "auto",
    lighting: "natural",
    composition: "auto",
    cameraAngle: "eye_level",
    detailLevel: 7,
    mood: "auto",
    imageIncludeText: false,
    imageTextContent: "",
    imageTextPosition: "center",
  });

  const [loading, setLoading] = useState<boolean>(false);
  const [generationStep, setGenerationStep] = useState<GenerationStep>(GenerationStep.IDLE);
  const [generationProgress, setGenerationProgress] = useState<number>(0);
  const [referenceFiles, setReferenceFiles] = useState<File[]>([]);
  const [brandImages, setBrandImages] = useState<string[]>([]);
  const pasteAreaRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [missingFields, setMissingFields] = useState<string[]>([]);
  const [contentType, setContentType] = useState<"organic" | "ads">("organic");
  const [platformGuidelines, setPlatformGuidelines] = useState<string[]>([]);
  const [recommendedAspectRatio, setRecommendedAspectRatio] = useState<string>("");
  const [preserveImageIndices, setPreserveImageIndices] = useState<number[]>([]);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showThesisModal, setShowThesisModal] = useState(false);
  const [selectedThesis, setSelectedThesis] = useState<Thesis | null>(null);
  const [promptPreview, setPromptPreview] = useState("");

  // React Query for brands, themes, personas
  const userId = user?.id;

  const { data: brands = [], isLoading: loadingBrands } = useQuery({
    queryKey: ['brands', userId],
    queryFn: async () => {
      if (!userId) return [];
      const { data, error } = await supabase
        .from('brands')
        .select('id, name, responsible, brand_color, avatar_url, created_at, updated_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []).map((brand: any) => ({
        id: brand.id,
        name: brand.name,
        responsible: brand.responsible,
        brandColor: brand.brand_color,
        avatarUrl: brand.avatar_url,
        createdAt: brand.created_at,
        updatedAt: brand.updated_at,
      })) as BrandSummary[];
    },
    enabled: !!userId,
    staleTime: 1000 * 60 * 5,
  });

  const { data: themes = [], isLoading: loadingThemes } = useQuery({
    queryKey: ['themes-full', userId],
    queryFn: async () => {
      if (!userId) return [];
      const { data, error } = await supabase
        .from('strategic_themes')
        .select('id, brand_id, title, tone_of_voice, platforms, target_audience, objectives, objective_type, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []).map((theme: any) => ({
        id: theme.id,
        brandId: theme.brand_id,
        title: theme.title,
        toneOfVoice: theme.tone_of_voice,
        platforms: theme.platforms,
        targetAudience: theme.target_audience,
        objectives: theme.objectives,
        objectiveType: theme.objective_type,
        createdAt: theme.created_at,
      }));
    },
    enabled: !!userId,
    staleTime: 1000 * 60 * 5,
  });

  const { data: personas = [], isLoading: loadingPersonas } = useQuery({
    queryKey: ['personas-full', userId],
    queryFn: async () => {
      if (!userId) return [];
      const { data, error } = await supabase
        .from('personas')
        .select('id, brand_id, name, age, gender, location, professional_context, preferred_tone_of_voice, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []).map((persona: any) => ({
        id: persona.id,
        brandId: persona.brand_id,
        name: persona.name,
        age: persona.age,
        gender: persona.gender,
        location: persona.location,
        professionalContext: persona.professional_context,
        preferredTone: persona.preferred_tone_of_voice,
        createdAt: persona.created_at,
      }));
    },
    enabled: !!userId,
    staleTime: 1000 * 60 * 5,
  });

  const isLoadingData = loadingBrands || loadingThemes || loadingPersonas;

  const { loadPersistedData, clearPersistedData } = useFormPersistence({
    key: 'create-image-form',
    formData,
    excludeFields: ['referenceFiles']
  });

  useEffect(() => {
    const persisted = loadPersistedData();
    if (persisted) {
      setFormData(prev => ({ ...prev, ...persisted }));
      
    }
  }, []);

  // Auto-select brand if only one exists
  useEffect(() => {
    if (!isLoadingData && brands.length === 1 && !formData.brand) {
      setFormData(prev => ({ ...prev, brand: brands[0].id }));
    }
  }, [isLoadingData, brands, formData.brand]);

  // Auto-select theme/persona when brand changes and only one exists
  useEffect(() => {
    if (!formData.brand) return;
    const brandThemes = themes.filter((t: any) => t.brandId === formData.brand);
    const brandPersonas = personas.filter((p: any) => p.brandId === formData.brand);
    
    if (brandThemes.length === 1 && !formData.theme) {
      setFormData(prev => ({ ...prev, theme: brandThemes[0].id }));
    }
    if (brandPersonas.length === 1 && !formData.persona) {
      setFormData(prev => ({ ...prev, persona: brandPersonas[0].id }));
    }
  }, [formData.brand, themes, personas]);

  // Auto-fill tone and platform from selected theme
  useEffect(() => {
    if (!formData.theme) return;
    const selectedTheme = themes.find((t: any) => t.id === formData.theme);
    if (!selectedTheme) return;
    
    // Auto-fill tone from theme if empty
    if (formData.tone.length === 0 && (selectedTheme as any).toneOfVoice) {
      const themeTones = (selectedTheme as any).toneOfVoice
        .split(',')
        .map((t: string) => t.trim().toLowerCase())
        .filter((t: string) => toneOptions.includes(t))
        .slice(0, 4);
      if (themeTones.length > 0) {
        setFormData(prev => ({ ...prev, tone: themeTones }));
        toast.info("Tom de voz preenchido automaticamente", {
          description: `Usando tom da pauta: ${themeTones.join(', ')}`,
          duration: 3000,
        });
      }
    }

    // Auto-fill platform from theme if empty
    if (!formData.platform && (selectedTheme as any).platforms) {
      const platformMap: Record<string, string> = {
        'instagram': 'Instagram',
        'facebook': 'Facebook',
        'tiktok': 'TikTok',
        'twitter': 'Twitter/X',
        'linkedin': 'LinkedIn',
        'x': 'Twitter/X',
      };
      const themePlatforms = (selectedTheme as any).platforms.split(',').map((p: string) => p.trim().toLowerCase());
      const matchedPlatform = themePlatforms.find((p: string) => platformMap[p]);
      if (matchedPlatform && platformMap[matchedPlatform]) {
        handleSelectChange('platform', platformMap[matchedPlatform]);
        toast.info("Plataforma preenchida automaticamente", {
          description: `Usando plataforma da pauta: ${platformMap[matchedPlatform]}`,
          duration: 3000,
        });
      }
    }
  }, [formData.theme]);

  // Auto-fill tone from user profile if no theme selected
  useEffect(() => {
    if (formData.tone.length === 0 && !formData.theme && user && (user as any).toneOfVoice) {
      const profileTones = ((user as any).toneOfVoice as string)
        .split(',')
        .map((t: string) => t.trim().toLowerCase())
        .filter((t: string) => toneOptions.includes(t))
        .slice(0, 4);
      if (profileTones.length > 0) {
        setFormData(prev => ({ ...prev, tone: profileTones }));
      }
    }
  }, [user, formData.theme]);

  // Computed context summary
  const contextSummary = useMemo(() => {
    const selectedBrand = brands.find(b => b.id === formData.brand);
    const selectedTheme = themes.find((t: any) => t.id === formData.theme);
    const selectedPersona = personas.find((p: any) => p.id === formData.persona);
    return {
      brand: selectedBrand,
      theme: selectedTheme,
      persona: selectedPersona,
      hasContext: !!(selectedBrand || selectedTheme || selectedPersona),
    };
  }, [formData.brand, formData.theme, formData.persona, brands, themes, personas]);

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
      setReferenceFiles((prev) => [...prev, ...files].slice(0, 5));
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

  const handleRemoveFile = (indexToRemove: number) => {
    const updatedFiles = referenceFiles.filter((_, index) => index !== indexToRemove);
    setReferenceFiles(updatedFiles);
    
    setPreserveImageIndices(prev => 
      prev
        .filter(idx => idx !== indexToRemove)
        .map(idx => idx > indexToRemove ? idx - 1 : idx)
    );
    
    if (updatedFiles.length === 0 && fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Filtered themes/personas based on brand
  const filteredThemes = useMemo(() => 
    formData.brand ? themes.filter((t) => t.brandId === formData.brand) : [],
    [themes, formData.brand]
  );
  const filteredPersonas = useMemo(() => 
    formData.brand ? personas.filter((p) => p.brandId === formData.brand) : [],
    [personas, formData.brand]
  );

  useEffect(() => {
    const selectedBrand = brands.find((b) => b.id === formData.brand);
    if (selectedBrand) {
      setBrandImages([]);
      supabase
        .from('brands')
        .select('logo, moodboard, reference_image')
        .eq('id', selectedBrand.id)
        .single()
        .then(({ data: fullBrand, error }) => {
          if (!error && fullBrand) {
            const images: string[] = [];
            const logo = fullBrand.logo as any;
            const moodboard = fullBrand.moodboard as any;
            const referenceImage = fullBrand.reference_image as any;
            if (logo?.content) images.push(logo.content);
            if (moodboard?.content) images.push(moodboard.content);
            if (referenceImage?.content) images.push(referenceImage.content);
            setBrandImages(images);
          }
        });
    } else {
      setBrandImages([]);
    }
  }, [brands, formData.brand]);

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setFormData((prev) => ({ ...prev, [e.target.id]: e.target.value }));
  };

  const handleSelectChange = (
    field: keyof Omit<FormData, "tone">,
    value: string
  ) => {
    try {
      if (!field || value === undefined) {
        console.error('❌ handleSelectChange: Invalid field or value', { field, value });
        toast.error("Erro ao atualizar campo", {
          description: "Por favor, tente novamente.",
        });
        return;
      }

      setFormData((prev) => ({ ...prev, [field]: value }));
      if (field === "brand") {
        setFormData((prev) => ({ 
          ...prev,
          brand: value,
          theme: "",
          persona: ""
        }));
      }
    
      if (field === "platform") {
        const guidelines = getCaptionGuidelines(value, contentType);
        setPlatformGuidelines(guidelines);
        
        const imageSpec = getPlatformImageSpec(value, "feed", contentType);
        if (imageSpec) {
          setRecommendedAspectRatio(imageSpec.aspectRatio);
          toast.info(`Proporção recomendada para ${value}`, {
            description: `${imageSpec.aspectRatio} (${imageSpec.width}x${imageSpec.height}px)`,
            duration: 4000
          });
        }
      }
    } catch (error) {
      console.error('❌ handleSelectChange error:', error);
      toast.error("Erro ao atualizar campo", {
        description: "Por favor, tente novamente.",
      });
    }
  };

  const handleToneSelect = (tone: string) => {
    if (!formData.tone.includes(tone)) {
      if (formData.tone.length >= 4) {
        toast.error("Limite atingido", {
          description: "Você pode selecionar no máximo 4 tons de voz.",
        });
        return;
      }
      setFormData((prev) => ({ ...prev, tone: [...prev.tone, tone] }));
    }
  };

  const handleToneRemove = (toneToRemove: string) => {
    setFormData((prev) => ({
      ...prev,
      tone: prev.tone.filter((t) => t !== toneToRemove),
    }));
  };

  const isFormValid = useMemo(() => {
    return (
      formData.brand &&
      formData.objective &&
      formData.platform &&
      formData.description &&
      formData.tone.length > 0
    );
  }, [
    formData.brand,
    formData.objective,
    formData.platform,
    formData.description,
    formData.tone.length,
  ]);

  const validateForm = () => {
    const missing: string[] = [];
    if (!formData.brand) missing.push('brand');
    if (!formData.objective) missing.push('objective');
    if (!formData.platform) missing.push('platform');
    if (!formData.description) missing.push('description');
    if (formData.tone.length === 0) missing.push('tone');
    // Imagens de referência são opcionais
    setMissingFields(missing);
    return missing.length === 0;
  };

  // Step 1: Show confirmation modal with prompt preview
  const handleRequestGeneration = () => {
    if (!user) return toast.error("Usuário não encontrado.");
    
    const availableCredits = user?.credits || 0;
    if (availableCredits <= 0)
      return toast.error("Seus créditos para criação de conteúdo acabaram.");
      
    if (!validateForm())
      return toast.error(
        "Por favor, preencha todos os campos obrigatórios (*)."
      );

    const selectedBrand = brands.find(b => b.id === formData.brand);
    const selectedTheme = themes.find(t => t.id === formData.theme);
    const selectedPersona = personas.find(p => p.id === formData.persona);

    const promptFields: PromptFormFields = {
      brandId: formData.brand,
      brandName: selectedBrand?.name || formData.brand,
      themeId: formData.theme,
      themeName: selectedTheme?.title || formData.theme,
      personaId: formData.persona,
      personaName: selectedPersona?.name || formData.persona,
      objective: formData.objective,
      description: formData.description,
      platform: formData.platform,
      contentType,
      tones: formData.tone,
      additionalInfo: formData.additionalInfo,
      vibeStyle: formData.vibeStyle || formData.visualStyle || 'professional',
      fontStyle: formData.fontStyle || 'modern',
      politicalTone: formData.politicalTone || 'institucional',
      includeText: formData.imageIncludeText || false,
      textContent: formData.imageTextContent?.trim() || '',
      textPosition: formData.imageTextPosition || 'center',
      negativePrompt: formData.negativePrompt,
      colorPalette: formData.colorPalette,
      lighting: formData.lighting,
      composition: formData.composition,
      cameraAngle: formData.cameraAngle,
      detailLevel: formData.detailLevel,
      mood: formData.mood,
      brandImagesCount: brandImages.length,
      userImagesCount: referenceFiles.length,
    };

    const preview = buildImagePromptString(promptFields);
    setPromptPreview(preview);
    setShowConfirmModal(true);
  };

  // Step 2: After confirm, show thesis recommendation modal
  const handleConfirmAndShowThesis = () => {
    setShowConfirmModal(false);
    setShowThesisModal(true);
  };

  const handleThesisSelected = (thesis: Thesis) => {
    setSelectedThesis(thesis);
    setShowThesisModal(false);
    handleGenerateContent(thesis);
  };

  const handleContinueWithoutThesis = () => {
    setSelectedThesis(null);
    setShowThesisModal(false);
    handleGenerateContent(null);
  };

  // Step 3: Actually generate after user confirms
  const handleGenerateContent = async (thesis: Thesis | null = null) => {
    if (!user) return toast.error("Usuário não encontrado.");

    setLoading(true);
    setGenerationStep(GenerationStep.GENERATING_IMAGE);
    setGenerationProgress(0);
    
    const toastId = toast.loading("🎨 Processando imagens de referência...", {
      description: "Convertendo arquivos para análise (0%)",
    });

    try {
      const compressImage = async (file: File): Promise<string> => {
        return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
              const canvas = document.createElement('canvas');
              const ctx = canvas.getContext('2d')!;
              const MAX_WIDTH = 1024;
              const MAX_HEIGHT = 1024;
              let width = img.width;
              let height = img.height;
              if (width > height) {
                if (width > MAX_WIDTH) { height *= MAX_WIDTH / width; width = MAX_WIDTH; }
              } else {
                if (height > MAX_HEIGHT) { width *= MAX_HEIGHT / height; height = MAX_HEIGHT; }
              }
              canvas.width = width;
              canvas.height = height;
              ctx.drawImage(img, 0, 0, width, height);
              const base64 = canvas.toDataURL('image/jpeg', 0.8);
              resolve(base64);
            };
            img.onerror = reject;
            img.src = e.target?.result as string;
          };
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
      };

      const referenceImagesBase64: string[] = [];
      for (let i = 0; i < referenceFiles.length; i++) {
        const file = referenceFiles[i];
        toast.loading("🎨 Processando imagens de referência...", {
          id: toastId,
          description: `Comprimindo imagem ${i + 1}/${referenceFiles.length}...`,
        });
        const base64 = await compressImage(file);
        referenceImagesBase64.push(base64);
      }

      setGenerationProgress(10);
      toast.loading("🎨 Preparando geração...", {
        id: toastId,
        description: "Analisando referências (10%)",
      });

      const maxTotalImages = 5;
      const brandImagesCount = brandImages.length;
      const userImagesCount = referenceImagesBase64.length;
      
      let finalBrandImages = brandImages;
      let finalUserImages = referenceImagesBase64;
      
      if (brandImagesCount + userImagesCount > maxTotalImages) {
        const availableSlots = Math.max(0, maxTotalImages - brandImagesCount);
        finalUserImages = referenceImagesBase64.slice(0, availableSlots);
        if (availableSlots < userImagesCount) {
          toast.warning(
            `Limite de imagens atingido. Usando ${brandImagesCount} imagens da marca + ${availableSlots} suas imagens (total: ${brandImagesCount + availableSlots})`,
            { duration: 5000 }
          );
        }
      }

      const selectedBrand = brands.find(b => b.id === formData.brand);
      const selectedTheme = themes.find(t => t.id === formData.theme);
      const selectedPersona = personas.find(p => p.id === formData.persona);

      // Build prompt payload using helper function
      const promptFields: PromptFormFields = {
        brandId: formData.brand,
        brandName: selectedBrand?.name || formData.brand,
        themeId: formData.theme,
        themeName: selectedTheme?.title || formData.theme,
        personaId: formData.persona,
        personaName: selectedPersona?.name || formData.persona,
        objective: formData.objective,
        description: formData.description,
        platform: formData.platform,
        contentType,
        tones: formData.tone,
        additionalInfo: formData.additionalInfo,
        vibeStyle: formData.vibeStyle || formData.visualStyle || 'professional',
        fontStyle: formData.fontStyle || 'modern',
        politicalTone: formData.politicalTone || 'institucional',
        includeText: formData.imageIncludeText || false,
        textContent: formData.imageTextContent?.trim() || '',
        textPosition: formData.imageTextPosition || 'center',
        negativePrompt: formData.negativePrompt,
        colorPalette: formData.colorPalette,
        lighting: formData.lighting,
        composition: formData.composition,
        cameraAngle: formData.cameraAngle,
        detailLevel: formData.detailLevel,
        mood: formData.mood,
        brandImagesCount: finalBrandImages.length,
        userImagesCount: finalUserImages.length,
      };

      const requestData = buildRequestPayload(promptFields, {
        preserveImages: finalBrandImages,
        styleReferenceImages: finalUserImages,
        teamId: user?.teamId || '',
        width: formData.width,
        height: formData.height,
      });

      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      
      if (!formData.brand || !uuidRegex.test(formData.brand)) {
        toast.error("Por favor, selecione uma marca válida", { id: toastId });
        return;
      }
      if (formData.theme && !uuidRegex.test(formData.theme)) {
        toast.error("Tema estratégico inválido", { id: toastId });
        return;
      }
      if (formData.persona && !uuidRegex.test(formData.persona)) {
        toast.error("Persona inválida", { id: toastId });
        return;
      }

      toast.loading("Gerando imagem com IA...", {
        id: toastId,
        description: `Usando ${finalBrandImages.length} imagem(ns) da marca + ${finalUserImages.length} sua(s) imagem(ns) de referência.`,
      });

      const imageResponse = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-image`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify(requestData),
        }
      );

      if (!imageResponse.ok) {
        const errorText = await imageResponse.text();
        throw new Error(`Erro ao gerar imagem: ${errorText}`);
      }

      const imageResult = await imageResponse.json();
      const { imageUrl, imageUrls } = imageResult;
      
      setGenerationStep(GenerationStep.GENERATING_CAPTION);
      setGenerationProgress(60);
      
      toast.loading("✍️ Gerando legenda profissional...", {
        id: toastId,
        description: `${(imageUrls?.length || 1)} imagem(ns) criada(s) | Escrevendo copy criativa (60%)`,
      });

      const captionResponse = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-caption`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({
            formData: {
              ...requestData,
              imageDescription: requestData.description,
              audience: selectedPersona?.name || "",
            }
          }),
        }
      );

      let captionData;
      let isLocalFallback = false;
      
      if (captionResponse.ok) {
        const responseData = await captionResponse.json();
        if (responseData.fallback) {
          console.warn("⚠️ API retornou fallback:", responseData.error);
          isLocalFallback = true;
          toast.warning("Legenda gerada localmente", {
            description: "Usando fallback local devido a erro na API de legenda.",
            duration: 4000,
          });
        }
        captionData = responseData.fallback ? null : responseData;
      } else {
        const errorText = await captionResponse.text();
        console.error("❌ Erro na geração de legenda:", errorText);
        isLocalFallback = true;
        toast.error("Erro ao gerar legenda", {
          description: "Usando legenda padrão. Você pode editá-la depois.",
          duration: 4000,
        });
      }

      if (!captionData || isLocalFallback) {
        const brandName = selectedBrand?.name || formData.brand;
        const themeName = selectedTheme?.title || formData.theme || "Nossa proposta";
        const platform = formData.platform;
        
        const platformSpecs = {
          Instagram: { maxLength: 2200, recommendedHashtags: 10 },
          Facebook: { maxLength: 250, recommendedHashtags: 3 },
          LinkedIn: { maxLength: 600, recommendedHashtags: 5 },
          TikTok: { maxLength: 150, recommendedHashtags: 5 },
          Twitter: { maxLength: 280, recommendedHashtags: 2 },
        }[platform] || { maxLength: 500, recommendedHashtags: 5 };

        const fallbackBody = `🌟 ${brandName} apresenta: ${themeName}\n\n${formData.description}\n\n💡 ${formData.objective}\n\n🎯 Tom: ${formData.tone.join(", ")}\n\n💬 Comente o que achou!`;

        captionData = {
          title: `${brandName} | ${themeName} 🚀`,
          body: fallbackBody.substring(0, platformSpecs.maxLength - 100),
          hashtags: [
            brandName.toLowerCase().replace(/\s+/g, ""),
            themeName.toLowerCase().replace(/\s+/g, ""),
            platform.toLowerCase(),
            "marketingdigital",
            "conteudocriativo",
            ...formData.tone.map(t => t.toLowerCase())
          ].filter((tag, index, self) => 
            tag && tag.length > 2 && self.indexOf(tag) === index
          ).slice(0, platformSpecs.recommendedHashtags)
        };
      }

      setGenerationStep(GenerationStep.SAVING);
      setGenerationProgress(80);
      
      toast.loading("💾 Preparando resultado...", {
        id: toastId,
        description: "Finalizando geração (80%)",
      });

      if (!imageUrl || !captionData?.title || !captionData?.body) {
        throw new Error("Dados incompletos na geração");
      }

      const generatedContent = {
        type: "image" as const,
        mediaUrl: imageUrl,
        mediaUrls: imageUrls || [imageUrl],
        platform: formData.platform,
        brand: selectedBrand?.name || formData.brand,
        title: captionData.title,
        body: captionData.body,
        hashtags: captionData.hashtags,
        originalFormData: {
          ...requestData,
          brandId: formData.brand,
        },
        actionId: imageResult.actionId,
        isLocalFallback,
      };
      
      if (refreshUserCredits) {
        await refreshUserCredits();
      }
      
      setGenerationStep(GenerationStep.COMPLETE);
      setGenerationProgress(100);
      
      const imageCount = imageUrls?.length || 1;
      toast.success("✅ Conteúdo gerado com sucesso!", {
        id: toastId,
        description: `${imageCount} imagem(ns) e legenda criados com Gemini 3 Pro 🚀`,
        duration: 1500,
      });
      
      clearPersistedData();
      
      navigate("/result", { 
        state: { contentData: generatedContent },
        replace: false 
      });
    } catch (err: any) {
      console.error("Erro ao gerar conteúdo:", err);
      
      if (err.message?.includes('compliance_violation')) {
        try {
          const errorMatch = err.message.match(/\{.*\}/);
          if (errorMatch) {
            const errorData = JSON.parse(errorMatch[0]);
            toast.error("Solicitação não permitida", {
              id: toastId,
              description: errorData.message || "A solicitação viola regulamentações publicitárias brasileiras",
              duration: 8000,
            });
            if (errorData.recommendation) {
              setTimeout(() => {
                toast.info("Sugestão", {
                  description: errorData.recommendation,
                  duration: 10000,
                });
              }, 500);
            }
            return;
          }
        } catch (parseError) {
          console.error("Erro ao parsear erro de compliance:", parseError);
        }
      }
      
      let errorMessage = "Erro ao gerar o conteúdo.";
      let errorDescription = "Por favor, tente novamente.";
      
      if (err.message?.includes("Network")) {
        errorMessage = "Erro de conexão";
        errorDescription = "Verifique sua internet e tente novamente.";
      } else if (err.message?.includes("timeout")) {
        errorMessage = "Tempo esgotado";
        errorDescription = "A geração demorou muito. Tente novamente.";
      } else if (err.message?.includes("API")) {
        errorMessage = "Erro na API";
        errorDescription = "Serviço temporariamente indisponível.";
      } else if (err.message) {
        errorDescription = err.message;
      }
      
      toast.error(errorMessage, { 
        id: toastId,
        description: errorDescription,
        duration: 5000
      });
    } finally {
      setLoading(false);
      setGenerationStep(GenerationStep.IDLE);
      setGenerationProgress(0);
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
        tours={[
          {
            tourType: 'navbar',
            steps: navbarSteps,
            label: 'Tour da Navegação',
            targetElement: '#sidebar-logo'
          },
          {
            tourType: 'create_content',
            steps: createContentSteps,
            label: 'Tour de Criar Conteúdo',
            targetElement: '#select-brand'
          }
        ]}
        startDelay={500}
      />

      {/* Banner */}
      <div className="relative h-48 md:h-64 lg:h-72 overflow-hidden">
        <PageBreadcrumb
          items={[{ label: "Criar Conteúdo", href: "/create" }, { label: "Criar Imagem" }]}
          variant="overlay"
        />
        <img
          src={createBanner}
          alt="Criar Imagem"
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
                  <ImageIcon className="h-5 w-5 md:h-6 md:w-6 lg:h-8 lg:w-8" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h1 className="text-xl md:text-2xl lg:text-3xl font-bold text-foreground">
                      Criar Imagem
                    </h1>
                    <Popover>
                      <PopoverTrigger asChild>
                        <button className="text-muted-foreground hover:text-foreground transition-colors">
                          <HelpCircle className="h-4 w-4" />
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="text-sm w-72" side="bottom">
                        <p className="font-medium mb-1">Criar Imagem</p>
                        <p className="text-muted-foreground text-xs">
                          Gere imagens profissionais com IA. Selecione marca, tema e persona para personalizar o resultado com sua identidade visual.
                        </p>
                      </PopoverContent>
                    </Popover>
                  </div>
                  <p className="text-muted-foreground text-xs md:text-sm">
                    Gere imagens profissionais com IA
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
          {/* Progress Bar */}
          <CreationProgressBar currentStep={loading ? "generating" : "config"} className="max-w-xs mx-auto" />

          <div className="space-y-4">
            {/* 1. Descrição */}
            <Card className="border-0 shadow-lg rounded-2xl overflow-hidden">
              <CardContent className="p-4 md:p-5 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="objective" className="text-sm font-bold text-foreground">
                    Objetivo do Post <span className="text-destructive">*</span>
                  </Label>
                  <Textarea
                    id="objective"
                    placeholder="Qual a principal meta? (ex: gerar engajamento, anunciar um produto)"
                    value={formData.objective}
                    onChange={handleInputChange}
                    rows={3}
                    className={`resize-none rounded-xl border-2 bg-background/50 text-sm transition-all ${
                      missingFields.includes('objective') 
                        ? 'border-destructive ring-2 ring-destructive/20' 
                        : 'border-border/50 hover:border-border/70 focus:border-primary/50'
                    }`}
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="description" className="text-sm font-bold text-foreground">
                      Descrição Visual da Imagem <span className="text-destructive">*</span>
                    </Label>
                    <span className={`text-xs font-medium ${
                      formData.description.length > 5000 ? 'text-destructive' 
                        : formData.description.length > 4500 ? 'text-orange-500' 
                        : 'text-muted-foreground'
                    }`}>
                      {formData.description.length}/5000
                    </span>
                  </div>
                  <Textarea
                    id="description"
                    placeholder="Descreva a cena, iluminação e emoção desejada..."
                    value={formData.description}
                    onChange={handleInputChange}
                    maxLength={5000}
                    rows={5}
                    className={`resize-none rounded-xl border-2 bg-background/50 text-sm transition-all ${
                      missingFields.includes('description') 
                        ? 'border-destructive ring-2 ring-destructive/20' 
                        : 'border-border/50 hover:border-border/70 focus:border-primary/50'
                    }`}
                  />
                  <p className="text-xs text-muted-foreground flex items-start gap-1.5">
                    <Info className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                    <span>Seja específico sobre cena, iluminação, cores e estilo desejado</span>
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* 2. Contexto Estratégico */}
            <Card className="border-0 shadow-lg rounded-2xl overflow-hidden">
              <CardContent className="p-4 md:p-5 space-y-4">
                <div className="flex items-center gap-2 mb-1">
                  <div className="h-6 w-1 bg-primary rounded-full" />
                  <h3 className="text-sm font-bold text-foreground">Contexto Estratégico</h3>
                  {contextSummary.hasContext && (
                    <Badge variant="secondary" className="text-[10px] bg-primary/10 text-primary border-primary/20">
                      Auto-preenchido
                    </Badge>
                  )}
                </div>

                {/* Context Summary */}
                {contextSummary.hasContext && (
                  <div className="bg-primary/5 border border-primary/15 rounded-xl p-3 space-y-2">
                    {contextSummary.brand && (
                      <div className="flex items-center gap-2 text-xs">
                        <span className="font-semibold text-primary min-w-[80px]">Identidade:</span>
                        <span className="text-foreground">{contextSummary.brand.name}</span>
                      </div>
                    )}
                    {contextSummary.theme && (
                      <div className="flex items-center gap-2 text-xs">
                        <span className="font-semibold text-primary min-w-[80px]">Pauta:</span>
                        <span className="text-foreground">{(contextSummary.theme as any).title}</span>
                        {(contextSummary.theme as any).objectiveType && (
                          <Badge variant="outline" className="text-[10px] py-0 h-4">{(contextSummary.theme as any).objectiveType}</Badge>
                        )}
                      </div>
                    )}
                    {contextSummary.persona && (
                      <div className="flex items-center gap-2 text-xs">
                        <span className="font-semibold text-primary min-w-[80px]">Audiência:</span>
                        <span className="text-foreground">
                          {(contextSummary.persona as any).name}
                          {(contextSummary.persona as any).location && ` · ${(contextSummary.persona as any).location}`}
                        </span>
                      </div>
                    )}
                    {formData.tone.length > 0 && (
                      <div className="flex items-center gap-2 text-xs">
                        <span className="font-semibold text-primary min-w-[80px]">Tom:</span>
                        <div className="flex flex-wrap gap-1">
                          {formData.tone.map(t => (
                            <Badge key={t} variant="secondary" className="text-[10px] py-0 h-4 bg-primary/10 text-primary capitalize">{t}</Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Marca / Identidade */}
                  {isLoadingData ? <SelectSkeleton /> : (
                    <div className="space-y-1.5">
                      <Label htmlFor="brand" className="text-sm font-bold text-foreground">
                        Identidade <span className="text-destructive">*</span>
                      </Label>
                      <NativeSelect
                        value={formData.brand}
                        onValueChange={(value) => handleSelectChange("brand", value)}
                        options={brands.map((b) => ({ value: b.id, label: b.name }))}
                        placeholder={brands.length === 0 ? "Nenhuma identidade cadastrada" : "Selecione a identidade"}
                        disabled={brands.length === 0}
                        triggerClassName={`h-10 rounded-lg border-2 bg-background/50 hover:border-border/70 transition-colors ${
                          missingFields.includes('brand') ? 'border-destructive ring-2 ring-destructive/20' : 'border-border/50'
                        }`}
                      />
                      {!isLoadingData && brands.length === 0 && (
                        <p className="text-xs text-muted-foreground">
                          Cadastre uma identidade antes.{" "}
                          <button onClick={() => navigate("/brands")} className="text-primary hover:underline font-medium">
                            Ir para Identidade
                          </button>
                        </p>
                      )}
                    </div>
                  )}

                  {/* Pauta Estratégica */}
                  {isLoadingData ? <SelectSkeleton /> : (
                    <div className="space-y-1.5">
                      <Label htmlFor="theme" className="text-sm font-bold text-foreground">
                        Pauta Estratégica <span className="text-muted-foreground font-normal text-xs">(preenche tom e plataforma)</span>
                      </Label>
                      <NativeSelect
                        value={formData.theme}
                        onValueChange={(value) => handleSelectChange("theme", value)}
                        options={filteredThemes.map((t: any) => ({ value: t.id, label: t.title }))}
                        placeholder={!formData.brand ? "Selecione uma identidade primeiro" : filteredThemes.length === 0 ? "Nenhuma pauta disponível" : "Selecione uma pauta"}
                        disabled={!formData.brand || filteredThemes.length === 0}
                        triggerClassName="h-10 rounded-lg border-2 border-border/50 bg-background/50 hover:border-border/70 transition-colors"
                      />
                    </div>
                  )}

                  {/* Audiência / Persona */}
                  {isLoadingData ? <SelectSkeleton /> : (
                    <div className="space-y-1.5">
                      <Label htmlFor="persona" className="text-sm font-bold text-foreground">
                        Audiência <span className="text-muted-foreground font-normal text-xs">(opcional)</span>
                      </Label>
                      <NativeSelect
                        value={formData.persona}
                        onValueChange={(value) => handleSelectChange("persona", value)}
                        options={filteredPersonas.map((p: any) => ({ value: p.id, label: p.name }))}
                        placeholder={!formData.brand ? "Selecione uma identidade primeiro" : filteredPersonas.length === 0 ? "Nenhuma audiência cadastrada" : "Selecione uma audiência"}
                        disabled={!formData.brand || filteredPersonas.length === 0}
                        triggerClassName="h-10 rounded-lg border-2 border-border/50 bg-background/50 hover:border-border/70 transition-colors"
                      />
                    </div>
                  )}

                  {/* Plataforma */}
                  <div className="space-y-1.5">
                    <Label htmlFor="platform" className="text-sm font-bold text-foreground">
                      Plataforma <span className="text-destructive">*</span>
                      {formData.platform && (
                        <Badge variant="outline" className="ml-2 text-[10px] py-0 h-4">
                          {recommendedAspectRatio || 'auto'}
                        </Badge>
                      )}
                    </Label>
                    <NativeSelect
                      value={formData.platform}
                      onValueChange={(value) => handleSelectChange("platform", value)}
                      options={[
                        { value: "Instagram", label: "Instagram" },
                        { value: "Facebook", label: "Facebook" },
                        { value: "TikTok", label: "TikTok" },
                        { value: "Twitter/X", label: "Twitter (X)" },
                        { value: "LinkedIn", label: "LinkedIn" },
                        { value: "Comunidades", label: "Comunidades" },
                      ]}
                      placeholder="Onde será postado?"
                      triggerClassName={`h-10 rounded-lg border-2 bg-background/50 hover:border-border/70 transition-colors ${
                        missingFields.includes('platform') ? 'border-destructive ring-2 ring-destructive/20' : 'border-border/50'
                      }`}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {platformGuidelines.length > 0 && (
              <Card className="bg-primary/5 border-primary/20">
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <Info className="h-4 w-4 text-primary flex-shrink-0" />
                    <p className="text-sm font-semibold text-primary">
                      Diretrizes para {formData.platform} ({contentType === "organic" ? "Orgânico" : "Anúncio"})
                    </p>
                  </div>
                  <ul className="space-y-1 text-xs text-muted-foreground">
                    {platformGuidelines.map((guideline, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span className="text-primary mt-0.5">•</span>
                        <span>{guideline}</span>
                      </li>
                    ))}
                  </ul>
                  {recommendedAspectRatio && (
                    <p className="text-xs text-primary/80 font-medium mt-2 pt-2 border-t border-primary/20">
                      💡 Proporção recomendada: {recommendedAspectRatio}
                    </p>
                  )}
                </CardContent>
              </Card>
            )}

            {/* 3. Tom/Objetivo Político + Estilo Visual */}
            <Card className="border-0 shadow-lg rounded-2xl overflow-hidden">
              <CardContent className="p-4 md:p-5 space-y-4">
                <div className="flex items-center gap-2 mb-1">
                  <div className="h-6 w-1 bg-primary rounded-full" />
                  <h3 className="text-sm font-bold text-foreground">Diretrizes Estratégicas</h3>
                </div>

                {/* Tom/Objetivo Político */}
                <div className="space-y-2">
                  <Label className="text-sm font-bold text-foreground">
                    Tom / Objetivo <span className="text-destructive">*</span>
                  </Label>
                  <div className="grid grid-cols-2 gap-2">
                    {POLITICAL_TONE_OPTIONS.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, politicalTone: option.value }))}
                        className={`text-left p-3 rounded-xl border-2 transition-all ${
                          formData.politicalTone === option.value
                            ? 'border-primary bg-primary/10 ring-2 ring-primary/20'
                            : 'border-border/50 bg-background/50 hover:border-border/70'
                        }`}
                      >
                        <span className="text-sm font-semibold text-foreground">{option.label}</span>
                        <p className="text-[10px] text-muted-foreground mt-0.5 leading-tight">{option.description}</p>
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground flex items-start gap-1.5">
                    <Info className="h-3 w-3 mt-0.5 flex-shrink-0" />
                    <span>Define automaticamente contraste, iluminação e composição da imagem</span>
                  </p>
                </div>

                <Separator className="my-2" />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="visualStyle" className="text-sm font-bold text-foreground">
                      Vibe Visual
                    </Label>
                    <NativeSelect
                      value={formData.vibeStyle || 'professional'}
                      onValueChange={(value) => {
                        setFormData(prev => ({ ...prev, vibeStyle: value, visualStyle: value }));
                      }}
                      options={[
                        { value: 'minimalist', label: '✨ Minimalista' },
                        { value: 'pop_neon', label: '🌈 Pop/Neon' },
                        { value: 'professional', label: '💼 Profissional' },
                        { value: 'cinematic', label: '🎬 Cinematográfico' },
                        { value: '3d_modern', label: '🧊 3D Moderno' },
                        { value: 'illustration', label: '🎨 Ilustração' },
                      ]}
                      placeholder="Selecione uma vibe"
                      triggerClassName="h-10 rounded-lg border-2 border-border/50 bg-background/50 hover:border-border/70 transition-colors"
                    />
                    <p className="text-xs text-muted-foreground flex items-start gap-1.5">
                      <Info className="h-3 w-3 mt-0.5 flex-shrink-0" />
                      <span>Define a estética e atmosfera visual</span>
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-sm font-bold text-foreground">
                      Tipo de Conteúdo <span className="text-destructive">*</span>
                    </Label>
                    <div id="content-type-selector" className="flex items-center space-x-1 rounded-lg bg-muted p-1 border-2 border-border/30 h-10">
                      <Button
                        type="button"
                        variant={contentType === "organic" ? "default" : "ghost"}
                        onClick={() => {
                          setContentType("organic");
                          if (formData.platform) {
                            const guidelines = getCaptionGuidelines(formData.platform, "organic");
                            setPlatformGuidelines(guidelines);
                          }
                          toast.info("📢 Conteúdo Orgânico", {
                            description: "A IA gerará conteúdo focado em engajamento natural, sem linguagem promocional direta. Ideal para posts de feed, stories e conteúdo educativo.",
                            duration: 5000,
                          });
                        }}
                        className="flex-1 rounded-md font-semibold h-7 text-xs"
                      >
                        Orgânico
                      </Button>
                      <Button
                        type="button"
                        variant={contentType === "ads" ? "default" : "ghost"}
                        onClick={() => {
                          setContentType("ads");
                          if (formData.platform) {
                            const guidelines = getCaptionGuidelines(formData.platform, "ads");
                            setPlatformGuidelines(guidelines);
                          }
                          toast.info("💰 Conteúdo de Anúncio", {
                            description: "A IA gerará conteúdo com foco em conversão, incluindo CTAs diretos, linguagem persuasiva e compliance com políticas de anúncios da plataforma.",
                            duration: 5000,
                          });
                        }}
                        className="flex-1 rounded-md font-semibold h-7 text-xs"
                      >
                        Anúncio
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground flex items-start gap-1.5">
                      <Info className="h-3 w-3 mt-0.5 flex-shrink-0" />
                      <span>Define as diretrizes de criação do conteúdo</span>
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Tipografia (condicional ao texto na imagem) */}
            {formData.imageIncludeText && (
              <Card className="border-0 shadow-lg rounded-2xl overflow-hidden">
                <CardContent className="p-4 md:p-5">
                  <div className="space-y-1.5">
                    <Label className="text-sm font-bold text-foreground">
                      Estilo de Tipografia
                    </Label>
                    <NativeSelect
                      value={formData.fontStyle || 'modern'}
                      onValueChange={(value) => setFormData(prev => ({ ...prev, fontStyle: value }))}
                      options={[
                        { value: 'elegant', label: '✒️ Elegante — Serifa clássica, refinada' },
                        { value: 'modern', label: '🔤 Moderna — Sans-serif limpa, geométrica' },
                        { value: 'fun', label: '🎉 Divertida — Script casual ou display arrojada' },
                        { value: 'impactful', label: '💥 Impactante — Bold condensada, display forte' },
                      ]}
                      placeholder="Selecione tipografia"
                      triggerClassName="h-10 rounded-lg border-2 border-border/50 bg-background/50 hover:border-border/70 transition-colors"
                    />
                    <p className="text-xs text-muted-foreground flex items-start gap-1.5">
                      <Info className="h-3 w-3 mt-0.5 flex-shrink-0" />
                      <span>Define o estilo da fonte do texto na imagem</span>
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* 4. Tom de Voz */}
            <Card className="border-0 shadow-lg rounded-2xl overflow-hidden">
              <CardContent className="p-4 md:p-5 space-y-2">
                <Label htmlFor="tone" className="text-sm font-bold text-foreground">
                  Tom de Voz <span className="text-destructive">*</span> <span className="text-muted-foreground font-normal text-xs">(máximo 4)</span>
                </Label>
                <Select onValueChange={handleToneSelect} value="">
                  <SelectTrigger className={`h-10 rounded-lg border-2 bg-background/50 text-sm transition-colors ${
                    missingFields.includes('tone') ? 'border-destructive ring-2 ring-destructive/20' : 'border-border/50 hover:border-border/70'
                  }`}>
                    <SelectValue placeholder="Selecione um tom de voz" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border-border/20">
                    {toneOptions.map((t) => (
                      <SelectItem key={t} value={t} className="rounded-lg capitalize">{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {formData.tone.length > 0 && (
                  <div className="flex flex-wrap gap-2 p-3 bg-primary/5 rounded-xl border border-primary/20">
                    {formData.tone.map((t) => (
                      <Badge
                        key={t}
                        variant="secondary"
                        className="bg-primary/10 text-primary border-primary/30 pr-1 text-xs font-medium gap-2 hover:bg-primary/20 transition-colors"
                      >
                        {t}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleToneRemove(t)}
                          className="h-4 w-4 p-0 hover:bg-destructive/20 rounded-full"
                        >
                          <X className="h-3 w-3 text-destructive" />
                        </Button>
                      </Badge>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* 5. Imagens de Referência */}
            <Card className="border-0 shadow-lg rounded-2xl overflow-hidden">
              <CardContent className="p-4 md:p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-bold text-foreground flex items-center gap-2">
                    <ImagePlus className="h-4 w-4" />
                    Imagens de Referência <span className="text-muted-foreground text-xs font-normal">(opcional)</span>
                  </Label>
                  <span className={`text-xs font-medium ${
                    referenceFiles.length >= 5 ? 'text-destructive' 
                      : referenceFiles.length >= 4 ? 'text-orange-500' 
                      : 'text-muted-foreground'
                  }`}>
                    {referenceFiles.length}/5 imagens
                  </span>
                </div>

                <Input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  disabled={referenceFiles.length >= 5}
                  onChange={(e) => {
                    const files = Array.from(e.target.files || []);
                    const maxFiles = 5;
                    const remainingSlots = maxFiles - referenceFiles.length;
                    const filesToAdd = files.slice(0, remainingSlots);
                    if (files.length > remainingSlots) {
                      toast.error(`Você pode adicionar no máximo 5 imagens. ${filesToAdd.length} imagem(ns) adicionada(s).`);
                    }
                    setReferenceFiles((prev) => [...prev, ...filesToAdd]);
                  }}
                  className={`h-11 rounded-xl border-2 bg-background/50 transition-all file:mr-4 file:h-full file:py-0 file:px-5 file:rounded-l-[10px] file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90 hover:border-primary/30 ${
                    missingFields.includes('referenceFiles') ? 'border-destructive ring-2 ring-destructive/20' : 'border-border/50'
                  }`}
                />

                <div
                  ref={pasteAreaRef}
                  tabIndex={0}
                  onPaste={handlePaste}
                  className={`border-2 border-dashed rounded-xl p-4 text-center bg-muted/20 hover:bg-muted/30 transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/50 ${
                    missingFields.includes('referenceFiles') 
                      ? 'border-destructive' 
                      : 'border-border/50'
                  }`}
                >
                  <ImagePlus className="h-8 w-8 mx-auto mb-2 text-muted-foreground/60" />
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
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRemoveFile(idx)}
                              className="h-7 w-7 p-0 hover:bg-destructive/10 hover:text-destructive flex-shrink-0"
                            >
                              <X className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                          <div className="flex items-center gap-2 pl-4">
                            <Checkbox
                              id={`preserve-${idx}`}
                              checked={preserveImageIndices.includes(idx)}
                              onCheckedChange={() => handleTogglePreserve(idx)}
                              className="mt-0.5"
                            />
                            <Label htmlFor={`preserve-${idx}`} className="text-xs text-muted-foreground cursor-pointer">
                              Preservar traços desta imagem na geração final
                            </Label>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

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

            {/* 6. Informações Adicionais */}
            <Card className="border-0 shadow-lg rounded-2xl overflow-hidden">
              <CardContent className="p-4 md:p-5 space-y-2">
                <Label htmlFor="additionalInfo" className="text-sm font-bold text-foreground">
                  Informações Adicionais <span className="text-muted-foreground font-normal text-xs">(opcional)</span>
                </Label>
                <Textarea
                  id="additionalInfo"
                  placeholder="Outras instruções ou contexto relevante..."
                  value={formData.additionalInfo}
                  onChange={handleInputChange}
                  rows={3}
                  className="resize-none rounded-xl border-2 border-border/50 bg-background/50 text-sm hover:border-border/70 focus:border-primary/50 transition-colors"
                />
              </CardContent>
            </Card>
          </div>

          {/* Botão Gerar Conteúdo */}
          <div className="flex justify-end pb-6">
            <Button
              id="generate-button"
              onClick={handleRequestGeneration}
              disabled={loading || !isFormValid}
              size="lg"
              className="bg-gradient-to-r from-primary via-accent to-primary bg-[length:200%_100%] animate-gradient text-primary-foreground hover:opacity-90 transition-opacity shadow-lg gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="animate-spin h-5 w-5" />
                  <span>Gerando imagem...</span>
                </>
              ) : (
                <>
                  <Sparkles className="h-5 w-5" />
                  <span>Gerar Imagem</span>
                  <Badge variant="secondary" className="ml-2 bg-primary-foreground/20 text-primary-foreground border-primary-foreground/30">
                    <Coins className="h-3 w-3 mr-1" />
                    {CREDIT_COSTS.COMPLETE_IMAGE}
                  </Badge>
                </>
              )}
            </Button>
          </div>
        </div>
      </main>

      {/* Confirmation Modal — Prompt Preview */}
      <Dialog open={showConfirmModal} onOpenChange={setShowConfirmModal}>
        <DialogContent className="max-w-2xl max-h-[85vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5 text-primary" />
              Revisar Briefing antes de gerar
            </DialogTitle>
            <DialogDescription>
              Este é o briefing consolidado que será enviado para a IA. Revise e confirme para iniciar a geração.
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="max-h-[50vh] rounded-md border bg-muted/30 p-4">
            <div className="space-y-3 text-sm font-mono whitespace-pre-wrap">
              {promptPreview.split('###').filter(Boolean).map((section, idx) => {
                const [title, ...content] = section.trim().split('\n');
                return (
                  <div key={idx} className="space-y-1">
                    <h4 className="font-bold text-primary text-xs uppercase tracking-wider">
                      {title}
                    </h4>
                    <p className="text-foreground/80 text-xs leading-relaxed">
                      {content.join('\n')}
                    </p>
                  </div>
                );
              })}
            </div>
          </ScrollArea>

          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Coins className="h-3.5 w-3.5" />
            <span>Custo: <strong>{CREDIT_COSTS.COMPLETE_IMAGE} créditos</strong></span>
            <span className="mx-1">•</span>
            <span>{referenceFiles.length} imagem(ns) de referência</span>
            {brandImages.length > 0 && (
              <>
                <span className="mx-1">+</span>
                <span>{brandImages.length} da identidade</span>
              </>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setShowConfirmModal(false)}>
              Voltar e editar
            </Button>
            <Button onClick={handleGenerateContent} className="gap-2">
              <Sparkles className="h-4 w-4" />
              Confirmar e Gerar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
