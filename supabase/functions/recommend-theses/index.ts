import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { fetchPoliticalProfile } from '../_shared/politicalProfile.ts';
import { KNOWLEDGE_BASE_CONTEXT } from '../_shared/knowledgeBase.ts';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Authorization required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const profile = await fetchPoliticalProfile(supabase, user.id);

    const profileSummary = profile ? [
      profile.political_role && `Cargo: ${profile.political_role}`,
      profile.political_party && `Partido: ${profile.political_party}`,
      profile.political_level && `Nível: ${profile.political_level}`,
      profile.political_experience && `Experiência: ${profile.political_experience}`,
      profile.mandate_stage && `Fase: ${profile.mandate_stage}`,
      profile.focus_areas?.length && `Áreas de foco: ${profile.focus_areas.join(', ')}`,
      profile.biography && `Biografia: ${profile.biography}`,
      profile.tone_of_voice && `Tom de voz: ${profile.tone_of_voice}`,
      profile.target_audience_description && `Público-alvo: ${profile.target_audience_description}`,
    ].filter(Boolean).join('\n') : 'Perfil não preenchido';

    const prompt = `${KNOWLEDGE_BASE_CONTEXT}

# PERFIL DO POLÍTICO
${profileSummary}

# SUA TAREFA
Analise o perfil político acima e selecione as 5 teses (das 32 teses do livro "A Próxima Democracia") que são MAIS RELEVANTES para esse político, considerando seu cargo, áreas de foco, fase do mandato, biografia e público-alvo.

Para cada tese, explique em 2-3 frases POR QUE ela é especialmente relevante para esse perfil específico, conectando a tese com a realidade prática do político.

RESPONDA EXCLUSIVAMENTE em JSON válido com esta estrutura:
{
  "theses": [
    {
      "number": 1,
      "title": "Título da tese",
      "group": "A",
      "relevance": "Explicação de por que essa tese é relevante para esse político específico"
    }
  ]
}

RETORNE APENAS O JSON.`;

    const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
    if (!geminiApiKey) {
      throw new Error('GEMINI_API_KEY is not configured');
    }
    
    let responseContent: string;
    
    console.log("🔄 [THESES] Calling Gemini API...");
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiApiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.5,
          maxOutputTokens: 4096,
        },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("❌ [THESES] Gemini error:", errText);
      throw new Error(`Gemini API error: ${response.status}`);
    }

    const data = await response.json();
    console.log("📝 [THESES] Gemini response status:", data.candidates?.[0]?.finishReason);
    responseContent = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    
    if (!responseContent) {
      console.error("❌ [THESES] Empty response from Gemini. Full response:", JSON.stringify(data).substring(0, 500));
      throw new Error('Empty AI response');
    }

    // Parse JSON from response - strip markdown code blocks if present
    let cleanedResponse = responseContent.trim();
    // Remove all markdown code block wrappers
    cleanedResponse = cleanedResponse.replace(/```json\s*/gi, '').replace(/```\s*/g, '');
    
    const jsonMatch = cleanedResponse.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error("❌ [THESES] Raw response:", responseContent.substring(0, 500));
      throw new Error('Invalid AI response format');
    }

    let parsed;
    try {
      parsed = JSON.parse(jsonMatch[0]);
    } catch (parseErr) {
      console.error("❌ [THESES] JSON parse error:", parseErr.message, "Content:", jsonMatch[0].substring(0, 300));
      throw new Error('Failed to parse AI response JSON');
    }

    console.log("✅ [THESES] Recommended", parsed.theses?.length, "theses");

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error("❌ [THESES] Error:", error);
    return new Response(JSON.stringify({ error: error.message || 'Internal error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
