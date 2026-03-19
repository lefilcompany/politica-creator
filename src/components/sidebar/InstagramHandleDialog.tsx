import { useState, useEffect } from 'react';
import { Instagram, Loader2, Check, Search, ExternalLink, User, X, RefreshCw, Sparkles } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
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
            // If already saved, show saved view with preview
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

  const usageItems = [
    { emoji: '✍️', label: 'Tom de voz e estilo de escrita', description: 'Adaptamos legendas e textos ao seu jeito de se comunicar' },
    { emoji: '🎨', label: 'Estética visual e paleta de cores', description: 'Imagens geradas seguem o padrão visual do seu perfil' },
    { emoji: '📱', label: 'Formato e estrutura de posts', description: 'Conteúdos respeitam a forma como você organiza seus posts' },
    { emoji: '🎯', label: 'Posicionamento e narrativa', description: 'Mensagens alinhadas com a sua identidade e valores' },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg p-0 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-600 via-pink-500 to-orange-400 px-6 py-5">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3 text-white">
              <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                <Instagram className="w-5 h-5 text-white" />
              </div>
              <div>
                <span className="text-lg font-bold">Instagram</span>
                <p className="text-sm font-normal text-white/80 mt-0.5">
                  Conecte seu perfil para personalizar seu conteúdo
                </p>
              </div>
            </DialogTitle>
          </DialogHeader>
        </div>

        <div className="p-6">
          {initialLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : view === 'saved' && savedPreview ? (
            /* ── Saved View ── */
            <div className="space-y-5">
              {/* Connected profile card */}
              <div className="rounded-xl border-2 border-primary/20 bg-primary/5 overflow-hidden">
                <div className="flex items-center gap-1.5 px-4 py-2 bg-primary/10 border-b border-primary/10">
                  <Check className="h-3.5 w-3.5 text-primary" />
                  <span className="text-xs font-semibold text-primary">Perfil conectado</span>
                </div>
                <div className="flex items-center gap-4 p-4">
                  {savedPreview.profilePicture ? (
                    <img
                      src={savedPreview.profilePicture}
                      alt={savedPreview.displayName}
                      className="h-16 w-16 rounded-full object-cover ring-2 ring-primary/30 ring-offset-2 ring-offset-background"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    />
                  ) : (
                    <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center ring-2 ring-primary/30 ring-offset-2 ring-offset-background">
                      <User className="h-7 w-7 text-muted-foreground" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-base truncate">{savedPreview.displayName}</p>
                    <p className="text-sm text-muted-foreground">@{savedPreview.handle}</p>
                    {(savedPreview.followers || savedPreview.posts) && (
                      <div className="flex gap-4 mt-1.5">
                        {savedPreview.followers && (
                          <span className="text-xs text-muted-foreground">
                            <strong className="text-foreground">{savedPreview.followers}</strong> seguidores
                          </span>
                        )}
                        {savedPreview.posts && (
                          <span className="text-xs text-muted-foreground">
                            <strong className="text-foreground">{savedPreview.posts}</strong> posts
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  <a
                    href={savedPreview.profileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 rounded-lg hover:bg-muted transition-colors"
                  >
                    <ExternalLink className="h-4 w-4 text-muted-foreground" />
                  </a>
                </div>
                {savedPreview.bio && (
                  <div className="px-4 pb-4 -mt-1">
                    <p className="text-xs text-muted-foreground italic line-clamp-2">"{savedPreview.bio}"</p>
                  </div>
                )}
              </div>

              {/* How it's used */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles className="h-4 w-4 text-primary" />
                  <h3 className="text-sm font-semibold text-foreground">Como usamos seu perfil</h3>
                </div>
                <div className="grid gap-2">
                  {usageItems.map((item) => (
                    <div key={item.label} className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 border border-border/50">
                      <span className="text-lg leading-none mt-0.5">{item.emoji}</span>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground">{item.label}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{item.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setView('search');
                    setPreview(null);
                    setPreviewError('');
                  }}
                  className="gap-1.5"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Trocar conta
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleRemove}
                  disabled={loading}
                  className="text-destructive hover:text-destructive hover:bg-destructive/10 gap-1.5"
                >
                  {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />}
                  Desconectar
                </Button>
              </div>
            </div>
          ) : (
            /* ── Search View ── */
            <div className="space-y-4">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium text-sm">@</span>
                  <Input
                    placeholder="seu.perfil"
                    value={handle}
                    onChange={e => {
                      setHandle(e.target.value.replace(/[^a-zA-Z0-9._]/g, ''));
                      setPreview(null);
                      setPreviewError('');
                    }}
                    onKeyDown={handleKeyDown}
                    className="pl-8 h-11"
                    maxLength={30}
                    autoFocus
                  />
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-11 w-11 flex-shrink-0"
                  onClick={() => fetchPreview(handle)}
                  disabled={!handle.trim() || previewLoading}
                >
                  {previewLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Search className="h-4 w-4" />
                  )}
                </Button>
              </div>

              {previewLoading && (
                <div className="flex items-center justify-center py-8 rounded-lg border border-border bg-muted/30">
                  <div className="flex flex-col items-center gap-2">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">Buscando perfil...</span>
                  </div>
                </div>
              )}

              {previewError && !previewLoading && (
                <div className="flex items-center gap-3 py-4 px-4 rounded-lg border border-destructive/30 bg-destructive/5">
                  <User className="h-8 w-8 text-destructive/50 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-destructive">{previewError}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Verifique se o @ está correto</p>
                  </div>
                </div>
              )}

              {preview && !previewLoading && (
                <div className="space-y-4">
                  {/* Profile preview card */}
                  <div className="rounded-xl border border-border bg-card overflow-hidden">
                    <div className="flex items-center gap-4 p-4">
                      {preview.profilePicture ? (
                        <img
                          src={preview.profilePicture}
                          alt={preview.displayName}
                          className="h-16 w-16 rounded-full object-cover border-2 border-border"
                          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                        />
                      ) : (
                        <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center border-2 border-border flex-shrink-0">
                          <User className="h-7 w-7 text-muted-foreground" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-base truncate">{preview.displayName}</p>
                        <p className="text-sm text-muted-foreground">@{preview.handle}</p>
                        {(preview.followers || preview.posts) && (
                          <div className="flex gap-4 mt-1.5">
                            {preview.followers && (
                              <span className="text-xs text-muted-foreground">
                                <strong className="text-foreground">{preview.followers}</strong> seguidores
                              </span>
                            )}
                            {preview.posts && (
                              <span className="text-xs text-muted-foreground">
                                <strong className="text-foreground">{preview.posts}</strong> posts
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    {preview.bio && (
                      <div className="px-4 pb-3 -mt-1">
                        <p className="text-xs text-muted-foreground italic line-clamp-2">"{preview.bio}"</p>
                      </div>
                    )}
                    <div className="border-t border-border px-4 py-2.5 bg-muted/30">
                      <a
                        href={preview.profileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 text-xs text-primary hover:underline"
                      >
                        <ExternalLink className="h-3 w-3" />
                        Ver perfil no Instagram
                      </a>
                    </div>
                  </div>

                  {/* What will be captured */}
                  <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
                    <p className="text-xs font-semibold text-primary mb-2 flex items-center gap-1.5">
                      <Sparkles className="h-3.5 w-3.5" />
                      O que será capturado para gerar conteúdo:
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      {usageItems.map((item) => (
                        <div key={item.label} className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span>{item.emoji}</span>
                          <span>{item.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Save button */}
                  <div className="flex gap-2">
                    <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
                      Cancelar
                    </Button>
                    <Button onClick={handleSave} disabled={loading} className="flex-1 gap-2">
                      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                      Conectar Instagram
                    </Button>
                  </div>
                </div>
              )}

              {/* Empty state hint */}
              {!preview && !previewLoading && !previewError && (
                <div className="text-center py-6">
                  <div className="w-12 h-12 rounded-full bg-muted mx-auto mb-3 flex items-center justify-center">
                    <Instagram className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Digite seu @ do Instagram e clique em buscar
                  </p>
                  <p className="text-xs text-muted-foreground/70 mt-1">
                    Usaremos seu perfil como referência para criar conteúdos personalizados
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
