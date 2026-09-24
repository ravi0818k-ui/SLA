/**
 * Panning and wheel zoom.
 *
 * Three ways to pan, all mapped to the same handler: drag the empty canvas,
 * hold Space and drag anywhere, or drag with the middle button. Wheel scrolls
 * the map; Ctrl/Cmd + wheel (which is also what a trackpad pinch sends) zooms
 * around the pointer.
 */
export function initPan({ svg, viewport, isPanKeyDown, onPanStart, onPanEnd, shouldStart }) {
    let panning = false;
    let pointerId = null;
    let last = { x: 0, y: 0 };

    const onPointerDown = (event) => {
        const middle = event.button === 1;
        const background = event.button === 0 && shouldStart && shouldStart(event);
        const spacePan = event.button === 0 && isPanKeyDown && isPanKeyDown();
        if (!middle && !background && !spacePan) return;
        panning = true;
        pointerId = event.pointerId;
        last = { x: event.clientX, y: event.clientY };
        svg.setPointerCapture?.(event.pointerId);
        svg.classList.add('is-panning');
        if (onPanStart) onPanStart(event);
        event.preventDefault();
    };

    const onPointerMove = (event) => {
        if (!panning || event.pointerId !== pointerId) return;
        viewport.panBy(event.clientX - last.x, event.clientY - last.y);
        last = { x: event.clientX, y: event.clientY };
    };

    const stop = (event) => {
        if (!panning) return;
        panning = false;
        pointerId = null;
        svg.classList.remove('is-panning');
        if (svg.hasPointerCapture?.(event.pointerId)) svg.releasePointerCapture(event.pointerId);
        if (onPanEnd) onPanEnd(event);
    };

    const onWheel = (event) => {
        const rect = svg.getBoundingClientRect();
        const px = event.clientX - rect.left;
        const py = event.clientY - rect.top;
        if (event.ctrlKey || event.metaKey) {
            event.preventDefault();
            viewport.zoomBy(Math.exp(-event.deltaY * 0.0022), px, py);
            return;
        }
        event.preventDefault();
        const factor = event.deltaMode === 1 ? 16 : 1;
        viewport.panBy(-event.deltaX * factor, -event.deltaY * factor);
    };

    svg.addEventListener('pointerdown', onPointerDown);
    svg.addEventListener('pointermove', onPointerMove);
    svg.addEventListener('pointerup', stop);
    svg.addEventListener('pointercancel', stop);
    svg.addEventListener('wheel', onWheel, { passive: false });

    return () => {
        svg.removeEventListener('pointerdown', onPointerDown);
        svg.removeEventListener('pointermove', onPointerMove);
        svg.removeEventListener('pointerup', stop);
        svg.removeEventListener('pointercancel', stop);
        svg.removeEventListener('wheel', onWheel);
    };
}

/** Two-finger pinch zoom for touch devices. */
export function initPinchZoom({ svg, viewport }) {
    const points = new Map();
    let startDistance = 0;
    let startScale = 1;

    const distance = () => {
        const [a, b] = Array.from(points.values());
        return Math.hypot(a.x - b.x, a.y - b.y);
    };
    const midpoint = () => {
        const [a, b] = Array.from(points.values());
        const rect = svg.getBoundingClientRect();
        return { x: (a.x + b.x) / 2 - rect.left, y: (a.y + b.y) / 2 - rect.top };
    };

    const down = (event) => {
        if (event.pointerType !== 'touch') return;
        points.set(event.pointerId, { x: event.clientX, y: event.clientY });
        if (points.size === 2) { startDistance = distance(); startScale = viewport.scale; }
    };
    const move = (event) => {
        if (!points.has(event.pointerId)) return;
        points.set(event.pointerId, { x: event.clientX, y: event.clientY });
        if (points.size === 2 && startDistance > 0) {
            const mid = midpoint();
            viewport.zoomAt(mid.x, mid.y, startScale * (distance() / startDistance));
            event.preventDefault();
        }
    };
    const up = (event) => {
        points.delete(event.pointerId);
        if (points.size < 2) startDistance = 0;
    };

    svg.addEventListener('pointerdown', down);
    svg.addEventListener('pointermove', move, { passive: false });
    svg.addEventListener('pointerup', up);
    svg.addEventListener('pointercancel', up);

    return () => {
        svg.removeEventListener('pointerdown', down);
        svg.removeEventListener('pointermove', move);
        svg.removeEventListener('pointerup', up);
        svg.removeEventListener('pointercancel', up);
    };
}
