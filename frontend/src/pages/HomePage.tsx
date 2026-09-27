import { useEffect, useRef, useState, type JSX } from 'react';
import f1CarPng from '../assets/f1car.png';
import rippleTrackLogo from '../assets/RippleTrack_Primary_Logo.png';
import rippleTrackHorizontal from '../assets/RippleTrack_Horizontal_Lockup.png';

interface HomePageProps {
  onLaunchDemo: () => void;
}

/* ─── Scroll-reveal hook ──────────────────────────────────────────────────── */
function useReveal(threshold = 0.15) {
  const ref = useRef<HTMLElement | null>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); observer.disconnect(); } },
      { threshold }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold]);
  return { ref, visible };
}

/* ─── Parallax hook (bidirectional — works on both scroll up and down) ──── */
function useParallax(speed = 0.3) {
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Set initial position immediately so the element doesn't jump on first scroll
    el.style.transform = `translateY(${window.scrollY * speed}px)`;
    const onScroll = () => {
      // window.scrollY is always up-to-date — captures both directions
      el.style.transform = `translateY(${window.scrollY * speed}px)`;
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [speed]);
  return ref;
}


/* ─── Race Track SVG — Las Vegas Street Circuit ──────────────────────────── */
function RaceTrackSVG(): JSX.Element {
  /*
   * Las Vegas Street Circuit — landscape orientation (700 × 420 viewBox).
   * Clockwise from S/F line (bottom edge, right side):
   *   S/F → long bottom straight (west) → tight left hairpin T1
   *   → short straight up → T2 right → long back straight (east)
   *   → T14 right hairpin (top-right) → top straight (west)
   *   → T16/17 chicane kink top-left → T18 right → short connector
   *   → T19/20 chicane bottom-left → back to S/F
   *
   * The circuit is essentially a large rounded rectangle with:
   *   - Two long parallel straights (top & bottom)
   *   - A tight hairpin on the left
   *   - A wider sweeping corner on the right
   *   - Two chicane sections breaking up the back straight
   */

  // Main circuit centreline path
  const track =
    `M 560 340
     L 160 340
     C 120 340 96 320 96 282
     L 96 232
     C 96 196 118 176 156 176
     L 172 176
     C 196 176 210 162 210 140
     C 210 118 196 104 172 104
     L 156 104
     C 118 104 96 84 96 48
     L 560 48
     C 600 48 620 68 620 104
     L 620 196
     C 620 210 610 220 596 220
     L 580 220
     C 566 220 556 230 556 244
     C 556 258 566 268 580 268
     L 596 268
     C 610 268 620 278 620 292
     L 620 304
     C 620 324 600 340 560 340`;

  // DRS zone: the main start/finish straight bottom
  const drsZone = `M 560 340 L 320 340`;

  // Back straight top DRS
  const drsTop = `M 240 48 L 560 48`;

  /*
   * The track geometry is mirrored with scale(-1,1) translate(-700,0) so the
   * S/F straight (originally bottom-right) moves to bottom-left — matching the
   * car entering from the right.  Text labels live outside this group and are
   * placed at the mirrored x-coordinates (mirroredX = 700 - originalX) so they
   * sit correctly over the flipped geometry without being flipped themselves.
   *
   * Mirror map (x → 700-x):
   *   S/F line:  x=520  → x=180
   *   DRS zone:  560→140 to 320→380  (bottom straight, now left side)
   *   DRS top:   240→460 to 560→140
   *   T1 hairpin (was left x≈96) → now right x≈604
   *   T14 (was right x≈620)      → now left x≈80
   *   T16-17 chicane (was x≈172) → now x≈528
   */
  return (
    <svg
      viewBox="0 0 700 420"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className="home-racetrack-svg"
    >
      {/* ── Flipped geometry group (track paths only, no text) ── */}
      <g transform="scale(-1,1) translate(-700,0)">
        {/* Layer 1: outer border shadow */}
        <path d={track}
          stroke="rgba(30,35,50,0.98)" strokeWidth="28"
          fill="none" strokeLinecap="round" strokeLinejoin="round" />

        {/* Layer 2: red kerb edges */}
        <path d={track}
          stroke="rgba(220,0,0,0.35)" strokeWidth="22"
          fill="none" strokeLinecap="round" strokeLinejoin="round" />

        {/* Layer 3: asphalt surface */}
        <path d={track}
          stroke="rgba(18,20,28,0.94)" strokeWidth="14"
          fill="none" strokeLinecap="round" strokeLinejoin="round" />

        {/* Layer 4: DRS zone bottom straight */}
        <path d={drsZone}
          stroke="rgba(100,160,255,0.30)" strokeWidth="14"
          fill="none" strokeLinecap="round" />

        {/* Layer 5: DRS zone top straight */}
        <path d={drsTop}
          stroke="rgba(100,160,255,0.22)" strokeWidth="14"
          fill="none" strokeLinecap="round" />

        {/* Centreline dashes */}
        <path d={track}
          stroke="rgba(220,0,0,0.05)" strokeWidth="1.5"
          strokeDasharray="12 10" fill="none"
          strokeLinecap="round" strokeLinejoin="round" />

        {/* S/F line marker — perpendicular tick at x=520 on bottom straight */}
        <line x1="520" y1="326" x2="520" y2="354"
          stroke="rgba(255,255,255,0.55)" strokeWidth="3" strokeLinecap="round" />
        <circle cx="520" cy="340" r="5.5"
          fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="2" />
        <circle cx="520" cy="340" r="2.5" fill="rgba(255,255,255,0.40)" />
      </g>

      {/* ══ Text labels — NOT inside the flipped group; x = 700 − original ══ */}

      {/* DRS ZONE label — bottom straight now sits left side (mirrored 420→280) */}
      <text x="280" y="364" fill="rgba(100,160,255,1.5)" fontSize="8"
        fontFamily="monospace" textAnchor="middle" letterSpacing="1.2">DRS ZONE</text>
      {/* DRS label — top straight (mirrored 400→300) */}
      <text x="300" y="36" fill="rgba(100,160,255,1)" fontSize="7"
        fontFamily="monospace" textAnchor="middle" letterSpacing="1">DRS</text>

      {/* T1 hairpin — now on right side (mirrored 52→648) */}
      <text x="648" y="212" fill="rgba(232,184,75,1)" fontSize="7.5"
        fontFamily="monospace" fontWeight="bold" textAnchor="middle">T1</text>
      <text x="648" y="223" fill="rgba(232,184,75,1)" fontSize="6.5"
        fontFamily="monospace" textAnchor="middle">HAIRPIN</text>

      {/* T14 — now on left side (mirrored 654→46) */}
      <text x="46" y="80" fill="rgba(220,0,0,1)" fontSize="7.5"
        fontFamily="monospace" fontWeight="bold">T14</text>

      {/* T16-17 chicane — now on right side (mirrored 160→540) */}
      <text x="540" y="92" fill="rgba(220,0,0,1)" fontSize="7"
        fontFamily="monospace" fontWeight="bold" textAnchor="middle">T16-17</text>
      <text x="540" y="102" fill="rgba(220,0,0,1)" fontSize="6"
        fontFamily="monospace" textAnchor="middle">CHICANE</text>

      {/* S/F label — mirrored 530→170 */}
      <text x="165" y="360" fill="rgba(255,255,255,1)" fontSize="7"
        fontFamily="monospace">S/F</text>
    </svg>
  );
}

