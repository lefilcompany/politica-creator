'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { PageBreadcrumb } from '@/components/PageBreadcrumb';
import { useQueryClient } from '@tanstack/react-query';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { ArrowLeft, Trash2, Tag, ExternalLink, FileDown, Calendar, User, Save, Loader2, Sparkles, Target, Info, Palette, Pencil } from 'lucide-react';
import { BrandVisualIdentity } from '@/components/marcas/BrandVisualIdentity';
import { BrandAvatarEditor } from '@/components/marcas/BrandAvatarEditor';
import type { Brand, MoodboardFile, ColorItem } from '@/types/brand';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useTranslation } from '@/hooks/useTranslation';
import { ColorPicker } from '@/components/ui/color-picker';
import { toast } from 'sonner';

const formatDate = (dateString: string) => {
  if (!dateString) return '';
  return new Date(dateString).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

const FileDetailField = ({ label, file }: { label: string; file?: MoodboardFile | null }) => {
  if (!file || !file.content) return null;
  const isImage = file.type.startsWith('image/');

  return (
    <div>
      <p className="text-xs text-muted-foreground mb-2 font-medium uppercase tracking-wider">{label}</p>
      {isImage ? (
        <div className="relative group rounded-xl overflow-hidden border border-border/10 shadow-sm">
          <img src={file.content} alt={file.name} className="w-full max-h-64 object-cover" />
          <a
            href={file.content}
            target="_blank"
            rel="noopener noreferrer"
            className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 backdrop-blur-sm"
          >
            <ExternalLink className="text-white h-6 w-6" />
          </a>
        </div>
      ) : (
        <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-xl border border-border/10">
          <FileDown className="h-8 w-8 text-primary flex-shrink-0" />
          <div className="flex-grow truncate">
            <p className="text-sm font-medium text-foreground truncate">{file.name}</p>
            <a href={file.content} download={file.name} className="text-xs text-primary hover:underline">
              Baixar arquivo
            </a>
          </div>
        </div>
      )}
    </div>
  );
};

const ColorPaletteDisplay = ({ colors }: { colors?: ColorItem[] | null }) => {
  if (!colors || colors.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-4">
      {colors.map((color) => (
        <div key={color.id} className="flex flex-col items-center gap-2">
          <div
            className="w-14 h-14 rounded-xl border border-border/10 shadow-md ring-2 ring-white/10"
            style={{ backgroundColor: color.hex }}
            title={`${color.name || 'Cor'} - ${color.hex}`}
          />
          <div className="text-center">
            <div className="text-xs font-medium text-foreground truncate max-w-[70px]">{color.name || 'Sem nome'}</div>
            <div className="text-[10px] text-muted-foreground font-mono">{color.hex.toUpperCase()}</div>
          </div>
        </div>
      ))}
    </div>
  );
};

interface EditableFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: 'input' | 'textarea';
  placeholder?: string;
}

const EditableField = ({ label, value, onChange, type = 'textarea', placeholder }: EditableFieldProps) => (
  <div className="space-y-1.5">
    <Label className="text-xs text-muted-foreground font-medium uppercase tracking-wider">{label}</Label>
    {type === 'input' ? (
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder || label}
        className="bg-background/80 backdrop-blur-sm border-border/20 focus:border-primary/50 focus:ring-primary/20 transition-all duration-200"
      />
    ) : (
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder || label}
        className="bg-background/80 backdrop-blur-sm border-border/20 focus:border-primary/50 focus:ring-primary/20 min-h-[100px] max-h-[200px] resize-y transition-all duration-200"
      />
    )}
  </div>
);

interface SectionCardProps {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  accentColor?: string;
}

const SectionCard = ({ title, icon, children, accentColor }: SectionCardProps) => (
  <div className="bg-card/80 backdrop-blur-sm rounded-2xl border border-border/10 overflow-hidden shadow-sm hover:shadow-md transition-shadow duration-300">
    <div
      className="px-5 py-3.5 border-b border-border/10 flex items-center gap-2.5"
      style={accentColor ? { background: `linear-gradient(135deg, ${accentColor}08, ${accentColor}03)` } : {}}
    >
      {icon && <span className="text-primary">{icon}</span>}
      <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">{title}</h3>
    </div>
    <div className="p-5">{children}</div>
  </div>
);

