import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, ChevronRight, ChevronLeft, Sparkles, Briefcase, Mic, ShieldAlert, FileText, UserCircle, Upload, X, File, BookOpen, Loader2 } from 'lucide-react';
import { Progress } from '@/components/ui/progress';

const MANDATE_STAGES = [
  { value: 'mandato', label: 'Mandato', desc: 'Atualmente exercendo mandato eletivo' },
  { value: 'pre_campanha', label: 'Pré-campanha', desc: 'Fase de articulação e preparação' },
  { value: 'campanha', label: 'Campanha', desc: 'Em período de campanha eleitoral' },
];

const TONE_OPTIONS = [
  'Didático', 'Combativo', 'Conciliador', 'Técnico',
  'Inspirador', 'Popular', 'Institucional', 'Empático',
];

const ACCEPTED_FILE_TYPES = '.pdf,.docx,.txt';
const MAX_FILE_SIZE_MB = 10;

interface UploadedDoc {
  name: string;
  path: string;
  size: number;
}

interface ProfileDetailData {
  mandate_stage: string;
  biography: string;
  tone_of_voice: string;
  red_lines: string;
  evidence_history: string;
}

interface RecommendedThesis {
  number: number;
  title: string;
  group: string;
  relevance: string;
}

const FORM_STEPS = 5;

interface Props {
  open: boolean;
  onClose: () => void;
}

const GROUP_LABELS: Record<string, string> = {
  A: 'Poder e Governança',
  B: 'Dinâmica Política',
  C: 'Narrativa e Autenticidade',
  D: 'Cidadania Expandida',
  E: 'Complexidade e Ética',
};

