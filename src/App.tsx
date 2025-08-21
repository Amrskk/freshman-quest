import React, { useEffect, useMemo, useState } from "react";
import logo from "./assets/logo.jpg";


// ---- Types ----
type Step = {
  id: string;
  title: string;
  summary: string;
  bullets?: string[]; // quick checklist points
  links?: { label: string; href: string }[];
};

// ---- Demo Data: customize for your uni ----
const STEPS: Step[] = [
  {
    id: "Orientation week",
    title: "Orientation Week and Campus Tour",
    summary:
      "Join the orientation week events to meet mentors, explore campus, and get your first tasks.",
    bullets: ["Visited orientation week", "Got the event schedule", "Met your mentor", "Visited the campus"],
  },
  {
    id: "email",
    title: "Activate Student Email",
    summary:
      "Get your @uni mail working. You'll need it for WSP, Wi‑Fi, apps, library, and password resets.",
    bullets: ["Recieve login and password from kbtu on your main email and check if Outlook login and password work ", "Set up your WSP password ","Install Outlook app on your phone"],
  },
  {
    id: "microsoft 365",
    title: "Access Microsoft 365 and Teams",
    summary:
      "Log into your Outlook email(account), password is going to be the same as your WSP password, then access Microsoft 365 apps.",
    bullets: ["Login works", "Enroll to Microsoft Teams accout", "Microsoft 365 apps installed"],
    links: [{ label: "outlook", href: "https://outlook.office.com/mail/" }],
  },
  {
    id: "schedule",
    title: "How to find your schedule",
    summary:
      "You can find your schedule on WSP website, just click the 'house' icon and enter the 'student schedule' section",
    bullets: ["Logged in on your WSP account", "Clicked the 'house' icon", "Schedule section opened"],
    links: [{ label: "Timetable Tool", href: "https://wsp.kbtu.kz/" }],
  },
  {
    id: "clubs",
    title: "Clubs & Communities",
    summary:
      "Pick a club or a community to try in the first month.",
    bullets: ["Attend the clubs fair", "Find a club for yourself", "Talk to a mentor"],
  },
];

// ---- Utilities ----
const LS_KEY = "freshman-quest-progress-v1";

type Persist = {
  doneSteps: string[];
  checklist: Record<string, Record<number, boolean>>; // stepId -> bullet idx -> checked
};

function loadPersist(): Persist {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return { doneSteps: [], checklist: {} };
    const parsed = JSON.parse(raw);
    return {
      doneSteps: Array.isArray(parsed.doneSteps) ? parsed.doneSteps : [],
      checklist: parsed.checklist || {},
    };
  } catch {
    return { doneSteps: [], checklist: {} };
  }
}

function savePersist(p: Persist) {
  localStorage.setItem(LS_KEY, JSON.stringify(p));
}

// ---- Local Prediction Generator (no server) ----
type Locale = "en";

const TEMPLATES: Record<Locale, string[]> = {
  en: [
    "{name} finds a perfect study spot near {place}.",
    "{name} cracks the {topic} quiz with calm confidence.",
    "A friendly mentor appears at {place} right on time.",
    "You join {club} and meet your future teammate.",
    "Free coffee finds you after {task}—pure luck.",
    "A professor remembers your name during {event}.",
    "Your {topic} notes go viral in the group chat.",
    "You speedrun library resources in one afternoon.",
    "The Wi-Fi behaves during your {task} session.",
    "Your timetable puzzle clicks, zero clashes.",
    "You gonna get 3 retakes bro💔",
    "prepare for the worst HAHA (sorry:3)",
    "Your scholarship will fade away after 1st semester, better study harder",
    "Amrskk may be will help you out with your studies, but only if you ask him nicely",
    "You are going to get annoyed with people sitting in the halyk coworking 24/7",
  ]
};

const PLACES = ["the library", "Main Hall", "Cafeteria A", "the printing room", "Dorm lobby"];
const TOPICS = ["calculus", "physics", "linear algebra", "programming principles", "discrete structures"];
const CLUBS  = ["Robotics", "Debate", "Music", "AI Society", "Sports"];
const TASKS  = ["group study", "project sprint", "lab prep", "note review", "morning planning"];
const EVENTS = ["orientation", "first lecture", "TA session", "club fair", "lab intro"];

