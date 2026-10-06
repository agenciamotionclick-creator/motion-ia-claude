# Arquitetura do MVP — Motion AI Imobiliário

## Fluxo

Página do imóvel → aviso de privacidade e consentimento → coleta de nome e WhatsApp → assistente responde com dados cadastrados → coleta de qualificação → lead no painel → notificação ao corretor.

## Componentes previstos

1. **Aplicação web:** React + TypeScript + Vite, Tailwind CSS 4 e componentes TailGrids, com página pública do imóvel e painel responsivo. A marca usa o símbolo C/play fornecido pela Motion Click.
2. **Deploy:** Vercel conectada ao repositório GitHub. Cada push gera uma implantação de prévia.
3. **API de servidor:** funções da Vercel para conversar com o Claude (API da Anthropic), persistir leads e enviar a notificação. Segredos só no ambiente server-side.
4. **Persistência e autenticação:** Supabase/PostgreSQL. A base inicial está em `supabase/migrations/202610040001_motion_ai_pilot.sql`: organizações, vínculos de usuário e papel, imóveis, leads e mensagens.
5. **Isolamento por cliente:** toda entidade de negócio carrega `client_id`; políticas de acesso no banco restringem consultas ao cliente autorizado. O papel de administrador Motion Click é separado do papel de corretor.
6. **IA:** o backend carrega apenas a ficha do imóvel associado à sessão. Respostas sem suporte na ficha geram encaminhamento ao corretor. A ficha de teste está em `supabase/seed.sql`.
7. **WhatsApp:** Meta WhatsApp Cloud API para notificar o corretor sobre novo lead; configurar conta comercial, número, credenciais, webhook e eventual template aprovado.

## Estado desta primeira entrega

A interface é demonstrativa e usa o Ilha Pura como projeto de teste. O chat, lead, conversa, observações e status ficam no `localStorage` do navegador; ainda não há persistência central, autenticação, chamada ao Claude ou envio WhatsApp. Limpar os dados do site no navegador apaga esse lead de demonstração. A ficha do piloto registra o endereço na Avenida Salvador Allende, 3200, Barra Olímpica, o uso original como Vila dos Atletas nos Jogos Rio 2016 e a certificação LEED ND conforme as informações fornecidas para o projeto. A área superior a 800 mil m² também foi fornecida para o teste, mas seu escopo precisa ser confirmado antes de divulgação. Preços, disponibilidade e especificações de unidades não foram cadastrados; o assistente deve encaminhar essas dúvidas ao corretor. O formulário informa que os dados ficam apenas no navegador.

## Caminho de desenvolvimento

1. Aprovar visual e fluxo do protótipo.
2. Criar projeto Supabase e aplicar a migração e a ficha seed conforme `docs/SUPABASE-SETUP.md`.
3. Conectar autenticação do administrador e corretor ao app e criar o primeiro vínculo de organização.
4. Implementar endpoints server-side para IA e lead.
5. Configurar WhatsApp Cloud API e notificação.
6. Verificar permissões, privacidade, logs e custos com um piloto.
