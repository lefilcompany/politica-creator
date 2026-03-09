'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import {
  CalendarDays, Plus, ChevronLeft, ChevronRight, HelpCircle, Loader2, Save, Trash2, Clock, FileText, BookOpen, Sparkles, X
} from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { PageBreadcrumb } from '@/components/PageBreadcrumb';
import ThemeDialog from '@/components/temas/ThemeDialog';
import themesBanner from '@/assets/themes-banner.jpg';
import type { StrategicTheme } from '@/types/theme';
import type { BrandSummary } from '@/types/brand';
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  addMonths,
  subMonths,
  isToday,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';

// Types
interface AgendaEvent {
  id: string;
  title: string;
  description: string | null;
  event_date: string;
  event_time: string | null;
  event_type: string;
  color: string | null;
  brand_id: string | null;
  created_at: string;
}

interface CalendarItem {
  id: string;
  title: string;
  type: 'event' | 'theme' | 'action';
  color: string;
  date: Date;
  data: any;
}

type ThemeFormData = Omit<StrategicTheme, 'id' | 'createdAt' | 'updatedAt' | 'teamId' | 'userId'>;

const TYPE_COLORS: Record<string, string> = {
  event: 'hsl(var(--primary))',
  theme: 'hsl(var(--secondary))',
  action: 'hsl(var(--accent))',
};

const TYPE_LABELS: Record<string, string> = {
  event: 'Evento',
  theme: 'Agenda',
  action: 'Conteúdo',
};

// Weekday headers
const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

