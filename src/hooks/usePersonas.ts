import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";

export type PersonaRow = Tables<'personas'>;
export type PersonaInsert = TablesInsert<'personas'>;
export type PersonaUpdate = TablesUpdate<'personas'>;

export const usePersonas = (brandId?: string) => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['personas', user?.id, brandId],
    queryFn: async () => {
      if (!user?.id) return [];
      
      let query = supabase
        .from('personas')
        .select('*')
        .eq('user_id', user.id)
        .order('name');
      
      if (brandId) {
        query = query.eq('brand_id', brandId);
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
    staleTime: 1000 * 60 * 5,
  });
};

export const usePersona = (personaId: string | undefined) => {
  return useQuery({
    queryKey: ['persona', personaId],
    queryFn: async () => {
      if (!personaId) return null;
      
      const { data, error } = await supabase
        .from('personas')
        .select('*')
        .eq('id', personaId)
        .single();
      
      if (error) throw error;
      return data;
    },
    enabled: !!personaId,
    staleTime: 1000 * 60 * 5,
  });
};

export const useCreatePersona = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (persona: Omit<PersonaInsert, 'user_id' | 'team_id'>) => {
      if (!user?.id) throw new Error('User not authenticated');
      
      const { data, error } = await supabase
        .from('personas')
        .insert({
          ...persona,
          user_id: user.id,
          team_id: user.teamId || null,
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['personas'] });
    },
  });
};

export const useUpdatePersona = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...persona }: PersonaUpdate & { id: string }) => {
      const { data, error } = await supabase
        .from('personas')
        .update(persona)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['personas'] });
      queryClient.invalidateQueries({ queryKey: ['persona', variables.id] });
    },
  });
};

export const useDeletePersona = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (personaId: string) => {
      const { error } = await supabase
        .from('personas')
        .delete()
        .eq('id', personaId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['personas'] });
    },
  });
};
