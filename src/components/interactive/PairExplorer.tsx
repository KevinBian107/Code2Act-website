import { useCallback, useState } from "react";
import LoopVideo from "./LoopVideo";
import { asset, MLB, pretty, rgb } from "./util";

interface BodyLab {
  idx: number;
  phase_a: string;
  phase_b: string;
  bridge: string[];
}
interface Pair {
  a: number;
  b: number;
  a_name: string;
  b_name: string;
  switch: number;
  duration: number;
  src: string;
  poster: string;
  readout: { n_diverse: number; bodies: BodyLab[] } | null;
}
interface Props {
  base: string;
  pairs: Pair[];
  counts: number[][];
}

/** Every symbol pair the corpus never contains, one click away (Fig. 13). */
export default function PairExplorer({ base, pairs, counts }: Props) {
  const byKey = new Map(pairs.map((p) => [`${p.a}-${p.b}`, p]));
  const [sel, setSel] = useState<Pair>(pairs.find((p) => p.a_name === "Rear_L" && p.b_name === "Walk_R") ?? pairs[0]);
  const [t, setT] = useState(0);
  const onTime = useCallback((tt: number) => setT(tt), []);
  const inB = t >= sel.switch;

  const diverse = sel.readout ? sel.readout.bodies.slice(0, sel.readout.n_diverse) : [];
  const baseA = sel.a_name.split("_")[0];
  const baseB = sel.b_name.split("_")[0];
  const reachedB = diverse.length ? diverse.filter((d) => d.phase_b === baseB).length / diverse.length : null;
  const heldA = diverse.length ? diverse.filter((d) => d.phase_a === baseA).length / diverse.length : null;
  const cell = 34;

  return (
    <div className="not-prose rounded-2xl border border-zinc-200 bg-white p-3 sm:p-5 dark:border-zinc-700 dark:bg-zinc-900">
      <div className="grid gap-5 lg:grid-cols-[auto_minmax(0,1fr)]">
        <div>
          <div className="mb-1 text-xs tracking-wide text-zinc-400 uppercase">from (row) → to (column)</div>
          <svg viewBox={`0 0 ${86 + 9 * cell} ${70 + 9 * cell}`} className="w-full max-w-[400px]">
            {MLB.map((m, j) => (
              <text
                key={`c${j}`}
                transform={`translate(${86 + j * cell + cell / 2 + 4}, 64) rotate(-55)`}
                fontSize={11}
                fill={rgb(m.color)}
                fontWeight={600}
              >
                {pretty(m.name)}
              </text>
            ))}
            {MLB.map((m, i) => (
              <text key={`r${i}`} x={80} y={70 + i * cell + cell / 2 + 4} textAnchor="end" fontSize={11} fill={rgb(m.color)} fontWeight={600}>
                {pretty(m.name)}
              </text>
            ))}
            {MLB.map((_, i) =>
              MLB.map((__, j) => {
                const p = byKey.get(`${i}-${j}`);
                const x = 86 + j * cell;
                const y = 70 + i * cell;
                if (i === j) return <rect key={`${i}${j}`} x={x + 1} y={y + 1} width={cell - 2} height={cell - 2} fill="#f4f4f5" />;
                if (!p)
                  return (
                    <g key={`${i}${j}`}>
                      <rect x={x + 1} y={y + 1} width={cell - 2} height={cell - 2} fill="#e4e4e7" rx={3} />
                      <text x={x + cell / 2} y={y + cell / 2 + 4} fontSize={9} textAnchor="middle" fill="#a1a1aa">
                        {counts[i]?.[j] ?? ""}
                      </text>
                    </g>
                  );
                const active = sel.a === i && sel.b === j;
                return (
                  <g key={`${i}${j}`} className="cursor-pointer" onClick={() => setSel(p)}>
                    <rect x={x + 1} y={y + 1} width={(cell - 2) / 2} height={cell - 2} fill={rgb(MLB[i].color)} />
                    <rect x={x + 1 + (cell - 2) / 2} y={y + 1} width={(cell - 2) / 2} height={cell - 2} fill={rgb(MLB[j].color)} />
                    <rect
                      x={x + 1}
                      y={y + 1}
                      width={cell - 2}
                      height={cell - 2}
                      fill="none"
                      stroke={active ? "#18181b" : "white"}
                      strokeWidth={active ? 3 : 1}
                      rx={3}
                    />
                  </g>
                );
              }),
            )}
          </svg>
          <div className="mt-1 flex flex-wrap gap-3 text-xs text-zinc-500">
            <span className="flex items-center gap-1">
              <span className="inline-block h-3 w-3 rounded-sm bg-gradient-to-r from-blue-700 to-green-600" /> never in corpus (click)
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block h-3 w-3 rounded-sm bg-zinc-200" /> observed (number of bouts)
            </span>
          </div>
        </div>

        <div>
          <div className="relative">
            <LoopVideo src={asset(base, sel.src)} poster={asset(base, sel.poster)} className="block w-full rounded-lg bg-zinc-900" onTime={onTime} restartKey={sel.src} />
            <div className="absolute top-2 left-2 flex gap-1.5 text-sm">
              <span className={`rounded-md px-2 py-0.5 text-white shadow transition ${inB ? "opacity-40" : ""}`} style={{ background: rgb(MLB[sel.a].color, 0.92) }}>
                hold {pretty(sel.a_name)}
              </span>
              <span className={`rounded-md px-2 py-0.5 text-white shadow transition ${inB ? "" : "opacity-40"}`} style={{ background: rgb(MLB[sel.b].color, 0.92) }}>
                then {pretty(sel.b_name)}
              </span>
            </div>
          </div>
          <div className="mt-2 flex h-2 overflow-hidden rounded">
            <div style={{ width: `${(sel.switch / sel.duration) * 100}%`, background: rgb(MLB[sel.a].color) }} />
            <div style={{ flex: 1, background: rgb(MLB[sel.b].color) }} />
          </div>
          <div className="relative h-0">
            <div className="absolute -top-3 h-4 w-0.5 bg-zinc-900 dark:bg-white" style={{ left: `${(t / sel.duration) * 100}%` }} />
          </div>
          {reachedB != null && (
            <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-300">
              <b>
                {pretty(sel.a_name)} → {pretty(sel.b_name)}
              </b>{" "}
              never occurs in the training corpus. Across 50 start poses the labeler reads the held {baseA.toLowerCase()} in{" "}
              {Math.round((heldA ?? 0) * 100)}% of bodies and the commanded {baseB.toLowerCase()} after the switch in{" "}
              {Math.round(reachedB * 100)}%.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
