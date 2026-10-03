import { useCallback, useRef, useState } from "react";
import LoopVideo from "./LoopVideo";
import { asset, BEHAVIOR_COLORS } from "./util";

interface Clip {
  behavior: string;
  code: number;
  name: string;
  kick_time: number;
  duration: number;
  amps: Record<string, { src: string; poster: string }>;
}
interface Curve {
  behavior: string;
  recovery: (number | null)[];
  deviation: (number | null)[];
}
interface Pert {
  amps: number[];
  curves: Curve[];
  floor: number;
  control: number;
}

interface Props {
  base: string;
  clips: Record<string, Clip[]>;
  curves: Record<string, Pert>;
}

const NAMES: Record<string, string> = { mlb: "MLB", kpms: "KPMS", kvae: "KVAE" };

function LineChart({
  p,
  field,
  title,
  yMax,
  amp,
}: {
  p: Pert;
  field: "recovery" | "deviation";
  title: string;
  yMax: number;
  amp: number;
}) {
  const W = 300;
  const H = 190;
  const m = { l: 36, r: 8, t: 22, b: 30 };
  const xs = p.amps;
  const x = (a: number) => m.l + (a / Math.max(...xs)) * (W - m.l - m.r);
  const y = (v: number) => H - m.b - (v / yMax) * (H - m.t - m.b);
  const ticks = field === "recovery" ? [0, 0.5, 1] : [0, yMax / 2, yMax];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
      <text x={m.l} y={13} fontSize={12} fontWeight={600} fill="#3f3f46">
        {title}
      </text>
      {ticks.map((t) => (
        <g key={t}>
          <line x1={m.l} x2={W - m.r} y1={y(t)} y2={y(t)} stroke="#e4e4e7" />
          <text x={m.l - 4} y={y(t) + 4} fontSize={10} textAnchor="end" fill="#a1a1aa">
            {field === "recovery" ? `${Math.round(t * 100)}%` : t.toFixed(2)}
          </text>
        </g>
      ))}
      {xs.map((a) => (
        <text key={a} x={x(a)} y={H - m.b + 14} fontSize={10} textAnchor="middle" fill="#a1a1aa">
          {a}
        </text>
      ))}
      <text x={(W + m.l) / 2} y={H - 3} fontSize={10} textAnchor="middle" fill="#71717a">
        impulse strength
      </text>
      <rect x={x(amp) - 9} y={m.t - 4} width={18} height={H - m.t - m.b + 4} fill="#ef4444" opacity={0.1} rx={3} />
      {field === "deviation" && (
        <>
          <line x1={m.l} x2={W - m.r} y1={y(p.floor)} y2={y(p.floor)} stroke="#71717a" strokeDasharray="2 3" />
          <line x1={m.l} x2={W - m.r} y1={y(p.control)} y2={y(p.control)} stroke="#a1a1aa" strokeDasharray="6 4" />
          <text x={W - m.r} y={y(p.control) - 4} fontSize={9} textAnchor="end" fill="#a1a1aa">
            distance between symbols
          </text>
        </>
      )}
      {p.curves.map((c) => {
        const pts = c[field]
          .map((v, i) => (v == null ? null : [x(xs[i]), y(Math.min(v, yMax))]))
          .filter(Boolean) as number[][];
        return (
          <g key={c.behavior}>
            <polyline points={pts.map((q) => q.join(",")).join(" ")} fill="none" stroke={BEHAVIOR_COLORS[c.behavior]} strokeWidth={2} />
            {pts.map((q, i) => (
              <circle key={i} cx={q[0]} cy={q[1]} r={2.8} fill={BEHAVIOR_COLORS[c.behavior]} />
            ))}
          </g>
        );
      })}
    </svg>
  );
}

