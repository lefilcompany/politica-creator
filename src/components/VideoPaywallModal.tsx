import { useState } from "react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Video, Loader2, CreditCard, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface VideoPaywallModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function VideoPaywallModal({ isOpen, onClose }: VideoPaywallModalProps) {
  const [loading, setLoading] = useState(false);

  const handlePay = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-checkout", {
        body: {
          type: "video",
          return_url: "/create/video",
        },
      });

      if (error) throw error;
      if (data?.url) {
        window.location.href = data.url;
      } else {
        throw new Error("URL de pagamento não retornada");
      }
    } catch (err: any) {
      console.error("Erro ao criar checkout:", err);
      toast.error("Erro ao iniciar pagamento. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AlertDialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 rounded-full bg-secondary/10 flex items-center justify-center">
              <Video className="h-8 w-8 text-secondary" />
            </div>
          </div>
          <AlertDialogTitle className="text-center text-xl">
            Geração de Vídeo com IA
          </AlertDialogTitle>
          <AlertDialogDescription className="text-center space-y-3">
            <p>
              No plano teste, cada geração de vídeo custa{" "}
              <span className="font-bold text-foreground">R$ 30,00</span>.
            </p>
            <div className="bg-secondary/5 border border-secondary/20 rounded-xl p-4 space-y-2 text-left">
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <Sparkles className="h-4 w-4 text-secondary" />
                O que está incluso:
              </div>
              <ul className="text-sm space-y-1 text-muted-foreground">
                <li>• Vídeo gerado por IA de alta qualidade</li>
                <li>• Até 8 segundos de duração</li>
                <li>• Resolução HD (720p ou 1080p)</li>
                <li>• Download imediato após geração</li>
              </ul>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-col gap-2 sm:flex-col">
          <Button
            onClick={handlePay}
            disabled={loading}
            className="w-full bg-gradient-to-r from-secondary to-primary text-primary-foreground gap-2"
            size="lg"
          >
            {loading ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                Redirecionando...
              </>
            ) : (
              <>
                <CreditCard className="h-5 w-5" />
                Pagar R$ 30,00 e gerar vídeo
              </>
            )}
          </Button>
          <AlertDialogCancel className="w-full mt-0">Cancelar</AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
