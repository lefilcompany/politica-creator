import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import type { ActionSummary } from '@/types/action';
import { ACTION_TYPE_DISPLAY } from '@/types/action';
import type { BrandSummary } from '@/types/brand';

const ITEMS_PER_PAGE = 24;

interface HistoryFilters {
  brandFilter: string;
  typeFilter: string;
}

interface HistoryPage {
  actions: ActionSummary[];
  nextCursor: { createdAt: string; id: string } | null;
  totalCount: number;
}

export function useHistoryBrands() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['history-brands', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('brands')
        .select('id, name, responsible, created_at, updated_at')
        .eq('user_id', user!.id)
        .order('name');
      if (error) throw error;
      return (data || []).map(brand => ({
        id: brand.id,
        name: brand.name,
        responsible: brand.responsible,
        brandColor: null,
        avatarUrl: null,
        createdAt: brand.created_at,
        updatedAt: brand.updated_at
      })) as BrandSummary[];
    },
    enabled: !!user?.id,
  });
}

export function useHistoryActions(filters: HistoryFilters) {
  const { user } = useAuth();

  return useInfiniteQuery<HistoryPage>({
    queryKey: ['history-actions', user?.id, filters.brandFilter, filters.typeFilter],
    queryFn: async ({ pageParam }) => {
      const cursor = pageParam as { createdAt: string; id: string } | undefined;
      
      // Resolve type filter to DB value
      let typeDbValue: string | null = null;
      if (filters.typeFilter !== 'all') {
        const entry = Object.entries(ACTION_TYPE_DISPLAY).find(
          ([_, display]) => display === filters.typeFilter
        );
        if (entry) typeDbValue = entry[0];
      }

      // Query actions directly by user_id instead of using RPC with team_id
      let query = supabase
        .from('actions')
        .select('id, type, created_at, approved, brand_id, thumb_path, result, details, brands(name)', { count: 'exact' })
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false })
        .limit(ITEMS_PER_PAGE);

      if (filters.brandFilter !== 'all') {
        query = query.eq('brand_id', filters.brandFilter);
      }
      if (typeDbValue) {
        query = query.eq('type', typeDbValue);
      }
      if (cursor) {
        query = query.or(`created_at.lt.${cursor.createdAt},and(created_at.eq.${cursor.createdAt},id.lt.${cursor.id})`);
      }

      const { data: rows, error, count } = await query;

      if (error) throw error;

      const totalCount = count || 0;

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';

      const actions: ActionSummary[] = (rows || []).map((row: any) => {
        let imageUrl: string | undefined;
        if (row.thumb_path && supabaseUrl) {
          // thumb_path is the object name within the bucket (e.g. "content-images/teamId/file.png")
          // The bucket is "content-images", so the public URL needs bucket + object name
          imageUrl = `${supabaseUrl}/storage/v1/object/public/content-images/${row.thumb_path}`;
        } else if (row.result?.imageUrl) {
          imageUrl = row.result.imageUrl;
        } else if (row.result?.originalImage) {
          imageUrl = row.result.originalImage;
        }

        // Title priority: result.title > details.description > result.description
        const title = row.result?.title 
          || row.details?.description 
          || row.result?.description 
          || undefined;

        return {
          id: row.id,
          type: row.type,
          createdAt: row.created_at,
          approved: row.approved,
          brand: row.brands ? { id: row.brand_id, name: row.brands.name } : null,
          imageUrl,
          title,
          platform: row.details?.platform || undefined,
          objective: row.details?.objective || undefined,
        };
      });

      const lastAction = actions[actions.length - 1];
      const nextCursor = actions.length === ITEMS_PER_PAGE && lastAction
        ? { createdAt: lastAction.createdAt, id: lastAction.id }
        : null;

      return { actions, nextCursor, totalCount };
    },
    initialPageParam: undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled: !!user?.id,
  });
}
