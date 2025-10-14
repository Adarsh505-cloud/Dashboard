import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

export const exportToPDF = async (element: HTMLElement, accountId: string) => {
  try {
    const onclone = (clonedDoc: Document) => {
      const originalCanvases = element.querySelectorAll('canvas');
      const clonedCanvases = clonedDoc.querySelectorAll('canvas');
      originalCanvases.forEach((originalCanvas, index) => {
        if (clonedCanvases[index]) {
          const context = clonedCanvases[index].getContext('2d');
          if (context) {
            context.drawImage(originalCanvas, 0, 0);
          }
        }
      });
    };

    const canvas = await html2canvas(element, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff',
      onclone,
    });
    
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF('p', 'mm', 'a4');
    
    // PDF dimensions
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();

    // Define margins (e.g., 10mm on each side)
    const margin = 10; 
    const contentWidth = pdfWidth - (2 * margin); // Content width after applying margins

    // Calculate image height while maintaining aspect ratio and fitting contentWidth
    const imgHeight = (canvas.height * contentWidth) / canvas.width;
    
    let heightLeft = imgHeight;
    let position = margin; // Start position after top margin

    // Add header content with left margin
    pdf.setFontSize(20);
    pdf.setTextColor(59, 130, 246);
    pdf.text('AWS Cost Analysis Report', margin, 20); // Apply left margin to header
    
    pdf.setFontSize(12);
    pdf.setTextColor(100, 100, 100);
    pdf.text(`Account ID: ${accountId}`, margin, 30); // Apply left margin
    pdf.text(`Generated on: ${new Date().toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' })}`, margin, 36); // Apply left margin
    
    // Adjust initial position for image to start below header and with top margin
    position = 45; // This is the y-coordinate where the image will start.

    // Calculate the number of pages needed for the content
    const totalContentHeight = imgHeight; // The total height of the content to be placed on the PDF
    const printableHeight = pdfHeight - (2 * margin); // The height available for content on each page

    let currentPage = 1;
    let yOffset = 0; // Cumulative offset for the image on the canvas

    while (yOffset < totalContentHeight) {
        if (currentPage > 1) {
            pdf.addPage();
            position = margin; // Reset position for new page, apply top margin
        }

        const heightToRender = Math.min(printableHeight, totalContentHeight - yOffset);

        // Calculate the slice of the original canvas image to fit the current page
        // The slice is defined by (source_x, source_y, source_width, source_height)
        // source_x: 0 (start from left of canvas)
        // source_y: yOffset (current top of the content we want to render)
        // source_width: canvas.width (full width of the original canvas)
        // source_height: (heightToRender * canvas.width) / contentWidth (height on original canvas corresponding to heightToRender on PDF)

        // To accurately slice the image, we need to consider the canvas's own dimensions.
        // If contentWidth is scaled down from canvas.width (due to `scale: 2` in html2canvas),
        // then 1mm on PDF corresponds to `canvas.width / contentWidth` pixels on the source canvas.
        const sourceHeight = (heightToRender * canvas.width) / contentWidth;


        // Create a temporary canvas to hold the sliced image part for the current page
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = canvas.width;
        tempCanvas.height = sourceHeight; // Height of the slice
        const tempCtx = tempCanvas.getContext('2d');
        if (tempCtx) {
            // Draw the relevant portion of the original canvas onto the temp canvas
            tempCtx.drawImage(
                canvas,
                0, yOffset * (canvas.width / contentWidth), // Source X, Y on original canvas
                canvas.width, sourceHeight,               // Source Width, Height on original canvas
                0, 0,                                     // Destination X, Y on temp canvas
                canvas.width, sourceHeight                // Destination Width, Height on temp canvas
            );
        }
        const tempImgData = tempCanvas.toDataURL('image/png');

        // Add the sliced image to the PDF
        pdf.addImage(tempImgData, 'PNG', margin, position, contentWidth, heightToRender);

        yOffset += heightToRender;
        currentPage++;
    }
    
    // Save the PDF
    const fileName = `aws-cost-report-${accountId}-${new Date().toISOString().split('T')[0]}.pdf`;
    pdf.save(fileName);
    
  } catch (error) {
    console.error('Error generating PDF:', error);
    throw new Error('Failed to generate PDF report');
  }
};