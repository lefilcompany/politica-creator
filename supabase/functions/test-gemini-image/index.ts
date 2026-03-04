import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
    if (!GEMINI_API_KEY) {
      return new Response(JSON.stringify({ error: 'GEMINI_API_KEY not configured' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log('🧪 Testing Gemini image generation...');

    // Try gemini-2.0-flash-exp-image-generation model
    const model = 'gemini-2.0-flash-preview-image-generation';
    console.log('Using model:', model);
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: 'Generate a simple image of a blue circle on a white background.' }] }],
        generationConfig: {
          responseModalities: ['TEXT', 'IMAGE'],
        },
      }),
    });

    console.log('📡 Gemini status:', response.status);

    if (!response.ok) {
      const errText = await response.text();
      console.error('❌ Gemini error:', errText);
      return new Response(JSON.stringify({ 
        error: `Gemini API error: ${response.status}`,
        details: errText 
      }), {
        status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const data = await response.json();
    const parts = data.candidates?.[0]?.content?.parts || [];
    
    let hasImage = false;
    let hasText = false;
    let imageMimeType = '';
    let imageDataLength = 0;
    let textContent = '';

    for (const part of parts) {
      if (part.inlineData?.data) {
        hasImage = true;
        imageMimeType = part.inlineData.mimeType || 'unknown';
        imageDataLength = part.inlineData.data.length;
      }
      if (part.text) {
        hasText = true;
        textContent = part.text.substring(0, 200);
      }
    }

    console.log('✅ Results:', { hasImage, hasText, imageMimeType, imageDataLength });

    return new Response(JSON.stringify({
      success: true,
      hasImage,
      hasText,
      imageMimeType,
      imageDataLengthBase64: imageDataLength,
      textPreview: textContent,
      partsCount: parts.length,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ Error:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
