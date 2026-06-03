import { useState, useRef, useEffect, useCallback } from 'react';

export function useZoomPan() {
  const [scale, setScale] = useState(1.0);
  const [translate, setTranslate] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement | null>(null);
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0 });

  const minScale = 0.4;
  const maxScale = 1.5;

  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault();
    const zoomFactor = 0.05;
    const delta = -e.deltaY;
    setScale((prev) => {
      const next = prev + (delta > 0 ? zoomFactor : -zoomFactor);
      return Math.min(maxScale, Math.max(minScale, next));
    });
  }, []);

  const handleMouseDown = useCallback((e: MouseEvent) => {
    if (e.button === 1 || e.button === 0) {
      const container = containerRef.current;
      if (!container) return;

      const target = e.target as HTMLElement;

      // Ensure the click started inside the zoom/pan container
      if (!container.contains(target)) return;

      // For left-button drag, reject if clicked on/inside an interactive element
      if (e.button === 0) {
        const isInteractive = target.closest(
          'a, button, input, textarea, select, [contenteditable="true"], [data-interactive="true"]'
        );
        if (isInteractive) {
          return;
        }
      }

      isDraggingRef.current = true;
      dragStartRef.current = { x: e.clientX - translate.x, y: e.clientY - translate.y };
      e.preventDefault();
    }
  }, [translate]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDraggingRef.current) return;
    setTranslate({
      x: e.clientX - dragStartRef.current.x,
      y: e.clientY - dragStartRef.current.y,
    });
  }, []);

  const handleMouseUp = useCallback(() => {
    isDraggingRef.current = false;
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    el.addEventListener('wheel', handleWheel, { passive: false });
    el.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      el.removeEventListener('wheel', handleWheel);
      el.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [handleWheel, handleMouseDown, handleMouseMove, handleMouseUp]);

  return {
    scale,
    translate,
    containerRef,
    reset: () => {
      setScale(1.0);
      setTranslate({ x: 0, y: 0 });
    },
  };
}
