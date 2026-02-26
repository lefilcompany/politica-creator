import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Palette, Plus, HelpCircle } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import ThemeList from '@/components/temas/ThemeList';
import type { BrandInfo } from '@/components/temas/ThemeList';
import ThemeDialog from '@/components/temas/ThemeDialog';
import type { StrategicTheme, StrategicThemeSummary } from '@/types/theme';
import type { BrandSummary } from '@/types/brand';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { CreditConfirmationDialog } from '@/components/CreditConfirmationDialog';
import { Coins } from 'lucide-react';
import { TourSelector } from '@/components/onboarding/TourSelector';
import { themesSteps, navbarSteps } from '@/components/onboarding/tourSteps';
import { PageBreadcrumb } from "@/components/PageBreadcrumb";
import themesBanner from '@/assets/themes-banner.jpg';

type ThemeFormData = Omit<StrategicTheme, 'id' | 'createdAt' | 'updatedAt' | 'teamId' | 'userId'>;

export default function Themes() {
  const { user, team, refreshTeamData, refreshUserCredits } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const initialViewMode = (location.state as any)?.viewMode || 'grid';

  const [themes, setThemes] = useState<StrategicThemeSummary[]>([]);
  const [brands, setBrands] = useState<BrandInfo[]>([]);
  const [isLoadingThemes, setIsLoadingThemes] = useState(true);
  const [isLoadingBrands, setIsLoadingBrands] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [themeToEdit, setThemeToEdit] = useState<StrategicTheme | null>(null);
  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false);

  const ITEMS_PER_PAGE = 500;

  // Brands for dialog (full BrandSummary needed)
  const [brandSummaries, setBrandSummaries] = useState<BrandSummary[]>([]);

  // Load brands with color + avatar
  useEffect(() => {
    const loadBrands = async () => {
      if (!user?.id) return;
      setIsLoadingBrands(true);
      try {
        const { data, error } = await supabase
          .from('brands')
          .select('id, name, responsible, brand_color, avatar_url, created_at, updated_at')
          .order('name', { ascending: true });

        if (error) throw error;

        const brandInfos: BrandInfo[] = (data || []).map(b => ({
          id: b.id,
          name: b.name,
          brandColor: b.brand_color || null,
          avatarUrl: b.avatar_url || null,
        }));

        const summaries: BrandSummary[] = (data || []).map(b => ({
          id: b.id,
          name: b.name,
          responsible: b.responsible,
          brandColor: b.brand_color || null,
          avatarUrl: b.avatar_url || null,
          createdAt: b.created_at,
          updatedAt: b.updated_at,
        }));

        setBrands(brandInfos);
        setBrandSummaries(summaries);
      } catch (error) {
        console.error('Erro ao carregar marcas:', error);
        toast.error("Não foi possível carregar as marcas");
      } finally {
        setIsLoadingBrands(false);
      }
    };
    loadBrands();
  }, [user?.id]);

  // Load themes
  useEffect(() => {
    const loadThemes = async () => {
      if (!user?.id) return;
      setIsLoadingThemes(true);
      try {
        const { data, error } = await supabase
          .from('strategic_themes')
          .select('id, brand_id, title, created_at')
          .order('created_at', { ascending: false })
          .limit(ITEMS_PER_PAGE);

        if (error) throw error;

        const themes: StrategicThemeSummary[] = (data || []).map(theme => ({
          id: theme.id,
          brandId: theme.brand_id,
          title: theme.title,
          createdAt: theme.created_at,
        }));

        setThemes(themes);
      } catch (error) {
        console.error('Erro ao carregar temas:', error);
        toast.error("Não foi possível carregar os temas estratégicos");
      } finally {
        setIsLoadingThemes(false);
      }
    };
    loadThemes();
  }, [user?.id]);

  const handleOpenDialog = useCallback((theme: StrategicTheme | null = null) => {
    if (theme) {
      setThemeToEdit(theme);
      setIsDialogOpen(true);
      return;
    }
    if (!user) {
      toast.error('Carregando dados do usuário...');
      return;
    }
    setThemeToEdit(null);
    setIsDialogOpen(true);
  }, [user, team]);

  const handleSaveTheme = useCallback(
    async (formData: ThemeFormData): Promise<StrategicTheme> => {
      if (!user?.id) {
        toast.error("Informações do usuário não disponíveis");
        throw new Error('User not authenticated');
      }

      try {
        if (themeToEdit) {
          const { error } = await supabase
            .from('strategic_themes')
            .update({
              brand_id: formData.brandId,
              title: formData.title,
              description: formData.description,
              target_audience: formData.targetAudience,
              tone_of_voice: formData.toneOfVoice,
              objectives: formData.objectives,
              color_palette: formData.colorPalette,
              hashtags: formData.hashtags,
              content_format: formData.contentFormat,
              macro_themes: formData.macroThemes,
              best_formats: formData.bestFormats,
              platforms: formData.platforms,
              expected_action: formData.expectedAction,
              additional_info: formData.additionalInfo,
              tags: formData.tags,
              subtags: formData.subtags as any,
              objective_type: formData.objectiveType,
              signals: formData.signals as any,
            })
            .eq('id', themeToEdit.id);

          if (error) throw error;

          const saved: StrategicTheme = {
            ...themeToEdit,
            ...formData,
            updatedAt: new Date().toISOString(),
          };

          const summary: StrategicThemeSummary = {
            id: saved.id,
            brandId: saved.brandId,
            title: saved.title,
            createdAt: saved.createdAt,
          };

          setThemes(prev => prev.map(t => t.id === summary.id ? summary : t));
          toast.success('Tema atualizado com sucesso!');
          setIsDialogOpen(false);
          setThemeToEdit(null);
          return saved;
        } else {
          const { data, error } = await supabase
            .from('strategic_themes')
            .insert({
              team_id: user.teamId || null,
              user_id: user.id,
              brand_id: formData.brandId,
              title: formData.title,
              description: formData.description,
              target_audience: formData.targetAudience,
              tone_of_voice: formData.toneOfVoice,
              objectives: formData.objectives,
              color_palette: formData.colorPalette,
              hashtags: formData.hashtags,
              content_format: formData.contentFormat,
              macro_themes: formData.macroThemes,
              best_formats: formData.bestFormats,
              platforms: formData.platforms,
              expected_action: formData.expectedAction,
              additional_info: formData.additionalInfo,
              tags: formData.tags,
              subtags: formData.subtags as any,
              objective_type: formData.objectiveType,
              signals: formData.signals as any,
            })
            .select()
            .single();

          if (error) throw error;

          const saved: StrategicTheme = {
            ...formData,
            id: data.id,
            createdAt: data.created_at,
            updatedAt: data.updated_at,
            teamId: user.teamId || '',
            userId: user.id
          };

          const summary: StrategicThemeSummary = {
            id: saved.id,
            brandId: saved.brandId,
            title: saved.title,
            createdAt: saved.createdAt,
          };

          setThemes(prev => [...prev, summary]);

          // No credit cost for creating themes

          toast.success('Pauta criada com sucesso!');

          setIsDialogOpen(false);
          setThemeToEdit(null);
          return saved;
        }
      } catch (error) {
        console.error('Erro ao salvar tema:', error);
        toast.error("Erro ao salvar tema. Tente novamente.");
        throw error;
      }
    },
    [themeToEdit, user, team, refreshTeamData, refreshUserCredits]
  );

  const isButtonDisabled = !user;

  return (
    <div className="flex flex-col -m-4 sm:-m-6 lg:-m-8">
      {/* Banner */}
      <div className="relative w-full h-48 md:h-56 flex-shrink-0 overflow-hidden">
        <PageBreadcrumb
          variant="overlay"
          items={[{ label: 'Agenda' }]}
        />
        <img 
          src={themesBanner} 
          alt="" 
          className="w-full h-full object-cover"
          style={{ objectPosition: 'center 85%' }}
          loading="lazy"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-background/20 to-transparent" />
      </div>

      {/* Header section overlapping the banner */}
      <div className="relative px-4 sm:px-6 lg:px-8 -mt-12 flex-shrink-0">
        <div className="bg-card rounded-2xl shadow-lg p-4 lg:p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="bg-secondary/10 border border-secondary/20 shadow-sm rounded-2xl p-3 lg:p-4">
              <Palette className="h-8 w-8 lg:h-10 lg:w-10 text-secondary" />
            </div>
            <div>
              <h1 className="text-2xl lg:text-3xl font-bold text-foreground flex items-center gap-2">
                Sua Agenda
                <Popover>
                  <PopoverTrigger asChild>
                    <button className="text-muted-foreground hover:text-foreground transition-colors">
                      <HelpCircle className="h-5 w-5" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-80 text-sm" side="bottom" align="start">
                    <div className="space-y-2">
                      <h4 className="font-semibold text-foreground">O que são Pautas da Agenda?</h4>
                      <p className="text-muted-foreground">
                        Pautas são as diretrizes de conteúdo que definem o tom, estilo e objetivos das suas publicações políticas.
                      </p>
                      <h4 className="font-semibold text-foreground mt-3">Como usar?</h4>
                      <ul className="text-muted-foreground space-y-1 list-disc list-inside">
                        <li>Crie uma pauta vinculada a uma identidade existente</li>
                        <li>Defina público-alvo, tom de voz e objetivos</li>
                        <li>Use a pauta ao criar conteúdos para manter a estratégia alinhada</li>
                      </ul>
                    </div>
                  </PopoverContent>
                </Popover>
              </h1>
              <p className="text-sm lg:text-base text-muted-foreground">
                Gerencie, edite ou crie novos temas para seus projetos.
              </p>
            </div>
          </div>

          <Button
            id="themes-create-button"
            onClick={() => handleOpenDialog()}
            disabled={isButtonDisabled}
            className="rounded-lg bg-gradient-to-r from-primary to-secondary px-5 py-3 text-sm lg:text-base disabled:opacity-50 disabled:cursor-not-allowed shrink-0 shadow-md"
            title={!user ? 'Carregando...' : undefined}
          >
            <Plus className="mr-2 h-4 w-4 lg:h-5 lg:w-5" />
            Nova pauta
          </Button>
        </div>

        <TourSelector 
          tours={[
            {
              tourType: 'navbar',
              steps: navbarSteps,
              label: 'Tour da Navegação',
              targetElement: '#sidebar-logo'
            },
            {
              tourType: 'themes',
              steps: themesSteps,
              label: 'Tour de Temas',
              targetElement: '#themes-create-button'
            }
          ]}
          startDelay={500}
        />
      </div>

      {/* Content */}
      <main id="themes-list" className="flex-1 overflow-auto px-4 sm:px-6 lg:px-8 pt-4 pb-4 sm:pb-6 lg:pb-8">
        <ThemeList
          themes={themes}
          brands={brands}
          isLoading={isLoadingThemes}
          currentPage={1}
          totalPages={1}
          onPageChange={() => {}}
          initialViewMode={initialViewMode}
        />
      </main>

      <ThemeDialog
        isOpen={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        onSave={handleSaveTheme}
        themeToEdit={themeToEdit}
        brands={brandSummaries}
      />


      <TourSelector 
        tours={[
          {
            tourType: 'navbar',
            steps: navbarSteps,
            label: 'Tour da Navegação',
            targetElement: '#sidebar-logo'
          },
          {
            tourType: 'themes',
            steps: themesSteps,
            label: 'Tour de Temas Estratégicos',
            targetElement: '#themes-create-button'
          }
        ]}
        startDelay={500}
      />
    </div>
  );
}
