import { useState, useEffect } from "react";
import { Users, Calendar, TrendingUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Personal, Evento } from "@/types/database";

export default function Dashboard() {
  const [personal, setPersonal] = useState<Personal[]>([]);
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [personalData, eventosData] = await Promise.all([
        supabase.from("personal").select("*"),
        supabase.from("eventos").select("*").gte("fecha_evento", new Date().toISOString().split('T')[0])
      ]);

      setPersonal(personalData.data as Personal[] || []);
      setEventos(eventosData.data as Evento[] || []);
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-selecta-blue">Dashboard</h1>
        <p className="text-muted-foreground">Resumen general de Selecta Eventos</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Personal Total</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">{personal.length}</div>
            <p className="text-xs text-muted-foreground">personal registrado</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Próximos Eventos</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-secondary">{eventos.length}</div>
            <p className="text-xs text-muted-foreground">eventos programados</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Sistema</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-accent">Activo</div>
            <p className="text-xs text-muted-foreground">funcionando correctamente</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}