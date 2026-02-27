import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";

interface CreateTeamDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  context?: 'login' | 'register' | 'onboarding';
}

export function CreateTeamDialog({ open, onClose, onSuccess, context = 'login' }: CreateTeamDialogProps) {
  const [teamName, setTeamName] = useState("");
  const [teamCode, setTeamCode] = useState("");
  const [showCode, setShowCode] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [couponCode, setCouponCode] = useState("");
  const [isValidCouponFormat, setIsValidCouponFormat] = useState(false);
  const [couponValidationError, setCouponValidationError] = useState("");
  const navigate = useNavigate();

  const generateRandomCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 8; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  };

  // Detectar se é cupom promocional (formato: nome200)
  const isPromoCoupon = (code: string): boolean => {
    return /^[a-z]+200$/i.test(code.replace(/\s/g, ''));
  };

  // Detectar se é cupom checksum (formato: XX-YYYYYY-CC)
  const isChecksumFormat = (code: string): boolean => {
    return /^(B4|P7|C2|C1|C4)-[A-Z0-9]{6}-[A-Z0-9]{2}$/.test(code);
  };

  const handleCouponInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value;
    
    // Se parece com cupom promocional (contém letras minúsculas ou termina com 200)
    if (/[a-z]/.test(value) || value.toLowerCase().endsWith('200')) {
      // Manter como está, apenas remover espaços
      value = value.replace(/\s/g, '').toLowerCase();
      setCouponCode(value);
      setIsValidCouponFormat(isPromoCoupon(value));
    } else {
      // Formato checksum - aplicar formatação automática
      value = value.toUpperCase().replace(/[^A-Z0-9]/g, '');
      
      // Limitar a exatamente 10 caracteres (sem hífens)
      value = value.slice(0, 10);
      
      // Adicionar hífens automaticamente
      let formatted = value;
      if (value.length > 2) {
        formatted = value.slice(0, 2) + '-' + value.slice(2);
      }
      if (value.length > 8) {
        formatted = value.slice(0, 2) + '-' + value.slice(2, 8) + '-' + value.slice(8);
      }
      
      setCouponCode(formatted);
      setIsValidCouponFormat(isChecksumFormat(formatted));
    }
    
    // Limpar erro ao alterar input
    if (couponValidationError) {
      setCouponValidationError('');
    }
  };

  const handleCreateTeam = async () => {
    if (!teamName.trim()) {
      toast.error("Por favor, insira o nome da equipe");
      return;
    }

    if (!teamCode.trim()) {
      toast.error("Por favor, crie um código de acesso");
      return;
    }

    // Validar formato do cupom se preenchido
    if (couponCode.trim() && !isValidCouponFormat) {
      setCouponValidationError("Formato de cupom inválido");
      return;
    }

    setIsLoading(true);

    try {
      // 1. Criar equipe
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.user) {
        toast.error("Sessão não encontrada. Por favor, tente novamente.");
        onClose();
        return;
      }

      console.log("Criando equipe para usuário:", session.user.id);

      const { data, error } = await supabase.rpc('create_team_for_user', {
        p_user_id: session.user.id,
        p_team_name: teamName,
        p_team_code: teamCode,
        p_plan_id: 'pack_trial'
      });

      if (error) {
        console.error('Erro ao criar equipe:', error);
        throw new Error(error.message);
      }

      console.log("Equipe criada com sucesso:", data);

      toast.success("Equipe criada com sucesso!");

      // 2. Se houver cupom, tentar resgatá-lo
      if (couponCode.trim() && isValidCouponFormat) {
        try {
          const { data: couponData, error: couponError } = await supabase.functions.invoke('redeem-coupon', {
            body: { couponCode: couponCode.trim() }
          });

          if (couponError) throw couponError;

          if (couponData.valid) {
            toast.success(`🎉 ${couponData.prize.description} aplicado(s) à sua equipe!`);
          } else {
            toast.warning(`Cupom inválido: ${couponData.error}. Equipe criada sem benefícios.`);
          }
        } catch (couponError: any) {
          console.error('Erro ao resgatar cupom:', couponError);
          toast.warning('Equipe criada, mas não foi possível aplicar o cupom.');
        }
      }

      // 3. Fechar dialog e redirecionar
      if (context === 'register') {
        // Cenário de REGISTRO: fazer logout e redirecionar para login
        toast.success("Equipe criada com sucesso! Faça login para acessar o sistema.");
        
        await supabase.auth.signOut();
        
        onSuccess();
        navigate("/");
      } else if (context === 'onboarding') {
        // Cenário de ONBOARDING: não redirecionar, deixar o componente pai controlar
        toast.success("Equipe criada com sucesso!");
        onSuccess();
      } else {
        // Cenário de LOGIN: ir direto ao dashboard
        toast.success("Equipe criada com sucesso!");
        
        onSuccess();
        navigate("/dashboard");
      }
    } catch (error: any) {
      console.error('Erro ao criar equipe:', error);
      toast.error(error.message || "Erro ao criar equipe. Tente novamente.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px] rounded-2xl">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">Criar nova equipe</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <p className="text-sm text-muted-foreground">
            Você será o administrador desta equipe e poderá convidar outros membros usando o código de acesso que você definir.
          </p>
          
          <div className="space-y-2">
            <Label htmlFor="teamName">
              Nome da equipe <span className="text-red-500">*</span>
            </Label>
            <Input
              id="teamName"
              placeholder="Ex: Minha Empresa, Time Marketing..."
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
              disabled={isLoading}
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="teamCode">
              Código de acesso <span className="text-red-500">*</span>
            </Label>
            <div className="relative">
              <Input
                id="teamCode"
                type={showCode ? "text" : "password"}
                placeholder="Crie um código seguro para sua equipe"
                value={teamCode}
                onChange={(e) => setTeamCode(e.target.value.toUpperCase())}
                disabled={isLoading}
                className="pr-20"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8"
                onClick={() => setShowCode(!showCode)}
                disabled={isLoading}
              >
                {showCode ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Este código será usado por outros usuários para solicitar entrada na sua equipe.
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setTeamCode(generateRandomCode())}
              disabled={isLoading}
              className="w-full sm:w-auto"
            >
              Gerar código aleatório
            </Button>
          </div>

          {/* Campo opcional de cupom */}
          <div className="space-y-2 pt-2 border-t">
            <Label htmlFor="couponCode" className="flex items-center gap-2">
              Cupom de premiação
              <span className="text-xs text-muted-foreground font-normal">(opcional)</span>
            </Label>
            <Input
              id="couponCode"
              placeholder="Digite seu cupom"
              value={couponCode}
              onChange={handleCouponInput}
              disabled={isLoading}
              maxLength={30}
              className="font-mono tracking-wider"
            />
            {couponCode && (
              <p className="text-xs text-muted-foreground">
                {isValidCouponFormat ? (
                  <span className="text-green-600 font-medium">✓ Formato válido</span>
                ) : (
                  <span className="text-amber-600">Ex: nome200 ou XX-YYYYYY-CC</span>
                )}
              </p>
            )}
            {couponValidationError && (
              <p className="text-xs text-red-600 font-medium">
                {couponValidationError}
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              Insira um cupom de premiação para receber benefícios instantâneos. Este campo é opcional.
            </p>
          </div>
        </div>
        
        <div className="flex gap-3 justify-end">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isLoading}
          >
            Voltar
          </Button>
          <Button
            onClick={handleCreateTeam}
            disabled={isLoading}
            className="bg-primary hover:bg-primary/90"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Criando...
              </>
            ) : (
              "Criar equipe"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
