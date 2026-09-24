/**
 * Viewport maths. The whole map is drawn once in map coordinates inside a
 * single <g>; zooming and panning only rewrite that group's transform, so
 * neither one costs a re-render (requirement 19: 60 FPS on a normal canvas).
 */
import { clampNumber } from '../util/sanitize.js';

export const MIN_ZOOM = 0.1;
export const MAX_ZOOM = 4;
export const ZOOM_STEPS = [0.1, 0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 3, 4];

export class Viewport {
    constructor(state = {}) {
        this.x = state.x || 0;
        this.y = state.y || 0;
        this.scale = clampNumber(state.scale, MIN_ZOOM, MAX_ZOOM, 1);
        this.onChange = null;
    }

    set(x, y, scale) {
        this.x = x;
        this.y = y;
        if (scale !== undefined) this.scale = clampNumber(scale, MIN_ZOOM, MAX_ZOOM, this.scale);
        this.notify();
    }

    panBy(dx, dy) {
        this.x += dx;
        this.y += dy;
        this.notify();
    }

    /** Screen (client, relative to the svg box) -> map coordinates. */
    toMap(px, py) {
        return { x: (px - this.x) / this.scale, y: (py - this.y) / this.scale };
    }

    /** Map -> screen coordinates. */
    toScreen(mx, my) {
        return { x: mx * this.scale + this.x, y: my * this.scale + this.y };
    }

    /** Zoom keeping the map point under (px, py) pinned to that screen point. */
    zoomAt(px, py, nextScale) {
        const scale = clampNumber(nextScale, MIN_ZOOM, MAX_ZOOM, this.scale);
        const point = this.toMap(px, py);
        this.scale = scale;
        this.x = px - point.x * scale;
        this.y = py - point.y * scale;
        this.notify();
    }

    zoomBy(factor, px, py) {
        this.zoomAt(px, py, this.scale * factor);
    }

    /** Step to the next/previous preset (what Ctrl + and Ctrl - use). */
    zoomStep(direction, px, py) {
        const current = this.scale;
        let target;
        if (direction > 0) target = ZOOM_STEPS.find((s) => s > current + 0.001);
        else target = [...ZOOM_STEPS].reverse().find((s) => s < current - 0.001);
        this.zoomAt(px, py, target || (direction > 0 ? MAX_ZOOM : MIN_ZOOM));
    }

    /** Fit `bounds` (map coords) inside a viewport of `size` with padding. */
    fit(bounds, size, padding = 48, maxScale = 1.5) {
        if (!bounds || !bounds.width || !bounds.height || !size.width || !size.height) return;
        const scale = clampNumber(
            Math.min(
                (size.width - padding * 2) / bounds.width,
                (size.height - padding * 2) / bounds.height
            ),
            MIN_ZOOM,
            maxScale,
            1
        );
        this.scale = scale;
        this.x = size.width / 2 - (bounds.minX + bounds.width / 2) * scale;
        this.y = size.height / 2 - (bounds.minY + bounds.height / 2) * scale;
        this.notify();
    }

    /** Centre a point without changing the zoom (Home / "centre map"). */
    centerOn(point, size) {
        this.x = size.width / 2 - point.x * this.scale;
        this.y = size.height / 2 - point.y * this.scale;
        this.notify();
    }

    toJSON() {
        return { x: this.x, y: this.y, scale: this.scale };
    }

    notify() {
        if (this.onChange) this.onChange(this);
    }
}
