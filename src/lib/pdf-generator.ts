import jsPDF from 'jspdf';
import type { Cotizacion } from '@/types/cotizador';

interface CotizacionDetalle {
  cotizacion: Cotizacion;
  versiones: Array<{
    id: string;
    nombre_opcion: string;
    is_definitiva: boolean;
    items: {
      platos: Array<{ nombre: string; precio_unitario: number; cantidad: number }>;
      personal: Array<{ rol: string; tarifa_estimada_por_persona: number; cantidad: number }>;
      transportes: Array<{ lugar: string; tarifa_unitaria: number; cantidad: number }>;
    };
  }>;
}

export async function generateCotizacionPDF(
  data: CotizacionDetalle,
  selectedVersionIds?: string[]
): Promise<void> {
  const pdf = new jsPDF('p', 'mm', 'a4');
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 20;
  const contentWidth = pageWidth - 2 * margin;

  // Cargar logo
  const logoUrl = 'https://storage.googleapis.com/cluvi/Web-Risk/logo_selecta.png';
  let logoImg: string;

  try {
    const response = await fetch(logoUrl);
    const blob = await response.blob();
    logoImg = await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.warn('No se pudo cargar el logo:', error);
    logoImg = '';
  }

  // Configuración de colores
  const primaryColor = [46, 125, 50]; // Verde Selecta
  const secondaryColor = [102, 102, 102]; // Gris
  const textColor = [51, 51, 51]; // Gris oscuro

  let yPosition = margin;

  // Header con logo y título
  if (logoImg) {
    pdf.addImage(logoImg, 'PNG', margin, yPosition, 40, 20);
  }

  pdf.setFontSize(24);
  pdf.setTextColor(...primaryColor);
  pdf.setFont('helvetica', 'bold');
  pdf.text('COTIZACIÓN DE EVENTOS', logoImg ? margin + 50 : margin, yPosition + 15);

  yPosition += 40;

  // Línea separadora
  pdf.setDrawColor(...primaryColor);
  pdf.setLineWidth(1);
  pdf.line(margin, yPosition, pageWidth - margin, yPosition);
  yPosition += 15;

  // Información del cliente
  pdf.setFontSize(16);
  pdf.setTextColor(...textColor);
  pdf.setFont('helvetica', 'bold');
  pdf.text('INFORMACIÓN DEL EVENTO', margin, yPosition);
  yPosition += 10;

  pdf.setFontSize(11);
  pdf.setFont('helvetica', 'normal');

  const clienteInfo = [
    `Cotización: ${data.cotizacion.nombre_cotizacion}`,
    `Cliente: ${data.cotizacion.cliente_nombre || 'Por definir'}`,
    `Número de invitados: ${data.cotizacion.numero_invitados}`,
    `Fecha estimada: ${data.cotizacion.fecha_evento_estimada ?
      new Date(data.cotizacion.fecha_evento_estimada).toLocaleDateString('es-CO') : 'Por definir'}`,
    `Ubicación: ${data.cotizacion.ubicacion_evento || 'Por definir'}`,
    `Comercial encargado: ${data.cotizacion.comercial_encargado}`,
    `Estado: ${data.cotizacion.estado}`
  ];

  clienteInfo.forEach((info) => {
    pdf.text(info, margin, yPosition);
    yPosition += 6;
  });

  yPosition += 10;

  // Opciones de cotización
  data.versiones.forEach((version, index) => {
    // Verificar si necesitamos nueva página
    if (yPosition > pageHeight - 80) {
      pdf.addPage();
      yPosition = margin;
    }

    // Título de la versión
    pdf.setFontSize(14);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(...primaryColor);
    pdf.text(`${version.nombre_opcion}${version.is_definitiva ? ' (DEFINITIVA)' : ''}`, margin, yPosition);
    yPosition += 10;

    // Platos
    if (version.items.platos.length > 0) {
      pdf.setFontSize(12);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(...textColor);
      pdf.text('MENÚ Y ALIMENTACIÓN', margin, yPosition);
      yPosition += 8;

      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'normal');

      version.items.platos.forEach((plato) => {
        const subtotal = plato.precio_unitario * plato.cantidad;
        const text = `• ${plato.nombre} x${plato.cantidad} - ${new Intl.NumberFormat('es-CO', {
          style: 'currency',
          currency: 'COP',
          minimumFractionDigits: 0
        }).format(subtotal)}`;

        pdf.text(text, margin + 5, yPosition);
        yPosition += 5;
      });
      yPosition += 5;
    }

    // Personal
    if (version.items.personal.length > 0) {
      pdf.setFontSize(12);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(...textColor);
      pdf.text('PERSONAL DE SERVICIO', margin, yPosition);
      yPosition += 8;

      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'normal');

      version.items.personal.forEach((personal) => {
        const subtotal = personal.tarifa_estimada_por_persona * personal.cantidad;
        const text = `• ${personal.rol} x${personal.cantidad} - ${new Intl.NumberFormat('es-CO', {
          style: 'currency',
          currency: 'COP',
          minimumFractionDigits: 0
        }).format(subtotal)}`;

        pdf.text(text, margin + 5, yPosition);
        yPosition += 5;
      });
      yPosition += 5;
    }

    // Transportes
    if (version.items.transportes.length > 0) {
      pdf.setFontSize(12);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(...textColor);
      pdf.text('LOGÍSTICA Y TRANSPORTE', margin, yPosition);
      yPosition += 8;

      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'normal');

      version.items.transportes.forEach((transporte) => {
        const subtotal = transporte.tarifa_unitaria * transporte.cantidad;
        const text = `• ${transporte.lugar} x${transporte.cantidad} - ${new Intl.NumberFormat('es-CO', {
          style: 'currency',
          currency: 'COP',
          minimumFractionDigits: 0
        }).format(subtotal)}`;

        pdf.text(text, margin + 5, yPosition);
        yPosition += 5;
      });
      yPosition += 5;
    }

    // Total de la versión
    const totalVersion =
      version.items.platos.reduce((sum, p) => sum + (p.precio_unitario * p.cantidad), 0) +
      version.items.personal.reduce((sum, p) => sum + (p.tarifa_estimada_por_persona * p.cantidad), 0) +
      version.items.transportes.reduce((sum, t) => sum + (t.tarifa_unitaria * t.cantidad), 0);

    pdf.setFontSize(14);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(...primaryColor);
    pdf.text(`TOTAL ${version.nombre_opcion}: ${new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0
    }).format(totalVersion)}`, margin, yPosition);

    yPosition += 20;

    // Línea separadora entre versiones
    if (index < data.versiones.length - 1) {
      pdf.setDrawColor(...secondaryColor);
      pdf.setLineWidth(0.5);
      pdf.line(margin, yPosition - 10, pageWidth - margin, yPosition - 10);
    }
  });

  // Footer
  const currentPage = pdf.internal.getNumberOfPages();
  for (let i = 1; i <= currentPage; i++) {
    pdf.setPage(i);
    pdf.setFontSize(9);
    pdf.setTextColor(...secondaryColor);
    pdf.setFont('helvetica', 'italic');

    const footerText = 'Selecta Eventos - Creando experiencias inolvidables';
    const footerWidth = pdf.getTextWidth(footerText);
    pdf.text(footerText, (pageWidth - footerWidth) / 2, pageHeight - 10);

    const date = new Date().toLocaleDateString('es-CO');
    pdf.text(`Generado el ${date}`, margin, pageHeight - 10);

    pdf.text(`Página ${i} de ${currentPage}`, pageWidth - margin - 30, pageHeight - 10);
  }

  // Descargar PDF
  const fileName = `Cotizacion_${data.cotizacion.nombre_cotizacion.replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
  pdf.save(fileName);
}