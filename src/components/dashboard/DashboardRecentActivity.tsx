import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Link, useNavigate } from "react-router-dom";
import { Archive, FileText, ArrowRight, ChevronLeft, ChevronRight, FileText as FileIcon, CheckCircle, CalendarDays, Video } from "lucide-react";
import { useState, useCallback, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import useEmblaCarousel from "embla-carousel-react";

interface ActionSummary {
  id: string;
  type: string;
  created_at: string;
  approved: boolean;
  brand_id: string | null;
  brand_name: string | null;
  image_url: string | null;
  thumb_path: string | null;
  title: string | null;
  platform: string | null;
  objective: string | null;
  total_count: number;
}

interface DashboardRecentActivityProps {
  activities: ActionSummary[];
  isLoading?: boolean;
}

const formatActionType = (type: string) => {
  const types: Record<string, string> = {
    'PLANEJAR_CONTEUDO': 'Planejar Campanha',
    'CRIAR_CONTEUDO': 'Redigir Discurso',
    'CRIAR_CONTEUDO_RAPIDO': 'Nota Rápida',
    'REVISAR_CONTEUDO': 'Revisar Material',
    'GERAR_VIDEO': 'Propaganda',
  };
  return types[type] || type;
};

const formatRelativeDate = (dateString: string) => {
  const now = new Date();
  const date = new Date(dateString);
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "agora";
  if (diffMin < 60) return `${diffMin}min`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d`;
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
};

const actionConfig: Record<string, { icon: typeof FileIcon; color: string; gradient: string }> = {
  'CRIAR_CONTEUDO': { icon: FileIcon, color: 'text-primary', gradient: 'from-primary/12 to-primary/4' },
  'CRIAR_CONTEUDO_RAPIDO': { icon: FileIcon, color: 'text-primary', gradient: 'from-primary/12 to-primary/4' },
  'REVISAR_CONTEUDO': { icon: CheckCircle, color: 'text-success', gradient: 'from-success/12 to-success/4' },
  'PLANEJAR_CONTEUDO': { icon: CalendarDays, color: 'text-accent', gradient: 'from-accent/12 to-accent/4' },
  'GERAR_VIDEO': { icon: Video, color: 'text-secondary', gradient: 'from-secondary/12 to-secondary/4' },
};

const getImageUrl = (activity: ActionSummary): string | null => {
  if (activity.thumb_path) {
    const { data } = supabase.storage.from('creations').getPublicUrl(activity.thumb_path);
    return data?.publicUrl || null;
  }
  if (activity.image_url && (activity.image_url.startsWith('http') || activity.image_url.startsWith('data:'))) {
    return activity.image_url;
  }
  return null;
};

const ActivitySkeleton = () => (
  <div className="flex gap-3 overflow-hidden pb-1">
    {[...Array(4)].map((_, i) => (
      <div key={i} className="shrink-0 w-[200px] sm:w-[220px]">
        <div className="rounded-md border border-border/30 overflow-hidden bg-card">
          <Skeleton className="h-28 w-full rounded-none" />
          <div className="p-3 space-y-2">
            <Skeleton className="h-3.5 w-24" />
            <Skeleton className="h-3 w-16" />
          </div>
        </div>
      </div>
    ))}
  </div>
);

export const DashboardRecentActivity = ({ activities, isLoading }: DashboardRecentActivityProps) => {
  const navigate = useNavigate();
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);
  const clickAllowed = useRef(true);

  const [emblaRef, emblaApi] = useEmblaCarousel({
    dragFree: true,
    containScroll: 'trimSnaps',
    align: 'start',
  });

  const updateScrollState = useCallback(() => {
    if (!emblaApi) return;
    setCanScrollLeft(emblaApi.canScrollPrev());
    setCanScrollRight(emblaApi.canScrollNext());
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;

    const onSelect = () => updateScrollState();
    const onPointerDown = () => { clickAllowed.current = true; };
    const onPointerUp = () => {
      const engine = emblaApi.internalEngine();
      const hasVelocity = Math.abs(engine.scrollBody.velocity()) > 0.5;
      if (hasVelocity) clickAllowed.current = false;
    };

    emblaApi.on('select', onSelect);
    emblaApi.on('reInit', onSelect);
    emblaApi.on('pointerDown', onPointerDown);
    emblaApi.on('pointerUp', onPointerUp);
    onSelect();

    return () => {
      emblaApi.off('select', onSelect);
      emblaApi.off('reInit', onSelect);
      emblaApi.off('pointerDown', onPointerDown);
      emblaApi.off('pointerUp', onPointerUp);
    };
  }, [emblaApi, updateScrollState]);

  const scroll = (dir: 'left' | 'right') => {
    if (!emblaApi) return;
    if (dir === 'left') emblaApi.scrollPrev();
    else emblaApi.scrollNext();
  };

  const handleCardClick = (activityId: string) => {
    if (clickAllowed.current) {
      navigate(`/action/${activityId}`);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.3 }}
    >
      <Card className="border border-border/40 shadow-sm overflow-hidden">
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-md bg-muted/80">
              <Archive className="h-4 w-4 text-muted-foreground" />
            </div>
            <CardTitle className="text-base font-semibold">Arquivo Recente</CardTitle>
          </div>
          <div className="flex items-center gap-1">
            {activities.length > 0 && (
              <>
                <Button variant="ghost" size="icon" className="h-7 w-7 hidden sm:flex" onClick={() => scroll('left')} disabled={!canScrollLeft}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7 hidden sm:flex" onClick={() => scroll('right')} disabled={!canScrollRight}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </>
            )}
            <Link to="/history">
              <Button variant="ghost" size="sm" className="text-xs text-muted-foreground hover:text-primary gap-1">
                Ver arquivo <ArrowRight className="h-3 w-3" />
              </Button>
            </Link>
          </div>
        </CardHeader>

        <CardContent className="px-4 pb-4 pt-2">
          {isLoading ? (
            <ActivitySkeleton />
          ) : activities.length > 0 ? (
            <div ref={emblaRef} className="overflow-hidden cursor-grab active:cursor-grabbing">
              <div className="flex gap-3">
                {activities.map((activity, index) => {
                  const config = actionConfig[activity.type] || actionConfig['CRIAR_CONTEUDO'];
                  const Icon = config.icon;
                  const imageUrl = getImageUrl(activity);

                  return (
                    <motion.div
                      key={activity.id}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.1 + index * 0.06 }}
                      className="shrink-0 w-[200px] sm:w-[220px] min-w-0"
                    >
                      <div
                        onClick={() => handleCardClick(activity.id)}
                        className="cursor-pointer rounded-md border border-border/30 shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden bg-card group h-full"
                      >
                        <div className={`relative h-28 bg-gradient-to-br ${config.gradient} flex items-center justify-center overflow-hidden`}>
                          {imageUrl ? (
                            <img
                              src={imageUrl}
                              alt=""
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 pointer-events-none"
                              loading="lazy"
                              draggable={false}
                            />
                          ) : (
                            <Icon className={`h-8 w-8 ${config.color} opacity-40`} />
                          )}
                          <span className="absolute top-2 right-2 text-[10px] font-medium bg-foreground/60 text-background px-1.5 py-0.5 rounded-sm backdrop-blur-sm">
                            {formatRelativeDate(activity.created_at)}
                          </span>
                        </div>

                        <div className="p-3">
                          <div className="flex items-center gap-1.5 mb-1">
                            <Icon className={`h-3.5 w-3.5 ${config.color} shrink-0`} />
                            <span className="text-xs font-semibold text-foreground truncate">
                              {formatActionType(activity.type)}
                            </span>
                          </div>
                          <p className="text-[11px] text-muted-foreground truncate">
                            {activity.brand_name || 'Sem partido'}
                          </p>
                          {activity.title && (
                            <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                              {activity.title}
                            </p>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="py-8 text-center">
              <div className="w-12 h-12 rounded-md bg-muted/50 flex items-center justify-center mx-auto mb-3">
                <FileText className="h-5 w-5 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium text-muted-foreground">Nenhum documento arquivado</p>
              <p className="text-xs text-muted-foreground mt-1">Comece redigindo seu primeiro discurso!</p>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
};
