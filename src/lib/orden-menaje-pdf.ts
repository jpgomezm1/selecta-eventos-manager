import jsPDF from 'jspdf';
import type { OrdenMenajeItem } from '@/types/menaje';
import { formatLocalDate } from '@/lib/dateLocal';

export interface OrdenMenajePDFData {
  items: OrdenMenajeItem[];
  evento: {
    nombre_evento: string;
    fecha_evento: string;
    ubicacion: string;
    comercial_encargado?: string | null;
  };
}

export async function generateOrdenMenajePDF(data: OrdenMenajePDFData): Promise<void> {
  const pdf = new jsPDF('p', 'mm', 'a4');
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();

  const colors = {
    primary: [0, 90, 100] as [number, number, number],
    secondary: [177, 201, 30] as [number, number, number],
    neutral: [245, 247, 250] as [number, number, number],
    white: [255, 255, 255] as [number, number, number],
    darkText: [45, 55, 72] as [number, number, number],
    lightText: [107, 114, 128] as [number, number, number],
    border: [229, 231, 235] as [number, number, number],
    altRow: [248, 250, 252] as [number, number, number],
  };

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('es-CO', {
      style: 'currency', currency: 'COP', minimumFractionDigits: 0,
    }).format(value);

  // Load logo
  let logoImg = '';
  try {
    const response = await fetch('https://storage.googleapis.com/cluvi/Web-Risk/logo_selecta.png');
    if (response.ok) {
      const blob = await response.blob();
      logoImg = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(blob);
      });
    }
  } catch { /* ignore */ }

  // ── Header ──
  const createHeader = () => {
    pdf.setFillColor(...colors.primary);
    pdf.rect(0, 0, pageWidth, 42, 'F');
    pdf.setFillColor(...colors.secondary);
    pdf.rect(0, 42, pageWidth, 3, 'F');

    if (logoImg) {
      pdf.setFillColor(...colors.white);
      pdf.roundedRect(15, 8, 38, 24, 3, 3, 'F');
      pdf.addImage(logoImg, 'PNG', 17, 11, 34, 18, undefined, 'FAST');
    }

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(20);
    pdf.setTextColor(...colors.white);
    pdf.text('ORDEN DE MENAJE', logoImg ? 62 : 20, 24);

    // Event name + date on the right
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(9);
    const fecha = formatLocalDate(data.evento.fecha_evento, 'es-CO', {
      year: 'numeric', month: 'short', day: 'numeric',
    });
    const infoRight = `${data.evento.nombre_evento}  |  ${fecha}`;
    const infoW = pdf.getTextWidth(infoRight);
    pdf.text(infoRight, pageWidth - 15 - infoW, 35);
  };

  // ── Info line below header ──
  const addInfoLine = (yPos: number): number => {
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(9);
    pdf.setTextColor(...colors.lightText);

    const parts: string[] = [];
    if (data.evento.ubicacion) parts.push(data.evento.ubicacion);
    if (data.evento.comercial_encargado) parts.push(`Comercial: ${data.evento.comercial_encargado}`);
    parts.push(`${data.items.length} items de menaje`);

    pdf.text(parts.join('   |   '), 15, yPos);
    return yPos + 8;
  };

  // ── Items table: Item, Unidad, Cantidad, Precio Alq., Subtotal ──
  const addItemsTable = (yPos: number): number => {
    const itemsToShow = data.items.filter(i => i.cantidad_reservar > 0);

    if (itemsToShow.length === 0) {
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(11);
      pdf.setTextColor(...colors.lightText);
      pdf.text('No hay items de menaje en la orden.', 15, yPos + 10);
      return yPos + 25;
    }

    const startX = 15;
    const tableWidth = pageWidth - 30;
    const rowHeight = 9;
    const headerHeight = 10;

    const cols = {
      item: { x: startX + 3, w: 70 },
      unidad: { x: startX + 75, w: 25 },
      cantidad: { x: startX + 102, w: 25 },
      precio: { x: startX + 129, w: 25 },
      subtotal: { x: startX + 152, w: tableWidth - 155 },
    };

    const drawTableHeader = (y: number): number => {
      pdf.setFillColor(...colors.primary);
      pdf.roundedRect(startX, y, tableWidth, headerHeight, 3, 3, 'F');

      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(9);
      pdf.setTextColor(...colors.white);

      pdf.text('Item', cols.item.x, y + 7);
      pdf.text('Unidad', cols.unidad.x, y + 7);
      pdf.text('Cantidad', cols.cantidad.x, y + 7);
      pdf.text('Precio Alq.', cols.precio.x, y + 7);
      const subtotalLabel = 'Subtotal';
      pdf.text(subtotalLabel, startX + tableWidth - pdf.getTextWidth(subtotalLabel) - 3, y + 7);

      return y + headerHeight;
    };

    yPos = drawTableHeader(yPos);

    itemsToShow.forEach((item, index) => {
      if (yPos + rowHeight > pageHeight - 30) {
        pdf.addPage();
        createHeader();
        yPos = drawTableHeader(52);
      }

      // Alternate row
      if (index % 2 === 1) {
        pdf.setFillColor(...colors.altRow);
        pdf.rect(startX, yPos, tableWidth, rowHeight, 'F');
      }

      const textY = yPos + 6.5;

      // Item name
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(9);
      pdf.setTextColor(...colors.darkText);
      const nombre = item.nombre.length > 40 ? item.nombre.substring(0, 38) + '...' : item.nombre;
      pdf.text(nombre, cols.item.x, textY);

      // Unidad
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(9);
      pdf.setTextColor(...colors.lightText);
      pdf.text(item.unidad, cols.unidad.x, textY);

      // Cantidad (bold)
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(10);
      pdf.setTextColor(...colors.darkText);
      pdf.text(
        item.cantidad_reservar.toLocaleString('es-CO', { maximumFractionDigits: 2 }),
        cols.cantidad.x,
        textY
      );

      // Precio Alquiler
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(9);
      pdf.setTextColor(...colors.darkText);
      pdf.text(formatCurrency(item.precio_alquiler), cols.precio.x, textY);

      // Subtotal (right-aligned)
      const subtotal = item.cantidad_reservar * item.precio_alquiler;
      const subtotalTxt = formatCurrency(subtotal);
      pdf.text(subtotalTxt, startX + tableWidth - pdf.getTextWidth(subtotalTxt) - 3, textY);

      // Row border
      pdf.setDrawColor(...colors.border);
      pdf.setLineWidth(0.15);
      pdf.line(startX, yPos + rowHeight, startX + tableWidth, yPos + rowHeight);

      yPos += rowHeight;
    });

    return yPos + 8;
  };

  // ── Total ──
  const addTotal = (yPos: number): number => {
    if (yPos + 25 > pageHeight - 30) {
      pdf.addPage();
      createHeader();
      yPos = 52;
    }

    const total = data.items.reduce((a, i) => a + i.cantidad_reservar * i.precio_alquiler, 0);
    const startX = 15;
    const tableWidth = pageWidth - 30;

    pdf.setDrawColor(...colors.primary);
    pdf.setLineWidth(0.5);
    pdf.line(startX, yPos, startX + tableWidth, yPos);

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(11);
    pdf.setTextColor(...colors.darkText);
    pdf.text('TOTAL ESTIMADO ALQUILER', startX + 3, yPos + 8);

    pdf.setFontSize(13);
    pdf.setTextColor(...colors.primary);
    const totalTxt = formatCurrency(total);
    pdf.text(totalTxt, startX + tableWidth - pdf.getTextWidth(totalTxt) - 3, yPos + 8);

    return yPos + 20;
  };

  // ── Footer ──
  const addFooter = () => {
    const footerY = pageHeight - 15;
    pdf.setDrawColor(...colors.border);
    pdf.setLineWidth(0.2);
    pdf.line(15, footerY - 4, pageWidth - 15, footerY - 4);

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(7);
    pdf.setTextColor(...colors.lightText);

    const date = new Date().toLocaleDateString('es-CO', {
      year: 'numeric', month: 'long', day: 'numeric',
    });
    pdf.text(`Generado: ${date}`, 15, footerY);

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(8);
    pdf.setTextColor(...colors.primary);
    const brand = 'SELECTA EVENTOS';
    pdf.text(brand, (pageWidth - pdf.getTextWidth(brand)) / 2, footerY);

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(7);
    pdf.setTextColor(...colors.lightText);
    const totalPages = pdf.internal.getNumberOfPages();
    const currentPage = (pdf as unknown as { internal: { getCurrentPageInfo(): { pageNumber: number } } }).internal.getCurrentPageInfo().pageNumber;
    const pageTxt = `${currentPage} / ${totalPages}`;
    pdf.text(pageTxt, pageWidth - 15 - pdf.getTextWidth(pageTxt), footerY);
  };

  // ── Build ──
  createHeader();
  let y = addInfoLine(52);
  y = addItemsTable(y);
  addTotal(y);

  const totalPages = pdf.internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    pdf.setPage(i);
    addFooter();
  }

  const eventName = data.evento.nombre_evento.replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ ]/g, '').replace(/\s+/g, '_');
  const timestamp = new Date().toISOString().split('T')[0];
  pdf.save(`OM_${eventName}_${timestamp}.pdf`);
}
