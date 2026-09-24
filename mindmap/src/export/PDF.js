/**
 * PDF export (P1 in the spec, included because a student's most common next
 * step is printing the map).
 *
 * jsPDF is loaded from cdnjs *on demand*, inside this one module, so the
 * editor's initial load never pays for it — the same pattern the quiz tools
 * use for pdf.js and epub.js.
 */
import { exportPNG } from './PNG.js';

const JSPDF_URL = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
let loader = null;

function loadJsPDF() {
    if (window.jspdf && window.jspdf.jsPDF) return Promise.resolve(window.jspdf.jsPDF);
    if (loader) return loader;
    loader = new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = JSPDF_URL;
        script.async = true;
        script.crossOrigin = 'anonymous';
        script.onload = () => {
            if (window.jspdf && window.jspdf.jsPDF) resolve(window.jspdf.jsPDF);
            else reject(new Error('The PDF library did not load.'));
        };
        script.onerror = () => {
            loader = null;
            reject(new Error('The PDF library could not be downloaded. Check your connection.'));
        };
        document.head.appendChild(script);
    });
    return loader;
}

export async function exportPDF(map, doc, options = {}) {
    const [JsPDF, blob] = await Promise.all([
        loadJsPDF(),
        exportPNG(map, doc, { ...options, scale: options.scale || 2 })
    ]);

    const dataUrl = await blobToDataURL(blob);
    const image = await loadImage(dataUrl);

    const landscape = image.width >= image.height;
    const pdf = new JsPDF({
        orientation: landscape ? 'landscape' : 'portrait',
        unit: 'pt',
        format: options.format || 'a4'
    });

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 24;
    const scale = Math.min(
        (pageWidth - margin * 2) / image.width,
        (pageHeight - margin * 2) / image.height
    );
    const width = image.width * scale;
    const height = image.height * scale;

    pdf.addImage(
        dataUrl, 'PNG',
        (pageWidth - width) / 2, (pageHeight - height) / 2,
        width, height, undefined, 'FAST'
    );
    pdf.setProperties({ title: doc.meta.title, creator: 'OpenMind' });
    return pdf.output('blob');
}

function blobToDataURL(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error('The image could not be read.'));
        reader.readAsDataURL(blob);
    });
}

function loadImage(src) {
    return new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error('The image could not be read.'));
        image.src = src;
    });
}
