/**
 * PNG export: serialise the standalone SVG, draw it into a canvas at 2x and
 * read it back as a blob. This is the same route the quiz app's result-card
 * download uses, and it is browser-sensitive — verify in a real browser after
 * changing it.
 *
 * A remote (http) image inside the map would taint the canvas and make
 * toBlob() throw; that is caught and reported rather than failing silently.
 */
import { renderStandaloneSVG } from './SVG.js';

export const DEFAULT_SCALE = 2;
const MAX_PIXELS = 32e6; // keep the bitmap inside what mobile Safari will allocate

export function exportPNG(map, doc, options = {}) {
    const { markup, width, height } = renderStandaloneSVG(map, doc, options);
    let scale = options.scale || DEFAULT_SCALE;
    if (width * height * scale * scale > MAX_PIXELS) {
        scale = Math.max(1, Math.sqrt(MAX_PIXELS / (width * height)));
    }

    return new Promise((resolve, reject) => {
        const blob = new Blob([markup], { type: 'image/svg+xml;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const image = new Image();
        image.crossOrigin = 'anonymous';
        image.onload = () => {
            try {
                const canvas = document.createElement('canvas');
                canvas.width = Math.round(width * scale);
                canvas.height = Math.round(height * scale);
                const ctx = canvas.getContext('2d');
                if (!ctx) throw new Error('This browser cannot render to a canvas.');
                ctx.setTransform(scale, 0, 0, scale, 0, 0);
                ctx.drawImage(image, 0, 0, width, height);
                canvas.toBlob((out) => {
                    URL.revokeObjectURL(url);
                    if (out) resolve(out);
                    else reject(new Error('The image could not be created. Remote images in the map can block this.'));
                }, 'image/png');
            } catch (error) {
                URL.revokeObjectURL(url);
                reject(error);
            }
        };
        image.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error('The map could not be rasterised.'));
        };
        image.src = url;
    });
}
