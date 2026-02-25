import { useEffect } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { TrialBanner } from "@/components/TrialBanner";
import { ExpiredTrialBlocker } from "@/components/ExpiredTrialBlocker";
import { useQuery } from "@tanstack/react-query";


import { dashboardSteps, navbarSteps } from '@/components/onboarding/tourSteps';
import { TourSelector } from '@/components/onboarding/TourSelector';

import { DashboardBanner } from "@/components/dashboard/DashboardBanner";
import { DashboardCreditsCard } from "@/components/dashboard/DashboardCreditsCard";
import { DashboardQuickActions } from "@/components/dashboard/DashboardQuickActions";
import { DashboardStats } from "@/components/dashboard/DashboardStats";
import { DashboardRecentActivity } from "@/components/dashboard/DashboardRecentActivity";
import { IncompleteProfileBanner } from "@/components/dashboard/IncompleteProfileBanner";

const Dashboard = () => {
  const { user, isLoading } = useAuth();

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    if (searchParams.get('success') === 'true' && user) {
      toast.success(
        `🎉 Pagamento confirmado! Bem-vindo ao seu novo plano!`,
        {
          description: `Você tem ${user.credits || 0} créditos disponíveis. Comece a criar!`,
          duration: 5000,
        }
      );
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [user]);

  const { data: actionsCount = 0 } = useQuery({
    queryKey: ['dashboard-actions-count', user?.id, user?.teamId],
    queryFn: async () => {
      if (!user?.id) return 0;
      try {
        let query = supabase
          .from('actions')
          .select('id', { count: 'exact', head: true })
          .in('type', ['CRIAR_CONTEUDO', 'CRIAR_CONTEUDO_RAPIDO']);
        
        if (user.teamId) {
          query = query.eq('team_id', user.teamId);
        } else {
          query = query.eq('user_id', user.id);
        }
        
        const { count, error } = await query;
        if (error) throw error;
        return count || 0;
      } catch {
        return 0;
      }
    },
    enabled: !!user?.id,
    staleTime: 1000 * 60 * 5,
    retry: 2,
  });

  const { data: brandsCount = 0 } = useQuery({
    queryKey: ['dashboard-brands-count', user?.teamId],
    queryFn: async () => {
      const { count } = await supabase
        .from('brands')
        .select('id', { count: 'exact', head: true });
      return count || 0;
    },
    enabled: !!user?.id,
    staleTime: 1000 * 60 * 5,
  });
  const { data: personasCount = 0 } = useQuery({
    queryKey: ['dashboard-personas-count', user?.id],
    queryFn: async () => {
      const { count } = await supabase
        .from('personas')
        .select('id', { count: 'exact', head: true });
      return count || 0;
    },
    enabled: !!user?.id,
    staleTime: 1000 * 60 * 5,
  });

  const { data: themesCount = 0 } = useQuery({
    queryKey: ['dashboard-themes-count', user?.id],
    queryFn: async () => {
      const { count } = await supabase
        .from('strategic_themes')
        .select('id', { count: 'exact', head: true });
      return count || 0;
    },
    enabled: !!user?.id,
    staleTime: 1000 * 60 * 5,
  });

  const { data: recentActivities = [], isLoading: isLoadingActivities } = useQuery({
    queryKey: ['dashboard-recent-activities', user?.teamId],
    queryFn: async () => {
      if (!user?.teamId) return [];
      try {
        const { data, error } = await supabase
          .rpc('get_action_summaries', {
            p_team_id: user.teamId,
            p_limit: 6,
          });
        if (!error && data && data.length > 0) return data;
      } catch {}
      // Fallback: direct query
      const { data: fallbackData } = await supabase
        .from('actions')
        .select('id, type, created_at, approved, brand_id, brands(name), result, details, thumb_path')
        .eq('team_id', user.teamId)
        .order('created_at', { ascending: false })
        .limit(5);
      return (fallbackData || []).map((a: any) => ({
        id: a.id,
        type: a.type,
        created_at: a.created_at,
        approved: a.approved,
        brand_id: a.brand_id,
        brand_name: a.brands?.name || null,
        image_url: a.result?.imageUrl || a.result?.originalImage || null,
        title: a.result?.title || a.result?.description || null,
        platform: a.details?.platform || null,
        objective: a.details?.objective || null,
        total_count: 0,
        thumb_path: a.thumb_path || null,
      }));
    },
    enabled: !!user?.teamId,
  });


  const { data: planCredits = 0 } = useQuery({
    queryKey: ['dashboard-plan-credits', user?.planId],
    queryFn: async () => {
      const { data } = await supabase
        .from('plans')
        .select('credits')
        .eq('id', user!.planId)
        .single();
      return data?.credits || 0;
    },
    enabled: !!user?.planId,
  });

  if (isLoading || !user) {
    return (
      <div className="space-y-5 pb-8">
        <Skeleton className="h-16 w-72 rounded-xl" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-36 w-full rounded-xl" />
        <div className="grid grid-cols-2 gap-3">
          <Skeleton className="h-24 rounded-xl" />
          <Skeleton className="h-24 rounded-xl" />
        </div>
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  const remainingCredits = user.credits || 0;
  const totalCredits = Math.max(planCredits || 0, remainingCredits);
  const progressPercentage = totalCredits > 0 ? ((remainingCredits / totalCredits) * 100) : 0;

  return (
    <div className="space-y-5 pb-8">
      <TourSelector 
        tours={[
          { tourType: 'navbar', steps: navbarSteps, label: 'Tour da Navegação', targetElement: '#sidebar-logo' },
          { tourType: 'dashboard', steps: dashboardSteps, label: 'Tour do Dashboard', targetElement: '#dashboard-credits-card' }
        ]}
        startDelay={1000}
      />
      
      <IncompleteProfileBanner />

      {/* Banner */}
      <DashboardBanner userName={user.name} />

      {/* Quick Actions */}
      <div id="dashboard-quick-actions">
        <DashboardQuickActions />
      </div>

      {/* Stats */}

      {/* Stats */}
      <div id="dashboard-stats">
        <DashboardStats actionsCount={actionsCount} brandsCount={brandsCount} personasCount={personasCount} themesCount={themesCount} hasTeam={!!user.teamId} />
      </div>

      {/* Recent Activity */}
      <div id="dashboard-recent-actions">
        <DashboardRecentActivity 
          activities={recentActivities as any} 
          isLoading={isLoadingActivities} 
        />
      </div>
    </div>
  );
};

export default Dashboard;