/* ─── Tyre Compound Dots ──────────────────────────────────────────────────── */
function TyreDots(): JSX.Element {
  const compounds = [
    { label: 'SOFT', color: '#DC0000' },
    { label: 'MEDIUM', color: '#E8B84B' },
    { label: 'HARD', color: '#E0E0E0' },
  ];
  return (
    <div className="home-tyre-dots" aria-hidden="true">
      {compounds.map(c => (
        <div key={c.label} className="home-tyre-dot-wrap">
          <svg viewBox="0 0 32 32" width="32" height="32">
            <circle cx="16" cy="16" r="14" fill="none" stroke={c.color} strokeWidth="2.5" opacity="0.7" />
            <circle cx="16" cy="16" r="8" fill="none" stroke={c.color} strokeWidth="1.5" opacity="0.4" />
            <circle cx="16" cy="16" r="3" fill={c.color} opacity="0.8" />
          </svg>
          <span style={{ color: c.color }}>{c.label}</span>
        </div>
      ))}
    </div>
  );
}

/* ─── Checkered band ──────────────────────────────────────────────────────── */
function CheckeredBand({ width = 120 }: { width?: number }): JSX.Element {
  const cols = Math.ceil(width / 8);
  return (
    <svg width={cols * 8} height="12" viewBox={`0 0 ${cols * 8} 12`} aria-hidden="true">
      {[0, 1].map(row =>
        Array.from({ length: cols }, (_, col) => (
          <rect
            key={`${row}-${col}`}
            x={col * 8} y={row * 6}
            width="8" height="6"
            fill={(row + col) % 2 === 0 ? '#ffffff' : '#000000'}
            opacity="0.45"
          />
        ))
      )}
    </svg>
  );
}

