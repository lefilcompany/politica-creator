'use client';

import { useState, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Plus, Tag, Coins, HelpCircle } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import BrandList from '@/components/marcas/BrandList';
import BrandDialog from '@/components/marcas/BrandDialog';
import type { Brand, BrandSummary, MoodboardFile, ColorItem } from '@/types/brand';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useTranslation } from '@/hooks/useTranslation';
import { CreditConfirmationDialog } from '@/components/CreditConfirmationDialog';
import { TourSelector } from '@/components/onboarding/TourSelector';
import { brandsSteps, navbarSteps } from '@/components/onboarding/tourSteps';
import brandsBanner from '@/assets/brands-banner.jpg';
import { PageBreadcrumb } from '@/components/PageBreadcrumb';

type BrandFormData = Omit<Brand, 'id' | 'createdAt' | 'updatedAt' | 'teamId' | 'userId'>;

export default function MarcasPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const initialViewMode = (location.state as any)?.viewMode as string | undefined;
  const { user, team, refreshTeamData, refreshUserCredits } = useAuth();
  const { t } = useTranslation();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [brandToEdit, setBrandToEdit] = useState<Brand | null>(null);
  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false);
  const queryClient = useQueryClient();

  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  // Fetch ALL brands (used for grid view and as base for list pagination)
  const { data: allBrands = [], isLoading: isQueryLoading } = useQuery({
    queryKey: ['brands', user?.id],
    queryFn: async () => {
      if (!user?.id) return [] as BrandSummary[];
      const { data, error } = await supabase
        .from('brands')
        .select('id, name, responsible, brand_color, avatar_url, created_at, updated_at')
        .order('name', { ascending: true });

      if (error) throw error;

      return (data || []).map(brand => ({
        id: brand.id,
        name: brand.name,
        responsible: brand.responsible,
        brandColor: (brand as any).brand_color || null,
        avatarUrl: (brand as any).avatar_url || null,
        createdAt: brand.created_at,
        updatedAt: brand.updated_at
      })) as BrandSummary[];
    },
    enabled: !!user?.id,
  });

  const totalPages = Math.ceil(allBrands.length / ITEMS_PER_PAGE);
  // For list view, slice the page; for grid, BrandList will show all
  const paginatedBrands = allBrands.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  const handleOpenDialog = useCallback((brand: Brand | null = null) => {
    if (brand) {
      setBrandToEdit(brand);
      setIsDialogOpen(true);
      return;
    }
    if (!user) {
      toast.error('Carregando dados do usuário...');
      return;
    }
    const freeBrandsUsed = team?.free_brands_used || 0;
    const isFree = freeBrandsUsed < 3;
    if (!isFree && (user.credits || 0) < 1) {
      toast.error('Créditos insuficientes. Criar uma marca custa 1 crédito (as 3 primeiras são gratuitas).');
      return;
    }
    setBrandToEdit(null);
    setIsConfirmDialogOpen(true);
  }, [user, team, allBrands.length, t]);

  const handleConfirmCreate = useCallback(() => {
    setIsConfirmDialogOpen(false);
    setIsDialogOpen(true);
  }, []);

  const handleSelectBrand = useCallback((brand: BrandSummary, viewMode?: string) => {
    navigate(`/brands/${brand.id}`, { state: { viewMode: viewMode || 'grid' } });
  }, [navigate]);

  const handleSaveBrand = useCallback(async (formData: BrandFormData) => {
    if (!user?.id) {
      toast.error(t.brands.notAuthenticated);
      return;
    }

    const toastId = 'brand-operation';
    try {
      toast.loading(brandToEdit ? t.brands.updating : t.brands.creating, { id: toastId });
      
      if (brandToEdit) {
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
            moodboard: formData.moodboard as any,
            logo: formData.logo as any,
            reference_image: formData.referenceImage as any,
            color_palette: formData.colorPalette as any,
            brand_color: formData.brandColor,
          } as any)
          .eq('id', brandToEdit.id);

        if (error) throw error;

        queryClient.invalidateQueries({ queryKey: ['brands'] });
        
        toast.success(t.brands.updateSuccess, { id: toastId });
      } else {
        const freeBrandsUsed = team?.free_brands_used || 0;
        const isFree = freeBrandsUsed < 3;

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
        
        if (isFree && user.teamId) {
          await supabase
            .from('teams')
            .update({ free_brands_used: freeBrandsUsed + 1 } as any)
            .eq('id', user.teamId);
          await refreshTeamData();
        } else if (!isFree) {
          const currentCredits = user.credits || 0;
          await supabase
            .from('profiles')
            .update({ credits: currentCredits - 1 })
            .eq('id', user.id);
          await supabase
            .from('credit_history')
            .insert({
              team_id: user.teamId || null,
              user_id: user.id,
              action_type: 'CREATE_BRAND',
              credits_used: 1,
              credits_before: currentCredits,
              credits_after: currentCredits - 1,
              description: `Criação da marca: ${formData.name}`,
              metadata: { brand_id: data.id, brand_name: formData.name }
            });
          await refreshUserCredits();
        }
        
        toast.success(isFree 
          ? `${t.brands.createSuccess} (${3 - freeBrandsUsed - 1} marcas gratuitas restantes)` 
          : t.brands.createSuccess, 
          { id: toastId }
        );
      }
      
      setIsDialogOpen(false);
      setBrandToEdit(null);
    } catch (error) {
      console.error('Erro ao salvar marca:', error);
      toast.error(t.brands.saveError, { id: toastId });
      throw error;
    }
  }, [brandToEdit, user, t]);

  const isButtonDisabled = !user || (user.credits || 0) < 1;

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
                      <h4 className="font-semibold text-foreground">O que são Marcas?</h4>
                      <p className="text-muted-foreground">
                        Marcas são os perfis das empresas ou projetos para os quais você cria conteúdo. Cada marca contém informações como valores, metas, público-alvo e identidade visual.
                      </p>
                      <h4 className="font-semibold text-foreground mt-3">Como usar?</h4>
                      <ul className="text-muted-foreground space-y-1 list-disc list-inside">
                        <li>Crie uma marca com os dados do seu cliente ou projeto</li>
                        <li>Adicione personas e temas estratégicos à marca</li>
                        <li>Use a marca ao criar conteúdos para manter consistência</li>
                      </ul>
                      <p className="text-xs text-muted-foreground/70 mt-2">
                        As 3 primeiras marcas são gratuitas. Depois, cada nova marca custa 1 crédito.
                      </p>
                    </div>
                  </PopoverContent>
                </Popover>
              </h1>
              <p className="text-sm lg:text-base text-muted-foreground">
                {t.brands.pageDescription}
              </p>
            </div>
          </div>

          <Button
            id="brands-create-button"
            onClick={() => handleOpenDialog()} 
            disabled={isButtonDisabled}
            className="rounded-lg bg-gradient-to-r from-primary to-secondary px-5 py-3 text-sm lg:text-base disabled:opacity-50 disabled:cursor-not-allowed shrink-0 shadow-md"
            title={!user ? 'Carregando...' : ((user.credits || 0) < 1 ? 'Créditos insuficientes' : undefined)}
          >
            <Plus className="mr-2 h-4 w-4 lg:h-5 lg:w-5" />
            {t.brands.newBrand}
            <span className="ml-2 flex items-center gap-1 text-xs opacity-90">
              <Coins className="h-3 w-3" />
              1
            </span>
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
              tourType: 'brands',
              steps: brandsSteps,
              label: 'Tour de Marcas',
              targetElement: '#brands-create-button'
            }
          ]}
          startDelay={500}
        />
      </div>

      {/* List */}
      <main id="brands-list" className="px-4 sm:px-6 lg:px-8 pt-4 pb-4 sm:pb-6 lg:pb-8">
        <BrandList
          brands={allBrands}
          paginatedBrands={paginatedBrands}
          selectedBrand={null}
          onSelectBrand={handleSelectBrand}
          isLoading={isQueryLoading}
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
          initialViewMode={initialViewMode}
        />
      </main>

      <BrandDialog
        isOpen={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        onSave={handleSaveBrand}
        brandToEdit={brandToEdit}
      />

      <CreditConfirmationDialog
        isOpen={isConfirmDialogOpen}
        onOpenChange={setIsConfirmDialogOpen}
        onConfirm={handleConfirmCreate}
        currentBalance={user?.credits || 0}
        cost={1}
        resourceType="marca"
        isFreeResource={(team?.free_brands_used || 0) < 3}
        freeResourcesRemaining={3 - (team?.free_brands_used || 0)}
      />
    </div>
  );
}
