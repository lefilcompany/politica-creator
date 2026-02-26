import { useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireTeam?: boolean; // Agora opcional e padrão false
}

export default function ProtectedRoute({ children, requireTeam = false }: ProtectedRouteProps) {
  const { user, session, team, isLoading, isTrialExpired, trialDaysRemaining } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const hasRedirected = useRef(false);

  useEffect(() => {
    if (isLoading) return;
    
    if (hasRedirected.current) return;

    // Verificar se realmente não há sessão ativa antes de redirecionar
    if (!session || !user) {
      // Double check: verificar localStorage antes de redirecionar
      const supabaseProjectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const hasStoredSession = localStorage.getItem(`sb-${supabaseProjectId}-auth-token`);
      
      if (hasStoredSession) {
        return; // Aguardar auth context processar
      }
      
      hasRedirected.current = true;
      navigate("/", { replace: true });
      return;
    }

    // Se o usuário é system admin, redirecionar para a área do sistema
    if (user?.isAdmin) {
      hasRedirected.current = true;
      navigate("/system", { replace: true });
      return;
    }

    // Se o onboarding político não foi concluído, redirecionar
    if (!user?.tutorialCompleted && location.pathname !== '/political-onboarding') {
      hasRedirected.current = true;
      navigate("/political-onboarding", { replace: true });
      return;
    }

    // Payment system disabled - free access

    // Se requer equipe especificamente e não tem, mostra mensagem
    if (requireTeam && !team) {
      toast.info('Esta funcionalidade requer participação em uma equipe.');
      return;
    }
  }, [user, team, session, isLoading, isTrialExpired, navigate, requireTeam]);

  // Mostra loading enquanto verifica autenticação
  if (isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto" />
          <p className="text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  // Se não há usuário, não renderiza nada (vai redirecionar)
  if (!user) {
    return null;
  }

  // Se é system admin, não renderiza nada (vai redirecionar para system)
  if (user?.isAdmin) {
    return null;
  }

  // Se requer equipe e não tem, mostra mensagem específica
  if (requireTeam && !team) {
    return (
      <div className="flex h-screen w-full items-center justify-center p-6">
        <div className="max-w-md text-center space-y-4">
          <div className="bg-primary/10 rounded-full p-4 w-16 h-16 mx-auto flex items-center justify-center">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-8 w-8 text-primary"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
              />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-foreground">Funcionalidade de Equipe</h2>
          <p className="text-muted-foreground">
            Esta funcionalidade requer participação em uma equipe para compartilhamento de conteúdo.
          </p>
          <p className="text-sm text-muted-foreground">
            Você pode criar ou entrar em uma equipe nas configurações.
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
