import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Badge } from '@/components/tailgrids/core/badge'
import { Button } from '@/components/tailgrids/core/button'

type Message = { from: 'assistant' | 'visitor'; text: string }
type Lead = { name: string; phone: string; interest: string; budget: string; financing: string; visit: string; status: string; notes: string }
type DemoSession = { lead: Lead | null; messages: Message[] }
const STORAGE_KEY = 'motion-ai-ilha-pura-demo'

function readDemoSession(): DemoSession | null {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null') as DemoSession | null } catch { return null }
}

const property = {
  title: 'Um bairro planejado para viver.',
  name: 'Ilha Pura',
  neighborhood: 'Av. Salvador Allende, 3200 · Barra Olímpica · Rio de Janeiro, RJ',
  price: 'Consulte valores',
  details: ['Bairro planejado', 'Vila dos Atletas · Rio 2016', 'Certificação LEED ND', 'Mais de 800 mil m²*'],
  description: 'Localizado na Barra Olímpica, na região da Barra da Tijuca, o Ilha Pura foi originalmente construído para servir como Vila dos Atletas nos Jogos Olímpicos de 2016 e depois transformado em um bairro residencial. A ficha de teste informa área superior a 800 mil m²; confirme o escopo dessa medida antes de divulgá-la.',
}

const initialMessages: Message[] = [
  { from: 'assistant', text: 'Oi! Que bom ter você por aqui. Posso te contar mais sobre o Ilha Pura. O que você gostaria de saber primeiro?' },
]

function Brand({ onHome }: { onHome: () => void }) {
  return <button className="brand" onClick={onHome} aria-label="Motion Click, início"><span className="brand-icon-crop"><img src="/assets/motion-click-icon.jpeg" alt="" /></span><span className="brand-product"><strong>MOTION CLICK</strong><i>MOTION AI IMOBILIÁRIO</i></span></button>
}

