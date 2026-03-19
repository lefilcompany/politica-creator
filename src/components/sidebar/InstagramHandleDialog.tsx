import { useState, useEffect } from 'react';
import { Instagram, Loader2, Check } from 'lucide-react';
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

export function InstagramHandleDialog({ open, onOpenChange }: InstagramHandleDialogProps) {
  const { user } = useAuth();
  const [handle, setHandle] = useState('');
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);

  useEffect(() => {
    if (open && user?.id) {
      setInitialLoading(true);
      supabase
        .from('profiles')
        .select('instagram_handle')
        .eq('id', user.id)
        .single()
        .then(({ data }) => {
          setHandle(data?.instagram_handle || '');
          setInitialLoading(false);
        });
    }
  }, [open, user?.id]);

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
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">@</span>
              <Input
                placeholder="seu.perfil"
                value={handle}
                onChange={e => setHandle(e.target.value.replace(/[^a-zA-Z0-9._]/g, ''))}
                className="pl-10 h-11"
                maxLength={30}
                autoFocus
              />
            </div>
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
