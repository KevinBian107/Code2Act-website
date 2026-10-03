import { useEffect, useRef } from "react";

interface Props {
  src: string;
  poster?: string;
  className?: string;
  /** Restart from 0 whenever src changes. */
  restartKey?: string | number;
  onTime?: (t: number, duration: number) => void;
  videoRef?: React.MutableRefObject<HTMLVideoElement | null>;
  loop?: boolean;
}

/**
 * Muted, inline, looping video that only plays while on screen, so a page
 * with dozens of clips stays light.
 */
export default function LoopVideo({
  src,
  poster,
  className,
  restartKey,
  onTime,
  videoRef,
  loop = true,
}: Props) {
  const ref = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    if (videoRef) videoRef.current = v;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) v.play().catch(() => {});
        else v.pause();
      },
      { threshold: 0.15 },
    );
    io.observe(v);
    return () => io.disconnect();
  }, [videoRef]);

  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    v.currentTime = 0;
    v.play().catch(() => {});
  }, [src, restartKey]);

  useEffect(() => {
    const v = ref.current;
    if (!v || !onTime) return;
    let raf = 0;
    const tick = () => {
      onTime(v.currentTime, v.duration || 0);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [onTime]);

  return (
    <video
      ref={ref}
      src={src}
      poster={poster}
      className={className}
      muted
      playsInline
      loop={loop}
      preload="metadata"
    />
  );
}
