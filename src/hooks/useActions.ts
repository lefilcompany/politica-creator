import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { Tables, TablesUpdate } from "@/integrations/supabase/types";

export type ActionRow = Tables<'actions'>;
export type ActionUpdate = TablesUpdate<'actions'>;

export type ActionWithBrand = ActionRow & { 
  brands: { name: string } | null 
};

interface UseActionsOptions {
  brandId?: string;
  type?: string;
  status?: string;
  limit?: number;
}

export const useActions = (options: UseActionsOptions = {}) => {
  const { user } = useAuth();
  const { brandId, type, status, limit = 50 } = options;

  return useQuery({
    queryKey: ['actions', user?.id, brandId, type, status, limit],
    queryFn: async () => {
      if (!user?.id) return [];
      
      let query = supabase
        .from('actions')
        .select('*, brands(name)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(limit);
      
      if (brandId) {
        query = query.eq('brand_id', brandId);
      }
      if (type) {
        query = query.eq('type', type);
      }
      if (status) {
        query = query.eq('status', status);
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      return data as ActionWithBrand[];
    },
    enabled: !!user?.id,
    staleTime: 1000 * 60 * 1,
  });
};

export const useAction = (actionId: string | undefined) => {
  return useQuery({
    queryKey: ['action', actionId],
    queryFn: async () => {
      if (!actionId) return null;
      
      const { data, error } = await supabase
        .from('actions')
        .select('*, brands(name)')
        .eq('id', actionId)
        .single();
      
      if (error) throw error;
      return data as ActionWithBrand;
    },
    enabled: !!actionId,
    staleTime: 1000 * 60 * 1,
  });
};

export const useUpdateAction = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...action }: ActionUpdate & { id: string }) => {
      const { data, error } = await supabase
        .from('actions')
        .update(action)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['actions'] });
      queryClient.invalidateQueries({ queryKey: ['action', variables.id] });
    },
  });
};

export const useDeleteAction = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (actionId: string) => {
      const { error } = await supabase
        .from('actions')
        .delete()
        .eq('id', actionId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['actions'] });
    },
  });
};