function ArrowIcon() { return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 5l7 7-7 7" /></svg> }
function SparkleIcon() { return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Z"/><path d="m19 15 .9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9L19 15Z"/></svg> }

function App() {
  const [view, setView] = useState<'property' | 'dashboard'>('property')
  const [showLeadForm, setShowLeadForm] = useState(false)
  const [consented, setConsented] = useState(false)
  const [lead, setLead] = useState<Lead | null>(() => readDemoSession()?.lead ?? null)
  const [messages, setMessages] = useState<Message[]>(() => readDemoSession()?.messages ?? initialMessages)
  const [draft, setDraft] = useState('')
  const [activeFilter, setActiveFilter] = useState('Todos')
  const [notice, setNotice] = useState('')
  const [showLeadDetails, setShowLeadDetails] = useState(false)
  const [sending, setSending] = useState(false)

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ lead, messages })) } catch { /* Storage may be unavailable in private browsing. */ }
  }, [lead, messages])

  function startChat(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const name = String(form.get('name') ?? '').trim()
    const phone = String(form.get('phone') ?? '').trim()
    if (!consented) return
    setLead({ name, phone, interest: 'Comprar para morar', budget: 'Ainda não informado', financing: 'Ainda não informado', visit: 'A conversar', status: 'Novo', notes: '' })
    setMessages([{ from: 'assistant', text: `Oi, ${name.split(' ')[0]}! Sou o assistente virtual da Motion AI. Estou aqui para ajudar com o Ilha Pura. O que você gostaria de saber?` }])
    setShowLeadForm(false)
  }

  type Qualification = Partial<Record<'finalidade' | 'faixa_investimento' | 'financiamento' | 'quartos' | 'regiao_interesse' | 'interesse_visita' | 'duvida_para_corretor', string>> & { pedir_corretor?: boolean }

  function applyQualification(q: Qualification | undefined) {
    if (!q) return
    const yesNo: Record<string, string> = { sim: 'Sim', nao: 'Não', talvez: 'Talvez' }
    setLead((current) => {
      if (!current) return current
      const next = { ...current }
      if (q.finalidade) next.interest = q.finalidade === 'investir' ? 'Investir' : 'Comprar para morar'
      if (q.faixa_investimento) next.budget = q.faixa_investimento
      if (q.financiamento) next.financing = yesNo[q.financiamento] ?? next.financing
      if (q.interesse_visita) next.visit = q.interesse_visita === 'sim' ? 'Quer visitar' : q.interesse_visita === 'talvez' ? 'Talvez queira visitar' : 'Não quer visitar agora'
      const extras = [
        q.quartos && `Quartos: ${q.quartos}`,
        q.regiao_interesse && `Região de interesse: ${q.regiao_interesse}`,
        q.duvida_para_corretor && `Dúvida para o corretor: ${q.duvida_para_corretor}`,
        q.pedir_corretor && 'Pediu para falar com o corretor.',
      ].filter(Boolean) as string[]
      if (extras.length) next.notes = [next.notes, ...extras].filter(Boolean).join('\n')
      return next
    })
  }

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const text = draft.trim()
    if (!text || sending) return
    setDraft('')
    const history: Message[] = [...messages, { from: 'visitor', text }]
    setMessages(history)
    setSending(true)
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          propertySlug: 'ilha-pura',
          messages: history.map((m) => ({ role: m.from === 'visitor' ? 'user' : 'assistant', content: m.text })),
        }),
      })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const data = (await response.json()) as { reply: string; qualification?: Qualification }
      setMessages((current) => [...current, { from: 'assistant', text: data.reply }])
      applyQualification(data.qualification)
    } catch {
      setMessages((current) => [...current, { from: 'assistant', text: 'Tive um problema para responder agora. Pode tentar de novo em instantes?' }])
    } finally {
      setSending(false)
    }
  }

  function choosePrompt(prompt: string) {
    setDraft(prompt)
    document.querySelector<HTMLInputElement>('#chat-input')?.focus()
  }

  function changeStatus(status: string) {
    setLead((current) => current ? { ...current, status } : current)
    setNotice('Status do lead atualizado.')
    window.setTimeout(() => setNotice(''), 2200)
  }

  function updateLeadNotes(notes: string) {
    setLead((current) => current ? { ...current, notes } : current)
  }

  const leadVisible = lead && (activeFilter === 'Todos' || lead.status === activeFilter) ? lead : null

  return (
    <main className="app-shell">
      <header className="topbar">
        <Brand onHome={() => setView('property')} />
        <nav className="top-nav" aria-label="Navegação principal">
          <span className="nav-label">ATENDIMENTO IMOBILIÁRIO</span>
          <button className={view === 'property' ? 'nav-link active' : 'nav-link'} onClick={() => setView('property')}>Imóvel</button>
          <button className={view === 'dashboard' ? 'nav-link active' : 'nav-link'} onClick={() => setView('dashboard')}>Painel de leads <span className="nav-count">{lead ? '1' : '0'}</span></button>
        </nav>
        <button className="profile-button" onClick={() => setView('dashboard')} aria-label="Abrir painel do corretor"><span className="profile-avatar">MC</span><span className="profile-label">Motion Click</span><span className="chevron">⌄</span></button>
      </header>

      {view === 'property' ? (
        <PropertyView
          lead={lead}
          messages={messages}
          draft={draft}
          setDraft={setDraft}
          onStart={() => setShowLeadForm(true)}
          onSend={sendMessage}
          onChoosePrompt={choosePrompt}
        />
      ) : (
        <DashboardView lead={lead} leadVisible={leadVisible} activeFilter={activeFilter} setActiveFilter={setActiveFilter} changeStatus={changeStatus} notice={notice} onViewLead={() => setShowLeadDetails(true)} />
      )}

      {showLeadForm && <LeadModal consented={consented} setConsented={setConsented} onClose={() => setShowLeadForm(false)} onSubmit={startChat} />}
      {showLeadDetails && lead && <LeadDetailsModal lead={lead} messages={messages} onClose={() => setShowLeadDetails(false)} onSaveNotes={updateLeadNotes} />}
      <footer className="site-footer"><span>© 2026 Motion Click</span><span>Atendimento inteligente, com o cuidado de sempre.</span><button onClick={() => setView('dashboard')}>Acesso do corretor <ArrowIcon /></button></footer>
    </main>
  )
}

