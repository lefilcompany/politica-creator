import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { motion, AnimatePresence } from 'framer-motion';
import {
  User, Building2, MapPin, Target, Share2, Instagram,
  ChevronRight, ChevronLeft, Check, Sparkles, LocateFixed, Loader2
} from 'lucide-react';
import logoCreator from '@/assets/logoCreatorPreta.png';

const POLITICAL_ROLES = [
  'Deputado(a) Estadual', 'Deputado(a) Federal',
  'Senador(a)', 'Governador(a)', 'Presidente',
];

const POLITICAL_LEVELS = [
  { value: 'municipal', label: 'Municipal' },
  { value: 'estadual', label: 'Estadual' },
  { value: 'federal', label: 'Federal' },
];

const EXPERIENCE_OPTIONS = [
  { value: 'sem_mandato', label: 'Não tem mandato ainda', desc: 'Ainda não exerceu nenhum mandato' },
  { value: 'reeleicao', label: 'Reeleição', desc: 'Já exerceu mandato anteriormente' },
];

const FOCUS_AREAS = [
  'Saúde', 'Educação', 'Segurança Pública', 'Infraestrutura',
  'Meio Ambiente', 'Economia', 'Cultura', 'Esporte',
  'Assistência Social', 'Transporte', 'Habitação', 'Tecnologia',
  'Agricultura', 'Turismo', 'Direitos Humanos', 'Juventude',
];

const SOCIAL_NETWORKS = [
  { value: 'instagram', label: 'Instagram' },
  { value: 'facebook', label: 'Facebook' },
  { value: 'tiktok', label: 'TikTok' },
  { value: 'twitter', label: 'X (Twitter)' },
  { value: 'youtube', label: 'YouTube' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'telegram', label: 'Telegram' },
  { value: 'threads', label: 'Threads' },
];

const PARTIES = [
  'MDB', 'PT', 'PSDB', 'PP', 'PDT', 'PTB', 'PL', 'PSB',
  'REPUBLICANOS', 'UNIÃO', 'PSD', 'PSOL', 'PCdoB', 'CIDADANIA',
  'NOVO', 'AVANTE', 'SOLIDARIEDADE', 'PODE', 'REDE', 'PMB',
  'DC', 'AGIR', 'PSC', 'PRTB', 'PMN', 'UP', 'PCB', 'PCO', 'PSTU',
];

interface OnboardingData {
  political_role: string;
  political_party: string;
  political_level: string;
  political_experience: string;
  focus_areas: string[];
  main_social_networks: string[];
  target_audience_description: string;
  state: string;
  city: string;
}

const TOTAL_STEPS = 5;