function mapRowToBrand(data: any): Brand {
  return {
    id: data.id,
    teamId: data.team_id,
    userId: data.user_id,
    name: data.name,
    responsible: data.responsible,
    segment: data.segment,
    values: data.values || '',
    keywords: data.keywords || '',
    goals: data.goals || '',
    inspirations: data.inspirations || '',
    successMetrics: data.success_metrics || '',
    references: data.brand_references || '',
    specialDates: data.special_dates || '',
    promise: data.promise || '',
    crisisInfo: data.crisis_info || '',
    milestones: data.milestones || '',
    collaborations: data.collaborations || '',
    restrictions: data.restrictions || '',
    moodboard: data.moodboard as unknown as MoodboardFile | null,
    logo: data.logo as unknown as MoodboardFile | null,
    referenceImage: data.reference_image as unknown as MoodboardFile | null,
    colorPalette: data.color_palette as unknown as ColorItem[] | null,
    brandColor: data.brand_color || null,
    avatarUrl: data.avatar_url || null,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

export default function BrandView() {
  const { brandId } = useParams<{ brandId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const viewMode = (location.state as any)?.viewMode || 'grid';
  const { t } = useTranslation();
  const [brand, setBrand] = useState<Brand | null>(null);
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [colorPalette, setColorPalette] = useState<ColorItem[]>([]);
  const [selectedBrandColor, setSelectedBrandColor] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [avatarEditorOpen, setAvatarEditorOpen] = useState(false);
  const [visualFiles, setVisualFiles] = useState<{ logo: MoodboardFile | null; referenceImage: MoodboardFile | null; moodboard: MoodboardFile | null }>({ logo: null, referenceImage: null, moodboard: null });
  const originalRef = useRef<Record<string, string>>({});
  const originalColorPaletteRef = useRef<ColorItem[]>([]);
  const originalBrandColorRef = useRef<string | null>(null);
  const originalVisualFilesRef = useRef<{ logo: MoodboardFile | null; referenceImage: MoodboardFile | null; moodboard: MoodboardFile | null }>({ logo: null, referenceImage: null, moodboard: null });

  const queryClient = useQueryClient();

  const loadBrand = useCallback(async () => {
    if (!brandId) return;
    setIsLoading(true);
    try {
      const { data, error } = await supabase.from('brands').select('*').eq('id', brandId).single();
      if (error) throw error;
      const mapped = mapRowToBrand(data);
      setBrand(mapped);
      setColorPalette(mapped.colorPalette || []);
      setSelectedBrandColor(mapped.brandColor || null);
      originalColorPaletteRef.current = mapped.colorPalette ? [...mapped.colorPalette] : [];
      originalBrandColorRef.current = mapped.brandColor || null;
      const initial: Record<string, string> = {
        name: mapped.name,
        responsible: mapped.responsible,
        segment: mapped.segment,
        values: mapped.values,
        keywords: mapped.keywords,
        goals: mapped.goals,
        inspirations: mapped.inspirations,
        successMetrics: mapped.successMetrics,
        references: mapped.references,
        specialDates: mapped.specialDates,
        promise: mapped.promise,
        crisisInfo: mapped.crisisInfo,
        milestones: mapped.milestones,
        collaborations: mapped.collaborations,
        restrictions: mapped.restrictions,
      };
      setFormData(initial);
      originalRef.current = { ...initial };
      const vf = { logo: mapped.logo, referenceImage: mapped.referenceImage, moodboard: mapped.moodboard };
      setVisualFiles(vf);
      originalVisualFilesRef.current = { ...vf };
      setHasChanges(false);
    } catch (error) {
      console.error('Erro ao carregar marca:', error);
      toast.error('Erro ao carregar detalhes da marca');
      navigate('/brands');
    } finally {
      setIsLoading(false);
    }
  }, [brandId, navigate]);

  useEffect(() => {
    loadBrand();
  }, [loadBrand]);

  // Use refs to avoid stale closures in checkHasChanges
  const colorPaletteRef = useRef<ColorItem[]>([]);
  const brandColorRef = useRef<string | null>(null);

  // Keep refs in sync
  useEffect(() => { colorPaletteRef.current = colorPalette; }, [colorPalette]);
  useEffect(() => { brandColorRef.current = selectedBrandColor; }, [selectedBrandColor]);

  const checkHasChanges = useCallback((nextFormData: Record<string, string>, nextPalette?: ColorItem[], nextBrandColor?: string | null) => {
    const textChanged = Object.keys(nextFormData).some(k => nextFormData[k] !== originalRef.current[k]);
    const paletteToCheck = nextPalette ?? colorPaletteRef.current;
    const brandColorToCheck = nextBrandColor !== undefined ? nextBrandColor : brandColorRef.current;
    const paletteChanged = JSON.stringify(paletteToCheck) !== JSON.stringify(originalColorPaletteRef.current);
    const brandColorChanged = brandColorToCheck !== originalBrandColorRef.current;
    setHasChanges(textChanged || paletteChanged || brandColorChanged);
  }, []);

  const updateField = (key: string, value: string) => {
    setFormData(prev => {
      const next = { ...prev, [key]: value };
      checkHasChanges(next);
      return next;
    });
  };

  const handleColorPaletteChange = useCallback((colors: ColorItem[]) => {
    setColorPalette(colors);
    setHasChanges(true);
  }, []);

  const handleBrandColorChange = useCallback((color: string | null) => {
    setSelectedBrandColor(color);
    setHasChanges(true);
  }, []);

  const handleSave = useCallback(async () => {
    if (!user?.id || !brand) return;
    setIsSaving(true);
    const toastId = 'brand-update';
    try {
      toast.loading('Salvando alterações...', { id: toastId });
      const { error } = await supabase
        .from('brands')
        .update({
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
          color_palette: colorPalette.length > 0 ? colorPalette : null,
          brand_color: selectedBrandColor,
          logo: visualFiles.logo,
          reference_image: visualFiles.referenceImage,
          moodboard: visualFiles.moodboard,
        } as any)
        .eq('id', brand.id);

      if (error) throw error;
      toast.success('Marca atualizada com sucesso!', { id: toastId });
      originalRef.current = { ...formData };
      originalColorPaletteRef.current = [...colorPalette];
      originalBrandColorRef.current = selectedBrandColor;
      originalVisualFilesRef.current = { ...visualFiles };
      setHasChanges(false);
      // Invalidate React Query cache so lists update
      queryClient.invalidateQueries({ queryKey: ['brands'] });
      queryClient.invalidateQueries({ queryKey: ['brand', brand.id] });
    } catch (error) {
      console.error('Erro ao salvar marca:', error);
      toast.error('Erro ao salvar marca', { id: toastId });
    } finally {
      setIsSaving(false);
    }
  }, [brand, user, formData, colorPalette, selectedBrandColor, visualFiles, queryClient]);

  const handleDeleteBrand = useCallback(async () => {
    if (!brand) return;
    const toastId = 'brand-delete';
    try {
      toast.loading(t.brands.deleting, { id: toastId });
      const { error } = await supabase.from('brands').delete().eq('id', brand.id);
      if (error) throw error;
      toast.success(t.brands.deleteSuccess, { id: toastId });
      navigate('/brands');
    } catch (error) {
      console.error('Erro ao deletar marca:', error);
      toast.error(t.brands.deleteError, { id: toastId });
    }
  }, [brand, navigate, t]);

  if (isLoading) {
    return (
      <div className="flex flex-col -m-4 sm:-m-6 lg:-m-8">
        <div className="px-4 sm:px-6 lg:px-8 py-6 space-y-6">
          <div className="flex items-center gap-4">
            <Skeleton className="h-9 w-24" />
            <Skeleton className="h-8 w-48" />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <Skeleton className="h-48 w-full rounded-2xl" />
              <Skeleton className="h-48 w-full rounded-2xl" />
            </div>
            <div className="space-y-6">
              <Skeleton className="h-64 w-full rounded-2xl" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!brand) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <Tag className="h-16 w-16 text-muted-foreground/50 mb-4" />
        <h3 className="text-xl font-semibold">Marca não encontrada</h3>
        <Button variant="outline" className="mt-4" onClick={() => navigate('/brands')}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Voltar para marcas
        </Button>
      </div>
    );
  }

  const brandColor = selectedBrandColor || brand.brandColor || 'hsl(var(--primary))';
  const wasUpdated = brand.createdAt !== brand.updatedAt;

  return (
    <div className="flex flex-col -m-4 sm:-m-6 lg:-m-8">
      {/* Hero Header with gradient */}
      <div
        className="relative overflow-hidden"
        style={{
          background: `linear-gradient(135deg, ${brandColor}18, ${brandColor}08, hsl(var(--background)))`,
        }}
      >
        {/* Decorative elements */}
        <div
          className="absolute top-0 right-0 w-96 h-96 rounded-full opacity-[0.04] blur-3xl"
          style={{ backgroundColor: brandColor }}
        />
        <div
          className="absolute bottom-0 left-1/3 w-64 h-64 rounded-full opacity-[0.03] blur-3xl"
          style={{ backgroundColor: brandColor }}
        />

        <div className="relative px-4 sm:px-6 lg:px-8 py-6">
          {/* Breadcrumb */}
          <div className="mb-4">
            <PageBreadcrumb
              items={[
                { label: 'Identidade' },
              ]}
            />
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-4">
                <div className="relative group cursor-pointer" onClick={() => setAvatarEditorOpen(true)}>
                  {brand.avatarUrl ? (
                    <img
                      src={brand.avatarUrl}
                      alt={brand.name}
                      className="w-14 h-14 rounded-2xl object-cover shadow-lg ring-4 ring-white/20"
                    />
                  ) : (
                    <div
                      className="w-14 h-14 rounded-2xl flex items-center justify-center text-white font-bold text-2xl flex-shrink-0 shadow-lg ring-4 ring-white/20"
                      style={{ backgroundColor: brandColor }}
                    >
                      {brand.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="absolute inset-0 rounded-2xl bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                    <Pencil className="h-5 w-5 text-white" />
                  </div>
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-foreground tracking-tight">{formData.name || brand.name}</h1>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                    <span className="flex items-center gap-1"><User className="h-3 w-3" /> {formData.responsible || brand.responsible}</span>
                    <span className="text-border/50">•</span>
                    <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> {formatDate(brand.createdAt)}</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="sm" className="rounded-xl border-border/20 hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30 transition-colors">
                    <Trash2 className="mr-1.5 h-4 w-4" /> Deletar
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Você tem certeza?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Essa ação não pode ser desfeita. Isso irá deletar permanentemente a marca &quot;{brand.name}&quot;.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDeleteBrand} className="bg-destructive hover:bg-destructive/90">Deletar</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
              <Button
                size="sm"
                onClick={handleSave}
                disabled={!hasChanges || isSaving}
                className="rounded-xl shadow-md shadow-primary/20 transition-all duration-200"
              >
                {isSaving ? (
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-1.5 h-4 w-4" />
                )}
                Salvar
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main editable fields */}
          <div className="lg:col-span-2 space-y-6">
            <SectionCard title="Informações Gerais" icon={<Tag className="h-4 w-4" />} accentColor={brandColor}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <EditableField label="Nome da Marca" value={formData.name || ''} onChange={(v) => updateField('name', v)} type="input" />
                <EditableField label="Responsável" value={formData.responsible || ''} onChange={(v) => updateField('responsible', v)} type="input" />
                <EditableField label="Segmento" value={formData.segment || ''} onChange={(v) => updateField('segment', v)} />
                <EditableField label="Promessa Única" value={formData.promise || ''} onChange={(v) => updateField('promise', v)} />
                <EditableField label="Valores" value={formData.values || ''} onChange={(v) => updateField('values', v)} />
                <EditableField label="Palavras-Chave" value={formData.keywords || ''} onChange={(v) => updateField('keywords', v)} />
              </div>
            </SectionCard>

            <SectionCard title="Estratégia" icon={<Target className="h-4 w-4" />} accentColor={brandColor}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <EditableField label="Metas do Negócio" value={formData.goals || ''} onChange={(v) => updateField('goals', v)} />
                <EditableField label="Indicadores de Sucesso" value={formData.successMetrics || ''} onChange={(v) => updateField('successMetrics', v)} />
                <EditableField label="Inspirações" value={formData.inspirations || ''} onChange={(v) => updateField('inspirations', v)} />
                <EditableField label="Referências de Conteúdo" value={formData.references || ''} onChange={(v) => updateField('references', v)} />
              </div>
            </SectionCard>

            <SectionCard title="Detalhes Adicionais" icon={<Info className="h-4 w-4" />} accentColor={brandColor}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <EditableField label="Datas Especiais" value={formData.specialDates || ''} onChange={(v) => updateField('specialDates', v)} />
                <EditableField label="Marcos e Cases" value={formData.milestones || ''} onChange={(v) => updateField('milestones', v)} />
                <EditableField label="Restrições" value={formData.restrictions || ''} onChange={(v) => updateField('restrictions', v)} />
                <EditableField label="Crises (Existentes ou Potenciais)" value={formData.crisisInfo || ''} onChange={(v) => updateField('crisisInfo', v)} />
                <EditableField label="Colaborações e Ações com Influenciadores" value={formData.collaborations || ''} onChange={(v) => updateField('collaborations', v)} />
              </div>
            </SectionCard>

            <SectionCard title="Paleta de Cores" icon={<Palette className="h-4 w-4" />} accentColor={brandColor}>
              <ColorPicker
                colors={colorPalette}
                onColorsChange={handleColorPaletteChange}
                maxColors={8}
              />
            </SectionCard>
          </div>

          {/* Sidebar - visual assets */}
          <div className="space-y-6">
            <SectionCard title="Identidade Visual" icon={<Sparkles className="h-4 w-4" />} accentColor={brandColor}>
              <BrandVisualIdentity
                brandId={brand.id}
                logo={visualFiles.logo}
                referenceImage={visualFiles.referenceImage}
                moodboard={visualFiles.moodboard}
                onUpdate={(field, file) => {
                  setVisualFiles(prev => ({ ...prev, [field]: file }));
                  setHasChanges(true);
                }}
              />
            </SectionCard>


            <div className="bg-card/60 backdrop-blur-sm rounded-2xl p-4 text-xs text-muted-foreground space-y-1.5 border border-border/10">
              <div className="flex items-center gap-2">
                <Calendar className="h-3.5 w-3.5 text-primary/60" />
                <p>Criado em: {formatDate(brand.createdAt)}</p>
              </div>
              {wasUpdated && (
                <div className="flex items-center gap-2">
                  <Calendar className="h-3.5 w-3.5 text-primary/60" />
                  <p>Atualizado em: {formatDate(brand.updatedAt)}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <BrandAvatarEditor
        open={avatarEditorOpen}
        onOpenChange={setAvatarEditorOpen}
        brandId={brand.id}
        brandName={brand.name}
        currentColor={selectedBrandColor}
        currentAvatarUrl={brand.avatarUrl}
        onSave={async (color, avatarUrl) => {
          try {
            const updates: Record<string, any> = {};
            if (color !== selectedBrandColor) {
              updates.brand_color = color;
              handleBrandColorChange(color);
            }
            if (avatarUrl !== brand.avatarUrl) {
              updates.avatar_url = avatarUrl;
            }
            if (Object.keys(updates).length > 0) {
              const { error } = await supabase
                .from('brands')
                .update(updates)
                .eq('id', brand.id);
              if (error) throw error;
              // Update local brand state
              setBrand(prev => prev ? { ...prev, brandColor: color, avatarUrl } : prev);
              queryClient.invalidateQueries({ queryKey: ['brands'] });
              queryClient.invalidateQueries({ queryKey: ['brand', brand.id] });
              toast.success('Avatar atualizado com sucesso!');
            }
          } catch (err) {
            console.error('Error updating avatar:', err);
            toast.error('Erro ao atualizar avatar.');
          }
        }}
      />
    </div>
  );
}
