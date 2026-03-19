import { useState, useEffect } from 'react';
import { Instagram, Loader2, Check, Search, ExternalLink, User, X, RefreshCw, Sparkles, ArrowRight } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

interface InstagramHandleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface InstagramPreview {
  handle: string;
  displayName: string;
  profilePicture: string | null;
  followers: string;
  posts: string;
  bio: string;
  profileUrl: string;
  minimal?: boolean;
}

type DialogView = 'search' | 'saved';

const usageItems = [
  { emoji: '✍️', label: 'Tom de voz e estilo de escrita', description: 'Adaptamos legendas e textos ao seu jeito de se comunicar' },
  { emoji: '🎨', label: 'Estética visual e paleta de cores', description: 'Imagens geradas seguem o padrão visual do seu perfil' },
  { emoji: '📱', label: 'Formato e estrutura de posts', description: 'Conteúdos respeitam a forma como você organiza seus posts' },
  { emoji: '🎯', label: 'Posicionamento e narrativa', description: 'Mensagens alinhadas com a sua identidade e valores' },
];

export function InstagramHandleDialog({ open, onOpenChange }: InstagramHandleDialogProps) {
  const { user } = useAuth();
  const [handle, setHandle] = useState('');
  const [savedHandle, setSavedHandle] = useState('');
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [preview, setPreview] = useState<InstagramPreview | null>(null);
  const [savedPreview, setSavedPreview] = useState<InstagramPreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState('');
  const [view, setView] = useState<DialogView>('search');

  useEffect(() => {
    if (open && user?.id) {
      setInitialLoading(true);
      setPreview(null);
      setPreviewError('');
      supabase
        .from('profiles')
        .select('instagram_handle')
        .eq('id', user.id)
        .single()
        .then(({ data }) => {
          const existing = data?.instagram_handle || '';
          setHandle(existing);
          setSavedHandle(existing);
          setInitialLoading(false);
          if (existing) {
            fetchPreview(existing).then((previewData) => {
              if (previewData) {
                setSavedPreview(previewData);
                setView('saved');
              }
            });
          } else {
            setView('search');
          }
        });
    }
  }, [open, user?.id]);

  const fetchPreview = async (handleToFetch: string): Promise<InstagramPreview | null> => {
    if (!handleToFetch.trim()) return null;
    setPreviewLoading(true);
    setPreviewError('');
    setPreview(null);

    try {
      const { data, error } = await supabase.functions.invoke('fetch-instagram-preview', {
        body: { handle: handleToFetch.trim() },
      });
      if (error) throw error;
      if (data?.success && data?.data) {
        setPreview(data.data);
        return data.data;
      } else {
        setPreviewError(data?.error || 'Perfil não encontrado');
        return null;
      }
    } catch {
      setPreviewError('Não foi possível carregar o preview');
      return null;
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleSave = async () => {
    if (!user?.id || !preview) return;
    setLoading(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ instagram_handle: handle.trim() || null })
        .eq('id', user.id);
      if (error) throw error;
      toast.success(`Instagram @${handle.trim()} conectado!`);
      setSavedHandle(handle.trim());
      setSavedPreview(preview);
      setView('saved');
    } catch {
      toast.error('Erro ao salvar Instagram');
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ instagram_handle: null })
        .eq('id', user.id);
      if (error) throw error;
      toast.success('Instagram desconectado');
      setHandle('');
      setSavedHandle('');
      setPreview(null);
      setSavedPreview(null);
      setView('search');
    } catch {
      toast.error('Erro ao remover Instagram');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && handle.trim()) {
      e.preventDefault();
      fetchPreview(handle);
    }
  };

  const ProfileCard = ({ data, connected }: { data: InstagramPreview; connected?: boolean }) => (
    <div className={`rounded-2xl border overflow-hidden transition-all ${connected ? 'border-primary/30 bg-primary/5 shadow-sm shadow-primary/10' : 'border-border bg-card shadow-sm'}`}>
      {connected && (
        <div className="flex items-center gap-1.5 px-4 py-2 bg-primary/10 border-b border-primary/15">
          <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
          <span className="text-xs font-semibold text-primary">Perfil conectado</span>
        </div>
      )}
      <div className="p-5">
        <div className="flex items-center gap-4">
          <div className="relative">
            {data.profilePicture ? (
              <img
                src={data.profilePicture}
                alt={data.displayName}
                className={`h-[72px] w-[72px] rounded-full object-cover ${connected ? 'ring-[3px] ring-primary/40 ring-offset-2 ring-offset-background' : 'ring-2 ring-border'}`}
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
            ) : (
              <div className={`h-[72px] w-[72px] rounded-full bg-muted flex items-center justify-center ${connected ? 'ring-[3px] ring-primary/40 ring-offset-2 ring-offset-background' : 'ring-2 ring-border'}`}>
                <User className="h-8 w-8 text-muted-foreground" />
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="font-bold text-base truncate">{data.displayName}</p>
              <a href={data.profileUrl} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary transition-colors shrink-0">
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>
            <p className="text-sm text-muted-foreground">@{data.handle}</p>
            {(data.followers || data.posts) && (
              <div className="flex gap-4 mt-2">
                {data.followers && (
                  <span className="text-xs text-muted-foreground">
                    <strong className="text-foreground font-semibold">{data.followers}</strong> seguidores
                  </span>
                )}
                {data.posts && (
                  <span className="text-xs text-muted-foreground">
                    <strong className="text-foreground font-semibold">{data.posts}</strong> posts
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
        {data.bio && (
          <p className="text-sm text-muted-foreground mt-3 leading-relaxed line-clamp-2 border-t border-border/50 pt-3 italic">
            "{data.bio}"
          </p>
        )}
      </div>
    </div>
  );

  const UsageGrid = ({ compact }: { compact?: boolean }) => (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <Sparkles className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold text-foreground">
          {compact ? 'O que será capturado:' : 'Como usamos seu perfil'}
        </h3>
      </div>
      <div className={compact ? 'grid grid-cols-2 gap-2' : 'space-y-2'}>
        {usageItems.map((item) => (
          compact ? (
            <div key={item.label} className="flex items-center gap-2 text-xs text-muted-foreground py-1.5 px-2 rounded-lg bg-muted/40">
              <span className="text-sm">{item.emoji}</span>
              <span className="truncate">{item.label}</span>
            </div>
          ) : (
            <div key={item.label} className="flex items-start gap-3 p-3 rounded-xl bg-muted/40 border border-border/40 hover:bg-muted/60 transition-colors">
              <span className="text-lg leading-none mt-0.5">{item.emoji}</span>
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">{item.label}</p>
                <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{item.description}</p>
              </div>
            </div>
          )
        ))}
      </div>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px] p-0 overflow-hidden gap-0">
        {/* Instagram gradient header */}
        <div className="relative bg-gradient-to-br from-[#833AB4] via-[#E1306C] to-[#F77737] px-6 py-6">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(255,255,255,0.15),transparent_60%)]" />
          <DialogHeader className="relative">
            <DialogTitle className="flex items-center gap-3 text-white">
              {(savedPreview?.profilePicture || preview?.profilePicture) ? (
                <img
                  src={savedPreview?.profilePicture || preview?.profilePicture || ''}
                  alt="Perfil"
                  className="w-11 h-11 rounded-2xl object-cover border border-white/30 shadow-md"
                />
              ) : (
                <div className="w-11 h-11 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center border border-white/20">
                  <Instagram className="w-5 h-5 text-white" />
                </div>
              )}
              <div>
                <span className="text-lg font-bold tracking-tight">Meu Instagram</span>
                <DialogDescription className="text-sm font-normal text-white/75 mt-0.5">
                  Conecte para personalizar seu conteúdo
                </DialogDescription>
              </div>
            </DialogTitle>
          </DialogHeader>
        </div>

        {/* Body */}
        <div className="p-6 max-h-[60vh] overflow-y-auto">
          {initialLoading ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <span className="text-sm text-muted-foreground">Carregando...</span>
            </div>
          ) : view === 'saved' && savedPreview ? (
            /* ── Saved View ── */
            <div className="space-y-5">
              <ProfileCard data={savedPreview} connected />
              <UsageGrid />
              <div className="flex gap-2 pt-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => { setView('search'); setPreview(null); setPreviewError(''); }}
                  className="gap-1.5 rounded-xl"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Trocar conta
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleRemove}
                  disabled={loading}
                  className="text-destructive hover:text-destructive hover:bg-destructive/10 gap-1.5 rounded-xl"
                >
                  {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />}
                  Desconectar
                </Button>
              </div>
            </div>
          ) : (
            /* ── Search View ── */
            <div className="space-y-5">
              {/* Search input */}
              <div>
                <label className="text-sm font-medium text-foreground mb-2 block">Buscar perfil</label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground font-medium text-sm">@</span>
                    <Input
                      placeholder="seu.perfil"
                      value={handle}
                      onChange={e => {
                        setHandle(e.target.value.replace(/[^a-zA-Z0-9._]/g, ''));
                        setPreview(null);
                        setPreviewError('');
                      }}
                      onKeyDown={handleKeyDown}
                      className="pl-9 h-11 rounded-xl"
                      maxLength={30}
                      autoFocus
                    />
                  </div>
                  <Button
                    type="button"
                    variant="default"
                    size="icon"
                    className="h-11 w-11 shrink-0 rounded-xl"
                    onClick={() => fetchPreview(handle)}
                    disabled={!handle.trim() || previewLoading}
                  >
                    {previewLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                  </Button>
                </div>
              </div>

              {/* Loading state */}
              {previewLoading && (
                <div className="flex flex-col items-center justify-center py-10 rounded-2xl border border-border bg-muted/20">
                  <Loader2 className="h-7 w-7 animate-spin text-primary mb-2" />
                  <span className="text-sm text-muted-foreground">Buscando perfil...</span>
                </div>
              )}

              {/* Error state */}
              {previewError && !previewLoading && (
                <div className="flex items-center gap-3 p-4 rounded-2xl border border-destructive/20 bg-destructive/5">
                  <div className="h-10 w-10 rounded-full bg-destructive/10 flex items-center justify-center shrink-0">
                    <User className="h-5 w-5 text-destructive/60" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-destructive">{previewError}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Verifique se o @ está correto e tente novamente</p>
                  </div>
                </div>
              )}

              {/* Preview found */}
              {preview && !previewLoading && (
                <div className="space-y-4">
                  <ProfileCard data={preview} />
                  <UsageGrid compact />
                  <div className="flex gap-2 pt-1">
                    <Button variant="outline" className="flex-1 rounded-xl h-11" onClick={() => onOpenChange(false)}>
                      Cancelar
                    </Button>
                    <Button onClick={handleSave} disabled={loading} className="flex-1 gap-2 rounded-xl h-11 font-semibold">
                      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                      Conectar
                    </Button>
                  </div>
                </div>
              )}

              {/* Empty state */}
              {!preview && !previewLoading && !previewError && (
                <div className="text-center py-10">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#833AB4]/10 via-[#E1306C]/10 to-[#F77737]/10 mx-auto mb-4 flex items-center justify-center">
                    <Instagram className="h-7 w-7 text-muted-foreground" />
                  </div>
                  <p className="text-sm font-medium text-foreground">
                    Encontre seu perfil
                  </p>
                  <p className="text-xs text-muted-foreground mt-1.5 max-w-[260px] mx-auto leading-relaxed">
                    Digite seu @ e busque para conectar seu Instagram como referência de estilo
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
