import { useState, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Camera, Upload, Loader2, X } from 'lucide-react';
import { toast } from 'sonner';
import AvatarEditor from './AvatarEditor';

interface AvatarChangeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentAvatarUrl: string;
  userName: string;
  onSave: (blob: Blob) => Promise<void>;
  uploading: boolean;
}

export default function AvatarChangeModal({
  open,
  onOpenChange,
  currentAvatarUrl,
  userName,
  onSave,
  uploading,
}: AvatarChangeModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [imageToEdit, setImageToEdit] = useState('');

  const getInitials = (name: string) =>
    name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      if (!event.target.files || event.target.files.length === 0) return;
      const file = event.target.files[0];

      if (!file.type.startsWith('image/')) {
        toast.error('Por favor, selecione uma imagem válida');
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        toast.error('A imagem deve ter no máximo 10MB');
        return;
      }

      const tempUrl = URL.createObjectURL(file);
      setImageToEdit(tempUrl);
      setEditorOpen(true);
    } catch (error) {
      console.error('Erro ao selecionar arquivo:', error);
      toast.error('Erro ao carregar imagem');
    } finally {
      if (event.target) event.target.value = '';
    }
  };

  const handleEditorSave = async (blob: Blob) => {
    setEditorOpen(false);
    if (imageToEdit) {
      URL.revokeObjectURL(imageToEdit);
      setImageToEdit('');
    }
    await onSave(blob);
    onOpenChange(false);
  };

  const handleEditorCancel = () => {
    setEditorOpen(false);
    if (imageToEdit) {
      URL.revokeObjectURL(imageToEdit);
      setImageToEdit('');
    }
  };

  const handleClose = (isOpen: boolean) => {
    if (!isOpen && !editorOpen) {
      onOpenChange(false);
    }
  };

  return (
    <>
      <Dialog open={open && !editorOpen} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-center">Foto de Perfil</DialogTitle>
          </DialogHeader>

          <div className="flex flex-col items-center gap-5 py-4">
            {/* Current Avatar Preview */}
            <div className="relative group">
              <Avatar className="h-32 w-32 border-4 border-primary/20 shadow-lg">
                <AvatarImage src={currentAvatarUrl} alt={userName} />
                <AvatarFallback className="text-3xl font-bold bg-gradient-to-br from-primary to-secondary text-white">
                  {getInitials(userName || 'U')}
                </AvatarFallback>
              </Avatar>
              {uploading && (
                <div className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center">
                  <Loader2 className="h-8 w-8 text-white animate-spin" />
                </div>
              )}
            </div>

            <p className="text-sm text-muted-foreground text-center">
              Selecione uma nova imagem para sua foto de perfil
            </p>

            {/* Action Buttons */}
            <div className="flex flex-col w-full gap-2">
              <Button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="w-full gap-2"
              >
                <Upload className="h-4 w-4" />
                Escolher nova foto
              </Button>
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={uploading}
                className="w-full gap-2"
              >
                <X className="h-4 w-4" />
                Cancelar
              </Button>
            </div>

            <p className="text-xs text-muted-foreground/70 text-center">
              JPG, PNG, WebP ou GIF • Máx 10MB
            </p>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="hidden"
            onChange={handleFileSelect}
            disabled={uploading}
          />
        </DialogContent>
      </Dialog>

      {/* Editor Modal */}
      <AvatarEditor
        imageUrl={imageToEdit}
        open={editorOpen}
        onSave={handleEditorSave}
        onCancel={handleEditorCancel}
      />
    </>
  );
}
