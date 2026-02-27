import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { PageBreadcrumb } from "@/components/PageBreadcrumb";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion";
import {
  FileText, Target, Megaphone, ImageIcon, Copy, Check,
  Sparkles, Loader2, ChevronLeft, Coins, ArrowRight,
  Download, Pencil, Undo2, Redo2,
} from "lucide-react";
import { Activity } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import createBanner from "@/assets/create-banner.jpg";

interface MicroNarrativa {
  titulo: string;
  texto: string;
  angulo: string;
  briefing_visual: string;
  hashtags: string[];
}

interface PropostaAcao {
  titulo: string;
  descricao: string;
  como_executar: string;
  custo_politico: string;
  dependencias: string;
  impacto_esperado: string;
}

interface Discurso {
  tipo_evento: string;
  titulo: string;
  texto_completo: string;
  notas_orador: string;
}

interface Anuncio {
  formato: string;
  titulo: string;
  roteiro: string;
  cta: string;
  briefing_visual: string;
}

interface CampaignPackage {
  micro_narrativas: MicroNarrativa[];
  propostas_acao: PropostaAcao[];
  discursos: Discurso[];
  anuncios: Anuncio[];
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <Button variant="ghost" size="sm" onClick={handleCopy} className="h-7 px-2 text-xs gap-1">
      {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
      {copied ? "Copiado" : "Copiar"}
    </Button>
  );
}

