import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { fetchPoliticalProfile, buildPoliticalContext } from '../_shared/politicalProfile.ts';
import { fetchNewsArticles, formatArticlesForPrompt } from '../_shared/newsapi.ts';
import { callGemini, extractJSON } from '../_shared/geminiClient.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Não autorizado' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Não autorizado' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { topic, tags, subtags, days = 1 } = await req.json();

    if (!topic) {
      return new Response(JSON.stringify({ error: 'Tópico é obrigatório' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch political profile for context
    const profile = await fetchPoliticalProfile(supabase, user.id);
    const politicalContext = buildPoliticalContext(profile);

    const tagsContext = tags?.length ? `Tags: ${tags.join(', ')}` : '';
    const subtagsContext = subtags?.length ? `Subtags: ${subtags.join(', ')}` : '';

    // ---- BUSCA REAL via NewsAPI (últimas 24h) ----
    const searchTerms = [topic, ...(tags || []), ...(subtags || [])].join(' ');
    const articles = await fetchNewsArticles(searchTerms, { pageSize: 15 });
    const newsContext = formatArticlesForPrompt(articles);

    const today = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });

    const prompt = `Você é um analista político especializado em monitoramento de sinais para comunicação institucional.

${politicalContext}

Data de hoje: ${today}

# TAREFA
Analise o tema "${topic}" com base nas NOTÍCIAS REAIS encontradas abaixo (últimas 24 horas via NewsAPI).

${tagsContext}
${subtagsContext}

## NOTÍCIAS REAIS ENCONTRADAS:
${newsContext}

# CATEGORIAS DE SINAIS
Classifique cada sinal em uma das categorias:
1. **fato_confirmado** — Fatos publicados em fontes oficiais (Diário Oficial, portais de governo, IBGE, institutos de pesquisa)
2. **noticia_local** — Notícias de veículos de imprensa local/regional
3. **dado_publico** — Dados estatísticos, indicadores, relatórios públicos
4. **release_institucional** — Comunicados de órgãos públicos, notas oficiais
5. **rumor** — Alegações em circulação sem confirmação formal (redes sociais, "ouvi dizer")
6. **tendencia** — Tendências observadas no debate público sobre o tema

# FORMATO DE RESPOSTA
Responda APENAS com um JSON válido no formato:
{
  "signals": [
    {
      "title": "Título curto do sinal",
      "description": "Descrição objetiva do sinal (2-3 frases)",
      "category": "fato_confirmado|noticia_local|dado_publico|release_institucional|rumor|tendencia",
      "status": "verificado|nao_verificado|parcialmente_verificado",
      "relevance": "alta|media|baixa",
      "source_hint": "Nome do veículo / fonte real",
      "date_hint": "Data de publicação real"
    }
  ],
  "summary": "Resumo de 2-3 frases sobre o cenário atual do tema",
  "recommendation": "Recomendação estratégica de 1-2 frases para o político"
}

IMPORTANTE:
- Baseie-se SOMENTE nas notícias reais fornecidas acima.
- Use os nomes de fontes e datas reais das notícias.
- Marque claramente rumores como "nao_verificado".
- Se não houver notícias relevantes, retorne lista vazia com resumo explicando.`;

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: 'API key não configurada' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.4,
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error('AI API error:', errText);
      return new Response(JSON.stringify({ error: 'Erro ao consultar IA' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const aiData = await aiResponse.json();
    const content = aiData.choices?.[0]?.message?.content || '';

    // Parse JSON from response
    let result;
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      result = jsonMatch ? JSON.parse(jsonMatch[0]) : { signals: [], summary: '', recommendation: '' };
    } catch {
      console.error('Failed to parse AI response:', content);
      result = { signals: [], summary: content, recommendation: '' };
    }

    return new Response(JSON.stringify({ ...result, articlesFound: articles.length }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in collect-signals:', error);
    return new Response(JSON.stringify({ error: 'Erro interno' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
