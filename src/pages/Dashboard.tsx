import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ProximosEventos } from "@/components/Dashboard/ProximosEventos";
import { AlertasPanel } from "@/components/Dashboard/AlertasPanel";
import { AccionesRapidas } from "@/components/Dashboard/AccionesRapidas";

export default function Dashboard() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-selecta-blue">Dashboard Operativo</h1>
        <p className="text-muted-foreground">Gestión diaria de eventos y personal</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Próximos Eventos - Columna principal */}
        <div className="lg:col-span-2">
          <ProximosEventos />
        </div>

        {/* Sidebar con Alertas y Acciones */}
        <div className="space-y-6">
          <AlertasPanel />
          <AccionesRapidas />
        </div>
      </div>
    </div>
  );
}