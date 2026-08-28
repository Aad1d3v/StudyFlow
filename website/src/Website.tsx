import { useEffect, useState } from 'react'
import { ArrowRight, Award, BarChart3, BookOpen, CalendarClock, CalendarDays, Check, ChevronDown, ClipboardList, Download, GraduationCap, Mail, Menu, Moon, Paperclip, Play, ShieldCheck, Smartphone, Sparkles, Timer, Trophy, X, Zap } from 'lucide-react'
import { WEBSITE_CONFIG } from './config'

const features = [
  { icon: GraduationCap, title: 'Google Classroom sync', text: 'Connect your account and assignments, due dates, and descriptions sync automatically — built to feel just like Classroom.' },
  { icon: BookOpen, title: 'D2L, Canvas & Moodle', text: 'School portals built in. Link your learning platform and keep every course in one calm place.' },
  { icon: CalendarDays, title: 'Google Calendar', text: 'Your school calendar sits beside your plan, so nothing double-books your day.' },
  { icon: Sparkles, title: 'AI assistant', text: 'A real AI that answers your questions and recommends your next step based on deadlines and effort.' },
  { icon: ClipboardList, title: 'Assignment help', text: 'A dedicated AI helper per assignment — it reads the prompt, your notes, even attached files, with saved chat history.' },
  { icon: CalendarClock, title: 'Auto planner', text: 'One tap turns your whole workload into a calm, realistic daily schedule.' },
  { icon: Timer, title: 'Focus sessions', text: 'Turn any assignment into a distraction-free session and build real momentum.' },
  { icon: Trophy, title: 'Achievements', text: 'Every hour you lock in earns milestones — gamified progress that keeps you going.' },
  { icon: Award, title: 'Grade judger', text: 'Set target grades and see exactly what you need on the remaining work, with a full report-card analysis.' },
  { icon: Mail, title: 'Letter to yourself', text: 'Write a letter to future-you, sealed until the end of your school year.' },
  { icon: Paperclip, title: 'File attachments', text: 'Attach rubrics, prompts, and drafts to assignments — your AI helper can read them.' },
  { icon: BarChart3, title: 'Analytics', text: 'See workload, completion, and focus trends to understand how you study best.' },
]

const freePoints = [
  'Every feature included — nothing locked behind a paywall',
  'No trial, no credit card, no subscription',
  'Real accounts with your data synced across devices',
  'Works on any device: laptop, tablet, or phone',
]

const faqs = [
  {
    q: 'Is StudyFlow really free?',
    a: 'Yes — 100% free for students, forever. Every feature (Classroom sync, the AI assistant, assignment help, grade targets, achievements, and more) is included. No trial, no credit card, no paywall.',
  },
  {
    q: 'What is StudyFlow?',
    a: 'StudyFlow is a student productivity app that connects to your existing school work — Google Classroom, D2L, Canvas, Moodle, and Google Calendar — and turns it into a clear plan: what to do, when to do it, and how to stay organized.',
  },
  {
    q: 'Does it work with Google Classroom?',
    a: 'Yes. Connect your Google account and StudyFlow pulls in your courses and assignments, keeps them in sync, and lets you mark progress, attach files, and get AI help on any assignment.',
  },
  {
    q: 'Where is my data stored?',
    a: 'Your account data lives on StudyFlow servers with secure, password-protected sign-in, and your browser keeps an offline copy on your own device. You can export or delete your data anytime.',
  },
  {
    q: 'When will the Windows app be available?',
    a: 'The Windows installer appears on this page automatically the moment a release is built and published — the download button only becomes active when a real installer is available. Check back, or follow the project for release announcements.',
  },
]

