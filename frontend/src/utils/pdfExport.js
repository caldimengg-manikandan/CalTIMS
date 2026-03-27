import { toPng } from 'html-to-image';
import jsPDF from 'jspdf';

/**
 * Exports a DOM element to a high-quality, pixel-perfect PDF.
 * @param {HTMLElement} element - The DOM element to capture.
 * @param {Object} options - Export options.
 * @param {string} options.filename - The name of the PDF file.
 * @param {number} options.pixelRatio - The quality multiplier (e.g., 2 for Retina quality).
 */
export const exportToPdf = async (element, options = {}) => {
    const { 
        filename = 'document.pdf', 
        pixelRatio = 2 
    } = options;

    try {
        // 1. Capture the element as a high-DPI PNG
        const dataUrl = await toPng(element, {
            pixelRatio: pixelRatio,
            backgroundColor: '#ffffff',
            style: {
                borderRadius: '0' // Ensure no rounded corners on the overall image if not wanted
            },
            // Ensure all fonts are loaded
            cacheBust: true,
        });

        // 2. Create jsPDF instance (A4 size)
        const pdf = new jsPDF({
            orientation: 'portrait',
            unit: 'mm',
            format: 'a4'
        });

        // 3. Calculate dimensions to fit A4 perfectly
        const pageWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();
        
        // Subtract a tiny fraction (0.5mm) from height to prevent jsPDF from auto-adding a 2nd page
        // due to infinitesimal floating point overflow
        const safeHeight = pageHeight - 0.5;
        
        // Add the image to the PDF
        // We use 'FAST' compression for speed or 'SLOW' for better quality/smaller size
        pdf.addImage(dataUrl, 'PNG', 0, 0, pageWidth, safeHeight, undefined, 'FAST');

        // 4. Save the file
        pdf.save(filename);
        
        return true;
    } catch (error) {
        console.error('Failed to export PDF:', error);
        throw new Error('PDF generation failed. Please try again.');
    }
};
