import { Loader2, BookOpen, User } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import ReactMarkdown from "react-markdown";

type Message = { role: "user" | "assistant"; content: string };

interface BookChatMessagesProps {
  messages: Message[];
  isLoading: boolean;
  scrollRef: React.RefObject<HTMLDivElement>;
}

export function BookChatMessages({ messages, isLoading, scrollRef }: BookChatMessagesProps) {
  if (messages.length === 0) {
    return (
      <div className="flex-1 min-h-0 flex items-center justify-center p-8">
        <div className="text-center max-w-md space-y-4">
          <div className="mx-auto w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
            <BookOpen className="h-8 w-8 text-primary" />
          </div>
          <h3 className="text-lg font-semibold">Especialista em A Próxima Democracia</h3>
          <p className="text-sm text-muted-foreground">
            Faça perguntas sobre o relatório "Brasil 2026 — Democracia Sob Tensão" de Silvio Meira e Rosário Pompéia. 
            Posso ajudar com análises sobre cenários eleitorais, as 32 teses, comportamento do eleitor e muito mais.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2">
            {[
              "Quais são os cenários eleitorais para 2026?",
              "Explique o voto de ressentimento",
              "O que são as 32 teses?",
              "Como funciona o Centrão?",
            ].map((q) => (
              <button
                key={q}
                className="text-left text-xs p-3 rounded-lg border bg-background hover:bg-muted/50 transition-colors text-muted-foreground hover:text-foreground"
                onClick={() => {
                  // Will be handled by parent via form submit
                  const input = document.querySelector<HTMLTextAreaElement>("#book-chat-input");
                  if (input) {
                    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
                      window.HTMLTextAreaElement.prototype, "value"
                    )?.set;
                    nativeInputValueSetter?.call(input, q);
                    input.dispatchEvent(new Event("input", { bubbles: true }));
                    // Focus and trigger submit
                    input.focus();
                    setTimeout(() => {
                      input.form?.requestSubmit();
                    }, 50);
                  }
                }}
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <ScrollArea className="flex-1 min-h-0">
      <div className="w-full max-w-3xl mx-auto px-4 py-6 space-y-6" ref={scrollRef}>
        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            {msg.role === "assistant" && (
              <div className="shrink-0 mt-1 w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center">
                <BookOpen className="h-3.5 w-3.5 text-primary" />
              </div>
            )}
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                msg.role === "user"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted/60"
              }`}
            >
              {msg.role === "assistant" ? (
                <div className="prose prose-sm dark:prose-invert max-w-none text-sm [&>p]:mb-2 [&>ul]:mb-2 [&>ol]:mb-2 [&>h1]:text-base [&>h2]:text-sm [&>h3]:text-sm">
                  <ReactMarkdown>{msg.content}</ReactMarkdown>
                  {isLoading && idx === messages.length - 1 && !msg.content && (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  )}
                  {isLoading && idx === messages.length - 1 && msg.content && (
                    <span className="inline-block w-1.5 h-4 ml-0.5 bg-primary animate-pulse rounded-full" />
                  )}
                </div>
              ) : (
                <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
              )}
            </div>
            {msg.role === "user" && (
              <div className="shrink-0 mt-1 w-7 h-7 rounded-full bg-foreground/10 flex items-center justify-center">
                <User className="h-3.5 w-3.5" />
              </div>
            )}
          </div>
        ))}
        {isLoading && messages[messages.length - 1]?.role === "user" && (
          <div className="flex gap-3">
            <div className="shrink-0 mt-1 w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center">
              <BookOpen className="h-3.5 w-3.5 text-primary" />
            </div>
            <div className="bg-muted/60 rounded-2xl px-4 py-3">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          </div>
        )}
      </div>
    </ScrollArea>
  );
}
