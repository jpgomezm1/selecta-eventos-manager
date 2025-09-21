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

export async function generatePremiumCotizacionPDF(
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

  // Configuración de colores premium
  const colors = {
    primary: [46, 125, 50],     // Verde Selecta
    secondary: [33, 150, 243],   // Azul elegante
    accent: [255, 193, 7],       // Dorado
    dark: [37, 47, 63],          // Gris oscuro elegante
    light: [248, 250, 252],      // Gris muy claro
    white: [255, 255, 255],
    text: [55, 65, 81],          // Gris texto
    textLight: [107, 114, 128]   // Gris texto claro
  };

  // Cargar logo con mejor calidad
  let logoImg: string = '';
  try {
    const logoUrl = 'https://storage.googleapis.com/cluvi/Web-Risk/logo_selecta.png';
    const response = await fetch(logoUrl);
    const blob = await response.blob();
    logoImg = await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.warn('Logo no disponible:', error);
  }

  // Función para crear encabezado premium
  const createHeader = () => {
    // Fondo degradado del header
    pdf.setFillColor(...colors.primary);
    pdf.rect(0, 0, pageWidth, 60, 'F');

    // Overlay con gradiente simulado
    pdf.setFillColor(255, 255, 255, 0.05);
    pdf.rect(0, 0, pageWidth, 60, 'F');

    // Logo
    if (logoImg) {
      pdf.addImage(logoImg, 'PNG', 25, 15, 50, 25, undefined, 'FAST');
    }

    // Título principal
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(28);
    pdf.setTextColor(...colors.white);
    pdf.text('PROPUESTA DE EVENTOS', logoImg ? 85 : 25, 30);

    // Subtítulo
    pdf.setFontSize(14);
    pdf.setFont('helvetica', 'normal');
    pdf.text('Experiencias Inolvidables', logoImg ? 85 : 25, 42);

    // Línea decorativa
    pdf.setDrawColor(...colors.accent);
    pdf.setLineWidth(2);
    pdf.line(logoImg ? 85 : 25, 48, pageWidth - 25, 48);
  };

  // Función para información del cliente con diseño premium
  const addClientInfo = (yPos: number) => {
    // Card con sombra
    pdf.setFillColor(...colors.light);
    pdf.roundedRect(20, yPos, pageWidth - 40, 50, 8, 8, 'F');

    // Borde elegante
    pdf.setDrawColor(...colors.primary);
    pdf.setLineWidth(0.5);
    pdf.roundedRect(20, yPos, pageWidth - 40, 50, 8, 8, 'S');

    // Título de la sección
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(16);
    pdf.setTextColor(...colors.primary);
    pdf.text('DETALLES DEL EVENTO', 30, yPos + 12);

    // Información en dos columnas
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(10);
    pdf.setTextColor(...colors.text);

    const leftCol = [
      `Cotización: ${data.cotizacion.nombre_cotizacion}`,
      `Cliente: ${data.cotizacion.cliente_nombre || 'Por definir'}`,
      `Invitados: ${data.cotizacion.numero_invitados} personas`,
      `Comercial: ${data.cotizacion.comercial_encargado}`
    ];

    const rightCol = [
      `Fecha: ${data.cotizacion.fecha_evento_estimada ?
        new Date(data.cotizacion.fecha_evento_estimada).toLocaleDateString('es-CO', {
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        }) : 'Por definir'}`,
      `Ubicación: ${data.cotizacion.ubicacion_evento || 'Por definir'}`,
      `Estado: ${data.cotizacion.estado}`,
      `ID: ${data.cotizacion.id.slice(0, 8).toUpperCase()}`
    ];

    leftCol.forEach((text, i) => {
      pdf.text(text, 30, yPos + 25 + (i * 5));
    });

    rightCol.forEach((text, i) => {
      pdf.text(text, pageWidth / 2 + 10, yPos + 25 + (i * 5));
    });

    return yPos + 60;
  };

  // Función para crear sección de opción premium
  const addVersionSection = (version: any, yPos: number) => {
    const sectionHeight = 120; // Altura mínima estimada

    // Verificar si necesitamos nueva página
    if (yPos + sectionHeight > pageHeight - 40) {
      pdf.addPage();
      createHeader();
      yPos = 75;
    }

    // Header de la opción con diseño premium
    const headerHeight = 35;

    // Fondo del header
    if (version.is_definitiva) {
      // Gradiente dorado para definitiva
      pdf.setFillColor(255, 248, 225);
      pdf.roundedRect(20, yPos, pageWidth - 40, headerHeight, 8, 8, 'F');
      pdf.setDrawColor(...colors.accent);
    } else {
      // Gradiente azul para pendientes
      pdf.setFillColor(240, 249, 255);
      pdf.roundedRect(20, yPos, pageWidth - 40, headerHeight, 8, 8, 'F');
      pdf.setDrawColor(...colors.secondary);
    }

    pdf.setLineWidth(2);
    pdf.roundedRect(20, yPos, pageWidth - 40, headerHeight, 8, 8, 'S');

    // Icono de estado
    const iconX = 30;
    const iconY = yPos + 12;
    if (version.is_definitiva) {
      // Estrella para definitiva
      pdf.setFillColor(...colors.accent);
      pdf.circle(iconX, iconY, 6, 'F');
      pdf.setTextColor(...colors.white);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(12);
      pdf.text('★', iconX - 3, iconY + 3);
    } else {
      // Reloj para pendiente
      pdf.setFillColor(...colors.secondary);
      pdf.circle(iconX, iconY, 6, 'F');
      pdf.setTextColor(...colors.white);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(10);
      pdf.text('⏰', iconX - 3, iconY + 3);
    }

    // Título de la opción
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(18);
    pdf.setTextColor(...colors.dark);
    pdf.text(version.nombre_opcion, iconX + 15, yPos + 15);

    // Badge de estado
    if (version.is_definitiva) {
      pdf.setFillColor(...colors.accent);
      pdf.roundedRect(iconX + 15, yPos + 20, 35, 8, 4, 4, 'F');
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(8);
      pdf.setTextColor(...colors.white);
      pdf.text('DEFINITIVA', iconX + 18, yPos + 26);
    }

    // Total destacado
    const total = calculateVersionTotal(version);
    const totalText = new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0
    }).format(total);

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(20);
    pdf.setTextColor(...colors.primary);
    const totalWidth = pdf.getTextWidth(totalText);
    pdf.text(totalText, pageWidth - 30 - totalWidth, yPos + 15);

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(10);
    pdf.setTextColor(...colors.textLight);
    pdf.text('Total de la opción', pageWidth - 30 - totalWidth, yPos + 25);

    yPos += headerHeight + 10;

    // Contenido de las categorías con diseño elegante
    const categories = [
      {
        title: 'EXPERIENCIA GASTRONÓMICA',
        items: version.items.platos,
        color: [255, 152, 0],
        icon: '🍽️'
      },
      {
        title: 'EQUIPO DE PROFESIONALES',
        items: version.items.personal,
        color: [63, 81, 181],
        icon: '👥'
      },
      {
        title: 'LOGÍSTICA ESPECIALIZADA',
        items: version.items.transportes,
        color: [76, 175, 80],
        icon: '🚐'
      }
    ];

    categories.forEach((category) => {
      if (category.items.length > 0) {
        // Header de categoría
        pdf.setFillColor(...category.color, 0.1);
        pdf.roundedRect(25, yPos, pageWidth - 50, 15, 4, 4, 'F');

        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(12);
        pdf.setTextColor(...category.color);
        pdf.text(`${category.icon} ${category.title}`, 30, yPos + 10);

        yPos += 20;

        // Items con diseño elegante
        category.items.forEach((item: any, index: number) => {
          const itemY = yPos + (index * 8);

          // Fondo alternado
          if (index % 2 === 0) {
            pdf.setFillColor(250, 250, 250);
            pdf.rect(25, itemY - 2, pageWidth - 50, 6, 'F');
          }

          let itemText, subtotal;
          if ('nombre' in item) {
            itemText = `${item.nombre}`;
            subtotal = item.precio_unitario * item.cantidad;
          } else if ('rol' in item) {
            itemText = `${item.rol}`;
            subtotal = item.tarifa_estimada_por_persona * item.cantidad;
          } else {
            itemText = `Transporte a ${item.lugar}`;
            subtotal = item.tarifa_unitaria * item.cantidad;
          }

          pdf.setFont('helvetica', 'normal');
          pdf.setFontSize(9);
          pdf.setTextColor(...colors.text);
          pdf.text(`• ${itemText} x${item.cantidad}`, 30, itemY + 2);

          // Precio alineado a la derecha
          const priceText = new Intl.NumberFormat('es-CO', {
            style: 'currency',
            currency: 'COP',
            minimumFractionDigits: 0
          }).format(subtotal);

          pdf.setFont('helvetica', 'bold');
          pdf.setTextColor(...colors.primary);
          const priceWidth = pdf.getTextWidth(priceText);
          pdf.text(priceText, pageWidth - 30 - priceWidth, itemY + 2);
        });

        yPos += (category.items.length * 8) + 10;
      }
    });

    return yPos + 15;
  };

  // Función auxiliar para calcular total
  const calculateVersionTotal = (version: any) => {
    return (
      version.items.platos.reduce((sum: number, p: any) => sum + (p.precio_unitario * p.cantidad), 0) +
      version.items.personal.reduce((sum: number, p: any) => sum + (p.tarifa_estimada_por_persona * p.cantidad), 0) +
      version.items.transportes.reduce((sum: number, t: any) => sum + (t.tarifa_unitaria * t.cantidad), 0)
    );
  };

  // Función para footer premium
  const addFooter = () => {
    const footerY = pageHeight - 25;

    // Línea decorativa
    pdf.setDrawColor(...colors.primary);
    pdf.setLineWidth(1);
    pdf.line(20, footerY - 10, pageWidth - 20, footerY - 10);

    // Texto del footer
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(12);
    pdf.setTextColor(...colors.primary);
    const footerText = 'SELECTA EVENTOS';
    const footerWidth = pdf.getTextWidth(footerText);
    pdf.text(footerText, (pageWidth - footerWidth) / 2, footerY - 2);

    pdf.setFont('helvetica', 'italic');
    pdf.setFontSize(9);
    pdf.setTextColor(...colors.textLight);
    const subFooter = 'Creando experiencias extraordinarias que perduran para siempre';
    const subFooterWidth = pdf.getTextWidth(subFooter);
    pdf.text(subFooter, (pageWidth - subFooterWidth) / 2, footerY + 5);

    // Información adicional
    const date = new Date().toLocaleDateString('es-CO', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8);
    pdf.text(`Generado el ${date}`, 20, footerY + 10);

    const pageInfo = `Página ${pdf.internal.getNumberOfPages()}`;
    const pageInfoWidth = pdf.getTextWidth(pageInfo);
    pdf.text(pageInfo, pageWidth - 20 - pageInfoWidth, footerY + 10);
  };

  // GENERACIÓN DEL PDF

  // Primera página
  createHeader();
  let currentY = addClientInfo(75);

  // Agregar cada versión seleccionada
  versiones.forEach((version, index) => {
    currentY = addVersionSection(version, currentY + 10);
  });

  // Resumen final si hay múltiples opciones
  if (versiones.length > 1) {
    const totalGeneral = versiones.reduce((sum, v) => sum + calculateVersionTotal(v), 0);

    // Nueva página para resumen
    pdf.addPage();
    createHeader();

    // Resumen ejecutivo
    const summaryY = 85;
    pdf.setFillColor(...colors.dark);
    pdf.roundedRect(20, summaryY, pageWidth - 40, 60, 8, 8, 'F');

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(20);
    pdf.setTextColor(...colors.white);
    pdf.text('RESUMEN EJECUTIVO', 30, summaryY + 20);

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(12);
    pdf.text(`Opciones presentadas: ${versiones.length}`, 30, summaryY + 35);

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(16);
    const totalText = `Rango de inversión: ${new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0
    }).format(Math.min(...versiones.map(v => calculateVersionTotal(v))))} - ${new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0
    }).format(Math.max(...versiones.map(v => calculateVersionTotal(v))))}`;

    pdf.text(totalText, 30, summaryY + 50);
  }

  // Agregar footer a todas las páginas
  const totalPages = pdf.internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    pdf.setPage(i);
    addFooter();
  }

  // Descargar con nombre descriptivo
  const selectedText = selectedVersionIds ? `_${versiones.length}opciones` : '_completa';
  const fileName = `Propuesta_${data.cotizacion.nombre_cotizacion.replace(/[^a-zA-Z0-9]/g, '_')}${selectedText}_${new Date().toISOString().split('T')[0]}.pdf`;

  pdf.save(fileName);
}