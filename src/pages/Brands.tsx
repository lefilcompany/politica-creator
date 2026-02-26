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
    setBrandToEdit(null);
    setIsDialogOpen(true);
  }, [user, team, allBrands.length, t]);

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
      }
      
      setIsDialogOpen(false);
      setBrandToEdit(null);
    } catch (error) {
      console.error('Erro ao salvar marca:', error);
      toast.error(t.brands.saveError, { id: toastId });
      throw error;
    }
  }, [brandToEdit, user, t]);

  const isButtonDisabled = !user;

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
                      <h4 className="font-semibold text-foreground">O que são Identidades?</h4>
                      <p className="text-muted-foreground">
                        Identidades são os perfis políticos para os quais você cria conteúdo. Cada identidade contém informações como valores, bandeiras, público-alvo e identidade visual.
                      </p>
                      <h4 className="font-semibold text-foreground mt-3">Como usar?</h4>
                      <ul className="text-muted-foreground space-y-1 list-disc list-inside">
                        <li>Crie uma identidade com os dados do mandato ou campanha</li>
                        <li>Adicione perfis de eleitor e pautas da agenda</li>
                        <li>Use a identidade ao criar conteúdos para manter consistência</li>
                      </ul>
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
            title={!user ? 'Carregando...' : undefined}
          >
            <Plus className="mr-2 h-4 w-4 lg:h-5 lg:w-5" />
            {t.brands.newBrand}
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

    </div>
  );
}
