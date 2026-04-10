import { Plus, Trash2, MessageSquare, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";

type Conversation = {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
};

interface BookChatSidebarProps {
  conversations: Conversation[];
  activeConversationId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function SidebarContent({
  conversations,
  activeConversationId,
  onSelect,
  onNew,
  onDelete,
  onClose,
}: Omit<BookChatSidebarProps, "open" | "onOpenChange"> & { onClose?: () => void }) {
  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b flex items-center justify-between">
        <h3 className="font-semibold text-sm">Conversas</h3>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={onNew} className="h-8 w-8" title="Nova conversa">
            <Plus className="h-4 w-4" />
          </Button>
          {onClose && (
            <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8 md:hidden">
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {conversations.length === 0 && (
            <div className="px-3 py-8 text-center text-muted-foreground text-xs">
              Nenhuma conversa ainda.
              <br />
              Comece fazendo uma pergunta!
            </div>
          )}
          {conversations.map((conv) => (
            <div
              key={conv.id}
              className={cn(
                "group flex items-start gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors text-sm",
                activeConversationId === conv.id
                  ? "bg-primary/10 text-primary"
                  : "hover:bg-muted/50 text-foreground/70"
              )}
              onClick={() => onSelect(conv.id)}
            >
              <MessageSquare className="h-4 w-4 mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="truncate font-medium text-xs">{conv.title}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  {format(new Date(conv.updated_at), "dd MMM, HH:mm", { locale: ptBR })}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 opacity-0 group-hover:opacity-100 shrink-0"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(conv.id);
                }}
              >
                <Trash2 className="h-3 w-3 text-destructive" />
              </Button>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}

export function BookChatSidebar(props: BookChatSidebarProps) {
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <Sheet open={props.open} onOpenChange={props.onOpenChange}>
        <SheetContent side="left" className="w-72 p-0">
          <SidebarContent
            {...props}
            onClose={() => props.onOpenChange(false)}
          />
        </SheetContent>
      </Sheet>
    );
  }

  if (!props.open) return null;

  return (
    <div className="w-72 border-r bg-muted/30 shrink-0 flex flex-col">
      <SidebarContent
        {...props}
        onClose={() => props.onOpenChange(false)}
      />
    </div>
  );
}
