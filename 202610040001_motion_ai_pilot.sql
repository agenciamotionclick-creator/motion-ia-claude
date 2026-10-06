-- Motion AI Imobiliario: multi-tenant foundation for the Ilha Pura pilot.
-- Apply this migration in the Supabase SQL Editor.

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.organization_memberships (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('motion_admin', 'broker')),
  created_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);
create index if not exists memberships_user_org_idx
  on public.organization_memberships (user_id, organization_id);

create table if not exists public.properties (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  slug text not null unique,
  name text not null,
  address text not null,
  city text not null,
  state text not null,
  description text not null default '',
  facts jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id)
);

create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  property_id uuid not null,
  name text not null,
  phone text not null,
  interest text not null default 'Comprar para morar',
  budget text,
  financing text,
  visit_interest text,
  status text not null default 'new' check (status in ('new', 'in_progress', 'scheduled', 'closed')),
  notes text not null default '',
  privacy_consent_at timestamptz not null,
  public_session_token_hash text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (organization_id, property_id)
    references public.properties(organization_id, id) on delete cascade
);

create index if not exists leads_org_created_idx on public.leads (organization_id, created_at desc);
create index if not exists leads_property_created_idx on public.leads (property_id, created_at desc);

create table if not exists public.lead_messages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  lead_id uuid not null,
  role text not null check (role in ('visitor', 'assistant')),
  content text not null check (length(content) between 1 and 8000),
  created_at timestamptz not null default now(),
  foreign key (organization_id, lead_id)
    references public.leads(organization_id, id) on delete cascade
);

create index if not exists lead_messages_lead_created_idx on public.lead_messages (lead_id, created_at);

create or replace function public.is_organization_member(target_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.organization_memberships membership
    where membership.organization_id = target_organization_id
      and membership.user_id = (select auth.uid())
  );
$$;

revoke all on function public.is_organization_member(uuid) from public;
grant execute on function public.is_organization_member(uuid) to authenticated;

alter table public.organizations enable row level security;
alter table public.organization_memberships enable row level security;
alter table public.properties enable row level security;
alter table public.leads enable row level security;
alter table public.lead_messages enable row level security;

drop policy if exists organizations_member_read on public.organizations;
create policy organizations_member_read on public.organizations
  for select to authenticated using (public.is_organization_member(id));

drop policy if exists memberships_member_read on public.organization_memberships;
create policy memberships_member_read on public.organization_memberships
  for select to authenticated using (public.is_organization_member(organization_id));

drop policy if exists properties_member_read on public.properties;
create policy properties_member_read on public.properties
  for select to authenticated using (public.is_organization_member(organization_id));

drop policy if exists properties_member_insert on public.properties;
create policy properties_member_insert on public.properties
  for insert to authenticated with check (public.is_organization_member(organization_id));

drop policy if exists properties_member_update on public.properties;
create policy properties_member_update on public.properties
  for update to authenticated
  using (public.is_organization_member(organization_id))
  with check (public.is_organization_member(organization_id));

drop policy if exists properties_member_delete on public.properties;
create policy properties_member_delete on public.properties
  for delete to authenticated using (public.is_organization_member(organization_id));

drop policy if exists leads_member_read on public.leads;
create policy leads_member_read on public.leads
  for select to authenticated using (public.is_organization_member(organization_id));

drop policy if exists leads_member_update on public.leads;
create policy leads_member_update on public.leads
  for update to authenticated
  using (public.is_organization_member(organization_id))
  with check (public.is_organization_member(organization_id));

drop policy if exists leads_member_delete on public.leads;
create policy leads_member_delete on public.leads
  for delete to authenticated using (public.is_organization_member(organization_id));

drop policy if exists lead_messages_member_read on public.lead_messages;
create policy lead_messages_member_read on public.lead_messages
  for select to authenticated using (public.is_organization_member(organization_id));

-- The public form can create leads for active properties through this function only.
-- Anonymous users receive no direct table privileges and cannot read inserted leads.
create or replace function public.create_public_lead(
  property_slug text,
  lead_name text,
  lead_phone text,
  consent_given boolean
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_property public.properties%rowtype;
  new_lead_id uuid;
  session_token uuid := gen_random_uuid();
  normalized_phone text;
begin
  if consent_given is distinct from true then
    raise exception 'Privacy consent is required.' using errcode = '22023';
  end if;
  if length(trim(coalesce(lead_name, ''))) < 2 or length(trim(lead_name)) > 120 then
    raise exception 'A valid name is required.' using errcode = '22023';
  end if;

  normalized_phone := regexp_replace(coalesce(lead_phone, ''), '[^0-9]', '', 'g');
  if length(normalized_phone) < 10 or length(normalized_phone) > 15 then
    raise exception 'A valid phone number is required.' using errcode = '22023';
  end if;

  select * into target_property
  from public.properties property
  where property.slug = create_public_lead.property_slug and property.is_active = true;
  if not found then
    raise exception 'Property not found.' using errcode = 'P0002';
  end if;

  insert into public.leads (
    organization_id, property_id, name, phone, privacy_consent_at, public_session_token_hash
  ) values (
    target_property.organization_id,
    target_property.id,
    trim(lead_name),
    normalized_phone,
    now(),
    encode(sha256(convert_to(session_token::text, 'UTF8')), 'hex')
  ) returning id into new_lead_id;

  return jsonb_build_object('lead_id', new_lead_id, 'session_token', session_token);
end;
$$;

revoke all on function public.create_public_lead(text, text, text, boolean) from public;
grant execute on function public.create_public_lead(text, text, text, boolean) to anon, authenticated;

create or replace function public.append_public_lead_message(
  session_token uuid,
  message_role text,
  message_content text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_lead public.leads%rowtype;
  new_message_id uuid;
begin
  if message_role not in ('visitor', 'assistant') then
    raise exception 'Invalid message role.' using errcode = '22023';
  end if;
  if length(trim(coalesce(message_content, ''))) not between 1 and 8000 then
    raise exception 'Invalid message content.' using errcode = '22023';
  end if;

  select * into target_lead from public.leads lead
  where lead.public_session_token_hash =
    encode(sha256(convert_to(session_token::text, 'UTF8')), 'hex');
  if not found then
    raise exception 'Conversation not found.' using errcode = 'P0002';
  end if;

  insert into public.lead_messages (organization_id, lead_id, role, content)
  values (target_lead.organization_id, target_lead.id, message_role, trim(message_content))
  returning id into new_message_id;
  return new_message_id;
end;
$$;

revoke all on function public.append_public_lead_message(uuid, text, text) from public;
grant execute on function public.append_public_lead_message(uuid, text, text) to anon, authenticated;

revoke all on public.organizations, public.organization_memberships, public.properties,
  public.leads, public.lead_messages from anon;
grant select on public.organizations, public.organization_memberships, public.properties,
  public.leads, public.lead_messages to authenticated;
grant insert on public.properties to authenticated;
grant update (slug, name, address, city, state, description, facts, is_active, updated_at)
  on public.properties to authenticated;
grant update (interest, budget, financing, visit_interest, status, notes, updated_at)
  on public.leads to authenticated;
grant select on public.lead_messages to authenticated;

