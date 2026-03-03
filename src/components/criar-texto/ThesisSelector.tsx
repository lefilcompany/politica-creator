import { useState } from "react";
import { THESIS_GROUPS, type Thesis } from "@/lib/theses";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { cn } from "@/lib/utils";
import { BookOpen, Star } from "lucide-react";

interface ThesisSelectorProps {
  selectedThesisId: string;
  onSelect: (thesisId: string) => void;
  recommendedThesesIds?: string[];
}

export function ThesisSelector({ selectedThesisId, onSelect, recommendedThesesIds = [] }: ThesisSelectorProps) {
  const handleClick = (thesis: Thesis) => {
    onSelect(selectedThesisId === thesis.id ? "" : thesis.id);
  };

  return (
    <div className="space-y-2">
      <label className="text-base font-semibold text-foreground flex items-center gap-2">
        <BookOpen className="h-5 w-5" />
        Escolha a bandeira do seu post (opcional)
      </label>
      <p className="text-sm text-muted-foreground">
        Selecione uma tese do livro "A Próxima Democracia" para fundamentar seus textos
      </p>

      <Accordion type="single" collapsible className="w-full">
        {THESIS_GROUPS.map((group) => (
          <AccordionItem key={group.id} value={group.id}>
            <AccordionTrigger className="text-sm font-medium hover:no-underline">
              <span>
                <span className="font-bold text-primary">Grupo {group.id}</span>
                <span className="text-muted-foreground"> — {group.label}</span>
              </span>
            </AccordionTrigger>
            <AccordionContent>
              <div className="grid gap-2 pt-1">
                {group.theses.map((thesis) => {
                  const isSelected = selectedThesisId === thesis.id;
                  const isRecommended = recommendedThesesIds.includes(thesis.id);

                  return (
                    <button
                      key={thesis.id}
                      type="button"
                      onClick={() => handleClick(thesis)}
                      className={cn(
                        "w-full text-left rounded-xl border p-3 transition-all duration-200",
                        "hover:shadow-sm hover:border-primary/40",
                        isSelected
                          ? "border-primary bg-primary/5 shadow-sm ring-1 ring-primary/30"
                          : "border-border bg-card"
                      )}
                    >
                      <div className="flex items-start gap-2">
                        <span className="text-xs font-bold text-primary bg-primary/10 rounded-md px-1.5 py-0.5 mt-0.5 shrink-0">
                          {thesis.number}
                        </span>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm font-semibold text-foreground">{thesis.title}</span>
                            {isRecommended && (
                              <Star className="h-3.5 w-3.5 text-amber-500 fill-amber-500 shrink-0" />
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                            {thesis.shortDescription}
                          </p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>

      {selectedThesisId && (
        <p className="text-xs text-primary font-medium">
          ✅ Tese selecionada — todos os 10 textos serão fundamentados nessa bandeira
        </p>
      )}
    </div>
  );
}
