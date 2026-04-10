import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { BookChatSidebar } from "@/components/book-chat/BookChatSidebar";
import { BookChatMessages } from "@/components/book-chat/BookChatMessages";
import { BookChatInput } from "@/components/book-chat/BookChatInput";
import { Menu, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useIsMobile } from "@/hooks/use-mobile";

type Message = { role: "user" | "assistant"; content: string };
type Conversation = { id: string; title: string; created_at: string; updated_at: string };

export default function BookChat() {
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(!isMobile);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Load conversations
  const loadConversations = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("book_conversations")
      .select("id, title, created_at, updated_at")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false });
    if (data) setConversations(data);
  }, [user]);

  useEffect(() => { loadConversations(); }, [loadConversations]);

  // Load messages for active conversation
  useEffect(() => {
    if (!activeConversationId) {
      setMessages([]);
      return;
    }
    (async () => {
      const { data } = await supabase
        .from("book_messages")
        .select("role, content")
        .eq("conversation_id", activeConversationId)
        .order("created_at", { ascending: true });
      if (data) setMessages(data as Message[]);
    })();
  }, [activeConversationId]);

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const createConversation = async (firstMessage?: string): Promise<string | null> => {
    if (!user) return null;
    
    const profile = await supabase
      .from("profiles")
      .select("team_id")
      .eq("id", user.id)
      .single();

    const { data, error } = await supabase
      .from("book_conversations")
      .insert({
        user_id: user.id,
        team_id: profile.data?.team_id,
        title: firstMessage ? firstMessage.slice(0, 60) + (firstMessage.length > 60 ? "..." : "") : "Nova conversa",
      })
      .select("id")
      .single();

    if (error || !data) {
      toast.error("Erro ao criar conversa");
      return null;
    }

    await loadConversations();
    setActiveConversationId(data.id);
    return data.id;
  };

  const handleNewConversation = async () => {
    setActiveConversationId(null);
    setMessages([]);
    if (isMobile) setSidebarOpen(false);
  };

  const handleSelectConversation = (id: string) => {
    setActiveConversationId(id);
    if (isMobile) setSidebarOpen(false);
  };

  const handleDeleteConversation = async (id: string) => {
    await supabase.from("book_conversations").delete().eq("id", id);
    if (activeConversationId === id) {
      setActiveConversationId(null);
      setMessages([]);
    }
    await loadConversations();
  };

  const handleSend = async (input: string) => {
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    let convId = activeConversationId;

    // Create conversation if needed
    if (!convId) {
      convId = await createConversation(userMessage);
      if (!convId) return;
    }

    // Add user message
    const newMessages: Message[] = [...messages, { role: "user", content: userMessage }];
    setMessages(newMessages);
    setIsLoading(true);

    // Save user message to DB
    await supabase.from("book_messages").insert({
      conversation_id: convId,
      role: "user",
      content: userMessage,
    });

    // Stream AI response
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        toast.error("Sessão expirada. Faça login novamente.");
        setIsLoading(false);
        return;
      }

      const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/book-chat`;
      const response = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          messages: newMessages,
          conversationId: convId,
        }),
      });

      if (!response.ok) {
        if (response.status === 429) {
          toast.error("Limite de requisições atingido. Tente novamente em alguns segundos.");
        } else {
          toast.error("Erro ao processar mensagem.");
        }
        setIsLoading(false);
        return;
      }

      if (!response.body) throw new Error("No response body");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = "";
      let assistantContent = "";

      setMessages(prev => [...prev, { role: "assistant", content: "" }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        textBuffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);

          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || line.trim() === "") continue;
          if (!line.startsWith("data: ")) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") break;

          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) {
              assistantContent += content;
              setMessages(prev => {
                const updated = [...prev];
                updated[updated.length - 1] = { role: "assistant", content: assistantContent };
                return updated;
              });
            }
          } catch {
            textBuffer = line + "\n" + textBuffer;
            break;
          }
        }
      }

      // Save assistant message to DB
      if (assistantContent) {
        await supabase.from("book_messages").insert({
          conversation_id: convId,
          role: "assistant",
          content: assistantContent,
        });
        // Update conversation timestamp
        await supabase
          .from("book_conversations")
          .update({ updated_at: new Date().toISOString() })
          .eq("id", convId);
        await loadConversations();
      }
    } catch (error) {
      console.error("Chat error:", error);
      toast.error("Erro ao processar mensagem.");
      setMessages(prev => prev.slice(0, -1));
    }

    setIsLoading(false);
  };

  return (
    <div className="flex h-full overflow-hidden -m-4 sm:-m-6 lg:-m-8" style={{ height: 'calc(100% + 2rem)', maxHeight: 'calc(100vh - 5rem)' }}>
      {/* Sidebar */}
      <BookChatSidebar
        conversations={conversations}
        activeConversationId={activeConversationId}
        onSelect={handleSelectConversation}
        onNew={handleNewConversation}
        onDelete={handleDeleteConversation}
        open={sidebarOpen}
        onOpenChange={setSidebarOpen}
      />

      {/* Main chat area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b bg-background/80 backdrop-blur-sm">
          {!sidebarOpen && (
            <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(true)} className="shrink-0">
              <Menu className="h-5 w-5" />
            </Button>
          )}
          <BookOpen className="h-5 w-5 text-primary shrink-0" />
          <div className="min-w-0">
            <h2 className="font-semibold text-sm truncate">Especialista — A Próxima Democracia</h2>
            <p className="text-xs text-muted-foreground truncate">Silvio Meira & Rosário Pompéia</p>
          </div>
        </div>

        {/* Messages */}
        <BookChatMessages
          messages={messages}
          isLoading={isLoading}
          scrollRef={scrollRef}
        />

        {/* Input */}
        <BookChatInput onSend={handleSend} isLoading={isLoading} />
      </div>
    </div>
  );
}
