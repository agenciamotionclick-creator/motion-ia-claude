# Motion AI Imobiliário

Protótipo do assistente de atendimento imobiliário da Motion Click.

## Stack inicial

- React + TypeScript + Vite
- Tailwind CSS 4 + TailGrids UI components
- Vercel para prévias e hospedagem do front-end
- Supabase planejado para autenticação e banco de dados
- API do Claude (Anthropic) para as respostas do assistente, via `api/chat.ts` (função da Vercel)
- Meta WhatsApp Cloud API planejada para notificação de leads

## Rodar localmente

```bash
npm install
npx vercel dev   # roda o front-end e a rota /api/chat juntos (precisa de ANTHROPIC_API_KEY)
```

O projeto ainda está em modo de demonstração: o chat usa respostas locais, um lead de teste, conversa, observações e status ficam no armazenamento local deste navegador. O painel permite consultar a conversa, editar observações e alterar o status. Esses dados ainda não são enviados ao banco de dados nem sincronizados entre dispositivos. Nenhuma chave de integração é necessária nesta etapa.

## Segurança

- Nunca coloque segredos `ANTHROPIC_API_KEY`, tokens do WhatsApp ou chaves privilegiadas do Supabase em código `VITE_*`.
- Configure segredos no ambiente do servidor da Vercel quando os endpoints forem implementados.
- `.env.example` lista nomes previstos, sem valores reais.

## Pastas

- `src/` aplicação web
- `docs/` planejamento e arquitetura
- `assets/` logo, fotografias e materiais visuais enviados pela Motion Click
- `public/assets/` imagens usadas diretamente pela interface