function pick<T>(xs: T[], rnd: () => number) { return xs[Math.floor(rnd() * xs.length)] }

// Small seeded RNG so results are stable per user+progress
function makeRng(seedStr: string) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < seedStr.length; i++) {
    h ^= seedStr.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return () => {
    // xorshift32
    h ^= h << 13; h ^= h >>> 17; h ^= h << 5;
    return ((h >>> 0) % 1_000_000) / 1_000_000;
  };
}

function generatePredictions(opts: {
  name?: string;
  stepsLeft: string[];
  locale?: Locale;
  count?: number;
}) {
  const { name = "You", stepsLeft, locale = "en", count = 10 } = opts;
  // seed = name + unfinished steps (so it changes as they progress)
  const seed = `${name}|${stepsLeft.join(",")}|${locale}`;
  const rnd = makeRng(seed);

  const tpls = TEMPLATES[locale] ?? TEMPLATES.en;
  const out: string[] = [];
  for (let i = 0; i < count; i++) {
    const tpl = pick(tpls, rnd)
      .replaceAll("{name}", name)
      .replaceAll("{place}", pick(PLACES, rnd))
      .replaceAll("{topic}", stepsLeft[0]?.toLowerCase() ?? pick(TOPICS, rnd))
      .replaceAll("{club}", pick(CLUBS, rnd))
      .replaceAll("{task}", pick(TASKS, rnd))
      .replaceAll("{event}", pick(EVENTS, rnd));
    if (!out.includes(tpl)) out.push(tpl);
  }
  // ensure we return exactly `count`
  while (out.length < count) out.push(pick(tpls, rnd).replaceAll("{name}", name));
  return out.slice(0, count);
}

// ---- Small UI helpers ----
function clsx(...xs: (string | false | undefined)[]) {
  return xs.filter(Boolean).join(" ");
}

// ---- Components ----
function ProgressBar({ value }: { value: number }) {
  return (
    <div className="w-full h-3 rounded-full bg-white/10 overflow-hidden">
      <div
        className="h-full bg-cyan-400 transition-all"
        style={{ width: `${value}%` }}
      />
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 shadow-xl p-5">
      {children}
    </div>
  );
}

