import { useEffect, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Download, Copy, CheckCircle, Sparkles, Calendar, Loader2, Clock, User, Tag, Check, FileText, File, FileCode, LayoutGrid, List, ArrowLeft, Info, Image, Video, ClipboardList, FileOutput, Users, Globe, X, ZoomIn } from 'lucide-react';
import type { Action } from '@/types/action';
import { ACTION_TYPE_DISPLAY } from '@/types/action';
import ReactMarkdown from 'react-markdown';
import { Document, Packer, Paragraph, TextRun, AlignmentType } from 'docx';
import { saveAs } from 'file-saver';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PageBreadcrumb } from "@/components/PageBreadcrumb";
import { cn } from '@/lib/utils';

// ── SectionCard ──────────────────────────────────────────────
interface SectionCardProps {
  title: string;
  icon?: React.ReactNode;
  accentColor?: string;
  children: React.ReactNode;
  className?: string;
  headerRight?: React.ReactNode;
}

const SectionCard = ({ title, icon, accentColor, children, className = '', headerRight }: SectionCardProps) => (
  <div className={`bg-card/80 backdrop-blur-sm rounded-2xl border border-border/10 overflow-hidden shadow-sm hover:shadow-md transition-shadow duration-300 ${className}`}>
    <div
      className="px-5 py-3.5 border-b border-border/10 flex items-center gap-2.5"
      style={accentColor ? { background: `linear-gradient(135deg, ${accentColor}08, ${accentColor}03)` } : {}}
    >
      {icon && <span className="text-primary">{icon}</span>}
      <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">{title}</h3>
      {headerRight && <div className="ml-auto">{headerRight}</div>}
    </div>
    <div className="p-5">{children}</div>
  </div>
);

// ── DetailField ──────────────────────────────────────────────
const DetailField = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div>
    <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">{label}</p>
    <div className="mt-1.5">{children}</div>
  </div>
);

// ── PlatformIcon ─────────────────────────────────────────────
function PlatformIcon({ platform, className = "h-4 w-4" }: { platform: string; className?: string }) {
  switch (platform) {
    case 'Instagram':
      return (
        <svg viewBox="0 0 24 24" fill="currentColor" className={cn(className, "text-[#E4405F]")}>
          <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/>
        </svg>
      );
    case 'Facebook':
      return (
        <svg viewBox="0 0 24 24" fill="currentColor" className={cn(className, "text-[#1877F2]")}>
          <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
        </svg>
      );
    case 'LinkedIn':
      return (
        <svg viewBox="0 0 24 24" fill="currentColor" className={cn(className, "text-[#0A66C2]")}>
          <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
        </svg>
      );
    case 'TikTok':
      return (
        <svg viewBox="0 0 24 24" fill="currentColor" className={cn(className, "text-foreground")}>
          <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/>
        </svg>
      );
    case 'Twitter/X':
      return (
        <svg viewBox="0 0 24 24" fill="currentColor" className={cn(className, "text-foreground")}>
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
        </svg>
      );
    case 'Comunidades':
      return <Users className={cn(className, "text-secondary")} />;
    default:
      return <Globe className={cn(className, "text-muted-foreground")} />;
  }
}

// ── Helpers ──────────────────────────────────────────────────
const formatDate = (dateString: string) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

const getTypeIcon = (type: string) => {
  if (type.includes('CRIAR')) return Sparkles;
  if (type.includes('REVISAR')) return CheckCircle;
  if (type.includes('PLANEJAR')) return Calendar;
  if (type.includes('VIDEO')) return Video;
  return Sparkles;
};

const getAccentColor = (type: string) => {
  if (type.includes('REVISAR')) return 'hsl(var(--accent))';
  if (type.includes('PLANEJAR')) return 'hsl(var(--secondary))';
  return 'hsl(var(--primary))';
};

const getHeroGradientVar = (type: string) => {
  if (type.includes('REVISAR')) return '--accent';
  if (type.includes('PLANEJAR')) return '--secondary';
  return '--primary';
};

const getStatusColor = (status: string) => {
  if (status === 'Concluído' || status === 'Aprovado') return 'bg-green-500/10 text-green-600 border-green-500/20';
  if (status === 'Em revisão') return 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20';
  if (status === 'Rejeitado') return 'bg-red-500/10 text-red-600 border-red-500/20';
  return 'bg-muted text-muted-foreground border-border';
};