export default function AgendaPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [isEventDialogOpen, setIsEventDialogOpen] = useState(false);
  const [isThemeDialogOpen, setIsThemeDialogOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<AgendaEvent | null>(null);
  const [eventForm, setEventForm] = useState({ title: '', description: '', time: '' });

  // Computed date range for the calendar grid
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calendarStart = startOfWeek(monthStart, { locale: ptBR });
  const calendarEnd = endOfWeek(monthEnd, { locale: ptBR });
  const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  const monthKey = format(currentMonth, 'yyyy-MM');

  // Fetch agenda events for current month
  const { data: agendaEvents = [], isLoading: loadingEvents } = useQuery({
    queryKey: ['agenda-events', monthKey, user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const startDate = format(calendarStart, 'yyyy-MM-dd');
      const endDate = format(calendarEnd, 'yyyy-MM-dd');
      const { data, error } = await supabase
        .from('agenda_events')
        .select('*')
        .gte('event_date', startDate)
        .lte('event_date', endDate)
        .order('event_date');
      if (error) throw error;
      return (data || []) as AgendaEvent[];
    },
    enabled: !!user?.id,
  });

  // Fetch strategic themes
  const { data: themes = [] } = useQuery({
    queryKey: ['agenda-themes', monthKey, user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const startDate = format(calendarStart, 'yyyy-MM-dd');
      const endDate = format(calendarEnd, 'yyyy-MM-dd');
      const { data, error } = await supabase
        .from('strategic_themes')
        .select('id, title, created_at, brand_id')
        .gte('created_at', `${startDate}T00:00:00`)
        .lte('created_at', `${endDate}T23:59:59`)
        .order('created_at');
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id,
  });

  // Fetch actions/content created
  const { data: actions = [] } = useQuery({
    queryKey: ['agenda-actions', monthKey, user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const startDate = format(calendarStart, 'yyyy-MM-dd');
      const endDate = format(calendarEnd, 'yyyy-MM-dd');
      const { data, error } = await supabase
        .from('actions')
        .select('id, type, created_at, result')
        .gte('created_at', `${startDate}T00:00:00`)
        .lte('created_at', `${endDate}T23:59:59`)
        .order('created_at');
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id,
  });

  // Fetch brands for theme dialog
  const { data: brandSummaries = [] } = useQuery({
    queryKey: ['brands-for-agenda', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from('brands')
        .select('id, name, responsible, brand_color, avatar_url, created_at, updated_at')
        .order('name');
      if (error) throw error;
      return (data || []).map(b => ({
        id: b.id,
        name: b.name,
        responsible: b.responsible,
        brandColor: b.brand_color || null,
        avatarUrl: b.avatar_url || null,
        createdAt: b.created_at,
        updatedAt: b.updated_at,
      })) as BrandSummary[];
    },
    enabled: !!user?.id,
  });

  // Aggregate all items into calendar items
  const calendarItems = useMemo(() => {
    const items: CalendarItem[] = [];

    agendaEvents.forEach(ev => {
      items.push({
        id: ev.id,
        title: ev.title,
        type: 'event',
        color: ev.color || TYPE_COLORS.event,
        date: new Date(ev.event_date + 'T12:00:00'),
        data: ev,
      });
    });

    themes.forEach(th => {
      items.push({
        id: th.id,
        title: th.title,
        type: 'theme',
        color: TYPE_COLORS.theme,
        date: new Date(th.created_at),
        data: th,
      });
    });

    actions.forEach(ac => {
      const title = (ac.result as any)?.title || (ac.result as any)?.description || ac.type;
      items.push({
        id: ac.id,
        title: typeof title === 'string' ? title : ac.type,
        type: 'action',
        color: TYPE_COLORS.action,
        date: new Date(ac.created_at),
        data: ac,
      });
    });

    return items;
  }, [agendaEvents, themes, actions]);

  // Items grouped by date string
  const itemsByDate = useMemo(() => {
    const map: Record<string, CalendarItem[]> = {};
    calendarItems.forEach(item => {
      const key = format(item.date, 'yyyy-MM-dd');
      if (!map[key]) map[key] = [];
      map[key].push(item);
    });
    return map;
  }, [calendarItems]);

  // Items for selected date
  const selectedDateItems = useMemo(() => {
    if (!selectedDate) return [];
    return itemsByDate[format(selectedDate, 'yyyy-MM-dd')] || [];
  }, [selectedDate, itemsByDate]);

  // Create event mutation
  const createEvent = useMutation({
    mutationFn: async (data: { title: string; description: string; date: string; time: string }) => {
      if (!user?.id) throw new Error('Not authenticated');
      const { error } = await supabase.from('agenda_events').insert({
        user_id: user.id,
        team_id: user.teamId || null,
        title: data.title,
        description: data.description || null,
        event_date: data.date,
        event_time: data.time || null,
        event_type: 'custom',
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Evento criado!');
      queryClient.invalidateQueries({ queryKey: ['agenda-events'] });
      setIsEventDialogOpen(false);
      setEventForm({ title: '', description: '', time: '' });
    },
    onError: () => toast.error('Erro ao criar evento'),
  });

  // Update event mutation
  const updateEvent = useMutation({
    mutationFn: async (data: { id: string; title: string; description: string; time: string }) => {
      const { error } = await supabase.from('agenda_events').update({
        title: data.title,
        description: data.description || null,
        event_time: data.time || null,
      }).eq('id', data.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Evento atualizado!');
      queryClient.invalidateQueries({ queryKey: ['agenda-events'] });
      setIsEventDialogOpen(false);
      setEditingEvent(null);
      setEventForm({ title: '', description: '', time: '' });
    },
    onError: () => toast.error('Erro ao atualizar evento'),
  });

  // Delete event mutation
  const deleteEvent = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('agenda_events').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Evento removido!');
      queryClient.invalidateQueries({ queryKey: ['agenda-events'] });
    },
    onError: () => toast.error('Erro ao remover evento'),
  });

  const handleDayClick = (day: Date) => {
    setSelectedDate(day);
    const dayKey = format(day, 'yyyy-MM-dd');
    const dayItems = itemsByDate[dayKey] || [];
    if (dayItems.length === 0) {
      // No events → open create dialog
      setEditingEvent(null);
      setEventForm({ title: '', description: '', time: '' });
      setIsEventDialogOpen(true);
    }
    // If has items → just show panel (handled by selectedDate state)
  };

  const handleCreateEventForDate = () => {
    setEditingEvent(null);
    setEventForm({ title: '', description: '', time: '' });
    setIsEventDialogOpen(true);
  };

  const handleEditEvent = (event: AgendaEvent) => {
    setEditingEvent(event);
    setEventForm({
      title: event.title,
      description: event.description || '',
      time: event.event_time || '',
    });
    setIsEventDialogOpen(true);
  };

  const handleSaveEvent = () => {
    if (!eventForm.title.trim()) return toast.error('Informe o título do evento');
    if (!selectedDate) return;
    if (editingEvent) {
      updateEvent.mutate({ id: editingEvent.id, ...eventForm });
    } else {
      createEvent.mutate({ ...eventForm, date: format(selectedDate, 'yyyy-MM-dd') });
    }
  };

  const handleSaveTheme = useCallback(
    async (formData: ThemeFormData): Promise<StrategicTheme> => {
      if (!user?.id) throw new Error('Not authenticated');
      const { data, error } = await supabase
        .from('strategic_themes')
        .insert({
          team_id: user.teamId || null,
          user_id: user.id,
          brand_id: formData.brandId,
          title: formData.title,
          description: formData.description,
          target_audience: formData.targetAudience,
          tone_of_voice: formData.toneOfVoice,
          objectives: formData.objectives,
          color_palette: formData.colorPalette,
          hashtags: formData.hashtags,
          content_format: formData.contentFormat,
          macro_themes: formData.macroThemes,
          best_formats: formData.bestFormats,
          platforms: formData.platforms,
          expected_action: formData.expectedAction,
          additional_info: formData.additionalInfo,
          tags: formData.tags,
          subtags: formData.subtags as any,
          objective_type: formData.objectiveType,
          signals: formData.signals as any,
        })
        .select()
        .single();
      if (error) throw error;
      toast.success('Item da agenda criado!');
      queryClient.invalidateQueries({ queryKey: ['agenda-themes'] });
      setIsThemeDialogOpen(false);
      return {
        ...formData,
        id: data.id,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
        teamId: user.teamId || '',
        userId: user.id,
      };
    },
    [user, queryClient]
  );

  const handleItemClick = (item: CalendarItem) => {
    if (item.type === 'theme') {
      navigate(`/themes/${item.id}`);
    } else if (item.type === 'action') {
      navigate(`/action/${item.id}`);
    } else if (item.type === 'event') {
      handleEditEvent(item.data);
    }
  };

  const isLoading = loadingEvents;

  return (
    <div className="flex flex-col -m-4 sm:-m-6 lg:-m-8">
      {/* Header */}
      <div className="px-4 sm:px-6 lg:px-8 pt-6 pb-4">
        <PageBreadcrumb items={[{ label: 'Agenda' }]} />
        
        <div className="mt-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="bg-secondary/10 border border-secondary/20 shadow-sm rounded-2xl p-3">
              <CalendarDays className="h-8 w-8 text-secondary" />
            </div>
            <div>
              <h1 className="text-2xl lg:text-3xl font-bold text-foreground flex items-center gap-2">
                Agenda
                <Popover>
                  <PopoverTrigger asChild>
                    <button className="text-muted-foreground hover:text-foreground transition-colors">
                      <HelpCircle className="h-5 w-5" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-80 text-sm" side="bottom" align="start">
                    <div className="space-y-2">
                      <h4 className="font-semibold text-foreground">Sua Agenda</h4>
                      <p className="text-muted-foreground">
                        Visualize todos os seus eventos, itens da agenda e conteúdos criados em um calendário mensal.
                      </p>
                      <div className="flex flex-col gap-1.5 mt-2">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: TYPE_COLORS.event }} />
                          <span className="text-xs text-muted-foreground">Eventos agendados</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: TYPE_COLORS.theme }} />
                          <span className="text-xs text-muted-foreground">Itens da agenda</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: TYPE_COLORS.action }} />
                          <span className="text-xs text-muted-foreground">Conteúdos criados</span>
                        </div>
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>
              </h1>
              <p className="text-sm text-muted-foreground">
                Gerencie seus eventos e acompanhe sua produção
              </p>
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setSelectedDate(new Date());
                handleCreateEventForDate();
              }}
              className="rounded-xl"
            >
              <Plus className="mr-2 h-4 w-4" /> Novo Evento
            </Button>
            <Button
              onClick={() => setIsThemeDialogOpen(true)}
              className="rounded-xl bg-gradient-to-r from-primary to-secondary shadow-md"
            >
              <Plus className="mr-2 h-4 w-4" /> Novo Item da Agenda
            </Button>
          </div>
        </div>
      </div>

      {/* Calendar + Day Panel */}
      <div className="px-4 sm:px-6 lg:px-8 pb-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Calendar */}
          <div className="lg:col-span-2">
            <div className="bg-card rounded-2xl shadow-sm border border-border/10 overflow-hidden">
              {/* Month navigation */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-border/10">
                <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(prev => subMonths(prev, 1))} className="rounded-xl">
                  <ChevronLeft className="h-5 w-5" />
                </Button>
                <h2 className="text-lg font-bold text-foreground capitalize">
                  {format(currentMonth, 'MMMM yyyy', { locale: ptBR })}
                </h2>
                <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(prev => addMonths(prev, 1))} className="rounded-xl">
                  <ChevronRight className="h-5 w-5" />
                </Button>
              </div>

              {/* Weekday headers */}
              <div className="grid grid-cols-7 border-b border-border/10">
                {WEEKDAYS.map(day => (
                  <div key={day} className="py-2 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    {day}
                  </div>
                ))}
              </div>

              {/* Calendar grid */}
              {isLoading ? (
                <div className="grid grid-cols-7 gap-px bg-border/5 p-2">
                  {Array.from({ length: 35 }).map((_, i) => (
                    <Skeleton key={i} className="h-20 rounded-lg" />
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-7 gap-px bg-border/5">
                  {calendarDays.map(day => {
                    const dayKey = format(day, 'yyyy-MM-dd');
                    const dayItems = itemsByDate[dayKey] || [];
                    const isCurrentMonth = isSameMonth(day, currentMonth);
                    const isSelected = selectedDate && isSameDay(day, selectedDate);
                    const today = isToday(day);

                    return (
                      <button
                        key={dayKey}
                        onClick={() => handleDayClick(day)}
                        className={cn(
                          "relative min-h-[80px] sm:min-h-[100px] p-1.5 sm:p-2 text-left transition-all duration-150 hover:bg-primary/5 group",
                          !isCurrentMonth && "opacity-40",
                          isSelected && "bg-primary/10 ring-2 ring-primary/30 ring-inset",
                          today && !isSelected && "bg-accent/5",
                        )}
                      >
                        <span className={cn(
                          "inline-flex items-center justify-center w-7 h-7 rounded-full text-sm font-medium transition-colors",
                          today && "bg-primary text-primary-foreground",
                          isSelected && !today && "bg-primary/20 text-primary",
                          !today && !isSelected && "text-foreground group-hover:text-primary",
                        )}>
                          {format(day, 'd')}
                        </span>

                        {/* Event dots / badges */}
                        <div className="mt-1 space-y-0.5">
                          {dayItems.slice(0, 3).map(item => (
                            <div
                              key={item.id}
                              className="text-[10px] sm:text-xs truncate px-1.5 py-0.5 rounded-md font-medium leading-tight"
                              style={{ backgroundColor: item.color + '20', color: item.color }}
                            >
                              {item.title}
                            </div>
                          ))}
                          {dayItems.length > 3 && (
                            <span className="text-[10px] text-muted-foreground pl-1">
                              +{dayItems.length - 3} mais
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Legend */}
            <div className="flex items-center gap-4 mt-3 px-1">
              {Object.entries(TYPE_LABELS).map(([key, label]) => (
                <div key={key} className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: TYPE_COLORS[key] }} />
                  <span className="text-xs text-muted-foreground">{label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Day Detail Panel */}
          <div className="lg:col-span-1">
            <div className="bg-card rounded-2xl shadow-sm border border-border/10 overflow-hidden sticky top-4">
              {selectedDate ? (
                <>
                  <div className="px-5 py-4 border-b border-border/10 flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-bold text-foreground capitalize">
                        {format(selectedDate, "d 'de' MMMM", { locale: ptBR })}
                      </h3>
                      <p className="text-xs text-muted-foreground capitalize">
                        {format(selectedDate, 'EEEE', { locale: ptBR })}
                      </p>
                    </div>
                    <Button size="sm" variant="outline" className="rounded-xl" onClick={handleCreateEventForDate}>
                      <Plus className="h-4 w-4 mr-1" /> Evento
                    </Button>
                  </div>

                  <div className="p-4 space-y-3 max-h-[60vh] overflow-y-auto">
                    {selectedDateItems.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <CalendarDays className="h-10 w-10 mx-auto mb-2 opacity-40" />
                        <p className="text-sm">Nenhum item neste dia</p>
                        <p className="text-xs mt-1">Clique em "Evento" para agendar algo</p>
                      </div>
                    ) : (
                      selectedDateItems.map(item => (
                        <button
                          key={item.id}
                          onClick={() => handleItemClick(item)}
                          className="w-full text-left p-3 rounded-xl border border-border/10 hover:bg-muted/50 transition-colors group"
                        >
                          <div className="flex items-start gap-3">
                            <div className="w-1 h-full min-h-[40px] rounded-full flex-shrink-0" style={{ backgroundColor: item.color }} />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-0.5">
                                <Badge variant="outline" className="text-[10px] py-0 h-4" style={{ borderColor: item.color, color: item.color }}>
                                  {TYPE_LABELS[item.type]}
                                </Badge>
                                {item.type === 'event' && item.data.event_time && (
                                  <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                                    <Clock className="h-2.5 w-2.5" />
                                    {item.data.event_time.slice(0, 5)}
                                  </span>
                                )}
                              </div>
                              <p className="text-sm font-medium text-foreground truncate">{item.title}</p>
                              {item.type === 'event' && item.data.description && (
                                <p className="text-xs text-muted-foreground truncate mt-0.5">{item.data.description}</p>
                              )}
                              {item.type === 'event' && (
                                <div className="flex gap-1 mt-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-6 px-2 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      deleteEvent.mutate(item.id);
                                    }}
                                  >
                                    <Trash2 className="h-3 w-3 mr-1" /> Remover
                                  </Button>
                                </div>
                              )}
                            </div>
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                </>
              ) : (
                <div className="p-8 text-center text-muted-foreground">
                  <CalendarDays className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <p className="text-sm font-medium">Selecione um dia</p>
                  <p className="text-xs mt-1">Clique em um dia do calendário para ver os detalhes</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Event Dialog */}
      <Dialog open={isEventDialogOpen} onOpenChange={setIsEventDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingEvent ? 'Editar Evento' : 'Novo Evento'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {selectedDate && (
              <p className="text-sm text-muted-foreground capitalize">
                {format(selectedDate, "EEEE, d 'de' MMMM 'de' yyyy", { locale: ptBR })}
              </p>
            )}
            <div className="space-y-2">
              <Label htmlFor="event-title">Título *</Label>
              <Input
                id="event-title"
                value={eventForm.title}
                onChange={e => setEventForm(prev => ({ ...prev, title: e.target.value }))}
                placeholder="Ex: Reunião com assessoria"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="event-time">Horário (opcional)</Label>
              <Input
                id="event-time"
                type="time"
                value={eventForm.time}
                onChange={e => setEventForm(prev => ({ ...prev, time: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="event-description">Descrição (opcional)</Label>
              <Textarea
                id="event-description"
                value={eventForm.description}
                onChange={e => setEventForm(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Detalhes do evento..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancelar</Button>
            </DialogClose>
            <Button onClick={handleSaveEvent} disabled={createEvent.isPending || updateEvent.isPending}>
              {(createEvent.isPending || updateEvent.isPending) ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              {editingEvent ? 'Salvar' : 'Criar Evento'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Theme Dialog */}
      <ThemeDialog
        isOpen={isThemeDialogOpen}
        onOpenChange={setIsThemeDialogOpen}
        onSave={handleSaveTheme}
        themeToEdit={null}
        brands={brandSummaries}
      />
    </div>
  );
}
