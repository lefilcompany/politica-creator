import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, ChevronRight, ChevronLeft, Sparkles, Briefcase, Mic, ShieldAlert, FileText, UserCircle, Upload, X, File, Loader2 } from 'lucide-react';
import { Progress } from '@/components/ui/progress';

const MANDATE_STAGES = [
  { value: 'mandato', label: 'Período extraeleitoral', desc: 'Fora do período de campanha eleitoral' },
  { value: 'pre_campanha', label: 'Pré-campanha', desc: 'Fase de articulação e preparação' },
  { value: 'campanha', label: 'Campanha', desc: 'Em período de campanha eleitoral' },
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
  red_lines: string;
  evidence_history: string;
}

const FORM_STEPS = 4;

interface Props {
  open: boolean;
  onClose: () => void;
}

export function DashboardProfileModal({ open, onClose }: Props) {
  const { user, reloadUserData } = useAuth();
  const [step, setStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedDocs, setUploadedDocs] = useState<UploadedDoc[]>([]);
  const [data, setData] = useState<ProfileDetailData>({
    mandate_stage: '',
    biography: '',
    red_lines: '',
    evidence_history: '',
  });

  // Load existing profile data when modal opens
  useEffect(() => {
    if (!open || !user?.id) return;
    const load = async () => {
      const { data: profile } = await supabase
        .from('profiles')
        .select('mandate_stage, biography, tone_of_voice, red_lines, evidence_history, evidence_documents')
        .eq('id', user.id)
        .single();
      if (profile) {
        setData({
          mandate_stage: profile.mandate_stage || '',
          biography: profile.biography || '',
          red_lines: profile.red_lines || '',
          evidence_history: profile.evidence_history || '',
        });
        if (profile.evidence_documents && Array.isArray(profile.evidence_documents)) {
          setUploadedDocs(profile.evidence_documents as unknown as UploadedDoc[]);
        }
      }
    };
    load();
  }, [open, user?.id]);

  const totalSteps = FORM_STEPS;
  const progress = ((step + 1) / totalSteps) * 100;

  const canProceed = () => {
    switch (step) {
      case 0: return !!data.mandate_stage;
      case 1: return data.biography.trim().length > 10;
      case 2: return true;
      case 3: return true;
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


  const handleSubmit = async () => {
    if (!user?.id) return;
    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          mandate_stage: data.mandate_stage,
          biography: data.biography,
          red_lines: data.red_lines || null,
          evidence_history: data.evidence_history || null,
          evidence_documents: uploadedDocs.length > 0 ? JSON.parse(JSON.stringify(uploadedDocs)) : null,
          profile_detail_completed: true,
        })
        .eq('id', user.id);

      if (error) throw error;
      await reloadUserData();
      toast.success('Perfil detalhado salvo com sucesso!');
      onClose();
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

    // Step 2: Temas sensíveis
    <div key="s3" className="space-y-5">
      <div className="text-center space-y-1">
        <h3 className="text-lg font-bold text-foreground">Temas sensíveis</h3>
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

    // Step 3: Evidências + Upload
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

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleSkip(); }}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col overflow-hidden [&>div]:overflow-hidden [&>div]:flex [&>div]:flex-col [&>div]:flex-1 [&>div]:min-h-0">
        <DialogHeader className="shrink-0">
          <DialogTitle className="text-lg font-bold">Complete seu perfil político</DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">Informações adicionais para personalizar a IA</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col flex-1 min-h-0">
          <div className="flex-1 overflow-y-auto space-y-8 pr-1">
            {/* Fase */}
            {formSteps[0]}

            <div className="border-t border-border/30" />

            {/* Biografia */}
            {formSteps[1]}

            <div className="border-t border-border/30" />

            {/* Linhas vermelhas */}
            {formSteps[2]}

            <div className="border-t border-border/30" />

            {/* Evidências */}
            {formSteps[3]}
          </div>

          {/* Actions - fixed at bottom */}
          <div className="flex items-center justify-between pt-4 border-t border-border/50 shrink-0">
            <Button variant="ghost" onClick={handleSkip} disabled={isSubmitting} className="text-muted-foreground text-xs">
              Pular
            </Button>
            <Button onClick={handleSubmit} disabled={isSubmitting || isUploading || !data.mandate_stage || data.biography.trim().length <= 10} className="gap-2">
              <Sparkles className="w-4 h-4" />
              {isSubmitting ? 'Salvando...' : 'Concluir'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
