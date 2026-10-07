"use client";

import Link from "next/link";
import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import {
  motion,
  useInView,
  useMotionValueEvent,
  useReducedMotion,
  useScroll,
  useTransform,
} from "motion/react";
import { useTheme } from "@/components/ThemeProvider";
import { Icon } from "@/components/icons";
import { LogoMark } from "@/components/LogoMark";
import { clock, parseScript } from "@/shared/script";
import "./landing.css";

const ease = [0.22, 1, 0.36, 1] as const;
const script = parseScript(`HOOK
Your coffee is not bitter because of the beans.

BODY
It is bitter because your water is too hot.
Boiling water pulls out the harsh stuff in the first ten seconds.
So here is what I do instead.
I boil the kettle, then I wait one minute.
That is it. One minute.
Same beans, same grinder, same cup.
And the bitterness is just gone.

CALL TO ACTION
Try it tomorrow morning and tell me if I am wrong.`);
const steps = [
  [
    "Build a watchlist",
    "Add YouTube channels and Instagram accounts by link. New uploads, views and subscriber counts are checked on a schedule.",
  ],
  [
    "Find the outliers",
    "Every video is ranked against what is normal for its channel. Single TikTok and Instagram videos can be added by link.",
  ],
  [
    "Write your version",
    "One click breaks a winner down into its hook and structure. Then get your own script, timed line by line for the camera.",
  ],
];

function Brand() {
  return (
    <Link href="/" className="lp-brand" aria-label="Outlier Studio home">
      <LogoMark />
      outlier<span>studio</span>
      <b>.</b>
    </Link>
  );
}
export function GlassButton({
  children,
  href,
  variant = "primary",
  size = "md",
  disabled = false,
  loading = false,
}: {
  children: ReactNode;
  href: string;
  variant?: "primary" | "secondary";
  size?: "md" | "lg";
  disabled?: boolean;
  loading?: boolean;
}) {
  const reduced = useReducedMotion();
  return (
    <Link
      href={href}
      className={`lp-glass lp-glass-${variant} lp-glass-${size}`}
      aria-disabled={disabled || loading || undefined}
      aria-busy={loading || undefined}
      tabIndex={disabled || loading ? -1 : undefined}
      onClick={(e) => {
        if (disabled || loading) e.preventDefault();
      }}
      onPointerMove={(e) => {
        if (
          variant !== "primary" ||
          reduced ||
          e.pointerType !== "mouse" ||
          disabled ||
          loading
        )
          return;
        const r = e.currentTarget.getBoundingClientRect();
        e.currentTarget.style.setProperty(
          "--mx",
          `${((e.clientX - r.left) / r.width - 0.5) * 16}px`,
        );
        e.currentTarget.style.setProperty(
          "--my",
          `${((e.clientY - r.top) / r.height - 0.5) * 16}px`,
        );
      }}
      onPointerLeave={(e) => {
        e.currentTarget.style.setProperty("--mx", "0px");
        e.currentTarget.style.setProperty("--my", "0px");
      }}
    >
      <span>{loading ? "Opening…" : children}</span>
      <span className="lp-arrow" aria-hidden="true">
        ↗
      </span>
    </Link>
  );
}
export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  return (
    <button
      className="lp-theme"
      type="button"
      aria-label={`Switch to ${resolvedTheme === "dark" ? "light" : "dark"} mode`}
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
    >
      <span className="lp-sun">
        <Icon.sun />
      </span>
      <span className="lp-moon">
        <Icon.moon />
      </span>
    </button>
  );
}
export function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const { scrollY } = useScroll();
  useMotionValueEvent(scrollY, "change", (y) => setScrolled(y > 24));
  return (
    <header className="lp-nav" data-scrolled={scrolled}>
      <div className="lp-nav-inner">
        <Brand />
        <nav aria-label="Main navigation">
          <a href="#preview">The studio</a>
          <a href="#how-it-works">How it works</a>
        </nav>
        <div className="lp-nav-actions">
          <Link href="/login" className="lp-signin">
            Sign in
          </Link>
          <ThemeToggle />
          <GlassButton href="/app">Open the app</GlassButton>
        </div>
      </div>
    </header>
  );
}
export function HeroHeadline() {
  const words = ["Your", "next", "short.", "Already", "proven."];
  return (
    <h1 aria-label="Your next short. Already proven.">
      <span className="lp-headline-line">
        {words.slice(0, 3).map((word, i) => (
          <span
            aria-hidden="true"
            className="lp-word"
            style={{ "--delay": `${i * 70}ms` } as CSSProperties}
            key={word}
          >
            {word}{" "}
          </span>
        ))}
      </span>
      <span className="lp-emphasis">
        {words.slice(3).map((word, i) => (
          <span
            aria-hidden="true"
            className="lp-word"
            style={{ "--delay": `${280 + i * 70}ms` } as CSSProperties}
            key={word}
          >
            {word}{" "}
          </span>
        ))}
      </span>
    </h1>
  );
}

