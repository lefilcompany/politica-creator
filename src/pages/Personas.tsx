'use client';

import { useState, useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Plus, Users, HelpCircle } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import PersonaList from '@/components/personas/PersonaList';
import type { BrandInfo } from '@/components/personas/PersonaList';
import PersonaDialog from '@/components/personas/PersonaDialog';
import type { Persona, PersonaSummary } from '@/types/persona';
import type { BrandSummary } from '@/types/brand';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { CreditConfirmationDialog } from '@/components/CreditConfirmationDialog';
import { Coins } from 'lucide-react';
import { TourSelector } from '@/components/onboarding/TourSelector';
import { personasSteps, navbarSteps } from '@/components/onboarding/tourSteps';
import personasBanner from '@/assets/personas-banner.jpg';
import { PageBreadcrumb } from '@/components/PageBreadcrumb';

type PersonaFormData = Omit<Persona, 'id' | 'createdAt' | 'updatedAt' | 'teamId' | 'userId'>;

export default function PersonasPage() {
  const { user, team, refreshTeamData, refreshUserCredits } = useAuth();
  const location = useLocation();
  const initialViewMode = (location.state as any)?.viewMode || 'grid';

  const [personas, setPersonas] = useState<PersonaSummary[]>([]);
  const [brands, setBrands] = useState<BrandInfo[]>([]);
  const [brandSummaries, setBrandSummaries] = useState<BrandSummary[]>([]);
  const [isLoadingPersonas, setIsLoadingPersonas] = useState(true);
  const [isLoadingBrands, setIsLoadingBrands] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [personaToEdit, setPersonaToEdit] = useState<Persona | null>(null);
  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false);

  const ITEMS_PER_PAGE = 500;

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
        toast.error('Erro ao carregar marcas');
      } finally {
        setIsLoadingBrands(false);
      }
    };
    loadBrands();
  }, [user?.id]);

  // Load personas
  useEffect(() => {
    const loadPersonas = async () => {
      if (!user?.id) return;
      setIsLoadingPersonas(true);
      try {
        const { data, error } = await supabase
          .from('personas')
          .select('id, brand_id, name, created_at')
          .order('created_at', { ascending: false })
          .limit(ITEMS_PER_PAGE);

        if (error) throw error;

        const personas: PersonaSummary[] = (data || []).map(p => ({
          id: p.id,
          brandId: p.brand_id,
          name: p.name,
          createdAt: p.created_at,
        }));

        setPersonas(personas);
      } catch (error) {
        console.error('Erro ao carregar personas:', error);
        toast.error('Erro ao carregar personas');
      } finally {
        setIsLoadingPersonas(false);
      }
    };
    loadPersonas();
  }, [user?.id]);

  const handleOpenDialog = useCallback((persona: Persona | null = null) => {
    if (persona) {
      setPersonaToEdit(persona);
      setIsDialogOpen(true);
      return;
    }
    if (!user) {
      toast.error('Carregando dados do usuário...');
      return;
    }
    setPersonaToEdit(null);
    setIsDialogOpen(true);
  }, [user, team]);

  const handleSavePersona = useCallback(async (formData: PersonaFormData) => {
    if (!user?.id) {
      toast.error('Usuário não autenticado');
      return;
    }

    const toastId = 'persona-operation';
    try {
      toast.loading(personaToEdit ? 'Atualizando persona...' : 'Criando persona...', { id: toastId });
      
      if (personaToEdit) {
        const { error } = await supabase
          .from('personas')
          .update({
            brand_id: formData.brandId,
            name: formData.name,
            age: formData.age,
            gender: formData.gender,
            professional_context: formData.professionalContext,
            location: formData.location,
            beliefs_and_interests: formData.beliefsAndInterests,
            main_goal: formData.mainGoal,
            challenges: formData.challenges,
            content_consumption_routine: formData.contentConsumptionRoutine,
            preferred_tone_of_voice: formData.preferredToneOfVoice,
            purchase_journey_stage: formData.purchaseJourneyStage,
            interest_triggers: formData.interestTriggers,
          })
          .eq('id', personaToEdit.id);

        if (error) throw error;

        setPersonas(prev => prev.map(p => 
          p.id === personaToEdit.id 
            ? { ...p, name: formData.name, brandId: formData.brandId }
            : p
        ));
        
        toast.success('Persona atualizada com sucesso!', { id: toastId });
      } else {
        const { data, error } = await supabase
          .from('personas')
          .insert({
            team_id: user.teamId || null,
            user_id: user.id,
            brand_id: formData.brandId,
            name: formData.name,
            age: formData.age,
            gender: formData.gender,
            professional_context: formData.professionalContext,
            location: formData.location,
            beliefs_and_interests: formData.beliefsAndInterests,
            main_goal: formData.mainGoal,
            challenges: formData.challenges,
            content_consumption_routine: formData.contentConsumptionRoutine,
            preferred_tone_of_voice: formData.preferredToneOfVoice,
            purchase_journey_stage: formData.purchaseJourneyStage,
            interest_triggers: formData.interestTriggers,
          })
          .select()
          .single();

        if (error) throw error;

        const newSummary: PersonaSummary = {
          id: data.id,
          brandId: data.brand_id,
          name: data.name,
          createdAt: data.created_at,
        };
        
        setPersonas(prev => [...prev, newSummary]);

        toast.success('Perfil de eleitor criado com sucesso!', { id: toastId });
      }
      
      setIsDialogOpen(false);
      setPersonaToEdit(null);
    } catch (error) {
      console.error('Erro ao salvar persona:', error);
      toast.error('Erro ao salvar persona. Tente novamente.', { id: toastId });
      throw error;
    }
  }, [personaToEdit, user, team, refreshTeamData, refreshUserCredits]);

  const isButtonDisabled = !user;

  return (
    <div className="flex flex-col -m-4 sm:-m-6 lg:-m-8">
      {/* Banner */}
      <div className="relative w-full h-48 md:h-56 flex-shrink-0 overflow-hidden">
        <PageBreadcrumb
          variant="overlay"
          items={[{ label: 'Audiência' }]}
        />
        <img 
          src={personasBanner} 
          alt="" 
          className="w-full h-full object-cover"
          style={{ objectPosition: 'center 30%' }}
          loading="lazy"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-background/20 to-transparent" />
      </div>

      {/* Header section overlapping the banner */}
      <div className="relative px-4 sm:px-6 lg:px-8 -mt-12 flex-shrink-0">
        <div className="bg-card rounded-2xl shadow-lg p-4 lg:p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="bg-primary/10 border border-primary/20 shadow-sm rounded-2xl p-3 lg:p-4">
              <Users className="h-8 w-8 lg:h-10 lg:w-10 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl lg:text-3xl font-bold text-foreground flex items-center gap-2">
                Sua Audiência
                <Popover>
                  <PopoverTrigger asChild>
                    <button className="text-muted-foreground hover:text-foreground transition-colors">
                      <HelpCircle className="h-5 w-5" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-80 text-sm" side="bottom" align="start">
                    <div className="space-y-2">
                      <h4 className="font-semibold text-foreground">O que são Perfis de Eleitor?</h4>
                      <p className="text-muted-foreground">
                        Perfis de eleitor são representações do seu público-alvo. Eles ajudam a direcionar o conteúdo para as pessoas certas, com a linguagem e tom adequados.
                      </p>
                      <h4 className="font-semibold text-foreground mt-3">Como usar?</h4>
                      <ul className="text-muted-foreground space-y-1 list-disc list-inside">
                        <li>Crie um perfil vinculado a uma identidade existente</li>
                        <li>Defina faixa etária, valores, dores e expectativas</li>
                        <li>Use o perfil ao criar conteúdos para personalizar a comunicação</li>
                      </ul>
                    </div>
                  </PopoverContent>
                </Popover>
              </h1>
              <p className="text-sm lg:text-base text-muted-foreground">
                Gerencie, edite ou crie novas personas para seus projetos.
              </p>
            </div>
          </div>

          <Button 
            id="personas-create-button"
            onClick={() => handleOpenDialog()} 
            disabled={isButtonDisabled}
            className="rounded-lg bg-gradient-to-r from-primary to-secondary px-5 py-3 text-sm lg:text-base disabled:opacity-50 disabled:cursor-not-allowed shrink-0 shadow-md"
            title={!user ? 'Carregando...' : undefined}
          >
            <Plus className="mr-2 h-4 w-4 lg:h-5 lg:w-5" />
            Novo perfil de eleitor
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
              tourType: 'personas',
              steps: personasSteps,
              label: 'Tour de Personas',
              targetElement: '#personas-create-button'
            }
          ]}
          startDelay={500}
        />
      </div>

      {/* Content */}
      <main id="personas-list" className="flex-1 overflow-auto px-4 sm:px-6 lg:px-8 pt-4 pb-4 sm:pb-6 lg:pb-8">
        <PersonaList
          personas={personas}
          brands={brands}
          isLoading={isLoadingPersonas}
          currentPage={1}
          totalPages={1}
          onPageChange={() => {}}
          initialViewMode={initialViewMode}
        />
      </main>

      <PersonaDialog
        isOpen={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        onSave={handleSavePersona}
        personaToEdit={personaToEdit}
        brands={brandSummaries}
      />

    </div>
  );
}
