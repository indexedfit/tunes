import { useEffect, useRef } from "react";
import { usePlayer } from "../player/PlayerContext";

/** Canvas bars visualization with rounded bars, soft glow, and subtle mirror. */
export default function Visualizer({ height = 36 }: { height?: number }) {
  const { analyser } = usePlayer();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const bufferRef = useRef<Uint8Array | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d") || null;
    if (!canvas || !ctx || !analyser) return;

    const dpr = Math.max(1, window.devicePixelRatio || 1);
    function resize() {
      if (!canvas || !ctx) return;
      const rect = canvas.getBoundingClientRect();
      canvas.width = Math.floor(rect.width * dpr);
      canvas.height = Math.floor(rect.height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const analyserBins = analyser.frequencyBinCount;
    bufferRef.current = new Uint8Array(analyserBins);

    const gradient = ctx.createLinearGradient(0, 0, canvas.clientWidth, 0);
    gradient.addColorStop(0.0, "rgba(255,255,255,0.15)");
    gradient.addColorStop(0.5, "rgba(255,255,255,0.95)");
    gradient.addColorStop(1.0, "rgba(255,255,255,0.15)");

    function roundRect(x: number, y: number, w: number, h: number, r: number) {
      if (!ctx) return;
      const rr = Math.min(r, h/2, w/2);
      ctx.beginPath();
      ctx.moveTo(x + rr, y);
      ctx.arcTo(x + w, y, x + w, y + h, rr);
      ctx.arcTo(x + w, y + h, x, y + h, rr);
      ctx.arcTo(x, y + h, x, y, rr);
      ctx.arcTo(x, y, x + w, y, rr);
      ctx.closePath();
    }

    function tick() {
      rafRef.current = requestAnimationFrame(tick);
      if (!bufferRef.current || !ctx || !canvas || !analyser) return;
      analyser.getByteFrequencyData(bufferRef.current);
      const data = bufferRef.current;

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      const bars = 40; // a few more bars
      const step = Math.max(1, Math.floor(data.length / bars));
      const gap = 2;
      const barW = Math.max(2, (width - (bars - 1) * gap) / bars);
      const radius = Math.min(6, barW / 2);

      // Glow
      ctx.save();
      ctx.shadowColor = "rgba(255,255,255,0.6)";
      ctx.shadowBlur = 8;

      for (let i = 0; i < bars; i++) {
        let sum = 0;
        for (let j = 0; j < step; j++) sum += data[i * step + j];
        const v = sum / step / 255;
        const barH = Math.max(2, v * height * 0.75);
        const x = i * (barW + gap);
        const y = height - barH;

        // main bar
        ctx.fillStyle = gradient;
        roundRect(x, y, barW, barH, radius);
        ctx.fill();

        // subtle mirror (fades quickly)
        const mirrorH = barH * 0.35;
        const gy = y + barH + 2;
        const grd = ctx.createLinearGradient(0, gy, 0, gy + mirrorH);
        grd.addColorStop(0, "rgba(255,255,255,0.25)");
        grd.addColorStop(1, "rgba(255,255,255,0.02)");
        ctx.fillStyle = grd;
        roundRect(x, gy, barW, mirrorH, radius);
        ctx.fill();
      }

      ctx.restore();
    }

    tick();
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      ro.disconnect();
    };
  }, [analyser]);

  return <canvas ref={canvasRef} style={{ width: "100%", height }} />;
}
