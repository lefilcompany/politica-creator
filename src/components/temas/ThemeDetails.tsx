'use client';

import { Button } from '@/components/ui/button';
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
import { Edit, Trash2, Palette, Tag, AlertTriangle, CheckCircle2, HelpCircle } from 'lucide-react';
import type { StrategicTheme } from '@/types/theme';
import type { BrandSummary, ColorItem } from '@/types/brand';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

interface ThemeDetailsProps {
  theme: StrategicTheme | null;
  onEdit: (theme: StrategicTheme) => void;
  onDelete: (themeId: string) => void;
  brands: BrandSummary[];
  isLoading?: boolean;
}

const formatDate = (dateString: string) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toLocaleDateString('pt-BR', { 
    day: '2-digit', 
    month: '2-digit', 
    year: 'numeric', 
    hour: '2-digit', 
    minute: '2-digit' 
  });
};

const DetailField = ({ label, value }: { label: string, value?: string }) => {
  if (!value) return null;
  return (
    <div className="p-3 bg-muted/50 rounded-lg break-words">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="font-semibold text-foreground whitespace-pre-wrap">{value}</p>
    </div>
  );
};

const ColorPaletteField = ({ colors }: { colors?: ColorItem[] | null }) => {
  if (!colors || colors.length === 0) return null;

  return (
    <div className="p-3 bg-muted/50 rounded-lg">
      <div className="flex items-center gap-2 mb-3">
        <Palette className="w-4 h-4 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Paleta de Cores</p>
        <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded-full">
          {colors.length} {colors.length === 1 ? 'cor' : 'cores'}
        </span>
      </div>
      
      {colors.length <= 4 ? (
        <div className="flex flex-wrap justify-center gap-8">
          {colors.map((color) => (
            <div key={color.id} className="flex flex-col items-center gap-3">
              <div
                className="w-16 h-16 rounded-xl border-2 border-gray-300 shadow-md hover:shadow-lg transition-shadow cursor-pointer"
                style={{ backgroundColor: color.hex }}
                title={`${color.name || 'Cor'} - ${color.hex}`}
              />
              <div className="text-center">
                <div className="text-xs font-medium text-foreground truncate max-w-[80px]">
                  {color.name || 'Sem nome'}
                </div>
                <div className="text-xs text-muted-foreground font-mono">
                  {color.hex.toUpperCase()}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 justify-items-center">
          {colors.map((color) => (
            <div
              key={color.id}
              className="flex items-center gap-3 p-3 bg-background/60 rounded-lg border border-border/40 hover:bg-background/80 transition-colors cursor-pointer"
              title={`${color.name || 'Cor'} - ${color.hex}`}
            >
              <div
                className="w-12 h-12 rounded-lg border-2 border-gray-300 shadow-sm flex-shrink-0"
                style={{ backgroundColor: color.hex }}
              />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-foreground truncate mb-1">
                  {color.name || 'Sem nome'}
                </div>
                <div className="text-xs text-muted-foreground font-mono mb-1">
                  {color.hex.toUpperCase()}
                </div>
                <div className="text-xs text-muted-foreground">
                  RGB({color.rgb.r}, {color.rgb.g}, {color.rgb.b})
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default function ThemeDetails({ theme, onEdit, onDelete, brands, isLoading = false }: ThemeDetailsProps) {
  if (isLoading) {
    return (
      <div className="h-full bg-card p-6 flex flex-col animate-pulse">
        <div className="flex items-center mb-6 flex-shrink-0">
          <Skeleton className="w-16 h-16 rounded-xl mr-4" />
          <Skeleton className="h-8 w-32" />
        </div>
        <div className="space-y-4 flex-1 overflow-y-auto pr-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-4 w-full" />
          ))}
        </div>
        <div className="flex gap-3 mt-6 flex-shrink-0">
          <Skeleton className="h-10 flex-1" />
          <Skeleton className="h-10 flex-1" />
        </div>
      </div>
    );
  }

  if (!theme) {
    return (
      <div className="h-full bg-card p-6 flex flex-col items-center justify-center text-center">
        <Palette className="h-16 w-16 text-muted-foreground/50 mb-4" />
        <h3 className="text-xl font-semibold text-foreground">Nenhum tema selecionado</h3>
        <p className="text-muted-foreground">Selecione um tema na lista para ver os detalhes.</p>
      </div>
    );
  }

  const brandName = brands.find(b => b.id === theme.brandId)?.name || 'Marca não encontrada';
  const wasUpdated = theme.createdAt !== theme.updatedAt;

  // Parse color palette from string
  let parsedColors: ColorItem[] | null = null;
  if (theme.colorPalette) {
    try {
      parsedColors = JSON.parse(theme.colorPalette);
    } catch (e) {
      console.error('Failed to parse color palette:', e);
    }
  }

  return (
    <div className="h-full p-4 md:p-6 flex flex-col overflow-hidden">
      <div className="flex items-center mb-4 flex-shrink-0">
        <div className="bg-gradient-to-br from-secondary to-primary text-white rounded-xl w-16 h-16 flex items-center justify-center font-bold text-3xl mr-4 flex-shrink-0">
          {theme.title.charAt(0).toUpperCase()}
        </div>
        <div>
          <h2 className="text-2xl font-bold text-foreground break-words">{theme.title}</h2>
          <p className="text-sm text-muted-foreground">{brandName}</p>
        </div>
      </div>

      <div className="overflow-y-auto pr-2 flex-1 min-h-0">
        <div className="space-y-4 text-left">
          {/* Tags */}
          {theme.tags && theme.tags.length > 0 && (
            <div className="p-3 bg-muted/50 rounded-lg">
              <p className="text-sm text-muted-foreground mb-2 flex items-center gap-1.5"><Tag className="h-3.5 w-3.5" /> Tags</p>
              <div className="flex flex-wrap gap-1.5">
                {theme.tags.map(tag => (
                  <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>
                ))}
              </div>
              {theme.subtags && Object.keys(theme.subtags).length > 0 && (
                <div className="mt-2 space-y-1.5">
                  {Object.entries(theme.subtags).map(([tag, subs]) => (
                    subs.length > 0 && (
                      <div key={tag} className="ml-2">
                        <span className="text-xs text-muted-foreground">{tag}:</span>
                        <div className="flex flex-wrap gap-1 mt-0.5">
                          {subs.map(s => (
                            <Badge key={s} variant="outline" className="text-xs">{s}</Badge>
                          ))}
                        </div>
                      </div>
                    )
                  ))}
                </div>
              )}
            </div>
          )}
          {theme.objectiveType && (
            <DetailField label="Objetivo da peça" value={
              { informar: 'Informar', propor: 'Propor solução', responder_crise: 'Responder crise', mobilizar_base: 'Mobilizar base', atrair_indecisos: 'Atrair indecisos' }[theme.objectiveType] || theme.objectiveType
            } />
          )}
          <DetailField label="Descrição" value={theme.description} />
          <DetailField label="Tom de Voz" value={theme.toneOfVoice} />
          <ColorPaletteField colors={parsedColors} />
          <DetailField label="Público-Alvo" value={theme.targetAudience} />
          <DetailField label="Objetivos" value={theme.objectives} />
          <DetailField label="Macro Temas" value={theme.macroThemes} />
          <DetailField label="Ação Esperada" value={theme.expectedAction} />
          <DetailField label="Formato de Conteúdo" value={theme.contentFormat} />
          <DetailField label="Melhores Formatos" value={theme.bestFormats} />
          <DetailField label="Plataformas" value={theme.platforms} />
          <DetailField label="Hashtags" value={theme.hashtags} />
          <DetailField label="Informações Adicionais" value={theme.additionalInfo} />
          {/* Signals */}
          {theme.signals && theme.signals.length > 0 && (
            <div className="p-3 bg-muted/50 rounded-lg">
              <p className="text-sm text-muted-foreground mb-2">Sinais coletados ({theme.signals.length})</p>
              <div className="space-y-2">
                {theme.signals.map((signal, idx) => (
                  <div key={idx} className="p-2 bg-background rounded-md border border-border/30">
                    <div className="flex items-center gap-1.5 mb-1">
                      {signal.status === 'verificado' ? <CheckCircle2 className="h-3 w-3 text-emerald-600" /> : signal.status === 'nao_verificado' ? <AlertTriangle className="h-3 w-3 text-red-500" /> : <HelpCircle className="h-3 w-3 text-amber-500" />}
                      <span className="text-xs font-medium">{signal.title}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">{signal.description}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
          <DetailField label="Data de Criação" value={formatDate(theme.createdAt)} />
          {wasUpdated && (
            <DetailField label="Última Atualização" value={formatDate(theme.updatedAt)} />
          )}
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-3 mt-4 flex-shrink-0">
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="outline" className="w-full flex-1 rounded-full">
              <Trash2 className="mr-2 h-4 w-4" /> Deletar
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Tem certeza?</AlertDialogTitle>
              <AlertDialogDescription>
                Esta ação não pode ser desfeita. O tema "{theme.title}" será permanentemente deletado.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => onDelete(theme.id)}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Deletar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        <Button onClick={() => onEdit(theme)} className="w-full flex-1 rounded-full">
          <Edit className="mr-2 h-4 w-4" /> Editar tema
        </Button>
      </div>
    </div>
  );
}