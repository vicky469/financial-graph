import { useEffect, useRef } from "react";

interface Star {
  x: number;
  y: number;
  size: number;
  opacity: number;
  twinkleSpeed: number;
  twinklePhase: number;
}

export function NetworkBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const starsRef = useRef<Star[]>([]);
  const animationRef = useRef<number>(0);
  const timeRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    const STAR_COUNT = 60;
    const CONNECTION_DISTANCE = 120;

    const handleResize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      initStars();
    };

    const initStars = () => {
      const stars: Star[] = [];
      const width = window.innerWidth;
      const height = window.innerHeight;

      for (let i = 0; i < STAR_COUNT; i++) {
        stars.push({
          x: Math.random() * width,
          y: Math.random() * height,
          size: Math.random() * 1.2 + 0.3,
          opacity: Math.random() * 0.4 + 0.1,
          twinkleSpeed: Math.random() * 0.008 + 0.003,
          twinklePhase: Math.random() * Math.PI * 2,
        });
      }
      starsRef.current = stars;
    };

    const animate = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      const stars = starsRef.current;

      timeRef.current += 0.016;

      ctx.clearRect(0, 0, width, height);

      // Gradient flow background
      const gradient = ctx.createRadialGradient(
        width * 0.3 + Math.sin(timeRef.current * 0.1) * 100,
        height * 0.4 + Math.cos(timeRef.current * 0.08) * 80,
        0,
        width * 0.5,
        height * 0.5,
        Math.max(width, height) * 0.8
      );
      gradient.addColorStop(0, "rgba(60, 80, 120, 0.04)");
      gradient.addColorStop(0.5, "rgba(40, 60, 90, 0.02)");
      gradient.addColorStop(1, "transparent");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);

      // Second gradient for depth
      const gradient2 = ctx.createRadialGradient(
        width * 0.7 + Math.cos(timeRef.current * 0.07) * 120,
        height * 0.6 + Math.sin(timeRef.current * 0.09) * 100,
        0,
        width * 0.5,
        height * 0.5,
        Math.max(width, height) * 0.6
      );
      gradient2.addColorStop(0, "rgba(80, 60, 100, 0.03)");
      gradient2.addColorStop(0.6, "rgba(50, 40, 70, 0.015)");
      gradient2.addColorStop(1, "transparent");
      ctx.fillStyle = gradient2;
      ctx.fillRect(0, 0, width, height);

      // Draw very faint connections
      ctx.strokeStyle = "rgba(100, 120, 160, 0.04)";
      ctx.lineWidth = 0.5;

      for (let i = 0; i < stars.length; i++) {
        for (let j = i + 1; j < stars.length; j++) {
          const dx = stars[i].x - stars[j].x;
          const dy = stars[i].y - stars[j].y;
          const distSq = dx * dx + dy * dy;

          if (distSq < CONNECTION_DISTANCE * CONNECTION_DISTANCE) {
            const dist = Math.sqrt(distSq);
            const opacity = (1 - dist / CONNECTION_DISTANCE) * 0.06;
            ctx.strokeStyle = `rgba(120, 140, 180, ${opacity})`;
            ctx.beginPath();
            ctx.moveTo(stars[i].x, stars[i].y);
            ctx.lineTo(stars[j].x, stars[j].y);
            ctx.stroke();
          }
        }
      }

      // Draw stars with twinkle
      stars.forEach((star) => {
        star.twinklePhase += star.twinkleSpeed;
        const twinkle = Math.sin(star.twinklePhase) * 0.3 + 0.7;
        const opacity = star.opacity * twinkle;
        const size = star.size * (0.8 + twinkle * 0.2);

        ctx.beginPath();
        ctx.arc(star.x, star.y, size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(180, 190, 220, ${opacity})`;
        ctx.fill();
      });

      animationRef.current = requestAnimationFrame(animate);
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    animate();

    return () => {
      window.removeEventListener("resize", handleResize);
      cancelAnimationFrame(animationRef.current);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        zIndex: 0,
      }}
    />
  );
}
