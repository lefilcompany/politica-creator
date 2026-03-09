import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  Zap,
  Crown,
  Sparkles,
  Star,
  CheckCircle,
  Loader2,
  ArrowRight,
  MessageCircle,
  Coins,
  Gift,
  Shield,
  Clock,
  Rocket,
  Plus,
  Minus,
  ShoppingCart,
  Check,
  ChevronDown,
  HelpCircle,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageBreadcrumb } from "@/components/PageBreadcrumb";
import { motion } from "framer-motion";

interface CreditPackage {
  id: string;
  name: string;
  description: string;
  price: number;
  credits: number;
  stripePriceId: string | null;
  isEnterprise?: boolean;
}

const packageIcons: Record<string, any> = {
  pack_basic: Zap,
  pack_pro: Crown,
  pack_premium: Sparkles,
  pack_enterprise: Star,
};

const packageColors: Record<string, string> = {
  pack_basic: "from-blue-500 to-blue-600",
  pack_pro: "from-purple-500 to-purple-600",
  pack_premium: "from-pink-500 to-pink-600",
  pack_enterprise: "from-amber-500 to-orange-600",
};

const ENTERPRISE_WHATSAPP = "5581996600072";
const CREDIT_PRICE = 5;
const CREDIT_STEP = 5;
const MIN_CREDITS = 5;
const MAX_CREDITS = 500;

