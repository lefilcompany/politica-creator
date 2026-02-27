import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

const MAX_IMAGES_PER_ACCOUNT = 100;

export function useImageLimit() {
  const { user } = useAuth();
  const [imageCount, setImageCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  const fetchImageCount = useCallback(async () => {
    if (!user?.id) return;

    const { count, error } = await supabase
      .from('actions')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .in('type', ['CRIAR_CONTEUDO', 'CRIAR_CONTEUDO_RAPIDO']);

    if (!error && count !== null) {
      setImageCount(count);
    }
    setIsLoading(false);
  }, [user?.id]);

  useEffect(() => {
    fetchImageCount();
  }, [fetchImageCount]);

  return {
    imageCount,
    maxImages: MAX_IMAGES_PER_ACCOUNT,
    remaining: Math.max(0, MAX_IMAGES_PER_ACCOUNT - imageCount),
    hasReachedLimit: imageCount >= MAX_IMAGES_PER_ACCOUNT,
    isLoading,
    refetch: fetchImageCount,
  };
}
