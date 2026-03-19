const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
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

    let displayName = '';
    let profilePictureUrl = '';
    let followers = '';
    let posts = '';
    let bio = '';
    let fetchSuccess = false;

    // Strategy 1: Try Instagram's web_profile_info API
    try {
      const apiUrl = `https://i.instagram.com/api/v1/users/web_profile_info/?username=${cleanHandle}`;
      const apiResponse = await fetch(apiUrl, {
        headers: {
          'User-Agent': 'Instagram 275.0.0.27.98 Android (33/13; 420dpi; 1080x2400; samsung; SM-G991B; o1s; exynos2100; en_US; 458229258)',
          'X-IG-App-ID': '936619743392459',
        },
      });
      if (apiResponse.ok) {
        const json = await apiResponse.json();
        const user = json?.data?.user;
        if (user) {
          displayName = user.full_name || cleanHandle;
          profilePictureUrl = user.profile_pic_url_hd || user.profile_pic_url || '';
          followers = formatCount(user.edge_followed_by?.count);
          posts = formatCount(user.edge_owner_to_timeline_media?.count);
          bio = user.biography || '';
          fetchSuccess = true;
          console.log('Strategy 1 (API) succeeded');
        }
      } else {
        const text = await apiResponse.text();
        console.log('Strategy 1 response status:', apiResponse.status, text.substring(0, 200));
      }
    } catch (e) {
      console.log('Strategy 1 failed:', e.message);
    }

    // Strategy 2: Try fetching the profile page with various user agents
    if (!fetchSuccess) {
      const userAgents = [
        'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
        'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
        'Twitterbot/1.0',
      ];

      for (const ua of userAgents) {
        try {
          const response = await fetch(profileUrl, {
            headers: {
              'User-Agent': ua,
              'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
              'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
            },
            redirect: 'follow',
          });

          if (response.ok) {
            const html = await response.text();

            const ogTitle = html.match(/<meta[^>]+property="og:title"[^>]+content="([^"]*?)"/)?.[1]
              || html.match(/<meta[^>]+content="([^"]*?)"[^>]+property="og:title"/)?.[1];

            const ogDescription = html.match(/<meta[^>]+property="og:description"[^>]+content="([^"]*?)"/)?.[1]
              || html.match(/<meta[^>]+content="([^"]*?)"[^>]+property="og:description"/)?.[1];

            const ogImage = html.match(/<meta[^>]+property="og:image"[^>]+content="([^"]*?)"/)?.[1]
              || html.match(/<meta[^>]+content="([^"]*?)"[^>]+property="og:image"/)?.[1];

            if (ogTitle || ogImage || ogDescription) {
              fetchSuccess = true;
              console.log(`Strategy 2 succeeded with UA: ${ua.substring(0, 30)}...`);

              if (ogImage) profilePictureUrl = ogImage;

              if (ogDescription) {
                const decoded = ogDescription.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#x27;/g, "'");
                const followersMatch = decoded.match(/([\d,.]+[KkMm]?)\s*(?:Followers|Seguidores)/i);
                if (followersMatch) followers = followersMatch[1];
                const postsMatch = decoded.match(/([\d,.]+[KkMm]?)\s*(?:Posts|Publicações)/i);
                if (postsMatch) posts = postsMatch[1];
                const bioTextMatch = decoded.match(/["""](.+?)["""]/);
                if (bioTextMatch) bio = bioTextMatch[1];
              }

              if (ogTitle) {
                displayName = ogTitle.replace(/\s*\(.*?\)\s*/, '').replace(/•\s*Instagram.*/, '').trim();
              }

              break;
            }
          } else {
            await response.text(); // consume body
          }
        } catch (e) {
          console.log(`Strategy 2 failed with UA: ${ua.substring(0, 30)}...`, e.message);
        }
      }
    }

    if (!displayName) displayName = cleanHandle;

    // Proxy the profile picture to avoid CORS issues
    let profilePictureDataUrl: string | null = null;
    if (profilePictureUrl) {
      try {
        const imgResponse = await fetch(profilePictureUrl, {
          headers: {
            'User-Agent': 'Instagram 275.0.0.27.98 Android',
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
          console.log('Profile picture proxied successfully, size:', arrayBuffer.byteLength);
        } else {
          console.log('Image fetch failed with status:', imgResponse.status);
          await imgResponse.text();
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
          displayName,
          profilePicture: profilePictureDataUrl,
          followers,
          posts,
          bio,
          profileUrl,
          minimal: !fetchSuccess,
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

function formatCount(count: number | undefined): string {
  if (!count && count !== 0) return '';
  if (count >= 1_000_000) return (count / 1_000_000).toFixed(1).replace('.0', '') + 'M';
  if (count >= 1_000) return (count / 1_000).toFixed(1).replace('.0', '') + 'K';
  return count.toString();
}