// ── Markdown components (reused) ─────────────────────────────
const markdownComponents = {
  h1: ({ children }: any) => <h1 className="text-2xl font-bold text-primary mb-4 pb-2 border-b border-primary/20">{children}</h1>,
  h2: ({ children }: any) => (
    <h2 className="text-xl font-semibold text-foreground mt-6 mb-3 flex items-center gap-2">
      <span className="w-1 h-6 bg-gradient-to-b from-primary to-secondary rounded-full flex-shrink-0" />
      {children}
    </h2>
  ),
  h3: ({ children }: any) => <h3 className="text-lg font-semibold text-foreground mt-5 mb-2">{children}</h3>,
  h4: ({ children }: any) => <h4 className="text-base font-semibold text-primary mt-3 mb-2">{children}</h4>,
  p: ({ children }: any) => <p className="text-sm text-muted-foreground leading-relaxed mb-3">{children}</p>,
  strong: ({ children }: any) => <strong className="font-semibold text-foreground">{children}</strong>,
  ul: ({ children }: any) => <ul className="list-disc list-inside space-y-1 mb-3 ml-4">{children}</ul>,
  ol: ({ children }: any) => <ol className="list-decimal list-inside space-y-1 mb-3 ml-4">{children}</ol>,
  li: ({ children }: any) => <li className="text-sm text-muted-foreground">{children}</li>,
  blockquote: ({ children }: any) => (
    <blockquote className="border-l-4 border-primary/30 pl-4 italic text-muted-foreground bg-primary/5 py-2 my-3 rounded-r">
      {children}
    </blockquote>
  ),
};

