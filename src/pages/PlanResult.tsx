import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Copy, Check, Download, Calendar, FileText, File, FileCode } from "lucide-react";
import { toast } from "sonner";
import ReactMarkdown from 'react-markdown';
import { Document, Packer, Paragraph, TextRun, AlignmentType } from 'docx';
import { saveAs } from 'file-saver';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const PlanResult = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isCopied, setIsCopied] = useState(false);
  const planContent = location.state?.plan;
  const actionId = location.state?.actionId;

  useEffect(() => {
    if (!planContent) {
      toast.error("Nenhum planejamento encontrado");
      navigate("/plan");
    }
  }, [planContent, navigate]);

  const handleCopy = () => {
    if (!planContent) return;
    navigator.clipboard.writeText(planContent).then(() => {
      setIsCopied(true);
      toast.success('Planejamento copiado!');
      setTimeout(() => setIsCopied(false), 2000);
    }).catch(() => toast.error('Falha ao copiar.'));
  };

  const handleDownloadTxt = () => {
    if (!planContent) return;
    
    try {
      const blob = new Blob([planContent], { type: 'text/plain;charset=utf-8' });
      saveAs(blob, `planejamento-${new Date().toISOString().split('T')[0]}.txt`);
      toast.success('Download do TXT iniciado!');
    } catch (error) {
      console.error('Error generating TXT:', error);
      toast.error('Erro ao gerar TXT. Tente novamente.');
    }
  };

  const handleDownloadMd = () => {
    if (!planContent) return;
    
    try {
      const blob = new Blob([planContent], { type: 'text/markdown;charset=utf-8' });
      saveAs(blob, `planejamento-${new Date().toISOString().split('T')[0]}.md`);
      toast.success('Download do Markdown iniciado!');
    } catch (error) {
      console.error('Error generating Markdown:', error);
      toast.error('Erro ao gerar Markdown. Tente novamente.');
    }
  };

  const handleDownloadDocx = async () => {
    if (!planContent) return;
    
    try {
      // Helper function to process inline markdown (bold text)
      const processInlineMarkdown = (text: string): TextRun[] => {
        const parts: TextRun[] = [];
        const boldRegex = /\*\*(.+?)\*\*/g;
        let lastIndex = 0;
        let match;
        
        while ((match = boldRegex.exec(text)) !== null) {
          // Text before bold
          if (match.index > lastIndex) {
            parts.push(new TextRun({
              text: text.substring(lastIndex, match.index),
              font: "Arial",
              size: 24, // 12pt
              color: "000000",
            }));
          }
          
          // Bold text
          parts.push(new TextRun({
            text: match[1],
            font: "Arial",
            size: 24, // 12pt
            color: "000000",
            bold: true,
          }));
          
          lastIndex = match.index + match[0].length;
        }
        
        // Remaining text
        if (lastIndex < text.length) {
          parts.push(new TextRun({
            text: text.substring(lastIndex),
            font: "Arial",
            size: 24, // 12pt
            color: "000000",
          }));
        }
        
        return parts.length > 0 ? parts : [new TextRun({
          text: text,
          font: "Arial",
          size: 24, // 12pt
          color: "000000",
        })];
      };

      const paragraphs: Paragraph[] = [];
      const lines = planContent.split('\n');
      
      lines.forEach((line) => {
        const trimmedLine = line.trim();
        
        // Skip empty lines but add spacing
        if (!trimmedLine) {
          paragraphs.push(new Paragraph({
            text: "",
            spacing: { after: 100 }
          }));
          return;
        }

        // H1 - Main headers (# Título) - MUST have space after #
        if (trimmedLine.match(/^#\s+[^#]/)) {
          const text = trimmedLine.replace(/^#\s+/, '');
          paragraphs.push(new Paragraph({
            children: [
              new TextRun({
                text: text,
                font: "Arial",
                size: 36, // 18pt
                bold: true,
                color: "000000",
              })
            ],
            spacing: { before: 240, after: 120 },
            alignment: AlignmentType.LEFT,
          }));
        }
        // H2 - Section headers (## Seção) - MUST have space after ##
        else if (trimmedLine.match(/^##\s+[^#]/)) {
          const text = trimmedLine.replace(/^##\s+/, '');
          paragraphs.push(new Paragraph({
            children: [
              new TextRun({
                text: text,
                font: "Arial",
                size: 32, // 16pt
                bold: true,
                color: "000000",
              })
            ],
            spacing: { before: 200, after: 100 },
            alignment: AlignmentType.LEFT,
          }));
        }
        // H3 - Subsection headers (### Subseção) - MUST have space after ###
        else if (trimmedLine.match(/^###\s+/)) {
          const text = trimmedLine.replace(/^###\s+/, '');
          paragraphs.push(new Paragraph({
            children: [
              new TextRun({
                text: text,
                font: "Arial",
                size: 28, // 14pt
                bold: true,
                color: "000000",
              })
            ],
            spacing: { before: 160, after: 80 },
            alignment: AlignmentType.LEFT,
          }));
        }
        // Numbered lists (1. Item)
        else if (trimmedLine.match(/^\d+\.\s+/)) {
          const text = trimmedLine.replace(/^\d+\.\s+/, '');
          paragraphs.push(new Paragraph({
            children: processInlineMarkdown(text),
            numbering: {
              reference: "default-numbering",
              level: 0
            },
            spacing: { after: 80 }
          }));
        }
        // Bullet lists (- Item or * Item) - MUST have space after - or *
        else if (trimmedLine.match(/^(\-|\*)\s+/)) {
          const text = trimmedLine.replace(/^(\-|\*)\s+/, '');
          paragraphs.push(new Paragraph({
            children: processInlineMarkdown(text),
            bullet: {
              level: 0
            },
            spacing: { after: 80 }
          }));
        }
        // Hashtags (#LumiLife) - NO space after # = regular text
        else if (trimmedLine.match(/^#[^\s]/)) {
          paragraphs.push(new Paragraph({
            children: [
              new TextRun({
                text: trimmedLine,
                font: "Arial",
                size: 24, // 12pt
                color: "000000",
              })
            ],
            spacing: { after: 80 }
          }));
        }
        // Regular text with inline markdown processing
        else {
          paragraphs.push(new Paragraph({
            children: processInlineMarkdown(trimmedLine),
            spacing: { after: 100 }
          }));
        }
      });

      const doc = new Document({
        numbering: {
          config: [{
            reference: "default-numbering",
            levels: [{
              level: 0,
              format: "decimal",
              text: "%1.",
              alignment: AlignmentType.START,
              style: {
                paragraph: {
                  indent: { left: 720, hanging: 360 }
                }
              }
            }]
          }]
        },
        sections: [{
          properties: {
            page: {
              margin: {
                top: 1440,
                right: 1440,
                bottom: 1440,
                left: 1440
              }
            }
          },
          children: paragraphs
        }]
      });

      const blob = await Packer.toBlob(doc);
      saveAs(blob, `planejamento-${new Date().toISOString().split('T')[0]}.docx`);
      toast.success('Download do DOCX iniciado!');
    } catch (error) {
      console.error('Error generating DOCX:', error);
      toast.error('Erro ao gerar DOCX. Tente novamente.');
    }
  };

  if (!planContent) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <div className="max-w-6xl mx-auto p-4 sm:p-6 lg:p-8">
        {/* Header */}
        <div className="mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <Button 
            variant="outline" 
            onClick={() => navigate("/plan")}
            className="flex items-center gap-2 hover:bg-primary/10 hover:text-primary hover:border-primary"
          >
            <ArrowLeft className="h-4 w-4" />
            Criar Novo Calendário
          </Button>

          <div className="flex flex-wrap gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button 
                  variant="outline"
                  className="flex items-center gap-2 hover:text-accent hover:border-accent hover:bg-accent/20"
                >
                  <Download className="h-4 w-4" />
                  Download
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="bg-background border shadow-lg z-50">
                <DropdownMenuItem 
                  onClick={handleDownloadDocx}
                  className="cursor-pointer hover:bg-accent/20 hover:text-accent focus:bg-accent/20"
                >
                  <FileText className="h-4 w-4 mr-2" />
                  Baixar como .docx (Word)
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={handleDownloadTxt}
                  className="cursor-pointer hover:bg-accent/20 hover:text-accent focus:bg-accent/20"
                >
                  <File className="h-4 w-4 mr-2" />
                  Baixar como .txt (Texto)
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={handleDownloadMd}
                  className="cursor-pointer hover:bg-accent/20 hover:text-accent focus:bg-accent/20"
                >
                  <FileCode className="h-4 w-4 mr-2" />
                  Baixar como .md (Markdown)
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button 
              onClick={handleCopy}
              className="flex items-center gap-2"
            >
              {isCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {isCopied ? "Copiado!" : "Copiar"}
            </Button>
          </div>
        </div>

        {/* Content Card */}
        <Card className="shadow-2xl border-0 bg-card/95 backdrop-blur-sm">
          <CardHeader className="bg-gradient-to-r from-primary/10 via-secondary/10 to-accent/10 border-b">
            <div className="flex items-center gap-3">
              <div className="bg-primary/20 p-3 rounded-xl">
                <Calendar className="h-6 w-6 text-primary" />
              </div>
              <div>
                <CardTitle className="text-2xl sm:text-3xl">
                   Calendário de Conteúdo
                </CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  Gerado em {new Date().toLocaleDateString('pt-BR', { 
                    day: '2-digit', 
                    month: 'long', 
                    year: 'numeric' 
                  })}
                </p>
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-6 sm:p-8 lg:p-12">
            <div className="prose prose-lg prose-slate dark:prose-invert max-w-none">
              <ReactMarkdown
                components={{
                  h1: ({ children }) => (
                    <h1 className="text-2xl font-bold text-primary mb-4 pb-2 border-b border-primary/20">
                      {children}
                    </h1>
                  ),
                  h2: ({ children }) => (
                    <h2 className="text-xl font-semibold text-foreground mt-6 mb-3 flex items-center gap-2">
                      <span className="w-1 h-6 bg-gradient-to-b from-primary to-secondary rounded-full flex-shrink-0"></span>
                      {children}
                    </h2>
                  ),
                  h3: ({ children }) => (
                    <h3 className="text-lg font-semibold text-foreground mt-5 mb-2">
                      {children}
                    </h3>
                  ),
                  h4: ({ children }) => (
                    <h4 className="text-base font-semibold text-primary mt-3 mb-2">
                      {children}
                    </h4>
                  ),
                  p: ({ children }) => (
                    <p className="text-sm text-muted-foreground leading-relaxed mb-3">
                      {children}
                    </p>
                  ),
                  ul: ({ children }) => (
                    <ul className="list-disc list-inside space-y-1 mb-3 ml-4">
                      {children}
                    </ul>
                  ),
                  ol: ({ children }) => (
                    <ol className="list-decimal list-inside space-y-1 mb-3 ml-4">
                      {children}
                    </ol>
                  ),
                  li: ({ children }) => (
                    <li className="text-sm text-muted-foreground">
                      {children}
                    </li>
                  ),
                  strong: ({ children }) => (
                    <strong className="font-semibold text-foreground">
                      {children}
                    </strong>
                  ),
                  blockquote: ({ children }) => (
                    <blockquote className="border-l-4 border-primary/30 pl-4 italic text-muted-foreground bg-primary/5 py-2 my-3 rounded-r">
                      {children}
                    </blockquote>
                  ),
                  code: ({ children }) => (
                    <code className="bg-muted px-2 py-1 rounded text-sm font-mono text-primary">
                      {children}
                    </code>
                  ),
                  hr: () => (
                    <hr className="my-6 border-t-2 border-border/30" />
                  ),
                }}
              >
                {planContent}
              </ReactMarkdown>
            </div>
          </CardContent>
        </Card>

        {/* Action Link */}
        {actionId && (
          <div className="mt-6 text-center">
            <Button
              variant="link"
              onClick={() => navigate(`/action/${actionId}`)}
              className="text-muted-foreground hover:text-primary"
            >
              Ver detalhes desta ação no histórico →
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default PlanResult;
