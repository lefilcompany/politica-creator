'use client';

import { useState, useEffect, useCallback, ChangeEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tag, HelpCircle, Save, Loader2, X, ChevronDown } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ColorPicker } from '@/components/ui/color-picker';
import { Skeleton } from '@/components/ui/skeleton';
import type { Brand, MoodboardFile, ColorItem } from '@/types/brand';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useTranslation } from '@/hooks/useTranslation';
import { TourSelector } from '@/components/onboarding/TourSelector';
import { brandsSteps, navbarSteps } from '@/components/onboarding/tourSteps';
import brandsBanner from '@/assets/brands-banner.jpg';
import { PageBreadcrumb } from '@/components/PageBreadcrumb';

type BrandFormData = Omit<Brand, 'id' | 'createdAt' | 'updatedAt' | 'teamId' | 'userId'>;

const initialFormData: BrandFormData = {
  name: '',
  responsible: '',
  segment: '',
  values: '',
  keywords: '',
  goals: '',
  inspirations: '',
  successMetrics: '',
  references: '',
  specialDates: '',
  promise: '',
  crisisInfo: '',
  milestones: '',
  collaborations: '',
  restrictions: '',
  moodboard: null,
  logo: null,
  referenceImage: null,
  colorPalette: null,
  brandColor: null,
  avatarUrl: null,
};

