import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { AnimatePresence } from "framer-motion";
import { User, Building2, MapPin, Target, Share2, ArrowRight, Sparkles, Briefcase, Mic, ShieldAlert, FileText, BookOpen, ChevronRight } from "lucide-react";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useState } from "react";

interface RecommendedThesis {
  number: number;
  title: string;
  group: string;
  relevance: string;
}

const EXPERIENCE_LABELS: Record<string, string> = {
  pre_candidato: "Pré-candidato(a)",
  primeiro_mandato: "Primeiro mandato",
  reeleicao: "Reeleição",
  assessor: "Assessor(a)",
};

const LEVEL_LABELS: Record<string, string> = {
  municipal: "Municipal",
  estadual: "Estadual",
  federal: "Federal",
};

const MANDATE_LABELS: Record<string, string> = {
  mandato: "Mandato",
  pre_campanha: "Pré-campanha",
  campanha: "Campanha",
};

const GROUP_LABELS: Record<string, string> = {
  A: "Poder e Governança",
  B: "Dinâmica Política",
  C: "Narrativa e Autenticidade",
  D: "Cidadania Expandida",
  E: "Complexidade e Ética",
};

const GROUP_COLORS: Record<string, string> = {
  A: "bg-primary/15 text-primary border-primary/30",
  B: "bg-accent/15 text-accent-foreground border-accent/30",
  C: "bg-secondary/15 text-secondary-foreground border-secondary/30",
  D: "bg-muted text-muted-foreground border-muted-foreground/20",
  E: "bg-primary/10 text-primary border-primary/20",
};

interface PoliticalProfileBannerProps {
  onEdit?: () => void;
}

