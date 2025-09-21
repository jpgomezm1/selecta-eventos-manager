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

export async function generateSelectaPremiumPDF(
  data: CotizacionDetalle,
  selectedVersionIds?: string[]
): Promise<void> {
  const pdf = new jsPDF('p', 'mm', 'a4');
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();

  // Filtrar versiones seleccionadas
  const versiones = selectedVersionIds
    ? data.versiones.filter(v => selectedVersionIds.includes(v.id))
    : data.versiones;

  // Paleta de colores oficial de Selecta (refinada)
  const selectaColors = {
    primary: [0, 90, 100],        // #005A64 - Azul petróleo principal
    secondary: [177, 201, 30],     // #B1C91E - Verde lima distintivo
    neutral: [245, 247, 250],      // Gris muy claro para fondos
    white: [255, 255, 255],        // Blanco puro
    darkText: [45, 55, 72],        // Gris oscuro para texto principal
    lightText: [107, 114, 128],    // Gris medio para texto secundario
    border: [229, 231, 235],       // Bordes sutiles
    accent: [16, 185, 129]         // Verde accent para destacados
  };

  // Cargar logo
  let logoImg: string = '';
  try {
    const logoUrl = 'https://storage.googleapis.com/cluvi/Web-Risk/logo_selecta.png';
    const response = await fetch(logoUrl);
    if (response.ok) {
      const blob = await response.blob();
      logoImg = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(blob);
      });
    }
  } catch (error) {
    console.warn('Logo no disponible:', error);
  }

  // Header elegante y profesional
  const createProfessionalHeader = () => {
    // Fondo principal azul petróleo
    pdf.setFillColor(...selectaColors.primary);
    pdf.rect(0, 0, pageWidth, 50, 'F');

    // Franja verde lima
    pdf.setFillColor(...selectaColors.secondary);
    pdf.rect(0, 50, pageWidth, 4, 'F');

    // Logo con espacio en blanco
    if (logoImg) {
      pdf.setFillColor(...selectaColors.white);
      pdf.roundedRect(18, 12, 44, 26, 4, 4, 'F');
      pdf.addImage(logoImg, 'PNG', 20, 15, 40, 20, undefined, 'FAST');
    }

    // Título principal
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(24);
    pdf.setTextColor(...selectaColors.white);
    pdf.text('PROPUESTA COMERCIAL', logoImg ? 75 : 25, 30);

    // Línea decorativa sutil
    pdf.setDrawColor(...selectaColors.white);
    pdf.setLineWidth(0.5);
    pdf.line(logoImg ? 75 : 25, 35, 180, 35);
  };

  // Información del cliente con diseño limpio
  const addClientInfo = (yPos: number) => {
    // Fondo sutil para la sección
    pdf.setFillColor(...selectaColors.neutral);
    pdf.roundedRect(15, yPos, pageWidth - 30, 70, 6, 6, 'F');

    // Título de la sección
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(14);
    pdf.setTextColor(...selectaColors.primary);
    pdf.text('INFORMACIÓN DEL EVENTO', 25, yPos + 15);

    // Línea separadora
    pdf.setDrawColor(...selectaColors.border);
    pdf.setLineWidth(0.3);
    pdf.line(25, yPos + 20, pageWidth - 25, yPos + 20);

    yPos += 30;

    // Información en grid ordenado
    const clientInfo = [
      ['Evento:', data.cotizacion.nombre_cotizacion],
      ['Cliente:', data.cotizacion.cliente_nombre || 'Por definir'],
      ['Invitados:', `${data.cotizacion.numero_invitados} personas`],
      ['Fecha:', data.cotizacion.fecha_evento_estimada
        ? new Date(data.cotizacion.fecha_evento_estimada).toLocaleDateString('es-CO', {
            year: 'numeric', month: 'long', day: 'numeric'
          })
        : 'Por definir'],
      ['Ubicación:', data.cotizacion.ubicacion_evento || 'Por definir'],
      ['Comercial:', data.cotizacion.comercial_encargado],
    ];

    clientInfo.forEach((item, index) => {
      const row = Math.floor(index / 2);
      const col = index % 2;
      const x = col === 0 ? 25 : pageWidth / 2 + 10;
      const y = yPos + (row * 10);

      // Label
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(9);
      pdf.setTextColor(...selectaColors.lightText);
      pdf.text(item[0], x, y);

      // Valor
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(10);
      pdf.setTextColor(...selectaColors.darkText);
      const labelWidth = pdf.getTextWidth(item[0]);
      pdf.text(item[1], x + labelWidth + 5, y);
    });

    return yPos + 50;
  };

  // Sección de versión profesional
  const addVersionSection = (version: any, yPos: number) => {
    const sectionMinHeight = 80;

    // Verificar espacio en página
    if (yPos + sectionMinHeight > pageHeight - 40) {
      pdf.addPage();
      createProfessionalHeader();
      yPos = 70;
    }

    const total = calculateVersionTotal(version);
    const isRecommended = version.is_definitiva;

    // Card principal
    pdf.setFillColor(...selectaColors.white);
    pdf.roundedRect(15, yPos, pageWidth - 30, 50, 8, 8, 'F');

    // Borde izquierdo de color
    const borderColor = isRecommended ? selectaColors.accent : selectaColors.primary;
    pdf.setFillColor(...borderColor);
    pdf.roundedRect(15, yPos, 4, 50, 4, 4, 'F');

    // Badge de recomendación (más sutil)
    if (isRecommended) {
      pdf.setFillColor(...selectaColors.accent);
      pdf.roundedRect(25, yPos + 8, 80, 12, 6, 6, 'F');
      
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(7);
      pdf.setTextColor(...selectaColors.white);
      pdf.text('OPCIÓN RECOMENDADA', 28, yPos + 16);
    }

    // Título de la opción
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(18);
    pdf.setTextColor(...selectaColors.primary);
    pdf.text(version.nombre_opcion, 25, yPos + (isRecommended ? 35 : 25));

    // Total destacado
    const totalText = new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0
    }).format(total);

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(20);
    pdf.setTextColor(...selectaColors.primary);
    const totalWidth = pdf.getTextWidth(totalText);
    pdf.text(totalText, pageWidth - 25 - totalWidth, yPos + 30);

    yPos += 60;

    // Categorías de servicios
    const categories = [
      {
        title: 'EXPERIENCIA GASTRONÓMICA',
        items: version.items.platos,
        color: selectaColors.secondary,
        getValue: (item: any) => ({ name: item.nombre, price: item.precio_unitario, qty: item.cantidad })
      },
      {
        title: 'EQUIPO PROFESIONAL',
        items: version.items.personal,
        color: selectaColors.primary,
        getValue: (item: any) => ({ name: item.rol, price: item.tarifa_estimada_por_persona, qty: item.cantidad })
      },
      {
        title: 'LOGÍSTICA Y TRANSPORTE',
        items: version.items.transportes,
        color: [255, 146, 43], // Naranja
        getValue: (item: any) => ({ name: `Transporte a ${item.lugar}`, price: item.tarifa_unitaria, qty: item.cantidad })
      }
    ];

    categories.forEach((category) => {
      if (category.items.length > 0) {
        // Verificar espacio
        if (yPos + 30 + (category.items.length * 7) > pageHeight - 40) {
          pdf.addPage();
          createProfessionalHeader();
          yPos = 70;
        }

        // Header de categoría
        pdf.setFillColor(...category.color);
        pdf.roundedRect(20, yPos, pageWidth - 40, 16, 8, 8, 'F');

        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(10);
        pdf.setTextColor(...selectaColors.white);
        pdf.text(category.title, 30, yPos + 10);

        yPos += 20;

        // Lista de servicios
        category.items.forEach((item: any, index: number) => {
          const itemData = category.getValue(item);
          const subtotal = itemData.price * itemData.qty;
          const itemY = yPos + (index * 7);

          // Punto indicador
          pdf.setFillColor(...category.color);
          pdf.circle(25, itemY - 1, 1, 'F');

          // Nombre del servicio
          pdf.setFont('helvetica', 'normal');
          pdf.setFontSize(9);
          pdf.setTextColor(...selectaColors.darkText);
          pdf.text(itemData.name, 30, itemY);

          // Cantidad
          pdf.setFont('helvetica', 'normal');
          pdf.setFontSize(8);
          pdf.setTextColor(...selectaColors.lightText);
          pdf.text(`x${itemData.qty}`, 130, itemY);

          // Precio
          const priceText = new Intl.NumberFormat('es-CO', {
            style: 'currency',
            currency: 'COP',
            minimumFractionDigits: 0
          }).format(subtotal);

          pdf.setFont('helvetica', 'bold');
          pdf.setFontSize(9);
          pdf.setTextColor(...selectaColors.primary);
          const priceWidth = pdf.getTextWidth(priceText);
          pdf.text(priceText, pageWidth - 30 - priceWidth, itemY);
        });

        yPos += (category.items.length * 7) + 15;
      }
    });

    // Separador entre versiones
    if (versiones.length > 1) {
      pdf.setDrawColor(...selectaColors.border);
      pdf.setLineWidth(0.5);
      pdf.line(50, yPos, pageWidth - 50, yPos);
      yPos += 10;
    }

    return yPos;
  };

  // Función auxiliar para calcular totales
  const calculateVersionTotal = (version: any) => {
    return (
      version.items.platos.reduce((sum: number, p: any) => sum + (p.precio_unitario * p.cantidad), 0) +
      version.items.personal.reduce((sum: number, p: any) => sum + (p.tarifa_estimada_por_persona * p.cantidad), 0) +
      version.items.transportes.reduce((sum: number, t: any) => sum + (t.tarifa_unitaria * t.cantidad), 0)
    );
  };

  // Resumen ejecutivo limpio
  const addExecutiveSummary = () => {
    if (versiones.length <= 1) return;

    pdf.addPage();
    createProfessionalHeader();

    let yPos = 80;

    // Título del resumen
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(18);
    pdf.setTextColor(...selectaColors.primary);
    pdf.text('RESUMEN EJECUTIVO', 20, yPos);

    yPos += 20;

    // Fondo del resumen
    pdf.setFillColor(...selectaColors.neutral);
    pdf.roundedRect(20, yPos, pageWidth - 40, 80, 8, 8, 'F');

    yPos += 20;

    // Información del resumen
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(11);
    pdf.setTextColor(...selectaColors.darkText);

    pdf.text(`Opciones presentadas: ${versiones.length}`, 30, yPos);
    yPos += 12;

    const totales = versiones.map(v => calculateVersionTotal(v));
    const minTotal = Math.min(...totales);
    const maxTotal = Math.max(...totales);

    pdf.text('Rango de inversión:', 30, yPos);
    yPos += 8;

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(14);
    pdf.setTextColor(...selectaColors.primary);

    const rangeText = `${new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0
    }).format(minTotal)} - ${new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0
    }).format(maxTotal)}`;

    pdf.text(rangeText, 30, yPos);
    yPos += 20;

    // Recomendación
    const definitiva = versiones.find(v => v.is_definitiva);
    if (definitiva) {
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(10);
      pdf.setTextColor(...selectaColors.accent);
      pdf.text(`Opción recomendada: ${definitiva.nombre_opcion}`, 30, yPos);
    }
  };

  // Footer profesional
  const addProfessionalFooter = () => {
    const footerY = pageHeight - 20;

    // Línea superior
    pdf.setDrawColor(...selectaColors.border);
    pdf.setLineWidth(0.3);
    pdf.line(20, footerY - 5, pageWidth - 20, footerY - 5);

    // Información del footer
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8);
    pdf.setTextColor(...selectaColors.lightText);

    // Fecha
    const date = new Date().toLocaleDateString('es-CO', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    pdf.text(`Generado el ${date}`, 20, footerY);

    // Marca centrada
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(9);
    pdf.setTextColor(...selectaColors.primary);
    const brandText = 'SELECTA EVENTOS';
    const brandWidth = pdf.getTextWidth(brandText);
    pdf.text(brandText, (pageWidth - brandWidth) / 2, footerY);

    // Número de página
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8);
    pdf.setTextColor(...selectaColors.lightText);
    const pageText = `Página ${pdf.internal.getNumberOfPages()}`;
    const pageTextWidth = pdf.getTextWidth(pageText);
    pdf.text(pageText, pageWidth - 20 - pageTextWidth, footerY);
  };

  // GENERACIÓN DEL PDF

  // Primera página
  createProfessionalHeader();
  let currentY = addClientInfo(65);

  // Agregar versiones
  versiones.forEach((version) => {
    currentY = addVersionSection(version, currentY + 15);
  });

  // Agregar resumen ejecutivo si hay múltiples opciones
  addExecutiveSummary();

  // Agregar footer a todas las páginas
  const totalPages = pdf.internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    pdf.setPage(i);
    addProfessionalFooter();
  }

  // Descargar con nombre descriptivo
  const clientName = data.cotizacion.cliente_nombre?.replace(/[^a-zA-Z0-9]/g, '') || 'Cliente';
  const eventName = data.cotizacion.nombre_cotizacion.replace(/[^a-zA-Z0-9]/g, '_');
  const selectedText = selectedVersionIds ? `_${versiones.length}opciones` : '_completa';
  const timestamp = new Date().toISOString().split('T')[0];
  
  const fileName = `SelectaEventos_${clientName}_${eventName}${selectedText}_${timestamp}.pdf`;

  pdf.save(fileName);
}