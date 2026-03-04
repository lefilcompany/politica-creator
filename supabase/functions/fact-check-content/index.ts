import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { CREDIT_COSTS } from '../_shared/creditCosts.ts';
import { checkUserCredits, deductUserCredits, recordUserCreditUsage } from '../_shared/userCredits.ts';
import { fetchPoliticalProfile, buildPoliticalContext } from '../_shared/politicalProfile.ts';
import { fetchNewsMultiQuery, formatArticlesForPrompt } from '../_shared/newsapi.ts';
import { callGemini, extractJSON } from '../_shared/geminiClient.ts';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { content } = await req.json();

    if (!content || typeof content !== 'string' || content.trim().length < 20) {
      return new Response(
        JSON.stringify({ error: 'Conteúdo é obrigatório (mínimo 20 caracteres)' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (content.length > 10000) {
      return new Response(
        JSON.stringify({ error: 'Conteúdo muito longo (máximo 10000 caracteres)' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Authorization required' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const creditCheck = await checkUserCredits(supabase, user.id, CREDIT_COSTS.FACT_CHECK);
    if (!creditCheck.hasCredits) {
      return new Response(
        JSON.stringify({ error: `Créditos insuficientes. Necessário: ${CREDIT_COSTS.FACT_CHECK}` }),
        { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const politicalProfile = await fetchPoliticalProfile(supabase, user.id);
    const politicalContext = buildPoliticalContext(politicalProfile);

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: 'AI not configured' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // ---- Step 1: Use AI to extract key claims and search queries ----
    const extractionResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [{
          role: "user",
          content: `Extraia do texto abaixo as principais AFIRMAÇÕES FACTUAIS que podem ser verificadas, e gere de 3 a 5 consultas de busca curtas (2-4 palavras cada) em português para pesquisar essas afirmações em notícias reais. Foque em nomes, datas, números, eventos, leis e dados citados.

Texto: "${content.trim().substring(0, 2000)}"

Responda APENAS com JSON:
{"claims": ["afirmação 1", "afirmação 2"], "searchQueries": ["consulta 1", "consulta 2", "consulta 3"]}`
        }],
        temperature: 0.1,
      }),
    });

    let searchQueries: string[] = [];
    let extractedClaims: string[] = [];

    if (extractionResponse.ok) {
      const extData = await extractionResponse.json();
      const extContent = extData.choices?.[0]?.message?.content || '';
      try {
        const jsonMatch = extContent.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          searchQueries = parsed.searchQueries || [];
          extractedClaims = parsed.claims || [];
        }
      } catch {
        console.warn('Failed to parse extraction response');
      }
    } else {
      await extractionResponse.text(); // consume body
    }

    // Fallback: extract key terms manually if AI extraction failed
    if (searchQueries.length === 0) {
      const contentSnippet = content.trim().substring(0, 500);
      const keyTerms = contentSnippet
        .split(/[\s,.\-;:!?()"""'']+/)
        .filter((w: string) => w.length > 3 && /^[A-ZÁÀÃÂÉÊÍÓÔÕÚÇ]/.test(w))
        .slice(0, 8)
        .join(' ');
      searchQueries = [keyTerms || contentSnippet.substring(0, 100)];
    }

    // ---- Step 2: Multi-query news search (7 days window) ----
    const articles = await fetchNewsMultiQuery(searchQueries, { pageSize: 10, days: 7 });
    const newsContext = formatArticlesForPrompt(articles);

    console.log(`Fact-check: ${searchQueries.length} queries, ${articles.length} articles found`);

    const today = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });

    const claimsContext = extractedClaims.length > 0
      ? `\n## AFIRMAÇÕES EXTRAÍDAS DO TEXTO:\n${extractedClaims.map((c, i) => `${i + 1}. ${c}`).join('\n')}\n`
      : '';

    const prompt = `${politicalContext}

# MISSÃO: VERIFICADOR DE CONTEÚDO (FACT-CHECK) RIGOROSO

Data de hoje: ${today}

Você é um fact-checker profissional premiado, especializado em verificação jornalística rigorosa. Sua reputação depende de PRECISÃO ABSOLUTA.

## CONTEÚDO A SER VERIFICADO:
"${content.trim()}"
${claimsContext}
## NOTÍCIAS REAIS ENCONTRADAS (últimos 7 dias via NewsAPI):
${newsContext}

## REGRAS DE VERIFICAÇÃO RIGOROSAS

1. **NUNCA invente fontes, dados ou informações.** Se não há evidência, diga claramente "sem verificação possível".
2. **Cruze CADA afirmação factual** com as notícias reais fornecidas. Busque correspondências de nomes, datas, números e eventos.
3. **Diferencie claramente entre:**
   - Fatos confirmados por fontes (cite a fonte específica com nome do veículo e data)
   - Fatos parcialmente confirmados (explique o que bate e o que diverge)
   - Afirmações sem possibilidade de verificação nas fontes disponíveis
   - Contradições diretas com fontes (cite qual fonte contradiz)
4. **Seja HONESTO sobre limitações:** Se as notícias encontradas não cobrem o tema, informe isso claramente no veredicto.
5. **Para cada alerta, SEMPRE inclua a fonte real** que sustenta sua análise (nome do veículo, URL e data).
6. **Opiniões não são fatos** — não marque opiniões como "imprecisão". Foque em dados, números, datas e eventos verificáveis.

## CATEGORIAS DE ALERTAS
- "confirmado" — Afirmação confirmada por fonte real (CITE A FONTE)
- "imprecisao" — Dados que contradizem fontes reais (CITE A FONTE que contradiz)
- "sem_fonte" — Afirmação factual sem comprovação nas fontes consultadas
- "exagero" — Exagero quantitativo ou generalização não sustentada por dados
- "risco_imagem" — Frase que pode ser usada contra o político em contexto adversário
- "desinformacao" — Conteúdo que contradiz fatos amplamente documentados

## SCORE DE CONFIABILIDADE (0-100)
- 90-100: Todas as afirmações factuais confirmadas por fontes
- 70-89: Maioria confirmada, poucas sem verificação
- 50-69: Há contradições com fontes ou muitas afirmações não verificáveis
- 30-49: Múltiplas imprecisões detectadas
- 0-29: Desinformação clara ou dados amplamente incorretos

IMPORTANTE: O score deve refletir a REALIDADE. Não infle o score. Se não há fontes para verificar, o score deve ser na faixa 50-69 (incerteza), NÃO 90+.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "user", content: prompt }],
        tools: [{
          type: "function",
          function: {
            name: "fact_check_result",
            description: "Return fact-check analysis results with real sources",
            parameters: {
              type: "object",
              properties: {
                score: { type: "number", description: "Score de confiabilidade 0-100 baseado em evidências reais" },
                verdict: { type: "string", enum: ["excelente", "bom", "atencao", "critico"], description: "Veredicto geral" },
                alerts: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      type: { type: "string", enum: ["imprecisao", "sem_fonte", "exagero", "risco_imagem", "desinformacao", "confirmado"] },
                      severity: { type: "string", enum: ["alta", "media", "baixa"] },
                      text: { type: "string", description: "Trecho EXATO do conteúdo analisado" },
                      explanation: { type: "string", description: "Explicação detalhada com base factual" },
                      suggestion: { type: "string", description: "Sugestão concreta de correção ou validação" },
                      source: { type: "string", description: "Nome do veículo/fonte que comprova ou contradiz" },
                      sourceUrl: { type: "string", description: "URL da fonte" },
                      sourceDate: { type: "string", description: "Data da publicação da fonte" },
                    },
                    required: ["type", "severity", "text", "explanation", "suggestion"],
                    additionalProperties: false,
                  },
                },
                overallSuggestion: { type: "string", description: "Recomendação geral detalhada para melhorar o conteúdo" },
                sources: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      name: { type: "string", description: "Nome do veículo" },
                      url: { type: "string", description: "URL da notícia" },
                      title: { type: "string", description: "Título da notícia" },
                      date: { type: "string", description: "Data de publicação" },
                    },
                    required: ["name", "title"],
                    additionalProperties: false,
                  },
                  description: "Lista de TODAS as fontes reais consultadas",
                },
                verificationSummary: { type: "string", description: "Resumo de 2-3 frases sobre o que foi possível verificar e o que não foi" },
              },
              required: ["score", "verdict", "alerts", "overallSuggestion", "sources", "verificationSummary"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "fact_check_result" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: 'Limite de requisições excedido.' }), { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: 'Créditos de IA esgotados.' }), { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      const t = await response.text();
      console.error("AI error:", response.status, t);
      return new Response(JSON.stringify({ error: 'Erro na IA' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    let result: any = { score: 0, verdict: 'critico', alerts: [], overallSuggestion: '', sources: [], verificationSummary: '' };

    if (toolCall?.function?.arguments) {
      result = JSON.parse(toolCall.function.arguments);
    }

    // ---- Step 4: Auto-verification pass — validate the AI's own response ----
    const validationPrompt = `Você é um auditor de qualidade de fact-checking. Analise a resposta gerada por outro verificador e CORRIJA erros.

## CONTEÚDO ORIGINAL VERIFICADO:
"${content.trim().substring(0, 1500)}"

## NOTÍCIAS REAIS DISPONÍVEIS:
${newsContext}

## RESPOSTA DO VERIFICADOR:
Score: ${result.score}/100 — Veredicto: ${result.verdict}
Alertas: ${JSON.stringify(result.alerts, null, 2)}
Fontes citadas: ${JSON.stringify(result.sources, null, 2)}
Resumo: ${result.verificationSummary || ''}

## SUA TAREFA DE AUDITORIA:
1. **Verifique cada fonte citada** — a fonte existe nas notícias reais fornecidas? Se não, REMOVA ou marque como "não verificável"
2. **Verifique datas** — as datas citadas nos alertas batem com as datas reais das notícias? Corrija discrepâncias
3. **Verifique coerência lógica** — se um alerta diz "confirmado" mas a notícia citada não confirma o dado específico, rebaixe para "sem_fonte"
4. **Verifique o score** — está coerente com a quantidade de alertas negativos? Ajuste se necessário:
   - Muitos "sem_fonte" + nenhum "confirmado" → score máximo 50
   - Maioria "confirmado" com fontes reais → score pode ser 80+
   - Dados que contradizem fontes → score máximo 40
5. **Verifique URLs** — remova URLs inventadas (que não aparecem nas notícias reais fornecidas)
6. **NÃO adicione informações novas** — apenas corrija o que já existe

Retorne a versão CORRIGIDA.`;

    try {
      const validationResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash-lite",
          messages: [{ role: "user", content: validationPrompt }],
          tools: [{
            type: "function",
            function: {
              name: "validated_fact_check",
              description: "Return the validated and corrected fact-check results",
              parameters: {
                type: "object",
                properties: {
                  score: { type: "number" },
                  verdict: { type: "string", enum: ["excelente", "bom", "atencao", "critico"] },
                  alerts: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        type: { type: "string", enum: ["imprecisao", "sem_fonte", "exagero", "risco_imagem", "desinformacao", "confirmado"] },
                        severity: { type: "string", enum: ["alta", "media", "baixa"] },
                        text: { type: "string" },
                        explanation: { type: "string" },
                        suggestion: { type: "string" },
                        source: { type: "string" },
                        sourceUrl: { type: "string" },
                        sourceDate: { type: "string" },
                      },
                      required: ["type", "severity", "text", "explanation", "suggestion"],
                      additionalProperties: false,
                    },
                  },
                  overallSuggestion: { type: "string" },
                  sources: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        name: { type: "string" },
                        url: { type: "string" },
                        title: { type: "string" },
                        date: { type: "string" },
                      },
                      required: ["name", "title"],
                      additionalProperties: false,
                    },
                  },
                  verificationSummary: { type: "string" },
                  corrections: { type: "string", description: "Resumo das correções feitas na auditoria" },
                },
                required: ["score", "verdict", "alerts", "overallSuggestion", "sources", "verificationSummary"],
                additionalProperties: false,
              },
            },
          }],
          tool_choice: { type: "function", function: { name: "validated_fact_check" } },
        }),
      });

      if (validationResponse.ok) {
        const valData = await validationResponse.json();
        const valToolCall = valData.choices?.[0]?.message?.tool_calls?.[0];
        if (valToolCall?.function?.arguments) {
          const validated = JSON.parse(valToolCall.function.arguments);
          console.log('Validation corrections:', validated.corrections || 'none');
          // Replace result with validated version (keep corrections info)
          const corrections = validated.corrections;
          delete validated.corrections;
          result = { ...validated, auditApplied: true, auditCorrections: corrections || null };
        }
      } else {
        console.warn('Validation pass failed, using original result');
        await validationResponse.text();
      }
    } catch (valError) {
      console.warn('Validation pass error, using original result:', valError);
    }

    // Deduct credits
    const deductResult = await deductUserCredits(supabase, user.id, CREDIT_COSTS.FACT_CHECK);
    if (deductResult.success) {
      await recordUserCreditUsage(supabase, {
        userId: user.id,
        teamId: creditCheck.teamId,
        actionType: 'FACT_CHECK',
        creditsUsed: CREDIT_COSTS.FACT_CHECK,
        creditsBefore: creditCheck.currentCredits,
        creditsAfter: deductResult.newCredits,
        description: `Verificação de conteúdo`,
      });
    }

    return new Response(
      JSON.stringify({
        ...result,
        articlesFound: articles.length,
        searchQueries,
        creditsUsed: CREDIT_COSTS.FACT_CHECK,
        remainingCredits: deductResult.newCredits,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (e) {
    console.error("fact-check-content error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : 'Erro desconhecido' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
