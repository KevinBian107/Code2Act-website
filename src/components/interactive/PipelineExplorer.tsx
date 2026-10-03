import { useEffect, useMemo, useState } from "react";
import { MLB, rgb } from "./util";

/**
 * Animated, tabbed walkthrough of the Code2Act pipeline (paper Fig. 1).
 * Each tab lights up the modules and data paths that are active in one stage
 * and animates the data flowing along them.
 */

type NodeId =
  | "ref"
  | "goal"
  | "steer"
  | "codes"
  | "gru"
  | "head"
  | "enc"
  | "z"
  | "dec"
  | "sim"
  | "reward";

type EdgeId =
  | "ref-goal"
  | "ref-steer"
  | "steer-codes"
  | "codes-gru"
  | "gru-head"
  | "goal-enc"
  | "enc-z"
  | "kl"
  | "head-z"
  | "z-dec"
  | "dec-sim"
  | "sim-prop"
  | "prop-gru"
  | "prop-dec"
  | "sim-reward";

interface Stage {
  key: string;
  tab: string;
  title: string;
  body: string[];
  nodes: NodeId[];
  edges: EdgeId[];
  frozen?: NodeId[];
  removed?: NodeId[];
}

const STAGES: Stage[] = [
  {
    key: "overview",
    tab: "Overview",
    title: "One controller, any vocabulary",
    body: [
      "A steering strategy turns the reference motion into a stream of discrete symbols. A recurrent controller reads only that stream and the body's proprioception, predicts the motor intention a pretrained imitation model would have produced, and decodes it to torques through that model's inverse-dynamics decoder.",
      "The goal trajectory only reaches a frozen encoder that supplies a KL target during training. It never enters the action path.",
    ],
    nodes: ["ref", "goal", "steer", "codes", "gru", "head", "enc", "z", "dec", "sim", "reward"],
    edges: [
      "ref-goal", "ref-steer", "steer-codes", "codes-gru", "gru-head", "goal-enc", "kl",
      "head-z", "z-dec", "dec-sim", "sim-prop", "prop-gru", "prop-dec", "sim-reward",
    ],
    frozen: ["enc"],
  },
  {
    key: "stage1",
    tab: "1 · Imitation VAE",
    title: "Stage 1: a pretrained motor representation",
    body: [
      "MIMIC-MJX trains an encoder–decoder policy to track motion capture on a 38-actuator biomechanical rat. The encoder maps a 5-frame reference horizon (640-d) and proprioception (277-d) to a 16-d Gaussian intention; the decoder maps the sampled intention and proprioception to torques.",
      "Because the intention encodes the change needed to reach the next pose from the current state, the decoder is an inverse-dynamics module: a command only has to say what to do, not how.",
    ],
    nodes: ["ref", "goal", "enc", "z", "dec", "sim", "reward"],
    edges: ["ref-goal", "goal-enc", "enc-z", "z-dec", "dec-sim", "sim-prop", "prop-dec", "sim-reward"],
  },
  {
    key: "stage2",
    tab: "2 · Steering strategy",
    title: "Stage 2: a discrete vocabulary, fixed in advance",
    body: [
      "A steering strategy assigns every reference frame one of K symbols. It is fit or written in a separate process and frozen: no gradient reaches it, and the controller only ever sees the integer stream.",
      "We use three: unsupervised Keypoint-MoSeq syllables (K = 100), a kinematics-VAE codebook clustered with K-means (K = 25), and a hand-written set of manually labeled behaviors (K = 9). At each step the controller embeds the next five symbols.",
    ],
    nodes: ["ref", "steer", "codes"],
    edges: ["ref-steer", "steer-codes"],
  },
  {
    key: "stage3",
    tab: "3 · Distillation",
    title: "Stage 3: learning to act from symbols",
    body: [
      "A four-layer GRU reads the symbol context and proprioception. A head maps its state to a Gaussian over the intention, which is regressed onto the frozen encoder's distribution by a per-step KL, sampled, and decoded to torques by the Stage-1 decoder.",
      "Training is PPO on the MIMIC-MJX motion-tracking reward plus the distillation KL, on the student's own rollouts. One run covers every symbol in the vocabulary.",
    ],
    nodes: ["ref", "goal", "codes", "gru", "head", "enc", "z", "dec", "sim", "reward"],
    edges: ["ref-goal", "codes-gru", "gru-head", "goal-enc", "kl", "head-z", "z-dec", "dec-sim", "sim-prop", "prop-gru", "prop-dec", "sim-reward"],
    frozen: ["enc"],
  },
  {
    key: "deploy",
    tab: "Execution",
    title: "Execution: symbols in, behavior out",
    body: [
      "At test time the reference and the encoder are gone. The controller receives about log₂K bits per step where the imitation policy had a 640-d goal, and the body still produces the commanded behavior.",
      "Every experiment below runs in this decoder-only mode: hold a symbol, chain symbols, or kick the body, and watch what the symbol stream alone produces.",
    ],
    nodes: ["codes", "gru", "head", "z", "dec", "sim"],
    edges: ["codes-gru", "gru-head", "head-z", "z-dec", "dec-sim", "sim-prop", "prop-gru", "prop-dec"],
    removed: ["ref", "goal", "enc"],
  },
];

