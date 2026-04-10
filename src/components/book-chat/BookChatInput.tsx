import { useState, useRef } from "react";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface BookChatInputProps {
  onSend: (message: string) => void;
  isLoading: boolean;
}

export function BookChatInput({ onSend, isLoading }: BookChatInputProps) {
  const [input, setInput] = useState("");
  const formRef = useRef<HTMLFormElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    onSend(input.trim());
    setInput("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <div className="border-t p-4 bg-background/80 backdrop-blur-sm">
      <form ref={formRef} onSubmit={handleSubmit} className="max-w-3xl mx-auto flex gap-2">
        <Textarea
          id="book-chat-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onInput={(e) => setInput((e.target as HTMLTextAreaElement).value)}
          onKeyDown={handleKeyDown}
          placeholder="Pergunte sobre o relatório..."
          disabled={isLoading}
          className="min-h-[44px] max-h-32 resize-none flex-1"
          rows={1}
        />
        <Button
          type="submit"
          disabled={isLoading || !input.trim()}
          size="icon"
          className="shrink-0 h-11 w-11"
        >
          <Send className="h-4 w-4" />
        </Button>
      </form>
      <p className="text-[10px] text-muted-foreground text-center mt-2 max-w-3xl mx-auto">
        Respostas baseadas no relatório "A Próxima Democracia: Brasil 2026". A IA pode cometer erros.
      </p>
    </div>
  );
}
