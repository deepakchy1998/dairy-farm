import { useState, useRef, useCallback, useEffect } from 'react';

export default function useDraggable(initialPos = { x: null, y: null }) {
  const [pos, setPos] = useState(initialPos);
  const dragging = useRef(false);
  const offset = useRef({ x: 0, y: 0 });
  const hasMoved = useRef(false);
  const elRef = useRef(null);

  const onStart = useCallback((clientX, clientY) => {
    if (!elRef.current) return;
    const rect = elRef.current.getBoundingClientRect();
    offset.current = { x: clientX - rect.left, y: clientY - rect.top };
    dragging.current = true;
    hasMoved.current = false;
  }, []);

  const onMove = useCallback((clientX, clientY) => {
    if (!dragging.current) return;
    hasMoved.current = true;
    const maxX = window.innerWidth - (elRef.current?.offsetWidth || 60);
    const maxY = window.innerHeight - (elRef.current?.offsetHeight || 60);
    setPos({
      x: Math.max(0, Math.min(maxX, clientX - offset.current.x)),
      y: Math.max(0, Math.min(maxY, clientY - offset.current.y)),
    });
  }, []);

  const onEnd = useCallback(() => {
    dragging.current = false;
  }, []);

  useEffect(() => {
    const handleTouchMove = (e) => {
      if (!dragging.current) return;
      e.preventDefault();
      const t = e.touches[0];
      onMove(t.clientX, t.clientY);
    };
    const handleMouseMove = (e) => onMove(e.clientX, e.clientY);
    const handleEnd = () => onEnd();

    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('touchend', handleEnd);
    window.addEventListener('mouseup', handleEnd);

    return () => {
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('touchend', handleEnd);
      window.removeEventListener('mouseup', handleEnd);
    };
  }, [onMove, onEnd]);

  const handlers = {
    onTouchStart: (e) => onStart(e.touches[0].clientX, e.touches[0].clientY),
    onMouseDown: (e) => { e.preventDefault(); onStart(e.clientX, e.clientY); },
  };

  const style = pos.x !== null ? { position: 'fixed', left: pos.x, top: pos.y, right: 'auto', bottom: 'auto' } : {};

  return { ref: elRef, style, handlers, hasMoved };
}
