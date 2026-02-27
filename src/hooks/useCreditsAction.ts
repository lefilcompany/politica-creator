import { useAuth } from './useAuth';
import { CREDIT_COSTS } from '@/lib/creditCosts';
import { toast } from 'sonner';

interface ExecuteActionOptions {
  showCreditUpdate?: boolean;
  onSuccess?: () => void;
}

export function useCreditsAction() {
  const { user, refreshUserCredits } = useAuth();

  const executeAction = async <T>(
    actionFn: () => Promise<T>,
    actionType: keyof typeof CREDIT_COSTS,
    options?: ExecuteActionOptions
  ): Promise<T | null> => {
    const cost = CREDIT_COSTS[actionType];
    const currentCredits = user?.credits || 0;

    if (currentCredits < cost) {
      toast.error(`Créditos insuficientes. Necessário: ${cost}, disponível: ${currentCredits}.`);
      return null;
    }

    try {
      const result = await actionFn();
      
      // Refresh credits after action
      await refreshUserCredits();
      
      options?.onSuccess?.();
      return result;
    } catch (error) {
      throw error;
    }
  };

  return { 
    executeAction, 
    currentCredits: user?.credits || 0 
  };
}