function PropertyView({ lead, messages, draft, setDraft, onStart, onSend, onChoosePrompt }: {
  lead: Lead | null; messages: Message[]; draft: string; setDraft: (value: string) => void; onStart: () => void;
  onSend: (event: FormEvent<HTMLFormElement>) => void; onChoosePrompt: (prompt: string) => void;
}) {
  return (
    <div className="property-layout">
      <section className="property-main">
        <div className="breadcrumbs"><span>IMÓVEIS</span><i>/</i><span>RIO DE JANEIRO</span><i>/</i><strong>BAIRRO PLANEJADO</strong></div>
        <div className="property-visual">
          <div className="visual-sky" />
          <div className="sun" />
          <div className="visual-hill hill-back" />
          <div className="visual-hill hill-front" />
          <div className="building building-left"><span /><span /><span /><span /></div>
          <div className="building building-main"><span /><span /><span /><span /><span /><span /></div>
          <div className="building building-right"><span /><span /><span /><span /></div>
          <div className="balcony-plant plant-one" /><div className="balcony-plant plant-two" />
          <div className="visual-label"><span className="live-dot" /> ILHA PURA · IMAGEM ILUSTRATIVA</div>
          <div className="visual-pagination"><span className="page-current">01</span><span className="page-line" /><span>04</span></div>
          <button className="visual-expand" aria-label="Expandir imagem">↗</button>
        </div>
        <div className="property-heading-row">
          <div><p className="eyebrow">PROJETO DE TESTE · MOTION AI</p><h1>{property.title}</h1><p className="property-location"><span>⌖</span>{property.neighborhood}</p></div>
          <button className="save-button" aria-label="Salvar imóvel">♡</button>
        </div>
        <div className="property-facts">
          {property.details.map((fact, index) => <div className="fact" key={fact}><span className="fact-icon">{['⌂', '✧', '▱', '⌑'][index]}</span><span>{fact}</span></div>)}
        </div>
        <div className="property-divider" />
        <div className="about-property"><div><p className="eyebrow">SOBRE O PROJETO</p><h2>Um legado olímpico.</h2></div><p>{property.description}</p></div>
      </section>

      <aside className="property-side">
        <div className="price-card"><div className="price-top"><Badge color="success" size="sm" className="listing-tag" prefixIcon={<span className="listing-dot" />}>PROJETO DE TESTE</Badge><span className="listing-code">MOTION AI</span></div><p className="property-name">{property.name}</p><p className="property-price">{property.price}</p><p className="price-note">Unidades, disponibilidade e preços a confirmar com o corretor.</p><div className="price-rule"/><div className="mini-details"><span>Localização</span><strong>Barra Olímpica · Rio</strong><span>Perfil</span><strong>Bairro planejado</strong></div><Button className="primary-button" onPress={onStart}>Conversar com assistente <ArrowIcon /></Button><p className="safe-note"><span>✳</span> Tire dúvidas e conheça os próximos passos.</p></div>
        <ChatCard lead={lead} messages={messages} draft={draft} setDraft={setDraft} onStart={onStart} onSend={onSend} onChoosePrompt={onChoosePrompt} />
      </aside>
    </div>
  )
}

