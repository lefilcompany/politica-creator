import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const BOOK_CONTEXT = `
# BASE DE CONHECIMENTO — "A PRÓXIMA DEMOCRACIA: BRASIL 2026 — DEMOCRACIA SOB TENSÃO"
# Autores: Silvio Meira & Rosário Pompéia (2025/2026)
# Relatório de Análise Política e Prospectiva

## SUMÁRIO EXECUTIVO
O Brasil que chega a outubro de 2026 não é o mesmo país que elegeu Lula em 2022. É um país que viveu uma tentativa de golpe de Estado, viu seu ex-presidente preso e inelegível, assistiu ao crime organizado consolidar-se como ator político, acumulou R$ 61 bilhões em emendas parlamentares e entrou na era de IA generativa que tornou a desinformação em escala industrial acessível.

A pergunta central: o Brasil que emergirá de outubro de 2026 ainda será capaz de se governar de forma funcional, democrática e orientada ao interesse público?

O relatório examina 11 dimensões: comportamento do eleitor, estratégias dos blocos políticos, redes sociais e desinformação, batalha pelo Senado, emendas parlamentares, comunicação do governo, crime organizado, conservadorismo popular, cenários eleitorais, perspectivas socioeconômicas e resiliência democrática.

## CAPÍTULO 1: O COMPORTAMENTO DO ELEITOR
- O Voto de Sobrevivência: base eleitoral de Lula construída sobre experiência material (Bolsa Família alcança 21 milhões de famílias, ~55 milhões de pessoas)
- O Voto de Ressentimento: expressão política de humilhação social acumulada — homens sem diploma, mulheres evangélicas, pequenos empresários, policiais
- Calcificação do Eleitorado: pesquisas indicam que entre 60% e 75% dos eleitores já decidiram seu voto
- A Crise da Representação no Centro: quase metade rejeita tanto Lula quanto Bolsonaro

## CAPÍTULO 2: ARTICULAÇÕES DOS GRUPOS POLÍTICOS
- Bloco Governista (PT e Coalizão): ministério de 37 pastas, Centrão como sócio indispensável. Custo: programático, orçamentário e de imagem
- Bloco Bolsonarista (PL, Flávio): transição de Jair para Flávio. Rede de igrejas, influenciadores, PL. Rejeição entre 45-55%
- Terceira Via (Tarcísio): governador de SP, rejeição entre 25-32%, melhor posicionado em hipotético segundo turno
- Congresso como Ator Autônomo: emendas de R$ 9 bi (2016) para R$ 61 bi (2026). O "Quarto Poder"

## CAPÍTULO 3: REDES SOCIAIS E DESINFORMAÇÃO
- Brasil: 2º maior mercado WhatsApp (140 milhões), top 5 TikTok/Instagram
- Fake news viajam até 6x mais rápido que notícias verdadeiras
- Democratização da IA generativa tornou desinformação sofisticada acessível
- Influencers políticos: novo cabo eleitoral com mais alcance que senadores

## CAPÍTULO 4: EMENDAS PARLAMENTARES
- De R$ 9 bi (2016) para R$ 61 bi (2026) — sequestro do orçamento
- Emendas Pix: dispensam projeto ou convênio
- Impacto direto em saúde e políticas públicas
- Município que mais recebeu emendas teve pior indicador de saúde

## CAPÍTULO 5: COMUNICAÇÃO DO GOVERNO
- Lula não usa celular — metáfora de governo com lógica do século XX
- Comunicação broadcasting vs. fragmentação digital
- Paradoxo: realizações existem, mas beneficiários não associam ao governo
- Oposição preenche o vácuo nas redes e WhatsApp

## CAPÍTULO 6: BATALHA PELO SENADO
- Quem controla o Senado controla indicações para o STF
- 2 vagas no STF serão preenchidas 2027-2029
- Campo conservador avança em pesquisas
- Captura institucional como projeto de longo prazo

## CAPÍTULO 7: CRIME ORGANIZADO NA POLÍTICA
- Candidatos do crime organizado em 382 municípios brasileiros
- PCC e Comando Vermelho com estratégia eleitoral
- Ligação entre emendas parlamentares e crime organizado
- O "narco-estado" como ameaça estrutural

## CAPÍTULO 8: CONSERVADORISMO POPULAR
- A economia moral do conservadorismo: trabalho duro, família, ordem
- Papel da Igreja Evangélica: 65 milhões de fiéis, cabo eleitoral mais eficaz
- O medo como ativo político: violência, desemprego, desagregação
- A esquerda e o espelho que recusa encarar

## CAPÍTULO 9: CENÁRIOS ELEITORAIS 2026
- Cenário A: Lula reeleito com margem ampla (25%)
- Cenário B: Lula reeleito no limite (35%)  
- Cenário C: Vitória de Flávio Bolsonaro (25%)
- Cenário D: Tarcísio entra e vence (10%)
- Cenário E: Instabilidade pós-eleitoral (5%, efeito catastrófico)
- Cenário Transversal: Brasil independente do resultado

## CAPÍTULO 10: ECONOMIA, SAÚDE, EDUCAÇÃO E SEGURANÇA ATÉ 2030
- Economia: crescimento insuficiente, juros perversos, armadilha da renda média
- Estado: crise de capacidade estatal, gasto público ineficiente
- SUS em crise estrutural
- Educação em colapso de aprendizagem
- Segurança: estado paralelo avança

## CAPÍTULO 11: DEMOCRACIA RESILIENTE OU À BEIRA DO ABISMO?
- Fatores de risco inéditos combinados
- Fatores de resiliência: instituições que resistiram ao golpe, sociedade civil, sistema eleitoral
- O papel da consciência cidadã
- Democracia como escolha cotidiana

## AS 32 TESES DE SILVIO MEIRA E ROSÁRIO POMPÉIA
### GRUPO A — Reconfigurando Poder e Governança
1. Da centralização para descentralização radical em rede
2. Da governança estática para governança líquida e antifrágil
3. Das instituições rígidas para flexibilidade criativa
4. Do autoritarismo para governança distribuída
5. Do centralismo para descentralização da autoridade
6. Do culto ao "gestor salvador" para instituições fortes

### GRUPO B — Reinventando a Dinâmica Política
7. Da política como evento para política como fluxo contínuo
8. De conexões superficiais para hiperconectividade com significado
9. Da macropolítica para micropolítica das conexões locais
10. Da burocracia para agilidade política iterativa
11. Do localismo para glocalização política
12. Da política em silos para ecossistema aberto

### GRUPO C — Narrativa, Afeto e Autenticidade
13. Da pós-verdade para autenticidade radical
14. Da política espetáculo para performance autêntica
15. Do marketing persuasão para marketing confiança
16. Da desinformação para integridade informacional
17. Da narrativa única para narrativas polifônicas
18. Do racionalismo estrito para política do afeto consciente
19. Da indiferença para política da empatia radical

### GRUPO D — Expandindo Cidadania
20. Da inclusão superficial para inclusão radical
21. Do Estado-nação para redes de identidades fluidas
22. Da cidadania antropocêntrica para cidadania expandida
23. Do culto ao líder para política colaborativa
24. Da política de palco para política do cotidiano
25. Da obediência cega para desobediência ética

### GRUPO E — Complexidade, Resiliência e Ética
26. Da privacidade como privilégio para segurança digital como direito
27. Da política sustentável para política resiliente e regenerativa
28. Da política vertical para política transdisciplinar
29. Da unidade monolítica para fragmentação positiva
30. Da previsibilidade para incerteza e experimentação
31. Do pragmatismo resignado para imaginação como força política
32. Da opacidade para transparência radical

## FRAMEWORK AEIOU
- A — Ambiente: mapear o contexto figital
- E — Estratégia: transformar teses em ação viável
- I — Interações: tecer a rede cívica
- O — Operações: governança ágil
- U — Unificação: integrar todas as dimensões

## 11 CONCLUSÕES SÍNTESE
1. O eleitor está dividido entre sobrevivência e ressentimento
2. A polarização está calcificada mas não é total
3. O Centrão governa de fato
4. A desinformação é uma indústria
5. As emendas sequestraram o orçamento
6. A comunicação do governo falha sistematicamente
7. O crime organizado é ator político estrutural
8. O conservadorismo popular tem razões reais
9. O Senado de 2027 definirá o STF da próxima década
10. A democracia brasileira é mais resiliente do que parece — mas não invulnerável
11. Outubro de 2026 é um momento; o Brasil é um processo
`;

