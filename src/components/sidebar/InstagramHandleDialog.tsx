import { useState, useEffect } from 'react';
import { Instagram, Loader2, Check, Search, ExternalLink, User } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
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
}

export function InstagramHandleDialog({ open, onOpenChange }: InstagramHandleDialogProps) {
  const { user } = useAuth();
  const [handle, setHandle] = useState('');
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [preview, setPreview] = useState<InstagramPreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState('');

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
          setInitialLoading(false);
          if (existing) {
            fetchPreview(existing);
          }
        });
    }
  }, [open, user?.id]);

  const fetchPreview = async (handleToFetch: string) => {
    if (!handleToFetch.trim()) return;
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
      } else {
        setPreviewError(data?.error || 'Perfil não encontrado');
      }
    } catch {
      setPreviewError('Não foi possível carregar o preview');
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleSave = async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ instagram_handle: handle.trim() || null })
        .eq('id', user.id);

      if (error) throw error;
      toast.success(handle.trim() ? `Instagram @${handle.trim()} salvo!` : 'Instagram removido');
      onOpenChange(false);
    } catch {
      toast.error('Erro ao salvar Instagram');
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 via-pink-500 to-orange-400 flex items-center justify-center">
              <Instagram className="w-4 h-4 text-white" />
            </div>
            Seu Instagram
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <p className="text-sm text-muted-foreground">
            O conteúdo gerado será adaptado ao estilo e tom do seu perfil no Instagram.
          </p>

          {initialLoading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
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
                <div className="flex items-center justify-center py-6 rounded-lg border border-border bg-muted/30">
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
                <div className="rounded-lg border border-border bg-card overflow-hidden">
                  <div className="flex items-center gap-3 p-4">
                    {preview.profilePicture ? (
                      <img
                        src={preview.profilePicture}
                        alt={preview.displayName}
                        className="h-14 w-14 rounded-full object-cover border-2 border-border"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    ) : (
                      <div className="h-14 w-14 rounded-full bg-muted flex items-center justify-center border-2 border-border flex-shrink-0">
                        <User className="h-6 w-6 text-muted-foreground" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm truncate">{preview.displayName}</p>
                      <p className="text-xs text-muted-foreground">@{preview.handle}</p>
                      {(preview.followers || preview.posts) && (
                        <div className="flex gap-3 mt-1">
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
                    <div className="px-4 pb-3">
                      <p className="text-xs text-muted-foreground line-clamp-2">{preview.bio}</p>
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

                  <div className="border-t border-border px-4 py-2.5 bg-primary/5">
                    <p className="text-xs text-primary font-medium flex items-center gap-1.5">
                      <Check className="h-3.5 w-3.5" />
                      {(preview as any).minimal
                        ? 'Perfil identificado — clique em Salvar para confirmar'
                        : 'Perfil encontrado — clique em Salvar para confirmar'}
                    </p>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={loading || initialLoading} className="gap-2">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}