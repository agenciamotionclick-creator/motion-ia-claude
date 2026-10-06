# Preparar o Supabase para o piloto

1. Crie um projeto Supabase para o Motion AI Imobiliário.
2. No **SQL Editor**, execute a migração \`supabase/migrations/202610040001_motion_ai_pilot.sql\`.
3. Execute \`supabase/seed.sql\` para cadastrar a organização de teste e o projeto Ilha Pura.
4. Em **Authentication → Users**, crie convites/usuários para o administrador Motion Click e o corretor.
5. Copie os UUIDs desses usuários. No SQL Editor, associe cada pessoa à organização do piloto (troque os UUIDs pelos reais):

\`\`\`sql
insert into public.organization_memberships (organization_id, user_id, role)
select organization.id, 'UUID-DO-USUARIO'::uuid, 'motion_admin'
from public.organizations organization
where organization.slug = 'motion-click-ilha-pura';

-- Repita para o corretor, usando role = 'broker'.
\`\`\`

6. Guarde a URL do projeto e a chave **publishable** para a próxima etapa de conexão do app. Não envie chaves secret/service_role pelo chat e nunca as coloque em variáveis \`VITE_*\`.

A migração ativa RLS nas tabelas e isola dados por organização. O formulário público cria leads apenas pela função \`create_public_lead\`; visitantes não recebem acesso de leitura às tabelas. A sessão pública de conversa usa um token aleatório cujo hash é armazenado no banco.

## Situação atual

O app publicado ainda usa armazenamento local do navegador. Aplicar a migração prepara o banco, mas a troca do app para persistência Supabase será feita depois de conectar as credenciais. A organização seed não cria uma conta de login automaticamente.