// ══════════════════════════════════════════════════════════════
export default function ActionView() {
  const { actionId } = useParams<{ actionId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const viewMode = (location.state as any)?.viewMode || 'grid';
  const [action, setAction] = useState<Action | null>(null);
  const [loading, setLoading] = useState(true);
  const [copying, setCopying] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);

  // ── Data fetching ────────────────────────────────────────
  useEffect(() => {
    if (!actionId) return;
    const fetchAction = async () => {
      try {
        const { data, error } = await supabase
          .from('actions')
          .select(`*, brand:brands(id, name), user:profiles!actions_user_id_fkey(id, name, email)`)
          .eq('id', actionId)
          .single();
        if (error) throw error;
        const transformedData: Action = {
          id: data.id,
          type: data.type as Action['type'],
          brandId: data.brand_id,
          teamId: data.team_id,
          userId: data.user_id,
          createdAt: data.created_at,
          updatedAt: data.updated_at,
          status: data.status,
          approved: data.approved,
          revisions: data.revisions,
          details: data.details as Action['details'],
          result: data.result as Action['result'],
          brand: data.brand as Action['brand'],
          user: data.user as Action['user'],
        };
        setAction(transformedData);
      } catch (error) {
        console.error('Erro ao carregar ação:', error);
        toast.error('Erro ao carregar detalhes da ação');
      } finally {
        setLoading(false);
      }
    };
    fetchAction();
  }, [actionId]);

  // ── Actions / handlers (unchanged logic) ─────────────────
  const handleCopyText = async (text: string) => {
    try {
      setCopying(true);
      await navigator.clipboard.writeText(text);
      setIsCopied(true);
      toast.success('Texto copiado!');
      setTimeout(() => setIsCopied(false), 2000);
    } catch (error) {
      toast.error('Erro ao copiar texto');
    } finally {
      setCopying(false);
    }
  };

  const handleDownloadTxt = (planContent: string) => {
    try {
      const blob = new Blob([planContent], { type: 'text/plain;charset=utf-8' });
      saveAs(blob, `planejamento-${new Date().toISOString().split('T')[0]}.txt`);
      toast.success('Download do TXT iniciado!');
    } catch (error) {
      console.error('Error generating TXT:', error);
      toast.error('Erro ao gerar TXT.');
    }
  };

  const handleDownloadMd = (planContent: string) => {
    try {
      const blob = new Blob([planContent], { type: 'text/markdown;charset=utf-8' });
      saveAs(blob, `planejamento-${new Date().toISOString().split('T')[0]}.md`);
      toast.success('Download do MD iniciado!');
    } catch (error) {
      console.error('Error generating MD:', error);
      toast.error('Erro ao gerar MD.');
    }
  };

  const processInlineMarkdown = (text: string): TextRun[] => {
    const runs: TextRun[] = [];
    const boldRegex = /\*\*(.*?)\*\*/g;
    let lastIndex = 0;
    let match;
    while ((match = boldRegex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        runs.push(new TextRun({ text: text.substring(lastIndex, match.index), font: 'Arial', color: '000000' }));
      }
      runs.push(new TextRun({ text: match[1], bold: true, font: 'Arial', color: '000000' }));
      lastIndex = match.index + match[0].length;
    }
    if (lastIndex < text.length) {
      runs.push(new TextRun({ text: text.substring(lastIndex), font: 'Arial', color: '000000' }));
    }
    return runs.length > 0 ? runs : [new TextRun({ text, font: 'Arial', color: '000000' })];
  };

  const handleDownloadDocx = async (planContent: string) => {
    try {
      const lines = planContent.split('\n');
      const paragraphs: Paragraph[] = [];
      lines.forEach((line) => {
        line = line.trim();
        if (!line) { paragraphs.push(new Paragraph({ text: '' })); return; }
        if (line.startsWith('# ') && !line.startsWith('## ')) {
          paragraphs.push(new Paragraph({ children: [new TextRun({ text: line.replace(/^#\s+/, ''), bold: true, size: 36, font: 'Arial', color: '000000' })], alignment: AlignmentType.LEFT, spacing: { before: 240, after: 120 } }));
        } else if (line.startsWith('## ')) {
          paragraphs.push(new Paragraph({ children: [new TextRun({ text: line.replace(/^##\s+/, ''), bold: true, size: 32, font: 'Arial', color: '000000' })], alignment: AlignmentType.LEFT, spacing: { before: 200, after: 100 } }));
        } else if (line.startsWith('### ')) {
          paragraphs.push(new Paragraph({ children: [new TextRun({ text: line.replace(/^###\s+/, ''), bold: true, size: 28, font: 'Arial', color: '000000' })], alignment: AlignmentType.LEFT, spacing: { before: 160, after: 80 } }));
        } else if (line.match(/^[\d]+\.\s/)) {
          paragraphs.push(new Paragraph({ children: processInlineMarkdown(line.replace(/^[\d]+\.\s/, '')), alignment: AlignmentType.LEFT, spacing: { before: 80, after: 80 }, numbering: { reference: 'numbered-list', level: 0 } }));
        } else if (line.startsWith('- ') || line.startsWith('* ')) {
          paragraphs.push(new Paragraph({ children: processInlineMarkdown(line.replace(/^[-*]\s/, '')), alignment: AlignmentType.LEFT, spacing: { before: 80, after: 80 }, bullet: { level: 0 } }));
        } else if (line.startsWith('#')) {
          paragraphs.push(new Paragraph({ children: [new TextRun({ text: line, size: 24, font: 'Arial', color: '0066CC' })], alignment: AlignmentType.LEFT, spacing: { before: 80, after: 80 } }));
        } else {
          paragraphs.push(new Paragraph({ children: processInlineMarkdown(line), alignment: AlignmentType.LEFT, spacing: { before: 80, after: 80 } }));
        }
      });
      const doc = new Document({
        numbering: { config: [{ reference: 'numbered-list', levels: [{ level: 0, format: 'decimal', text: '%1.', alignment: AlignmentType.LEFT }] }] },
        sections: [{ properties: {}, children: paragraphs }],
      });
      const blob = await Packer.toBlob(doc);
      saveAs(blob, `planejamento-${new Date().toISOString().split('T')[0]}.docx`);
      toast.success('Download do DOCX iniciado!');
    } catch (error) {
      console.error('Error generating DOCX:', error);
      toast.error('Erro ao gerar DOCX.');
    }
  };

  const handleDownloadImage = async (imageUrl: string, filename: string = 'imagem') => {
    try {
      toast.info('Preparando download em alta qualidade...');
      if (imageUrl.startsWith('data:image')) {
        const link = document.createElement('a');
        link.href = imageUrl;
        link.download = `${filename}-${new Date().toISOString().split('T')[0]}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast.success('Download concluído em qualidade máxima!');
      } else {
        try {
          const response = await fetch(imageUrl, { mode: 'cors' });
          const blob = await response.blob();
          const url = window.URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = `${filename}-${new Date().toISOString().split('T')[0]}.png`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          window.URL.revokeObjectURL(url);
          toast.success('Download concluído em qualidade máxima!');
        } catch (fetchError) {
          window.open(imageUrl, '_blank');
          toast.success('Imagem aberta em nova aba');
        }
      }
    } catch (error) {
      toast.error('Erro ao fazer download da imagem');
    }
  };

  const handleDownloadVideo = (videoUrl: string, filename: string = 'video') => {
    try {
      const link = document.createElement('a');
      link.href = videoUrl;
      link.download = `${filename}-${new Date().toISOString().split('T')[0]}.mp4`;
      link.target = '_blank';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success('Download do vídeo iniciado!');
    } catch (error) {
      console.error('Error downloading video:', error);
      toast.error('Erro ao fazer download do vídeo');
    }
  };

  // ── Loading / Not found ──────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="h-12 w-12 animate-spin mx-auto text-primary" />
          <p className="text-muted-foreground">Carregando detalhes da ação...</p>
        </div>
      </div>
    );
  }

  if (!action) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="p-8 text-center max-w-md">
          <h2 className="text-2xl font-semibold mb-2">Ação não encontrada</h2>
          <p className="text-muted-foreground mb-6">A ação que você está procurando não existe ou foi removida.</p>
          <Button onClick={() => navigate('/history')}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar ao Histórico
          </Button>
        </Card>
      </div>
    );
  }

  // ── Derived data ─────────────────────────────────────────
  const TypeIcon = getTypeIcon(action.type);
  const displayType = ACTION_TYPE_DISPLAY[action.type];
  const accentColor = getAccentColor(action.type);
  const heroVar = getHeroGradientVar(action.type);

  const hasMedia = !!(action.result?.imageUrl || action.result?.videoUrl || action.result?.originalImage);

  // Check if result has textual content to display
  const hasTextualResult = !!(
    action.result?.review ||
    action.result?.title ||
    action.result?.body ||
    (action.result?.hashtags && action.result.hashtags.length > 0) ||
    action.result?.feedback ||
    action.result?.plan
  );

  // ── Platform field renderer with icon ────────────────────
  const renderPlatformField = (platform: string) => (
    <DetailField label="Plataforma">
      <div className="flex items-center gap-2 mt-0.5">
        <PlatformIcon platform={platform} className="h-5 w-5" />
        <p className="text-sm font-medium text-foreground">{platform}</p>
      </div>
    </DetailField>
  );

  // ── Render ───────────────────────────────────────────────
  return (
    <div className="flex flex-col -m-4 sm:-m-6 lg:-m-8">
      {/* ═══ Hero Header ═══ */}
      <div
        className="relative overflow-hidden"
        style={{
          background: `linear-gradient(135deg, hsl(var(${heroVar}) / 0.09), hsl(var(${heroVar}) / 0.03), hsl(var(--background)))`,
        }}
      >
        <div className="absolute top-0 right-0 w-96 h-96 rounded-full opacity-[0.04] blur-3xl" style={{ background: `hsl(var(${heroVar}))` }} />
        <div className="absolute bottom-0 left-1/3 w-64 h-64 rounded-full opacity-[0.03] blur-3xl" style={{ background: `hsl(var(${heroVar}))` }} />

        <div className="relative px-4 sm:px-6 lg:px-8 py-6">
          <div className="mb-4">
            <PageBreadcrumb
              items={[
                {
                  label: 'Histórico',
                  href: '/history',
                  state: { viewMode },
                  icon: viewMode === 'list'
                    ? <List className="h-3.5 w-3.5" />
                    : <LayoutGrid className="h-3.5 w-3.5" />,
                },
                { label: displayType },
              ]}
            />
          </div>

          <div className="flex items-start gap-4">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg ring-4 ring-white/20"
              style={{ background: `hsl(var(${heroVar}) / 0.1)` }}
            >
              <TypeIcon className="h-7 w-7" style={{ color: `hsl(var(${heroVar}))` }} />
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl lg:text-3xl font-bold text-foreground">{displayType}</h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                {formatDate(action.createdAt)} · {action.brand?.name || 'Sem marca'}
              </p>
              {/* Status badges */}
              <div className="flex flex-wrap items-center gap-2 mt-3">
                <Badge className={getStatusColor(action.status)}>{action.status}</Badge>
                <Badge variant={action.approved ? 'default' : 'secondary'}>
                  {action.approved ? 'Aprovado' : 'Pendente'}
                </Badge>
                {(action.revisions ?? 0) > 0 && (
                  <Badge variant="outline">{action.revisions} {action.revisions === 1 ? 'revisão' : 'revisões'}</Badge>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ═══ Content ═══ */}
      <div className="px-4 sm:px-6 lg:px-8 py-6 max-w-6xl mx-auto w-full">
        <div className="flex flex-col gap-6">

          {/* ══ CRIAR_CONTEUDO ══ */}
          {action.type === 'CRIAR_CONTEUDO' && (
            <>
              {/* Row: Image + Details & Info side by side */}
              <div className="flex flex-col lg:flex-row gap-6">
                {/* Image */}
                {action.result?.imageUrl && (
                  <div className="lg:w-1/2">
                    <SectionCard title="Imagem Gerada" icon={<Image className="h-4 w-4" />} accentColor={accentColor}
                      headerRight={<Button variant="ghost" size="sm" onClick={() => handleDownloadImage(action.result!.imageUrl!, `imagem-${action.id}`)}><Download className="mr-2 h-4 w-4" />Baixar</Button>}
                    >
                      <div className="relative group rounded-xl overflow-hidden border border-border/10 shadow-sm cursor-pointer" onClick={() => setLightboxImage(action.result!.imageUrl!)}>
                        <img src={action.result.imageUrl} alt="Imagem gerada" className="w-full h-auto" />
                        <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 backdrop-blur-[2px]">
                          <ZoomIn className="text-white h-8 w-8" />
                        </div>
                      </div>
                    </SectionCard>
                  </div>
                )}
                {/* Details & Info */}
                <div className={action.result?.imageUrl ? 'lg:w-1/2' : 'w-full'}>
                  <SectionCard title="Detalhes e Informações" icon={<ClipboardList className="h-4 w-4" />} accentColor={accentColor}>
                    <div className="space-y-5">
                      {action.details?.objective && <DetailField label="Objetivo"><p className="text-sm font-medium text-foreground">{action.details.objective}</p></DetailField>}
                      {action.details?.platform && renderPlatformField(action.details.platform)}
                      {action.details?.description && <DetailField label="Prompt"><p className="text-sm text-foreground leading-relaxed">{action.details.description}</p></DetailField>}
                      {action.result?.body && (
                        <DetailField label="Legenda">
                          <p className="text-sm text-foreground leading-relaxed line-clamp-4 whitespace-pre-wrap">{action.result.body}</p>
                          {action.result.body.length > 200 && (
                            <button onClick={() => document.getElementById('legenda-section')?.scrollIntoView({ behavior: 'smooth' })} className="text-xs text-primary hover:underline mt-1">Ver completa ↓</button>
                          )}
                        </DetailField>
                      )}
                      {action.details?.tone && Array.isArray(action.details.tone) && action.details.tone.length > 0 && (
                        <DetailField label="Tom de Voz">
                          <div className="flex flex-wrap gap-2 mt-1">{action.details.tone.map((t: string, idx: number) => <Badge key={idx} variant="outline">{t}</Badge>)}</div>
                        </DetailField>
                      )}
                      {action.details?.additionalInfo && <DetailField label="Informações Adicionais"><p className="text-sm text-foreground leading-relaxed">{action.details.additionalInfo}</p></DetailField>}
                      <Separator className="bg-border/10" />
                      <div className="grid grid-cols-2 gap-4">
                        <DetailField label="Data de Criação"><p className="text-sm font-medium text-foreground">{formatDate(action.createdAt)}</p></DetailField>
                        <DetailField label="Marca"><p className="text-sm font-medium text-foreground">{action.brand?.name || 'Não especificada'}</p></DetailField>
                        <DetailField label="Criado por"><p className="text-sm font-medium text-foreground break-words">{action.user?.name || 'Não especificado'}</p></DetailField>
                        <DetailField label="Status"><Badge className={`mt-1 ${getStatusColor(action.status)}`}>{action.status}</Badge></DetailField>
                      </div>
                    </div>
                  </SectionCard>
                </div>
              </div>
              {/* Caption below */}
              {action.result && (action.result.title || action.result.body || (action.result.hashtags && action.result.hashtags.length > 0)) && (
                <SectionCard title="Legenda" icon={<FileOutput className="h-4 w-4" />} accentColor={accentColor}>
                  <div className="space-y-6">
                    {action.result.title && (
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Título</p>
                          <Button variant="ghost" size="sm" onClick={() => handleCopyText(action.result!.title!)} disabled={copying}>{copying ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Copy className="mr-2 h-4 w-4" />}Copiar</Button>
                        </div>
                        <div className="p-4 bg-muted/30 rounded-xl border border-border/10"><p className="font-medium text-foreground">{action.result.title}</p></div>
                      </div>
                    )}
                    {action.result.body && (
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Corpo da Legenda</p>
                          <Button variant="ghost" size="sm" onClick={() => handleCopyText(action.result!.body!)} disabled={copying}>{copying ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Copy className="mr-2 h-4 w-4" />}Copiar</Button>
                        </div>
                        <div className="p-4 bg-muted/30 rounded-xl border border-border/10"><p className="whitespace-pre-wrap text-foreground leading-relaxed text-sm">{action.result.body}</p></div>
                      </div>
                    )}
                    {action.result.hashtags && action.result.hashtags.length > 0 && (
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Hashtags</p>
                          <Button variant="ghost" size="sm" onClick={() => handleCopyText(action.result!.hashtags!.join(' '))} disabled={copying}>{copying ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Copy className="mr-2 h-4 w-4" />}Copiar</Button>
                        </div>
                        <div className="p-4 bg-muted/30 rounded-xl border border-border/10"><div className="flex flex-wrap gap-2">{action.result.hashtags.map((tag, idx) => <Badge key={idx} variant="secondary">{tag}</Badge>)}</div></div>
                      </div>
                    )}
                  </div>
                </SectionCard>
              )}
            </>
          )}

          {/* ══ CRIAR_CONTEUDO_RAPIDO ══ */}
          {action.type === 'CRIAR_CONTEUDO_RAPIDO' && (
            <div className="flex flex-col lg:flex-row gap-6">
              {/* Image */}
              {action.result?.imageUrl && (
                <div className="lg:w-1/2">
                  <SectionCard title="Imagem Gerada" icon={<Image className="h-4 w-4" />} accentColor={accentColor}
                    headerRight={<Button variant="ghost" size="sm" onClick={() => handleDownloadImage(action.result!.imageUrl!, `imagem-${action.id}`)}><Download className="mr-2 h-4 w-4" />Baixar</Button>}
                  >
                    <div className="relative group rounded-xl overflow-hidden border border-border/10 shadow-sm cursor-pointer" onClick={() => setLightboxImage(action.result!.imageUrl!)}>
                      <img src={action.result.imageUrl} alt="Imagem gerada" className="w-full h-auto" />
                      <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 backdrop-blur-[2px]">
                        <ZoomIn className="text-white h-8 w-8" />
                      </div>
                    </div>
                  </SectionCard>
                </div>
              )}
              {/* Details & Info */}
              <div className={action.result?.imageUrl ? 'lg:w-1/2' : 'w-full'}>
                <SectionCard title="Detalhes e Informações" icon={<ClipboardList className="h-4 w-4" />} accentColor={accentColor}>
                  <div className="space-y-5">
                    {action.details?.objective && <DetailField label="Objetivo"><p className="text-sm font-medium text-foreground">{action.details.objective}</p></DetailField>}
                    {action.details?.platform && renderPlatformField(action.details.platform)}
                    {action.details?.description && <DetailField label="Descrição"><p className="text-sm text-foreground leading-relaxed">{action.details.description}</p></DetailField>}
                    {action.details?.tone && Array.isArray(action.details.tone) && action.details.tone.length > 0 && (
                      <DetailField label="Tom de Voz">
                        <div className="flex flex-wrap gap-2 mt-1">{action.details.tone.map((t: string, idx: number) => <Badge key={idx} variant="outline">{t}</Badge>)}</div>
                      </DetailField>
                    )}
                    {action.details?.additionalInfo && <DetailField label="Informações Adicionais"><p className="text-sm text-foreground leading-relaxed">{action.details.additionalInfo}</p></DetailField>}
                    {action.details?.isVideoMode && (
                      <div className="grid grid-cols-2 gap-4">
                        <DetailField label="Modo de Geração"><Badge variant="secondary">Vídeo</Badge></DetailField>
                        {action.details.ratio && <DetailField label="Proporção"><p className="text-sm font-medium text-foreground">{action.details.ratio}</p></DetailField>}
                        {action.details.duration && <DetailField label="Duração"><p className="text-sm font-medium text-foreground">{action.details.duration}s</p></DetailField>}
                      </div>
                    )}
                    <Separator className="bg-border/10" />
                    <div className="grid grid-cols-2 gap-4">
                      <DetailField label="Data de Criação"><p className="text-sm font-medium text-foreground">{formatDate(action.createdAt)}</p></DetailField>
                      <DetailField label="Marca"><p className="text-sm font-medium text-foreground">{action.brand?.name || 'Não especificada'}</p></DetailField>
                      <DetailField label="Criado por"><p className="text-sm font-medium text-foreground break-words">{action.user?.name || 'Não especificado'}</p></DetailField>
                      <DetailField label="Status"><Badge className={`mt-1 ${getStatusColor(action.status)}`}>{action.status}</Badge></DetailField>
                    </div>
                  </div>
                </SectionCard>
              </div>
            </div>
          )}

          {/* ══ GERAR_VIDEO ══ */}
          {action.type === 'GERAR_VIDEO' && (
            <div className="flex flex-col lg:flex-row gap-6">
              {/* Video */}
              {action.result?.videoUrl && (
                <div className="lg:w-1/2">
                  <SectionCard title="Vídeo Gerado" icon={<Video className="h-4 w-4" />} accentColor={accentColor}
                    headerRight={<Button variant="ghost" size="sm" onClick={() => handleDownloadVideo(action.result!.videoUrl!, `video-${action.id}`)}><Download className="mr-2 h-4 w-4" />Baixar</Button>}
                  >
                    <div className="rounded-xl overflow-hidden border border-border/10 shadow-sm">
                      <video src={action.result.videoUrl} controls className="w-full h-auto" playsInline>Seu navegador não suporta a tag de vídeo.</video>
                    </div>
                  </SectionCard>
                </div>
              )}
              {/* Details & Info */}
              <div className={action.result?.videoUrl ? 'lg:w-1/2' : 'w-full'}>
                <SectionCard title="Detalhes e Informações" icon={<ClipboardList className="h-4 w-4" />} accentColor={accentColor}>
                  <div className="space-y-5">
                    {action.details?.prompt && (
                      <DetailField label="Prompt de Geração">
                        <div className="mt-1 p-3 bg-muted/30 rounded-lg"><p className="text-foreground whitespace-pre-wrap text-sm">{action.details.prompt}</p></div>
                      </DetailField>
                    )}
                    {action.details?.objective && <DetailField label="Objetivo"><p className="text-sm font-medium text-foreground">{action.details.objective}</p></DetailField>}
                    {action.details?.platform && renderPlatformField(action.details.platform)}
                    {action.details?.brand && <DetailField label="Marca"><p className="text-sm font-medium text-foreground">{action.details.brand}</p></DetailField>}
                    {action.details?.persona && <DetailField label="Persona"><p className="text-sm font-medium text-foreground">{action.details.persona}</p></DetailField>}
                    {action.details?.theme && <DetailField label="Tema Estratégico"><p className="text-sm font-medium text-foreground">{action.details.theme}</p></DetailField>}
                    {action.details?.tone && Array.isArray(action.details.tone) && action.details.tone.length > 0 && (
                      <DetailField label="Tom de Voz">
                        <div className="flex flex-wrap gap-2 mt-1">{action.details.tone.map((t: string, idx: number) => <Badge key={idx} variant="outline">{t}</Badge>)}</div>
                      </DetailField>
                    )}
                    {action.details?.aspectRatio && <DetailField label="Proporção"><p className="text-sm font-medium text-foreground">{action.details.aspectRatio}</p></DetailField>}
                    {action.details?.additionalInfo && <DetailField label="Informações Adicionais"><p className="text-sm text-foreground leading-relaxed">{action.details.additionalInfo}</p></DetailField>}
                    <Separator className="bg-border/10" />
                    <div className="grid grid-cols-2 gap-4">
                      <DetailField label="Data de Criação"><p className="text-sm font-medium text-foreground">{formatDate(action.createdAt)}</p></DetailField>
                      <DetailField label="Marca"><p className="text-sm font-medium text-foreground">{action.brand?.name || 'Não especificada'}</p></DetailField>
                      <DetailField label="Criado por"><p className="text-sm font-medium text-foreground break-words">{action.user?.name || 'Não especificado'}</p></DetailField>
                      <DetailField label="Status"><Badge className={`mt-1 ${getStatusColor(action.status)}`}>{action.status}</Badge></DetailField>
                    </div>
                  </div>
                </SectionCard>
              </div>
            </div>
          )}

          {/* ══ REVISAR_CONTEUDO ══ */}
          {action.type === 'REVISAR_CONTEUDO' && (
            <>
              {/* Row: Original image (if image review) + Details & Info */}
              <div className="flex flex-col lg:flex-row gap-6">
                {action.result?.originalImage && (
                  <div className="lg:w-1/2">
                    <SectionCard title="Imagem Original" icon={<Image className="h-4 w-4" />} accentColor={accentColor}>
                      <div className="relative group rounded-xl overflow-hidden border border-border/10 shadow-sm cursor-pointer" onClick={() => setLightboxImage(action.result!.originalImage!)}>
                        <img src={action.result.originalImage} alt="Imagem original" className="w-full h-auto" />
                        <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 backdrop-blur-[2px]">
                          <ZoomIn className="text-white h-8 w-8" />
                        </div>
                      </div>
                    </SectionCard>
                  </div>
                )}
                <div className={action.result?.originalImage ? 'lg:w-1/2' : 'w-full'}>
                  <SectionCard title="Detalhes e Informações" icon={<ClipboardList className="h-4 w-4" />} accentColor={accentColor}>
                    <div className="space-y-5">
                      {action.details?.reviewType && (
                        <DetailField label="Tipo de Revisão">
                          <Badge variant="secondary" className="mt-1">
                            {action.details.reviewType === 'image' ? 'Imagem' : action.details.reviewType === 'caption' ? 'Legenda' : action.details.reviewType === 'text-for-image' ? 'Texto para Imagem' : action.details.reviewType}
                          </Badge>
                        </DetailField>
                      )}
                      {action.details?.prompt && <DetailField label="Contexto/Ajustes Solicitados"><p className="text-sm text-foreground leading-relaxed">{action.details.prompt}</p></DetailField>}
                      {action.details?.brandName && <DetailField label="Marca"><p className="text-sm font-medium text-foreground">{action.details.brandName}</p></DetailField>}
                      {action.details?.themeName && <DetailField label="Tema Estratégico"><p className="text-sm font-medium text-foreground">{action.details.themeName}</p></DetailField>}
                      {action.details?.caption && (
                        <DetailField label="Legenda Enviada">
                          <div className="mt-1 p-3 bg-muted/30 rounded-lg"><p className="text-foreground whitespace-pre-wrap text-sm">{action.details.caption}</p></div>
                        </DetailField>
                      )}
                      {action.details?.text && (
                        <DetailField label="Texto Enviado">
                          <div className="mt-1 p-3 bg-muted/30 rounded-lg"><p className="text-foreground whitespace-pre-wrap text-sm">{action.details.text}</p></div>
                        </DetailField>
                      )}
                      <Separator className="bg-border/10" />
                      <div className="grid grid-cols-2 gap-4">
                        <DetailField label="Data de Criação"><p className="text-sm font-medium text-foreground">{formatDate(action.createdAt)}</p></DetailField>
                        <DetailField label="Marca"><p className="text-sm font-medium text-foreground">{action.brand?.name || 'Não especificada'}</p></DetailField>
                        <DetailField label="Criado por"><p className="text-sm font-medium text-foreground break-words">{action.user?.name || 'Não especificado'}</p></DetailField>
                        <DetailField label="Status"><Badge className={`mt-1 ${getStatusColor(action.status)}`}>{action.status}</Badge></DetailField>
                      </div>
                    </div>
                  </SectionCard>
                </div>
              </div>
              {/* Review result below */}
              {action.result?.review && (
                <SectionCard title="Análise e Revisão" icon={<FileOutput className="h-4 w-4" />} accentColor={accentColor}
                  headerRight={
                    <Button variant="ghost" size="sm" onClick={() => handleCopyText(action.result!.review!)} disabled={copying}>
                      {isCopied ? <><Check className="mr-2 h-4 w-4" />Copiado!</> : <><Copy className="mr-2 h-4 w-4" />Copiar</>}
                    </Button>
                  }
                >
                  <div className="p-5 bg-muted/30 rounded-xl border border-border/10">
                    <div className="prose prose-sm prose-slate dark:prose-invert max-w-none">
                      <ReactMarkdown components={markdownComponents}>{action.result.review}</ReactMarkdown>
                    </div>
                  </div>
                </SectionCard>
              )}
              {action.result?.feedback && (
                <SectionCard title="Feedback" icon={<FileOutput className="h-4 w-4" />} accentColor={accentColor}>
                  <div className="p-4 bg-muted/30 rounded-xl border border-border/10">
                    <p className="whitespace-pre-wrap text-sm text-foreground">{action.result.feedback}</p>
                  </div>
                </SectionCard>
              )}
            </>
          )}

          {/* ══ PLANEJAR_CONTEUDO ══ */}
          {action.type === 'PLANEJAR_CONTEUDO' && (
            <>
              {/* Details & Info (full width, no media) */}
              <SectionCard title="Detalhes e Informações" icon={<ClipboardList className="h-4 w-4" />} accentColor={accentColor}>
                <div className="space-y-5">
                  {action.details?.platform && renderPlatformField(action.details.platform)}
                  {action.details?.quantity && <DetailField label="Quantidade de Posts"><p className="text-sm font-medium text-foreground">{action.details.quantity}</p></DetailField>}
                  {action.details?.theme && Array.isArray(action.details.theme) && action.details.theme.length > 0 && (
                    <DetailField label="Temas Estratégicos">
                      <div className="flex flex-wrap gap-2 mt-1">{action.details.theme.map((t: string, idx: number) => <Badge key={idx} variant="secondary">{t}</Badge>)}</div>
                    </DetailField>
                  )}
                  {action.details?.objective && <DetailField label="Objetivo"><p className="text-sm font-medium text-foreground">{action.details.objective}</p></DetailField>}
                  {action.details?.additionalInfo && <DetailField label="Informações Adicionais"><p className="text-sm text-foreground leading-relaxed">{action.details.additionalInfo}</p></DetailField>}
                  <Separator className="bg-border/10" />
                  <div className="grid grid-cols-2 gap-4">
                    <DetailField label="Data de Criação"><p className="text-sm font-medium text-foreground">{formatDate(action.createdAt)}</p></DetailField>
                    <DetailField label="Marca"><p className="text-sm font-medium text-foreground">{action.brand?.name || 'Não especificada'}</p></DetailField>
                    <DetailField label="Criado por"><p className="text-sm font-medium text-foreground break-words">{action.user?.name || 'Não especificado'}</p></DetailField>
                    <DetailField label="Status"><Badge className={`mt-1 ${getStatusColor(action.status)}`}>{action.status}</Badge></DetailField>
                  </div>
                </div>
              </SectionCard>
              {/* Plan result below */}
              {action.result?.plan && (
                <SectionCard title="Plano de Conteúdo" icon={<FileOutput className="h-4 w-4" />} accentColor={accentColor}
                  headerRight={
                    <div className="flex gap-2">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" size="icon" className="h-8 w-8"><Download className="h-4 w-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="bg-card z-50">
                          <DropdownMenuItem onClick={() => handleDownloadDocx(action.result!.plan!)} className="cursor-pointer"><FileText className="mr-2 h-4 w-4" />Download DOCX</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleDownloadTxt(action.result!.plan!)} className="cursor-pointer"><File className="mr-2 h-4 w-4" />Download TXT</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleDownloadMd(action.result!.plan!)} className="cursor-pointer"><FileCode className="mr-2 h-4 w-4" />Download MD</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleCopyText(action.result!.plan!)} disabled={copying}>
                        {isCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                      </Button>
                    </div>
                  }
                >
                  <div className="p-5 bg-muted/30 rounded-xl border border-border/10">
                    <div className="prose prose-sm prose-slate dark:prose-invert max-w-none">
                      <ReactMarkdown components={markdownComponents}>{action.result.plan}</ReactMarkdown>
                    </div>
                  </div>
                </SectionCard>
              )}
            </>
          )}

        </div>
      </div>

      {/* ═══ Image Lightbox Dialog ═══ */}
      <Dialog open={!!lightboxImage} onOpenChange={() => setLightboxImage(null)}>
        <DialogContent className="max-w-[90vw] max-h-[90vh] p-2 bg-black/95 border-none">
          <div className="relative flex items-center justify-center w-full h-full">
            {lightboxImage && (
              <img
                src={lightboxImage}
                alt="Visualização ampliada"
                className="max-w-full max-h-[85vh] object-contain rounded-lg"
              />
            )}
            <div className="absolute bottom-4 right-4 flex gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => lightboxImage && handleDownloadImage(lightboxImage, `imagem-${action.id}`)}
              >
                <Download className="mr-2 h-4 w-4" />
                Baixar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
