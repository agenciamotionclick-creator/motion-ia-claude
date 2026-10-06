import Anthropic from '@anthropic-ai/sdk'
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getProperty } from './_property'
import { buildSystemPrompt, qualificationTool } from './_prompt'

// Haiku 4.5 = mais barato e rápido. Para respostas mais refinadas, defina
// ANTHROPIC_MODEL=claude-sonnet-5-5 nas variáveis de ambiente da Vercel.
const MODEL = process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5-20251001'
const MAX_MESSAGES = 20
const MAX_CHARS = 2000

type Turn = { role: 'user' | 'assistant'; content: string }

// Limite simples por IP (melhor esforço: a memória da função serverless não é compartilhada).
// Para produção, trocar por Upstash/Redis ou pelo Vercel Firewall.
const hits = new Map<string, number[]>()
function rateLimited(ip: string): boolean {
  const now = Date.now()
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < 10 * 60 * 1000)
  recent.push(now)
  hits.set(ip, recent)
  return recent.length > 30
}

function cleanMessages(input: unknown): Turn[] | null {
  if (!Array.isArray(input) || input.length === 0) return null
  const turns: Turn[] = []
  for (const item of input.slice(-MAX_MESSAGES)) {
    const role = (item as Turn)?.role
    const content = (item as Turn)?.content
    if ((role !== 'user' && role !== 'assistant') || typeof content !== 'string') return null
    const text = content.trim().slice(0, MAX_CHARS)
    if (text) turns.push({ role, content: text })
  }
  while (turns.length && turns[0].role !== 'user') turns.shift() // a API exige começar por "user"
  return turns.length && turns[turns.length - 1].role === 'user' ? turns : null
}

const STR_FIELDS = ['faixa_investimento', 'quartos', 'regiao_interesse', 'duvida_para_corretor'] as const
const ENUM_FIELDS: Record<string, string[]> = {
  finalidade: ['morar', 'investir'],
  financiamento: ['sim', 'nao', 'talvez'],
  interesse_visita: ['sim', 'nao', 'talvez'],
}

function sanitize(input: unknown): Record<string, string | boolean> {
  const out: Record<string, string | boolean> = {}
  const src = (input ?? {}) as Record<string, unknown>
  for (const k of STR_FIELDS) if (typeof src[k] === 'string' && src[k]) out[k] = (src[k] as string).slice(0, 300)
  for (const [k, allowed] of Object.entries(ENUM_FIELDS)) {
    if (typeof src[k] === 'string' && allowed.includes(src[k] as string)) out[k] = src[k] as string
  }
  if (src.pedir_corretor === true) out.pedir_corretor = true
  return out
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido.' })

  const ip = String(req.headers['x-forwarded-for'] ?? '').split(',')[0].trim() || 'unknown'
  if (rateLimited(ip)) return res.status(429).json({ error: 'Muitas mensagens. Tente novamente em alguns minutos.' })

  const body = (req.body ?? {}) as { propertySlug?: unknown; messages?: unknown }
  const turns = cleanMessages(body.messages)
  if (typeof body.propertySlug !== 'string' || !turns) return res.status(400).json({ error: 'Requisição inválida.' })

  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('ANTHROPIC_API_KEY não configurada')
    return res.status(500).json({ error: 'Assistente indisponível no momento.' })
  }

  try {
    const property = await getProperty(body.propertySlug)
    if (!property) return res.status(404).json({ error: 'Imóvel não encontrado.' })

    const client = new Anthropic() // lê ANTHROPIC_API_KEY do ambiente
    const system = buildSystemPrompt(property)
    const messages: Anthropic.MessageParam[] = turns.map((t) => ({ role: t.role, content: t.content }))
    const qualification: Record<string, string | boolean> = {}
    let reply = ''

    // Até 3 rodadas: o Claude pode chamar a ferramenta e, depois, escrever a resposta final.
    for (let round = 0; round < 3; round++) {
      const response = await client.messages.create({
        model: MODEL,
        max_tokens: 600,
        system,
        tools: [qualificationTool],
        messages,
      })

      const toolUses = response.content.filter((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use')
      if (response.stop_reason === 'tool_use' && toolUses.length) {
        messages.push({ role: 'assistant', content: response.content })
        messages.push({
          role: 'user',
          content: toolUses.map((t) => ({ type: 'tool_result' as const, tool_use_id: t.id, content: 'Registrado.' })),
        })
        for (const t of toolUses) Object.assign(qualification, sanitize(t.input))
        continue
      }

      reply = response.content
        .filter((b): b is Anthropic.TextBlock => b.type === 'text')
        .map((b) => b.text)
        .join('\n')
        .trim()
      break
    }

    if (!reply) reply = 'Posso encaminhar sua dúvida ao corretor, que vai falar com você em breve.'
    return res.status(200).json({ reply, qualification })
  } catch (error) {
    console.error('Erro no /api/chat:', error)
    return res.status(502).json({ error: 'Não consegui responder agora. Tente novamente.' })
  }
}