export default function MarcasPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState<BrandFormData>(initialFormData);
  const [isSaving, setIsSaving] = useState(false);
  const [members, setMembers] = useState<{ email: string; name: string }[]>([]);

  // Fetch existing brands - if one exists, redirect to it
  const { data: existingBrands, isLoading } = useQuery({
    queryKey: ['brands', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from('brands')
        .select('id')
        .order('created_at', { ascending: true })
        .limit(1);
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id,
  });

  // Auto-redirect to existing brand
  useEffect(() => {
    if (existingBrands && existingBrands.length > 0) {
      navigate(`/brands/${existingBrands[0].id}`, { replace: true });
    }
  }, [existingBrands, navigate]);

  // Load team members for responsible select
  useEffect(() => {
    const loadMembers = async () => {
      if (!user?.teamId) return;
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('email, name')
          .eq('team_id', user.teamId)
          .order('name', { ascending: true });
        if (error) throw error;
        setMembers(data || []);
      } catch (error) {
        console.error('Erro ao carregar membros:', error);
        setMembers([]);
      }
    };
    loadMembers();
  }, [user?.teamId]);

  const handleInputChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { id, value } = e.target;
    setFormData(prev => ({ ...prev, [id]: value }));
  };

  const handleFileChange = (field: 'moodboard' | 'logo' | 'referenceImage') => (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const newFile: MoodboardFile = { name: file.name, type: file.type, content: reader.result as string };
        setFormData(prev => ({ ...prev, [field]: newFile }));
      };
      reader.readAsDataURL(file);
    } else {
      setFormData(prev => ({ ...prev, [field]: null }));
    }
  };

  const handleRemoveFile = (field: 'moodboard' | 'logo' | 'referenceImage') => () => {
    setFormData(prev => ({ ...prev, [field]: null }));
    const input = document.getElementById(field) as HTMLInputElement;
    if (input) input.value = '';
  };

  const handleColorsChange = (colors: ColorItem[]) => {
    setFormData(prev => ({ ...prev, colorPalette: colors }));
  };

  const handleSave = useCallback(async () => {
    if (!user?.id) {
      toast.error(t.brands.notAuthenticated);
      return;
    }
    if (!formData.name.trim()) {
      toast.error('O nome da identidade é obrigatório.');
      return;
    }

    setIsSaving(true);
    const toastId = 'brand-create';
    try {
      toast.loading(t.brands.creating, { id: toastId });

      const { data, error } = await supabase
        .from('brands')
        .insert({
          team_id: user.teamId || null,
          user_id: user.id,
          name: formData.name,
          responsible: formData.responsible,
          segment: formData.segment,
          values: formData.values,
          keywords: formData.keywords,
          goals: formData.goals,
          inspirations: formData.inspirations,
          success_metrics: formData.successMetrics,
          brand_references: formData.references,
          special_dates: formData.specialDates,
          promise: formData.promise,
          crisis_info: formData.crisisInfo,
          milestones: formData.milestones,
          collaborations: formData.collaborations,
          restrictions: formData.restrictions,
          moodboard: formData.moodboard as any,
          logo: formData.logo as any,
          reference_image: formData.referenceImage as any,
          color_palette: formData.colorPalette as any,
          brand_color: formData.brandColor,
        } as any)
        .select()
        .single();

      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ['brands'] });
      toast.success(t.brands.createSuccess, { id: toastId });
      navigate(`/brands/${data.id}`, { replace: true });
    } catch (error) {
      console.error('Erro ao salvar identidade:', error);
      toast.error(t.brands.saveError, { id: toastId });
    } finally {
      setIsSaving(false);
    }
  }, [formData, user, t, navigate, queryClient]);

  // Show loading while checking for existing brand
  if (isLoading || (existingBrands && existingBrands.length > 0)) {
    return (
      <div className="flex flex-col -m-4 sm:-m-6 lg:-m-8">
        <div className="relative w-full h-48 md:h-56 flex-shrink-0 overflow-hidden">
          <Skeleton className="w-full h-full" />
        </div>
        <div className="px-4 sm:px-6 lg:px-8 py-6 space-y-6">
          <Skeleton className="h-24 w-full rounded-2xl" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Skeleton className="h-48 w-full rounded-2xl" />
            <Skeleton className="h-48 w-full rounded-2xl" />
          </div>
        </div>
      </div>
    );
  }

  const FileUploadField = ({ field, label, accept = 'image/*' }: { field: 'moodboard' | 'logo' | 'referenceImage'; label: string; accept?: string }) => (
    <div className="space-y-2">
      <Label htmlFor={field}>{label}</Label>
      <div className="relative">
        <Input
          id={field}
          type="file"
          onChange={handleFileChange(field)}
          accept={accept}
          className={`absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10 ${formData[field] ? 'pointer-events-none' : ''}`}
        />
        <div className={`h-20 border-2 border-dashed rounded-lg flex items-center justify-center transition-all duration-200 ${
          formData[field]
            ? 'border-green-300 dark:border-green-600 bg-green-50 dark:bg-green-900/20'
            : 'border-border/30 bg-muted/30 hover:bg-muted/50 hover:border-primary/50'
        }`}>
          {formData[field] ? (
            <div className="flex items-center justify-between w-full px-4">
              <div className="flex items-center gap-2 max-w-[calc(100%-2rem)]">
                <div className="w-2 h-2 bg-green-500 rounded-full flex-shrink-0" />
                <span className="text-xs text-green-600 font-medium truncate">
                  {(formData[field] as MoodboardFile).name}
                </span>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleRemoveFile(field)}
                className="h-6 w-6 p-0 text-destructive hover:text-destructive hover:bg-destructive/10 flex-shrink-0 rounded-full relative z-20 ml-2"
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          ) : (
            <span className="text-xs text-muted-foreground font-medium">
              Clique para enviar {label.toLowerCase()}
            </span>
          )}
        </div>
      </div>
    </div>
  );

  // Show creation form inline (no brand exists yet)
  return (
    <div className="flex flex-col -m-4 sm:-m-6 lg:-m-8">
      {/* Banner */}
      <div className="relative w-full h-48 md:h-56 flex-shrink-0 overflow-hidden">
        <PageBreadcrumb
          variant="overlay"
          items={[{ label: 'Identidade' }]}
        />
        <img
          src={brandsBanner}
          alt=""
          className="w-full h-full object-cover"
          style={{ objectPosition: 'center 85%' }}
          loading="lazy"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-background/20 to-transparent" />
      </div>

      {/* Header */}
      <div className="relative px-4 sm:px-6 lg:px-8 -mt-12 flex-shrink-0">
        <div className="bg-card rounded-2xl shadow-lg p-4 lg:p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="bg-primary/10 border border-primary/20 shadow-sm rounded-2xl p-3 lg:p-4">
              <Tag className="h-8 w-8 lg:h-10 lg:w-10 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl lg:text-3xl font-bold text-foreground flex items-center gap-2">
                {t.brands.pageTitle}
                <Popover>
                  <PopoverTrigger asChild>
                    <button className="text-muted-foreground hover:text-foreground transition-colors">
                      <HelpCircle className="h-5 w-5" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-80 text-sm" side="bottom" align="start">
                    <div className="space-y-2">
                      <h4 className="font-semibold text-foreground">O que é a Identidade?</h4>
                      <p className="text-muted-foreground">
                        A identidade é o perfil político para o qual você cria conteúdo. Ela contém informações como valores, bandeiras, público-alvo e identidade visual.
                      </p>
                      <h4 className="font-semibold text-foreground mt-3">Como usar?</h4>
                      <ul className="text-muted-foreground space-y-1 list-disc list-inside">
                        <li>Preencha os dados do mandato ou campanha</li>
                        <li>Adicione perfis de eleitor e itens da agenda</li>
                        <li>A identidade será usada automaticamente ao criar conteúdos</li>
                      </ul>
                    </div>
                  </PopoverContent>
                </Popover>
              </h1>
              <p className="text-sm lg:text-base text-muted-foreground">
                Preencha as informações da sua identidade política
              </p>
            </div>
          </div>

          <Button
            id="brands-create-button"
            onClick={handleSave}
            disabled={isSaving || !formData.name.trim()}
            className="rounded-lg bg-gradient-to-r from-primary to-secondary px-5 py-3 text-sm lg:text-base disabled:opacity-50 disabled:cursor-not-allowed shrink-0 shadow-md"
          >
            {isSaving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4 lg:h-5 lg:w-5" />
            )}
            Salvar Identidade
          </Button>
        </div>

        <TourSelector
          tours={[
            { tourType: 'navbar', steps: navbarSteps, label: 'Tour da Navegação', targetElement: '#sidebar-logo' },
            { tourType: 'brands', steps: brandsSteps, label: 'Tour de Marcas', targetElement: '#brands-create-button' },
          ]}
          startDelay={500}
        />
      </div>

      {/* Form Content */}
      <main className="px-4 sm:px-6 lg:px-8 pt-6 pb-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
          {/* Column 1 */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">{t.brands.brandName}</Label>
              <Input id="name" value={formData.name} onChange={handleInputChange} placeholder={t.brands.placeholders.name} className="h-9" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="values">{t.brands.values}</Label>
              <Textarea id="values" value={formData.values} onChange={handleInputChange} placeholder={t.brands.placeholders.values} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="goals">{t.brands.goals}</Label>
              <Textarea id="goals" value={formData.goals} onChange={handleInputChange} placeholder={t.brands.placeholders.goals} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="successMetrics">{t.brands.successMetrics}</Label>
              <Textarea id="successMetrics" value={formData.successMetrics} onChange={handleInputChange} placeholder={t.brands.placeholders.successMetrics} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="specialDates">{t.brands.specialDates}</Label>
              <Textarea id="specialDates" value={formData.specialDates} onChange={handleInputChange} placeholder={t.brands.placeholders.specialDates} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="promise">{t.brands.promise}</Label>
              <Textarea id="promise" value={formData.promise} onChange={handleInputChange} placeholder={t.brands.placeholders.promise} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="milestones">{t.brands.milestones}</Label>
              <Textarea id="milestones" value={formData.milestones} onChange={handleInputChange} placeholder={t.brands.placeholders.milestones} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="restrictions">{t.brands.restrictions}</Label>
              <Textarea id="restrictions" value={formData.restrictions} onChange={handleInputChange} placeholder={t.brands.placeholders.restrictions} />
            </div>
            <FileUploadField field="referenceImage" label={t.brands.referenceImage} />
          </div>

          {/* Column 2 */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="segment">{t.brands.segment}</Label>
              <Textarea id="segment" value={formData.segment} onChange={handleInputChange} placeholder={t.brands.placeholders.segment} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="keywords">{t.brands.keywords}</Label>
              <Textarea id="keywords" value={formData.keywords} onChange={handleInputChange} placeholder={t.brands.placeholders.keywords} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="inspirations">{t.brands.inspirations}</Label>
              <Textarea id="inspirations" value={formData.inspirations} onChange={handleInputChange} placeholder={t.brands.placeholders.inspirations} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="references">{t.brands.references}</Label>
              <Textarea id="references" value={formData.references} onChange={handleInputChange} placeholder={t.brands.placeholders.references} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="crisisInfo">{t.brands.crisisInfo}</Label>
              <Textarea id="crisisInfo" value={formData.crisisInfo} onChange={handleInputChange} placeholder={t.brands.placeholders.crisisInfo} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="collaborations">{t.brands.collaborations}</Label>
              <Textarea id="collaborations" value={formData.collaborations} onChange={handleInputChange} placeholder={t.brands.placeholders.collaborations} />
            </div>
            <FileUploadField field="moodboard" label={t.brands.moodboard} accept="image/*,application/pdf" />
            <FileUploadField field="logo" label={t.brands.logo} />
          </div>
        </div>

        {/* Color Picker - full width */}
        <div className="mt-6">
          <ColorPicker
            colors={formData.colorPalette || []}
            onColorsChange={handleColorsChange}
            maxColors={8}
          />
        </div>

        {/* Brand Color Selector */}
        <div className="mt-6 space-y-2">
          <Label>Cor identificadora da identidade</Label>
          <p className="text-xs text-muted-foreground">Escolha uma cor para identificar esta identidade</p>
          <div className="flex flex-wrap gap-2 mt-2">
            {[
              { color: 'hsl(336, 80%, 58%)', label: 'Rosa' },
              { color: 'hsl(270, 70%, 55%)', label: 'Roxo' },
              { color: 'hsl(220, 80%, 55%)', label: 'Azul' },
              { color: 'hsl(160, 60%, 45%)', label: 'Verde' },
              { color: 'hsl(30, 90%, 55%)', label: 'Laranja' },
              { color: 'hsl(45, 90%, 55%)', label: 'Amarelo' },
              { color: 'hsl(0, 75%, 55%)', label: 'Vermelho' },
              { color: 'hsl(180, 60%, 45%)', label: 'Teal' },
              { color: 'hsl(240, 60%, 60%)', label: 'Indigo' },
              { color: 'hsl(320, 50%, 70%)', label: 'Rosa claro' },
            ].map(({ color, label }) => (
              <button
                key={color}
                type="button"
                onClick={() => setFormData(prev => ({ ...prev, brandColor: prev.brandColor === color ? null : color }))}
                className={`w-8 h-8 rounded-full border-2 transition-all duration-150 hover:scale-110 ${
                  formData.brandColor === color ? 'border-foreground ring-2 ring-foreground/20 scale-110' : 'border-transparent'
                }`}
                style={{ backgroundColor: color }}
                title={label}
              />
            ))}
            {formData.brandColor && (
              <button
                type="button"
                onClick={() => setFormData(prev => ({ ...prev, brandColor: null }))}
                className="text-xs text-muted-foreground hover:text-foreground underline ml-2 self-center"
              >
                Remover cor
              </button>
            )}
          </div>
        </div>

        {/* Save button at bottom */}
        <div className="mt-8 flex justify-center">
          <Button
            onClick={handleSave}
            disabled={isSaving || !formData.name.trim()}
            className="min-w-[200px] h-12 px-8 font-medium bg-primary hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-md hover:shadow-lg rounded-xl"
          >
            {isSaving ? (
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            ) : (
              <Save className="mr-2 h-5 w-5" />
            )}
            Salvar Identidade
          </Button>
        </div>
      </main>
    </div>
  );
}
