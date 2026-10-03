import { useState } from "react";
import LoopVideo from "./LoopVideo";
import { asset, pretty, rgb } from "./util";

interface Item {
  code: number;
  name: string;
  readout: string;
  behavior: string;
  color: number[];
  usage: number | null;
  src: string;
  poster: string;
}

interface Props {
  data: Record<string, Item[]>;
  base: string;
}

const TABS = [
  { key: "mlb", label: "MLB", sub: "9 hand-written symbols" },
  { key: "kpms", label: "Keypoint-MoSeq", sub: "15 most-used of 100 syllables" },
  { key: "kvae", label: "Kinematics VAE", sub: "15 most-used of 25 codes" },
];
const ORDER = ["Walk", "Turn", "Rear", "Immobile"];

/** Every code of a vocabulary, held constant on one body (Fig. 2c, 11, 12). */
export default function AtlasGallery({ data, base }: Props) {
  const [tab, setTab] = useState("mlb");
  const [open, setOpen] = useState<Item | null>(null);
  let items = data[tab] ?? [];
  if (tab !== "mlb") {
    items = [...items].sort(
      (a, b) => ORDER.indexOf(a.behavior) - ORDER.indexOf(b.behavior) || (b.usage ?? 0) - (a.usage ?? 0),
    );
  }
  const cols = tab === "mlb" ? "sm:grid-cols-3" : "sm:grid-cols-3 lg:grid-cols-5";

  return (
    <div className="not-prose">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="mr-1 text-xs tracking-wide text-zinc-400 uppercase">vocabulary</span>
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`rounded-full px-3 py-1 text-sm transition ${
              t.key === tab
                ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300"
            }`}
          >
            {t.label} <span className="opacity-60">· {t.sub}</span>
          </button>
        ))}
      </div>

      <div className={`grid grid-cols-2 gap-2 ${cols}`}>
        {items.map((it) => (
          <button
            key={`${tab}-${it.code}`}
            onClick={() => setOpen(it)}
            className="group relative overflow-hidden rounded-lg bg-zinc-900 text-left"
          >
            <LoopVideo src={asset(base, it.src)} poster={asset(base, it.poster)} className="block aspect-[3/2] w-full object-cover" />
            <div className="absolute inset-x-0 top-0 flex items-center gap-1.5 bg-gradient-to-b from-black/60 to-transparent px-2 py-1.5">
              <span className="h-2.5 w-2.5 rounded-sm" style={{ background: rgb(it.color) }} />
              <span className="text-xs font-semibold text-white sm:text-sm">{tab === "mlb" ? pretty(it.name) : it.name}</span>
              {tab !== "mlb" && <span className="text-[11px] text-white/70">{pretty(it.readout)}</span>}
            </div>
            {tab === "mlb" && it.readout.split("_")[0] !== it.name.split("_")[0] && (
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent px-2 py-1 text-[11px] text-white/85">
                labeler reads: {pretty(it.readout)}
              </div>
            )}
          </button>
        ))}
      </div>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={() => setOpen(null)}>
          <div className="w-full max-w-5xl" onClick={(e) => e.stopPropagation()}>
            <LoopVideo src={asset(base, open.src)} poster={asset(base, open.poster)} className="w-full rounded-lg" />
            <div className="mt-2 flex items-center justify-between text-sm text-white">
              <span>
                <span className="mr-2 inline-block h-3 w-3 rounded-sm align-middle" style={{ background: rgb(open.color) }} />
                {tab === "mlb" ? pretty(open.name) : `${open.name} · reads as ${pretty(open.readout)}`}
                {open.usage != null && tab !== "mlb" && <span className="ml-2 opacity-60">{open.usage.toLocaleString()} corpus frames</span>}
              </span>
              <button className="rounded bg-white/15 px-3 py-1 hover:bg-white/25" onClick={() => setOpen(null)}>
                close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
