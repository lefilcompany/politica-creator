'use client';

import { useState, useEffect, type ChangeEvent } from 'react';
import { X, Save, Info, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import type { StrategicTheme } from '@/types/theme';
import type { BrandSummary } from '@/types/brand';
import { toast } from 'sonner';
import { StrategicThemeColorPicker } from '../ui/strategic-theme-color-picker';
import { useDraftForm } from '@/hooks/useDraftForm';

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
};

export default function ThemeDialog({ isOpen, onOpenChange, onSave, themeToEdit, brands = [] }: ThemeDialogProps) {
  const [formData, setFormData] = useState<ThemeFormData>(initialFormData);
  const [isLoading, setIsLoading] = useState(false);
  const [toneList, setToneList] = useState<string[]>([]);
  const [hashtagList, setHashtagList] = useState<string[]>([]);

  // Hook para gerenciar rascunhos
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
      });

      try {
        const raw = themeToEdit.toneOfVoice || '';
        if (Array.isArray((themeToEdit as any).toneOfVoice)) {
          setToneList((themeToEdit as any).toneOfVoice as string[]);
        } else if (typeof raw === 'string' && raw.trim()) {
          const parsed = raw.split(/[,;]\s*/).map(s => s.trim()).filter(Boolean);
          setToneList(parsed);
        } else {
          setToneList([]);
        }
      } catch (e) {
        setToneList([]);
      }

      const hashtags = themeToEdit.hashtags?.split(/\s+/).filter(Boolean) || [];
      setHashtagList(hashtags);
    } else if (isOpen && !themeToEdit) {
      // Tenta carregar rascunho
      const draft = loadDraft();
      if (draft) {
        setFormData(draft);
        
        // Recupera toneList e hashtagList do draft
        try {
          const raw = draft.toneOfVoice || '';
          if (typeof raw === 'string' && raw.trim()) {
            const parsed = raw.split(/[,;]\s*/).map(s => s.trim()).filter(Boolean);
            setToneList(parsed);
          }
        } catch (e) {
          setToneList([]);
        }
        
        const hashtags = draft.hashtags?.split(/\s+/).filter(Boolean) || [];
        setHashtagList(hashtags);
        
      } else {
        setFormData(initialFormData);
        setToneList([]);
        setHashtagList([]);
      }
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

  const handleSaveClick = async () => {
    setIsLoading(true);

    try {
      const payload: ThemeFormData = {
        ...formData,
        toneOfVoice: toneList.join(', '),
        colorPalette: typeof formData.colorPalette === 'string' ? formData.colorPalette : '[]'
      } as ThemeFormData;

      await onSave(payload);
      clearDraft(); // Limpa o rascunho após salvar com sucesso
      
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
      const fieldsList = missingFields.map(({ label }) => label).join(', ');
      toast.error(`Os seguintes campos são obrigatórios: ${fieldsList}`);
      return false;
    }

    return true;
  };

  const handleDialogClose = (open: boolean) => {
    if (!open) {
      setFormData(initialFormData);
      setToneList([]);
      setHashtagList([]);
    }
    onOpenChange(open);
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleDialogClose}>
      <DialogContent className="max-w-4xl flex flex-col">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle>{themeToEdit ? 'Editar Pauta da Agenda' : 'Nova Pauta da Agenda'}</DialogTitle>
              <DialogDescription>
                {themeToEdit ? 'Altere as informações da pauta.' : 'Preencha os campos abaixo para adicionar uma nova pauta à sua agenda estratégica.'}
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

        <div className="flex-grow overflow-y-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4 p-6">
            {/* Coluna 1 */}
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
                    data-lpignore="true"
                    data-1p-ignore="true"
                    autoComplete="off"
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
                <Label htmlFor="toneOfVoice">Tom de Voz (escolha um ou mais)</Label>
                <div className="relative">
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                  <select
                    value=""
                    onChange={(e) => handleToneSelect(e.target.value)}
                    className="w-full h-10 text-sm px-3 pr-10 rounded-md border border-input bg-background text-foreground appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                    data-lpignore="true"
                    data-1p-ignore="true"
                    autoComplete="off"
                  >
                    <option value="" disabled>Escolha o tom da comunicação desta pauta</option>
                    {toneOptions.map(option => (
                      <option key={option} value={option} disabled={toneList.includes(option)}>
                        {option.charAt(0).toUpperCase() + option.slice(1)}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-wrap gap-2 min-h-[50px] p-3 rounded-xl border-2 border-dashed border-border/50 bg-muted/20 mt-3">
                  {toneList.length === 0 ? (
                    <span className="text-sm text-muted-foreground italic self-center">Nenhum tom selecionado</span>
                  ) : (
                    toneList.map(tone => (
                      <div key={tone} className="flex items-center gap-2 bg-gradient-to-r from-primary/15 to-primary/5 border-2 border-primary/30 text-primary text-sm font-semibold px-3 py-1.5 rounded-xl">
                        {tone}
                        <button type="button" onClick={() => handleToneRemove(tone)} className="ml-1 text-primary hover:text-destructive transition-colors p-0.5 rounded-full hover:bg-destructive/10" aria-label={`Remover tom ${tone}`}>
                          <X size={14} />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="targetAudience">Público-alvo da pauta</Label>
                <Textarea
                  id="targetAudience"
                  value={formData.targetAudience}
                  onChange={handleInputChange}
                  placeholder="Descreva o público que deseja alcançar com esta pauta: perfil demográfico, eleitoral, territorial"
                  className="min-h-[80px]"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="objectives">Objetivos da pauta</Label>
                <Textarea 
                  id="objectives" 
                  value={formData.objectives} 
                  onChange={handleInputChange} 
                  placeholder="O que deseja alcançar com esta pauta? (informar, mobilizar, responder crise, propor solução, atrair audiência)" 
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="macroThemes">Eixos temáticos</Label>
                <Textarea 
                  id="macroThemes" 
                  value={formData.macroThemes} 
                  onChange={handleInputChange} 
                  placeholder="Temas macro que sustentam esta pauta (ex: saúde pública, segurança, educação, meio ambiente, economia)" 
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="platforms">Plataformas de divulgação</Label>
                <Textarea 
                  id="platforms" 
                  value={formData.platforms} 
                  onChange={handleInputChange} 
                  placeholder="Onde divulgar (Instagram, YouTube, WhatsApp, imprensa, plenário, eventos)" 
                />
              </div>
            </div>

            {/* Coluna 2 */}
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">Título da pauta <span className="text-red-500">*</span></Label>
                <Input 
                  id="title" 
                  value={formData.title} 
                  onChange={handleInputChange} 
                  placeholder="Nome da pauta (ex: Saúde pública no interior, Primeiro emprego para jovens)" 
                />
              </div>
              <div className="space-y-2 pt-1">
                <Label htmlFor="hashtags">Hashtags</Label>
                <Input 
                  id="hashtags" 
                  placeholder="Digite uma hashtag e pressione Enter ou vírgula"
                  onKeyDown={handleHashtagAdd}
                  className="h-10 mb-3"
                />
                <div className="flex flex-wrap gap-2 min-h-[50px] p-3 rounded-xl border-2 border-dashed border-border/50 bg-muted/20">
                  {hashtagList.length === 0 ? (
                    <span className="text-sm text-muted-foreground italic self-center">
                      Nenhuma hashtag adicionada
                    </span>
                  ) : (
                    hashtagList.map(hashtag => (
                      <div 
                        key={hashtag} 
                        className="flex items-center gap-2 bg-gradient-to-r from-primary/15 to-primary/5 border-2 border-primary/30 text-primary text-sm font-semibold px-3 py-1.5 rounded-xl"
                      >
                        {hashtag}
                        <button 
                          type="button"
                          onClick={() => handleHashtagRemove(hashtag)}
                          className="ml-1 text-primary hover:text-destructive transition-colors p-0.5 rounded-full hover:bg-destructive/10"
                          aria-label={`Remover hashtag ${hashtag}`}
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>  
              <div className="space-y-2">
                <Label htmlFor="description">Contexto e descrição</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  placeholder="Descreva o contexto político desta pauta: por que é relevante agora, qual problema resolve, como se conecta ao mandato"
                  className="min-h-[80px]"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="contentFormat">Formatos de comunicação</Label>
                <Textarea 
                  id="contentFormat" 
                  value={formData.contentFormat} 
                  onChange={handleInputChange} 
                  placeholder="Tipos de conteúdo a produzir (cards, vídeos curtos, discursos, notas oficiais, threads)" 
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bestFormats">Quais formatos funcionam melhor com seu público?</Label>
                <Textarea 
                  id="bestFormats" 
                  value={formData.bestFormats} 
                  onChange={handleInputChange} 
                  placeholder="Formatos com mais engajamento (vídeos curtos, cards com dados, stories com bastidores, lives)" 
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="expectedAction">Resultado esperado após publicação</Label>
                <Textarea 
                  id="expectedAction" 
                  value={formData.expectedAction} 
                  onChange={handleInputChange} 
                  placeholder="O que o público deve fazer? (compartilhar, engajar, assinar petição, comparecer a evento, votar)" 
                />
              </div>
            </div>
            <div className="md:col-span-2 space-y-2">
              <Label htmlFor="additionalInfo">Informações complementares</Label>
              <Textarea
                id="additionalInfo"
                value={formData.additionalInfo}
                onChange={handleInputChange}
                placeholder="Fatos recentes, dados de pesquisa, sinais do cenário político, links de referência ou qualquer contexto adicional"
              />
            </div>
          </div>

          {/* Seletor de Paleta de Cores */}
          <div className="px-6 mb-2">
            <div className="w-full space-y-2">
              <StrategicThemeColorPicker
                colors={formData.colorPalette}
                onColorsChange={(colors) => setFormData(prev => ({ ...prev, colorPalette: colors }))}
                maxColors={8}
              />
            </div>
          </div>
        </div>

        <DialogFooter className="flex justify-center gap-4 pt-4 border-t border-border/40">
          <DialogClose asChild>
            <Button
              type="button"
              variant="outline"
              className="min-w-[120px] h-11 px-8 font-medium transition-all duration-300 hover:bg-destructive hover:border-destructive hover:text-white dark:hover:bg-destructive"
            >
              Cancelar
            </Button>
          </DialogClose>
          <Button
            type="button"
            onClick={() => {
              if (isFormValid()) {
                handleSaveClick();
              }
            }}
            disabled={isLoading}
            className="min-w-[120px] h-11 px-8 font-medium bg-primary hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-md hover:shadow-lg"
          >
            {isLoading ? (
              <span className="flex items-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent"></span>
                {themeToEdit ? 'Atualizando...' : 'Criando...'}
              </span>
            ) : (
              themeToEdit ? 'Atualizar' : 'Criar Tema'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}