/* ─── Speed Lines (hero atmosphere) ──────────────────────────────────────── */
function SpeedLines(): JSX.Element {
  return (
    <svg className="home-speed-lines" viewBox="0 0 800 500" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      {[
        { x1: 0, y1: 80,  x2: 320, y2: 110, op: 0.06, w: 1.5 },
        { x1: 0, y1: 140, x2: 280, y2: 155, op: 0.04, w: 1 },
        { x1: 0, y1: 200, x2: 350, y2: 210, op: 0.07, w: 2 },
        { x1: 0, y1: 260, x2: 240, y2: 268, op: 0.04, w: 1 },
        { x1: 0, y1: 310, x2: 300, y2: 315, op: 0.05, w: 1.5 },
        { x1: 0, y1: 380, x2: 260, y2: 385, op: 0.03, w: 1 },
        { x1: 0, y1: 430, x2: 310, y2: 440, op: 0.06, w: 2 },
      ].map((l, i) => (
        <line key={i} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2}
          stroke="#DC0000" strokeWidth={l.w} opacity={l.op}
          strokeLinecap="round" />
      ))}
    </svg>
  );
}

/* ─── Risk Gauge mini preview ─────────────────────────────────────────────── */
function MiniGauge({ score }: { score: number }): JSX.Element {
  const r = 36, cx = 44, cy = 44;
  const arc = 2 * Math.PI * r * 0.75;
  const fill = (score / 100) * arc;
  const color = score > 70 ? '#DC0000' : score > 40 ? '#E8B84B' : '#00C864';
  return (
    <svg width="88" height="68" viewBox="0 0 88 68" aria-hidden="true">
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="7"
        strokeDasharray={`${arc} ${2 * Math.PI * r}`}
        strokeDashoffset={arc * 0.125}
        strokeLinecap="round" style={{ transform: 'rotate(-225deg)', transformOrigin: `${cx}px ${cy}px` }} />
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth="7"
        strokeDasharray={`${fill} ${2 * Math.PI * r}`}
        strokeDashoffset={arc * 0.125}
        strokeLinecap="round"
        style={{ transform: 'rotate(-225deg)', transformOrigin: `${cx}px ${cy}px`, filter: `drop-shadow(0 0 4px ${color}60)` }} />
      <text x={cx} y={cy + 5} textAnchor="middle" fill="white" fontSize="13" fontWeight="700" fontFamily="monospace">{score}</text>
    </svg>
  );
}

/* ─── Inline SVG Icons ────────────────────────────────────────────────────── */
function IconSearch(): JSX.Element {
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>;
}
function IconGitBranch(): JSX.Element {
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><line x1="6" y1="3" x2="6" y2="15"/><circle cx="18" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M18 9a9 9 0 0 1-9 9"/></svg>;
}
function IconTestTube(): JSX.Element {
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 3h6l1 9H8L9 3z"/><path d="M8 12c0 0-2 2-2 4a6 6 0 0 0 12 0c0-2-2-4-2-4"/><line x1="12" y1="3" x2="12" y2="8"/></svg>;
}
function IconIBM(): JSX.Element {
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="2" y="5" width="20" height="2" rx="1"/><rect x="4" y="9" width="16" height="2" rx="1"/><rect x="2" y="13" width="20" height="2" rx="1"/><rect x="4" y="17" width="16" height="2" rx="1"/></svg>;
}
function IconGitHub(): JSX.Element {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.603-3.369-1.342-3.369-1.342-.454-1.155-1.11-1.463-1.11-1.463-.908-.62.069-.608.069-.608 1.003.07 1.531 1.031 1.531 1.031.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.268 2.75 1.026A9.578 9.578 0 0 1 12 6.836c.85.004 1.705.115 2.504.337 1.909-1.294 2.747-1.026 2.747-1.026.546 1.377.202 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.841-2.337 4.687-4.565 4.935.359.308.678.917.678 1.852 0 1.336-.012 2.415-.012 2.742 0 .267.18.578.688.48C19.138 20.163 22 16.418 22 12c0-5.523-4.477-10-10-10z"/></svg>;
}
function IconFlag(): JSX.Element {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>;
}

