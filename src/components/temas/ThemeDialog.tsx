'use client';

import { useState, useEffect, type ChangeEvent } from 'react';
import { X, Save, Info, ChevronDown, Plus, Search, Loader2, AlertTriangle, CheckCircle2, HelpCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import type { StrategicTheme, SignalItem } from '@/types/theme';
import type { BrandSummary } from '@/types/brand';
import { toast } from 'sonner';
import { StrategicThemeColorPicker } from '../ui/strategic-theme-color-picker';
import { useDraftForm } from '@/hooks/useDraftForm';
import { supabase } from '@/integrations/supabase/client';

type ThemeFormData = Omit<StrategicTheme, 'id' | 'createdAt' | 'updatedAt' | 'teamId' | 'userId'> & {
  colorPalette: string;
};

interface ThemeDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (data: ThemeFormData) => void;
  themeToEdit: StrategicTheme | null;
  brands?: BrandSummary[];
}

const PREDEFINED_TAGS = [
  'Saúde', 'Mobilidade', 'Segurança', 'Educação', 'Economia local',
  'Meio Ambiente', 'Infraestrutura', 'Cultura', 'Habitação', 'Assistência Social',
  'Saneamento', 'Tecnologia', 'Trabalho e Emprego', 'Esporte e Lazer',
];

const PREDEFINED_SUBTAGS: Record<string, string[]> = {
  'Saúde': ['Fila de exames', 'UPA', 'Vacinação', 'Medicamentos', 'PSF', 'Hospital público'],
  'Mobilidade': ['Ônibus', 'Iluminação pública', 'Ciclovias', 'Trânsito', 'Calçadas', 'Transporte escolar'],
  'Segurança': ['Policiamento', 'Câmeras', 'Violência doméstica', 'Drogas', 'Rondas', 'Guarda municipal'],
  'Educação': ['Creches', 'Merenda', 'Professores', 'Infraestrutura escolar', 'EJA', 'Ensino técnico'],
  'Economia local': ['Comércio', 'Empreendedorismo', 'Feiras', 'Turismo', 'Agricultura familiar', 'Microcrédito'],
  'Meio Ambiente': ['Desmatamento', 'Rios e nascentes', 'Coleta seletiva', 'Poluição', 'Áreas verdes'],
  'Infraestrutura': ['Pavimentação', 'Pontes', 'Praças', 'Drenagem', 'Obras públicas'],
  'Cultura': ['Eventos culturais', 'Patrimônio histórico', 'Bibliotecas', 'Artistas locais'],
  'Habitação': ['Moradia popular', 'Regularização fundiária', 'Déficit habitacional', 'Aluguel social'],
  'Assistência Social': ['CRAS', 'Bolsa família', 'Idosos', 'PCD', 'Moradores de rua'],
  'Saneamento': ['Água tratada', 'Esgoto', 'Lixo', 'Enchentes'],
  'Tecnologia': ['Internet', 'Governo digital', 'Smart city', 'Dados abertos'],
  'Trabalho e Emprego': ['Desemprego', 'Capacitação', 'Primeiro emprego', 'Economia solidária'],
  'Esporte e Lazer': ['Quadras esportivas', 'Programas de esporte', 'Parques', 'Academias ao ar livre'],
};

const OBJECTIVE_TYPES = [
  { value: 'informar', label: 'Informar', description: 'Levar informação ao público' },
  { value: 'propor', label: 'Propor solução', description: 'Apresentar propostas concretas' },
  { value: 'responder_crise', label: 'Responder crise', description: 'Reagir a eventos negativos' },
  { value: 'mobilizar_base', label: 'Mobilizar base', description: 'Engajar apoiadores' },
  { value: 'atrair_indecisos', label: 'Atrair indecisos', description: 'Conquistar novos seguidores' },
];

const initialFormData: ThemeFormData = {
  brandId: '',
  title: '',
  description: '',
  colorPalette: '[]',
  toneOfVoice: '',
  targetAudience: '',
  hashtags: '',
  objectives: '',
  contentFormat: '',
  macroThemes: '',
  bestFormats: '',
  platforms: '',
  expectedAction: '',
  additionalInfo: '',
  tags: [],
  subtags: {},
  objectiveType: '',
  signals: [],
};

