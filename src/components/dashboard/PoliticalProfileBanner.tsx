import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { User, Building2, MapPin, Target, Share2, ArrowRight, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface PoliticalProfile {
  political_role: string | null;
  political_party: string | null;
  political_level: string | null;
  political_experience: string | null;
  focus_areas: string[] | null;
  main_social_networks: string[] | null;
  state: string | null;
  city: string | null;
  target_audience_description: string | null;
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

export const PoliticalProfileBanner = () => {
  const { user } = useAuth();

  const { data: profile, isLoading } = useQuery({
    queryKey: ["political-profile-banner", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data } = await supabase
        .from("profiles")
        .select(
          "political_role, political_party, political_level, political_experience, focus_areas, main_social_networks, state, city, target_audience_description, tutorial_completed"
        )
        .eq("id", user.id)
        .single();
      return data as (PoliticalProfile & { tutorial_completed: boolean | null }) | null;
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
            <Button asChild className="shrink-0">
              <Link to="/onboarding">
                Preencher agora
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </motion.div>
    );
  }

  const location = [profile.city, profile.state].filter(Boolean).join(", ");

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <Card className="border border-border/40 shadow-sm">
        <CardContent className="p-5">
          <div className="flex items-center gap-2 mb-3">
            <User className="h-4 w-4 text-primary" />
            <h3 className="font-semibold text-sm text-foreground">Seu Perfil Político</h3>
            <Link
              to="/onboarding"
              className="ml-auto text-xs text-primary hover:underline flex items-center gap-1"
            >
              Editar <ArrowRight className="h-3 w-3" />
            </Link>
          </div>

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

            {/* Redes Sociais */}
            {profile.main_social_networks && profile.main_social_networks.length > 0 && (
              <div className="flex items-start gap-2.5">
                <Share2 className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">Redes sociais</p>
                  <div className="flex flex-wrap gap-1 mt-0.5">
                    {profile.main_social_networks.slice(0, 4).map((net) => (
                      <Badge key={net} variant="outline" className="text-xs capitalize">
                        {net}
                      </Badge>
                    ))}
                    {profile.main_social_networks.length > 4 && (
                      <Badge variant="outline" className="text-xs">
                        +{profile.main_social_networks.length - 4}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Áreas de foco */}
          {profile.focus_areas && profile.focus_areas.length > 0 && (
            <div className="mt-3 pt-3 border-t border-border/40">
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
        </CardContent>
      </Card>
    </motion.div>
  );
};
