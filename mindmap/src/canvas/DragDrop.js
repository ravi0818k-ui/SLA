/**
 * Dragging topics.
 *
 * Drop on another topic  -> re-parent (the drop target is highlighted).
 * Drop between siblings  -> reorder (an insertion line is shown).
 * Drop on empty canvas   -> store a manual offset on the topic, which the
 *                           layout engine adds to the tidy position.
 *
 * Nothing is committed until pointerup, and dragging a topic into its own
 * subtree is rejected by MindMap.move(), so a drag can never detach a branch.
 */
import { svgEl } from '../util/dom.js';

const DRAG_THRESHOLD = 4;

export function initDragDrop({ svg, canvas, viewport, getMap, getResult, onDrop, onClick, isEditing }) {
    let state = null;

    const cleanupGhost = () => {
        if (state && state.ghost) state.ghost.remove();
        svg.querySelectorAll('.is-drop-target').forEach((n) => n.classList.remove('is-drop-target'));
    };

    const onPointerDown = (event) => {
        if (event.button !== 0 || (isEditing && isEditing())) return;
        const nodeEl = event.target.closest?.('.mm-node');
        if (!nodeEl) return;
        // Buttons that live inside the node group are not drag handles.
        if (event.target.closest('.mm-toggle')) return;       // collapse button
        if (event.target.closest('.mm-quick-add')) return;    // "+" add child
        if (event.target.closest('.mm-resize-handle')) return; // width grip
        const id = nodeEl.dataset.id;
        const map = getMap();
        const node = getResult()?.nodes.get(id);
        if (!node) return;
        state = {
            id,
            nodeEl,
            started: false,
            startClient: { x: event.clientX, y: event.clientY },
            startMap: canvas.clientToMap(event.clientX, event.clientY),
            origin: { x: node.x, y: node.y },
            isRoot: id === map.rootId,
            ghost: null,
            target: null,
            moved: false
        };
        svg.setPointerCapture?.(event.pointerId);
    };

    const onPointerMove = (event) => {
        if (!state) return;
        const dx = event.clientX - state.startClient.x;
        const dy = event.clientY - state.startClient.y;
        if (!state.started) {
            if (Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
            state.started = true;
            const result = getResult();
            const node = result.nodes.get(state.id);
            state.ghost = svgEl('rect', {
                class: 'mm-drag-ghost',
                x: node.x, y: node.y, width: node.width, height: node.height,
                rx: 10, ry: 10
            });
            canvas.layers.overlay.appendChild(state.ghost);
            svg.classList.add('is-dragging');
        }
        state.moved = true;

        const point = canvas.clientToMap(event.clientX, event.clientY);
        state.ghost.setAttribute('x', state.origin.x + (point.x - state.startMap.x));
        state.ghost.setAttribute('y', state.origin.y + (point.y - state.startMap.y));

        // Find the topic under the pointer, ignoring the one being dragged and
        // anything inside its own subtree.
        const map = getMap();
        const under = document.elementFromPoint(event.clientX, event.clientY);
        const hit = under && under.closest ? under.closest('.mm-node') : null;
        const hitId = hit && hit.dataset.id;
        const valid = hitId && hitId !== state.id && !map.isAncestorOf(state.id, hitId);

        svg.querySelectorAll('.is-drop-target').forEach((n) => n.classList.remove('is-drop-target'));
        state.target = valid ? hitId : null;
        if (valid) hit.classList.add('is-drop-target');
    };

    const onPointerUp = (event) => {
        if (!state) return;
        const finished = state;
        state = null;
        if (svg.hasPointerCapture?.(event.pointerId)) svg.releasePointerCapture(event.pointerId);
        svg.classList.remove('is-dragging');

        if (!finished.started) {
            cleanupGhostFor(finished);
            if (onClick) onClick(finished.id, event);
            return;
        }

        const point = canvas.clientToMap(event.clientX, event.clientY);
        const delta = { x: point.x - finished.startMap.x, y: point.y - finished.startMap.y };
        cleanupGhostFor(finished);

        if (finished.target) onDrop({ type: 'reparent', id: finished.id, parentId: finished.target });
        else onDrop({ type: 'offset', id: finished.id, delta });
    };

    function cleanupGhostFor(finished) {
        if (finished.ghost) finished.ghost.remove();
        svg.querySelectorAll('.is-drop-target').forEach((n) => n.classList.remove('is-drop-target'));
    }

    const onPointerCancel = () => {
        cleanupGhost();
        svg.classList.remove('is-dragging');
        state = null;
    };

    svg.addEventListener('pointerdown', onPointerDown);
    svg.addEventListener('pointermove', onPointerMove);
    svg.addEventListener('pointerup', onPointerUp);
    svg.addEventListener('pointercancel', onPointerCancel);

    return () => {
        svg.removeEventListener('pointerdown', onPointerDown);
        svg.removeEventListener('pointermove', onPointerMove);
        svg.removeEventListener('pointerup', onPointerUp);
        svg.removeEventListener('pointercancel', onPointerCancel);
    };
}
