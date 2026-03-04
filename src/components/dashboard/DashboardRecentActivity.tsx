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
    'GERAR_VIDEO': 'Propaganda'
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

const actionConfig: Record<string, {icon: typeof FileIcon;color: string;gradient: string;}> = {
  'CRIAR_CONTEUDO': { icon: FileIcon, color: 'text-primary', gradient: 'from-primary/12 to-primary/4' },
  'CRIAR_CONTEUDO_RAPIDO': { icon: FileIcon, color: 'text-primary', gradient: 'from-primary/12 to-primary/4' },
  'REVISAR_CONTEUDO': { icon: CheckCircle, color: 'text-success', gradient: 'from-success/12 to-success/4' },
  'PLANEJAR_CONTEUDO': { icon: CalendarDays, color: 'text-accent', gradient: 'from-accent/12 to-accent/4' },
  'GERAR_VIDEO': { icon: Video, color: 'text-secondary', gradient: 'from-secondary/12 to-secondary/4' }
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

const ActivitySkeleton = () =>
<div className="flex gap-3 overflow-hidden pb-1">
    {[...Array(4)].map((_, i) =>
  <div key={i} className="shrink-0 w-[200px] sm:w-[220px]">
        <div className="rounded-md border border-border/30 overflow-hidden bg-card">
          <Skeleton className="h-28 w-full rounded-none" />
          <div className="p-3 space-y-2">
            <Skeleton className="h-3.5 w-24" />
            <Skeleton className="h-3 w-16" />
          </div>
        </div>
      </div>
  )}
  </div>;


export const DashboardRecentActivity = ({ activities, isLoading }: DashboardRecentActivityProps) => {
  const navigate = useNavigate();
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);
  const clickAllowed = useRef(true);

  const [emblaRef, emblaApi] = useEmblaCarousel({
    dragFree: true,
    containScroll: 'trimSnaps',
    align: 'start'
  });

  const updateScrollState = useCallback(() => {
    if (!emblaApi) return;
    setCanScrollLeft(emblaApi.canScrollPrev());
    setCanScrollRight(emblaApi.canScrollNext());
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;

    const onSelect = () => updateScrollState();
    const onPointerDown = () => {clickAllowed.current = true;};
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
    if (dir === 'left') emblaApi.scrollPrev();else
    emblaApi.scrollNext();
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
      transition={{ duration: 0.4, delay: 0.3 }}>
      
      


































































































      
    </motion.div>);

};