const BOX: Record<NodeId, { x: number; y: number; w: number; h: number; t: string; sub?: string; s?: string }> = {
  ref: { x: 20, y: 40, w: 150, h: 64, t: "Reference motion", s: "motion capture" },
  goal: { x: 215, y: 40, w: 150, h: 64, t: "Goal  sᵍ", s: "5-frame horizon · 640-d" },
  steer: { x: 20, y: 200, w: 150, h: 70, t: "Steering strategy", s: "KPMS · KVAE · MLB" },
  codes: { x: 215, y: 200, w: 150, h: 70, t: "", s: "symbols cₜ … cₜ₊₄" },
  gru: { x: 410, y: 200, w: 120, h: 70, t: "GRU stack", s: "hₜ" },
  head: { x: 575, y: 200, w: 120, h: 70, t: "Distill head g", s: "μᵈ, σᵈ" },
  enc: { x: 575, y: 40, w: 120, h: 64, t: "Encoder q", sub: "φ", s: "μᵉ, σᵉ" },
  z: { x: 728, y: 214, w: 44, h: 44, t: "z", s: "" },
  dec: { x: 805, y: 200, w: 175, h: 70, t: "Inverse dynamics p", sub: "θ", s: "[z, sᵖ] → aₜ" },
  sim: { x: 805, y: 345, w: 175, h: 70, t: "MuJoCo MJX rat", s: "38 actuators · 100 Hz" },
  reward: { x: 805, y: 40, w: 175, h: 64, t: "Tracking reward", s: "PPO" },
};

const c = (n: NodeId) => ({ x: BOX[n].x + BOX[n].w / 2, y: BOX[n].y + BOX[n].h / 2 });
const R = (n: NodeId) => BOX[n].x + BOX[n].w;
const L = (n: NodeId) => BOX[n].x;
const T = (n: NodeId) => BOX[n].y;
const B = (n: NodeId) => BOX[n].y + BOX[n].h;

const EDGES: Record<EdgeId, { d: string; label?: string; lx?: number; ly?: number }> = {
  "ref-goal": { d: `M${R("ref")},${c("ref").y} L${L("goal")},${c("goal").y}` },
  "ref-steer": { d: `M${c("ref").x},${B("ref")} L${c("steer").x},${T("steer")}` },
  "steer-codes": { d: `M${R("steer")},${c("steer").y} L${L("codes")},${c("codes").y}` },
  "codes-gru": { d: `M${R("codes")},${c("codes").y} L${L("gru")},${c("gru").y}` },
  "gru-head": { d: `M${R("gru")},${c("gru").y} L${L("head")},${c("head").y}` },
  "goal-enc": { d: `M${R("goal")},${c("goal").y} L${L("enc")},${c("enc").y}` },
  "enc-z": { d: `M${R("enc")},${c("enc").y} C${R("enc") + 40},${c("enc").y} ${c("z").x},${T("z") - 60} ${c("z").x},${T("z")}` },
  kl: { d: `M${c("enc").x},${B("enc")} L${c("head").x},${T("head")}`, label: "KL", lx: c("enc").x + 10, ly: (B("enc") + T("head")) / 2 + 5 },
  "head-z": { d: `M${R("head")},${c("head").y} L${L("z")},${c("z").y}` },
  "z-dec": { d: `M${R("z")},${c("z").y} L${L("dec")},${c("dec").y}` },
  "dec-sim": { d: `M${c("dec").x},${B("dec")} L${c("sim").x},${T("sim")}`, label: "aₜ", lx: c("dec").x + 8, ly: (B("dec") + T("sim")) / 2 + 5 },
  "sim-prop": { d: `M${L("sim")},${c("sim").y} L${c("gru").x},${c("sim").y}`, label: "proprioception sᵖ (277-d)", lx: 470, ly: c("sim").y - 8 },
  "prop-gru": { d: `M${c("gru").x},${c("sim").y} L${c("gru").x},${B("gru")}` },
  "prop-dec": { d: `M${L("sim") - 40},${c("sim").y} C${L("sim") - 40},${c("sim").y - 40} ${L("dec") + 20},${B("dec") + 30} ${L("dec") + 20},${B("dec")}` },
  "sim-reward": { d: `M${R("sim") - 15},${T("sim")} C${R("sim") + 15},${T("sim") - 60} ${R("reward") + 15},${B("reward") + 60} ${R("reward") - 15},${B("reward")}` },
};

