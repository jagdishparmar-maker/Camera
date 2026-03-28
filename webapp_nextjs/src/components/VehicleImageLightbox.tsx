"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type VehicleImageLightboxProps = {
  src: string;
  alt: string;
  open: boolean;
  onClose: () => void;
};

const MIN_SCALE = 1;
const MAX_SCALE = 5;
const WHEEL_STEP = 0.12;

function touchDistance(a: { clientX: number; clientY: number }, b: { clientX: number; clientY: number }): number {
  return Math.hypot(b.clientX - a.clientX, b.clientY - a.clientY);
}

/**
 * Fullscreen image viewer: wheel / pinch to zoom, drag to pan when zoomed.
 */
export function VehicleImageLightbox({ src, alt, open, onClose }: VehicleImageLightboxProps) {
  const [scale, setScale] = useState(1);
  const [tx, setTx] = useState(0);
  const [ty, setTy] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const dragging = useRef(false);
  const lastPointer = useRef({ x: 0, y: 0 });
  /** Pinch: initial finger distance and scale at gesture start */
  const pinchRef = useRef<{ dist0: number; scale0: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      setScale(1);
      setTx(0);
      setTy(0);
      setIsDragging(false);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const dir = e.deltaY > 0 ? -1 : 1;
      setScale((s) => {
        const next = Math.min(MAX_SCALE, Math.max(MIN_SCALE, s + dir * WHEEL_STEP));
        if (next <= MIN_SCALE) {
          setTx(0);
          setTy(0);
        }
        return next;
      });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const el = containerRef.current;
    if (!el) return;
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length !== 2 || !pinchRef.current) return;
      e.preventDefault();
      const d = touchDistance(e.touches[0], e.touches[1]);
      const { dist0, scale0 } = pinchRef.current;
      const next = Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale0 * (d / dist0)));
      setScale(next);
      if (next <= MIN_SCALE) {
        setTx(0);
        setTy(0);
      }
    };
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    return () => el.removeEventListener("touchmove", onTouchMove);
  }, [open]);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (scale <= MIN_SCALE) return;
      dragging.current = true;
      setIsDragging(true);
      lastPointer.current = { x: e.clientX, y: e.clientY };
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    },
    [scale],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragging.current || scale <= MIN_SCALE) return;
      const dx = e.clientX - lastPointer.current.x;
      const dy = e.clientY - lastPointer.current.y;
      lastPointer.current = { x: e.clientX, y: e.clientY };
      setTx((t) => t + dx);
      setTy((t) => t + dy);
    },
    [scale],
  );

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    dragging.current = false;
    setIsDragging(false);
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  }, []);

  const onTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (e.touches.length === 2) {
        const d = touchDistance(e.touches[0], e.touches[1]);
        pinchRef.current = { dist0: d, scale0: scale };
      }
    },
    [scale],
  );

  const onTouchEnd = useCallback(() => {
    pinchRef.current = null;
  }, []);

  if (!open) return null;

  const cursor =
    scale <= MIN_SCALE ? "default" : isDragging ? "grabbing" : "grab";

  return (
    <div
      className="fixed inset-0 z-[60] flex flex-col bg-black/90 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Zoom vehicle photo"
      onClick={onClose}
    >
      <div
        className="flex shrink-0 items-center justify-between gap-2 border-b border-white/10 px-3 py-2 text-white/90"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-xs text-white/70">
          Scroll or pinch to zoom · drag when zoomed · Esc to close
        </p>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md px-2 py-1 text-sm text-white/80 hover:bg-white/10"
          aria-label="Close photo"
        >
          ✕
        </button>
      </div>
      <div
        ref={containerRef}
        className="relative min-h-0 flex-1 touch-none overflow-hidden"
        onClick={onClose}
      >
        <img
          src={src}
          alt={alt}
          draggable={false}
          onClick={(e) => e.stopPropagation()}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
          className="absolute left-1/2 top-1/2 max-h-full max-w-full select-none object-contain"
          style={{
            transform: `translate(calc(-50% + ${tx}px), calc(-50% + ${ty}px)) scale(${scale})`,
            transformOrigin: "center center",
            cursor,
            touchAction: "none",
          }}
        />
      </div>
    </div>
  );
}
