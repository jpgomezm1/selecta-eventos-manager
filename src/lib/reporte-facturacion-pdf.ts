import jsPDF from 'jspdf';
import { formatLocalDate } from '@/lib/dateLocal';
import type { ReporteFacturacion } from '@/integrations/supabase/apiFacturacionEvento';

/**
 * Reporte de facturación de un evento, en PDF.
 *
 * Es el documento que va del área de bodega a quien emite la factura: cuánto se
 * cotizó y cuánto hay que sumarle por menaje roto o no devuelto, con el detalle
 * artículo por artículo para poder sustentarlo ante el cliente.
 *
 * Sigue la plantilla de `orden-menaje-pdf.ts` — misma paleta, mismo header, el
 * logo con try/catch silencioso y `formatLocalDate` para no correr las fechas
 * un día por zona horaria.
 */

export async function generateReporteFacturacionPDF(r: ReporteFacturacion): Promise<void> {
  const pdf = new jsPDF('p', 'mm', 'a4');
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();

  const colors = {
    primary: [76, 91, 51] as [number, number, number],
    deepOlive: [43, 48, 33] as [number, number, number],
    paper: [248, 246, 242] as [number, number, number],
    neutral: [240, 236, 228] as [number, number, number],
    white: [255, 255, 255] as [number, number, number],
    darkText: [43, 48, 33] as [number, number, number],
    lightText: [122, 116, 105] as [number, number, number],
    border: [224, 220, 214] as [number, number, number],
    alerta: [161, 61, 45] as [number, number, number],
  };

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('es-CO', {
      style: 'currency', currency: 'COP', minimumFractionDigits: 0,
    }).format(value);

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
  } catch { /* el PDF se genera sin logo si falla */ }

  const createHeader = () => {
    pdf.setFillColor(...colors.deepOlive);
    pdf.rect(0, 0, pageWidth, 42, 'F');
    pdf.setDrawColor(...colors.border);
    pdf.setLineWidth(0.4);
    pdf.line(0, 42, pageWidth, 42);

    if (logoImg) {
      pdf.setFillColor(...colors.white);
      pdf.roundedRect(15, 8, 38, 24, 3, 3, 'F');
      pdf.addImage(logoImg, 'PNG', 17, 11, 34, 18, undefined, 'FAST');
    }

    pdf.setFont('times', 'bold');
    pdf.setFontSize(22);
    pdf.setTextColor(...colors.paper);
    pdf.text('Reporte para facturar', logoImg ? 62 : 20, 22);

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(9);
    const fecha = r.evento
      ? formatLocalDate(r.evento.fecha, 'es-CO', { day: '2-digit', month: 'long', year: 'numeric' })
      : '';
    pdf.text(`${r.evento?.nombre ?? ''} · ${fecha}`, logoImg ? 62 : 20, 30);
    if (r.cliente?.nombre) {
      pdf.text(
        `${r.cliente.nombre}${r.cliente.documento ? ` · ${r.cliente.documento}` : ''}`,
        logoImg ? 62 : 20, 36
      );
    }
  };

  createHeader();
  let y = 56;

  // ── Totales ──────────────────────────────────────────────────────────
  const bloque = (etiqueta: string, valor: string, x: number, ancho: number, fuerte = false) => {
    pdf.setFillColor(...(fuerte ? colors.primary : colors.neutral));
    pdf.rect(x, y, ancho, 20, 'F');
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(7.5);
    pdf.setTextColor(...(fuerte ? colors.paper : colors.lightText));
    pdf.text(etiqueta.toUpperCase(), x + 5, y + 7);
    pdf.setFont('times', 'bold');
    pdf.setFontSize(13);
    pdf.setTextColor(...(fuerte ? colors.white : colors.darkText));
    pdf.text(valor, x + 5, y + 15.5);
  };

  const anchoBloque = (pageWidth - 30 - 8) / 3;
  bloque('Cotizado', formatCurrency(r.cotizado), 15, anchoBloque);
  bloque('Menaje perdido', formatCurrency(r.menaje_perdido), 15 + anchoBloque + 4, anchoBloque);
  bloque('Total a facturar', formatCurrency(r.total_a_facturar),
         15 + (anchoBloque + 4) * 2, anchoBloque, true);
  y += 30;

  // ── Advertencias ─────────────────────────────────────────────────────
  // Un reporte incompleto que no lo dice es peor que no tener reporte: se
  // factura de menos y nadie se entera.
  const avisos: string[] = [];
  if (!r.estado.hubo_despacho) avisos.push('No hay despacho de menaje registrado para este evento.');
  if (r.estado.hubo_despacho && !r.estado.hubo_devolucion)
    avisos.push('El menaje todavía no se ha devuelto: las pérdidas pueden cambiar.');
  if (r.estado.sin_costo_reposicion)
    avisos.push('Hay artículos perdidos sin costo de reposición cargado: el total está subestimado.');

  if (avisos.length > 0) {
    pdf.setFillColor(255, 247, 240);
    pdf.rect(15, y, pageWidth - 30, 6 + avisos.length * 5, 'F');
    pdf.setDrawColor(...colors.alerta);
    pdf.setLineWidth(1);
    pdf.line(15, y, 15, y + 6 + avisos.length * 5);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(8);
    pdf.setTextColor(...colors.alerta);
    avisos.forEach((a, i) => pdf.text(a, 20, y + 8 + i * 5));
    y += 12 + avisos.length * 5;
  }

  // ── Detalle de menaje ────────────────────────────────────────────────
  pdf.setFont('times', 'bold');
  pdf.setFontSize(12);
  pdf.setTextColor(...colors.darkText);
  pdf.text('Menaje del evento', 15, y);
  y += 7;

  const cols = [15, 78, 100, 120, 140, 160, pageWidth - 15];
  pdf.setFillColor(...colors.deepOlive);
  pdf.rect(15, y, pageWidth - 30, 8, 'F');
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(7.5);
  pdf.setTextColor(...colors.paper);
  pdf.text('ARTÍCULO', cols[0] + 3, y + 5.5);
  pdf.text('SALIÓ', cols[1], y + 5.5, { align: 'right' });
  pdf.text('VOLVIÓ', cols[2], y + 5.5, { align: 'right' });
  pdf.text('ROTO', cols[3], y + 5.5, { align: 'right' });
  pdf.text('FALTA', cols[4], y + 5.5, { align: 'right' });
  pdf.text('REPOSICIÓN', cols[5] + 12, y + 5.5, { align: 'right' });
  pdf.text('A COBRAR', cols[6] - 3, y + 5.5, { align: 'right' });
  y += 8;

  if (r.menaje.length === 0) {
    pdf.setFont('helvetica', 'italic');
    pdf.setFontSize(9);
    pdf.setTextColor(...colors.lightText);
    pdf.text('No hay menaje despachado ni devuelto para este evento.', 20, y + 7);
    y += 14;
  }

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(8);
  for (const m of r.menaje) {
    if (y > pageHeight - 40) {
      pdf.addPage();
      createHeader();
      y = 56;
    }
    const perdido = m.merma + m.faltante;
    pdf.setTextColor(...colors.darkText);
    pdf.text(m.nombre.slice(0, 34), cols[0] + 3, y + 5);
    pdf.text(String(m.despachado), cols[1], y + 5, { align: 'right' });
    pdf.text(String(m.devuelto), cols[2], y + 5, { align: 'right' });
    pdf.setTextColor(...(m.merma > 0 ? colors.alerta : colors.lightText));
    pdf.text(String(m.merma), cols[3], y + 5, { align: 'right' });
    pdf.setTextColor(...(m.faltante > 0 ? colors.alerta : colors.lightText));
    pdf.text(String(m.faltante), cols[4], y + 5, { align: 'right' });
    pdf.setTextColor(...colors.lightText);
    pdf.text(m.costo_reposicion > 0 ? formatCurrency(m.costo_reposicion) : '—',
             cols[5] + 12, y + 5, { align: 'right' });
    pdf.setFont('helvetica', perdido > 0 ? 'bold' : 'normal');
    pdf.setTextColor(...(perdido > 0 ? colors.darkText : colors.lightText));
    pdf.text(m.valor_perdido > 0 ? formatCurrency(m.valor_perdido) : '—',
             cols[6] - 3, y + 5, { align: 'right' });
    pdf.setFont('helvetica', 'normal');

    y += 7;
    if (m.notas) {
      pdf.setFontSize(7);
      pdf.setTextColor(...colors.lightText);
      pdf.text(`   ${m.notas.slice(0, 110)}`, cols[0] + 3, y + 2);
      pdf.setFontSize(8);
      y += 5;
    }
    pdf.setDrawColor(...colors.border);
    pdf.setLineWidth(0.1);
    pdf.line(15, y, pageWidth - 15, y);
  }

  // ── Cierre ───────────────────────────────────────────────────────────
  y += 8;
  if (y > pageHeight - 30) { pdf.addPage(); createHeader(); y = 56; }
  pdf.setFillColor(...colors.primary);
  pdf.rect(15, y, pageWidth - 30, 14, 'F');
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(9);
  pdf.setTextColor(...colors.paper);
  pdf.text('TOTAL A FACTURAR', 20, y + 9);
  pdf.setFont('times', 'bold');
  pdf.setFontSize(13);
  pdf.setTextColor(...colors.white);
  pdf.text(formatCurrency(r.total_a_facturar), pageWidth - 20, y + 9.5, { align: 'right' });

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(7);
  pdf.setTextColor(...colors.lightText);
  pdf.text(
    `Generado el ${formatLocalDate(new Date().toISOString().slice(0, 10), 'es-CO', { day: '2-digit', month: 'long', year: 'numeric' })}`,
    15, pageHeight - 12
  );

  const slug = (r.evento?.nombre ?? 'evento').replace(/[^a-zA-Z0-9]+/g, '-').toLowerCase();
  pdf.save(`reporte-facturacion-${slug}.pdf`);
}