type Vocab = "mlb" | "kpms" | "kvae";

// Bout sequences (runs collapsed) of real reference clips under each strategy's
// paper tokenizer (best_codes.npz).
const KPMS_SEQ = [1, 66, 1, 90, 45, 18, 1, 49, 50, 21, 1, 6, 1, 0, 42, 6];
const KVAE_SEQ = [8, 3, 20, 16, 1, 24, 1, 24, 18, 1, 18, 1, 18, 22, 24, 1];
const MLB_SEQ = [6, 8, 6, 8, 6, 0, 6, 8, 6, 8];

function tickerSymbols(v: Vocab, offset: number) {
  const seq = v === "mlb" ? MLB_SEQ : v === "kpms" ? KPMS_SEQ : KVAE_SEQ;
  return Array.from({ length: 5 }, (_, i) => {
    const s = seq[(offset + i) % seq.length];
    if (v === "mlb") return { label: MLB[s].name.replace("_", " "), color: rgb(MLB[s].color) };
    const hue = (s * 47) % 360;
    return { label: String(s), color: `hsl(${hue} 45% 52%)` };
  });
}

export default function PipelineExplorer() {
  const [k, setK] = useState(0);
  const [vocab, setVocab] = useState<Vocab>("mlb");
  const [tick, setTick] = useState(0);
  const stage = STAGES[k];

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 700);
    return () => clearInterval(id);
  }, []);

  const on = useMemo(() => new Set<string>([...stage.nodes, ...stage.edges]), [stage]);
  const symbols = tickerSymbols(vocab, tick);
  const codesActive = on.has("codes");

  return (
    <div className="not-prose rounded-2xl border border-zinc-200 bg-white p-3 sm:p-5 dark:border-zinc-700 dark:bg-zinc-900">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="mr-1 text-xs tracking-wide text-zinc-400 uppercase">interactive</span>
        {STAGES.map((s, i) => (
          <button
            key={s.key}
            onClick={() => setK(i)}
            className={`rounded-full px-3 py-1 text-sm transition ${
              i === k
                ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300"
            }`}
          >
            {s.tab}
          </button>
        ))}
      </div>

      <svg viewBox="0 0 1000 440" className="w-full select-none" role="img" aria-label={stage.title}>
        <defs>
          <marker id="pe-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M0,0 L10,5 L0,10 z" fill="currentColor" />
          </marker>
        </defs>
        <style>{`
          .pe-edge { fill: none; stroke-width: 2.2; transition: stroke .35s, opacity .35s; }
          .pe-flow { stroke-dasharray: 7 7; animation: pe-dash 0.9s linear infinite; }
          .pe-kl { stroke-dasharray: 3 5; animation: pe-dash 0.9s linear infinite reverse; }
          @keyframes pe-dash { to { stroke-dashoffset: -14; } }
          .pe-box { transition: opacity .35s, stroke .35s, fill .35s; }
          @keyframes pe-pulse { 0%,100% { opacity: .55 } 50% { opacity: 1 } }
        `}</style>

        {(Object.keys(EDGES) as EdgeId[]).map((id) => {
          const e = EDGES[id];
          const active = on.has(id);
          const color = id === "kl" ? "#c0392b" : active ? "#3f3f46" : "#d4d4d8";
          return (
            <g key={id} style={{ color }} opacity={active ? 1 : 0.35}>
              <path
                d={e.d}
                className={`pe-edge ${active ? (id === "kl" ? "pe-kl" : "pe-flow") : ""}`}
                stroke={color}
                markerEnd={id === "kl" || id === "sim-prop" ? undefined : "url(#pe-arrow)"}
              />
              {e.label && (
                <text x={e.lx} y={e.ly} fontSize={id === "kl" ? 15 : 13} fill={color} fontWeight={id === "kl" ? 700 : 400}>
                  {e.label}
                </text>
              )}
            </g>
          );
        })}

        {(Object.keys(BOX) as NodeId[]).map((id) => {
          const b = BOX[id];
          const active = on.has(id);
          const removed = stage.removed?.includes(id);
          const frozen = stage.frozen?.includes(id);
          const accent = id === "enc" ? "#7c5cbf" : id === "dec" ? "#7c5cbf" : id === "sim" ? "#52525b" : "#2f6db5";
          if (id === "z") {
            return (
              <g key={id} className="pe-box" opacity={active ? 1 : 0.3}>
                <circle cx={b.x + b.w / 2} cy={b.y + b.h / 2} r={22} fill={active ? "#eef4fb" : "#fafafa"} stroke={active ? accent : "#d4d4d8"} strokeWidth={2} />
                <text x={b.x + b.w / 2} y={b.y + b.h / 2 + 6} textAnchor="middle" fontSize={18} fontStyle="italic" fill="#27272a">z</text>
              </g>
            );
          }
          return (
            <g key={id} className="pe-box" opacity={removed ? 0.22 : active ? 1 : 0.32}>
              <rect
                x={b.x}
                y={b.y}
                width={b.w}
                height={b.h}
                rx={12}
                fill={active ? (id === "enc" || id === "dec" ? "#f3effb" : "#eef4fb") : "#fafafa"}
                stroke={active ? accent : "#d4d4d8"}
                strokeWidth={active ? 2 : 1.2}
              />
              {id !== "codes" && (
                <text x={b.x + b.w / 2} y={b.y + (b.s ? 28 : b.h / 2 + 5)} textAnchor="middle" fontSize={15} fontWeight={600} fill="#18181b">
                  {b.t}
                  {b.sub && (
                    <tspan fontSize={11} dy={4} fontStyle="italic">
                      {b.sub}
                    </tspan>
                  )}
                </text>
              )}
              {b.s && (
                <text x={b.x + b.w / 2} y={b.y + b.h - (id === "codes" ? 9 : 16)} textAnchor="middle" fontSize={12} fill="#52525b">
                  {b.s}
                </text>
              )}
              {frozen && (
                <text x={b.x + 12} y={b.y + 17} textAnchor="middle" fontSize={13} fill="#5b8def">
                  ❄
                </text>
              )}
              {removed && (
                <line x1={b.x + 8} y1={b.y + b.h - 8} x2={b.x + b.w - 8} y2={b.y + 8} stroke="#a1a1aa" strokeWidth={2} />
              )}
            </g>
          );
        })}

        {/* symbol ticker inside the codes box */}
        <g opacity={codesActive ? 1 : 0.3}>
          {symbols.map((s, i) => {
            const w = 26;
            const x = BOX.codes.x + 10 + i * 27;
            return (
              <g key={i}>
                <rect x={x} y={BOX.codes.y + 10} width={w} height={34} rx={5} fill={s.color} opacity={i === 0 ? 1 : 0.8 - i * 0.1}>
                  {i === 0 && codesActive && <animate attributeName="opacity" values="0.6;1;0.6" dur="0.7s" repeatCount="indefinite" />}
                </rect>
                {vocab !== "mlb" && (
                  <text x={x + w / 2} y={BOX.codes.y + 32} textAnchor="middle" fontSize={11} fill="white" fontWeight={600}>
                    {s.label}
                  </text>
                )}
              </g>
            );
          })}
        </g>

        {/* frozen/removed annotations */}
        {stage.key === "stage3" && (
          <text x={c("enc").x} y={T("enc") - 10} textAnchor="middle" fontSize={12} fill="#7c5cbf">
            frozen, stop-gradient target
          </text>
        )}
        {(stage.key === "stage3" || stage.key === "overview") && (
          <text x={c("dec").x} y={T("dec") - 10} textAnchor="middle" fontSize={12} fill="#7c5cbf">
            initialized from Stage 1
          </text>
        )}
        {stage.key === "deploy" && (
          <text x={300} y={140} textAnchor="middle" fontSize={13} fill="#a1a1aa">
            no reference, no goal, no encoder
          </text>
        )}
      </svg>

      <div className="mt-2 grid gap-4 sm:grid-cols-[1fr_auto]">
        <div>
          <div className="text-base font-semibold text-zinc-900 dark:text-zinc-100">{stage.title}</div>
          {stage.body.map((p, i) => (
            <p key={i} className="mt-1.5 text-sm leading-relaxed text-zinc-600 dark:text-zinc-300">
              {p}
            </p>
          ))}
        </div>
        <div className="flex flex-col gap-1.5 sm:w-52">
          <span className="text-xs tracking-wide text-zinc-400 uppercase">symbol stream</span>
          {(["mlb", "kpms", "kvae"] as Vocab[]).map((v) => (
            <button
              key={v}
              onClick={() => setVocab(v)}
              className={`rounded-lg border px-3 py-1.5 text-left text-sm ${
                v === vocab
                  ? "border-zinc-800 bg-zinc-50 dark:border-zinc-200 dark:bg-zinc-800"
                  : "border-zinc-200 text-zinc-500 hover:border-zinc-400 dark:border-zinc-700"
              }`}
            >
              {v === "mlb" ? "MLB · 9 named behaviors" : v === "kpms" ? "KPMS · 100 syllables" : "KVAE · 25 codes"}
            </button>
          ))}
          {vocab === "mlb" && (
            <span className="text-xs text-zinc-500">now: {symbols[0].label}</span>
          )}
        </div>
      </div>
    </div>
  );
}