export function DashboardProfileModal({ open, onClose }: Props) {
  const { user, reloadUserData } = useAuth();
  const [step, setStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedDocs, setUploadedDocs] = useState<UploadedDoc[]>([]);
  const [showTheses, setShowTheses] = useState(false);
  const [isLoadingTheses, setIsLoadingTheses] = useState(false);
  const [recommendedTheses, setRecommendedTheses] = useState<RecommendedThesis[]>([]);
  const [data, setData] = useState<ProfileDetailData>({
    mandate_stage: '',
    biography: '',
    tone_of_voice: '',
    red_lines: '',
    evidence_history: '',
  });

  const totalSteps = showTheses ? FORM_STEPS + 1 : FORM_STEPS;
  const progress = ((step + 1) / totalSteps) * 100;

  const canProceed = () => {
    switch (step) {
      case 0: return !!data.mandate_stage;
      case 1: return data.biography.trim().length > 10;
      case 2: return !!data.tone_of_voice;
      case 3: return true;
      case 4: return true;
      default: return true;
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || !user?.id) return;

    setIsUploading(true);
    try {
      for (const file of Array.from(files)) {
        if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
          toast.error(`"${file.name}" excede ${MAX_FILE_SIZE_MB}MB`);
          continue;
        }

        const ext = file.name.split('.').pop()?.toLowerCase();
        if (!['pdf', 'docx', 'txt'].includes(ext || '')) {
          toast.error(`"${file.name}" não é um formato aceito`);
          continue;
        }

        const filePath = `${user.id}/${Date.now()}_${file.name}`;
        const { error } = await supabase.storage
          .from('profile-documents')
          .upload(filePath, file);

        if (error) {
          toast.error(`Erro ao enviar "${file.name}"`);
          console.error('Upload error:', error);
          continue;
        }

        setUploadedDocs(prev => [...prev, {
          name: file.name,
          path: filePath,
          size: file.size,
        }]);
      }
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
  };

  const handleRemoveDoc = async (doc: UploadedDoc) => {
    await supabase.storage.from('profile-documents').remove([doc.path]);
    setUploadedDocs(prev => prev.filter(d => d.path !== doc.path));
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  };

  const fetchRecommendedTheses = async () => {
    setIsLoadingTheses(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (!token) throw new Error('No session');

      const response = await supabase.functions.invoke('recommend-theses', {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.error) throw response.error;
      const result = response.data;
      if (result?.theses && Array.isArray(result.theses)) {
        const theses = result.theses.slice(0, 5);
        setRecommendedTheses(theses);
        
        // Persist theses to profile
        if (user?.id && theses.length > 0) {
          await supabase
            .from('profiles')
            .update({ recommended_theses: JSON.parse(JSON.stringify(theses)) } as any)
            .eq('id', user.id);
        }
      }
    } catch (error) {
      console.error('Error fetching theses:', error);
      toast.error('Não foi possível carregar as teses recomendadas');
    } finally {
      setIsLoadingTheses(false);
    }
  };

  const handleSubmit = async () => {
    if (!user?.id) return;
    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          mandate_stage: data.mandate_stage,
          biography: data.biography,
          tone_of_voice: data.tone_of_voice,
          red_lines: data.red_lines || null,
          evidence_history: data.evidence_history || null,
          evidence_documents: uploadedDocs.length > 0 ? JSON.parse(JSON.stringify(uploadedDocs)) : null,
          profile_detail_completed: true,
        })
        .eq('id', user.id);

      if (error) throw error;
      await reloadUserData();
      toast.success('Perfil detalhado salvo com sucesso!');
      
      // Move to theses step and start loading
      setShowTheses(true);
      setStep(FORM_STEPS);
      fetchRecommendedTheses();
    } catch (error) {
      console.error('Error saving profile details:', error);
      toast.error('Erro ao salvar. Tente novamente.');
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
        .update({ profile_detail_completed: true })
        .eq('id', user.id);
      await reloadUserData();
      onClose();
    } catch {
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFinish = () => {
    onClose();
  };

  const stepIcons = [Briefcase, UserCircle, Mic, ShieldAlert, FileText, ...(showTheses ? [BookOpen] : [])];

  const thesesStep = (
    <div key="s-theses" className="space-y-5">
      <div className="text-center space-y-1">
        <h3 className="text-lg font-bold text-foreground">Suas 5 Teses Fundamentais</h3>
        <p className="text-sm text-muted-foreground">
          Baseadas no seu perfil e no livro <em>"A Próxima Democracia"</em>
        </p>
      </div>

      {isLoadingTheses ? (
        <div className="flex flex-col items-center justify-center py-12 gap-3">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
          <p className="text-sm text-muted-foreground">Analisando seu perfil político...</p>
          <p className="text-xs text-muted-foreground">A IA está selecionando as teses mais relevantes para você</p>
        </div>
      ) : recommendedTheses.length > 0 ? (
        <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
          {recommendedTheses.map((thesis, i) => (
            <motion.div
              key={thesis.number}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.15 }}
              className="p-4 rounded-lg border border-border bg-muted/30 space-y-2"
            >
              <div className="flex items-start gap-2">
                <span className="shrink-0 w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">
                  {thesis.number}
                </span>
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-semibold text-foreground leading-tight">{thesis.title}</h4>
                  <Badge variant="outline" className="mt-1 text-xs">
                    Grupo {thesis.group} — {GROUP_LABELS[thesis.group] || thesis.group}
                  </Badge>
                </div>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed pl-9">{thesis.relevance}</p>
            </motion.div>
          ))}
        </div>
      ) : (
        <div className="text-center py-8">
          <p className="text-sm text-muted-foreground">Não foi possível carregar as recomendações.</p>
          <Button variant="outline" size="sm" className="mt-3" onClick={fetchRecommendedTheses}>
            Tentar novamente
          </Button>
        </div>
      )}
    </div>
  );

  const formSteps = [
    // Step 0: Fase
    <div key="s0" className="space-y-5">
      <div className="text-center space-y-1">
        <h3 className="text-lg font-bold text-foreground">Qual a sua fase atual?</h3>
        <p className="text-sm text-muted-foreground">Isso ajuda a IA a adaptar o tom e o conteúdo</p>
      </div>
      <div className="grid gap-3">
        {MANDATE_STAGES.map(s => (
          <button
            key={s.value}
            onClick={() => setData(prev => ({ ...prev, mandate_stage: s.value }))}
            className={`p-4 rounded-lg border text-left transition-all
              ${data.mandate_stage === s.value
                ? 'border-primary bg-primary/10 ring-1 ring-primary/30'
                : 'border-border hover:border-primary/40 hover:bg-muted/50'
              }`}
          >
            <span className="text-sm font-semibold text-foreground">{s.label}</span>
            <p className="text-xs text-muted-foreground mt-0.5">{s.desc}</p>
          </button>
        ))}
      </div>
    </div>,

    // Step 1: Biografia
    <div key="s1" className="space-y-5">
      <div className="text-center space-y-1">
        <h3 className="text-lg font-bold text-foreground">Biografia e trajetória</h3>
        <p className="text-sm text-muted-foreground">Conte sua história, prioridades (3-5) e trajetória política</p>
      </div>
      <Textarea
        placeholder="Ex: Vereador há 2 mandatos, focado em educação e saúde pública. Prioridades: 1) Creches em período integral, 2) UBS 24h nos bairros, 3) Transporte gratuito para estudantes..."
        value={data.biography}
        onChange={e => setData(prev => ({ ...prev, biography: e.target.value }))}
        rows={8}
        className="resize-none"
      />
      <p className="text-xs text-muted-foreground">Mínimo de 10 caracteres</p>
    </div>,

    // Step 2: Tom de voz
    <div key="s2" className="space-y-5">
      <div className="text-center space-y-1">
        <h3 className="text-lg font-bold text-foreground">Tom de voz</h3>
        <p className="text-sm text-muted-foreground">Como você quer que a IA se comunique por você?</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {TONE_OPTIONS.map(tone => (
          <button
            key={tone}
            onClick={() => setData(prev => ({ ...prev, tone_of_voice: tone }))}
            className={`px-4 py-2.5 rounded-full border text-sm font-medium transition-all
              ${data.tone_of_voice === tone
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border hover:border-primary/40 text-foreground hover:bg-muted/50'
              }`}
          >
            {data.tone_of_voice === tone && <Check className="inline-block w-3 h-3 mr-1" />}
            {tone}
          </button>
        ))}
      </div>
      {data.tone_of_voice && (
        <p className="text-sm text-muted-foreground text-center">
          Selecionado: <Badge variant="secondary">{data.tone_of_voice}</Badge>
        </p>
      )}
    </div>,

    // Step 3: Linhas vermelhas
    <div key="s3" className="space-y-5">
      <div className="text-center space-y-1">
        <h3 className="text-lg font-bold text-foreground">Linhas vermelhas</h3>
        <p className="text-sm text-muted-foreground">O que a IA <strong>nunca</strong> deve dizer, prometer ou abordar?</p>
      </div>
      <Textarea
        placeholder="Ex: Nunca prometer obra sem licitação. Evitar críticas diretas ao governador. Não mencionar partido X. Tema Y é sensível e requer aprovação prévia..."
        value={data.red_lines}
        onChange={e => setData(prev => ({ ...prev, red_lines: e.target.value }))}
        rows={6}
        className="resize-none"
      />
      <p className="text-xs text-muted-foreground">Opcional — mas altamente recomendado para segurança política</p>
    </div>,

    // Step 4: Evidências + Upload
    <div key="s4" className="space-y-5">
      <div className="text-center space-y-1">
        <h3 className="text-lg font-bold text-foreground">Evidências e histórico</h3>
        <p className="text-sm text-muted-foreground">Projetos, entregas, votações, indicadores e links para rastreabilidade</p>
      </div>
      <Textarea
        placeholder="Ex: PL 1234/2024 — Creches em período integral (aprovado). Entrega: 3 UBS inauguradas em 2024. Link: https://camara.gov.br/pl1234. Indicador: 95% de presença em plenário..."
        value={data.evidence_history}
        onChange={e => setData(prev => ({ ...prev, evidence_history: e.target.value }))}
        rows={5}
        className="resize-none"
      />

      {/* File upload area */}
      <div className="space-y-3">
        <p className="text-sm font-medium text-foreground">Anexar documentos</p>
        <label
          className={`flex flex-col items-center justify-center gap-2 p-4 border-2 border-dashed rounded-lg cursor-pointer transition-all
            ${isUploading
              ? 'border-primary/50 bg-primary/5'
              : 'border-border hover:border-primary/40 hover:bg-muted/30'
            }`}
        >
          <Upload className="w-5 h-5 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">
            {isUploading ? 'Enviando...' : 'Clique para enviar PDF, DOCX ou TXT'}
          </span>
          <span className="text-xs text-muted-foreground">Máximo {MAX_FILE_SIZE_MB}MB por arquivo</span>
          <input
            type="file"
            accept={ACCEPTED_FILE_TYPES}
            multiple
            onChange={handleFileUpload}
            disabled={isUploading}
            className="hidden"
          />
        </label>

        {/* Uploaded files list */}
        {uploadedDocs.length > 0 && (
          <div className="space-y-2">
            {uploadedDocs.map(doc => (
              <div
                key={doc.path}
                className="flex items-center gap-2 p-2.5 rounded-lg border border-border bg-muted/30"
              >
                <File className="w-4 h-4 text-primary shrink-0" />
                <span className="text-sm text-foreground truncate flex-1">{doc.name}</span>
                <span className="text-xs text-muted-foreground shrink-0">{formatFileSize(doc.size)}</span>
                <button
                  onClick={() => handleRemoveDoc(doc)}
                  className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors shrink-0"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <p className="text-xs text-muted-foreground">Opcional — esses dados dão mais credibilidade ao conteúdo gerado pela IA</p>
    </div>,
  ];

  const allSteps = showTheses ? [...formSteps, thesesStep] : formSteps;
  const displayedIcons = showTheses ? stepIcons : stepIcons.slice(0, FORM_STEPS);

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v && !showTheses) handleSkip(); else if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="sr-only">Complete seu perfil político</DialogTitle>
          <DialogDescription className="sr-only">Informações adicionais para personalizar a IA</DialogDescription>
        </DialogHeader>

        {/* Step indicators */}
        <div className="flex items-center justify-center gap-2 mb-1">
          {displayedIcons.map((Icon, i) => (
            <div
              key={i}
              className={`w-8 h-8 rounded-full flex items-center justify-center transition-all
                ${i === step
                  ? 'bg-primary text-primary-foreground scale-110'
                  : i < step
                    ? 'bg-primary/20 text-primary'
                    : 'bg-muted text-muted-foreground'
                }`}
            >
              {i < step ? <Check className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
            </div>
          ))}
        </div>
        <Progress value={progress} className="h-1.5" />
        <p className="text-xs text-muted-foreground text-center">
          Passo {step + 1} de {totalSteps}
        </p>

        {/* Content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
            className="min-h-[250px] py-2"
          >
            {allSteps[step]}
          </motion.div>
        </AnimatePresence>

        {/* Navigation */}
        <div className="flex items-center justify-between pt-3 border-t border-border/50">
          <div>
            {showTheses ? (
              <span />
            ) : step > 0 ? (
              <Button variant="ghost" onClick={() => setStep(s => s - 1)} className="text-muted-foreground">
                <ChevronLeft className="w-4 h-4 mr-1" /> Voltar
              </Button>
            ) : (
              <Button variant="ghost" onClick={handleSkip} disabled={isSubmitting} className="text-muted-foreground text-xs">
                Pular
              </Button>
            )}
          </div>

          {showTheses ? (
            <Button onClick={handleFinish} className="gap-2">
              <Sparkles className="w-4 h-4" />
              Começar a criar
            </Button>
          ) : step < FORM_STEPS - 1 ? (
            <Button onClick={() => setStep(s => s + 1)} disabled={!canProceed()}>
              Próximo <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          ) : (
            <Button onClick={handleSubmit} disabled={isSubmitting || isUploading} className="gap-2">
              <Sparkles className="w-4 h-4" />
              {isSubmitting ? 'Salvando...' : 'Concluir'}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