function StepCard({
  step,
  done,
  onToggleDone,
  checklistState,
  onToggleBullet,
}: {
  step: Step;
  done: boolean;
  onToggleDone: () => void;
  checklistState: Record<number, boolean>;
  onToggleBullet: (idx: number) => void;
}) {
  const allBulletsChecked = (step.bullets || []).every((_, i) => checklistState?.[i]);

  return (
    <Card>
      <div className="flex items-start gap-4">
        <button
          onClick={onToggleDone}
          title={done ? "Mark as not done" : "Mark as done"}
          className={clsx(
            "mt-1 size-6 shrink-0 rounded-md border flex items-center justify-center",
            done
              ? "bg-emerald-400 text-emerald-950 border-emerald-300"
              : "bg-white/10 border-white/20"
          )}
        >
          {done ? "✓" : ""}
        </button>
        <div className="flex-1">
          <h3 className="text-lg font-semibold">{step.title}</h3>
          <p className="text-white/80 mt-1">{step.summary}</p>

          {step.bullets && step.bullets.length > 0 && (
            <ul className="mt-3 space-y-2">
              {step.bullets.map((b, i) => (
                <li key={i} className="flex items-start gap-2">
                  <input
                    type="checkbox"
                    checked={!!checklistState?.[i]}
                    onChange={() => onToggleBullet(i)}
                    className="mt-1 accent-cyan-400"
                  />
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          )}

          {step.links && step.links.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {step.links.map((l, i) => (
                <a
                  key={i}
                  href={l.href}
                  target="_blank"
                  className="px-3 py-1.5 rounded-lg border border-white/15 bg-white/5 hover:bg-white/10 text-sm transition"
                >
                  {l.label} ↗
                </a>
              ))}
            </div>
          )}
        </div>
      </div>

      {allBulletsChecked && !done && (
        <div className="mt-3 text-sm text-emerald-300">
          Checklist complete — mark the step as done ✓
        </div>
      )}
    </Card>
  );
}

function useProgress() {
  // load & sanitize persisted data against current STEPS
  const [persist, setPersist] = useState<Persist>(() => {
    const p = loadPersist();
    const validIds = new Set(STEPS.map(s => s.id));

    const cleaned: Persist = {
      doneSteps: (p.doneSteps || []).filter(id => validIds.has(id)),
      checklist: Object.fromEntries(
        Object.entries(p.checklist || {}).filter(([id]) => validIds.has(id))
      ),
    };

    // write back if we removed anything stale
    if (JSON.stringify(cleaned) !== JSON.stringify(p)) {
      savePersist(cleaned);
    }
    return cleaned;
  });

  useEffect(() => {
    savePersist(persist);
  }, [persist]);

  const toggleDone = (id: string) =>
    setPersist((p) => {
      const has = p.doneSteps.includes(id);
      return { ...p, doneSteps: has ? p.doneSteps.filter((x) => x !== id) : [...p.doneSteps, id] };
    });

  const toggleBullet = (stepId: string, idx: number) =>
    setPersist((p) => {
      const cur = p.checklist[stepId] || {};
      const next = { ...cur, [idx]: !cur[idx] };
      return { ...p, checklist: { ...p.checklist, [stepId]: next } };
    });

  // only count steps that exist in current STEPS
  const validDoneCount = persist.doneSteps.filter(id => STEPS.some(s => s.id === id)).length;
  const total = Math.max(1, STEPS.length);
  const percent = Math.min(100, Math.round((validDoneCount / total) * 100));
  const allDone = validDoneCount === total;

  return { persist, toggleDone, toggleBullet, percent, allDone } as const;
}


// ---- Wheel of Fortune ----
function Wheel({ items, onResult }: { items: string[]; onResult: (value: string) => void }) {
  const [spinning, setSpinning] = useState(false);
  const [angle, setAngle] = useState(0);

  const slice = 360 / items.length;

  const gradient = useMemo(() => {
    const colors = items.map((_, i) => (i % 2 === 0 ? "rgba(34,211,238,0.9)" : "rgba(255,255,255,0.85)"));
    const stops: string[] = [];
    for (let i = 0; i < items.length; i++) {
      const start = i * slice;
      const end = (i + 1) * slice;
      stops.push(`${colors[i]} ${start}deg ${end}deg`);
    }
    return `conic-gradient(${stops.join(", ")})`;
  }, [items, slice]);

  const spin = () => {
    if (spinning) return;
    setSpinning(true);
    const idx = Math.floor(Math.random() * items.length);
    // Compute target angle so that the chosen index lands at the top (pointer at 0deg)
    const targetCenter = idx * slice + slice / 2;
    const extraTurns = 5; // full spins
    const final = extraTurns * 360 + (360 - targetCenter);

    setAngle((prev) => prev + final);

    // settle result (match CSS transition duration below)
    setTimeout(() => {
      setSpinning(false);
      onResult(items[idx]);
    }, 3500);
  };

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative">
        {/* Pointer */}
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
          <div className="w-0 h-0 border-l-8 border-r-8 border-b-[14px] border-l-transparent border-r-transparent border-b-rose-400" />
        </div>
        {/* Wheel */}
        <div
          className="size-72 rounded-full border-4 border-white/70 shadow-2xl flex items-center justify-center select-none"
          style={{
            background: gradient,
            transform: `rotate(${angle}deg)`,
            transition: spinning ? "transform 3.5s cubic-bezier(0.22, 1, 0.36, 1)" : undefined,
          }}
        >
          <div className="text-center text-sm px-6 leading-5 text-black/80">
            Spin me!
          </div>
        </div>
      </div>
      <button
        onClick={spin}
        className={clsx(
          "px-4 py-2 rounded-xl font-semibold",
          spinning ? "bg-white/20 text-white/70 cursor-not-allowed" : "bg-cyan-400 text-slate-950 hover:bg-cyan-300"
        )}
        disabled={spinning}
      >
        {spinning ? "Spinning..." : "Spin the Wheel"}
      </button>
    </div>
  );
}

// ---- Main App ----
export default function FreshmanQuestApp() {
  const { persist, toggleDone, toggleBullet, percent, allDone } = useProgress();
  const [name, setName] = useState("");
  const [result, setResult] = useState<string | null>(null);
  const LOCALE: Locale = "en"; // or "ru" | "kk"
  const [predictions, setPredictions] = useState<string[]>(() =>
    generatePredictions({
      name: "You",
      stepsLeft: STEPS.map(s => s.title), // initial guess before progress/name
      locale: LOCALE,
      count: 10,
    })
  );

  useEffect(() => {
    const stepsLeft = STEPS
      .filter(s => !persist.doneSteps.includes(s.id))
      .map(s => s.title);
    const preds = generatePredictions({
      name: name || "You",
      stepsLeft,
      locale: LOCALE, // "en" | "ru" | "kk"
      count: 10,
    });

    setPredictions(preds);
  }, [name, persist.doneSteps]);


  return (
    <div className="min-h-dvh font-sans bg-[radial-gradient(1000px_600px_at_70%_-10%,#1f2937_0%,#0f172a_40%,#0b1224_100%)] text-slate-100">
      <div className="max-w-4xl mx-auto px-5 py-10 md:py-14">
        {/* Header */}
        <header className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div className="flex items-center gap-3">
            <img src={logo} alt="SCHOOL OF IT&E" className="h-64 w-auto rounded-md" />
            <div>
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight">
              Welcome,KBTU Freshman!🏛️ 
            </h1>
            <p className="text-slate-300 mt-2">
              {" "}
              <span className="text-cyan-300 font-semibold">Quest Roadmap</span>{" "}
              — finish all steps to unlock the Wheel of Fortune.
            </p>
          </div>
        </div>
          <div className="flex items-center gap-2">
            <input
              placeholder="Your name (optional)"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="px-3 py-2 rounded-xl bg-white/10 border border-white/20 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-400/40"
            />
          </div>
        </header>

        {/* Progress */}
        <div className="mt-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-slate-300">Progress</span>
            <span className="text-sm font-semibold">{percent}%</span>
          </div>
          <ProgressBar value={percent} />
        </div>

        {/* Steps */}
        <div className="mt-6 grid gap-4">
          {STEPS.map((s) => (
            <StepCard
              key={s.id}
              step={s}
              done={persist.doneSteps.includes(s.id)}
              onToggleDone={() => toggleDone(s.id)}
              checklistState={persist.checklist[s.id] || {}}
              onToggleBullet={(idx) => toggleBullet(s.id, idx)}
            />
          ))}
        </div>

        {/* Finale */}
        <div className="mt-10">
          <Card>
            <div className="flex flex-col md:flex-row items-start md:items-center gap-6 md:gap-8">
              <div className="flex-1">
                <h2 className="text-2xl font-bold">Finale: Wheel of Fortune . GAMBLING TIME YOO</h2>
                {!allDone ? (
                  <p className="text-slate-300 mt-2">
                    Complete all roadmap steps to unlock the wheel. You're at {percent}% — keep going!
                  </p>
                ) : (
                  <p className="text-slate-300 mt-2">
                    Great job{ name ? `, ${name}` : ""}! Spin the wheel bro.
                  </p>
                )}
              </div>

              <div className={clsx("w-full md:w-auto", !allDone && "opacity-40 pointer-events-none")}>                
                <Wheel items={predictions} onResult={setResult} />
              </div>
            </div>

            {result && (
              <div className="mt-6 p-4 rounded-xl bg-emerald-400/15 border border-emerald-300/30">
                <div className="text-sm uppercase tracking-wide text-emerald-300">Your Fortune</div>
                <div className="text-lg font-semibold mt-1">{result}</div>
              </div>
            )}
          </Card>
        </div>

        {/* Footer */}
        <footer className="text-center text-slate-400 mt-10 text-sm">
         !! Share in stories, tagging us on Instagram{" "}
        <a
          href="https://instagram.com/kbtu.site"
          target="_blank"
          rel="noreferrer"
          className="font-semibold text-slate-200 hover:text-cyan-400"
        >
          @kbtu.site !!
        </a>
        </footer>
      </div>
    </div>
  );
}