const Credits = () => {
  const { user, refreshUserCredits } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [packages, setPackages] = useState<CreditPackage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadingPackageId, setLoadingPackageId] = useState<string | null>(null);
  const [customCredits, setCustomCredits] = useState(20);
  const [creditInputValue, setCreditInputValue] = useState("20");
  const [loadingCustom, setLoadingCustom] = useState(false);
  const [verifyingPayment, setVerifyingPayment] = useState(false);

  const handlePaymentCallback = useCallback(async () => {
    const success = searchParams.get('success');
    const sessionId = searchParams.get('session_id');

    if (success === 'true' && sessionId) {
      setVerifyingPayment(true);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const { data, error } = await supabase.functions.invoke('verify-payment', {
          body: { session_id: sessionId },
          headers: {
            Authorization: `Bearer ${session?.access_token}`,
          }
        });

        if (error) throw error;

        if (data.success) {
          await refreshUserCredits();
          
          toast.success(
            data.already_processed 
              ? "Pagamento já processado! Redirecionando..." 
              : `✅ ${data.credits_added} créditos adicionados! Novo saldo: ${data.new_balance} créditos`,
            { duration: 4000 }
          );
          
          setTimeout(() => {
            navigate('/dashboard', { replace: true });
          }, 1500);
        } else {
          toast.error("Pagamento não foi concluído");
          navigate('/credits', { replace: true });
        }
      } catch (error: any) {
        console.error("Error verifying payment:", error);
        toast.error("Erro ao verificar pagamento: " + error.message);
      } finally {
        setVerifyingPayment(false);
      }
    } else if (searchParams.get('canceled') === 'true') {
      toast.info("Compra cancelada");
      navigate('/credits', { replace: true });
    }
  }, [searchParams, navigate, refreshUserCredits]);

  useEffect(() => {
    handlePaymentCallback();
  }, [handlePaymentCallback]);

  const loadPackages = useCallback(async () => {
    try {
      const { data: packagesData, error } = await supabase
        .from("plans")
        .select("*")
        .eq("is_active", true)
        .order("price_monthly", { ascending: true });

      if (error) throw error;

      if (packagesData) {
        const formattedPackages: CreditPackage[] = packagesData
          .filter((p) => p.id !== 'pack_trial' && p.id !== 'starter' && p.id !== 'free' && p.id !== 'pack_business')
          .map((p) => ({
            id: p.id,
            name: p.name,
            description: p.description || '',
            price: p.price_monthly || 0,
            credits: p.credits || 0,
            stripePriceId: p.stripe_price_id_monthly,
            isEnterprise: p.id === 'pack_enterprise',
          }));
        
        setPackages(formattedPackages);
      }
    } catch (error) {
      console.error("Error loading packages:", error);
      toast.error("Erro ao carregar pacotes");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPackages();
  }, [loadPackages]);

  const handleBuyPackage = async (pkg: CreditPackage) => {
    if (!user) {
      navigate("/onboarding");
      return;
    }

    if (pkg.isEnterprise) {
      const message = encodeURIComponent("Olá! Tenho interesse no pacote Enterprise do Creator. Gostaria de mais informações.");
      window.open(`https://wa.me/${ENTERPRISE_WHATSAPP}?text=${message}`, '_blank');
      return;
    }

    if (!pkg.stripePriceId) {
      toast.error("Este pacote ainda não está disponível para compra.");
      return;
    }

    try {
      setLoadingPackageId(pkg.id);
      
      const { data, error } = await supabase.functions.invoke("create-checkout", {
        body: { 
          type: 'credits',
          price_id: pkg.stripePriceId,
          package_id: pkg.id,
          return_url: '/credits'
        },
      });

      if (error) throw error;

      if (data?.url) {
        toast.success("Abrindo página de pagamento...", {
          description: "Uma nova aba será aberta com o checkout seguro"
        });
        
        setTimeout(() => {
          window.open(data.url, '_blank');
        }, 500);
      }
    } catch (error) {
      console.error("Erro ao criar checkout:", error);
      toast.error("Erro ao iniciar compra", {
        description: error instanceof Error ? error.message : "Tente novamente em alguns instantes"
      });
    } finally {
      setLoadingPackageId(null);
    }
  };

  const handleCustomPurchase = async () => {
    if (!user) {
      navigate("/onboarding");
      return;
    }
    
    setLoadingCustom(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-checkout', {
        body: { 
          type: 'custom',
          credits: customCredits,
          return_url: '/credits'
        },
      });

      if (error) throw error;
      if (data?.url) {
        toast.success("Abrindo página de pagamento...");
        setTimeout(() => {
          window.open(data.url, '_blank');
        }, 500);
      }
    } catch (error: any) {
      console.error("Error creating custom checkout:", error);
      toast.error("Erro ao criar checkout: " + error.message);
    } finally {
      setLoadingCustom(false);
    }
  };

  const incrementCredits = () => {
    setCustomCredits(prev => {
      const next = Math.min(prev + CREDIT_STEP, MAX_CREDITS);
      setCreditInputValue(String(next));
      return next;
    });
  };

  const decrementCredits = () => {
    setCustomCredits(prev => {
      const next = Math.max(prev - CREDIT_STEP, MIN_CREDITS);
      setCreditInputValue(String(next));
      return next;
    });
  };

  const renderPackageCard = (pkg: CreditPackage, isPopular: boolean = false) => {
    const Icon = packageIcons[pkg.id] || Zap;
    const colorClass = packageColors[pkg.id] || "from-blue-500 to-blue-600";
    const isEnterprise = pkg.isEnterprise;

    return (
      <motion.div
        key={pkg.id}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        whileHover={{ scale: 1.02, y: -4 }}
        className="h-full"
      >
        <Card
          className={cn(
            "relative h-full transition-all duration-300 overflow-hidden group",
            "border-0 shadow-md hover:shadow-xl",
            isPopular && "ring-2 ring-primary/20 shadow-lg",
            isEnterprise && "ring-1 ring-amber-500/30"
          )}
        >
          <div className={cn(
            "absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500",
            "bg-gradient-to-br from-primary/5 via-transparent to-primary/10"
          )} />

          {isPopular && (
            <div className="absolute -right-8 top-6 rotate-45 bg-primary px-10 py-1 text-xs font-semibold text-primary-foreground shadow-lg">
              Popular
            </div>
          )}

          {isEnterprise && (
            <div className="absolute -right-8 top-6 rotate-45 bg-amber-500 px-10 py-1 text-xs font-semibold text-white shadow-lg">
              Sob consulta
            </div>
          )}

          <CardHeader className="relative pb-2">
            <div className={cn(
              "w-14 h-14 rounded-2xl flex items-center justify-center mb-4 transition-all duration-300",
              "bg-gradient-to-br shadow-lg",
              colorClass
            )}>
              <Icon className="h-7 w-7 text-white" />
            </div>
            
            <CardTitle className="text-2xl font-bold">{pkg.name}</CardTitle>
            <CardDescription className="text-sm min-h-[2.5rem]">{pkg.description}</CardDescription>
            
            <div className="mt-4 flex items-baseline gap-1">
              {isEnterprise ? (
                <span className="text-2xl font-bold text-amber-600">Entre em contato</span>
              ) : (
                <span className="text-4xl font-bold">R$ {pkg.price.toLocaleString('pt-BR')}</span>
              )}
            </div>
          </CardHeader>

          <CardContent className="relative space-y-4">
            <div className="flex items-center justify-center gap-2.5 p-3.5 rounded-xl bg-primary/8 border border-primary/10">
              <Zap className="h-5 w-5 text-primary flex-shrink-0" />
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl font-bold text-primary leading-none">
                  {isEnterprise ? '∞' : pkg.credits.toLocaleString('pt-BR')}
                </span>
                <span className="text-sm font-medium text-muted-foreground">créditos</span>
              </div>
            </div>

            {!isEnterprise && pkg.price > 0 && pkg.credits > 0 && (
              <p className="text-sm text-muted-foreground text-center">
                R$ {(pkg.price / pkg.credits).toFixed(2)} por crédito
              </p>
            )}

            <Button
              className={cn(
                "w-full mt-4 transition-all duration-300",
                isEnterprise 
                  ? "bg-amber-500 hover:bg-amber-600 text-white" 
                  : "bg-primary hover:bg-primary/90"
              )}
              size="lg"
              onClick={() => handleBuyPackage(pkg)}
              disabled={loadingPackageId === pkg.id}
            >
              {loadingPackageId === pkg.id ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processando...
                </>
              ) : isEnterprise ? (
                <>
                  <MessageCircle className="mr-2 h-4 w-4" />
                  Falar no WhatsApp
                </>
              ) : (
                <>
                  Comprar créditos
                  <ArrowRight className="ml-2 h-4 w-4" />
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </motion.div>
    );
  };

  if (verifyingPayment) {
    return (
      <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center">
        <Card className="w-auto border-0 shadow-lg">
          <CardContent className="pt-6 flex flex-col items-center gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-lg font-medium">Verificando pagamento...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-4">
          <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto" />
          <p className="text-muted-foreground">Carregando pacotes...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-8 animate-fade-in">
      <PageBreadcrumb items={[{ label: "Créditos" }]} />

      {/* Header */}
      <Card className="border-0 shadow-md bg-gradient-to-br from-primary/10 via-primary/5 to-card rounded-2xl overflow-hidden">
        <CardContent className="p-5 sm:p-6 md:p-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="flex-shrink-0 bg-primary/10 text-primary rounded-2xl p-3 sm:p-4">
                <Coins className="h-7 w-7 sm:h-8 sm:w-8 md:h-10 md:w-10" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-foreground mb-1">Pacotes de Créditos</h1>
                <p className="text-xs sm:text-sm md:text-base text-muted-foreground">
                  Compre créditos para usar nas ferramentas de criação com IA
                </p>
              </div>
            </div>
            
            {user && (
              <div className="flex items-center gap-3 bg-card/80 backdrop-blur-sm px-4 py-3 rounded-xl shadow-sm">
                <p className="text-sm text-muted-foreground whitespace-nowrap">Seu saldo atual</p>
                <div className="flex items-center gap-1.5">
                  <Zap className="h-5 w-5 text-primary" />
                  <span className="text-2xl font-bold text-primary">{user.credits || 0}</span>
                  <span className="text-sm text-muted-foreground">créditos</span>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Benefits bar */}
      <div className="flex flex-wrap justify-center gap-6 text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4 text-primary" />
          <span>Pagamento seguro</span>
        </div>
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-primary" />
          <span>Créditos não expiram</span>
        </div>
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-primary" />
          <span>Acesso imediato</span>
        </div>
        <div className="flex items-center gap-2">
          <Gift className="h-4 w-4 text-primary" />
          <span>Compre quando precisar</span>
        </div>
      </div>

      {/* Packages grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5 lg:gap-6">
        {packages.map((pkg) => renderPackageCard(pkg, pkg.id === 'pack_pro'))}
      </div>

      {/* Compra Avulsa - Collapsible */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.5 }}
      >
        <Collapsible className="group">
          <Card className="border-0 shadow-md hover:shadow-lg transition-all duration-300 overflow-hidden">
            <CollapsibleTrigger className="w-full" asChild>
              <button className="flex items-center justify-between w-full p-4 sm:p-5 cursor-pointer hover:bg-muted/20 transition-colors active:scale-[0.99]">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
                    <ShoppingCart className="h-5 w-5" />
                  </div>
                  <div className="text-left">
                    <h3 className="text-base font-bold">Compra Avulsa</h3>
                    <p className="text-xs text-muted-foreground">
                      Créditos avulsos a <span className="font-semibold text-primary">R$ {CREDIT_PRICE.toFixed(2)}</span> cada
                    </p>
                  </div>
                </div>
                <ChevronDown className="h-5 w-5 text-muted-foreground transition-transform duration-300 group-data-[state=open]:rotate-180" />
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="px-4 sm:px-6 pb-5 pt-2">
                <div className="flex flex-col xl:flex-row items-center gap-5 xl:gap-8">
                  <div className="flex-1 min-w-0 text-center xl:text-left">
                    <p className="text-sm text-muted-foreground">
                      Compre créditos avulsos de 5 em 5. Cada crédito custa <span className="font-semibold text-primary">R$ {CREDIT_PRICE.toFixed(2)}</span>
                    </p>
                    <div className="flex items-center justify-center xl:justify-start gap-1.5 text-xs text-muted-foreground mt-1">
                      <Check className="h-3.5 w-3.5 text-primary flex-shrink-0" />
                      <span>Pagamento único via Stripe</span>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-5 w-full xl:w-auto">
                    <div className="flex items-center gap-3">
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-10 w-10 rounded-full border-2 hover:bg-primary hover:text-primary-foreground transition-all flex-shrink-0"
                        onClick={decrementCredits}
                        disabled={customCredits <= MIN_CREDITS}
                      >
                        <Minus className="h-4 w-4" />
                      </Button>
                      
                      <div className="text-center min-w-[80px]">
                        <input
                          type="text"
                          inputMode="numeric"
                          value={creditInputValue}
                          onChange={(e) => {
                            const raw = e.target.value.replace(/[^0-9]/g, '');
                            setCreditInputValue(raw);
                          }}
                          onBlur={() => {
                            const val = parseInt(creditInputValue);
                            if (isNaN(val) || val < MIN_CREDITS) {
                              setCustomCredits(MIN_CREDITS);
                              setCreditInputValue(String(MIN_CREDITS));
                            } else {
                              const clamped = Math.min(val, MAX_CREDITS);
                              const rounded = Math.round(clamped / CREDIT_STEP) * CREDIT_STEP || MIN_CREDITS;
                              setCustomCredits(rounded);
                              setCreditInputValue(String(rounded));
                            }
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              (e.target as HTMLInputElement).blur();
                            }
                          }}
                          min={MIN_CREDITS}
                          max={MAX_CREDITS}
                          step={CREDIT_STEP}
                          className="w-24 text-center text-4xl xl:text-5xl font-bold text-primary bg-transparent border-none outline-none focus:ring-0 appearance-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none [-moz-appearance:textfield]"
                        />
                        <p className="text-xs text-muted-foreground -mt-1">créditos</p>
                      </div>
                      
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-10 w-10 rounded-full border-2 hover:bg-primary hover:text-primary-foreground transition-all flex-shrink-0"
                        onClick={incrementCredits}
                        disabled={customCredits >= MAX_CREDITS}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>

                    <motion.div 
                      key={customCredits * CREDIT_PRICE}
                      initial={{ scale: 1.05 }}
                      animate={{ scale: 1 }}
                      className="bg-primary/10 px-5 py-2.5 rounded-xl text-center flex-shrink-0"
                    >
                      <p className="text-xs text-muted-foreground">Total</p>
                      <p className="text-2xl font-bold text-primary">
                        R$ {(customCredits * CREDIT_PRICE).toFixed(2)}
                      </p>
                    </motion.div>

                    <Button
                      onClick={handleCustomPurchase}
                      disabled={loadingCustom}
                      size="lg"
                      className="w-full sm:w-auto h-12 px-6 text-base font-semibold shadow-md hover:shadow-lg transition-all duration-300 flex-shrink-0"
                    >
                      {loadingCustom ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                      ) : (
                        <>
                          <ShoppingCart className="h-4 w-4 mr-2" />
                          Comprar {customCredits} Créditos
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>
      </motion.div>

      {/* Info section - Collapsible */}
      <Collapsible className="group">
        <Card className="border-0 shadow-md overflow-hidden">
          <CollapsibleTrigger className="w-full" asChild>
            <button className="flex items-center justify-between w-full p-4 sm:p-5 cursor-pointer hover:bg-muted/20 transition-colors active:scale-[0.99]">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-muted/50 text-muted-foreground">
                  <HelpCircle className="h-5 w-5" />
                </div>
                <h3 className="text-base font-bold text-left">Como funcionam os créditos?</h3>
              </div>
              <ChevronDown className="h-5 w-5 text-muted-foreground transition-transform duration-300 group-data-[state=open]:rotate-180" />
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="px-5 sm:px-6 pb-5 pt-2">
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground text-justify">
                  Os créditos são consumidos ao usar as ferramentas de criação de conteúdo com IA. 
                  Cada tipo de criação tem um custo diferente. Os créditos comprados nunca expiram 
                  e você pode comprar mais a qualquer momento.
                </p>
                <Button 
                  variant="link" 
                  className="text-primary"
                  onClick={() => navigate('/credit-history')}
                >
                  Ver histórico de uso de créditos
                </Button>
              </div>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>
    </div>
  );
};

export default Credits;