/** Kick a body holding a symbol and watch it return (Fig. 3b,c, 7, 8). */
export default function KickViewer({ base, clips, curves }: Props) {
  const [strategy, setStrategy] = useState("mlb");
  const [beh, setBeh] = useState("Rear");
  const [amp, setAmp] = useState("1.2");
  const [t, setT] = useState(0);
  const [dur, setDur] = useState(1);
  const clip = clips[strategy].find((c) => c.behavior === beh) ?? clips[strategy][0];
  const p = curves[strategy];
  const devMax = Math.ceil(Math.max(p.control * 1.25, ...p.curves.flatMap((c) => c.deviation.filter((v): v is number => v != null))) * 10) / 10;
  const onTime = useCallback((tt: number, d: number) => {
    setT(tt);
    if (d) setDur(d);
  }, []);
  const vref = useRef<HTMLVideoElement | null>(null);
  const kicked = t >= clip.kick_time;
  const ampKeys = Object.keys(clip.amps).sort((x, y) => parseFloat(x) - parseFloat(y));
  // Not every clip has every amplitude (off-floor a = 4 clips are omitted).
  const effAmp = amp in clip.amps ? amp : ampKeys[ampKeys.length - 1];
  const a = clip.amps[effAmp];

  return (
    <div className="not-prose rounded-2xl border border-zinc-200 bg-white p-3 sm:p-5 dark:border-zinc-700 dark:bg-zinc-900">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {Object.keys(clips).length > 1 && <span className="mr-1 text-xs tracking-wide text-zinc-400 uppercase">strategy</span>}
        {Object.keys(clips).length > 1 && Object.keys(clips).map((s) => (
          <button
            key={s}
            onClick={() => setStrategy(s)}
            className={`rounded-full px-3 py-1 text-sm ${
              s === strategy ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900" : "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
            }`}
          >
            {NAMES[s]}
          </button>
        ))}
        <span className="mr-1 text-xs tracking-wide text-zinc-400 uppercase">held symbol</span>
        {["Rear", "Walk"].map((b) => (
          <button
            key={b}
            onClick={() => setBeh(b)}
            className={`rounded-full border px-3 py-1 text-sm ${
              b === beh ? "border-zinc-900 dark:border-zinc-100" : "border-zinc-200 text-zinc-500 dark:border-zinc-700"
            }`}
          >
            {b === "Rear" ? "a rear" : "a walk"}
          </button>
        ))}
        <span className="mr-1 ml-3 text-xs tracking-wide text-zinc-400 uppercase">impulse a</span>
        {ampKeys.map((k) => (
          <button
            key={k}
            onClick={() => setAmp(k)}
            className={`rounded-md px-2 py-0.5 text-sm tabular-nums ${
              k === effAmp ? "bg-red-600 text-white" : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
            }`}
          >
            {k}
          </button>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div>
          <div className="relative">
            <LoopVideo
              src={asset(base, a.src)}
              poster={asset(base, a.poster)}
              className="block w-full rounded-lg bg-white"
              onTime={onTime}
              videoRef={vref}
              restartKey={`${strategy}-${beh}-${effAmp}`}
            />
            <div className="pointer-events-none absolute inset-x-0 top-0 grid grid-cols-2 text-xs sm:text-sm">
              <span className="m-2 w-fit rounded bg-black/55 px-2 py-0.5 text-white">unperturbed twin</span>
              <span className={`m-2 w-fit rounded px-2 py-0.5 text-white transition ${kicked ? "bg-red-600" : "bg-black/55"}`}>
                {kicked ? `kicked (a = ${effAmp})` : "same body, kick at 2 s"}
              </span>
            </div>
          </div>
          <div className="relative mt-2 h-2 rounded bg-zinc-200 dark:bg-zinc-700">
            <div className="h-2 rounded bg-zinc-700 dark:bg-zinc-300" style={{ width: `${(t / dur) * 100}%` }} />
            <div className="absolute -top-1 h-4 w-0.5 bg-red-600" style={{ left: `${(clip.kick_time / dur) * 100}%` }} />
          </div>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
            Both panels are the same body from the same start pose, holding <b>{clip.name.replace("_", " ")}</b>. On the right a
            single-step velocity impulse hits at 2 s (the body flashes red), and the controller, still reading only the symbol,
            tries to bring it back to the motion of its unperturbed twin. For each impulse size we show the best-recovering of the 48 bodies kicked per symbol; the curves on the right average all 48, including those that do not recover.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-1">
          <LineChart p={p} field="recovery" title="displacement recovered after 5 s" yMax={1} amp={parseFloat(effAmp)} />
          <LineChart p={p} field="deviation" title="pose deviation from unperturbed" yMax={devMax} amp={parseFloat(effAmp)} />
          <div className="flex flex-wrap gap-3 text-xs text-zinc-500">
            {p.curves.map((c) => (
              <span key={c.behavior} className="flex items-center gap-1">
                <span className="h-2 w-3 rounded-sm" style={{ background: BEHAVIOR_COLORS[c.behavior] }} />
                {c.behavior}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
