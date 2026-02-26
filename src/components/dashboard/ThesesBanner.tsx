import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { BookOpen, ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useState } from 'react';

interface RecommendedThesis {
  number: number;
  title: string;
  group: string;
  relevance: string;
}

const GROUP_LABELS: Record<string, string> = {
  A: 'Poder e Governança',
  B: 'Dinâmica Política',
  C: 'Narrativa e Autenticidade',
  D: 'Cidadania Expandida',
  E: 'Complexidade e Ética',
};

const GROUP_COLORS: Record<string, string> = {
  A: 'bg-primary/15 text-primary border-primary/30',
  B: 'bg-accent/15 text-accent-foreground border-accent/30',
  C: 'bg-secondary/15 text-secondary-foreground border-secondary/30',
  D: 'bg-muted text-muted-foreground border-muted-foreground/20',
  E: 'bg-primary/10 text-primary border-primary/20',
};

export function ThesesBanner() {
  const { user } = useAuth();
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  const { data: theses } = useQuery({
    queryKey: ['recommended-theses', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('profiles')
        .select('recommended_theses')
        .eq('id', user!.id)
        .single();
      return (data?.recommended_theses as unknown as RecommendedThesis[]) || [];
    },
    enabled: !!user?.id,
    staleTime: Infinity,
  });

  if (!theses || theses.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="rounded-md border border-border/40 shadow-md bg-card overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center gap-2.5 px-4 py-3 border-b border-border/30 bg-muted/30">
        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
          <BookOpen className="w-4 h-4 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-foreground leading-tight">
            Suas 5 Teses Fundamentais
          </h3>
          <p className="text-[11px] text-muted-foreground">
            Baseadas no livro <em>"A Próxima Democracia"</em> e no seu perfil
          </p>
        </div>
      </div>

      {/* Theses horizontal scroll */}
      <div className="flex gap-3 p-4 overflow-x-auto scrollbar-thin">
        {theses.map((thesis, i) => {
          const isExpanded = expandedIndex === i;
          return (
            <motion.button
              key={thesis.number}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.08 }}
              onClick={() => setExpandedIndex(isExpanded ? null : i)}
              className={`relative flex-shrink-0 text-left rounded-lg border p-3.5 transition-all duration-200 cursor-pointer hover:shadow-lg
                ${isExpanded
                  ? 'w-72 sm:w-80 border-primary/40 shadow-xl bg-primary/5'
                  : 'w-52 sm:w-56 border-border/50 hover:border-primary/30 bg-card shadow-md'
                }`}
            >
              <div className="flex items-start gap-2.5">
                <span className="shrink-0 w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">
                  {thesis.number}
                </span>
                <div className="flex-1 min-w-0">
                  <h4 className="text-xs font-semibold text-foreground leading-snug line-clamp-2">
                    {thesis.title}
                  </h4>
                  <Badge
                    variant="outline"
                    className={`mt-1.5 text-[10px] px-1.5 py-0 ${GROUP_COLORS[thesis.group] || ''}`}
                  >
                    {GROUP_LABELS[thesis.group] || `Grupo ${thesis.group}`}
                  </Badge>
                </div>
                <ChevronRight
                  className={`w-4 h-4 text-muted-foreground shrink-0 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                />
              </div>

              {/* Expanded relevance */}
              {isExpanded && (
                <motion.p
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="text-[11px] text-muted-foreground leading-relaxed mt-3 pl-9"
                >
                  {thesis.relevance}
                </motion.p>
              )}
            </motion.button>
          );
        })}
      </div>
    </motion.div>
  );
}
