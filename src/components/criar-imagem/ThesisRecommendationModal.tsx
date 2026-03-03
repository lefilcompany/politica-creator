import { ALL_THESES, type Thesis } from "@/lib/theses";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { BookOpen, Star, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface ThesisRecommendationModalProps {
  open: boolean;
  onClose: () => void;
  onSelectThesis: (thesis: Thesis) => void;
  onContinueWithout: () => void;
  recommendedThesesIds?: string[];
  description?: string;
}

export function ThesisRecommendationModal({
  open,
  onClose,
  onSelectThesis,
  onContinueWithout,
  recommendedThesesIds = [],
  description = "",
}: ThesisRecommendationModalProps) {
  // Pick 3 theses: prefer recommended ones, fallback to contextually relevant
  const theses = getRecommendedTheses(recommendedThesesIds, description);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <BookOpen className="h-5 w-5 text-primary" />
            Fundamente sua imagem
          </DialogTitle>
          <DialogDescription>
            Escolha uma bandeira do livro "A Próxima Democracia" para dar peso estratégico à sua imagem
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 mt-2">
          {theses.map((thesis) => {
            const isRecommended = recommendedThesesIds.includes(thesis.id);
            return (
              <button
                key={thesis.id}
                type="button"
                onClick={() => onSelectThesis(thesis)}
                className={cn(
                  "w-full text-left rounded-xl border p-4 transition-all duration-200",
                  "hover:shadow-md hover:border-primary/50 hover:bg-primary/5",
                  "border-border bg-card"
                )}
              >
                <div className="flex items-start gap-3">
                  <span className="text-xs font-bold text-primary-foreground bg-primary rounded-lg px-2 py-1 mt-0.5 shrink-0">
                    {thesis.number}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-semibold text-foreground">{thesis.title}</span>
                      {isRecommended && (
                        <Star className="h-3.5 w-3.5 text-amber-500 fill-amber-500 shrink-0" />
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                      {thesis.shortDescription}
                    </p>
                    <span className="text-[10px] text-muted-foreground/70 mt-1 block">
                      Grupo {thesis.group} — {thesis.groupLabel}
                    </span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        <Button
          variant="ghost"
          className="w-full mt-2 text-muted-foreground hover:text-foreground"
          onClick={onContinueWithout}
        >
          Continuar sem bandeira
          <ArrowRight className="h-4 w-4 ml-2" />
        </Button>
      </DialogContent>
    </Dialog>
  );
}

function getRecommendedTheses(recommendedIds: string[], description: string): Thesis[] {
  // If we have recommended theses from onboarding, use top 3
  if (recommendedIds.length >= 3) {
    return recommendedIds
      .slice(0, 3)
      .map((id) => ALL_THESES.find((t) => t.id === id))
      .filter(Boolean) as Thesis[];
  }

  // Fallback: pick 3 diverse theses from different groups
  const groups = ["A", "C", "D"];
  const picks: Thesis[] = [];
  for (const g of groups) {
    const fromGroup = ALL_THESES.filter((t) => t.group === g);
    if (fromGroup.length > 0) {
      picks.push(fromGroup[Math.floor(Math.random() * fromGroup.length)]);
    }
  }
  return picks.length >= 3 ? picks.slice(0, 3) : ALL_THESES.slice(0, 3);
}