/* ─── Reveal wrapper component ────────────────────────────────────────────── */
function Reveal({ children, delay = 0, className = '' }: { children: React.ReactNode; delay?: number; className?: string }): JSX.Element {
  const { ref, visible } = useReveal(0.12);
  return (
    <div
      ref={ref as React.RefObject<HTMLDivElement>}
      className={`home-reveal ${visible ? 'home-reveal--visible' : ''} ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════ */
export default function HomePage({ onLaunchDemo }: HomePageProps): JSX.Element {
  const parallaxBg = useParallax(0.25);
  const parallaxCar = useParallax(0.12);

  return (
    <div className="home-page">

      {/* ══ 1. HERO ══════════════════════════════════════════════════════════ */}
      <section className="home-hero" aria-label="RippleTrack hero">

        {/* Ambient background: grid + orbs + scan line */}
        <div className="home-hero-bg-grid" aria-hidden="true" />
        <div className="home-hero-orb home-hero-orb--red" aria-hidden="true" />
        <div className="home-hero-orb home-hero-orb--gold" aria-hidden="true" />
        <div className="home-hero-orb home-hero-orb--blue" aria-hidden="true" />
        <div className="home-hero-particles" aria-hidden="true">
          <div className="home-hero-particle" />
          <div className="home-hero-particle" />
          <div className="home-hero-particle" />
          <div className="home-hero-particle" />
          <div className="home-hero-particle" />
        </div>
        <div className="home-hero-scan" aria-hidden="true" />

        {/* Parallax background layer */}
        <div className="home-hero-parallax-bg" ref={parallaxBg} aria-hidden="true">
          <SpeedLines />
          <RaceTrackSVG />
        </div>

        {/* Left red racing stripe */}
        <div className="home-hero-stripe" aria-hidden="true" />
        {/* Right gold accent */}
        <div className="home-hero-stripe-right" aria-hidden="true" />

        {/* Top checkered band */}
        <div className="home-hero-checkered-top" aria-hidden="true">
          <CheckeredBand width={600} />
        </div>

        <div className="home-hero-inner">
          {/* Badge row */}
          <div className="home-hero-badge-row">
            <span className="home-hero-badge">
              <IconFlag /> IBM Bob 2.0 Hackathon
            </span>
            <TyreDots />
          </div>

          {/* Wordmark */}
          <div className="home-hero-wordmark">
            <div className="navbar-logo-slot home-hero-logo" aria-hidden="true">
              <img src={rippleTrackLogo} alt="RippleTrack logo" />
            </div>
            <div>
              <h1 className="home-hero-title">RippleTrack</h1>
              <p className="home-hero-team">Tifosi CodeWorks</p>
            </div>
          </div>

          {/* Tagline */}
          <p className="home-hero-tagline">
            Maps the blast radius of a code change<br />
            <span className="home-hero-tagline-accent">before it's written.</span>
          </p>

          {/* CTA pair */}
          <div className="home-hero-cta-row">
            <button className="home-hero-cta-primary" onClick={onLaunchDemo}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><polygon points="5 3 19 12 5 21 5 3"/></svg>
              View Dashboard
            </button>
          </div>

          {/* Risk score teaser */}
          <div className="home-hero-teaser">
            <MiniGauge score={85} />
            <div className="home-hero-teaser-text">
              <span className="home-hero-teaser-label">Blast Radius Score</span>
              <span className="home-hero-teaser-sub">5 downstream nodes affected · 6 risk factors triggered</span>
              <span className="home-hero-teaser-hint">RippleTrack caught this before the first line shipped</span>
            </div>
          </div>
        </div>

        {/* Parallax F1 car PNG */}
        <div className="home-hero-car-wrap" ref={parallaxCar} aria-hidden="true">
          <img src={f1CarPng} className="home-hero-car" alt="" />
        </div>

        {/* Bottom gradient fade */}
        <div className="home-hero-fade" aria-hidden="true" />
      </section>

      {/* ══ 2. THE PROBLEM ══════════════════════════════════════════════════ */}
      <section className="home-problem-section" aria-label="The problem">
        <div className="home-problem-track-line" aria-hidden="true" />
        <div className="home-section-inner">
          <Reveal>
            <div className="home-section-eyebrow">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              The Problem
            </div>
            <h2 className="home-section-title">AI agents ship code.<br />Downstream breaks silently.</h2>
          </Reveal>

          <div className="home-problem-grid">
            {[
              {
                icon: '🔴',
                head: 'Untyped consumers',
                body: 'Analytics scripts accept Record<string,any>. A new optional field throws at runtime — no compile error.'
              },
              {
                icon: '🟡',
                head: 'Stale test mocks',
                body: 'Fixture files mirror the old interface. Tests pass green on stale data, masking the drift.'
              },
              {
                icon: '⚪',
                head: 'Silent migrations',
                body: 'Legacy migrations have no default fallback. NULL rows appear in production before anyone notices.'
              }
            ].map((item, i) => (
              <Reveal key={item.head} delay={i * 80}>
                <div className="home-problem-card">
                  <span className="home-problem-card-icon" aria-hidden="true">{item.icon}</span>
                  <h4 className="home-problem-card-head">{item.head}</h4>
                  <p className="home-problem-card-body">{item.body}</p>
                </div>
              </Reveal>
            ))}
          </div>

          <Reveal delay={200}>
            <p className="home-problem-resolution">
              RippleTrack maps the full impact graph of a change — consumers, mocks, migrations —
              and hands every agent a guaranteed-safe path <em>before the first line ships.</em>
            </p>
          </Reveal>
        </div>
      </section>

      {/* ══ 3. MEET THE AGENTS ══════════════════════════════════════════════ */}
      <section className="home-agents-section" aria-label="Meet the agents">
        <div className="home-agents-pit-wall" aria-hidden="true">
          <span>PIT WALL</span>
          <CheckeredBand width={80} />
        </div>
        <div className="home-section-inner">
          <Reveal>
            <div className="home-section-eyebrow">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/></svg>
              The Crew
            </div>
            <h2 className="home-section-title">Three specialists.<br />One parallel race.</h2>
          </Reveal>

          <div className="home-agents-grid">
            {[
              {
                num: '01',
                name: 'Contract Detective',
                role: 'Parses the PRD and cross-references every constraint against the current data model, surfacing schema drift before any code is touched.',
                icon: <IconSearch />,
                color: 'var(--ferrari-red)',
                compound: 'SOFT',
                compoundColor: '#DC0000',
              },
              {
                num: '02',
                name: 'Code Archaeologist',
                role: 'Traces the AST to find every downstream consumer of the changed model — routers, analytics pipelines, unsafe casts — and flags each risk vector.',
                icon: <IconGitBranch />,
                color: 'var(--gold)',
                compound: 'MEDIUM',
                compoundColor: '#E8B84B',
              },
              {
                num: '03',
                name: 'Test Archaeologist',
                role: 'Finds stale mocks and fixtures that mirror the old interface — the silent drift that lets broken tests pass green.',
                icon: <IconTestTube />,
                color: '#78AEFF',
                compound: 'HARD',
                compoundColor: '#C8C8C8',
              }
            ].map((agent, i) => (
              <Reveal key={agent.name} delay={i * 100}>
                <div className="home-agent-card" style={{ '--agent-color': agent.color } as React.CSSProperties}>
                  <div className="home-agent-card-header">
                    <span className="home-agent-num">{agent.num}</span>
                    <div className="home-agent-compound" style={{ borderColor: agent.compoundColor, color: agent.compoundColor }}>
                      <svg viewBox="0 0 16 16" width="10" height="10"><circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" strokeWidth="2"/><circle cx="8" cy="8" r="2.5" fill="currentColor"/></svg>
                      {agent.compound}
                    </div>
                  </div>
                  <div className="home-agent-icon-wrap" style={{ color: agent.color }}>
                    {agent.icon}
                  </div>
                  <h3 className="home-agent-name">{agent.name}</h3>
                  <p className="home-agent-role">{agent.role}</p>
                  <div className="home-agent-card-bar" style={{ background: agent.color }} />
                </div>
              </Reveal>
            ))}
          </div>

          <Reveal delay={300}>
            <div className="home-parallel-banner">
              <div className="home-parallel-banner-lines" aria-hidden="true">
                {[0,1,2].map(i => <div key={i} className="home-parallel-line" style={{ animationDelay: `${i * 0.18}s` }} />)}
              </div>
              <div className="home-parallel-banner-text">
                All three run <strong>in parallel under Plan Mode</strong> — merged by an orchestrator
                into the <strong>Ripple Map</strong> and <strong>Risk Score</strong> before any code is written.
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ══ 4. HOW IT WORKS — race lap metaphor ═══════════════════════════ */}
      <section className="home-flow-section" aria-label="How it works">
        <div className="home-section-inner">
          <Reveal>
            <div className="home-section-eyebrow">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              The Race Strategy
            </div>
            <h2 className="home-section-title">Four sectors.<br />Zero surprises.</h2>
          </Reveal>

          <div className="home-lap-track" aria-hidden="true">
            <div className="home-lap-line" />
          </div>

          <div className="home-flow-grid">
            {[
              {
                sector: 'S1',
                title: 'Plan Mode',
                sub: 'Parallel Subagents',
                desc: 'Contract Detective, Code Archaeologist, and Test Archaeologist race in parallel. No code is touched yet.',
                color: 'var(--ferrari-red)',
              },
              {
                sector: 'S2',
                title: 'Ripple Map',
                sub: '+ Risk Score',
                desc: 'Orchestrator merges findings into an interactive node graph and a 0–100 risk score with per-factor breakdown.',
                color: 'var(--gold)',
              },
              {
                sector: 'S3',
                title: 'Agent Mode',
                sub: 'Bilateral Delivery',
                desc: 'One clean PR with the model change and a write to the Signal Registry (ripple_signals) in the same commit.',
                color: '#78AEFF',
              },
              {
                sector: 'S4',
                title: 'Signal Sync',
                sub: 'CI · All Green',
                desc: 'CI reads the Signal Registry, mounts targeted fixes, re-runs affected tests — checkered flag.',
                color: 'var(--pass)',
              }
            ].map((step, i) => (
              <Reveal key={step.sector} delay={i * 90}>
                <div className="home-flow-card" style={{ '--flow-color': step.color } as React.CSSProperties}>
                  <div className="home-flow-sector-tag" style={{ color: step.color, borderColor: step.color }}>
                    {step.sector}
                  </div>
                  <h4 className="home-flow-title">{step.title}</h4>
                  <span className="home-flow-sub">{step.sub}</span>
                  <p className="home-flow-desc">{step.desc}</p>
                  <div className="home-flow-card-glow" style={{ background: step.color }} />
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ══ 5. IBM BOB 2.0 ══════════════════════════════════════════════════ */}
      <section className="home-bob-section" aria-label="Built on IBM Bob 2.0">
        <div className="home-section-inner">
          <Reveal>
            <div className="home-bob-card">
              <div className="home-bob-left">
                <div className="home-bob-logo-ring">
                  <IconIBM />
                </div>
              </div>
              <div className="home-bob-right">
                <div className="home-section-eyebrow" style={{ marginBottom: 10 }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                  Powered by
                </div>
                <h2 className="home-bob-title">IBM Bob 2.0</h2>
                <p className="home-bob-desc">
                  RippleTrack uses IBM Bob 2.0 as its orchestration layer — not as a plain
                  autocomplete or API wrapper.
                </p>
                <div className="home-bob-mode-pills">
                  <div className="home-bob-pill">
                    <span className="home-bob-pill-dot" style={{ background: 'var(--ferrari-red)' }} />
                    <strong>Plan Mode</strong>
                    <span>coordinates three parallel subagents without touching the codebase</span>
                  </div>
                  <div className="home-bob-pill">
                    <span className="home-bob-pill-dot" style={{ background: '#78AEFF' }} />
                    <strong>Agent Mode</strong>
                    <span>executes the bilateral delivery — PR + Signal Registry in one coordinated pass</span>
                  </div>
                </div>
                <p className="home-bob-footnote">
                  Bob's mode boundary is what keeps analysis and execution cleanly separated.
                </p>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ══ 6. FOOTER ════════════════════════════════════════════════════════ */}
      <footer className="home-footer">
        <div className="home-footer-checkered" aria-hidden="true">
          <CheckeredBand width={1920} />
        </div>
        <div className="home-footer-inner">
          <div className="home-footer-left">
            <img src={rippleTrackHorizontal} alt="RippleTrack" className="home-footer-lockup" />
            <span className="home-footer-team">Tifosi CodeWorks — Smiti &amp; Harsh</span>
            <span className="home-footer-license">MIT License</span>
          </div>
          <div className="home-footer-right">
            <a
              href="https://github.com/smitip151/rippletrack-demo"
              className="home-footer-gh"
              target="_blank"
              rel="noopener noreferrer"
            >
              <IconGitHub />
              GitHub
            </a>
            <button className="home-footer-cta" onClick={onLaunchDemo}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><polygon points="5 3 19 12 5 21 5 3"/></svg>
              Enter Dashboard
            </button>
          </div>
        </div>
      </footer>

    </div>
  );
}
