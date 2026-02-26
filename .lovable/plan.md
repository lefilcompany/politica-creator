

# Combate a Fake News -- 3 Funcionalidades

## Visao Geral

Adicionar uma nova seção "Defesa Digital" na plataforma com 3 ferramentas:

1. **Monitor de Fake News** -- Pesquisa na web por menções falsas/negativas sobre o politico
2. **Gerador de Respostas** -- Dado um texto ou link de fake news, a IA gera um desmentido com tom adequado
3. **Verificador de Conteudo** -- Antes de publicar, analisa se o conteudo proprio contem imprecisoes

---

## 1. Nova pagina: Defesa Digital (`/defense`)

Uma pagina com 3 abas (tabs):
- **Monitorar** -- formulario para buscar fake news na web
- **Responder** -- colar texto/link de fake news e gerar resposta
- **Verificar** -- colar texto proprio para checagem de veracidade

Adicionar item no sidebar com icone Shield: "Defesa Digital"

---

## 2. Edge Function: `fake-news-monitor`

- Recebe: nome do politico, partido, termos-chave
- Usa Lovable AI (gemini-3-flash-preview) para:
  - Gerar queries de busca relevantes
  - Analisar resultados e classificar como "potencial fake news", "ataque infundado", "critica legitima"
- Retorna lista classificada com resumo e nivel de urgencia
- Custo: 2 creditos por busca

---

## 3. Edge Function: `fake-news-respond`

- Recebe: texto da fake news (ou link com conteudo colado pelo usuario), dados da identidade politica
- Usa Lovable AI para gerar:
  - Desmentido formal (para nota oficial)
  - Resposta para redes sociais (tom adequado ao perfil)
  - Pontos-chave para argumentacao
- Inclui contexto do perfil politico (biografia, tom de voz, bandeiras) para personalizar
- Custo: 3 creditos
- Retorna JSON com as 3 versoes

---

## 4. Edge Function: `fact-check-content`

- Recebe: texto do conteudo a ser publicado
- Usa Lovable AI para analisar:
  - Afirmacoes que podem ser verificadas
  - Dados/estatisticas sem fonte
  - Exageros ou generalizacoes perigosas
  - Linguagem que pode ser interpretada como desinformacao
- Retorna: score de confiabilidade (0-100), lista de alertas, sugestoes de melhoria
- Custo: 1 credito

---

## 5. Atualizacoes no Frontend

### Sidebar
- Novo item "Defesa Digital" com icone Shield entre "Planejar Conteudo" e "Historico"

### Pagina `/defense`
- Banner tematico
- 3 abas com formularios simples
- Aba Monitorar: campo de termos + botao buscar, resultados em cards coloridos por urgencia
- Aba Responder: textarea para colar fake news + selecao de identidade, resultado com 3 versoes copiáveis
- Aba Verificar: textarea para colar conteudo, resultado com score visual + lista de alertas

### Custos de Creditos
- Adicionar `FAKE_NEWS_MONITOR: 2`, `FAKE_NEWS_RESPOND: 3`, `FACT_CHECK: 1` em `creditCosts.ts`

---

## 6. Detalhes Tecnicos

- **Modelo IA**: `google/gemini-3-flash-preview` via Lovable AI Gateway (rapido e eficiente)
- **Autenticacao**: mesma do restante (Bearer token + verificacao de creditos)
- **Perfil politico**: reutilizar `fetchPoliticalProfile` e `buildPoliticalContext` do shared
- **Base de conhecimento**: injetar `KNOWLEDGE_BASE_CONTEXT` nos prompts para alinhar tom com principios da plataforma
- **Rota**: `/defense` adicionada ao App.tsx dentro do DashboardLayout
- **Nao precisa de novas tabelas** -- resultados sao exibidos em tempo real, sem persistencia (usuario pode salvar como acao se quiser no futuro)

