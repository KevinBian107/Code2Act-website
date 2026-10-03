import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { asset, BEHAVIOR_COLORS, clamp, pretty, rgb } from "./util";

interface Segment {
  name: string;
  code: number;
  start: number;
  end: number;
  color: number[];
}
interface Sequence {
  key: string;
  title: string;
  blurb: string;
  fps: number;
  duration: number;
  src: string;
  poster: string;
  segments: Segment[];
  readout: { behavior: string; start: number; end: number }[];
  agreement: number;
  agreement_median: number;
  n_bodies: number;
  hidden: [number, number][];
  speed: number[];
  height: number[];
}
interface Clouds {
  explained: number[];
  clouds: { code: number; name: string; color: number[]; points: [number, number][] }[];
}

interface Props {
  base: string;
  presets: { key: string; title: string }[];
}

const segAt = (segs: Segment[], t: number) =>
  segs.find((s) => t >= s.start && t < s.end) ?? segs[segs.length - 1];

/** Scrub through chained symbols: video, command vs. readout, hidden state. */
export default function SequenceViewer({ base, presets }: Props) {
  const [key, setKey] = useState(presets[0]?.key);
  const [seq, setSeq] = useState<Sequence | null>(null);
  const [clouds, setClouds] = useState<Clouds | null>(null);
  const [t, setT] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [rate, setRate] = useState(1);
  const video = useRef<HTMLVideoElement | null>(null);
  const timeline = useRef<SVGSVGElement | null>(null);
  const dragging = useRef(false);

  useEffect(() => {
    fetch(asset(base, "data/sequence_clouds.json")).then((r) => r.json()).then(setClouds);
  }, [base]);
  useEffect(() => {
    if (!key) return;
    setSeq(null);
    fetch(asset(base, `data/sequence_${key}.json`)).then((r) => r.json()).then(setSeq);
  }, [base, key]);

  useEffect(() => {
    let raf = 0;
    const loop = () => {
      const v = video.current;
      if (v) setT(v.currentTime);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    const v = video.current;
    if (!v) return;
    v.playbackRate = rate;
    if (playing) v.play().catch(() => {});
    else v.pause();
  }, [playing, rate, seq]);

  const seek = useCallback(
    (clientX: number) => {
      const svg = timeline.current;
      const v = video.current;
      if (!svg || !v || !seq) return;
      const r = svg.getBoundingClientRect();
      const f = clamp((clientX - r.left - PAD) / (r.width - PAD - 8), 0, 1);
      v.currentTime = f * seq.duration;
      setT(v.currentTime);
    },
    [seq],
  );

  // data-space bounds of the hidden-state panel
  const bounds = useMemo(() => {
    if (!clouds) return null;
    const pts = clouds.clouds.flatMap((c) => c.points);
    if (seq) pts.push(...seq.hidden);
    const xs = pts.map((p) => p[0]);
    const ys = pts.map((p) => p[1]);
    const pad = 0.05;
    const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
    return { x0: x0 - pad * (x1 - x0), x1: x1 + pad * (x1 - x0), y0: y0 - pad * (y1 - y0), y1: y1 + pad * (y1 - y0) };
  }, [clouds, seq]);

  const W = 300;
  const H = 300;
  const px = (p: [number, number]) =>
    bounds
      ? [((p[0] - bounds.x0) / (bounds.x1 - bounds.x0)) * W, H - ((p[1] - bounds.y0) / (bounds.y1 - bounds.y0)) * H]
      : [0, 0];

  const idx = seq ? clamp(Math.floor(t * seq.fps), 0, seq.hidden.length - 1) : 0;
  const cur = seq ? segAt(seq.segments, t) : null;
  const curRead = seq?.readout.find((r) => t >= r.start && t < r.end);

  // trajectory split into same-symbol runs so each run gets its symbol's color
  const trail = useMemo(() => {
    if (!seq || !bounds) return [];
    const runs: { color: string; d: string }[] = [];
    const lo = Math.max(0, idx - 400);
    let curSeg: Segment | null = null;
    let d = "";
    for (let i = lo; i <= idx; i++) {
      const s = segAt(seq.segments, i / seq.fps);
      const [x, y] = px(seq.hidden[i]);
      if (s !== curSeg) {
        if (curSeg && d) runs.push({ color: rgb(curSeg.color), d });
        curSeg = s;
        d = i > lo ? `M${px(seq.hidden[i - 1]).join(",")} L${x},${y}` : `M${x},${y}`;
      } else d += ` L${x},${y}`;
    }
    if (curSeg && d) runs.push({ color: rgb(curSeg.color), d });
    return runs;
  }, [seq, bounds, idx]);

  const spark = (vals: number[], w: number, h: number) => {
    const max = Math.max(...vals);
    const min = Math.min(...vals);
    return vals
      .map((v, i) => `${i === 0 ? "M" : "L"}${(i / (vals.length - 1)) * w},${h - ((v - min) / (max - min || 1)) * h}`)
      .join(" ");
  };

  return (
    <div className="not-prose rounded-2xl border border-zinc-200 bg-white p-3 sm:p-5 dark:border-zinc-700 dark:bg-zinc-900">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="mr-1 text-xs tracking-wide text-zinc-400 uppercase">interactive</span>
        {presets.map((p) => (
          <button
            key={p.key}
            onClick={() => setKey(p.key)}
            className={`rounded-full px-3 py-1 text-sm transition ${
              p.key === key
                ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300"
            }`}
          >
            {p.title}
          </button>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div>
          <div className="relative overflow-hidden rounded-lg bg-zinc-900">
            {seq && (
              <video
                key={seq.key}
                ref={video}
                src={asset(base, seq.src)}
                poster={asset(base, seq.poster)}
                className="block aspect-video w-full"
                muted
                playsInline
                loop
                autoPlay
              />
            )}
            {!seq && <div className="aspect-video w-full" />}
            {cur && (
              <div className="absolute top-2 left-2 flex flex-col gap-1">
                <span className="rounded-md px-2 py-1 text-sm font-semibold text-white shadow" style={{ background: rgb(cur.color, 0.92) }}>
                  command: {pretty(cur.name)}
                </span>
                {curRead && (
                  <span className="rounded-md bg-black/55 px-2 py-0.5 text-xs text-white">
                    labeler reads: {curRead.behavior}
                  </span>
                )}
              </div>
            )}
          </div>

          {seq && (
            <svg
              ref={timeline}
              viewBox="0 0 800 92"
              className="mt-2 w-full cursor-pointer touch-none select-none"
              onPointerDown={(e) => {
                dragging.current = true;
                (e.target as Element).setPointerCapture?.(e.pointerId);
                seek(e.clientX);
              }}
              onPointerMove={(e) => dragging.current && seek(e.clientX)}
              onPointerUp={() => (dragging.current = false)}
            >
              {[
                { y: 6, label: "command", rows: seq.segments.map((s) => ({ ...s, fill: rgb(s.color) })) },
                {
                  y: 40,
                  label: "readout",
                  rows: seq.readout.map((r) => ({ ...r, name: r.behavior, fill: BEHAVIOR_COLORS[r.behavior] ?? "#bbb" })),
                },
              ].map((lane) => (
                <g key={lane.label}>
                  <text x={0} y={lane.y + 18} fontSize={12} fill="#71717a">
                    {lane.label}
                  </text>
                  {lane.rows.map((s, i) => {
                    const x = PAD + (s.start / seq.duration) * (800 - PAD - 8);
                    const w = ((s.end - s.start) / seq.duration) * (800 - PAD - 8);
                    return (
                      <g key={i}>
                        <rect x={x} y={lane.y} width={Math.max(1, w - 1)} height={26} rx={3} fill={s.fill} />
                        {w > 46 && (
                          <text x={x + 5} y={lane.y + 17} fontSize={11} fill="white" fontWeight={600}>
                            {pretty(s.name)}
                          </text>
                        )}
                      </g>
                    );
                  })}
                </g>
              ))}
              <line
                x1={PAD + (t / seq.duration) * (800 - PAD - 8)}
                x2={PAD + (t / seq.duration) * (800 - PAD - 8)}
                y1={0}
                y2={72}
                stroke="#18181b"
                strokeWidth={2}
              />
              <text x={PAD} y={88} fontSize={11} fill="#a1a1aa">
                0 s
              </text>
              <text x={792} y={88} fontSize={11} fill="#a1a1aa" textAnchor="end">
                {seq.duration.toFixed(1)} s
              </text>
            </svg>
          )}

          <div className="mt-1 flex flex-wrap items-center gap-2 text-sm">
            <button onClick={() => setPlaying((p) => !p)} className="rounded-md bg-zinc-900 px-3 py-1 text-white dark:bg-zinc-100 dark:text-zinc-900">
              {playing ? "pause" : "play"}
            </button>
            {[0.5, 1].map((r) => (
              <button
                key={r}
                onClick={() => setRate(r)}
                className={`rounded-md px-2 py-1 ${r === rate ? "bg-zinc-200 dark:bg-zinc-700" : "text-zinc-500"}`}
              >
                {r}×
              </button>
            ))}
            <span className="ml-auto text-zinc-500">{t.toFixed(1)} s · drag the timeline to scrub</span>
          </div>
          {seq && (
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
              {seq.blurb}{" "}
              <span className="text-zinc-400">
                Shown: the best of {seq.n_bodies} start poses, with {Math.round(seq.agreement * 100)}% of phases read back as
                commanded (median over bodies {Math.round(seq.agreement_median * 100)}%).
              </span>
            </p>
          )}
        </div>

        <div className="flex flex-col gap-3">
          <div>
            <div className="mb-1 text-xs tracking-wide text-zinc-400 uppercase">controller hidden state</div>
            <svg viewBox={`0 0 ${W} ${H}`} className="w-full rounded-lg bg-zinc-50 dark:bg-zinc-800">
              {clouds &&
                bounds &&
                clouds.clouds.map((c) =>
                  c.points.map((p, i) => {
                    const [x, y] = px(p);
                    return <circle key={`${c.code}-${i}`} cx={x} cy={y} r={1.6} fill={rgb(c.color, 0.22)} />;
                  }),
                )}
              {trail.map((r, i) => (
                <path key={i} d={r.d} fill="none" stroke={r.color} strokeWidth={2.2} strokeLinejoin="round" opacity={0.95} />
              ))}
              {seq && bounds && cur && (
                <circle cx={px(seq.hidden[idx])[0]} cy={px(seq.hidden[idx])[1]} r={6} fill={rgb(cur.color)} stroke="white" strokeWidth={2} />
              )}
              <text x={6} y={H - 6} fontSize={10} fill="#a1a1aa">
                PC1{clouds ? ` (${Math.round(clouds.explained[0] * 100)}%)` : ""} →
              </text>
            </svg>
            <p className="mt-1 text-xs leading-snug text-zinc-500">
              Faint clouds: GRU states while each symbol is held. The bright trace is this rollout, colored by the commanded symbol.
            </p>
          </div>
          {seq && (
            <div className="grid grid-cols-1 gap-2">
              {[
                { label: "root speed", vals: seq.speed, unit: "m/s" },
                { label: "root height", vals: seq.height, unit: "m" },
              ].map((s) => (
                <div key={s.label}>
                  <div className="flex justify-between text-xs text-zinc-400">
                    <span>{s.label}</span>
                    <span>
                      {s.vals[idx]?.toFixed(s.unit === "m" ? 3 : 2)} {s.unit}
                    </span>
                  </div>
                  <svg viewBox="0 0 300 40" className="w-full">
                    <path d={spark(s.vals, 300, 38)} fill="none" stroke="#a1a1aa" strokeWidth={1.2} />
                    <line x1={(idx / (s.vals.length - 1)) * 300} x2={(idx / (s.vals.length - 1)) * 300} y1={0} y2={40} stroke="#18181b" strokeWidth={1.5} />
                  </svg>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const PAD = 64;
