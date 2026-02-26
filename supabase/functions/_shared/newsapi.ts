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
  options: { language?: string; pageSize?: number; sortBy?: string; days?: number } = {},
): Promise<NewsArticle[]> {
  const NEWSAPI_KEY = Deno.env.get('NEWSAPI_KEY');
  if (!NEWSAPI_KEY) {
    console.warn('NEWSAPI_KEY not configured — skipping real news fetch');
    return [];
  }

  const { language = 'pt', pageSize = 10, sortBy = 'relevancy', days = 7 } = options;

  // Configurable time window (default 7 days)
  const from = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

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

/**
 * Perform multiple searches with different query strategies to maximize coverage.
 * Returns deduplicated articles.
 */
export async function fetchNewsMultiQuery(
  queries: string[],
  options: { language?: string; pageSize?: number; days?: number } = {},
): Promise<NewsArticle[]> {
  const seen = new Set<string>();
  const allArticles: NewsArticle[] = [];

  for (const query of queries) {
    if (!query || query.trim().length < 3) continue;
    const articles = await fetchNewsArticles(query.trim(), {
      ...options,
      pageSize: options.pageSize || 10,
      sortBy: 'relevancy',
    });
    for (const a of articles) {
      const key = a.url || a.title;
      if (!seen.has(key)) {
        seen.add(key);
        allArticles.push(a);
      }
    }
  }

  return allArticles;
}

/** Format articles into a text block the AI can digest */
export function formatArticlesForPrompt(articles: NewsArticle[]): string {
  if (articles.length === 0) return '(Nenhuma notícia recente encontrada via NewsAPI nos últimos 7 dias)';

  return articles
    .map(
      (a, i) =>
        `[${i + 1}] "${a.title}" — ${a.source} (${new Date(a.publishedAt).toLocaleDateString('pt-BR')})\n    URL: ${a.url}${a.description ? `\n    ${a.description}` : ''}`,
    )
    .join('\n\n');
}
