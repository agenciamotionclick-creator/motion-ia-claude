-- Test seed for Motion Click. No user accounts or leads are created here.
with organization as (
  insert into public.organizations (name, slug)
  values ('Motion Click · Piloto Ilha Pura', 'motion-click-ilha-pura')
  on conflict (slug) do update set name = excluded.name
  returning id
)
insert into public.properties (
  organization_id, slug, name, address, city, state, description, facts
)
select
  organization.id,
  'ilha-pura',
  'Ilha Pura',
  'Avenida Salvador Allende, 3200',
  'Rio de Janeiro',
  'RJ',
  'Bairro planejado na Barra Olímpica, região da Barra da Tijuca. Originalmente construído como Vila dos Atletas para os Jogos Olímpicos de 2016 e depois transformado em bairro residencial.',
  jsonb_build_object(
    'area', 'Mais de 800 mil m²',
    'area_confirmation', 'Informação fornecida para o piloto; confirmar o escopo exato da área antes de divulgação.',
    'origin', 'Vila dos Atletas dos Jogos Olímpicos de 2016',
    'certification', 'LEED ND',
    'certification_claim', 'Primeiro bairro da América Latina a receber a certificação LEED ND; informação fornecida para o piloto.',
    'prices', null,
    'unit_specs', null
  )
from organization
on conflict (slug) do update set
  name = excluded.name,
  address = excluded.address,
  city = excluded.city,
  state = excluded.state,
  description = excluded.description,
  facts = excluded.facts,
  is_active = true,
  updated_at = now();

