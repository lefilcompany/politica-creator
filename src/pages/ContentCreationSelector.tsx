import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Skeleton } from "@/components/ui/skeleton";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Loader2, Zap, ImageIcon, Video, HelpCircle, Megaphone, Activity } from "lucide-react";
import { CREDIT_COSTS } from "@/lib/creditCosts";
import { useAuth } from "@/hooks/useAuth";
import { OnboardingTour } from "@/components/onboarding/OnboardingTour";
import { contentCreationSelectorSteps } from "@/components/onboarding/tourSteps";
import { PageBreadcrumb } from "@/components/PageBreadcrumb";
import createBanner from "@/assets/create-banner.jpg";

type CreationType = "image" | "video" | "campaign" | "repercussion";

export default function ContentCreationSelector() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [creationType, setCreationType] = useState<CreationType | null>(null);

  useEffect(() => {
    if (user !== null && user !== undefined) {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    const locationState = location.state as { reset?: boolean } | null;
    if (locationState?.reset) {
      setCreationType(null);
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state]);

  useEffect(() => {
    if (creationType) {
      const routes: Record<CreationType, string> = {
        image: "/create/image",
        video: "/create/video",
        campaign: "/create/campaign",
        repercussion: "/repercussion",
      };
      navigate(routes[creationType]);
    }
  }, [creationType, navigate]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-accent" />
      </div>
    );
  }

  return (
    <div className="flex flex-col -m-4 sm:-m-6 lg:-m-8">
      <OnboardingTour tourType="create_content" steps={contentCreationSelectorSteps} />

      {/* Banner */}
      <div className="relative w-full h-56 md:h-64 lg:h-72 flex-shrink-0 overflow-hidden">
        <PageBreadcrumb items={[{ label: "Criar Conteúdo" }]} variant="overlay" />
        <img
          src={createBanner}
          alt=""
          className="w-full h-full object-cover object-[center_55%]"
          loading="lazy"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-background/20 to-transparent" />
      </div>

      {/* Header Card */}
      <div className="relative px-4 sm:px-6 lg:px-8 -mt-12 flex-shrink-0">
        <div
          id="content-creation-header"
          className="bg-card rounded-2xl shadow-lg p-4 lg:p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
        >
          <div className="flex items-center gap-4">
            <div className="bg-primary/10 border border-primary/20 shadow-sm rounded-2xl p-3 lg:p-4">
              <ImageIcon className="h-8 w-8 lg:h-10 lg:w-10 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl lg:text-3xl font-bold text-foreground flex items-center gap-2">
                Criar Conteúdo
                <Popover>
                  <PopoverTrigger asChild>
                    <button className="text-muted-foreground hover:text-foreground transition-colors">
                      <HelpCircle className="h-5 w-5" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-80 text-sm" side="bottom" align="start">
                    <div className="space-y-2">
                      <h4 className="font-semibold text-foreground">Criar Conteúdo</h4>
                      <p className="text-muted-foreground">
                        Escolha entre diferentes tipos de criação com IA para gerar imagens, vídeos
                        e conteúdos visuais para suas marcas.
                      </p>
                      <h4 className="font-semibold text-foreground mt-3">Opções disponíveis</h4>
                      <ul className="text-muted-foreground space-y-1 list-disc list-inside">
                        <li>Criação de Imagem — imagens profissionais com controle completo</li>
                        <li>Criação de Vídeo — vídeos com IA</li>
                      </ul>
                    </div>
                  </PopoverContent>
                </Popover>
              </h1>
              <p className="text-sm lg:text-base text-muted-foreground">
                Escolha o tipo de criação que deseja fazer
              </p>
            </div>
          </div>

          {isLoading ? (
            <Skeleton className="h-14 w-40 rounded-xl" />
          ) : (
            user && (
              <Card className="bg-gradient-to-br from-primary/10 to-secondary/10 border-primary/30 flex-shrink-0">
                <CardContent className="p-3">
                  <div className="flex items-center justify-center gap-4">
                    <div className="relative">
                      <div className="absolute inset-0 bg-gradient-to-r from-primary to-secondary rounded-full blur-sm opacity-40" />
                      <div className="relative bg-gradient-to-r from-primary to-secondary text-white rounded-full p-2">
                        <Zap className="h-4 w-4" />
                      </div>
                    </div>
                    <div className="text-left gap-4 flex justify-center items-center">
                      <span className="text-xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                        {user.credits || 0}
                      </span>
                      <p className="text-xs text-muted-foreground font-medium leading-tight">
                        Créditos
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          )}
        </div>
      </div>

      {/* Selection Cards */}
      <main id="creation-type-selection" className="px-4 sm:px-6 lg:px-8 pt-4 pb-4 sm:pb-6 lg:pb-8 flex-1">
        <RadioGroup
          value={creationType || ""}
          onValueChange={(value) => setCreationType(value as CreationType)}
          className="h-full"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 h-full max-w-6xl mx-auto">
            {/* Criação de Imagem */}
            <label htmlFor="image" className="cursor-pointer h-full" onClick={() => setCreationType("image")}>
              <Card className="border-0 shadow-lg hover:shadow-xl hover:bg-primary/10 hover:border-primary/30 transition-all duration-300 h-full active:scale-[0.98] touch-manipulation rounded-2xl">
                <CardContent className="p-6 flex flex-col items-center text-center gap-4 h-full justify-between">
                  <RadioGroupItem value="image" id="image" className="sr-only" />
                  <div className="flex flex-col items-center gap-4 flex-1 justify-center">
                    <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <ImageIcon className="h-8 w-8 text-primary" />
                    </div>
                    <div className="space-y-1.5">
                      <h3 className="font-semibold text-lg">Criação de Imagem</h3>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        Crie imagens profissionais com controle completo e editor de canvas
                      </p>
                    </div>
                  </div>
                  <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/15 border border-primary/30">
                    <ImageIcon className="h-4 w-4 text-primary" />
                    <span className="text-sm font-bold text-primary">
                      {CREDIT_COSTS.COMPLETE_IMAGE} créditos
                    </span>
                  </div>
                </CardContent>
              </Card>
            </label>

            {/* Criação de Vídeo */}
            <label htmlFor="video" className="cursor-pointer h-full" onClick={() => setCreationType("video")}>
              <Card className="border-0 shadow-lg hover:shadow-xl hover:bg-secondary/10 hover:border-secondary/30 transition-all duration-300 h-full active:scale-[0.98] touch-manipulation rounded-2xl">
                <CardContent className="p-6 flex flex-col items-center text-center gap-4 h-full justify-between">
                  <RadioGroupItem value="video" id="video" className="sr-only" />
                  <div className="flex flex-col items-center gap-4 flex-1 justify-center">
                    <div className="w-16 h-16 rounded-full bg-secondary/10 flex items-center justify-center flex-shrink-0">
                      <Video className="h-8 w-8 text-secondary" />
                    </div>
                    <div className="space-y-1.5">
                      <h3 className="font-semibold text-lg">Criação de Vídeo</h3>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        Gere vídeos impactantes com IA usando o modelo Veo
                      </p>
                    </div>
                  </div>
                  <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-secondary/15 border border-secondary/30">
                    <Video className="h-4 w-4 text-secondary" />
                    <span className="text-sm font-bold text-secondary">
                      {CREDIT_COSTS.VIDEO_GENERATION} créditos
                    </span>
                  </div>
                </CardContent>
              </Card>
            </label>

            {/* Pacote de Campanha */}
            <label htmlFor="campaign" className="cursor-pointer h-full" onClick={() => setCreationType("campaign")}>
              <Card className="border-0 shadow-lg hover:shadow-xl hover:bg-accent/10 hover:border-accent/30 transition-all duration-300 h-full active:scale-[0.98] touch-manipulation rounded-2xl">
                <CardContent className="p-6 flex flex-col items-center text-center gap-4 h-full justify-between">
                  <RadioGroupItem value="campaign" id="campaign" className="sr-only" />
                  <div className="flex flex-col items-center gap-4 flex-1 justify-center">
                    <div className="w-16 h-16 rounded-full bg-accent/10 flex items-center justify-center flex-shrink-0">
                      <Megaphone className="h-8 w-8 text-accent" />
                    </div>
                    <div className="space-y-1.5">
                      <h3 className="font-semibold text-lg">Pacote de Campanha</h3>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        10 narrativas, 2 propostas, 2 discursos e 3 anúncios
                      </p>
                    </div>
                  </div>
                  <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent/15 border border-accent/30">
                    <Megaphone className="h-4 w-4 text-accent" />
                    <span className="text-sm font-bold text-accent">
                      {CREDIT_COSTS.CAMPAIGN_PACKAGE} créditos
                    </span>
                  </div>
                </CardContent>
              </Card>
            </label>

            {/* Análise de Repercussão */}
            <label htmlFor="repercussion" className="cursor-pointer h-full" onClick={() => setCreationType("repercussion")}>
              <Card className="border-0 shadow-lg hover:shadow-xl hover:bg-orange-500/10 hover:border-orange-500/30 transition-all duration-300 h-full active:scale-[0.98] touch-manipulation rounded-2xl">
                <CardContent className="p-6 flex flex-col items-center text-center gap-4 h-full justify-between">
                  <RadioGroupItem value="repercussion" id="repercussion" className="sr-only" />
                  <div className="flex flex-col items-center gap-4 flex-1 justify-center">
                    <div className="w-16 h-16 rounded-full bg-orange-500/10 flex items-center justify-center flex-shrink-0">
                      <Activity className="h-8 w-8 text-orange-500" />
                    </div>
                    <div className="space-y-1.5">
                      <h3 className="font-semibold text-lg">Análise de Repercussão</h3>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        Avalie a probabilidade de repercussão com substância do seu conteúdo
                      </p>
                    </div>
                  </div>
                  <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-orange-500/15 border border-orange-500/30">
                    <Activity className="h-4 w-4 text-orange-500" />
                    <span className="text-sm font-bold text-orange-500">
                      {CREDIT_COSTS.ANALYZE_REPERCUSSION} créditos
                    </span>
                  </div>
                </CardContent>
              </Card>
            </label>
          </div>
        </RadioGroup>
      </main>
    </div>
  );
}
