import React, { createContext, useContext, useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { User as SupabaseUser } from '@supabase/supabase-js';
import type { Session } from '@supabase/supabase-js';

interface User {
  id: string;
  email: string;
  name: string;
  teamId?: string;
  isAdmin: boolean;
  avatarUrl?: string;
  tutorialCompleted: boolean;
  // Créditos individuais do usuário
  credits: number;
  planId: string;
  subscriptionStatus?: string;
  subscriptionPeriodEnd?: string;
}

interface Team {
  id: string;
  name: string;
  code?: string;
  admin: string;
  admin_id?: string;
  plan_id: string;
  subscription_status: string;
  subscription_period_end?: string;
  plan: {
    id: string;
    name: string;
    description: string;
    price: number;
    credits: number;
    maxMembers: number;
    maxBrands: number;
    maxStrategicThemes: number;
    maxPersonas: number;
    trialDays: number;
    isActive: boolean;
  };
  credits: number;
  free_brands_used: number;
  free_personas_used: number;
  free_themes_used: number;
}

interface DataCache {
  timestamp: number;
  user: User | null;
  team: Team | null;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  team: Team | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isTrialExpired: boolean;
  trialDaysRemaining: number | null;
  logout: () => Promise<void>;
  reloadUserData: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  refreshTeamData: () => Promise<void>;
  refreshTeamCredits: () => Promise<void>;
  refreshUserCredits: () => Promise<void>;
  setUser: React.Dispatch<React.SetStateAction<User | null>>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const RELOAD_DEBOUNCE_MS = 1000;
const CACHE_VALIDITY_MS = 60000;

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [team, setTeam] = useState<Team | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isTrialExpired, setIsTrialExpired] = useState(false);
  const [trialDaysRemaining, setTrialDaysRemaining] = useState<number | null>(null);
  
  const lastReloadTime = useRef<number>(0);
  const dataCache = useRef<DataCache | null>(null);
  const isMounted = useRef(true);
  const isInitialized = useRef(false);
  const isInitialLoad = useRef(true);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Verifica se é System Admin
  const checkIfSystemAdmin = useCallback(async (userId: string): Promise<boolean> => {
    try {
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .eq('role', 'system')
        .maybeSingle();

      if (error) {
        console.error('Error checking admin status:', error);
        return false;
      }

      return !!data;
    } catch (error) {
      console.error('Error in checkIfSystemAdmin:', error);
      return false;
    }
  }, []);

  const loadUserData = useCallback(async (supabaseUser: SupabaseUser, forceLoad = false) => {
    const now = Date.now();
    
    const shouldSkipDebounce = isInitialLoad.current || forceLoad;
    
    if (!shouldSkipDebounce && now - lastReloadTime.current < RELOAD_DEBOUNCE_MS) {
      setIsLoading(false);
      return;
    }

    if (!shouldSkipDebounce && dataCache.current && now - dataCache.current.timestamp < CACHE_VALIDITY_MS) {
      setUser(dataCache.current.user);
      setTeam(dataCache.current.team);
      setIsLoading(false);
      return;
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    try {
      lastReloadTime.current = now;
      isInitialLoad.current = false;

      const [profileResult, isSystemAdmin] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', supabaseUser.id).maybeSingle(),
        checkIfSystemAdmin(supabaseUser.id)
      ]);

      if (!isMounted.current) return;

      const { data: profile, error: profileError } = profileResult;

      if (profileError) {
        setIsLoading(false);
        return;
      }

      if (!profile) {
        setUser(null);
        setTeam(null);
        setIsLoading(false);
        return;
      }

      // Calcular trial expiration baseado nos dados do usuário individual
      const nowDate = new Date();
      const periodEnd = profile.subscription_period_end ? new Date(profile.subscription_period_end) : null;
      const calculatedDaysRemaining = periodEnd ? Math.ceil((periodEnd.getTime() - nowDate.getTime()) / (1000 * 60 * 60 * 24)) : null;
      const isExpired = profile.plan_id === 'free' && periodEnd && periodEnd < nowDate;

      const userData: User = {
        id: supabaseUser.id,
        email: supabaseUser.email || '',
        name: profile.name || profile.email || '',
        teamId: profile.team_id,
        isAdmin: isSystemAdmin,
        avatarUrl: profile.avatar_url,
        tutorialCompleted: profile.tutorial_completed || false,
        // Créditos individuais
        credits: profile.credits || 0,
        planId: profile.plan_id || 'free',
        subscriptionStatus: profile.subscription_status,
        subscriptionPeriodEnd: profile.subscription_period_end,
      };

      let teamData: Team | null = null;

      // Carregar dados da equipe apenas se o usuário tiver uma (opcional)
      if (profile.team_id) {
        const { data: teamInfo, error: teamError } = await supabase
          .from('teams')
          .select(`
            *,
            plans (*)
          `)
          .eq('id', profile.team_id)
          .maybeSingle();

        if (!isMounted.current) return;

        if (!teamError && teamInfo && teamInfo.plans) {
          const planData = teamInfo.plans as any;
          
          teamData = {
            id: teamInfo.id,
            name: teamInfo.name,
            code: teamInfo.code,
            admin: teamInfo.admin_id,
            admin_id: teamInfo.admin_id,
            plan_id: teamInfo.plan_id,
            subscription_status: teamInfo.subscription_status,
            subscription_period_end: teamInfo.subscription_period_end,
            plan: {
              id: planData.id,
              name: planData.name,
              description: planData.description || '',
              price: planData.price_monthly || 0,
              credits: (planData as any).credits || 0,
              maxMembers: planData.max_members,
              maxBrands: planData.max_brands,
              maxStrategicThemes: planData.max_strategic_themes,
              maxPersonas: planData.max_personas,
              trialDays: planData.trial_days,
              isActive: planData.is_active,
            },
            credits: (teamInfo as any).credits || 0,
            free_brands_used: (teamInfo as any).free_brands_used || 0,
            free_personas_used: (teamInfo as any).free_personas_used || 0,
            free_themes_used: (teamInfo as any).free_themes_used || 0,
          };
        }
      }

      if (!isMounted.current) return;

      dataCache.current = {
        timestamp: now,
        user: userData,
        team: teamData
      };

      setUser(userData);
      setTeam(teamData);
      // Payment system disabled - never expire
      setIsTrialExpired(false);
      setTrialDaysRemaining(null);
    } catch (error) {
      // Silent error
    } finally {
      if (isMounted.current) {
        setIsLoading(false);
      }
    }
  }, [checkIfSystemAdmin]);

  const reloadUserData = useCallback(async () => {
    const { data: { session: currentSession } } = await supabase.auth.getSession();
    if (currentSession?.user) {
      dataCache.current = null;
      lastReloadTime.current = 0;
      await loadUserData(currentSession.user, true);
    }
  }, [loadUserData]);

  const refreshProfile = useCallback(async () => {
    if (!user?.id) return;

    try {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();

      if (error) {
        return;
      }

      if (profile && isMounted.current) {
        setUser(prev => prev ? {
          ...prev,
          name: profile.name || profile.email || prev.name,
          teamId: profile.team_id,
          avatarUrl: profile.avatar_url,
          tutorialCompleted: profile.tutorial_completed || false,
          credits: profile.credits || 0,
          planId: profile.plan_id || 'free',
          subscriptionStatus: profile.subscription_status,
          subscriptionPeriodEnd: profile.subscription_period_end,
        } : null);

        dataCache.current = null;
      }
    } catch (error) {
      // Silent error
    }
  }, [user?.id]);

  const logout = useCallback(async () => {
    try {
      await supabase.auth.signOut();
      setUser(null);
      setTeam(null);
      setSession(null);
      setIsTrialExpired(false);
      setTrialDaysRemaining(null);
      dataCache.current = null;
      lastReloadTime.current = 0;
    } catch (error) {
      // Silent error
    }
  }, []);

  useEffect(() => {
    isMounted.current = true;
    let mounted = true;

    const initializeAuth = async () => {
      try {
        setIsLoading(true);
        
        const { data: { session: currentSession }, error } = await supabase.auth.getSession();
        
        if (!mounted) return;
        
        setSession(currentSession);

        if (currentSession?.user) {
          isInitialized.current = true;
          await loadUserData(currentSession.user, true);
        } else {
          setIsLoading(false);
        }
      } catch (error) {
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    initializeAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, newSession) => {
        if (!mounted) return;

        if (event === 'TOKEN_REFRESHED') {
          setSession(newSession);
          return;
        }

        if (event === 'SIGNED_OUT') {
          setSession(null);
          setUser(null);
          setTeam(null);
          setIsTrialExpired(false);
          setTrialDaysRemaining(null);
          setIsLoading(false);
          dataCache.current = null;
          isInitialized.current = false;
          isInitialLoad.current = true;
          return;
        }

        if (event === 'SIGNED_IN') {
          if (isInitialized.current) {
            setSession(newSession);
            return;
          }
          
          setSession(newSession);
          
          if (newSession?.user) {
            isInitialized.current = true;
            setTimeout(() => {
              if (mounted) {
                loadUserData(newSession.user, true);
              }
            }, 0);
          } else {
            setUser(null);
            setTeam(null);
            setIsLoading(false);
          }
          return;
        }

        if (event === 'INITIAL_SESSION') {
          return;
        }

        setSession(newSession);
      }
    );

    return () => {
      mounted = false;
      isMounted.current = false;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      subscription.unsubscribe();
    };
  }, [loadUserData]);

  const isAuthenticated = useMemo(() => !!session && !!user, [session, user]);

  // Refresh créditos do usuário individual
  const refreshUserCredits = useCallback(async () => {
    if (!user?.id) return;
    
    const { data, error } = await supabase
      .from('profiles')
      .select('credits')
      .eq('id', user.id)
      .single();
      
    if (error) return;
      
    if (data) {
      setUser(prev => prev ? { ...prev, credits: data.credits || 0 } : null);
    }
  }, [user?.id]);

  // Mantido para compatibilidade, mas agora usa profiles
  const refreshTeamCredits = useCallback(async () => {
    await refreshUserCredits();
  }, [refreshUserCredits]);

  const refreshTeamData = useCallback(async () => {
    if (!user?.teamId) return;

    try {
      const { data: teamData, error } = await supabase
        .from('teams')
        .select(`
          *,
          plan:plans(*)
        `)
        .eq('id', user.teamId)
        .single();

      if (error) return;

      if (teamData) {
        setTeam({
          id: teamData.id,
          name: teamData.name,
          code: teamData.code,
          admin: teamData.admin_id,
          admin_id: teamData.admin_id,
          plan_id: teamData.plan_id,
          subscription_status: teamData.subscription_status,
          subscription_period_end: teamData.subscription_period_end,
          plan: {
            id: teamData.plan.id,
            name: teamData.plan.name,
            description: teamData.plan.description || '',
            price: teamData.plan.price_monthly,
            credits: (teamData.plan as any).credits || 0,
            maxMembers: teamData.plan.max_members,
            maxBrands: teamData.plan.max_brands,
            maxStrategicThemes: teamData.plan.max_strategic_themes,
            maxPersonas: teamData.plan.max_personas,
            trialDays: teamData.plan.trial_days,
            isActive: teamData.plan.is_active
          },
          credits: (teamData as any).credits || 0,
          free_brands_used: (teamData as any).free_brands_used || 0,
          free_personas_used: (teamData as any).free_personas_used || 0,
          free_themes_used: (teamData as any).free_themes_used || 0,
        });
      }
    } catch (error) {
      console.error('[AuthContext] Error in refreshTeamData:', error);
    }
  }, [user?.teamId]);

  const value = useMemo(
    () => ({
      user,
      session,
      team,
      isAuthenticated,
      isLoading,
      isTrialExpired,
      trialDaysRemaining,
      logout,
      reloadUserData,
      refreshProfile,
      refreshTeamData,
      refreshTeamCredits,
      refreshUserCredits,
      setUser
    }),
    [user, session, team, isAuthenticated, isLoading, isTrialExpired, trialDaysRemaining, logout, reloadUserData, refreshProfile, refreshTeamData, refreshUserCredits]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