function ChatCard({ lead, messages, draft, setDraft, onStart, onSend, onChoosePrompt }: {
  lead: Lead | null; messages: Message[]; draft: string; setDraft: (value: string) => void; onStart: () => void;
  onSend: (event: FormEvent<HTMLFormElement>) => void; onChoosePrompt: (prompt: string) => void;
}) {
  return <div className="chat-card">
    <div className="chat-header"><div className="assistant-avatar"><SparkleIcon /></div><div className="assistant-id"><strong>Assistente Motion AI</strong><span><i /> online agora</span></div><button className="more-button" aria-label="Mais opções">···</button></div>
    <div className="chat-body">
      <div className="chat-date">HOJE</div>
      {!lead ? <><div className="message assistant-message">Oi! Sou a assistente virtual da <strong>Motion AI</strong>. Quer saber mais sobre o Ilha Pura? Posso contar o que consta na ficha e registrar seu interesse para o corretor.</div><div className="suggestions"><button onClick={() => onChoosePrompt('Onde fica o Ilha Pura?')}>Onde fica?</button><button onClick={() => onChoosePrompt('Qual é a história do Ilha Pura?')}>História olímpica</button><button onClick={() => onChoosePrompt('O que é a certificação LEED ND?')}>Certificação LEED ND</button></div></> : messages.map((message, index) => <div className={`message ${message.from === 'assistant' ? 'assistant-message' : 'visitor-message'}`} key={`${index}-${message.from}`}>{message.text}</div>)}
      {!lead && <div className="chat-callout"><span className="callout-icon">✳</span><span>Para começar, deixe seu nome e WhatsApp. É rapidinho.</span></div>}
    </div>
    {lead ? <form className="chat-input-row" onSubmit={onSend}><input id="chat-input" value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Escreva sua mensagem..." aria-label="Escreva sua mensagem"/><button type="submit" className="send-button" aria-label="Enviar mensagem"><ArrowIcon /></button></form> : <Button appearance="outline" className="chat-start-button" onPress={onStart}>Começar conversa <ArrowIcon /></Button>}
    <div className="chat-disclaimer">Respostas baseadas nas informações deste imóvel.</div>
  </div>
}

function LeadModal({ consented, setConsented, onClose, onSubmit }: { consented: boolean; setConsented: (value: boolean) => void; onClose: () => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) {
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}><section className="lead-modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><button className="modal-close" onClick={onClose} aria-label="Fechar">×</button><div className="modal-symbol"><SparkleIcon /></div><p className="eyebrow">UM BOM COMEÇO</p><h2 id="modal-title">Vamos conversar?</h2><p className="modal-copy">Deixe seus dados para iniciar o atendimento. O corretor também poderá entrar em contato para continuar a conversa.</p><form onSubmit={onSubmit} className="lead-form"><label htmlFor="lead-name">Como podemos te chamar?</label><input id="lead-name" name="name" placeholder="Seu nome" autoComplete="name" required minLength={2}/><label htmlFor="lead-phone">Seu WhatsApp</label><input id="lead-phone" name="phone" placeholder="(11) 99999-9999" type="tel" autoComplete="tel" required minLength={10}/><div className="privacy-box"><strong>Seus dados, com cuidado.</strong><p>Usaremos seu nome e WhatsApp para atender sua solicitação sobre este imóvel e encaminhar seu interesse ao corretor responsável. Consulte o aviso de privacidade da Motion Click para saber como seus dados são tratados.</p><label className="consent-label"><input type="checkbox" checked={consented} onChange={(event) => setConsented(event.target.checked)} required/><span>Concordo com o uso dos meus dados para este atendimento.</span></label></div><Button className="primary-button" type="submit" disabled={!consented}>Iniciar atendimento <ArrowIcon /></Button></form><p className="modal-footnote">Este é um protótipo. Seus dados permanecem somente nesta sessão.</p></section></div>
}

function LeadDetailsModal({ lead, messages, onClose, onSaveNotes }: { lead: Lead; messages: Message[]; onClose: () => void; onSaveNotes: (notes: string) => void }) {
  return <div className="lead-details-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}><section className="lead-details-modal" role="dialog" aria-modal="true" aria-labelledby="lead-details-title"><button className="modal-close" onClick={onClose} aria-label="Fechar">×</button><p className="eyebrow">DETALHES DO CONTATO</p><h2 id="lead-details-title">{lead.name}</h2><p className="lead-detail-contact">{lead.phone} · {lead.interest}</p><label className="lead-detail-label" htmlFor="lead-notes">Observações do corretor</label><textarea id="lead-notes" value={lead.notes} onChange={(event) => onSaveNotes(event.target.value)} placeholder="Anote próximos passos, preferências ou informações úteis..." rows={3}/><div className="lead-transcript"><h3>Conversa com o assistente</h3>{messages.map((message, index) => <div className={`message ${message.from === 'assistant' ? 'assistant-message' : 'visitor-message'}`} key={`${index}-${message.from}`}>{message.text}</div>)}</div><p className="modal-footnote">A conversa e as observações ficam salvas neste navegador.</p><Button className="primary-button" onPress={onClose}>Concluir</Button></section></div>
}

function DashboardView({ lead, leadVisible, activeFilter, setActiveFilter, changeStatus, notice, onViewLead }: {
  lead: Lead | null; leadVisible: Lead | null; activeFilter: string; setActiveFilter: (value: string) => void; changeStatus: (value: string) => void; notice: string; onViewLead: () => void;
}) {
  const leadName = lead?.name || 'Nenhum lead ainda'
  const initials = lead?.name.split(' ').filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || '—'
  return <section className="dashboard-page"><div className="dashboard-heading"><div><div className="breadcrumbs"><span>MOTION AI</span><i>/</i><strong>PAINEL</strong></div><p className="eyebrow">ACOMPANHAMENTO DO PILOTO</p><h1>Seu atendimento, <em>em movimento.</em></h1><p className="dashboard-subtitle">Acompanhe os contatos e mantenha cada conversa no caminho certo.</p></div><button className="outline-button" onClick={() => window.print()}>↗ <span>Exportar leads</span></button></div>
      <div className="stat-grid"><article className="stat-card"><span className="stat-label">LEADS NO MÊS</span><strong>{lead ? '01' : '00'}</strong><span className="stat-foot"><i className="stat-dot green"/> Atualizado agora</span><span className="stat-orbit orbit-a"/><span className="stat-orbit orbit-b"/></article><article className="stat-card"><span className="stat-label">NOVOS</span><strong>{lead?.status === 'Novo' ? '01' : '00'}</strong><span className="stat-foot"><i className="stat-dot amber"/> Aguardando contato</span><span className="stat-number-mark">↗</span></article><article className="stat-card"><span className="stat-label">PROJETOS ATIVOS</span><strong>01</strong><span className="stat-foot"><i className="stat-dot green"/> Ilha Pura</span><span className="stat-house">⌂</span></article><article className="stat-card response-stat"><span className="stat-label">TEMPO DE RESPOSTA</span><strong>24<span>h</span></strong><span className="stat-foot"><i className="stat-dot blue"/> Assistente disponível</span><div className="sparkline"><span/><span/><span/><span/><span/><span/><span/><span/><span/><span/><span/><span/></div></article></div>
    <div className="dashboard-content"><section className="leads-panel"><div className="panel-header"><div><p className="eyebrow">SEUS CONTATOS</p><h2>Leads recebidos <span className="count-pill">{lead ? '1' : '0'}</span></h2></div><button className="filter-button">Este mês <span>⌄</span></button></div><div className="lead-tabs">{['Todos', 'Novo', 'Em atendimento', 'Agendado'].map((filter) => <button key={filter} onClick={() => setActiveFilter(filter)} className={activeFilter === filter ? 'lead-tab selected' : 'lead-tab'}>{filter}{filter === 'Todos' && <span>{lead ? '1' : '0'}</span>}</button>)}</div><div className="lead-table-wrap"><table className="lead-table"><thead><tr><th>CONTATO</th><th>PROJETO</th><th>INTERESSE</th><th>STATUS</th><th aria-label="Ações"/></tr></thead><tbody>{leadVisible ? <tr className="lead-row"><td><div className="lead-person"><span className="lead-avatar">{initials}</span><span><strong>{leadName}</strong><small>{leadVisible.phone}</small></span></div></td><td><span className="table-property">{property.name}</span><small className="table-muted">Barra Olímpica · Rio de Janeiro</small></td><td><span className="intent-pill">Comprar para morar</span><small className="table-muted">WhatsApp</small></td><td><select className={`status-select ${leadVisible.status.toLowerCase().replaceAll(' ', '-')}`} value={leadVisible.status} onChange={(event) => changeStatus(event.target.value)} aria-label={`Status de ${leadName}`}><option>Novo</option><option>Em atendimento</option><option>Agendado</option></select></td><td><button className="row-more" aria-label={`Ver respostas de ${leadName}`} onClick={onViewLead}>···</button></td></tr> : <tr><td colSpan={5}><div className="empty-leads"><span>✳</span><strong>{lead ? 'Nenhum lead neste filtro' : 'Seu próximo lead começa aqui.'}</strong><small>{lead ? 'Selecione outro status para ver os contatos.' : 'Quando alguém demonstrar interesse, as informações aparecem nesta lista.'}</small></div></td></tr>}</tbody></table></div><div className="panel-bottom"><span>Mostrando {leadVisible ? '1' : '0'} de {lead ? '1' : '0'} contatos</span><div><button disabled>←</button><button disabled>→</button></div></div></section>
      <aside className="side-column"><section className="property-summary"><div className="summary-art"><div className="summary-building"/><span>TESTE</span></div><div className="summary-copy"><p className="eyebrow">PROJETO EM DESTAQUE</p><h3>{property.name}</h3><p>⌖ Barra Olímpica · Rio de Janeiro</p><div className="summary-stats"><span>Bairro planejado</span><i/><span>LEED ND</span></div><button onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>Ver projeto <ArrowIcon /></button></div></section><section className="tip-card"><div className="tip-icon"><SparkleIcon /></div><div><p className="eyebrow">DICA DO ASSISTENTE</p><p>Responda os novos contatos rapidamente para manter a conversa fluindo.</p><span>O assistente fica disponível 24 horas.</span></div></section><section className="activity-card"><p className="eyebrow">ATIVIDADE RECENTE</p>{lead ? <div className="activity-item"><span className="activity-marker"><i/></span><div><strong>Novo lead recebido</strong><p>{lead.name} demonstrou interesse no Ilha Pura.</p><small>Agora mesmo · via página do projeto</small></div></div> : <div className="activity-empty">As novidades do seu atendimento aparecem aqui.</div>}</section></aside></div>
    <div className="demo-strip"><span className="demo-led"/> MODO DEMONSTRAÇÃO <span>Os leads ficam apenas nesta sessão. Algumas informações do projeto aguardam confirmação.</span></div>{notice && <div className="toast" role="status">{notice}</div>}
  </section>
}

export default App
