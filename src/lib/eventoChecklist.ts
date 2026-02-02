export interface ChecklistItem {
  key: string;
  label: string;
  completed: boolean;
  tab?: string; // tab to navigate to when clicked
}

export interface ChecklistResult {
  items: ChecklistItem[];
  completedCount: number;
  totalCount: number;
  percent: number;
}

export interface ChecklistData {
  personalAsignadoCount: number;
  personalRequeridoCount: number;
  ordenCompra: { estado: string } | null;
  menajeReserva: { estado: string } | null;
  transporteOrden: { estado: string } | null;
  fechaEvento: string;
  estadoLiquidacion: string;
  ingredientesDespachados: boolean;
  menajeDespachado: boolean;
}

export function computeChecklist(data: ChecklistData): ChecklistResult {
  const items: ChecklistItem[] = [
    {
      key: "personal_asignado",
      label: "Personal asignado",
      completed: data.personalRequeridoCount > 0
        ? data.personalAsignadoCount >= data.personalRequeridoCount
        : data.personalAsignadoCount > 0,
      tab: "personal",
    },
    {
      key: "orden_compra_generada",
      label: "Orden de compra generada",
      completed: !!data.ordenCompra && data.ordenCompra.estado !== "cancelada",
      tab: "compras",
    },
    {
      key: "orden_compra_completada",
      label: "Compras realizadas",
      completed: data.ordenCompra?.estado === "comprada",
      tab: "compras",
    },
    {
      key: "menaje_confirmado",
      label: "Menaje confirmado",
      completed: data.menajeReserva?.estado === "confirmado" || data.menajeReserva?.estado === "devuelto",
      tab: "menaje",
    },
    {
      key: "ingredientes_despachados",
      label: "Ingredientes despachados",
      completed: data.ingredientesDespachados,
      tab: "compras",
    },
    {
      key: "transporte_programado",
      label: "Transporte programado",
      completed: data.transporteOrden?.estado === "programado" || data.transporteOrden?.estado === "finalizado",
      tab: "transporte",
    },
    {
      key: "menaje_despachado",
      label: "Menaje despachado",
      completed: data.menajeDespachado,
      tab: "menaje",
    },
    {
      key: "evento_ejecutado",
      label: "Evento ejecutado",
      completed: new Date(data.fechaEvento + "T23:59:59") < new Date(),
      tab: "requerimientos",
    },
    {
      key: "menaje_devuelto",
      label: "Menaje devuelto",
      completed: data.menajeReserva?.estado === "devuelto",
      tab: "menaje",
    },
    {
      key: "personal_liquidado",
      label: "Personal liquidado",
      completed: data.estadoLiquidacion === "liquidado",
      tab: "financiero",
    },
  ];

  const completedCount = items.filter((i) => i.completed).length;
  return {
    items,
    completedCount,
    totalCount: items.length,
    percent: Math.round((completedCount / items.length) * 100),
  };
}