export default function PoliticalOnboarding() {
  const { user, reloadUserData } = useAuth();
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [data, setData] = useState<OnboardingData>({
    political_role: '',
    political_party: '',
    political_level: '',
    political_experience: '',
    focus_areas: [],
    main_social_networks: [],
    target_audience_description: '',
    state: '',
    city: '',
  });

  const handleGetLocation = async () => {
    if (!navigator.geolocation) {
      toast.error('Seu navegador não suporta geolocalização');
      return;
    }
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const { latitude, longitude } = position.coords;
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json&accept-language=pt-BR`
          );
          const geo = await res.json();
          const state = geo?.address?.state || '';
          setData(prev => ({ ...prev, state }));
          if (state) toast.success(`Localização detectada: ${state}`);
          else toast.error('Não foi possível detectar o estado');
        } catch {
          toast.error('Erro ao detectar localização');
        } finally {
          setIsLocating(false);
        }
      },
      () => {
        toast.error('Permissão de localização negada');
        setIsLocating(false);
      },
      { timeout: 10000 }
    );
  };

  const progress = ((currentStep + 1) / TOTAL_STEPS) * 100;

  const toggleArrayItem = (field: 'focus_areas' | 'main_social_networks', value: string) => {
    setData(prev => ({
      ...prev,
      [field]: prev[field].includes(value)
        ? prev[field].filter(v => v !== value)
        : [...prev[field], value],
    }));
  };

  const canProceed = () => {
    switch (currentStep) {
      case 0: return data.political_role && data.political_level;
      case 1: return data.political_party && data.political_experience;
      case 2: return !!data.state;
      case 3: return data.focus_areas.length > 0;
      case 4: return data.main_social_networks.length > 0;
      default: return true;
    }
  };

  const handleSubmit = async () => {
    if (!user?.id) return;
    setIsSubmitting(true);

    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          political_role: data.political_role,
          political_party: data.political_party,
          political_level: data.political_level,
          political_experience: data.political_experience,
          focus_areas: data.focus_areas,
          main_social_networks: data.main_social_networks,
          target_audience_description: data.target_audience_description,
          state: data.state,
          city: data.city,
          tutorial_completed: true,
        })
        .eq('id', user.id);

      if (error) throw error;

      await reloadUserData();
      toast.success('Perfil político configurado com sucesso!');
      navigate('/dashboard', { replace: true });
    } catch (error) {
      console.error('Error saving political profile:', error);
      toast.error('Erro ao salvar perfil. Tente novamente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSkip = async () => {
    if (!user?.id) return;
    setIsSubmitting(true);
    try {
      await supabase
        .from('profiles')
        .update({ tutorial_completed: true })
        .eq('id', user.id);
      await reloadUserData();
      navigate('/dashboard', { replace: true });
    } catch {
      navigate('/dashboard', { replace: true });
    } finally {
      setIsSubmitting(false);
    }
  };

  const stepIcons = [User, Building2, MapPin, Target, Share2];

  const steps = [
    // Step 0: Cargo e Nível
    <div key="step0" className="space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-xl font-bold text-foreground">Qual o cargo pretendido?</h2>
        <p className="text-sm text-muted-foreground">Selecione o cargo que você exerce ou pretende exercer</p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {POLITICAL_ROLES.map(role => (
          <button
            key={role}
            onClick={() => setData(prev => ({ ...prev, political_role: role }))}
            className={`p-3 rounded-lg border text-sm font-medium transition-all text-left
              ${data.political_role === role
                ? 'border-primary bg-primary/10 text-primary ring-1 ring-primary/30'
                : 'border-border hover:border-primary/40 text-foreground hover:bg-muted/50'
              }`}
          >
            {role}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        <p className="text-sm font-medium text-foreground">Nível de atuação</p>
        <div className="flex gap-3">
          {POLITICAL_LEVELS.map(level => (
            <button
              key={level.value}
              onClick={() => setData(prev => ({ ...prev, political_level: level.value }))}
              className={`flex-1 p-3 rounded-lg border text-sm font-medium transition-all
                ${data.political_level === level.value
                  ? 'border-primary bg-primary/10 text-primary ring-1 ring-primary/30'
                  : 'border-border hover:border-primary/40 text-foreground hover:bg-muted/50'
                }`}
            >
              {level.label}
            </button>
          ))}
        </div>
      </div>
    </div>,

    // Step 1: Partido e Experiência
    <div key="step1" className="space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-xl font-bold text-foreground">Partido e experiência</h2>
        <p className="text-sm text-muted-foreground">Nos ajude a entender seu contexto político</p>
      </div>

      <div className="space-y-3">
        <p className="text-sm font-medium text-foreground">Partido</p>
        <div className="flex flex-wrap gap-2">
          {PARTIES.map(party => (
            <button
              key={party}
              onClick={() => setData(prev => ({ ...prev, political_party: party }))}
              className={`px-3 py-1.5 rounded-full border text-xs font-semibold transition-all
                ${data.political_party === party
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border hover:border-primary/40 text-foreground hover:bg-muted/50'
                }`}
            >
              {party}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <p className="text-sm font-medium text-foreground">Experiência política</p>
        <div className="grid gap-2">
          {EXPERIENCE_OPTIONS.map(exp => (
            <button
              key={exp.value}
              onClick={() => setData(prev => ({ ...prev, political_experience: exp.value }))}
              className={`p-3 rounded-lg border text-left transition-all
                ${data.political_experience === exp.value
                  ? 'border-primary bg-primary/10 ring-1 ring-primary/30'
                  : 'border-border hover:border-primary/40 hover:bg-muted/50'
                }`}
            >
              <span className="text-sm font-medium text-foreground">{exp.label}</span>
              <p className="text-xs text-muted-foreground mt-0.5">{exp.desc}</p>
            </button>
          ))}
        </div>
      </div>
    </div>,

    // Step 2: Localização
    <div key="step2" className="space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-xl font-bold text-foreground">Onde você atua?</h2>
        <p className="text-sm text-muted-foreground">Informe sua localização de atuação política</p>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">Estado</label>
          <Input
            placeholder="Ex: São Paulo"
            value={data.state}
            onChange={e => setData(prev => ({ ...prev, state: e.target.value }))}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleGetLocation}
            disabled={isLocating}
            className="w-full gap-2"
          >
            {isLocating ? <Loader2 className="h-4 w-4 animate-spin" /> : <LocateFixed className="h-4 w-4" />}
            {isLocating ? 'Detectando...' : 'Usar minha localização'}
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground">
          Descreva seu público-alvo <span className="text-muted-foreground font-normal">(opcional)</span>
        </label>
        <Textarea
          placeholder="Ex: Jovens de 18 a 35 anos, moradores da periferia, interessados em educação e tecnologia..."
          value={data.target_audience_description}
          onChange={e => setData(prev => ({ ...prev, target_audience_description: e.target.value }))}
          rows={4}
        />
      </div>
    </div>,

    // Step 3: Áreas de Foco
    <div key="step3" className="space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-xl font-bold text-foreground">Áreas de atuação</h2>
        <p className="text-sm text-muted-foreground">Selecione as áreas que são prioridade no seu mandato</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {FOCUS_AREAS.map(area => (
          <button
            key={area}
            onClick={() => toggleArrayItem('focus_areas', area)}
            className={`px-4 py-2 rounded-full border text-sm font-medium transition-all
              ${data.focus_areas.includes(area)
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border hover:border-primary/40 text-foreground hover:bg-muted/50'
              }`}
          >
            {data.focus_areas.includes(area) && <Check className="inline-block w-3 h-3 mr-1" />}
            {area}
          </button>
        ))}
      </div>

      {data.focus_areas.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          <span className="text-xs text-muted-foreground">Selecionadas:</span>
          {data.focus_areas.map(a => (
            <Badge key={a} variant="secondary" className="text-xs">{a}</Badge>
          ))}
        </div>
      )}
    </div>,

    // Step 4: Redes Sociais
    <div key="step4" className="space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-xl font-bold text-foreground">Redes sociais</h2>
        <p className="text-sm text-muted-foreground">Em quais plataformas você mais se comunica?</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {SOCIAL_NETWORKS.map(sn => (
          <button
            key={sn.value}
            onClick={() => toggleArrayItem('main_social_networks', sn.value)}
            className={`p-4 rounded-lg border text-sm font-medium transition-all flex items-center gap-3
              ${data.main_social_networks.includes(sn.value)
                ? 'border-primary bg-primary/10 text-primary ring-1 ring-primary/30'
                : 'border-border hover:border-primary/40 text-foreground hover:bg-muted/50'
              }`}
          >
            {data.main_social_networks.includes(sn.value) ? (
              <Check className="w-4 h-4 text-primary flex-shrink-0" />
            ) : (
              <Share2 className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            )}
            {sn.label}
          </button>
        ))}
      </div>
    </div>,
  ];

  return (
    <div className="min-h-screen bg-[var(--layout-bg)] flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl shadow-xl border-border/50">
        <CardContent className="p-6 sm:p-8 max-h-[90vh] overflow-y-auto">
          {/* Header */}
          <div className="text-center mb-6">
            <img src={logoCreator} alt="Creator" className="h-8 mx-auto mb-4" />
            <div className="flex items-center justify-center gap-2 mb-3">
              {stepIcons.map((Icon, i) => (
                <div
                  key={i}
                  className={`w-8 h-8 rounded-full flex items-center justify-center transition-all
                    ${i === currentStep
                      ? 'bg-primary text-primary-foreground scale-110'
                      : i < currentStep
                        ? 'bg-primary/20 text-primary'
                        : 'bg-muted text-muted-foreground'
                    }`}
                >
                  {i < currentStep ? <Check className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
                </div>
              ))}
            </div>
            <Progress value={progress} className="h-1.5" />
            <p className="text-xs text-muted-foreground mt-2">
              Passo {currentStep + 1} de {TOTAL_STEPS}
            </p>
          </div>

          {/* Step Content */}
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
              className="min-h-[350px]"
            >
              {steps[currentStep]}
            </motion.div>
          </AnimatePresence>

          {/* Navigation */}
          <div className="flex items-center justify-between mt-8 pt-4 border-t border-border/50">
            <div>
              {currentStep > 0 ? (
                <Button
                  variant="ghost"
                  onClick={() => setCurrentStep(prev => prev - 1)}
                  className="text-muted-foreground"
                >
                  <ChevronLeft className="w-4 h-4 mr-1" /> Voltar
                </Button>
              ) : (
                <Button
                  variant="ghost"
                  onClick={handleSkip}
                  disabled={isSubmitting}
                  className="text-muted-foreground text-xs"
                >
                  Pular
                </Button>
              )}
            </div>

            {currentStep < TOTAL_STEPS - 1 ? (
              <Button
                onClick={() => setCurrentStep(prev => prev + 1)}
                disabled={!canProceed()}
              >
                Próximo <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            ) : (
              <Button
                onClick={handleSubmit}
                disabled={!canProceed() || isSubmitting}
                className="gap-2"
              >
                <Sparkles className="w-4 h-4" />
                {isSubmitting ? 'Salvando...' : 'Concluir'}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
