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
    try {
      // Payment system disabled - execute without credit checks
      const result = await actionFn();
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