function PlatformMark({ platform }: { platform: "youtube" | "instagram" | "tiktok" }) {
  if (platform === "youtube") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.6 12 3.6 12 3.6s-7.5 0-9.4.5A3 3 0 0 0 .5 6.2 31 31 0 0 0 0 12a31 31 0 0 0 .5 5.8 3 3 0 0 0 2.1 2.1c1.9.5 9.4.5 9.4.5s7.5 0 9.4-.5a3 3 0 0 0 2.1-2.1A31 31 0 0 0 24 12a31 31 0 0 0-.5-5.8ZM9.6 15.6V8.4L15.8 12l-6.2 3.6Z" />
      </svg>
    );
  }

  if (platform === "instagram") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <rect x="2.25" y="2.25" width="19.5" height="19.5" rx="5.5" />
        <circle cx="12" cy="12" r="4.5" />
        <circle className="lp-platform-dot" cx="17.6" cy="6.5" r="1.15" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M14.6 2h3.2c.3 2 1.5 3.7 3.4 4.6v3.3a9.3 9.3 0 0 1-3.4-1v6.3a6.8 6.8 0 1 1-6.8-6.8c.4 0 .8 0 1.2.1v3.4a3.5 3.5 0 1 0 2.4 3.3V2Z" />
    </svg>
  );
}

