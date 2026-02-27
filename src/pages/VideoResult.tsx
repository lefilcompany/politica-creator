import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Download,
  ArrowLeft,
  Check,
  Video,
  Loader,
  Save,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

interface VideoResultData {
  mediaUrl: string;
  caption?: string;
  platform: string;
  brand: string;
  title?: string;
  body?: string;
  hashtags?: string[];
  originalFormData?: any;
  actionId?: string;
  isProcessing?: boolean;
  // Veo 3.1 metadata
  audioStyle?: string;
  visualStyle?: string;
  veoVersion?: string;
  error?: string;
}

export default function VideoResult() {
  const navigate = useNavigate();
  const location = useLocation();
  const { team, user } = useAuth();
  const [videoData, setVideoData] = useState<VideoResultData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSavedToHistory, setIsSavedToHistory] = useState(false);
  const [hasShownSuccessToast, setHasShownSuccessToast] = useState(false);

  useEffect(() => {
    const loadVideo = async () => {
      if (location.state?.contentData) {
        const data = location.state.contentData;
        setVideoData(data);
        setIsLoading(false);
        setIsSavedToHistory(!!data.actionId);

        // Se o vídeo está sendo processado, monitorar o status
        if (data.isProcessing && data.actionId) {
          let intervalId: NodeJS.Timeout;
          
          const checkVideoStatus = async () => {
            try {
              const { data: actionData, error } = await supabase
                .from('actions')
                .select('status, result')
                .eq('id', data.actionId)
                .single();

              if (error) {
                console.error("Erro ao verificar status do vídeo:", error);
                return;
              }

              const result = actionData?.result as { 
                videoUrl?: string; 
                caption?: string;
                processingTime?: string;
                attempts?: number;
                audioStyle?: string;
                visualStyle?: string;
                veoVersion?: string;
                error?: string;
              } | null;
              if (actionData?.status === 'completed' && result?.videoUrl) {
                setVideoData(prev => prev ? {
                  ...prev,
                  mediaUrl: result.videoUrl,
                  caption: result.caption || prev.caption,
                  isProcessing: false,
                  audioStyle: result.audioStyle,
                  visualStyle: result.visualStyle,
                  veoVersion: result.veoVersion
                } : null);
                
                // Mostrar toast apenas uma vez e limpar o intervalo
                if (!hasShownSuccessToast) {
                  toast.success("Vídeo gerado com sucesso!");
                  setHasShownSuccessToast(true);
                }
                
                // Limpar o intervalo quando o vídeo estiver pronto
                if (intervalId) {
                  clearInterval(intervalId);
                }
              } else if (actionData?.status === 'failed') {
                const errorMessage = result?.error || "Falha ao gerar o vídeo. Tente novamente.";
                toast.error(errorMessage);
                setVideoData(prev => prev ? { ...prev, isProcessing: false, error: errorMessage } : null);
                
                // Limpar o intervalo em caso de falha
                if (intervalId) {
                  clearInterval(intervalId);
                }
              }
            } catch (error) {
              console.error("Erro ao verificar status:", error);
            }
          };

          // Verificar imediatamente
          checkVideoStatus();
          // Depois verificar a cada 5 segundos
          intervalId = setInterval(checkVideoStatus, 5000);

          return () => {
            if (intervalId) {
              clearInterval(intervalId);
            }
          };
        }
      } else {
        toast.error("Nenhum vídeo encontrado");
        navigate("/create");
      }
    };

    loadVideo();
  }, [location.state, navigate, hasShownSuccessToast]);

  const handleDownload = async () => {
    if (!videoData || !videoData.mediaUrl) {
      toast.error("Nenhum vídeo disponível para download");
      return;
    }

    try {
      const toastId = toast.loading("Preparando download...");
      
      // Se for URL do Supabase Storage, fazer download direto
      if (videoData.mediaUrl.startsWith('http')) {
        const response = await fetch(videoData.mediaUrl, {
          mode: 'cors',
        });
        
        if (!response.ok) {
          throw new Error(`Erro ao baixar: ${response.status}`);
        }
        
        const blob = await response.blob();
        
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        
        const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, -5);
        const brandName = videoData.brand ? videoData.brand.replace(/\s+/g, "_") : "video";
        const platformName = videoData.platform || "creator";
        link.download = `${brandName}_${platformName}_${timestamp}.mp4`;
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
        
        toast.success("Download do vídeo iniciado!", { id: toastId });
      } else {
        toast.error("URL do vídeo inválida", { id: toastId });
      }
    } catch (error) {
      console.error("Erro ao fazer download:", error);
      toast.error("Erro ao fazer download do vídeo. Tente novamente.");
    }
  };

  const handleSaveToHistory = async () => {
    if (!videoData || !team?.id || !user?.id || isSavedToHistory) return;

    setIsSaving(true);
    try {
      // Se já tem actionId, apenas marcar como salvo
      if (videoData.actionId) {
        setIsSavedToHistory(true);
        toast.success("Vídeo já está salvo no histórico!");
        setIsSaving(false);
        return;
      }

      // Preparar os dados do resultado
      const resultData: any = {
        videoUrl: videoData.mediaUrl,
        platform: videoData.platform,
        brand: videoData.brand,
      };

      // Adicionar campos opcionais se existirem
      if (videoData.caption) resultData.caption = videoData.caption;
      if (videoData.title) resultData.title = videoData.title;
      if (videoData.body) resultData.body = videoData.body;
      if (videoData.hashtags) resultData.hashtags = videoData.hashtags;

      // Criar nova action
      const { data: action, error } = await supabase
        .from("actions")
        .insert({
          team_id: team.id,
          user_id: user.id,
          type: "CRIAR_CONTEUDO",
          status: "Concluído",
          approved: false,
          result: resultData,
          details: {
            platform: videoData.platform,
            brand: videoData.brand,
            contentType: "video",
          }
        })
        .select()
        .single();

      if (error) throw error;

      setVideoData(prev => prev ? { ...prev, actionId: action.id } : null);
      setIsSavedToHistory(true);
      toast.success("Vídeo salvo no histórico com sucesso!");
    } catch (error) {
      console.error("Erro ao salvar no histórico:", error);
      toast.error("Erro ao salvar no histórico");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading || !videoData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <div className="container max-w-5xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <Button
            variant="ghost"
            onClick={() => navigate("/create")}
            className="gap-2 hover:bg-primary/10 hover:text-primary"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </Button>
          <Badge variant="secondary" className="gap-2 px-4 py-2">
            <Video className="h-4 w-4" />
            Vídeo Gerado
          </Badge>
        </div>

        {/* Main Content */}
        <div className="space-y-6">
          {/* Video Preview Card */}
          <Card className="overflow-hidden border-primary/20 shadow-lg">
            <CardContent className="p-0">
              <div className="relative aspect-video bg-gradient-to-br from-primary/5 to-primary/10 flex items-center justify-center">
                {videoData.isProcessing ? (
                  <div className="flex flex-col items-center gap-4 p-8">
                    <div className="relative">
                      <Loader className="h-16 w-16 animate-spin text-primary" />
                      <div className="absolute inset-0 h-16 w-16 animate-pulse rounded-full bg-primary/20" />
                    </div>
                    <div className="text-center space-y-2">
                      <p className="text-lg font-medium">Gerando vídeo...</p>
                      <p className="text-sm text-muted-foreground">Isso pode levar alguns minutos</p>
                    </div>
                  </div>
                 ) : videoData.mediaUrl ? (
                  <video
                    src={videoData.mediaUrl}
                    controls
                    className="w-full h-full object-contain bg-black"
                    autoPlay
                    loop
                    playsInline
                    preload="metadata"
                  />
                ) : (
                  <div className="text-center text-muted-foreground p-8">
                    <Video className="h-16 w-16 mx-auto mb-4 opacity-50" />
                    <p className="text-lg">{videoData.error || "Vídeo não disponível"}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Info and Actions Grid */}
          <div className="grid md:grid-cols-2 gap-4">
            {/* Platform and Brand Info */}
            <Card className="border-primary/10">
              <CardContent className="p-6">
                <h3 className="font-semibold mb-4 flex items-center gap-2">
                  <Video className="h-4 w-4 text-primary" />
                  Informações
                </h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 rounded-lg bg-primary/5">
                    <span className="text-sm font-medium text-muted-foreground">Plataforma</span>
                    <Badge variant="outline" className="font-medium">{videoData.platform}</Badge>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg bg-primary/5">
                    <span className="text-sm font-medium text-muted-foreground">Marca</span>
                    <Badge variant="outline" className="font-medium">{videoData.brand}</Badge>
                  </div>
                  {videoData.audioStyle && videoData.audioStyle !== 'none' && (
                    <div className="flex items-center justify-between p-3 rounded-lg bg-purple-500/10">
                      <span className="text-sm font-medium text-muted-foreground">Áudio</span>
                      <Badge variant="outline" className="font-medium text-purple-500 border-purple-500/50">
                        🔊 {videoData.audioStyle}
                      </Badge>
                    </div>
                  )}
                  {videoData.visualStyle && (
                    <div className="flex items-center justify-between p-3 rounded-lg bg-blue-500/10">
                      <span className="text-sm font-medium text-muted-foreground">Estilo</span>
                      <Badge variant="outline" className="font-medium text-blue-500 border-blue-500/50">
                        🎬 {videoData.visualStyle}
                      </Badge>
                    </div>
                  )}
                  {videoData.veoVersion && (
                    <div className="flex items-center justify-between p-3 rounded-lg bg-green-500/10">
                      <span className="text-sm font-medium text-muted-foreground">Modelo</span>
                      <Badge variant="outline" className="font-medium text-green-500 border-green-500/50">
                        Veo {videoData.veoVersion}
                      </Badge>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Action Buttons */}
            <Card className="border-primary/10">
              <CardContent className="p-6">
                <h3 className="font-semibold mb-4">Ações</h3>
                <div className="space-y-3">
                  <Button
                    onClick={handleDownload}
                    variant="outline"
                    className="w-full gap-2 hover:bg-primary/10 hover:border-primary"
                    disabled={videoData.isProcessing}
                  >
                    <Download className="h-4 w-4" />
                    Baixar Vídeo
                  </Button>

                  <Button
                    onClick={handleSaveToHistory}
                    className="w-full gap-2 bg-primary hover:bg-primary/90"
                    disabled={isSaving || isSavedToHistory || videoData.isProcessing}
                  >
                    {isSaving ? (
                      <>
                        <Loader className="h-4 w-4 animate-spin" />
                        Salvando...
                      </>
                    ) : isSavedToHistory ? (
                      <>
                        <Check className="h-4 w-4" />
                        Salvo no Histórico
                      </>
                    ) : (
                      <>
                        <Save className="h-4 w-4" />
                        Salvar no Histórico
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
