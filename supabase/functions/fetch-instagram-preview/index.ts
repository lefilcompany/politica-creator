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
    const profileUrl = `https://www.instagram.com/${cleanHandle}/`;

    console.log('Fetching Instagram profile:', profileUrl);

    // Try multiple user agents to get past Instagram's blocks
    const userAgents = [
      'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
      'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    ];

    let html = '';
    let fetchSuccess = false;

    for (const ua of userAgents) {
      try {
        const response = await fetch(profileUrl, {
          headers: {
            'User-Agent': ua,
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
            'Cache-Control': 'no-cache',
          },
          redirect: 'follow',
        });

        if (response.ok) {
          html = await response.text();
          // Check if we got actual profile content (not just a login page)
          if (html.includes('og:title') || html.includes(`"username":"${cleanHandle}"`) || html.includes(`@${cleanHandle}`)) {
            fetchSuccess = true;
            console.log(`Success with UA: ${ua.substring(0, 30)}...`);
            break;
          }
        }
      } catch (e) {
        console.log(`Failed with UA: ${ua.substring(0, 30)}...`, e.message);
      }
    }

    // Extract Open Graph meta tags
    const ogTitle = html.match(/<meta\s+property="og:title"\s+content="([^"]*?)"/)?.[1]
      || html.match(/<meta\s+content="([^"]*?)"\s+property="og:title"/)?.[1];

    const ogDescription = html.match(/<meta\s+property="og:description"\s+content="([^"]*?)"/)?.[1]
      || html.match(/<meta\s+content="([^"]*?)"\s+property="og:description"/)?.[1];

    const ogImage = html.match(/<meta\s+property="og:image"\s+content="([^"]*?)"/)?.[1]
      || html.match(/<meta\s+content="([^"]*?)"\s+property="og:image"/)?.[1];

    const titleTag = html.match(/<title>([^<]*)<\/title>/)?.[1];

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

      const nameMatch = decoded.match(/from\s+(.+?)(?:\s*\(@|$)/i);
      if (nameMatch) displayName = nameMatch[1].trim();

      const bioTextMatch = decoded.match(/["""](.+?)["""]/);
      if (bioTextMatch) bio = bioTextMatch[1];
    }

    if (!displayName && ogTitle) {
      displayName = ogTitle.replace(/\s*\(.*?\)\s*/, '').replace(/•\s*Instagram.*/, '').trim();
    }

    if (!displayName && titleTag) {
      displayName = titleTag.replace(/\s*\(.*?\)\s*/, '').replace(/•\s*Instagram.*/, '').trim();
    }

    // Try to extract from JSON-LD or inline scripts
    if (!displayName) {
      const jsonMatch = html.match(/"name"\s*:\s*"([^"]+)"/);
      if (jsonMatch) displayName = jsonMatch[1];
    }

    const profileFound = !!(ogTitle || ogImage || displayName || fetchSuccess);

    if (!profileFound) {
      // If we couldn't scrape but the handle looks valid, return a minimal result
      // so the user can still save it
      console.log('Could not extract OG data, returning minimal profile');
      return new Response(
        JSON.stringify({
          success: true,
          data: {
            handle: cleanHandle,
            displayName: cleanHandle,
            profilePicture: null,
            followers: '',
            posts: '',
            bio: '',
            profileUrl,
            minimal: true,
          },
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Proxy the profile picture to avoid CORS/referrer blocks
    let profilePictureDataUrl: string | null = null;
    if (ogImage) {
      try {
        const imgResponse = await fetch(ogImage, {
          headers: {
            'User-Agent': 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
            'Referer': 'https://www.instagram.com/',
          },
        });
        if (imgResponse.ok) {
          const contentType = imgResponse.headers.get('content-type') || 'image/jpeg';
          const arrayBuffer = await imgResponse.arrayBuffer();
          const uint8 = new Uint8Array(arrayBuffer);
          let binary = '';
          for (let i = 0; i < uint8.length; i++) {
            binary += String.fromCharCode(uint8[i]);
          }
          const base64 = btoa(binary);
          profilePictureDataUrl = `data:${contentType};base64,${base64}`;
          console.log('Profile picture proxied successfully');
        }
      } catch (e) {
        console.log('Failed to proxy profile picture:', e.message);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          handle: cleanHandle,
          displayName: displayName || cleanHandle,
          profilePicture: profilePictureDataUrl,
          followers,
          posts,
          bio,
          profileUrl,
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
