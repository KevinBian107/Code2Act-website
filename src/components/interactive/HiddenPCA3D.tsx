import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { asset, pretty, rgb } from "./util";

interface Data {
  explained: number[];
  dt: number;
  codes: { code: number; name: string; color: number[]; lines: number[][][] }[];
}

/**
 * GRU hidden-state trajectories of every held MLB symbol in 3D PCA space.
 * Drag to orbit; the time slider grows every trajectory from its random start
 * pose, so you can watch states converge onto each symbol's attractor.
 */
export default function HiddenPCA3D({ base }: { base: string }) {
  const mount = useRef<HTMLDivElement | null>(null);
  const [data, setData] = useState<Data | null>(null);
  const [visible, setVisible] = useState<boolean[]>(Array(9).fill(true));
  const [frac, setFrac] = useState(1);
  const [animating, setAnimating] = useState(true);
  const lines = useRef<THREE.Line[][]>([]);
  const heads = useRef<THREE.Mesh[][]>([]);

  useEffect(() => {
    fetch(asset(base, "data/hidden3d.json")).then((r) => r.json()).then(setData);
  }, [base]);

  useEffect(() => {
    if (!data || !mount.current) return;
    const el = mount.current;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(40, el.clientWidth / el.clientHeight, 0.01, 100);
    camera.position.set(2.2, 1.6, 2.4);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(el.clientWidth, el.clientHeight);
    el.appendChild(renderer.domElement);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.6;

    const axes = new THREE.Group();
    const axMat = new THREE.LineBasicMaterial({ color: 0xbbbbbb });
    [
      [1.3, 0, 0],
      [0, 1.3, 0],
      [0, 0, 1.3],
    ].forEach((v) => {
      const g = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(...v)]);
      axes.add(new THREE.Line(g, axMat));
    });
    axes.position.set(-1.1, -1.1, -1.1);
    scene.add(axes);

    lines.current = [];
    heads.current = [];
    const sphere = new THREE.SphereGeometry(0.025, 12, 12);
    data.codes.forEach((c) => {
      const color = new THREE.Color(c.color[0], c.color[1], c.color[2]);
      const mat = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.75 });
      const hm = new THREE.MeshBasicMaterial({ color });
      const ls: THREE.Line[] = [];
      const hs: THREE.Mesh[] = [];
      c.lines.forEach((pts) => {
        const g = new THREE.BufferGeometry().setFromPoints(pts.map((p) => new THREE.Vector3(p[0], p[1], p[2])));
        const line = new THREE.Line(g, mat);
        scene.add(line);
        ls.push(line);
        const h = new THREE.Mesh(sphere, hm);
        scene.add(h);
        hs.push(h);
      });
      lines.current.push(ls);
      heads.current.push(hs);
    });

    let raf = 0;
    const loop = () => {
      controls.update();
      renderer.render(scene, camera);
      raf = requestAnimationFrame(loop);
    };
    loop();
    const onResize = () => {
      camera.aspect = el.clientWidth / el.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(el.clientWidth, el.clientHeight);
    };
    window.addEventListener("resize", onResize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      controls.dispose();
      renderer.dispose();
      el.removeChild(renderer.domElement);
    };
  }, [data]);

  // grow trajectories with the time slider
  useEffect(() => {
    if (!data) return;
    data.codes.forEach((c, ci) => {
      c.lines.forEach((pts, li) => {
        const n = Math.max(2, Math.round(frac * pts.length));
        const line = lines.current[ci]?.[li];
        const head = heads.current[ci]?.[li];
        if (!line || !head) return;
        line.geometry.setDrawRange(0, n);
        line.visible = visible[ci];
        head.visible = visible[ci];
        const p = pts[n - 1];
        head.position.set(p[0], p[1], p[2]);
      });
    });
  }, [data, frac, visible]);

  useEffect(() => {
    if (!animating) return;
    let raf = 0;
    let last = performance.now();
    const step = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      setFrac((f) => (f >= 1 ? 0.02 : Math.min(1, f + dt / 12)));
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [animating]);

  const seconds = data ? frac * (data.codes[0].lines[0].length - 1) * data.dt : 0;

  return (
    <div className="not-prose rounded-2xl border border-zinc-200 bg-white p-3 sm:p-5 dark:border-zinc-700 dark:bg-zinc-900">
      <div className="mb-2 flex flex-wrap items-center gap-1.5">
        <span className="mr-1 text-xs tracking-wide text-zinc-400 uppercase">interactive · drag to rotate</span>
        {data?.codes.map((c, i) => (
          <button
            key={c.code}
            onClick={() => setVisible((v) => v.map((x, j) => (j === i ? !x : x)))}
            onDoubleClick={() => setVisible((v) => v.map((_, j) => j === i))}
            className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs ${
              visible[i] ? "border-zinc-300 dark:border-zinc-600" : "border-transparent opacity-40"
            }`}
            title="click to toggle, double-click to solo"
          >
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: rgb(c.color) }} />
            {pretty(c.name)}
          </button>
        ))}
      </div>
      <div ref={mount} className="h-[420px] w-full cursor-grab sm:h-[520px]" />
      <div className="mt-2 flex items-center gap-3 text-sm">
        <button
          onClick={() => setAnimating((a) => !a)}
          className="rounded-md bg-zinc-900 px-3 py-1 text-white dark:bg-zinc-100 dark:text-zinc-900"
        >
          {animating ? "pause" : "play"}
        </button>
        <input
          type="range"
          min={0.02}
          max={1}
          step={0.005}
          value={frac}
          onChange={(e) => {
            setAnimating(false);
            setFrac(parseFloat(e.target.value));
          }}
          className="flex-1 accent-zinc-800"
        />
        <span className="w-24 text-right text-zinc-500 tabular-nums">t = {seconds.toFixed(1)} s</span>
      </div>
      {data && (
        <p className="mt-1 text-xs text-zinc-500">
          Six rollouts per symbol from random start poses; axes are the first three principal components of the GRU state (
          {data.explained.map((e) => `${Math.round(e * 100)}%`).join(", ")} of variance).
        </p>
      )}
    </div>
  );
}
