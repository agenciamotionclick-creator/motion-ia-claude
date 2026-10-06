// Carrega a ficha do imóvel NO SERVIDOR. O navegador só envia o "slug";
// nunca envia a ficha nem o prompt, para o visitante não poder manipulá-los.

export type Property = {
  name: string
  address: string
  city: string
  state: string
  description: string
  facts: Record<string, unknown>
}

// Fallback para testar só com a ANTHROPIC_API_KEY, antes de conectar o Supabase.
// Espelha supabase/seed.sql.
const FALLBACK: Record<string, Property> = {
  'ilha-pura': {
    name: 'Ilha Pura',
    address: 'Avenida Salvador Allende, 3200',
    city: 'Rio de Janeiro',
    state: 'RJ',
    description:
      'Bairro planejado na Barra Olímpica, região da Barra da Tijuca. Originalmente construído como Vila dos Atletas para os Jogos Olímpicos de 2016 e depois transformado em bairro residencial.',
    facts: {
      area: 'Mais de 800 mil m²',
      area_confirmation: 'Informação fornecida para o piloto; confirmar o escopo exato da área antes de divulgação.',
      origin: 'Vila dos Atletas dos Jogos Olímpicos de 2016',
      certification: 'LEED ND',
      certification_claim:
        'Primeiro bairro da América Latina a receber a certificação LEED ND; informação fornecida para o piloto.',
      prices: null,
      unit_specs: null,
    },
  },
}

export async function getProperty(slug: string): Promise<Property | null> {
  if (!/^[a-z0-9-]{1,80}$/.test(slug)) return null

  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (url && key) {
    const query = `slug=eq.${encodeURIComponent(slug)}&is_active=eq.true&select=name,address,city,state,description,facts&limit=1`
    const res = await fetch(`${url}/rest/v1/properties?${query}`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    })
    if (!res.ok) throw new Error(`Supabase respondeu ${res.status}`)
    const rows = (await res.json()) as Property[]
    return rows[0] ?? null
  }

  return FALLBACK[slug] ?? null
}
