

## Entendi o problema

Hoje, as 32 teses do livro "A Próxima Democracia" são usadas apenas como contexto invisível no prompt da IA. O candidato **não pode escolher** qual tese quer usar como bandeira para seu post. As teses deveriam ser uma ferramenta ativa — o candidato seleciona a tese que quer defender e a IA cria 10 textos fundamentados naquela tese específica.

## Solução

Adicionar um **seletor de teses** no formulário de "Criar Texto", onde o candidato vê as 32 teses organizadas por grupo e escolhe uma (ou mais) como bandeira do post. A tese escolhida é enviada ao backend e se torna a diretriz principal da geração.

### Mudanças no Frontend (`CreateText.tsx`)

1. Criar uma lista das 32 teses organizadas nos 5 grupos (A-E) como constante
2. Adicionar um novo campo **"Escolha sua bandeira"** com as teses apresentadas como cards clicáveis ou um accordion por grupo
3. O candidato pode selecionar 1 tese principal (obrigatória ou opcional)
4. Mostrar um resumo da tese selecionada para o candidato entender o conceito
5. Enviar o `selectedThesis` (id + título) no body da request

### Mudanças no Backend (`generate-text/index.ts`)

1. Receber o campo `selectedThesis` do request
2. Se uma tese foi selecionada, alterar o prompt para:
   - Tornar aquela tese a **diretriz central** de todos os 10 textos
   - Cada texto deve abordar a mesma tese de ângulos e estilos diferentes
   - Traduzir o conceito acadêmico em linguagem eleitoral prática
3. Se nenhuma tese foi selecionada, manter o comportamento atual (IA escolhe livremente)

### Estrutura das 32 Teses (constante compartilhada)

Criar um arquivo `src/lib/theses.ts` com as 32 teses organizadas:
```text
Grupo A — Poder, Governança e Instituições (Teses 1-6)
Grupo B — Dinâmica Política (Teses 7-12)  
Grupo C — Narrativa, Afeto e Autenticidade (Teses 13-19)
Grupo D — Cidadania Expandida (Teses 20-25)
Grupo E — Complexidade, Resiliência e Ética (Teses 26-32)
```

Cada tese terá: `id`, `number`, `group`, `title`, `shortDescription` (1 frase acessível para o candidato entender).

### UX do seletor

- Accordion por grupo (A-E) com as teses dentro
- Cada tese é um card clicável com o título e uma descrição curta em linguagem simples (não acadêmica)
- Ao selecionar, destaca com borda primária
- Campo posicionado entre o textarea e os seletores opcionais
- Label: **"📚 Escolha a bandeira do seu post (opcional)"**
- Subtítulo: "Selecione uma tese do livro 'A Próxima Democracia' para fundamentar seus textos"

### Arquivos afetados

| Arquivo | Ação |
|---|---|
| `src/lib/theses.ts` | Criar — lista das 32 teses com descrições acessíveis |
| `src/pages/CreateText.tsx` | Editar — adicionar seletor de teses |
| `supabase/functions/generate-text/index.ts` | Editar — receber `selectedThesis` e ajustar prompt |

