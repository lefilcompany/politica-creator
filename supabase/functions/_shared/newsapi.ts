/**
 * NewsAPI.org helper — fetches recent news articles for given keywords.
 * Docs: https://newsapi.org/docs/endpoints/everything
 */

export interface NewsArticle {
  title: string;
  description: string | null;
  source: string;
  url: string;
  publishedAt: string;
}

export async function fetchNewsArticles(
  keywords: string,
  options: { language?: string; pageSize?: number; sortBy?: string } = {},
): Promise<NewsArticle[]> {
  const NEWSAPI_KEY = Deno.env.get('NEWSAPI_KEY');
  if (!NEWSAPI_KEY) {
    console.warn('NEWSAPI_KEY not configured — skipping real news fetch');
    return [];
  }

  const { language = 'pt', pageSize = 10, sortBy = 'publishedAt' } = options;

  // Last 24h
  const from = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const params = new URLSearchParams({
    q: keywords,
    language,
    sortBy,
    pageSize: String(pageSize),
    from,
    apiKey: NEWSAPI_KEY,
  });

  try {
    const res = await fetch(`https://newsapi.org/v2/everything?${params}`);
    if (!res.ok) {
      const t = await res.text();
      console.error('NewsAPI error:', res.status, t);
      return [];
    }

    const data = await res.json();
    return (data.articles || []).map((a: any) => ({
      title: a.title || '',
      description: a.description || null,
      source: a.source?.name || 'Desconhecido',
      url: a.url || '',
      publishedAt: a.publishedAt || '',
    }));
  } catch (err) {
    console.error('NewsAPI fetch failed:', err);
    return [];
  }
}

/** Format articles into a text block the AI can digest */
export function formatArticlesForPrompt(articles: NewsArticle[]): string {
  if (articles.length === 0) return '(Nenhuma notícia recente encontrada via NewsAPI)';

  return articles
    .map(
      (a, i) =>
        `[${i + 1}] "${a.title}" — ${a.source} (${new Date(a.publishedAt).toLocaleDateString('pt-BR')})${a.description ? `\n    ${a.description}` : ''}`,
    )
    .join('\n');
}
