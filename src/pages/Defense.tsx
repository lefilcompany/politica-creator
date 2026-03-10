import { useState } from "react";
import { Shield, MessageSquareReply, CheckCircle2, Copy, AlertTriangle, AlertCircle, Info, Loader2, ExternalLink, Newspaper, Siren, Radio } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { CREDIT_COSTS } from "@/lib/creditCosts";
import { CreditConfirmationDialog } from "@/components/CreditConfirmationDialog";
import { PageBreadcrumb } from "@/components/PageBreadcrumb";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import defenseBanner from "@/assets/defense-banner.jpg";

// Types
interface MonitorResult {
  title: string;
  summary: string;
  classification: "fake_news" | "ataque_infundado" | "critica_legitima" | "alerta";
  urgency: "alta" | "media" | "baixa";
  suggestedAction: string;
  source?: string;
  publishedAt?: string;
  url?: string;
}

interface RespondResult {
  officialNote: string;
  socialMediaResponse: string;
  keyArguments: string[];
  analysis: string;
}

interface FactCheckAlert {
  type: string;
  severity: "alta" | "media" | "baixa";
  text: string;
  explanation: string;
  suggestion: string;
  source?: string;
  sourceUrl?: string;
  sourceDate?: string;
}

interface FactCheckSource {
  name: string;
  url?: string;
  title: string;
  date?: string;
}

interface FactCheckResult {
  score: number;
  verdict: "excelente" | "bom" | "atencao" | "critico";
  alerts: FactCheckAlert[];
  overallSuggestion: string;
  sources?: FactCheckSource[];
  articlesFound?: number;
  verificationSummary?: string;
  searchQueries?: string[];
  auditApplied?: boolean;
  auditCorrections?: string | null;
}

interface CrisisResult {
  precedentes: {
    encontrados: boolean;
    resumo: string;
    casos: Array<{ titulo: string; data: string; desfecho: string; licao: string }>;
  };
  diagnostico: {
    gravidade: "critica" | "alta" | "media" | "baixa";
    velocidade_propagacao: "viral" | "rapida" | "moderada" | "lenta";
    tipo_confirmado: string;
    resumo_executivo: string;
    fatores_agravantes: string[];
    fatores_atenuantes: string[];
  };
  nota_oficial: {
    titulo: string;
    corpo: string;
    pontos_chave: string[];
  };
  plano_acao: {
    primeiras_2h: string[];
    primeiras_24h: string[];
    proxima_semana: string[];
  };
  riscos: Array<{ descricao: string; probabilidade: "alta" | "media" | "baixa"; mitigacao: string }>;
  o_que_nao_fazer: string[];
  articlesFound?: number;
  crisisType?: string;
  crisisLabel?: string;
}

const classificationLabels: Record<string, { label: string; color: string }> = {
  fake_news: { label: "Fake News", color: "bg-destructive text-destructive-foreground" },
  ataque_infundado: { label: "Ataque Infundado", color: "bg-orange-500 text-white" },
  critica_legitima: { label: "Crítica Legítima", color: "bg-blue-500 text-white" },
  alerta: { label: "Alerta", color: "bg-yellow-500 text-black" },
};

const urgencyColors: Record<string, string> = {
  alta: "border-l-destructive",
  media: "border-l-yellow-500",
  baixa: "border-l-muted-foreground",
};

const verdictConfig: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  excelente: { label: "Excelente", color: "text-green-600", icon: CheckCircle2 },
  bom: { label: "Bom", color: "text-blue-600", icon: Info },
  atencao: { label: "Atenção", color: "text-yellow-600", icon: AlertTriangle },
  critico: { label: "Crítico", color: "text-destructive", icon: AlertCircle },
};

const gravidadeConfig: Record<string, { label: string; color: string; bg: string }> = {
  critica: { label: "CRÍTICA", color: "text-red-700 dark:text-red-400", bg: "bg-red-100 dark:bg-red-900/30" },
  alta: { label: "ALTA", color: "text-orange-700 dark:text-orange-400", bg: "bg-orange-100 dark:bg-orange-900/30" },
  media: { label: "MÉDIA", color: "text-yellow-700 dark:text-yellow-400", bg: "bg-yellow-100 dark:bg-yellow-900/30" },
  baixa: { label: "BAIXA", color: "text-green-700 dark:text-green-400", bg: "bg-green-100 dark:bg-green-900/30" },
};