export default function ThemeDialog({ isOpen, onOpenChange, onSave, themeToEdit, brands = [] }: ThemeDialogProps) {
  const [formData, setFormData] = useState<ThemeFormData>(initialFormData);
  const [isLoading, setIsLoading] = useState(false);
  const [toneList, setToneList] = useState<string[]>([]);
  const [hashtagList, setHashtagList] = useState<string[]>([]);
  const [customTagInput, setCustomTagInput] = useState('');
  const [customSubtagInput, setCustomSubtagInput] = useState('');
  const [activeTagForSubtag, setActiveTagForSubtag] = useState<string | null>(null);
  const [isLoadingSignals, setIsLoadingSignals] = useState(false);
  const [signalsSummary, setSignalsSummary] = useState('');
  const [signalsRecommendation, setSignalsRecommendation] = useState('');

  const { loadDraft, clearDraft, hasDraft } = useDraftForm(formData, {
    draftKey: 'theme_form_draft',
    expirationHours: 2,
  });

  const toneOptions = [
    'didático', 'combativo', 'conciliador', 'técnico',
    'inspirador', 'popular', 'institucional', 'empático',
    'mobilizador', 'propositivo', 'denúncia'
  ];

  useEffect(() => {
    if (isOpen && themeToEdit) {
      const colorPalette = themeToEdit.colorPalette || '[]';
      setFormData({
        brandId: themeToEdit.brandId || '',
        title: themeToEdit.title || '',
        description: themeToEdit.description || '',
        colorPalette,
        toneOfVoice: themeToEdit.toneOfVoice || '',
        targetAudience: themeToEdit.targetAudience || '',
        hashtags: themeToEdit.hashtags || '',
        objectives: themeToEdit.objectives || '',
        contentFormat: themeToEdit.contentFormat || '',
        macroThemes: themeToEdit.macroThemes || '',
        bestFormats: themeToEdit.bestFormats || '',
        platforms: themeToEdit.platforms || '',
        expectedAction: themeToEdit.expectedAction || '',
        additionalInfo: themeToEdit.additionalInfo || '',
        tags: themeToEdit.tags || [],
        subtags: themeToEdit.subtags || {},
        objectiveType: themeToEdit.objectiveType || '',
        signals: themeToEdit.signals || [],
      });

      try {
        const raw = themeToEdit.toneOfVoice || '';
        if (typeof raw === 'string' && raw.trim()) {
          setToneList(raw.split(/[,;]\s*/).map(s => s.trim()).filter(Boolean));
        } else {
          setToneList([]);
        }
      } catch { setToneList([]); }

      setHashtagList(themeToEdit.hashtags?.split(/\s+/).filter(Boolean) || []);
      setSignalsSummary('');
      setSignalsRecommendation('');
    } else if (isOpen && !themeToEdit) {
      const draft = loadDraft();
      if (draft) {
        setFormData(draft);
        try {
          const raw = draft.toneOfVoice || '';
          if (typeof raw === 'string' && raw.trim()) {
            setToneList(raw.split(/[,;]\s*/).map(s => s.trim()).filter(Boolean));
          }
        } catch { setToneList([]); }
        setHashtagList(draft.hashtags?.split(/\s+/).filter(Boolean) || []);
      } else {
        setFormData(initialFormData);
        setToneList([]);
        setHashtagList([]);
      }
      setSignalsSummary('');
      setSignalsRecommendation('');
    }
  }, [themeToEdit, isOpen, loadDraft]);

  const handleInputChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { id, value } = e.target;
    setFormData(prev => ({ ...prev, [id]: value }));
  };

  const handleSelectChange = (value: string) => {
    setFormData(prev => ({ ...prev, brandId: value }));
  };

  const handleToneSelect = (value: string) => {
    if (!value) return;
    setToneList(prev => prev.includes(value) ? prev : [...prev, value]);
  };

  const handleToneRemove = (tone: string) => {
    setToneList(prev => prev.filter(t => t !== tone));
  };

  const handleHashtagAdd = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      const value = e.currentTarget.value.trim();
      if (value) {
        const hashtag = value.startsWith('#') ? value : `#${value}`;
        if (!hashtagList.includes(hashtag)) {
          setHashtagList(prev => [...prev, hashtag]);
          e.currentTarget.value = '';
          setFormData(prev => ({ ...prev, hashtags: [...hashtagList, hashtag].join(' ') }));
        }
      }
    }
  };

  const handleHashtagRemove = (hashtag: string) => {
    setHashtagList(prev => {
      const newList = prev.filter(h => h !== hashtag);
      setFormData(prev => ({ ...prev, hashtags: newList.join(' ') }));
      return newList;
    });
  };

  // === Tags & Subtags handlers ===
  const handleTagToggle = (tag: string) => {
    setFormData(prev => {
      const newTags = prev.tags.includes(tag)
        ? prev.tags.filter(t => t !== tag)
        : [...prev.tags, tag];
      const newSubtags = { ...prev.subtags };
      if (!newTags.includes(tag)) {
        delete newSubtags[tag];
      }
      return { ...prev, tags: newTags, subtags: newSubtags };
    });
  };

  const handleAddCustomTag = () => {
    const tag = customTagInput.trim();
    if (tag && !formData.tags.includes(tag)) {
      setFormData(prev => ({ ...prev, tags: [...prev.tags, tag] }));
      setCustomTagInput('');
    }
  };

  const handleSubtagToggle = (tag: string, subtag: string) => {
    setFormData(prev => {
      const current = prev.subtags[tag] || [];
      const newSubtags = current.includes(subtag)
        ? current.filter(s => s !== subtag)
        : [...current, subtag];
      return { ...prev, subtags: { ...prev.subtags, [tag]: newSubtags } };
    });
  };

  const handleAddCustomSubtag = (tag: string) => {
    const subtag = customSubtagInput.trim();
    if (subtag) {
      const current = formData.subtags[tag] || [];
      if (!current.includes(subtag)) {
        setFormData(prev => ({
          ...prev,
          subtags: { ...prev.subtags, [tag]: [...current, subtag] },
        }));
      }
      setCustomSubtagInput('');
    }
  };

  // === Signal Collector ===
  const handleCollectSignals = async () => {
    if (!formData.title && formData.tags.length === 0) {
      toast.error('Defina ao menos o título ou selecione tags antes de buscar sinais.');
      return;
    }

    setIsLoadingSignals(true);
    try {
      const allSubtags = Object.values(formData.subtags).flat();
      const { data, error } = await supabase.functions.invoke('collect-signals', {
        body: {
          topic: formData.title || formData.tags.join(', '),
          tags: formData.tags,
          subtags: allSubtags,
          days: 7,
        },
      });

      if (error) throw error;

      if (data?.signals) {
        setFormData(prev => ({ ...prev, signals: data.signals }));
        setSignalsSummary(data.summary || '');
        setSignalsRecommendation(data.recommendation || '');
        toast.success(`${data.signals.length} sinais coletados!`);
      }
    } catch (error) {
      console.error('Error collecting signals:', error);
      toast.error('Erro ao coletar sinais. Tente novamente.');
    } finally {
      setIsLoadingSignals(false);
    }
  };

  const handleRemoveSignal = (index: number) => {
    setFormData(prev => ({
      ...prev,
      signals: prev.signals.filter((_, i) => i !== index),
    }));
  };

  const handleSaveClick = async () => {
    setIsLoading(true);
    try {
      const payload: ThemeFormData = {
        ...formData,
        toneOfVoice: toneList.join(', '),
        colorPalette: typeof formData.colorPalette === 'string' ? formData.colorPalette : '[]',
      };
      await onSave(payload);
      clearDraft();
      onOpenChange(false);
    } catch (error) {
      console.error('Erro ao salvar tema:', error);
      toast.error(themeToEdit
        ? 'Erro ao atualizar o tema. Por favor, tente novamente.'
        : 'Erro ao criar o tema. Por favor, tente novamente.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const isFormValid = () => {
    const requiredFields = [
      { field: 'title', label: 'Título' },
      { field: 'brandId', label: 'Identidade' },
    ];
    const missingFields = requiredFields.filter(({ field }) =>
      !formData[field as keyof typeof formData]?.toString().trim()
    );
    if (missingFields.length > 0) {
      toast.error(`Campos obrigatórios: ${missingFields.map(f => f.label).join(', ')}`);
      return false;
    }
    return true;
  };

  const handleDialogClose = (open: boolean) => {
    if (!open) {
      setFormData(initialFormData);
      setToneList([]);
      setHashtagList([]);
      setSignalsSummary('');
      setSignalsRecommendation('');
    }
    onOpenChange(open);
  };

  const getSignalCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      fato_confirmado: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
      noticia_local: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
      dado_publico: 'bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-300',
      release_institucional: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
      rumor: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
      tendencia: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-300',
    };
    return colors[category] || 'bg-muted text-muted-foreground';
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'verificado': return <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />;
      case 'nao_verificado': return <AlertTriangle className="h-3.5 w-3.5 text-red-500" />;
      default: return <HelpCircle className="h-3.5 w-3.5 text-amber-500" />;
    }
  };

  const getCategoryLabel = (category: string) => {
    const labels: Record<string, string> = {
      fato_confirmado: 'Fato confirmado',
      noticia_local: 'Notícia local',
      dado_publico: 'Dado público',
      release_institucional: 'Release institucional',
      rumor: 'Rumor',
      tendencia: 'Tendência',
    };
    return labels[category] || category;
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleDialogClose}>
      <DialogContent className="max-w-5xl flex flex-col max-h-[90vh]">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle>{themeToEdit ? 'Editar Pauta da Agenda' : 'Nova Pauta da Agenda'}</DialogTitle>
              <DialogDescription>
                {themeToEdit ? 'Altere as informações da pauta.' : 'Defina o tema, tags e objetivo da sua pauta estratégica.'}
              </DialogDescription>
            </div>
            {!themeToEdit && hasDraft() && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted px-3 py-1.5 rounded-full">
                <Save className="h-3 w-3" />
                <span>Rascunho salvo</span>
              </div>
            )}
          </div>
        </DialogHeader>

        <Tabs defaultValue="tema" className="flex-grow overflow-hidden flex flex-col">
          <TabsList className="grid w-full grid-cols-3 flex-shrink-0">
            <TabsTrigger value="tema">Tema + Tags</TabsTrigger>
            <TabsTrigger value="detalhes">Detalhes</TabsTrigger>
            <TabsTrigger value="sinais">
              Sinais
              {formData.signals.length > 0 && (
                <Badge variant="secondary" className="ml-1.5 h-5 px-1.5 text-xs">
                  {formData.signals.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          {/* TAB 1: Tema + Tags */}
          <TabsContent value="tema" className="flex-grow overflow-y-auto mt-0 p-1">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4 p-4">
              {/* Col 1 */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="brandId">Identidade <span className="text-red-500">*</span></Label>
                  <div className="relative">
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                    <select
                      value={formData.brandId}
                      onChange={(e) => handleSelectChange(e.target.value)}
                      disabled={brands.length === 0}
                      className="w-full h-10 text-sm px-3 pr-10 rounded-md border border-input bg-background text-foreground appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                      data-lpignore="true" data-1p-ignore="true" autoComplete="off"
                    >
                      <option value="" disabled>
                        {brands.length === 0 ? "Nenhuma identidade cadastrada" : "Selecione a identidade política"}
                      </option>
                      {brands.map(brand => (
                        <option key={brand.id} value={brand.id}>{brand.name}</option>
                      ))}
                    </select>
                  </div>
                  {brands.length === 0 && (
                    <p className="text-xs text-amber-600 dark:text-amber-500 flex items-start gap-1.5 mt-1">
                      <Info className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                      <span>Cadastre uma identidade antes de criar pautas</span>
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="title">Sobre o que você quer que fale? <span className="text-red-500">*</span></Label>
                  <Input
                    id="title"
                    value={formData.title}
                    onChange={handleInputChange}
                    placeholder="Ex: Saúde pública no interior, Primeiro emprego para jovens"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Objetivo da peça</Label>
                  <div className="grid grid-cols-1 gap-2">
                    {OBJECTIVE_TYPES.map(obj => (
                      <button
                        key={obj.value}
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, objectiveType: prev.objectiveType === obj.value ? '' : obj.value }))}
                        className={`flex items-center gap-3 p-3 rounded-lg border-2 text-left transition-all ${
                          formData.objectiveType === obj.value
                            ? 'border-primary bg-primary/5 text-primary'
                            : 'border-border hover:border-primary/40 text-foreground'
                        }`}
                      >
                        <div>
                          <div className="font-medium text-sm">{obj.label}</div>
                          <div className="text-xs text-muted-foreground">{obj.description}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Col 2: Tags */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Tags temáticas</Label>
                  <p className="text-xs text-muted-foreground">Selecione os temas macro desta pauta</p>
                  <div className="flex flex-wrap gap-2 max-h-[200px] overflow-y-auto p-2 rounded-lg border border-border/50 bg-muted/20">
                    {PREDEFINED_TAGS.map(tag => (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => handleTagToggle(tag)}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                          formData.tags.includes(tag)
                            ? 'bg-primary text-primary-foreground shadow-sm'
                            : 'bg-background border border-border text-foreground hover:border-primary/50'
                        }`}
                      >
                        {tag}
                      </button>
                    ))}
                    {formData.tags.filter(t => !PREDEFINED_TAGS.includes(t)).map(tag => (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => handleTagToggle(tag)}
                        className="px-3 py-1.5 rounded-full text-xs font-medium bg-primary text-primary-foreground shadow-sm"
                      >
                        {tag} ×
                      </button>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Adicionar tag personalizada..."
                      value={customTagInput}
                      onChange={(e) => setCustomTagInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddCustomTag(); } }}
                      className="h-8 text-sm"
                    />
                    <Button type="button" variant="outline" size="sm" onClick={handleAddCustomTag} className="h-8 px-3">
                      <Plus className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                {/* Subtags for selected tags */}
                {formData.tags.length > 0 && (
                  <div className="space-y-3">
                    <Label>Subtags (detalhamento)</Label>
                    <div className="space-y-3 max-h-[250px] overflow-y-auto">
                      {formData.tags.map(tag => (
                        <div key={tag} className="p-3 rounded-lg border border-border/50 bg-muted/20">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-semibold text-foreground">{tag}</span>
                            <Badge variant="outline" className="text-xs">
                              {(formData.subtags[tag] || []).length} selecionadas
                            </Badge>
                          </div>
                          <div className="flex flex-wrap gap-1.5 mb-2">
                            {(PREDEFINED_SUBTAGS[tag] || []).map(subtag => (
                              <button
                                key={subtag}
                                type="button"
                                onClick={() => handleSubtagToggle(tag, subtag)}
                                className={`px-2.5 py-1 rounded-md text-xs transition-all ${
                                  (formData.subtags[tag] || []).includes(subtag)
                                    ? 'bg-secondary text-secondary-foreground'
                                    : 'bg-background border border-border/60 text-muted-foreground hover:text-foreground hover:border-secondary/50'
                                }`}
                              >
                                {subtag}
                              </button>
                            ))}
                            {(formData.subtags[tag] || []).filter(s => !(PREDEFINED_SUBTAGS[tag] || []).includes(s)).map(subtag => (
                              <button
                                key={subtag}
                                type="button"
                                onClick={() => handleSubtagToggle(tag, subtag)}
                                className="px-2.5 py-1 rounded-md text-xs bg-secondary text-secondary-foreground"
                              >
                                {subtag} ×
                              </button>
                            ))}
                          </div>
                          {activeTagForSubtag === tag ? (
                            <div className="flex gap-1.5">
                              <Input
                                placeholder="Subtag personalizada..."
                                value={customSubtagInput}
                                onChange={(e) => setCustomSubtagInput(e.target.value)}
                                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddCustomSubtag(tag); } }}
                                className="h-7 text-xs"
                                autoFocus
                              />
                              <Button type="button" variant="outline" size="sm" onClick={() => handleAddCustomSubtag(tag)} className="h-7 px-2">
                                <Plus className="h-3 w-3" />
                              </Button>
                              <Button type="button" variant="ghost" size="sm" onClick={() => setActiveTagForSubtag(null)} className="h-7 px-2">
                                <X className="h-3 w-3" />
                              </Button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => { setActiveTagForSubtag(tag); setCustomSubtagInput(''); }}
                              className="text-xs text-primary hover:underline flex items-center gap-1 mt-1"
                            >
                              <Plus className="h-3 w-3" /> Adicionar subtag
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </TabsContent>

          {/* TAB 2: Detalhes */}
          <TabsContent value="detalhes" className="flex-grow overflow-y-auto mt-0 p-1">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4 p-4">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="toneOfVoice">Tom de Voz</Label>
                  <div className="relative">
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                    <select
                      value=""
                      onChange={(e) => handleToneSelect(e.target.value)}
                      className="w-full h-10 text-sm px-3 pr-10 rounded-md border border-input bg-background text-foreground appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                      data-lpignore="true" data-1p-ignore="true" autoComplete="off"
                    >
                      <option value="" disabled>Escolha o tom da comunicação</option>
                      {toneOptions.map(option => (
                        <option key={option} value={option} disabled={toneList.includes(option)}>
                          {option.charAt(0).toUpperCase() + option.slice(1)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex flex-wrap gap-2 min-h-[40px] p-2 rounded-xl border-2 border-dashed border-border/50 bg-muted/20">
                    {toneList.length === 0 ? (
                      <span className="text-sm text-muted-foreground italic self-center">Nenhum tom selecionado</span>
                    ) : toneList.map(tone => (
                      <div key={tone} className="flex items-center gap-1.5 bg-primary/10 border border-primary/30 text-primary text-xs font-semibold px-2.5 py-1 rounded-lg">
                        {tone}
                        <button type="button" onClick={() => handleToneRemove(tone)} className="text-primary hover:text-destructive transition-colors" aria-label={`Remover ${tone}`}>
                          <X size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="targetAudience">Público-alvo</Label>
                  <Textarea id="targetAudience" value={formData.targetAudience} onChange={handleInputChange} placeholder="Perfil demográfico, eleitoral, territorial" className="min-h-[70px]" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="objectives">Objetivos detalhados</Label>
                  <Textarea id="objectives" value={formData.objectives} onChange={handleInputChange} placeholder="Objetivos específicos desta pauta" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="platforms">Plataformas</Label>
                  <Textarea id="platforms" value={formData.platforms} onChange={handleInputChange} placeholder="Instagram, YouTube, WhatsApp, imprensa, eventos" />
                </div>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="hashtags">Hashtags</Label>
                  <Input id="hashtags" placeholder="Digite e pressione Enter" onKeyDown={handleHashtagAdd} className="h-10" />
                  <div className="flex flex-wrap gap-2 min-h-[40px] p-2 rounded-xl border-2 border-dashed border-border/50 bg-muted/20">
                    {hashtagList.length === 0 ? (
                      <span className="text-sm text-muted-foreground italic self-center">Nenhuma hashtag</span>
                    ) : hashtagList.map(hashtag => (
                      <div key={hashtag} className="flex items-center gap-1.5 bg-primary/10 border border-primary/30 text-primary text-xs font-semibold px-2.5 py-1 rounded-lg">
                        {hashtag}
                        <button type="button" onClick={() => handleHashtagRemove(hashtag)} className="text-primary hover:text-destructive transition-colors">
                          <X size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Contexto e descrição</Label>
                  <Textarea id="description" value={formData.description} onChange={handleInputChange} placeholder="Por que é relevante agora, qual problema resolve" className="min-h-[70px]" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contentFormat">Formatos de comunicação</Label>
                  <Textarea id="contentFormat" value={formData.contentFormat} onChange={handleInputChange} placeholder="Cards, vídeos curtos, discursos, notas oficiais" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="expectedAction">Resultado esperado</Label>
                  <Textarea id="expectedAction" value={formData.expectedAction} onChange={handleInputChange} placeholder="Compartilhar, engajar, assinar petição, comparecer" />
                </div>
              </div>
              <div className="md:col-span-2 space-y-2">
                <Label htmlFor="additionalInfo">Informações complementares</Label>
                <Textarea id="additionalInfo" value={formData.additionalInfo} onChange={handleInputChange} placeholder="Fatos recentes, dados de pesquisa, links de referência" />
              </div>
              <div className="md:col-span-2">
                <StrategicThemeColorPicker
                  colors={formData.colorPalette}
                  onColorsChange={(colors) => setFormData(prev => ({ ...prev, colorPalette: colors }))}
                  maxColors={8}
                />
              </div>
            </div>
          </TabsContent>

          {/* TAB 3: Sinais */}
          <TabsContent value="sinais" className="flex-grow overflow-y-auto mt-0 p-1">
            <div className="p-4 space-y-4">
              <div className="bg-muted/30 border border-border/50 rounded-xl p-4">
                <h3 className="font-semibold text-foreground mb-1">O que aconteceu nos últimos dias sobre esse tema?</h3>
                <p className="text-sm text-muted-foreground mb-3">
                  A IA analisa sinais recentes — notícias, dados públicos, releases e rumores — para embasar sua pauta com informações atualizadas.
                </p>
                <Button
                  type="button"
                  onClick={handleCollectSignals}
                  disabled={isLoadingSignals || (!formData.title && formData.tags.length === 0)}
                  variant="outline"
                  className="gap-2"
                >
                  {isLoadingSignals ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Coletando sinais...
                    </>
                  ) : (
                    <>
                      <Search className="h-4 w-4" />
                      Buscar sinais (1 crédito)
                    </>
                  )}
                </Button>
              </div>

              {signalsSummary && (
                <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 space-y-2">
                  <p className="text-sm font-medium text-foreground">{signalsSummary}</p>
                  {signalsRecommendation && (
                    <p className="text-sm text-primary italic">💡 {signalsRecommendation}</p>
                  )}
                </div>
              )}

              {formData.signals.length > 0 ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label>Sinais coletados ({formData.signals.length})</Label>
                    <p className="text-xs text-muted-foreground">Remova sinais irrelevantes antes de salvar</p>
                  </div>
                  {formData.signals.map((signal, idx) => (
                    <div key={idx} className="border border-border/50 rounded-xl p-3 bg-background hover:bg-muted/20 transition-colors group">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`px-2 py-0.5 rounded-md text-xs font-medium ${getSignalCategoryColor(signal.category)}`}>
                            {getCategoryLabel(signal.category)}
                          </span>
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            {getStatusIcon(signal.status)}
                            {signal.status === 'verificado' ? 'Verificado' : signal.status === 'nao_verificado' ? 'Não verificado' : 'Parcialmente verificado'}
                          </span>
                          {signal.relevance === 'alta' && (
                            <Badge variant="destructive" className="text-xs h-5">Alta relevância</Badge>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveSignal(idx)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-destructive/10 rounded"
                        >
                          <X className="h-3.5 w-3.5 text-destructive" />
                        </button>
                      </div>
                      <h4 className="font-medium text-sm text-foreground mb-1">{signal.title}</h4>
                      <p className="text-xs text-muted-foreground mb-1.5">{signal.description}</p>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground/70">
                        {signal.source_hint && <span>📄 {signal.source_hint}</span>}
                        {signal.date_hint && <span>📅 {signal.date_hint}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Search className="h-10 w-10 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">Nenhum sinal coletado ainda.</p>
                  <p className="text-xs mt-1">Defina o tema e clique em "Buscar sinais" para coletar informações atualizadas.</p>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter className="flex justify-center gap-4 pt-4 border-t border-border/40 flex-shrink-0">
          <DialogClose asChild>
            <Button type="button" variant="outline" className="min-w-[120px] h-11 px-8 font-medium transition-all duration-300 hover:bg-destructive hover:border-destructive hover:text-white dark:hover:bg-destructive">
              Cancelar
            </Button>
          </DialogClose>
          <Button
            type="button"
            onClick={() => { if (isFormValid()) handleSaveClick(); }}
            disabled={isLoading}
            className="min-w-[120px] h-11 px-8 font-medium bg-primary hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-md hover:shadow-lg"
          >
            {isLoading ? (
              <span className="flex items-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                {themeToEdit ? 'Atualizando...' : 'Criando...'}
              </span>
            ) : (
              themeToEdit ? 'Atualizar' : 'Criar Pauta'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