const SYSTEM_PROMPT = `Você é um especialista e analista do relatório "A Próxima Democracia: Brasil 2026 — Democracia Sob Tensão" de Silvio Meira e Rosário Pompéia. Você tem conhecimento profundo de todo o conteúdo do documento, incluindo:

- O comportamento do eleitor brasileiro (voto de sobrevivência vs. voto de ressentimento)
- As articulações dos blocos políticos (PT/coalizão, bolsonarismo/Flávio, terceira via/Tarcísio, Centrão)
- Redes sociais, influencers políticos e fake news
- As emendas parlamentares e o sequestro do orçamento
- A comunicação analógica do governo
- A batalha pelo Senado e o controle do STF
- O crime organizado na política
- O conservadorismo popular e suas razões
- Os cenários eleitorais de 2026
- Perspectivas para economia, saúde, educação e segurança até 2030
- A questão da resiliência democrática
- As 32 Teses para a Próxima Democracia
- O Framework AEIOU

Diretrizes:
1. Responda sempre em português brasileiro
2. Base suas respostas EXCLUSIVAMENTE no conteúdo do documento
3. Quando não souber algo que não está no documento, diga claramente
4. Cite teses, capítulos e dados específicos do relatório quando relevante
5. Seja analítico, preciso e fundamentado
6. Evite polarização — o documento busca análise objetiva
7. Mantenha um tom acadêmico mas acessível
8. Use formatação markdown para organizar respostas longas`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, conversationId } = await req.json();

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify user
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY not configured");
    }

    // Build messages with context
    const aiMessages = [
      {
        role: "user",
        parts: [{
          text: `${SYSTEM_PROMPT}\n\n## CONTEÚDO DO DOCUMENTO:\n${BOOK_CONTEXT}`
        }]
      },
      {
        role: "model",
        parts: [{
          text: "Entendido. Sou um especialista no relatório 'A Próxima Democracia: Brasil 2026'. Estou pronto para responder perguntas sobre qualquer aspecto do documento, incluindo os cenários eleitorais, as 32 teses, o comportamento do eleitor, os blocos políticos, a desinformação, as emendas parlamentares e todos os demais temas abordados. Como posso ajudá-lo?"
        }]
      },
      ...messages.map((msg: any) => ({
        role: msg.role === "user" ? "user" : "model",
        parts: [{ text: msg.content }]
      }))
    ];

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:streamGenerateContent?alt=sse&key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: aiMessages,
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 4096,
          },
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Gemini error:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      
      return new Response(JSON.stringify({ error: "AI service error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Transform Gemini SSE to OpenAI-compatible SSE format
    const reader = response.body!.getReader();
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    const stream = new ReadableStream({
      async start(controller) {
        let buffer = "";
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            
            buffer += decoder.decode(value, { stream: true });
            
            let newlineIndex: number;
            while ((newlineIndex = buffer.indexOf("\n")) !== -1) {
              const line = buffer.slice(0, newlineIndex).trim();
              buffer = buffer.slice(newlineIndex + 1);
              
              if (!line.startsWith("data: ")) continue;
              const jsonStr = line.slice(6).trim();
              if (!jsonStr || jsonStr === "[DONE]") continue;
              
              try {
                const parsed = JSON.parse(jsonStr);
                const text = parsed?.candidates?.[0]?.content?.parts?.[0]?.text;
                if (text) {
                  // Convert to OpenAI-compatible format
                  const chunk = {
                    choices: [{
                      delta: { content: text },
                      index: 0,
                    }]
                  };
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`));
                }
              } catch {}
            }
          }
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        } catch (e) {
          console.error("Stream error:", e);
          controller.close();
        }
      }
    });

    return new Response(stream, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      },
    });
  } catch (e) {
    console.error("book-chat error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
