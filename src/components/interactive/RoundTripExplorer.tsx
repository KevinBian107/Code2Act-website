import { useState } from "react";
import LoopVideo from "./LoopVideo";
import { asset, MLB, pretty, rgb } from "./util";

interface Clip {
  code: number;
  name: string;
  color: number[];
  readouts: string[];
  src: string;
  poster: string;
}
interface Row {
  label: string;
  base: string;
  n: number;
  exact: number;
  same: number;
  cross: number;
  dest: string | null;
  same_dest: string | null;
}
interface Bars {
  rows: Row[];
  symbol_acc: number;
  behavior_acc: number;
}

interface Props {
  base: string;
  clips: Clip[];
  bars: Record<string, Bars>;
}

const SEG = ["#1b4965", "#7fa8c9", "#e2e2e2"];
const NAMES: Record<string, string> = { mlb: "MLB", kpms: "KPMS", kvae: "KVAE" };
const short = (s: string) => s.replace("Left", "L").replace("Right", "R").replace("Straight", "S");

/** Hold a symbol from four start poses; read the motion back (Fig. 3a, 6). */
export default function RoundTripExplorer({ base, clips, bars }: Props) {
  const [sel, setSel] = useState(0);
  const [strategy, setStrategy] = useState("mlb");
  const clip = clips[sel];
  const b = bars[strategy];
  const selName = clip.name;

  const verdict = (r: string) => {
    if (r === clip.name) return { tag: "symbol", cls: "bg-[#1b4965]" };
    if (r.split("_")[0] === clip.name.split("_")[0]) return { tag: "same behavior", cls: "bg-[#5d87aa]" };
    return { tag: "different", cls: "bg-zinc-500" };
  };

  return (
    <div className="not-prose rounded-2xl border border-zinc-200 bg-white p-3 sm:p-5 dark:border-zinc-700 dark:bg-zinc-900">
      <div className="mb-3 flex flex-wrap items-center gap-1.5">
        <span className="mr-1 text-xs tracking-wide text-zinc-400 uppercase">hold symbol</span>
        {clips.map((c, i) => (
          <button
            key={c.code}
            onClick={() => setSel(i)}
            className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-sm transition ${
              i === sel ? "border-zinc-900 dark:border-zinc-100" : "border-zinc-200 text-zinc-600 hover:border-zinc-400 dark:border-zinc-700"
            }`}
          >
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: rgb(c.color) }} />
            {pretty(c.name)}
          </button>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
        <div>
          <div className="relative">
          <LoopVideo src={asset(base, clip.src)} poster={asset(base, clip.poster)} className="block w-full rounded-lg bg-white" />
          <div className="pointer-events-none absolute inset-0 grid grid-cols-2 grid-rows-2">
            {clip.readouts.map((r, i) => {
              const v = verdict(r);
              return (
                <div key={i} className="flex items-end justify-start p-2">
                  <span className={`rounded px-1.5 py-0.5 text-[11px] text-white sm:text-xs ${v.cls}`}>
                    reads {pretty(r)} · {v.tag}
                  </span>
                </div>
              );
            })}
          </div>
          </div>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
            Four bodies, four random start poses, one held symbol: <b>{pretty(selName)}</b>. Each tag is the readout of the
            same kinematic labeler that scores the round trip, computed on that body's settled motion.
          </p>
        </div>

        <div>
          <div className="mb-2 flex items-center gap-1.5">
            {Object.keys(bars).map((s) => (
              <button
                key={s}
                onClick={() => setStrategy(s)}
                className={`rounded-full px-2.5 py-0.5 text-xs ${
                  s === strategy ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900" : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800"
                }`}
              >
                {NAMES[s]}
              </button>
            ))}
            <span className="ml-auto text-xs text-zinc-500">
              symbol {Math.round(b.symbol_acc * 100)}% · behavior {Math.round(b.behavior_acc * 100)}%
            </span>
          </div>
          <svg viewBox={`0 0 420 ${b.rows.length * 30 + 30}`} className="w-full">
            {b.rows.map((r, i) => {
              const y = i * 30 + 4;
              const x0 = 78;
              const w = 330;
              const segs = [r.exact, r.same, r.cross];
              let acc = 0;
              const hl = strategy === "mlb" && short(r.label) === selName;
              const symColor = MLB.find((m) => m.name === short(r.label))?.color;
              return (
                <g key={r.label} opacity={strategy === "mlb" && !hl ? 0.55 : 1}>
                  <text x={x0 - 6} y={y + 17} textAnchor="end" fontSize={12} fontWeight={hl ? 700 : 400} fill={symColor ? rgb(symColor) : "#3f3f46"}>
                    {pretty(short(r.label))}
                  </text>
                  {segs.map((v, k) => {
                    const x = x0 + acc * w;
                    acc += v;
                    return <rect key={k} x={x} y={y} width={Math.max(0, v * w - 1)} height={24} fill={SEG[k]} rx={2} />;
                  })}
                  {r.exact >= 0.12 && (
                    <text x={x0 + 5} y={y + 16} fontSize={11} fill="white">
                      {Math.round(r.exact * 100)}%
                    </text>
                  )}
                  {r.cross >= 0.12 && r.dest && (
                    <text x={x0 + w - 4} y={y + 16} fontSize={10} textAnchor="end" fill="#52525b">
                      {Math.round(r.cross * 100)}% → {pretty(short(r.dest))}
                    </text>
                  )}
                  {hl && <rect x={x0 - 2} y={y - 2} width={w + 4} height={28} fill="none" stroke="#18181b" strokeWidth={1.5} rx={3} />}
                </g>
              );
            })}
            <g transform={`translate(78, ${b.rows.length * 30 + 12})`}>
              {["commanded symbol", "same behavior, other dir.", "different behavior"].map((l, k) => (
                <g key={l} transform={`translate(${[0, 105, 265][k]}, 0)`}>
                  <rect width={10} height={10} fill={SEG[k]} y={-1} />
                  <text x={14} y={8} fontSize={10} fill="#71717a">
                    {l}
                  </text>
                </g>
              ))}
            </g>
          </svg>
          <p className="text-xs text-zinc-500">
            60 start poses per symbol, each strategy read back by its own labeler. Chance is 11% (symbol) and 25% (behavior).
          </p>
        </div>
      </div>
    </div>
  );
}