export const PoliticalProfileBanner = ({ onEdit }: PoliticalProfileBannerProps) => {
  const { user } = useAuth();
  const [expandedThesis, setExpandedThesis] = useState<number | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  const { data: profile, isLoading } = useQuery({
    queryKey: ["political-profile-banner-full", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data } = await supabase
        .from("profiles")
        .select(
          "political_role, political_party, political_level, political_experience, focus_areas, main_social_networks, state, city, target_audience_description, mandate_stage, biography, tone_of_voice, red_lines, evidence_history, recommended_theses"
        )
        .eq("id", user.id)
        .single();
      return data;
    },
    enabled: !!user?.id,
    staleTime: 1000 * 60 * 10,
  });

  if (isLoading || !profile) return null;

  const hasOnboarding = !!profile.political_role;

  if (!hasOnboarding) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <Card className="border-dashed border-2 border-primary/30 bg-primary/5">
          <CardContent className="p-5 flex flex-col sm:flex-row items-center gap-4">
            <div className="bg-primary/10 rounded-xl p-3 shrink-0">
              <Sparkles className="h-7 w-7 text-primary" />
            </div>
            <div className="flex-1 text-center sm:text-left">
              <h3 className="font-semibold text-foreground text-base">
                Complete seu perfil político
              </h3>
              <p className="text-sm text-muted-foreground mt-0.5">
                Preencha suas informações para personalizar a experiência e gerar conteúdos mais relevantes.
              </p>
            </div>
            <Button className="shrink-0" onClick={onEdit}>
              Preencher agora
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      </motion.div>
    );
  }

  const location = [profile.city, profile.state].filter(Boolean).join(", ");
  const theses = (profile.recommended_theses as unknown as RecommendedThesis[]) || [];

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-0"
    >
      <Card className="border border-border/40 shadow-sm">
        <CardContent className="p-5 space-y-4">
          {/* Header */}
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-primary" />
            <h3 className="font-semibold text-sm text-foreground">Seu Perfil Político</h3>
            <button
              onClick={onEdit}
              className="ml-auto text-xs text-primary hover:underline flex items-center gap-1"
            >
              Editar <ArrowRight className="h-3 w-3" />
            </button>
          </div>

          {/* Row 1: Basic info grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Cargo + Partido */}
            <div className="flex items-start gap-2.5">
              <Building2 className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">Cargo</p>
                <p className="text-sm font-medium text-foreground truncate">
                  {profile.political_role}
                </p>
                {profile.political_party && (
                  <Badge variant="secondary" className="mt-1 text-xs">
                    {profile.political_party}
                  </Badge>
                )}
              </div>
            </div>

            {/* Nível + Experiência */}
            <div className="flex items-start gap-2.5">
              <Target className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">Nível / Experiência</p>
                <p className="text-sm font-medium text-foreground">
                  {LEVEL_LABELS[profile.political_level || ""] || profile.political_level || "—"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {EXPERIENCE_LABELS[profile.political_experience || ""] || profile.political_experience || "—"}
                </p>
              </div>
            </div>

            {/* Localização */}
            {location && (
              <div className="flex items-start gap-2.5">
                <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">Localização</p>
                  <p className="text-sm font-medium text-foreground truncate">{location}</p>
                </div>
              </div>
            )}

            {/* Fase atual */}
            {profile.mandate_stage && (
              <div className="flex items-start gap-2.5">
                <Briefcase className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">Fase atual</p>
                  <p className="text-sm font-medium text-foreground">
                    {MANDATE_LABELS[profile.mandate_stage] || profile.mandate_stage}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Redes Sociais */}
          {profile.main_social_networks && profile.main_social_networks.length > 0 && (
            <div className="flex items-start gap-2.5">
              <Share2 className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground mb-1">Redes sociais</p>
                <div className="flex flex-wrap gap-1">
                  {profile.main_social_networks.map((net) => (
                    <Badge key={net} variant="outline" className="text-xs capitalize">
                      {net}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Áreas de foco */}
          {profile.focus_areas && profile.focus_areas.length > 0 && (
            <div className="pt-2 border-t border-border/40">
              <p className="text-xs text-muted-foreground mb-1.5">Áreas de foco</p>
              <div className="flex flex-wrap gap-1.5">
                {profile.focus_areas.map((area) => (
                  <Badge key={area} className="text-xs bg-primary/10 text-primary border-primary/20 hover:bg-primary/20">
                    {area}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Detailed profile toggle */}
          {(profile.biography || profile.tone_of_voice || profile.red_lines || profile.evidence_history) && (
            <div className="pt-2 border-t border-border/40">
              <button
                onClick={() => setShowDetails(!showDetails)}
                className="flex items-center gap-1.5 text-xs text-primary hover:underline transition-colors"
              >
                <ChevronRight className={`h-3.5 w-3.5 transition-transform ${showDetails ? 'rotate-90' : ''}`} />
                {showDetails ? 'Ocultar detalhes' : 'Ver detalhes do perfil'}
              </button>

              <AnimatePresence>
                {showDetails && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="space-y-3 pt-3">
                      {profile.biography && (
                        <div className="flex items-start gap-2.5">
                          <User className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                          <div className="min-w-0">
                            <p className="text-xs text-muted-foreground">Biografia e trajetória</p>
                            <p className="text-sm text-foreground leading-relaxed mt-0.5">{profile.biography}</p>
                          </div>
                        </div>
                      )}
                      {profile.tone_of_voice && (
                        <div className="flex items-start gap-2.5">
                          <Mic className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                          <div className="min-w-0">
                            <p className="text-xs text-muted-foreground">Tom de voz</p>
                            <Badge variant="secondary" className="mt-0.5 text-xs">{profile.tone_of_voice}</Badge>
                          </div>
                        </div>
                      )}
                      {profile.red_lines && (
                        <div className="flex items-start gap-2.5">
                          <ShieldAlert className="h-4 w-4 text-destructive/70 mt-0.5 shrink-0" />
                          <div className="min-w-0">
                            <p className="text-xs text-muted-foreground">Temas sensíveis</p>
                            <p className="text-sm text-foreground leading-relaxed mt-0.5">{profile.red_lines}</p>
                          </div>
                        </div>
                      )}
                      {profile.evidence_history && (
                        <div className="flex items-start gap-2.5">
                          <FileText className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                          <div className="min-w-0">
                            <p className="text-xs text-muted-foreground">Evidências e histórico</p>
                            <p className="text-sm text-foreground leading-relaxed mt-0.5">{profile.evidence_history}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          {/* Theses section */}
          {theses.length > 0 && (
            <div className="pt-2 border-t border-border/40">
              <div className="flex items-center gap-2 mb-3">
                <BookOpen className="h-4 w-4 text-primary" />
                <p className="text-xs font-semibold text-foreground">Suas 5 Teses Fundamentais</p>
                <span className="text-[10px] text-muted-foreground ml-1">— "A Próxima Democracia"</span>
              </div>
              <div className="flex gap-2.5 overflow-x-auto pb-1 scrollbar-thin">
                {theses.map((thesis, i) => {
                  const isExpanded = expandedThesis === i;
                  return (
                    <motion.button
                      key={thesis.number}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: i * 0.06 }}
                      onClick={() => setExpandedThesis(isExpanded ? null : i)}
                      className={`relative flex-shrink-0 text-left rounded-lg border p-3 transition-all duration-200 cursor-pointer hover:shadow-md
                        ${isExpanded
                          ? "w-72 sm:w-80 border-primary/40 shadow-lg bg-primary/5"
                          : "w-48 sm:w-52 border-border/50 hover:border-primary/30 bg-card shadow-sm"
                        }`}
                    >
                      <div className="flex items-start gap-2">
                        <span className="shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-[10px] font-bold">
                          {thesis.number}
                        </span>
                        <div className="flex-1 min-w-0">
                          <h4 className="text-[11px] font-semibold text-foreground leading-snug line-clamp-2">
                            {thesis.title}
                          </h4>
                          <Badge
                            variant="outline"
                            className={`mt-1 text-[9px] px-1.5 py-0 ${GROUP_COLORS[thesis.group] || ""}`}
                          >
                            {GROUP_LABELS[thesis.group] || `Grupo ${thesis.group}`}
                          </Badge>
                        </div>
                        <ChevronRight
                          className={`w-3.5 h-3.5 text-muted-foreground shrink-0 transition-transform ${isExpanded ? "rotate-90" : ""}`}
                        />
                      </div>
                      {isExpanded && (
                        <motion.p
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          className="text-[10px] text-muted-foreground leading-relaxed mt-2 pl-8"
                        >
                          {thesis.relevance}
                        </motion.p>
                      )}
                    </motion.button>
                  );
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
};
