import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

export const exportToPDF = async (element: HTMLElement, accountId: string) => {
  try {
    // Create a clone of the element to avoid modifying the original
    const clone = element.cloneNode(true) as HTMLElement;
    
    // Apply styles for better PDF rendering
    clone.style.width = '1200px';
    clone.style.backgroundColor = 'white';
    clone.style.padding = '20px';
    
    // Temporarily add clone to document
    document.body.appendChild(clone);
    
    const canvas = await html2canvas(clone, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff',
      width: 1200,
      height: clone.scrollHeight,
    });
    
    // Remove clone from document
    document.body.removeChild(clone);
    
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF('p', 'mm', 'a4');
    
    // Calculate dimensions
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();
    const imgWidth = pdfWidth - 20; // 10mm margin on each side
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    
    // Add header
    pdf.setFontSize(20);
    pdf.setTextColor(59, 130, 246);
    pdf.text('AWS Cost Analysis Report', 10, 20);
    
    pdf.setFontSize(12);
    pdf.setTextColor(100, 100, 100);
    pdf.text(`Account ID: ${accountId}`, 10, 30);
    pdf.text(`Generated on: ${new Date().toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' })}`, 10, 36);
    
    // Add content
    let yPosition = 45;
    
    if (imgHeight > pdfHeight - yPosition) {
      // If image is too tall, split across pages
      let remainingHeight = imgHeight;
      let currentY = 0;
      
      while (remainingHeight > 0) {
        const pageHeight = Math.min(remainingHeight, pdfHeight - yPosition);
        const pageCanvas = document.createElement('canvas');
        const pageCtx = pageCanvas.getContext('2d');
        
        pageCanvas.width = canvas.width;
        pageCanvas.height = (pageHeight / imgHeight) * canvas.height;
        
        if (pageCtx) {
          pageCtx.drawImage(
            canvas,
            0, currentY,
            canvas.width, pageCanvas.height,
            0, 0,
            canvas.width, pageCanvas.height
          );
          
          const pageImgData = pageCanvas.toDataURL('image/png');
          pdf.addImage(pageImgData, 'PNG', 10, yPosition, imgWidth, pageHeight);
          
          remainingHeight -= pageHeight;
          currentY += pageCanvas.height;
          
          if (remainingHeight > 0) {
            pdf.addPage();
            yPosition = 10;
          }
        }
      }
    } else {
      pdf.addImage(imgData, 'PNG', 10, yPosition, imgWidth, imgHeight);
    }
    
    // Save the PDF
    const fileName = `aws-cost-report-${accountId}-${new Date().toISOString().split('T')[0]}.pdf`;
    pdf.save(fileName);
    
  } catch (error) {
    console.error('Error generating PDF:', error);
    throw new Error('Failed to generate PDF report');
  }
};