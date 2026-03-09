import { useState } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Camera, Loader2, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import AvatarEditor from './AvatarEditor';

interface AvatarUploadProps {
  userId: string;
  currentAvatarUrl?: string;
  userName: string;
  onAvatarUpdate: (url: string | null) => void;
}

export default function AvatarUpload({
  userId,
  currentAvatarUrl,
  userName,
  onAvatarUpdate,
}: AvatarUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [imageToEdit, setImageToEdit] = useState<string>('');
  const { refreshProfile } = useAuth();

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      if (!event.target.files || event.target.files.length === 0) {
        return;
      }

      const file = event.target.files[0];
      
      // Validar tipo de arquivo
      if (!file.type.startsWith('image/')) {
        toast.error('Por favor, selecione uma imagem válida');
        return;
      }

      // Validar tamanho (10MB)
      if (file.size > 10 * 1024 * 1024) {
        toast.error('A imagem deve ter no máximo 10MB');
        return;
      }

      // Criar URL temporária para edição
      const tempUrl = URL.createObjectURL(file);
      setImageToEdit(tempUrl);
      setEditorOpen(true);
    } catch (error) {
      console.error('Erro ao selecionar arquivo:', error);
      toast.error('Erro ao carregar imagem');
    } finally {
      // Limpar input
      if (event.target) {
        event.target.value = '';
      }
    }
  };

  const uploadAvatar = async (blob: Blob) => {
    try {
      setUploading(true);
      setEditorOpen(false);

      // Deletar avatar anterior se existir
      if (currentAvatarUrl) {
        const oldPath = currentAvatarUrl.split('/').pop();
        if (oldPath) {
          await supabase.storage.from('avatars').remove([`${userId}/${oldPath}`]);
        }
      }

      // Upload novo avatar
      const fileName = `${Date.now()}.png`;
      const filePath = `${userId}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, blob);

      if (uploadError) throw uploadError;

      // Obter URL pública
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      // Atualizar perfil
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: publicUrl })
        .eq('id', userId);

      if (updateError) throw updateError;

      onAvatarUpdate(publicUrl);
      await refreshProfile();
      
      toast.success('Foto de perfil atualizada');
    } catch (error) {
      console.error('Erro ao fazer upload:', error);
      toast.error('Erro ao atualizar foto de perfil');
    } finally {
      setUploading(false);
      // Limpar URL temporária
      if (imageToEdit) {
        URL.revokeObjectURL(imageToEdit);
        setImageToEdit('');
      }
    }
  };

  const deleteAvatar = async () => {
    try {
      setDeleting(true);

      if (!currentAvatarUrl) return;

      // Deletar do storage
      const oldPath = currentAvatarUrl.split('/').pop();
      if (oldPath) {
        const { error: deleteError } = await supabase.storage
          .from('avatars')
          .remove([`${userId}/${oldPath}`]);

        if (deleteError) throw deleteError;
      }

      // Atualizar perfil
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: null })
        .eq('id', userId);

      if (updateError) throw updateError;

      onAvatarUpdate(null);
      await refreshProfile();
      
      toast.success('Foto de perfil removida');
    } catch (error) {
      console.error('Erro ao deletar:', error);
      toast.error('Erro ao remover foto de perfil');
    } finally {
      setDeleting(false);
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);
  };

  return (
    <>
      <div className="flex flex-col items-center gap-4">
        <Avatar className="h-32 w-32">
          <AvatarImage src={currentAvatarUrl} alt={userName} />
          <AvatarFallback className="text-3xl bg-gradient-to-br from-primary to-secondary text-white">
            {getInitials(userName)}
          </AvatarFallback>
        </Avatar>
        
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={uploading || deleting}
            onClick={() => document.getElementById('avatar-upload')?.click()}
          >
            {uploading ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Camera className="h-4 w-4 mr-2" />
            )}
            {currentAvatarUrl ? 'Alterar foto' : 'Adicionar foto'}
          </Button>
          
          {currentAvatarUrl && (
            <Button
              variant="destructive"
              size="sm"
              disabled={uploading || deleting}
              onClick={deleteAvatar}
            >
              {deleting ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Trash2 className="h-4 w-4 mr-2" />
              )}
              Remover
            </Button>
          )}
        </div>

        <input
          id="avatar-upload"
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileSelect}
          disabled={uploading || deleting}
        />
      </div>

      <AvatarEditor
        imageUrl={imageToEdit}
        open={editorOpen}
        onSave={uploadAvatar}
        onCancel={() => {
          setEditorOpen(false);
          if (imageToEdit) {
            URL.revokeObjectURL(imageToEdit);
            setImageToEdit('');
          }
        }}
      />
    </>
  );
}
