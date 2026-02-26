import { useState } from "react";
import { Shield, Search, MessageSquareReply, CheckCircle2, Copy, AlertTriangle, AlertCircle, Info, Loader2, ExternalLink, Newspaper } from "lucide-react";
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
import defenseBanner from "@/assets/defense-banner.jpg";

// Types
interface MonitorResult {
  title: string;
  summary: string;
  classification: "fake_news" | "ataque_infundado" | "critica_legitima" | "alerta";
  urgency: "alta" | "media" | "baixa";
  suggestedAction: string;
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

export default function Defense() {
  const { toast } = useToast();
  const { user } = useAuth();

  // Monitor state
  const [monitorKeywords, setMonitorKeywords] = useState("");
  const [monitorLoading, setMonitorLoading] = useState(false);
  const [monitorResults, setMonitorResults] = useState<MonitorResult[] | null>(null);
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
      setMonitorResults(data.results);
    } catch (e: any) {
      toast({ title: "Erro", description: e.message || "Falha ao monitorar", variant: "destructive" });
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

  const scoreColor = (score: number) => {
    if (score >= 90) return "bg-green-500";
    if (score >= 70) return "bg-blue-500";
    if (score >= 50) return "bg-yellow-500";
    return "bg-destructive";
  };

  const currentCredits = user?.credits || 0;

  return (
    <div className="space-y-6">
      <PageBreadcrumb items={[{ label: "Defesa Digital" }]} />

      {/* Banner */}
      <div className="relative rounded-2xl overflow-hidden h-40 md:h-52">
        <img src={defenseBanner} alt="Defesa Digital" className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/70 to-black/30 flex items-center px-8">
          <div className="flex items-center gap-4">
            <Shield className="h-10 w-10 text-white" />
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-white">Defesa Digital</h1>
              <p className="text-white/80 text-sm md:text-base">Monitore, responda e verifique — proteja sua imagem</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="monitor" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="monitor" className="flex items-center gap-2">
            <Search className="h-4 w-4" />
            <span className="hidden sm:inline">Monitorar</span>
          </TabsTrigger>
          <TabsTrigger value="respond" className="flex items-center gap-2">
            <MessageSquareReply className="h-4 w-4" />
            <span className="hidden sm:inline">Responder</span>
          </TabsTrigger>
          <TabsTrigger value="verify" className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4" />
            <span className="hidden sm:inline">Verificar</span>
          </TabsTrigger>
        </TabsList>

        {/* TAB: MONITOR */}
        <TabsContent value="monitor" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Search className="h-5 w-5 text-primary" />
                Monitor de Fake News
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Busque por menções falsas ou ataques relacionados ao seu perfil político. Custo: {CREDIT_COSTS.FAKE_NEWS_MONITOR} créditos.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <Input
                placeholder="Termos de busca (ex: nome do político, partido, tema sensível...)"
                value={monitorKeywords}
                onChange={(e) => setMonitorKeywords(e.target.value)}
                maxLength={200}
              />
              <Button
                onClick={() => setShowMonitorConfirm(true)}
                disabled={monitorLoading || !monitorKeywords.trim()}
                className="w-full sm:w-auto"
              >
                {monitorLoading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Buscando...</> : "Buscar Menções"}
              </Button>
            </CardContent>
          </Card>

          {monitorResults && (
            <div className="space-y-3">
              {monitorResults.length === 0 ? (
                <Card><CardContent className="py-8 text-center text-muted-foreground">Nenhuma menção encontrada.</CardContent></Card>
              ) : monitorResults.map((r, i) => (
                <Card key={i} className={`border-l-4 ${urgencyColors[r.urgency]}`}>
                  <CardContent className="pt-4 space-y-2">
                    <div className="flex items-start justify-between gap-2 flex-wrap">
                      <h3 className="font-semibold">{r.title}</h3>
                      <div className="flex gap-2 flex-shrink-0">
                        <Badge className={classificationLabels[r.classification]?.color}>
                          {classificationLabels[r.classification]?.label}
                        </Badge>
                        <Badge variant="outline">Urgência: {r.urgency}</Badge>
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground">{r.summary}</p>
                    <p className="text-sm"><strong>Ação sugerida:</strong> {r.suggestedAction}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          <CreditConfirmationDialog
            isOpen={showMonitorConfirm}
            onOpenChange={setShowMonitorConfirm}
            cost={CREDIT_COSTS.FAKE_NEWS_MONITOR}
            currentBalance={currentCredits}
            resourceType="busca"
            title="Buscar Menções?"
            onConfirm={() => { setShowMonitorConfirm(false); handleMonitor(); }}
          />
        </TabsContent>

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
      </Tabs>
    </div>
  );
}