export function Hero() {
  return (
    <section className="lp-hero">
      <div className="lp-eyebrow">
        <span className="lp-live-dot" /> A little less guessing. A lot more
        signal.
      </div>
      <HeroHeadline />
      <p className="lp-subline">
        Track the YouTube and Instagram accounts you compete with, see which
        videos beat the channel’s normal, and turn the winners into your own
        hooks and scripts.
      </p>
      <div className="lp-hero-actions">
        <GlassButton href="/app" size="lg">
          Open the app
        </GlassButton>
        <GlassButton href="#how-it-works" variant="secondary" size="lg">
          See how it works
        </GlassButton>
      </div>
      <div className="lp-trust">
        <span className="lp-platform">
          <PlatformMark platform="youtube" /> YouTube
        </span>
        <span className="lp-platform">
          <PlatformMark platform="instagram" /> Instagram
        </span>
        <span className="lp-platform">
          <PlatformMark platform="tiktok" /> TikTok
        </span>
        <i aria-hidden="true" />
        <span className="lp-trust-copy">Bring a video link. Find your next idea.</span>
      </div>
    </section>
  );
}
export function GlowBackground() {
  return (
    <div className="lp-glow" aria-hidden="true">
      <div className="lp-orb lp-orb-blue" />
      <div className="lp-orb lp-orb-lime" />
      <div className="lp-grid" />
      <div className="lp-grain" />
    </div>
  );
}
const videos = [
  {
    title: "Your coffee isn’t bitter because of the beans.",
    channel: "Everyday Ritual",
    score: "276.1x",
    views: "2.4M",
    engagement: "8.2%",
    art: "coffee",
    caption: "BETTER\nMORNINGS",
    duration: "0:38",
  },
  {
    title: "The desk setup rule nobody talks about.",
    channel: "Made Simple",
    score: "84.6x",
    views: "846K",
    engagement: "6.4%",
    art: "desk",
    caption: "LESS,\nBUT BETTER.",
    duration: "0:42",
  },
  {
    title: "I stopped planning my entire day.",
    channel: "Small Experiments",
    score: "62.3x",
    views: "623K",
    engagement: "7.1%",
    art: "plan",
    caption: "ONE\nTHING.",
    duration: "0:31",
  },
  {
    title: "A different way to see the everyday.",
    channel: "Frame by Frame",
    score: "38.9x",
    views: "389K",
    engagement: "5.8%",
    art: "frame",
    caption: "LOOK\nAGAIN.",
    duration: "0:27",
  },
];
function Thumbnail({ video }: { video: (typeof videos)[number] }) {
  return (
    <div className={`lp-thumb lp-art-${video.art}`}>
      <div className="lp-art-object" />
      <span className="lp-thumb-caption">{video.caption}</span>
      <span className="lp-duration">{video.duration}</span>
      <strong className="lp-score">↗ {video.score}</strong>
    </div>
  );
}
export function PreviewVideos() {
  return (
    <>
      <div className="lp-preview-heading">
        <div>
          <small>YOUR COMPETITIVE EDGE</small>
          <h3>
            Videos<span>24</span>
          </h3>
          <p>The ones worth paying attention to.</p>
        </div>
        <span className="lp-mini-primary">+ Add video</span>
      </div>
      <div className="lp-preview-filters">
        <span>All platforms⌄</span>
        <span>All channels⌄</span>
        <span>Last 30 days⌄</span>
        <span>↓ Outlier score</span>
      </div>
      <div className="lp-video-grid">
        {videos.map((v) => (
          <article className="lp-video-card" key={v.channel}>
            <Thumbnail video={v} />
            <small>{v.channel} · 2 days ago</small>
            <h4>{v.title}</h4>
            <div className="lp-video-stats">
              <span>▷ {v.views} views</span>
              <span>♡ {v.engagement}</span>
            </div>
          </article>
        ))}
      </div>
    </>
  );
}
export function PreviewDetail() {
  return (
    <>
      <div className="lp-preview-heading">
        <div>
          <small>VIDEO BREAKDOWN</small>
          <h3>One small change. An extraordinary result.</h3>
          <p>Everyday Ritual · YouTube Shorts</p>
        </div>
      </div>
      <div className="lp-detail-grid">
        <Thumbnail video={videos[0]!} />
        <div>
          <div className="lp-detail-score">
            <small>OUTLIER SCORE</small>
            <strong>
              276.1<span>x</span>
            </strong>
            <p>Above this channel’s normal performance.</p>
            <div className="lp-comparison">
              <i />
            </div>
            <small>
              CHANNEL NORMAL 1× <span>THIS VIDEO 276.1×</span>
            </small>
          </div>
          <div className="lp-breakdown">
            <small>THE HOOK · CONTRARIAN REFRAME</small>
            <h4>“Your coffee is not bitter because of the beans.”</h4>
            <p>
              Challenge a familiar belief. Reveal the real cause. Give the
              viewer one simple thing to try.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
export function PreviewHooks() {
  return (
    <>
      <div className="lp-preview-heading">
        <div>
          <small>FROM INSIGHT TO IDEA</small>
          <h3>Hook writer</h3>
          <p>A proven structure. Your point of view.</p>
        </div>
        <span className="lp-mini-primary">✧ Generate hooks</span>
      </div>
      <div className="lp-hook-input">
        <small>YOUR TOPIC</small>
        <p>A better morning coffee, without new equipment</p>
        <span>Contrarian reframe</span>
        <span>Conversational</span>
        <span>Short-form</span>
      </div>
      <div className="lp-hook-results">
        {[
          "Your coffee is not bitter because of the beans.",
          "Before you buy a better grinder, try waiting one minute.",
          "Same beans. Same cup. One surprisingly different result.",
        ].map((line, i) => (
          <div key={line}>
            <small>
              0{i + 1} /{" "}
              {
                [
                  "CHALLENGE THE ASSUMPTION",
                  "CREATE CURIOSITY",
                  "PROMISE A TRANSFORMATION",
                ][i]
              }
            </small>
            <h4>“{line}”</h4>
            <span>↗ Use this hook</span>
          </div>
        ))}
      </div>
    </>
  );
}
export function AppPreview() {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const [manual, setManual] = useState(false);
  const [tryIt, setTryIt] = useState(false);
  const reduced = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { margin: "100px" });
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "start start"],
  });
  const rotateX = useTransform(scrollYProgress, [0, 1], [8, 0]);
  const glowOpacity = useTransform(scrollYProgress, [0, 1], [0.55, 1]);
  useEffect(() => {
    if (paused || reduced || manual || !inView || tryIt) return;
    const id = setInterval(() => setActive((v) => (v + 1) % 3), 4000);
    return () => clearInterval(id);
  }, [paused, reduced, manual, inView, tryIt]);
  const labels = ["Videos", "Video detail", "Hook writer"];
  return (
    <section
      id="preview"
      className="lp-preview-section"
      ref={ref}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setPaused(false);
      }}
      aria-label="Interactive product preview"
    >
      <motion.div
        className="lp-preview-glow"
        style={{ opacity: reduced ? 1 : glowOpacity }}
      >
        <GlowBackground />
      </motion.div>
      <div className="lp-preview-controls">
        <span className="lp-preview-label">
          <span className="lp-live-dot" /> Live preview{" "}
          <small> / sample workspace</small>
        </span>
        <div className="lp-tabs" role="tablist" aria-label="Preview screens">
          {labels.map((label, i) => (
            <button
              key={label}
              id={`preview-tab-${i}`}
              type="button"
              role="tab"
              aria-selected={active === i}
              aria-controls={`preview-panel-${i}`}
              tabIndex={active === i ? 0 : -1}
              onClick={() => {
                setActive(i);
                setManual(true);
              }}
              onKeyDown={(e) => {
                if (!["ArrowRight", "ArrowLeft", "Home", "End"].includes(e.key))
                  return;
                e.preventDefault();
                const next =
                  e.key === "Home"
                    ? 0
                    : e.key === "End"
                      ? 2
                      : (i + (e.key === "ArrowRight" ? 1 : 2)) % 3;
                setActive(next);
                setManual(true);
                document.getElementById(`preview-tab-${next}`)?.focus();
              }}
            >
              {label}
            </button>
          ))}
        </div>
        <button
          className="lp-cycle"
          type="button"
          aria-label={
            manual ? "Resume automatic preview" : "Pause automatic preview"
          }
          onClick={() => setManual((v) => !v)}
        >
          {manual ? "▷" : "Ⅱ"}
        </button>
      </div>
      <motion.div
        className="lp-browser"
        style={{ rotateX: reduced ? 0 : rotateX }}
      >
        <div className="lp-browser-bar">
          <span className="lp-window-dots" aria-hidden="true">
            ● ● ●
          </span>
          <span className="lp-url">⌑ &nbsp; outlierstudio.app/app/videos</span>
          <span aria-hidden="true">↗</span>
        </div>
        <div
          className="lp-app-shell"
          onClick={(e) => {
            if (!(e.target as HTMLElement).closest("button, a")) setTryIt(true);
          }}
        >
          <aside className="lp-preview-sidebar" aria-hidden="true">
            <div className="lp-preview-brand">
              outlier<span>studio.</span>
            </div>
            <small>RESEARCH</small>
            {["Videos", "Discover", "Hook library"].map((s, i) => (
              <div key={s} data-active={i === 0 && active !== 2}>
                <Icon.feed />
                {s}
              </div>
            ))}
            <small>CREATE</small>
            {["Scripts", "Hook writer", "Analyze a link", "Library"].map(
              (s) => (
                <div key={s} data-active={s === "Hook writer" && active === 2}>
                  <Icon.scripts />
                  {s}
                </div>
              ),
            )}
            <small>SETUP</small>
            <div>
              <Icon.competitors />
              Channels
            </div>
            <div className="lp-workspace-avatar">
              S{" "}
              <span>
                Sample workspace<small>CREATOR PLAN</small>
              </span>
            </div>
          </aside>
          <div className="lp-preview-content">
            {[PreviewVideos, PreviewDetail, PreviewHooks].map((Panel, i) => (
              <div
                className="lp-preview-panel"
                key={labels[i]}
                id={`preview-panel-${i}`}
                role="tabpanel"
                aria-labelledby={`preview-tab-${i}`}
                aria-hidden={active !== i}
                data-active={active === i}
              >
                <Panel />
              </div>
            ))}
          </div>
          <button
            className="lp-preview-hit"
            type="button"
            aria-label="Try Outlier Studio"
            aria-expanded={tryIt}
            onClick={() => {
              setTryIt(true);
              requestAnimationFrame(() =>
                ref.current
                  ?.querySelector<HTMLButtonElement>(".lp-overlay-close")
                  ?.focus(),
              );
            }}
          />
          {tryIt && (
            <div
              className="lp-try-overlay"
              role="region"
              aria-label="Try Outlier Studio"
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  setTryIt(false);
                  ref.current
                    ?.querySelector<HTMLButtonElement>(".lp-preview-hit")
                    ?.focus();
                }
              }}
            >
              <button
                type="button"
                className="lp-overlay-close"
                aria-label="Close try it overlay"
                onClick={() => setTryIt(false)}
              >
                ×
              </button>
              <span className="lp-eyebrow">Your next idea starts here</span>
              <h3>Make this workspace yours.</h3>
              <GlassButton href="/app" size="lg">
                Try it
              </GlassButton>
            </div>
          )}
        </div>
      </motion.div>
      <p className="lp-preview-caption">
        REAL WORKFLOW. FICTIONAL DATA. YOUR NEXT UNFAIR ADVANTAGE.
      </p>
    </section>
  );
}
function Reveal({
  children,
  className = "",
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  const reduced = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={{
        opacity: 0,
        y: reduced ? 0 : 20,
        filter: reduced ? "none" : "blur(8px)",
      }}
      whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      viewport={{ once: true, amount: 0.1 }}
      transition={{ duration: 0.65, delay, ease }}
    >
      {children}
    </motion.div>
  );
}
export function ExampleScript() {
  return (
    <section id="example" className="lp-example lp-container">
      <Reveal className="lp-section-copy">
        <span className="lp-kicker">01 / FROM SIGNAL TO SCRIPT</span>
        <h2>
          Not just inspiration.
          <br />
          <span>Your next take.</span>
        </h2>
        <p>
          Write your next short from the ones that already worked. Turn a
          winning hook into your own script, timed line by line for the camera.
        </p>
        <GlassButton href="/app" size="lg">
          Write your version
        </GlassButton>
        <span className="lp-side-note">
          Your voice. A structure that works.
        </span>
      </Reveal>
      <Reveal className="lp-script-card">
        <div className="lp-script-top">
          <span>
            <i className="lp-live-dot" /> Example script
          </span>
          <span>COFFEE / SHORT-FORM</span>
        </div>
        {script.sections.map((section) => (
          <div
            className="lp-script-section"
            data-hook={section.key === "hook"}
            key={section.key}
          >
            <h3>{section.label}</h3>
            {section.lines.map((line, i) => (
              <Reveal
                className="lp-script-line"
                delay={Math.min(i * 0.045, 0.2)}
                key={line.text}
              >
                <time>{clock(line.startSeconds)}</time>
                <p>{line.text}</p>
              </Reveal>
            ))}
          </div>
        ))}
        <div className="lp-script-bottom">
          About {Math.round(script.seconds)} seconds spoken · {script.words}{" "}
          words<span>Times assume 2.5 words per second.</span>
        </div>
      </Reveal>
    </section>
  );
}
function LazyStepVisual({ index, lit }: { index: number; lit: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const visible = useInView(ref, { once: true, margin: "200px" });
  return (
    <div className="lp-lazy-visual" ref={ref}>
      {visible && <StepVisual index={index} lit={lit} />}
    </div>
  );
}
function StepVisual({ index, lit }: { index: number; lit: boolean }) {
  return (
    <div className="lp-step-visual" data-lit={lit}>
      {index === 0 ? (
        <>
          <small>
            YOUR WATCHLIST <span>MONITORING ●</span>
          </small>
          {["Everyday Ritual", "Made Simple", "Frame by Frame"].map(
            (name, i) => (
              <div
                className="lp-channel"
                style={{ "--item": i } as CSSProperties}
                key={name}
              >
                <b>{name[0]}</b>
                <span>
                  {name}
                  <small>{i === 1 ? "Instagram" : "YouTube"}</small>
                </span>
                <i>✓</i>
              </div>
            ),
          )}
        </>
      ) : index === 1 ? (
        <>
          <small>PERFORMANCE VS. CHANNEL NORMAL</small>
          <div className="lp-rank">
            <span>
              Your coffee isn’t bitter… <b>276.1×</b>
            </span>
            <div>
              <i />
            </div>
          </div>
          <div className="lp-rank lp-rank-small">
            <span>
              The perfect pour <b>12.8×</b>
            </span>
            <div>
              <i />
            </div>
          </div>
          <div className="lp-normal">│ Normal performance · 1×</div>
        </>
      ) : (
        <>
          <small>
            YOUR SCRIPT <span>READY TO RECORD</span>
          </small>
          {script.sections.map((s, i) => (
            <div
              className="lp-typed"
              style={{ "--item": i } as CSSProperties}
              key={s.key}
            >
              <time>{clock(s.lines[0]!.startSeconds)}</time>
              <div>
                <small>{s.label}</small>
                <p aria-label={s.lines[0]!.text}>
                  {s.lines[0]!.text.split(" ").map((word, j) => (
                    <span
                      aria-hidden="true"
                      className="lp-type-word"
                      style={{ "--word": j } as CSSProperties}
                      key={j}
                    >
                      {word}{" "}
                    </span>
                  ))}
                </p>
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
export function StepsPath() {
  const ref = useRef<HTMLElement>(null);
  const pathRef = useRef<SVGPathElement>(null);
  const reduced = useReducedMotion();
  const [progress, setProgress] = useState(0);
  const [point, setPoint] = useState({ x: 42, y: 76 });
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end end"],
  });
  const pathLength = useTransform(scrollYProgress, [0, 0.9], [0, 1]);
  useMotionValueEvent(pathLength, "change", (value) => {
    setProgress(value);
    if (pathRef.current) {
      const p = pathRef.current.getPointAtLength(
        pathRef.current.getTotalLength() * value,
      );
      setPoint({ x: p.x, y: p.y });
    }
  });
  const layoutRef = useRef<HTMLDivElement>(null);
  const [geometry, setGeometry] = useState({
    width: 980,
    height: 470,
    d: "M42 76 C-15 146 180 146 180 235 S42 324 42 394",
  });
  useEffect(() => {
    const layout = layoutRef.current;
    if (!layout) return;
    const measure = () => {
      const bounds = layout.getBoundingClientRect();
      const nodes = Array.from(layout.querySelectorAll(".lp-node")).map(
        (node) => {
          const r = node.getBoundingClientRect();
          return {
            x: r.left - bounds.left + r.width / 2,
            y: r.top - bounds.top + r.height / 2,
          };
        },
      );
      const [a, b, c] = nodes;
      if (!a || !b || !c) return;
      setGeometry({
        width: bounds.width,
        height: bounds.height,
        d: window.matchMedia("(max-width: 700px)").matches
          ? `M${a.x} ${a.y} L${c.x} ${c.y}`
          : `M${a.x} ${a.y} C${a.x - 90} ${b.y},${b.x} ${a.y},${b.x} ${b.y} S${c.x - 90} ${b.y},${c.x} ${c.y}`,
      });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(layout);
    return () => observer.disconnect();
  }, []);
  const path = geometry.d;
  return (
    <section id="how-it-works" className="lp-journey" ref={ref}>
      <div className="lp-journey-sticky lp-container">
        <div className="lp-journey-title">
          <span className="lp-kicker">02 / A REPEATABLE CREATIVE PROCESS</span>
          <h2>
            Follow the signal.
            <br />
            <span>Make something yours.</span>
          </h2>
          <p>Three steps from “why did that work?” to “ready to record.”</p>
        </div>
        <div className="lp-path-layout" ref={layoutRef}>
          <svg
            className="lp-path-svg"
            viewBox={`0 0 ${geometry.width} ${geometry.height}`}
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <path d={path} className="lp-path-track" />
            <motion.path
              ref={pathRef}
              d={path}
              className="lp-path-drawn"
              style={{ pathLength: reduced ? 1 : pathLength }}
            />
            <circle className="lp-traveller" cx={point.x} cy={point.y} r="5" />
          </svg>
          <ol>
            {steps.map(([title, description], i) => {
              const lit = !!reduced || progress >= ([0, 0.49, 0.98][i] ?? 1);
              return (
                <li
                  className={`lp-path-step lp-path-step-${i}`}
                  key={title}
                  data-lit={lit}
                >
                  <div className="lp-node" aria-hidden="true">
                    0{i + 1}
                  </div>
                  <div className="lp-step-copy">
                    <h3>{title}</h3>
                    <p>{description}</p>
                  </div>
                  <LazyStepVisual index={i} lit={lit} />
                </li>
              );
            })}
          </ol>
        </div>
        <p className="lp-scroll-note">
          SCROLL TO FOLLOW THE SIGNAL <span>↓</span>
        </p>
      </div>
    </section>
  );
}
export function FinalCTA() {
  return (
    <section className="lp-final">
      <GlowBackground />
      <Reveal>
        <span className="lp-kicker">THE NEXT OUTLIER COULD BE YOURS.</span>
        <h2>
          Less blank page.
          <br />
          <span>More breakthrough.</span>
        </h2>
        <p>Find what works. Understand why. Make it your own.</p>
        <GlassButton href="/app" size="lg">
          Open the app
        </GlassButton>
        <Link href="/signup" className="lp-create-account">
          New here? Create an account ↗
        </Link>
      </Reveal>
    </section>
  );
}
export function Footer() {
  return (
    <footer className="lp-footer lp-container">
      <div>
        <Brand />
        <p>
          Outlier Studio. Channel monitoring works with YouTube and Instagram.
          Single videos can come from YouTube, TikTok or Instagram.
        </p>
      </div>
      <nav aria-label="Footer">
        <a href="#preview">The studio</a>
        <a href="#how-it-works">How it works</a>
        <Link href="/login">Sign in</Link>
      </nav>
      <span>Made for your next great idea.</span>
    </footer>
  );
}
export function LandingPage() {
  return (
    <div className="lp">
      <a className="lp-skip" href="#main">
        Skip to content
      </a>
      <Nav />
      <main id="main">
        <Hero />
        <AppPreview />
        <ExampleScript />
        <StepsPath />
        <FinalCTA />
      </main>
      <Footer />
    </div>
  );
}
