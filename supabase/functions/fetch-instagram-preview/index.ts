const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { handle } = await req.json();

    if (!handle || typeof handle !== 'string') {
      return new Response(
        JSON.stringify({ success: false, error: 'Handle is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const cleanHandle = handle.replace(/[^a-zA-Z0-9._]/g, '');
    const url = `https://www.instagram.com/${cleanHandle}/`;

    console.log('Fetching Instagram profile:', url);

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
      },
    });

    if (!response.ok) {
      return new Response(
        JSON.stringify({ success: false, error: 'Perfil não encontrado' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const html = await response.text();

    // Extract Open Graph meta tags
    const ogTitle = html.match(/<meta\s+property="og:title"\s+content="([^"]*?)"/)?.[1]
      || html.match(/<meta\s+content="([^"]*?)"\s+property="og:title"/)?.[1];

    const ogDescription = html.match(/<meta\s+property="og:description"\s+content="([^"]*?)"/)?.[1]
      || html.match(/<meta\s+content="([^"]*?)"\s+property="og:description"/)?.[1];

    const ogImage = html.match(/<meta\s+property="og:image"\s+content="([^"]*?)"/)?.[1]
      || html.match(/<meta\s+content="([^"]*?)"\s+property="og:image"/)?.[1];

    // Extract from title tag as fallback
    const titleTag = html.match(/<title>([^<]*)<\/title>/)?.[1];

    // Try to extract follower info from description
    // Format: "123K Followers, 456 Following, 789 Posts - See Instagram photos and videos from Name (@handle)"
    let followers = '';
    let posts = '';
    let displayName = '';
    let bio = '';

    if (ogDescription) {
      const decoded = ogDescription.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#x27;/g, "'");
      
      const followersMatch = decoded.match(/([\d,.]+[KkMm]?)\s*Followers/i)
        || decoded.match(/([\d,.]+[KkMm]?)\s*Seguidores/i);
      if (followersMatch) followers = followersMatch[1];

      const postsMatch = decoded.match(/([\d,.]+[KkMm]?)\s*Posts/i)
        || decoded.match(/([\d,.]+[KkMm]?)\s*Publicações/i);
      if (postsMatch) posts = postsMatch[1];

      // Extract the bio part after the dash
      const bioMatch = decoded.match(/from\s+(.+?)(?:\s*\(@|$)/i);
      if (bioMatch) displayName = bioMatch[1].trim();

      // Try to get bio text
      const bioTextMatch = decoded.match(/["""](.+?)["""]/);
      if (bioTextMatch) bio = bioTextMatch[1];
    }

    if (!displayName && ogTitle) {
      displayName = ogTitle.replace(/\s*\(.*?\)\s*/, '').replace(/•\s*Instagram.*/, '').trim();
    }

    if (!displayName && titleTag) {
      displayName = titleTag.replace(/\s*\(.*?\)\s*/, '').replace(/•\s*Instagram.*/, '').trim();
    }

    const profileFound = !!(ogTitle || ogImage || displayName);

    if (!profileFound) {
      return new Response(
        JSON.stringify({ success: false, error: 'Não foi possível carregar o perfil' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          handle: cleanHandle,
          displayName: displayName || cleanHandle,
          profilePicture: ogImage || null,
          followers,
          posts,
          bio,
          profileUrl: url,
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error fetching Instagram preview:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'Erro ao buscar perfil' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
