import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "./ui/alert-dialog";
import { Button } from "./ui/button";
import { AlertTriangle } from "lucide-react";

interface FreeLimitBlockerProps {
  isOpen: boolean;
  onClose: () => void;
  imageCount: number;
  maxImages: number;
}

export function FreeLimitBlocker({ isOpen, onClose, imageCount, maxImages }: FreeLimitBlockerProps) {
  return (
    <AlertDialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-full bg-destructive/10">
              <AlertTriangle className="h-6 w-6 text-destructive" />
            </div>
            <AlertDialogTitle className="text-xl">
              Teste grátis encerrado
            </AlertDialogTitle>
          </div>
          <AlertDialogDescription asChild>
            <div className="space-y-4">
              <p className="text-base">
                Você atingiu o limite de <span className="font-bold text-foreground">{maxImages} imagens</span> do
                seu teste grátis ({imageCount}/{maxImages} criadas).
              </p>
              <div className="p-4 rounded-lg bg-muted border">
                <p className="text-sm text-muted-foreground">
                  Para continuar criando conteúdo, entre em contato com nossa equipe para
                  conhecer os planos disponíveis.
                </p>
              </div>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <Button variant="outline" onClick={onClose}>
            Entendi
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
