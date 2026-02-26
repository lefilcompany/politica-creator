import { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useTheme } from "next-themes";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { CreatorLogo } from "@/components/CreatorLogo";
import { Eye, EyeOff, Mail, Lock, Sun, Moon, Loader2, User, Phone, ChevronDown, Ticket } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";

import { toast } from "sonner";
import { TeamSelectionDialog } from "@/components/auth/TeamSelectionDialog";
import ChangePasswordDialog from "@/components/perfil/ChangePasswordDialog";

import { useIsMobile } from "@/hooks/use-mobile";
import { useLanguage } from "@/contexts/LanguageContext";
import { useTranslation } from "@/hooks/useTranslation";
import { useAuth } from "@/hooks/useAuth";
import { useExtensionProtection, useFormProtection } from "@/hooks/useExtensionProtection";
import { getEmailRedirectUrl } from "@/lib/auth-urls";
import { useOAuthCallback } from "@/hooks/useOAuthCallback";
import { GoogleSignInButton } from "@/components/auth/GoogleSignInButton";
import decorativeElement from "@/assets/decorative-element.png";

// Interfaces para os dados do IBGE
interface State {
  id: number;
  sigla: string;
  nome: string;
}

interface City {
  id: number;
  nome: string;
}

const Auth = () => {
  const { t } = useTranslation();
  
  // Proteção contra extensões do navegador
  useExtensionProtection();
  const loginFormRef = useRef<HTMLFormElement>(null);
  const registerFormRef = useRef<HTMLFormElement>(null);
  useFormProtection(loginFormRef);
  useFormProtection(registerFormRef);
  
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showTeamSelection, setShowTeamSelection] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [waitingForAuth, setWaitingForAuth] = useState(false);
  

  // Login states
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);

  // Register states
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    phone: "",
    state: "",
    city: "",
  });
  const [confirmPassword, setConfirmPassword] = useState("");
  const [states, setStates] = useState<State[]>([]);
  const [cities, setCities] = useState<City[]>([]);
  const [loadingStates, setLoadingStates] = useState(true);
  const [loadingCities, setLoadingCities] = useState(false);
  const [privacyChecked, setPrivacyChecked] = useState(false);
  const [privacyModalOpen, setPrivacyModalOpen] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  
  // Coupon states
  const [couponCode, setCouponCode] = useState("");
  const [isValidCouponFormat, setIsValidCouponFormat] = useState(false);

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
    
    if (/[a-z]/.test(value) || value.toLowerCase().endsWith('200')) {
      value = value.replace(/\s/g, '').toLowerCase();
      setCouponCode(value);
      setIsValidCouponFormat(isPromoCoupon(value));
    } else {
      value = value.toUpperCase().replace(/[^A-Z0-9]/g, '');
      value = value.slice(0, 10);
      
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
  };

  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { theme, setTheme } = useTheme();
  const { language } = useLanguage();
  const { user, team, isLoading: authLoading } = useAuth();
  
  const isMobile = useIsMobile();
  const [sheetOpen, setSheetOpen] = useState(false);

  // Handle OAuth callback (Google sign-in return)
  const { showTeamDialog: showOAuthTeamDialog, handleTeamDialogClose: handleOAuthTeamDialogClose } = useOAuthCallback();

  // Validações de senha para registro
  const passwordsMatch = formData.password === confirmPassword;
  const isPasswordValid = formData.password && formData.password.length >= 6;

  // Redireciona automaticamente quando autenticado (inclui retorno do OAuth)
  useEffect(() => {
    if (!authLoading && user && !showChangePassword) {
      if (user.isAdmin) {
        console.log("[Auth] System Admin authenticated, redirecting to /system");
        navigate("/system", { replace: true });
        return;
      }
      console.log("[Auth] Auth complete, redirecting to dashboard");
      navigate("/dashboard", { replace: true });
    }
  }, [authLoading, user, showChangePassword, navigate]);

  // Busca os estados do Brasil na API do IBGE
  useEffect(() => {
    fetch("https://servicodados.ibge.gov.br/api/v1/localidades/estados?orderBy=nome")
      .then((res) => res.json())
      .then((data: State[]) => {
        setStates(data);
        setLoadingStates(false);
      })
      .catch(() => {
        setLoadingStates(false);
        toast.error("Erro ao carregar estados");
      });
  }, []);

  // Busca as cidades sempre que um estado é selecionado
  useEffect(() => {
    if (formData.state) {
      setLoadingCities(true);
      setCities([]);
      fetch(`https://servicodados.ibge.gov.br/api/v1/localidades/estados/${formData.state}/municipios`)
        .then((res) => res.json())
        .then((data: City[]) => {
          setCities(data);
          setLoadingCities(false);
        })
        .catch(() => {
          setLoadingCities(false);
          toast.error("Erro ao carregar cidades");
        });
    }
  }, [formData.state]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setWaitingForAuth(false);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: loginEmail,
        password: loginPassword,
      });

      if (error) {
        toast.error(t.login.invalidCredentials, {
          description: "Verifique seu e-mail e senha. Se esqueceu sua senha, use o link 'Esqueceu a senha?' abaixo.",
          duration: 6000,
        });
        return;
      }

      if (data.user) {
        const [profileResult, systemAdminResult] = await Promise.all([
          supabase
            .from("profiles")
            .select("team_id, force_password_change")
            .eq("id", data.user.id)
            .single(),
          supabase
            .from("user_roles")
            .select("role")
            .eq("user_id", data.user.id)
            .eq("role", "system")
            .maybeSingle(),
        ]);

        if (profileResult.error) {
          console.error("Erro ao carregar perfil:", profileResult.error);
          toast.error(t.errors.somethingWrong);
          return;
        }

        const profileData = profileResult.data;
        const isSystemAdmin = !!systemAdminResult.data;

        if (profileData.force_password_change) {
          setShowChangePassword(true);
          return;
        }

        if (isSystemAdmin) {
          navigate("/system", { replace: true });
          return;
        }

        setWaitingForAuth(true);
      }
    } catch (error) {
      console.error("Erro no login:", error);
      toast.error(t.errors.somethingWrong);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { id, value } = e.target;
    if (id === "phone") {
      const cleaned = value.replace(/\D/g, "");
      let formatted = cleaned;
      if (cleaned.length >= 1) {
        formatted = `(${cleaned.substring(0, 2)}`;
      }
      if (cleaned.length >= 3) {
        formatted += `) ${cleaned.substring(2, 7)}`;
      }
      if (cleaned.length >= 8) {
        formatted += `-${cleaned.substring(7, 11)}`;
      }
      setFormData((prev) => ({
        ...prev,
        [id]: formatted,
      }));
    } else {
      setFormData((prev) => ({
        ...prev,
        [id]: value,
      }));
    }
  };

  const handleSelectChange = (field: "state" | "city", value: string) => {
    const updatedData = {
      ...formData,
      [field]: value,
    };
    if (field === "state") {
      updatedData.city = "";
    }
    setFormData(updatedData);
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();

    if (
      !formData.name ||
      !formData.email ||
      !formData.password ||
      !formData.phone ||
      !formData.state ||
      !formData.city
    ) {
      toast.error("Por favor, preencha todos os campos obrigatórios");
      return;
    }

    if (!privacyChecked || !privacyAccepted) {
      toast.error("É necessário aceitar a Política de Privacidade para se cadastrar.");
      return;
    }

    if (!passwordsMatch) {
      toast.error("As senhas não coincidem");
      return;
    }

    if (!isPasswordValid) {
      toast.error("A senha deve ter no mínimo 6 caracteres");
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: {
            name: formData.name,
            phone: formData.phone,
            state: formData.state,
            city: formData.city,
          },
          emailRedirectTo: getEmailRedirectUrl('/dashboard'),
        },
      });

      if (error) {
        toast.error(error.message);
        return;
      }

      if (data.user) {
        toast.success("Cadastro realizado com sucesso!");

        try {
          await supabase.functions.invoke("rd-station-integration", {
            body: {
              eventType: "user_registered",
              userData: {
                email: formData.email,
                name: formData.name,
                phone: formData.phone,
                city: formData.city,
                state: formData.state,
                tags: ["novo_usuario", "criador_conta"],
              },
            },
          });
        } catch (rdError) {
          console.error("Erro ao enviar para RD Station:", rdError);
        }

        if (couponCode && isValidCouponFormat) {
          try {
            await supabase.functions.invoke("redeem-coupon", {
              body: { couponCode, userId: data.user.id },
            });
            toast.success("Cupom resgatado com sucesso!");
          } catch (couponError) {
            console.error("Erro ao resgatar cupom:", couponError);
          }
        }

        // Redirect to Stripe to save credit card
        try {
          const { data: cardData, error: cardError } = await supabase.functions.invoke("setup-card", {
            body: { return_url: "/dashboard" },
          });

          if (!cardError && cardData?.url) {
            window.location.href = cardData.url;
            return;
          }
        } catch (cardErr) {
          console.error("Erro ao configurar cartão:", cardErr);
        }

        // Fallback: redirect to dashboard if card setup fails
        setWaitingForAuth(true);
      }
    } catch (err) {
      toast.error("Ocorreu um erro ao tentar se cadastrar.");
    } finally {
      setLoading(false);
    }
  };


  // Formulário de login
  const loginFormContent = (
    <form ref={loginFormRef} onSubmit={handleLogin} className="space-y-5">
      <div className="space-y-2">
        <div className="relative">
          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            id="login-email"
            type="email"
            placeholder={t.login.email}
            required
            value={loginEmail}
            onChange={(e) => setLoginEmail(e.target.value)}
            className="pl-10 h-11 text-sm"
          />
        </div>
      </div>

      <div className="space-y-2">
        <div className="relative">
          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            id="login-password"
            type={showPassword ? "text" : "password"}
            placeholder={t.login.password}
            required
            value={loginPassword}
            onChange={(e) => setLoginPassword(e.target.value)}
            className="pl-10 pr-10 h-11 text-sm"
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute top-1/2 -translate-y-1/2 right-0.5 h-9 w-9 text-muted-foreground hover:bg-accent/60"
            onClick={() => setShowPassword(!showPassword)}
          >
            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
          </Button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-0">
        <div className="flex items-center space-x-2">
          <Checkbox
            id="remember"
            checked={rememberMe}
            onCheckedChange={(checked) => setRememberMe(checked as boolean)}
          />
          <Label htmlFor="remember" className="text-sm text-muted-foreground cursor-pointer">
            {t.login.rememberMe}
          </Label>
        </div>
        <a
          href="/forgot-password"
          className="text-sm text-primary hover:text-primary/80 transition-colors"
        >
          {t.login.forgotPassword}
        </a>
      </div>

      <div className="pt-2">
        <Button
          type="submit"
          disabled={loading}
          className="w-full h-11 bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 text-primary-foreground font-semibold rounded-xl transition-all duration-300 hover:shadow-lg hover:shadow-primary/20 disabled:opacity-50 text-sm"
        >
          {loading ? (
            <div className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>{t.login.signingIn}</span>
            </div>
          ) : (
            t.login.signIn
          )}
        </Button>
      </div>

    </form>
  );

  // Formulário de registro
  const registerFormContent = (
    <form ref={registerFormRef} onSubmit={handleRegister} className="space-y-5">
      {/* Row 1: Nome + Email */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="relative">
          <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            id="name"
            placeholder="Nome Completo"
            required
            value={formData.name}
            onChange={handleInputChange}
            className="pl-10 h-11 text-sm"
          />
        </div>
        <div className="relative">
          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            id="email"
            type="email"
            placeholder="E-mail"
            required
            value={formData.email}
            onChange={handleInputChange}
            className="pl-10 h-11 text-sm"
          />
        </div>
      </div>

      {/* Row 2: Senha + Confirmar Senha */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="relative">
          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            id="password"
            type={showPassword ? "text" : "password"}
            placeholder="Senha"
            required
            minLength={6}
            value={formData.password}
            onChange={handleInputChange}
            className="pl-10 pr-10 h-11 text-sm"
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute right-0.5 top-1/2 -translate-y-1/2 h-8 w-8"
            onClick={() => setShowPassword(!showPassword)}
          >
            {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          </Button>
        </div>
        <div className="relative">
          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            id="confirmPassword"
            type={showPassword ? "text" : "password"}
            placeholder="Confirmar Senha"
            required
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="pl-10 h-11 text-sm"
          />
        </div>
      </div>

      {/* Validação de senha */}
      <div 
        className={`bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30 p-2.5 rounded-xl border border-green-200/50 dark:border-green-800/50 transition-all duration-300 ${
          formData.password ? 'opacity-100 max-h-20' : 'opacity-0 max-h-0 overflow-hidden p-0 border-0'
        }`}
        aria-hidden={!formData.password}
      >
        <div className="flex justify-between items-center gap-2">
          <div className="flex items-center gap-2 text-xs">
            <div className={`w-2.5 h-2.5 rounded-full flex items-center justify-center transition-all ${isPasswordValid ? "bg-green-500" : "bg-red-500"}`}>
              {isPasswordValid && <span className="text-white text-[8px]">✓</span>}
            </div>
            <span className={`font-medium transition-colors ${isPasswordValid ? "text-green-700 dark:text-green-300" : "text-red-700 dark:text-red-300"}`}>
              Mínimo 6 caracteres
            </span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <div className={`w-2.5 h-2.5 rounded-full flex items-center justify-center transition-all ${passwordsMatch ? "bg-green-500" : "bg-red-500"}`}>
              {passwordsMatch && <span className="text-white text-[8px]">✓</span>}
            </div>
            <span className={`font-medium transition-colors ${passwordsMatch ? "text-green-700 dark:text-green-300" : "text-red-700 dark:text-red-300"}`}>
              Senhas coincidem
            </span>
          </div>
        </div>
      </div>

      {/* Row 3: Telefone + Estado + Cidade */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="relative">
          <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            id="phone"
            placeholder="Telefone"
            required
            value={formData.phone}
            onChange={handleInputChange}
            className="pl-10 h-11 text-sm"
            maxLength={15}
          />
        </div>
        <div className="relative">
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <select
            value={formData.state}
            onChange={(e) => handleSelectChange("state", e.target.value)}
            disabled={loadingStates}
            className="w-full h-11 text-sm px-3 pr-10 rounded-md border border-input bg-background text-foreground appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            data-lpignore="true"
            data-1p-ignore="true"
            autoComplete="off"
          >
            <option value="" disabled>Estado</option>
            {states.map((state) => (
              <option key={state.id} value={state.sigla}>
                {state.nome}
              </option>
            ))}
          </select>
        </div>
        <div className="relative">
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <select
            value={formData.city}
            onChange={(e) => handleSelectChange("city", e.target.value)}
            disabled={loadingCities || !formData.state}
            className="w-full h-11 text-sm px-3 pr-10 rounded-md border border-input bg-background text-foreground appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            data-lpignore="true"
            data-1p-ignore="true"
            autoComplete="off"
          >
            <option value="" disabled>Cidade</option>
            {cities.map((city) => (
              <option key={city.id} value={city.nome}>
                {city.nome}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Row 4: Cupom */}
      <div className="relative">
        <Ticket className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          id="couponCode"
          placeholder="Cupom (opcional) — Ex: nome200 ou XX-YYYYYY-CC"
          value={couponCode}
          onChange={handleCouponInput}
          className="pl-10 h-11 text-sm font-mono tracking-wider"
          maxLength={30}
        />
      </div>

      {/* Privacy + Submit */}
      <div className="space-y-4 pt-1">
        <div className="flex items-start gap-2">
          <Checkbox
            id="privacy"
            checked={privacyChecked}
            onCheckedChange={() => {
              setPrivacyModalOpen(true);
            }}
            className="mt-1"
          />
          <Label 
            htmlFor="privacy" 
            className="text-xs text-muted-foreground select-none cursor-pointer leading-relaxed"
            onClick={(e) => {
              e.preventDefault();
              setPrivacyModalOpen(true);
            }}
          >
            Li e concordo com a{" "}
            <button
              type="button"
              className="underline text-primary hover:text-secondary transition-colors"
              onClick={(e) => {
                e.stopPropagation();
                setPrivacyModalOpen(true);
              }}
            >
              Política de Privacidade
            </button>
          </Label>
        </div>

        <Button
          type="submit"
          className="w-full h-11 bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 text-primary-foreground font-semibold rounded-xl transition-all duration-300 hover:shadow-lg hover:shadow-primary/20"
          disabled={
            loading ||
            !formData.name ||
            !formData.email ||
            !formData.password ||
            !confirmPassword ||
            !privacyChecked ||
            !privacyAccepted
          }
        >
          {loading ? <Loader2 className="animate-spin h-4 w-4" /> : "CRIAR CONTA"}
        </Button>
      </div>
    </form>
  );


  return (
    <>
      <div className="min-h-screen flex flex-col items-center relative overflow-y-auto py-8 px-4 sm:px-6"
        style={{
          background: 'linear-gradient(135deg, hsl(330 70% 92%) 0%, hsl(310 50% 93%) 20%, hsl(280 55% 94%) 40%, hsl(330 60% 95%) 60%, hsl(200 60% 93%) 80%, hsl(270 50% 92%) 100%)',
        }}
      >
        {/* Dark mode override */}
        <div className="absolute inset-0 bg-background dark:block hidden" />
        
        {/* Elementos decorativos — esferas vibrantes de marca */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {/* Rosa/Magenta — canto superior esquerdo */}
          <motion.div
            className="absolute -top-20 -left-20 w-[550px] h-[550px] rounded-full"
            style={{
              background: "radial-gradient(circle, hsl(var(--primary) / 0.25) 0%, hsl(var(--primary) / 0.08) 45%, transparent 70%)",
              filter: "blur(60px)",
            }}
            animate={{
              x: [0, 70, 0],
              y: [0, -40, 0],
              scale: [1, 1.12, 1],
            }}
            transition={{ duration: 22, repeat: Infinity, ease: "easeInOut" }}
          />

          {/* Violeta — centro-direita */}
          <motion.div
            className="absolute top-[30%] -right-20 w-[500px] h-[500px] rounded-full"
            style={{
              background: "radial-gradient(circle, hsl(var(--secondary) / 0.22) 0%, hsl(var(--secondary) / 0.06) 45%, transparent 70%)",
              filter: "blur(60px)",
            }}
            animate={{
              x: [0, -60, 0],
              y: [0, 50, 0],
              scale: [1, 1.1, 1],
            }}
            transition={{ duration: 26, repeat: Infinity, ease: "easeInOut" }}
          />

          {/* Cyan/Azul — canto inferior esquerdo */}
          <motion.div
            className="absolute -bottom-16 left-[10%] w-[450px] h-[450px] rounded-full"
            style={{
              background: "radial-gradient(circle, hsl(var(--accent) / 0.18) 0%, hsl(var(--accent) / 0.05) 45%, transparent 70%)",
              filter: "blur(60px)",
            }}
            animate={{
              x: [0, 50, -30, 0],
              y: [0, -40, 0],
              scale: [1, 1.08, 1],
            }}
            transition={{ duration: 28, repeat: Infinity, ease: "easeInOut", delay: 1.5 }}
          />

          {/* Rosa suave — canto inferior direito */}
          <motion.div
            className="absolute bottom-[5%] right-[5%] w-[350px] h-[350px] rounded-full"
            style={{
              background: "radial-gradient(circle, hsl(var(--primary) / 0.15) 0%, hsl(var(--primary) / 0.04) 50%, transparent 70%)",
              filter: "blur(70px)",
            }}
            animate={{
              x: [0, -30, 30, 0],
              y: [0, -20, 20, 0],
              scale: [1, 1.06, 0.94, 1],
            }}
            transition={{ duration: 24, repeat: Infinity, ease: "easeInOut", delay: 3 }}
          />

          {/* Logos decorativos */}
          <motion.img
            src={decorativeElement}
            alt=""
            className="absolute top-[8%] right-[6%] w-44 h-44 sm:w-60 sm:h-60 object-contain opacity-[0.09] dark:opacity-[0.04]"
            style={{ filter: "blur(4px)" }}
            animate={{
              y: [0, -25, 25, 0],
              rotate: [0, 10, -10, 0],
              scale: [1, 1.05, 0.95, 1],
            }}
            transition={{ duration: 24, repeat: Infinity, ease: "easeInOut" }}
          />

          <motion.img
            src={decorativeElement}
            alt=""
            className="absolute bottom-[8%] left-[5%] w-40 h-40 sm:w-52 sm:h-52 object-contain opacity-[0.09] dark:opacity-[0.04]"
            style={{ filter: "blur(4px)" }}
            animate={{
              x: [0, 22, -22, 0],
              y: [0, -28, 18, 0],
              rotate: [0, -12, 12, 0],
            }}
            transition={{ duration: 28, repeat: Infinity, ease: "easeInOut", delay: 2.5 }}
          />
        </div>

        {/* Botão de tema */}
        <Button
          variant="ghost"
          size="icon"
          className="absolute top-4 right-4 z-50 rounded-full bg-card/40 backdrop-blur-sm border-0 hover:bg-primary/10 hover:text-primary transition-colors"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
        >
          {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
        </Button>

        {/* Container centralizado */}
        <div className={`flex flex-col items-center justify-center gap-6 sm:gap-8 z-10 w-full flex-1 ${isLoginMode ? 'max-w-lg' : 'max-w-3xl'}`}>
          {/* Logo */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="flex-shrink-0"
          >
            <CreatorLogo />
          </motion.div>

          {/* Card de auth */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="w-full relative flex-shrink-0"
          >
            <div className="flex flex-col">
              {/* Tabs */}
              <div className="flex mb-5 sm:mb-6 flex-shrink-0 border-b border-border/30">
                <button
                  onClick={() => setIsLoginMode(true)}
                  className={`flex-1 pb-3 text-center font-semibold transition-all relative ${
                    isLoginMode ? "text-primary" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Login
                  {isLoginMode && (
                    <motion.div
                      layoutId="activeTab"
                      className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full"
                      transition={{
                        type: "spring",
                        stiffness: 500,
                        damping: 30,
                      }}
                    />
                  )}
                </button>
                <button
                  onClick={() => setIsLoginMode(false)}
                  className={`flex-1 pb-3 text-center font-semibold transition-all relative ${
                    !isLoginMode ? "text-primary" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Cadastro
                  {!isLoginMode && (
                    <motion.div
                      layoutId="activeTab"
                      className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full"
                      transition={{
                        type: "spring",
                        stiffness: 500,
                        damping: 30,
                      }}
                    />
                  )}
                </button>
              </div>

              {/* Título */}
              <div className="text-center mb-4 flex-shrink-0">
                <AnimatePresence mode="wait">
                  <motion.h2
                    key={isLoginMode ? "login-title" : "register-title"}
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    transition={{ duration: 0.2 }}
                    className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent mb-1.5"
                  >
                    {isLoginMode ? t.login.welcome : "Crie sua conta"}
                  </motion.h2>
                </AnimatePresence>
                <p className="text-sm text-muted-foreground">
                  {isLoginMode ? t.login.welcomeMessage : "Comece a criar conteúdo estratégico hoje"}
                </p>
              </div>

              {/* Formulário com scroll para cadastro */}
              <div className="flex-1 min-h-0">
                <AnimatePresence mode="wait" initial={false}>
                  <motion.div
                    key={isLoginMode ? "login" : "register"}
                    initial={{
                      opacity: 0,
                      y: 15,
                      filter: "blur(4px)",
                      scale: 0.96,
                    }}
                    animate={{
                      opacity: 1,
                      y: 0,
                      filter: "blur(0px)",
                      scale: 1,
                    }}
                    exit={{
                      opacity: 0,
                      y: -15,
                      filter: "blur(4px)",
                      scale: 0.96,
                      transition: { duration: 0.2, ease: [0.4, 0, 0.6, 1] },
                    }}
                    transition={{
                      duration: 0.4,
                      ease: [0.16, 1, 0.3, 1],
                      filter: { duration: 0.3 },
                    }}
                  >
                    {isLoginMode ? loginFormContent : registerFormContent}
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>
          </motion.div>

          {/* Links de Política de Privacidade e Contato */}
          <div className="flex items-center justify-center gap-3 text-xs text-muted-foreground mt-2">
            <a href="/privacy" className="hover:text-primary transition-colors underline underline-offset-2">
              Política de Privacidade
            </a>
            <span>•</span>
            <a href="/contact" className="hover:text-primary transition-colors underline underline-offset-2">
              Contato
            </a>
          </div>
        </div>
      </div>

      {/* Modal de Política de Privacidade */}
      <Dialog open={privacyModalOpen} onOpenChange={setPrivacyModalOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-2xl w-full max-h-[calc(100vh-2rem)] p-0 flex flex-col overflow-hidden">
          <DialogHeader className="flex-shrink-0 bg-background border-b p-4 sm:p-6 pb-3 sm:pb-4">
            <DialogTitle className="text-base sm:text-lg font-bold leading-tight pr-8 text-foreground">
              Política de Privacidade – Uso de Dados e IA
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto overflow-x-hidden px-4 py-3 sm:px-6 sm:py-4 scrollbar-thin scrollbar-thumb-primary/20 scrollbar-track-transparent relative">
            <div className="space-y-3 sm:space-y-4 text-sm text-muted-foreground pb-8">
              <p className="font-medium text-foreground text-sm leading-relaxed">
                👋 Olá! Antes de usar nossa plataforma, é importante que você saiba como cuidamos dos seus dados:
              </p>
              <ul className="list-disc pl-4 sm:pl-5 space-y-2.5 sm:space-y-3">
                <li className="leading-relaxed text-sm">
                  <span className="font-semibold text-foreground">O que coletamos:</span> informações de cadastro (nome,
                  e-mail, telefone), dados de navegação, histórico de uso e, quando necessário, informações de
                  pagamento.
                </li>
                <li className="leading-relaxed text-sm">
                  <span className="font-semibold text-foreground">Como usamos:</span> para oferecer e melhorar os
                  serviços, personalizar sua experiência, enviar novidades e cumprir obrigações legais.
                </li>
                <li className="leading-relaxed text-sm">
                  <span className="font-semibold text-foreground">Inteligência Artificial:</span> usamos IA para
                  recomendar conteúdos, apoiar no suporte e ajudar na criação de materiais. Mas sempre com transparência
                  e sem usar dados sensíveis sem sua permissão.
                </li>
                <li className="leading-relaxed text-sm">
                  <span className="font-semibold text-foreground">Compartilhamento:</span> nunca vendemos seus dados. Só
                  compartilhamos com parceiros essenciais para o funcionamento da plataforma ou quando a lei exigir.
                </li>
                <li className="leading-relaxed text-sm">
                  <span className="font-semibold text-foreground">Seus direitos:</span> você pode pedir acesso,
                  correção, exclusão ou portabilidade dos seus dados, além de cancelar comunicações de marketing a
                  qualquer momento.
                </li>
                <li className="leading-relaxed text-sm">
                  <span className="font-semibold text-foreground">Segurança:</span> seus dados ficam protegidos com
                  medidas avançadas de segurança e só são armazenados pelo tempo necessário.
                </li>
              </ul>
              <div className="pt-2 sm:pt-3">
                <p className="font-medium text-foreground text-sm leading-relaxed">
                  🤝 Ao aceitar, você concorda com esses termos e pode usar nossa plataforma com segurança e
                  tranquilidade.
                </p>
              </div>
            </div>

            <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-background via-background/80 to-transparent pointer-events-none" />
          </div>

          <DialogFooter className="flex-shrink-0 bg-background border-t shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] p-4 sm:p-6 pt-3 sm:pt-4">
            <div className="flex flex-col-reverse sm:flex-row gap-3 w-full">
              <Button
                variant="outline"
                onClick={() => {
                  setPrivacyModalOpen(false);
                  setPrivacyChecked(false);
                  setPrivacyAccepted(false);
                }}
                className="flex-1 h-12 text-sm font-medium"
              >
                Recusar
              </Button>
              <Button
                onClick={() => {
                  setPrivacyChecked(true);
                  setPrivacyAccepted(true);
                  setPrivacyModalOpen(false);
                }}
                className="flex-1 h-12 text-sm font-medium"
              >
                Aceitar
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <TeamSelectionDialog
        open={showTeamSelection}
        onClose={() => {
          setShowTeamSelection(false);
          setWaitingForAuth(true);
        }}
      />


      <ChangePasswordDialog
        isOpen={showChangePassword}
        onOpenChange={(open) => {
          setShowChangePassword(open);
          if (!open) {
            setWaitingForAuth(true);
          }
        }}
      />

      {/* OAuth team dialog */}
      <TeamSelectionDialog
        open={showOAuthTeamDialog}
        onClose={handleOAuthTeamDialogClose}
        context="login"
      />
    </>
  );
};

export default Auth;