const crisisTypes = [
  { value: "corruption", label: "Denúncia de desvio / corrupção", icon: "🏛️" },
  { value: "fake_news", label: "Fake news / boato coordenado", icon: "📡" },
  { value: "out_of_context", label: "Vídeo ou áudio fora de contexto", icon: "🎥" },
  { value: "communication_error", label: "Erro real de comunicação (gafe)", icon: "🎤" },
  { value: "public_policy", label: "Crise de política pública (fato social grave)", icon: "⚠️" },
];

export default function Defense() {
  const { toast } = useToast();
  const { user } = useAuth();

  // Monitor state
  const [monitorKeywords, setMonitorKeywords] = useState("");
  const [monitorLoading, setMonitorLoading] = useState(false);
  const [monitorResults, setMonitorResults] = useState<{ results: MonitorResult[]; summary: string; articlesFound: number } | null>(null);
  const [showMonitorConfirm, setShowMonitorConfirm] = useState(false);


  // Respond state
  const [fakeNewsText, setFakeNewsText] = useState("");
  const [respondLoading, setRespondLoading] = useState(false);
  const [respondResult, setRespondResult] = useState<RespondResult | null>(null);
  const [showRespondConfirm, setShowRespondConfirm] = useState(false);

  // Fact-check state
  const [factCheckText, setFactCheckText] = useState("");
  const [factCheckLoading, setFactCheckLoading] = useState(false);
  const [factCheckResult, setFactCheckResult] = useState<FactCheckResult | null>(null);
  const [showFactCheckConfirm, setShowFactCheckConfirm] = useState(false);

  // Crisis state
  const [crisisSubject, setCrisisSubject] = useState("");
  const [crisisType, setCrisisType] = useState("");
  const [crisisContext, setCrisisContext] = useState("");
  const [crisisLoading, setCrisisLoading] = useState(false);
  const [crisisResult, setCrisisResult] = useState<CrisisResult | null>(null);
  const [showCrisisConfirm, setShowCrisisConfirm] = useState(false);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copiado!", description: "Texto copiado para a área de transferência" });
  };


  // Monitor handler
  const handleMonitor = async () => {
    setMonitorLoading(true);
    setMonitorResults(null);
    try {
      const { data, error } = await supabase.functions.invoke('fake-news-monitor', {
        body: { keywords: monitorKeywords }
      });
      if (error) throw error;
      if (data.error) throw new Error(data.error);
      setMonitorResults({ results: data.results || [], summary: data.summary || '', articlesFound: data.articlesFound || 0 });
    } catch (e: any) {
      toast({ title: "Erro", description: e.message || "Falha no monitoramento", variant: "destructive" });
    } finally {
      setMonitorLoading(false);
    }
  };


  // Respond handler
  const handleRespond = async () => {
    setRespondLoading(true);
    setRespondResult(null);
    try {
      const { data, error } = await supabase.functions.invoke('fake-news-respond', {
        body: { fakeNewsText }
      });
      if (error) throw error;
      if (data.error) throw new Error(data.error);
      setRespondResult(data);
    } catch (e: any) {
      toast({ title: "Erro", description: e.message || "Falha ao gerar resposta", variant: "destructive" });
    } finally {
      setRespondLoading(false);
    }
  };

  // Fact-check handler
  const handleFactCheck = async () => {
    setFactCheckLoading(true);
    setFactCheckResult(null);
    try {
      const { data, error } = await supabase.functions.invoke('fact-check-content', {
        body: { content: factCheckText }
      });
      if (error) throw error;
      if (data.error) throw new Error(data.error);
      setFactCheckResult(data);
    } catch (e: any) {
      toast({ title: "Erro", description: e.message || "Falha na verificação", variant: "destructive" });
    } finally {
      setFactCheckLoading(false);
    }
  };

  // Crisis handler
  const handleCrisis = async () => {
    setCrisisLoading(true);
    setCrisisResult(null);
    try {
      const { data, error } = await supabase.functions.invoke('analyze-crisis', {
        body: { subject: crisisSubject, crisisType, additionalContext: crisisContext }
      });
      if (error) throw error;
      if (data.error) throw new Error(data.error);
      setCrisisResult(data);
    } catch (e: any) {
      toast({ title: "Erro", description: e.message || "Falha na análise de crise", variant: "destructive" });
    } finally {
      setCrisisLoading(false);
    }
  };

  const scoreColor = (score: number) => {
    if (score >= 90) return "bg-green-500";
    if (score >= 70) return "bg-blue-500";
    if (score >= 50) return "bg-yellow-500";
    return "bg-destructive";
  };

  const currentCredits = user?.credits || 0;

  return (
    <div className="space-y-6">
      <PageBreadcrumb items={[{ label: "Radar de Imagem" }]} />

      {/* Banner */}
      <div className="relative rounded-2xl overflow-hidden h-40 md:h-52">
        <img src={defenseBanner} alt="Radar de Imagem" className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/70 to-black/30 flex items-center px-8">
          <div className="flex items-center gap-4">
            <Shield className="h-10 w-10 text-white" />
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-white">Radar de Imagem</h1>
              <p className="text-white/80 text-sm md:text-base">Monitore, responda, verifique e gerencie crises</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="respond" className="w-full">
        <TabsList className="grid w-full grid-cols-4 h-12 bg-muted/60 p-1.5 rounded-lg shadow-inner">
          <TabsTrigger value="monitor" className="flex items-center gap-2 text-xs sm:text-sm font-semibold data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md rounded-md transition-all duration-200">
            <Radio className="h-4 w-4" />
            <span className="hidden sm:inline">Monitorar</span>
          </TabsTrigger>
          <TabsTrigger value="respond" className="flex items-center gap-2 text-xs sm:text-sm font-semibold data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md rounded-md transition-all duration-200">
            <MessageSquareReply className="h-4 w-4" />
            <span className="hidden sm:inline">Responder</span>
          </TabsTrigger>
          <TabsTrigger value="verify" className="flex items-center gap-2 text-xs sm:text-sm font-semibold data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md rounded-md transition-all duration-200">
            <CheckCircle2 className="h-4 w-4" />
            <span className="hidden sm:inline">Verificar</span>
          </TabsTrigger>
          <TabsTrigger value="crisis" className="flex items-center gap-2 text-xs sm:text-sm font-semibold data-[state=active]:bg-destructive data-[state=active]:text-destructive-foreground data-[state=active]:shadow-md rounded-md transition-all duration-200">
            <Siren className="h-4 w-4" />
            <span className="hidden sm:inline">Sala de Crise</span>
          </TabsTrigger>
        </TabsList>




        {/* TAB: RESPOND */}
        <TabsContent value="respond" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <MessageSquareReply className="h-5 w-5 text-primary" />
                Gerador de Respostas
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Cole o texto ou descrição da fake news e receba respostas prontas. Custo: {CREDIT_COSTS.FAKE_NEWS_RESPOND} créditos.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                placeholder="Cole aqui o texto da fake news, notícia falsa ou ataque que deseja responder..."
                value={fakeNewsText}
                onChange={(e) => setFakeNewsText(e.target.value)}
                rows={5}
                maxLength={5000}
              />
              <Button
                onClick={() => setShowRespondConfirm(true)}
                disabled={respondLoading || fakeNewsText.trim().length < 10}
                className="w-full sm:w-auto"
              >
                {respondLoading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Gerando...</> : "Gerar Respostas"}
              </Button>
            </CardContent>
          </Card>

          {respondResult && (
            <div className="space-y-4">
              {respondResult.analysis && (
                <Card>
                  <CardHeader><CardTitle className="text-base">📊 Análise</CardTitle></CardHeader>
                  <CardContent><p className="text-sm">{respondResult.analysis}</p></CardContent>
                </Card>
              )}

              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="text-base">📋 Nota Oficial</CardTitle>
                  <Button variant="ghost" size="sm" onClick={() => copyToClipboard(respondResult.officialNote)}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </CardHeader>
                <CardContent>
                  <p className="text-sm whitespace-pre-wrap">{respondResult.officialNote}</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="text-base">📱 Resposta para Redes Sociais</CardTitle>
                  <Button variant="ghost" size="sm" onClick={() => copyToClipboard(respondResult.socialMediaResponse)}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </CardHeader>
                <CardContent>
                  <p className="text-sm whitespace-pre-wrap">{respondResult.socialMediaResponse}</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">🎯 Pontos-chave para Argumentação</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {respondResult.keyArguments.map((arg, i) => (
                      <li key={i} className="text-sm flex items-start gap-2">
                        <span className="text-primary font-bold">•</span>
                        {arg}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </div>
          )}

          <CreditConfirmationDialog
            isOpen={showRespondConfirm}
            onOpenChange={setShowRespondConfirm}
            cost={CREDIT_COSTS.FAKE_NEWS_RESPOND}
            currentBalance={currentCredits}
            resourceType="resposta"
            title="Gerar Respostas?"
            onConfirm={() => { setShowRespondConfirm(false); handleRespond(); }}
          />
        </TabsContent>

        {/* TAB: VERIFY */}
        <TabsContent value="verify" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-primary" />
                Verificador de Conteúdo
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Analise seu conteúdo antes de publicar e identifique imprecisões. Custo: {CREDIT_COSTS.FACT_CHECK} crédito.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                placeholder="Cole aqui o texto que deseja verificar antes de publicar..."
                value={factCheckText}
                onChange={(e) => setFactCheckText(e.target.value)}
                rows={6}
                maxLength={10000}
              />
              <Button
                onClick={() => setShowFactCheckConfirm(true)}
                disabled={factCheckLoading || factCheckText.trim().length < 20}
                className="w-full sm:w-auto"
              >
                {factCheckLoading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Verificando...</> : "Verificar Conteúdo"}
              </Button>
            </CardContent>
          </Card>

          {factCheckResult && (
            <div className="space-y-4">
              {/* Score card */}
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-6">
                    <div className="text-center">
                      <div className={`text-4xl font-bold ${verdictConfig[factCheckResult.verdict]?.color}`}>
                        {factCheckResult.score}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">de 100</div>
                    </div>
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2">
                        {(() => {
                          const V = verdictConfig[factCheckResult.verdict];
                          return V ? <><V.icon className={`h-5 w-5 ${V.color}`} /><span className={`font-semibold ${V.color}`}>{V.label}</span></> : null;
                        })()}
                      </div>
                      <Progress value={factCheckResult.score} className={`h-3 ${scoreColor(factCheckResult.score)}`} />
                      <p className="text-sm text-muted-foreground">{factCheckResult.overallSuggestion}</p>
                    </div>
                  </div>
                  {factCheckResult.verificationSummary && (
                    <div className="mt-4 p-3 bg-muted/50 rounded-lg border">
                      <p className="text-sm text-foreground"><strong>Resumo da verificação:</strong> {factCheckResult.verificationSummary}</p>
                      {factCheckResult.auditApplied && (
                        <div className="mt-2 flex items-center gap-2">
                          <Badge variant="outline" className="text-xs border-green-600 text-green-700 bg-green-50">
                            <CheckCircle2 className="h-3 w-3 mr-1" /> Auditoria aplicada
                          </Badge>
                          {factCheckResult.auditCorrections && (
                            <span className="text-xs text-muted-foreground">{factCheckResult.auditCorrections}</span>
                          )}
                        </div>
                      )}
                      {factCheckResult.articlesFound !== undefined && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {factCheckResult.articlesFound} notícias pesquisadas nos últimos 7 dias
                          {factCheckResult.searchQueries && factCheckResult.searchQueries.length > 0 && (
                            <> · Termos: {factCheckResult.searchQueries.join(', ')}</>
                          )}
                        </p>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Alerts */}
              {factCheckResult.alerts.length > 0 && (
                <div className="space-y-3">
                  <h3 className="font-semibold">Alertas ({factCheckResult.alerts.length})</h3>
                  {factCheckResult.alerts.map((alert, i) => (
                    <Card key={i} className={`border-l-4 ${alert.type === 'confirmado' ? 'border-l-green-500' : urgencyColors[alert.severity]}`}>
                      <CardContent className="pt-4 space-y-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant={alert.type === 'confirmado' ? 'default' : 'outline'} className={`text-xs ${alert.type === 'confirmado' ? 'bg-green-600' : ''}`}>
                            {alert.type === 'confirmado' ? '✓ Confirmado' : alert.type.replace('_', ' ')}
                          </Badge>
                          <Badge variant={alert.severity === "alta" ? "destructive" : "outline"} className="text-xs">
                            {alert.severity}
                          </Badge>
                        </div>
                        <p className="text-sm italic text-muted-foreground">"{alert.text}"</p>
                        <p className="text-sm">{alert.explanation}</p>
                        <p className="text-sm text-primary"><strong>Sugestão:</strong> {alert.suggestion}</p>
                        {alert.source && (
                          <div className="flex items-center gap-2 text-xs text-muted-foreground pt-1 border-t">
                            <Newspaper className="h-3 w-3" />
                            <span>Fonte: <strong>{alert.source}</strong></span>
                            {alert.sourceDate && <span>({alert.sourceDate})</span>}
                            {alert.sourceUrl && (
                              <a href={alert.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline inline-flex items-center gap-1">
                                Ver <ExternalLink className="h-3 w-3" />
                              </a>
                            )}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}

              {/* Sources */}
              {factCheckResult.sources && factCheckResult.sources.length > 0 && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Newspaper className="h-4 w-4 text-muted-foreground" />
                      Fontes Consultadas ({factCheckResult.sources.length})
                      {factCheckResult.articlesFound !== undefined && (
                        <span className="text-xs text-muted-foreground font-normal">
                          — {factCheckResult.articlesFound} notícias encontradas via NewsAPI
                        </span>
                      )}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="space-y-2">
                      {factCheckResult.sources.map((source, i) => (
                        <div key={i} className="flex items-start gap-2 text-sm">
                          <span className="text-muted-foreground font-mono text-xs mt-0.5">[{i + 1}]</span>
                          <div className="flex-1 min-w-0">
                            <span className="font-medium">{source.name}</span>
                            {source.date && <span className="text-muted-foreground text-xs ml-1">({source.date})</span>}
                            <p className="text-muted-foreground text-xs truncate">{source.title}</p>
                          </div>
                          {source.url && (
                            <a href={source.url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline flex-shrink-0">
                              <ExternalLink className="h-3.5 w-3.5" />
                            </a>
                          )}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          <CreditConfirmationDialog
            isOpen={showFactCheckConfirm}
            onOpenChange={setShowFactCheckConfirm}
            cost={CREDIT_COSTS.FACT_CHECK}
            currentBalance={currentCredits}
            resourceType="verificação"
            title="Verificar Conteúdo?"
            onConfirm={() => { setShowFactCheckConfirm(false); handleFactCheck(); }}
          />
        </TabsContent>

        {/* TAB: CRISIS - SALA DE CRISE */}
        <TabsContent value="crisis" className="space-y-4 mt-4">
          <Card className="border-destructive/30">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Siren className="h-5 w-5 text-destructive" />
                Sala de Crise
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Analise crises em tempo real: busque precedentes, classifique o tipo e receba uma nota oficial pronta. Custo: {CREDIT_COSTS.CRISIS_ANALYSIS} créditos.
              </p>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Step 1: Subject */}
              <div className="space-y-2">
                <Label className="text-sm font-semibold flex items-center gap-2">
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-destructive/10 text-destructive text-xs font-bold">1</span>
                  Esse assunto já aconteceu antes?
                </Label>
                <Textarea
                  placeholder="Descreva o assunto da crise. Ex: 'Vídeo circulando nas redes mostrando suposta ligação com empresa investigada...'"
                  value={crisisSubject}
                  onChange={(e) => setCrisisSubject(e.target.value)}
                  rows={3}
                  maxLength={2000}
                />
                <p className="text-xs text-muted-foreground">
                  A IA buscará precedentes em notícias recentes e no histórico político
                </p>
              </div>

              {/* Step 2: Classification */}
              <div className="space-y-3">
                <Label className="text-sm font-semibold flex items-center gap-2">
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-destructive/10 text-destructive text-xs font-bold">2</span>
                  Entrou em colapso? Classifique o tipo:
                </Label>
                <RadioGroup value={crisisType} onValueChange={setCrisisType} className="space-y-2">
                  {crisisTypes.map((type) => (
                    <div key={type.value} className="flex items-center space-x-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors cursor-pointer">
                      <RadioGroupItem value={type.value} id={type.value} />
                      <Label htmlFor={type.value} className="flex items-center gap-2 cursor-pointer flex-1">
                        <span className="text-lg">{type.icon}</span>
                        <span className="text-sm">{type.label}</span>
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
              </div>

              {/* Step 3: Additional context */}
              <div className="space-y-2">
                <Label className="text-sm font-semibold flex items-center gap-2">
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-destructive/10 text-destructive text-xs font-bold">3</span>
                  Contexto adicional (opcional)
                </Label>
                <Textarea
                  placeholder="Informações extras: quem publicou, onde circulou, se já houve pronunciamento anterior..."
                  value={crisisContext}
                  onChange={(e) => setCrisisContext(e.target.value)}
                  rows={2}
                  maxLength={1000}
                />
              </div>

              <Button
                onClick={() => setShowCrisisConfirm(true)}
                disabled={crisisLoading || crisisSubject.trim().length < 5 || !crisisType}
                className="w-full bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                size="lg"
              >
                {crisisLoading ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Analisando crise...</>
                ) : (
                  <><Siren className="h-4 w-4 mr-2" />Ativar Sala de Crise</>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Crisis Results */}
          {crisisResult && (
            <div className="space-y-4">
              {/* Diagnosis */}
              {crisisResult.diagnostico && (
                <Card className="border-l-4 border-l-destructive">
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Radio className="h-5 w-5 text-destructive" />
                      Diagnóstico da Crise
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex flex-wrap gap-3">
                      <div className={`px-3 py-1.5 rounded-lg ${gravidadeConfig[crisisResult.diagnostico.gravidade]?.bg}`}>
                        <span className="text-xs font-medium text-muted-foreground">Gravidade</span>
                        <p className={`font-bold text-sm ${gravidadeConfig[crisisResult.diagnostico.gravidade]?.color}`}>
                          {gravidadeConfig[crisisResult.diagnostico.gravidade]?.label}
                        </p>
                      </div>
                      <div className="px-3 py-1.5 rounded-lg bg-muted">
                        <span className="text-xs font-medium text-muted-foreground">Propagação</span>
                        <p className="font-bold text-sm">{crisisResult.diagnostico.velocidade_propagacao}</p>
                      </div>
                      <div className="px-3 py-1.5 rounded-lg bg-muted">
                        <span className="text-xs font-medium text-muted-foreground">Tipo</span>
                        <p className="font-bold text-sm">{crisisResult.crisisLabel}</p>
                      </div>
                    </div>

                    <p className="text-sm">{crisisResult.diagnostico.resumo_executivo}</p>

                    <div className="grid sm:grid-cols-2 gap-3">
                      <div className="p-3 rounded-lg bg-destructive/5 border border-destructive/20">
                        <p className="text-xs font-semibold text-destructive mb-2">⚠️ Fatores Agravantes</p>
                        <ul className="space-y-1">
                          {crisisResult.diagnostico.fatores_agravantes?.map((f, i) => (
                            <li key={i} className="text-xs text-muted-foreground">• {f}</li>
                          ))}
                        </ul>
                      </div>
                      <div className="p-3 rounded-lg bg-green-500/5 border border-green-500/20">
                        <p className="text-xs font-semibold text-green-700 dark:text-green-400 mb-2">✓ Fatores Atenuantes</p>
                        <ul className="space-y-1">
                          {crisisResult.diagnostico.fatores_atenuantes?.map((f, i) => (
                            <li key={i} className="text-xs text-muted-foreground">• {f}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Precedentes */}
              {crisisResult.precedentes && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      📚 Precedentes
                      {crisisResult.articlesFound !== undefined && crisisResult.articlesFound > 0 && (
                        <Badge variant="outline" className="text-xs">{crisisResult.articlesFound} notícias</Badge>
                      )}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="text-sm text-muted-foreground">{crisisResult.precedentes.resumo}</p>
                    {crisisResult.precedentes.casos?.length > 0 && (
                      <div className="space-y-2">
                        {crisisResult.precedentes.casos.map((caso, i) => (
                          <div key={i} className="p-3 rounded-lg bg-muted/50 border">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-semibold text-sm">{caso.titulo}</span>
                              {caso.data && <Badge variant="outline" className="text-xs">{caso.data}</Badge>}
                            </div>
                            <p className="text-xs text-muted-foreground mb-1"><strong>Desfecho:</strong> {caso.desfecho}</p>
                            <p className="text-xs text-primary"><strong>Lição:</strong> {caso.licao}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Nota Oficial */}
              {crisisResult.nota_oficial && (
                <Card className="border-primary/30">
                  <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle className="text-base flex items-center gap-2">
                      📋 Proposta de Nota Oficial
                    </CardTitle>
                    <Button variant="ghost" size="sm" onClick={() => copyToClipboard(
                      `${crisisResult.nota_oficial.titulo}\n\n${crisisResult.nota_oficial.corpo}`
                    )}>
                      <Copy className="h-4 w-4" />
                    </Button>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <h3 className="font-bold text-base">{crisisResult.nota_oficial.titulo}</h3>
                    <p className="text-sm whitespace-pre-wrap leading-relaxed">{crisisResult.nota_oficial.corpo}</p>
                    {crisisResult.nota_oficial.pontos_chave?.length > 0 && (
                      <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
                        <p className="text-xs font-semibold text-primary mb-2">Pontos-chave garantidos:</p>
                        <ul className="space-y-1">
                          {crisisResult.nota_oficial.pontos_chave.map((p, i) => (
                            <li key={i} className="text-xs flex items-start gap-2">
                              <CheckCircle2 className="h-3 w-3 text-primary mt-0.5 flex-shrink-0" />
                              {p}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Plano de Ação */}
              {crisisResult.plano_acao && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">🗓️ Plano de Ação</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {[
                      { key: "primeiras_2h", label: "⏱️ Primeiras 2 horas", items: crisisResult.plano_acao.primeiras_2h },
                      { key: "primeiras_24h", label: "📅 Primeiras 24 horas", items: crisisResult.plano_acao.primeiras_24h },
                      { key: "proxima_semana", label: "📆 Próxima semana", items: crisisResult.plano_acao.proxima_semana },
                    ].map((phase) => (
                      <div key={phase.key} className="space-y-1.5">
                        <p className="text-sm font-semibold">{phase.label}</p>
                        <ul className="space-y-1 pl-1">
                          {phase.items?.map((item, i) => (
                            <li key={i} className="text-xs text-muted-foreground flex items-start gap-2">
                              <span className="text-primary mt-0.5">→</span> {item}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}

              {/* Riscos */}
              {crisisResult.riscos?.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">⚡ Riscos Identificados</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {crisisResult.riscos.map((risco, i) => (
                      <div key={i} className={`p-3 rounded-lg border-l-4 ${urgencyColors[risco.probabilidade]} bg-muted/30`}>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-medium">{risco.descricao}</span>
                          <Badge variant="outline" className="text-xs">{risco.probabilidade}</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground"><strong>Mitigação:</strong> {risco.mitigacao}</p>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}

              {/* O que NÃO fazer */}
              {crisisResult.o_que_nao_fazer?.length > 0 && (
                <Card className="border-destructive/20">
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      🚫 O que NÃO fazer
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      {crisisResult.o_que_nao_fazer.map((item, i) => (
                        <li key={i} className="text-sm flex items-start gap-2">
                          <AlertCircle className="h-4 w-4 text-destructive mt-0.5 flex-shrink-0" />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          <CreditConfirmationDialog
            isOpen={showCrisisConfirm}
            onOpenChange={setShowCrisisConfirm}
            cost={CREDIT_COSTS.CRISIS_ANALYSIS}
            currentBalance={currentCredits}
            resourceType="análise de crise"
            title="Ativar Sala de Crise?"
            onConfirm={() => { setShowCrisisConfirm(false); handleCrisis(); }}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
