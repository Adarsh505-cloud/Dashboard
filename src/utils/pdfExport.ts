import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

export const exportToPDF = async (element: HTMLElement, accountId: string) => {
  try {
    // This function will be called by html2canvas on the cloned document before rendering
    const onclone = (clonedDoc: Document) => {
      // Find all original canvas elements on the page
      const originalCanvases = element.querySelectorAll('canvas');
      // Find all canvas elements in the cloned document that will be rendered to PDF
      const clonedCanvases = clonedDoc.querySelectorAll('canvas');
      // Manually copy the rendered image from the original canvas to the clone's canvas
      originalCanvases.forEach((originalCanvas, index) => {
        if (clonedCanvases[index]) {
          const context = clonedCanvases[index].getContext('2d');
          if (context) {
            // This is the key step: drawing the already-rendered chart image
            context.drawImage(originalCanvas, 0, 0);
          }
        }
      });
    };

    const canvas = await html2canvas(element, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff',
      onclone, // Use the onclone callback
    });
    
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF('p', 'mm', 'a4');
    
    // PDF dimensions
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();
    const imgWidth = pdfWidth; 
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    let heightLeft = imgHeight;
    let position = 0;

    // Add header
    pdf.setFontSize(20);
    pdf.setTextColor(59, 130, 246);
    pdf.text('AWS Cost Analysis Report', 10, 20);
    
    pdf.setFontSize(12);
    pdf.setTextColor(100, 100, 100);
    pdf.text(`Account ID: ${accountId}`, 10, 30);
    pdf.text(`Generated on: ${new Date().toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' })}`, 10, 36);
    
    // Initial position after the header
    position = 45;

    // Add the first chunk of the image
    pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
    heightLeft -= (pdfHeight - position);
    
    // Add new pages if the content is too tall
    while (heightLeft > 0) {
      position = heightLeft - imgHeight;
      pdf.addPage();
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pdfHeight;
    }
    
    // Save the PDF
    const fileName = `aws-cost-report-${accountId}-${new Date().toISOString().split('T')[0]}.pdf`;
    pdf.save(fileName);
    
  } catch (error) {
    console.error('Error generating PDF:', error);
    throw new Error('Failed to generate PDF report');
  }
};