export default function Website() {
  const [menu, setMenu] = useState(false)
  const [dark, setDark] = useState(false)
  // The download button becomes live only when a real installer exists:
  // either a hosted URL configured at build time, or an installer staged in
  // /downloads/ (see website/public/downloads/README.md). The runtime probe
  // checks the manifest so the button never advertises a non-existent file.
  const [download, setDownload] = useState(() => ({
    ready: WEBSITE_CONFIG.downloadReady,
    url: WEBSITE_CONFIG.downloadUrl || '/downloads/StudyFlow-Setup.exe',
    version: WEBSITE_CONFIG.version,
  }))

  useEffect(() => {
    if (WEBSITE_CONFIG.downloadReady) return
    let cancelled = false
    fetch('/downloads/manifest.json')
      .then((response) => (response.ok ? response.text() : Promise.reject(new Error('no manifest'))))
      .then((text) => {
        const manifest = JSON.parse(text) as { ready?: boolean; url?: string; version?: string }
        if (!cancelled && manifest.ready && typeof manifest.url === 'string') {
          setDownload({ ready: true, url: manifest.url, version: manifest.version || WEBSITE_CONFIG.version })
        }
      })
      .catch(() => { /* no installer staged yet — the honest "coming soon" state stays */ })
    return () => {
      cancelled = true
    }
  }, [])

  const downloadReady = download.ready
  return <div className={`site ${dark ? 'site-dark' : ''}`}>
    <header className="site-nav"><a className="site-brand" href="#top"><span className="site-mark"><Sparkles size={17} /></span>{WEBSITE_CONFIG.name}</a><nav className={menu ? 'open' : ''}><a href="#/app" onClick={() => setMenu(false)}>Open app</a><a href="#features" onClick={() => setMenu(false)}>Features</a><a href="#free" onClick={() => setMenu(false)}>Free</a><a href="#how-it-works" onClick={() => setMenu(false)}>How it works</a><a href="#privacy" onClick={() => setMenu(false)}>Privacy</a><a href="#faq" onClick={() => setMenu(false)}>FAQ</a></nav><div className="nav-actions"><button className="site-theme" onClick={() => setDark(!dark)} aria-label="Toggle theme">{dark ? '☼' : '☾'}</button>        <a className="nav-download" href="#/app">Open app <ArrowRight size={14} /></a><button className="menu-button" onClick={() => setMenu(!menu)} aria-label="Toggle menu">{menu ? <X /> : <Menu />}</button></div></header>
    <main id="top"><section className="hero"><div className="hero-copy"><div className="announcement"><span>New</span> 100% free for students — every feature included <ArrowRight size={13} /></div><h1>Your schoolwork,<br /><em>organized automatically.</em></h1><p className="hero-sub">Connect your school account, see every assignment in one place, and let StudyFlow help you decide what to do next. Free forever — no trial, no paywall.</p><div className="hero-actions">        <a className="hero-button" href="#/app"><Play size={17} fill="currentColor" /> Open StudyFlow</a><a className="learn-link" href="#how-it-works">See how it works <ArrowRight size={15} /></a></div><div className="trust"><div className="trust-avatars"><span>AP</span></div><div><strong>Made by Aadidev Prasanth</strong><small>100% free · For better study days.</small></div></div></div><div className="hero-visual"><div className="glow" /><div className="app-preview"><div className="preview-top"><span className="mini-logo"><Sparkles size={10} /></span><strong>StudyFlow</strong><span className="preview-search">⌕ Search anything</span><span className="preview-avatar">SF</span></div><div className="preview-body"><aside><small>WORKSPACE</small><b>▣ &nbsp; Dashboard</b><span>☷ &nbsp; Assignments</span><span>□ &nbsp; Planner</span><span>◷ &nbsp; Focus</span><span>▥ &nbsp; Analytics</span></aside><div className="preview-main"><small>TUESDAY, AUGUST 26</small><h3>Good afternoon</h3><p>You have 3 things to focus on. Let's make today count.</p><div className="preview-stats"><i>◈ <b>3</b><small>Open tasks</small></i><i>◷ <b>3h 15m</b><small>Workload</small></i><i>✓ <b>72%</b><small>Completion</small></i></div><div className="preview-columns"><div className="preview-reco"><small>✦ AI RECOMMENDATION</small><h4>Start with<br />Algebra Problem Set</h4><p>Due tomorrow · 45 min</p><button>▶ Start focus</button></div><div className="preview-list"><small>TODAY'S PLAN</small><div><b>4:00 PM</b><span>Algebra Problem Set<br /><small>45 min · Focus session</small></span></div><div><b>4:45 PM</b><span>Break<br /><small>15 min</small></span></div><div><b>5:00 PM</b><span>Biology Lab Report<br /><small>60 min · Focus session</small></span></div></div></div></div></div></div><div className="floating-card workload"><span className="float-icon">↗</span><div><small>WEEKLY PROGRESS</small><strong>You're on track</strong></div><span className="progress">72%</span></div><div className="floating-card next"><span className="check-float">✓</span><div><small>NEXT UP</small><strong>History Essay</strong></div><span className="arrow-float">→</span></div></div></section><section className="logo-strip"><span>Built for the way <b>students</b> work</span><i>CLASSROOM</i><i>CALENDAR</i><i>AI</i><i>100% FREE</i></section><section className="section features" id="features"><div className="center-heading"><p className="kicker">EVERYTHING, INCLUDED</p><h2>All the tools.<br /><span>Zero cost.</span></h2><p>StudyFlow brings the pieces together so your brain can spend less energy organizing—and more energy learning. Every feature below is free, forever.</p></div><div className="feature-grid">{features.map(({ icon: Icon, title, text }) => <article key={title}><div className="feature-icon"><Icon size={21} /></div><h3>{title}</h3><p>{text}</p><a href="#/app">Try it free <ArrowRight size={14} /></a></article>)}</div></section><section className="free-band" id="free"><div className="free-band-card"><div className="free-badge"><Zap size={15} /> 100% FREE</div><h2>Free forever.<br /><span>No trial. No paywall.</span></h2><p>Every feature — Classroom sync, the AI assistant, assignment help, grade targets, achievements, and your letter to yourself — is included. Create an account and keep everything synced across your devices.</p><div className="free-points">{freePoints.map((point) => <div key={point}><Check size={15} /><span>{point}</span></div>)}</div><div className="hero-actions free-actions"><a className="hero-button" href="#/app">Open StudyFlow <ArrowRight size={17} /></a><span className="free-note"><ShieldCheck size={15} /> No credit card required</span></div></div></section><section className="section process" id="how-it-works"><div className="process-copy"><p className="kicker">HOW IT WORKS</p><h2>From scattered<br /><span>to sorted.</span></h2><p>StudyFlow turns your existing school data into a clear, achievable plan—without asking you to rebuild your life in another app.</p><div className="steps"><div><b>01</b><span><strong>Connect once</strong><small>Bring in your Classroom assignments and calendar.</small></span></div><div><b>02</b><span><strong>See what matters</strong><small>Deadlines and workload become easy to understand.</small></span></div><div><b>03</b><span><strong>Make progress</strong><small>Pick a next step, start a focus session, and go.</small></span></div></div></div><div className="process-visual"><div className="orbit orbit-one" /><div className="orbit orbit-two" /><div className="process-card"><div className="spark-box"><Sparkles size={20} /></div><p className="kicker">YOUR NEXT BEST STEP</p><h3>Start with<br />History Essay</h3><p>Due tomorrow · 45 min estimated</p><button>Start focus <ArrowRight size={14} /></button></div></div></section><section className="section privacy" id="privacy"><div className="privacy-card"><div><p className="kicker">YOUR DATA, YOUR CONTROL</p><h2>Private by default.<br /><span>Transparent always.</span></h2><p>StudyFlow is built to help you organize your work—not to sell your attention. You choose what to connect, and you can disconnect or delete your data anytime.</p><a href="#faq">Read our privacy approach <ArrowRight size={14} /></a></div><div className="privacy-points"><div><Check size={15} /><span>Only request permissions you choose</span></div><div><Check size={15} /><span>Secure sign-in with your own account</span></div><div><Check size={15} /><span>Export or delete your data anytime</span></div><div><Check size={15} /><span>No selling personal information</span></div></div></div></section><section className="download-section" id="download"><div className="download-orb"><Zap size={22} /></div>        <p className="kicker">READY WHEN YOU ARE</p><h2>Start using it<br /><em>right now.</em></h2><p>The full StudyFlow app runs in your browser — create your free account, connect your school work, and get organized. No install needed.</p><div className="hero-actions"><a className="hero-button" href="#/app"><ArrowRight size={17} /> Open StudyFlow</a>{downloadReady ? <a className="hero-button alt" href={download.url}><Download size={17} /> Download for Windows</a> : <span className="coming-soon"><span /> Windows desktop app coming soon</span>}</div><small>100% free · Works on any device · Windows desktop app also available</small></section><section className="faq section" id="faq"><div><p className="kicker">QUESTIONS, ANSWERED</p><h2>Good to know.</h2></div><div className="faq-list">{faqs.map((item, i) => <details key={item.q} open={i === 0}><summary>{item.q}<ChevronDown size={16} /></summary>        <p>{item.a}</p></details>)}</div></section></main><footer><a className="site-brand" href="#top"><span className="site-mark"><Sparkles size={15} /></span>{WEBSITE_CONFIG.name}</a><span>© 2026 {WEBSITE_CONFIG.name} · Made by Aadidev Prasanth · 100% free</span><div><a href="#privacy">Privacy</a><a href="#faq">Help</a><a href="#download">Download</a></div></footer>
  </div>
}