function GenerateImageButton({ briefing }: { briefing: string }) {
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [imageHistory, setImageHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [editPrompt, setEditPrompt] = useState("");
  const [editLoading, setEditLoading] = useState(false);

  const currentImageUrl = historyIndex >= 0 ? imageHistory[historyIndex] : null;

  const handleGenerate = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-image", {
        body: {
          description: briefing,
          contentType: "feed",
          platform: "instagram",
          vibeStyle: "professional",
          includeText: false,
          tones: ["institucional"],
        },
      });
      if (error) throw error;
      if (data?.imageUrl) {
        setImageHistory([data.imageUrl]);
        setHistoryIndex(0);
        toast.success("Imagem gerada!");
      } else if (data?.error) {
        toast.error(data.error);
      }
    } catch (err: any) {
      toast.error(err.message || "Erro ao gerar imagem");
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async () => {
    if (!currentImageUrl) return;
    try {
      const response = await fetch(currentImageUrl);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `imagem-campanha-${Date.now()}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success("Download iniciado!");
    } catch {
      toast.error("Erro ao baixar imagem");
    }
  };

  const handleEdit = async () => {
    if (!editPrompt.trim() || !currentImageUrl) return;
    setEditLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("edit-image", {
        body: {
          reviewPrompt: editPrompt,
          imageUrl: currentImageUrl,
        },
      });
      if (error) throw error;
      if (data?.editedImageUrl) {
        // Truncate forward history and add new version
        const newHistory = [...imageHistory.slice(0, historyIndex + 1), data.editedImageUrl];
        setImageHistory(newHistory);
        setHistoryIndex(newHistory.length - 1);
        setEditPrompt("");
        setEditing(false);
        toast.success("Imagem editada com sucesso!");
      } else if (data?.error) {
        toast.error(data.error);
      }
    } catch (err: any) {
      toast.error(err.message || "Erro ao editar imagem");
    } finally {
      setEditLoading(false);
    }
  };

  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < imageHistory.length - 1;

  const handleUndo = () => {
    if (canUndo) setHistoryIndex(historyIndex - 1);
  };

  const handleRedo = () => {
    if (canRedo) setHistoryIndex(historyIndex + 1);
  };

  if (currentImageUrl) {
    return (
      <div className="mt-3 space-y-3">
        <div className="rounded-xl overflow-hidden border relative">
          {editLoading && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/70 backdrop-blur-sm">
              <div className="flex flex-col items-center gap-2">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <span className="text-xs font-medium text-muted-foreground">Editando imagem...</span>
              </div>
            </div>
          )}
          <img src={currentImageUrl} alt="Imagem gerada" className="w-full h-auto" />
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={handleDownload} className="gap-1.5 text-xs">
            <Download className="h-3 w-3" /> Baixar
          </Button>
          <Button variant="outline" size="sm" onClick={() => setEditing(!editing)} className="gap-1.5 text-xs">
            <Pencil className="h-3 w-3" /> Editar
          </Button>
          {imageHistory.length > 1 && (
            <>
              <Button variant="outline" size="sm" onClick={handleUndo} disabled={!canUndo} className="gap-1.5 text-xs">
                <Undo2 className="h-3 w-3" /> Anterior
              </Button>
              <Button variant="outline" size="sm" onClick={handleRedo} disabled={!canRedo} className="gap-1.5 text-xs">
                <Redo2 className="h-3 w-3" /> Próxima
              </Button>
            </>
          )}
          {imageHistory.length > 1 && (
            <span className="text-[10px] text-muted-foreground self-center ml-auto">
              Versão {historyIndex + 1} de {imageHistory.length}
            </span>
          )}
        </div>
        {editing && (
          <div className="space-y-2 bg-muted/30 rounded-lg p-3">
            <Textarea
              placeholder="Descreva o que deseja alterar na imagem..."
              value={editPrompt}
              onChange={(e) => setEditPrompt(e.target.value)}
              className="text-xs min-h-[60px] resize-none"
            />
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={handleEdit}
                disabled={editLoading || !editPrompt.trim()}
                className="gap-1.5 text-xs"
              >
                {editLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                {editLoading ? "Editando..." : "Aplicar Edição"}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setEditing(false)} className="text-xs">
                Cancelar
              </Button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleGenerate}
      disabled={loading}
      className="mt-2 gap-2 text-xs"
    >
      {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <ImageIcon className="h-3 w-3" />}
      {loading ? "Gerando..." : "Gerar Imagem"}
    </Button>
  );
}

const formatoLabels: Record<string, string> = {
  video_curto: "Vídeo Curto (15-30s)",
  carrossel: "Carrossel (3-5 slides)",
  banner_cta: "Banner / CTA",
};

export default function CampaignResult() {
  const location = useLocation();
  const navigate = useNavigate();
  const state = location.state as {
    campaignPackage: CampaignPackage;
    creditsUsed: number;
    creditsRemaining: number;
  } | null;

  if (!state?.campaignPackage) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <p className="text-muted-foreground">Nenhum pacote encontrado.</p>
        <Button onClick={() => navigate("/create/campaign")} variant="outline">
          <ChevronLeft className="h-4 w-4 mr-2" /> Voltar
        </Button>
      </div>
    );
  }

  const pkg = state.campaignPackage;

  return (
    <div className="flex flex-col -m-4 sm:-m-6 lg:-m-8">
      {/* Banner */}
      <div className="relative w-full h-48 md:h-56 flex-shrink-0 overflow-hidden">
        <PageBreadcrumb items={[{ label: "Criar Conteúdo", href: "/create" }, { label: "Resultado da Campanha" }]} variant="overlay" />
        <img src={createBanner} alt="" className="w-full h-full object-cover" loading="lazy" />
        <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-background/20 to-transparent" />
      </div>

      {/* Header */}
      <div className="relative px-4 sm:px-6 lg:px-8 -mt-10 flex-shrink-0">
        <div className="bg-card rounded-2xl shadow-lg p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-primary/10 border border-primary/20 rounded-2xl p-3">
              <Megaphone className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-xl lg:text-2xl font-bold text-foreground">Pacote de Campanha</h1>
              <p className="text-xs text-muted-foreground">
                {pkg.micro_narrativas?.length || 0} narrativas • {pkg.propostas_acao?.length || 0} propostas • {pkg.discursos?.length || 0} discursos • {pkg.anuncios?.length || 0} anúncios
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Coins className="h-4 w-4" />
            <span>{state.creditsUsed} créditos usados</span>
          </div>
        </div>
      </div>

      {/* Content */}
      <main className="px-4 sm:px-6 lg:px-8 pt-4 pb-8 space-y-6 max-w-4xl mx-auto w-full">
        {/* 1. Micro-narrativas */}
        <section>
          <h2 className="text-lg font-bold text-foreground flex items-center gap-2 mb-3">
            <FileText className="h-5 w-5 text-primary" />
            Micro-Narrativas ({pkg.micro_narrativas?.length || 0})
          </h2>
          <Accordion type="multiple" className="space-y-2">
            {pkg.micro_narrativas?.map((n, i) => (
              <AccordionItem key={i} value={`narrativa-${i}`} className="border rounded-xl px-4">
                <AccordionTrigger className="hover:no-underline py-3">
                  <div className="flex items-center gap-3 text-left">
                    <Badge variant="secondary" className="text-[10px] shrink-0">{n.angulo}</Badge>
                    <span className="text-sm font-medium">{n.titulo}</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="space-y-3 pb-4">
                  <div className="flex justify-end">
                    <CopyButton text={`${n.titulo}\n\n${n.texto}\n\n${n.hashtags?.join(' ') || ''}`} />
                  </div>
                  <p className="text-sm text-foreground/90 leading-relaxed whitespace-pre-wrap">{n.texto}</p>
                  {n.hashtags?.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {n.hashtags.map((h, hi) => (
                        <Badge key={hi} variant="outline" className="text-[10px]">{h}</Badge>
                      ))}
                    </div>
                  )}
                  {n.briefing_visual && (
                    <div className="bg-muted/40 rounded-lg p-3 space-y-2">
                      <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
                        <ImageIcon className="h-3 w-3" /> Briefing Visual
                      </p>
                      <p className="text-xs text-muted-foreground">{n.briefing_visual}</p>
                      <GenerateImageButton briefing={n.briefing_visual} />
                    </div>
                  )}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </section>

        {/* 2. Propostas de Ação */}
        <section>
          <h2 className="text-lg font-bold text-foreground flex items-center gap-2 mb-3">
            <Target className="h-5 w-5 text-primary" />
            Propostas de Ação ({pkg.propostas_acao?.length || 0})
          </h2>
          <div className="space-y-4">
            {pkg.propostas_acao?.map((p, i) => (
              <Card key={i} className="rounded-xl">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">{p.titulo}</CardTitle>
                    <CopyButton text={`${p.titulo}\n\n${p.descricao}\n\nComo executar:\n${p.como_executar}\n\nCusto político: ${p.custo_politico}\n\nDependências: ${p.dependencias}\n\nImpacto esperado: ${p.impacto_esperado}`} />
                  </div>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <p className="text-foreground/90">{p.descricao}</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="bg-muted/30 rounded-lg p-3">
                      <p className="text-xs font-semibold text-muted-foreground mb-1">Como Executar</p>
                      <p className="text-xs">{p.como_executar}</p>
                    </div>
                    <div className="bg-muted/30 rounded-lg p-3">
                      <p className="text-xs font-semibold text-muted-foreground mb-1">Custo Político</p>
                      <p className="text-xs">{p.custo_politico}</p>
                    </div>
                    <div className="bg-muted/30 rounded-lg p-3">
                      <p className="text-xs font-semibold text-muted-foreground mb-1">Dependências</p>
                      <p className="text-xs">{p.dependencias}</p>
                    </div>
                    <div className="bg-muted/30 rounded-lg p-3">
                      <p className="text-xs font-semibold text-muted-foreground mb-1">Impacto Esperado</p>
                      <p className="text-xs">{p.impacto_esperado}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* 3. Discursos */}
        <section>
          <h2 className="text-lg font-bold text-foreground flex items-center gap-2 mb-3">
            <Megaphone className="h-5 w-5 text-primary" />
            Discursos para Eventos ({pkg.discursos?.length || 0})
          </h2>
          <Accordion type="multiple" className="space-y-2">
            {pkg.discursos?.map((d, i) => (
              <AccordionItem key={i} value={`discurso-${i}`} className="border rounded-xl px-4">
                <AccordionTrigger className="hover:no-underline py-3">
                  <div className="flex items-center gap-3 text-left">
                    <Badge variant="secondary" className="text-[10px] shrink-0">{d.tipo_evento}</Badge>
                    <span className="text-sm font-medium">{d.titulo}</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="space-y-3 pb-4">
                  <div className="flex justify-end">
                    <CopyButton text={`${d.titulo}\n\n${d.texto_completo}\n\nNotas: ${d.notas_orador}`} />
                  </div>
                  <p className="text-sm text-foreground/90 leading-relaxed whitespace-pre-wrap">{d.texto_completo}</p>
                  <div className="bg-muted/40 rounded-lg p-3">
                    <p className="text-xs font-semibold text-muted-foreground mb-1">Notas para o orador</p>
                    <p className="text-xs text-muted-foreground">{d.notas_orador}</p>
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </section>

        {/* 4. Anúncios */}
        <section>
          <h2 className="text-lg font-bold text-foreground flex items-center gap-2 mb-3">
            <Sparkles className="h-5 w-5 text-primary" />
            Anúncios ({pkg.anuncios?.length || 0})
          </h2>
          <div className="space-y-4">
            {pkg.anuncios?.map((a, i) => (
              <Card key={i} className="rounded-xl">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-[10px]">
                        {formatoLabels[a.formato] || a.formato}
                      </Badge>
                      <CardTitle className="text-base">{a.titulo}</CardTitle>
                    </div>
                    <CopyButton text={`${a.titulo}\n\nFormato: ${a.formato}\n\n${a.roteiro}\n\nCTA: ${a.cta}`} />
                  </div>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <p className="text-foreground/90 whitespace-pre-wrap">{a.roteiro}</p>
                  <div className="flex items-center gap-2 text-xs">
                    <ArrowRight className="h-3 w-3 text-primary" />
                    <span className="font-semibold text-primary">CTA:</span>
                    <span>{a.cta}</span>
                  </div>
                  {a.briefing_visual && (
                    <div className="bg-muted/40 rounded-lg p-3 space-y-2">
                      <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
                        <ImageIcon className="h-3 w-3" /> Briefing Visual
                      </p>
                      <p className="text-xs text-muted-foreground">{a.briefing_visual}</p>
                      <GenerateImageButton briefing={a.briefing_visual} />
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* Actions */}
        <div className="flex flex-wrap gap-3 pt-4">
          <Button variant="outline" onClick={() => navigate("/create/campaign")} className="gap-2">
            <ChevronLeft className="h-4 w-4" /> Nova Campanha
          </Button>
          <Button variant="outline" onClick={() => {
            const allTexts = pkg.micro_narrativas?.map((n: any) => `${n.titulo}\n${n.texto}`).join("\n\n") || "";
            navigate("/repercussion", { state: { content: allTexts.substring(0, 2000) } });
          }} className="gap-2">
            <Activity className="h-4 w-4" /> Analisar Repercussão
          </Button>
          <Button variant="outline" onClick={() => navigate("/history")} className="gap-2">
            Ver Histórico <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </main>
    </div>
  );
}
