import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FileSpreadsheet, LayoutList, Mail, Plus, Table2, Upload } from "lucide-react";

import { PageHeader } from "@/components/Layout/PageHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useCan } from "@/hooks/useCan";
import {
  getResumenCartera,
  listEmpresasEmisoras,
  listFacturas,
} from "@/integrations/supabase/apiCartera";
import type { FacturaCartera } from "@/types/cartera";
import ResumenEjecutivo from "@/components/Cartera/ResumenEjecutivo";
import MatrizEdades from "@/components/Cartera/MatrizEdades";
import TablaFacturas from "@/components/Cartera/TablaFacturas";
import AbonoDialog from "@/components/Cartera/AbonoDialog";
import FacturaDialog from "@/components/Cartera/FacturaDialog";
import ImportarCarteraDialog from "@/components/Cartera/ImportarCarteraDialog";
import BandejaSoportes from "@/components/Cartera/BandejaSoportes";
import { hoyISO } from "@/components/Cartera/formato";

/**
 * Cartera (`/cartera`).
 *
 * Replica las tres vistas del informe que el cliente ya lleva en Excel —resumen
 * ejecutivo, matriz por edades y detalle de facturas— sobre los mismos datos,
 * para que la conversación no empiece discutiendo si los números están bien.
 *
 * El filtro por empresa emisora está arriba y no dentro de cada pestaña: Selecta
 * e Isabela son libros con clientes distintos, y mirar el consolidado o uno solo
 * es la primera decisión que se toma al abrir la pantalla, no la última.
 */

export default function CarteraPage() {
  const can = useCan();
  const puedeGestionar = can(["admin"]);
  const puedeAbonar = can(["admin", "comercial"]);

  const [emisoraId, setEmisoraId] = useState<string | null>(null);
  const [fechaCorte, setFechaCorte] = useState(hoyISO());
  const [abonando, setAbonando] = useState<FacturaCartera | null>(null);
  const [creando, setCreando] = useState(false);
  const [importando, setImportando] = useState(false);

  const { data: emisoras = [] } = useQuery({
    queryKey: ["cartera-emisoras"],
    queryFn: listEmpresasEmisoras,
  });

  const { data: resumen, isLoading: cargandoResumen } = useQuery({
    queryKey: ["cartera-resumen", fechaCorte, emisoraId],
    queryFn: () => getResumenCartera(fechaCorte, emisoraId),
  });

  const { data: facturas = [], isLoading: cargandoFacturas } = useQuery({
    queryKey: ["cartera-facturas", emisoraId],
    queryFn: () => listFacturas(emisoraId),
  });

  return (
    <div className="space-y-8">
      <PageHeader
        kicker="Finanzas"
        title="Cartera"
        description="Qué está pendiente de cobro, hace cuánto y de quién."
        actions={
          puedeGestionar ? (
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setImportando(true)}>
                <Upload className="mr-2 h-4 w-4" />
                Importar Excel
              </Button>
              <Button onClick={() => setCreando(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Registrar factura
              </Button>
            </div>
          ) : undefined
        }
      />

      <div className="flex flex-wrap items-end gap-4 border-y border-border py-4">
        <div>
          <div className="kicker mb-1.5">Empresa</div>
          <div className="flex items-center gap-0.5 rounded-md bg-muted p-1">
            <button
              type="button"
              onClick={() => setEmisoraId(null)}
              aria-pressed={emisoraId === null}
              className={`rounded-sm px-3 py-1.5 text-sm transition-colors ${
                emisoraId === null
                  ? "bg-background font-semibold text-foreground shadow-soft"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Consolidado
            </button>
            {emisoras.map((e) => (
              <button
                key={e.id}
                type="button"
                onClick={() => setEmisoraId(e.id)}
                aria-pressed={emisoraId === e.id}
                className={`rounded-sm px-3 py-1.5 text-sm transition-colors ${
                  emisoraId === e.id
                    ? "bg-background font-semibold text-foreground shadow-soft"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {e.nombre}
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="kicker mb-1.5">Fecha de corte</div>
          <input
            type="date"
            value={fechaCorte}
            onChange={(e) => setFechaCorte(e.target.value)}
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          />
        </div>
      </div>

      <Tabs defaultValue="resumen" className="w-full">
        <TabsList className="grid w-full max-w-3xl grid-cols-4 bg-muted/60 p-1">
          <TabsTrigger
            value="resumen"
            className="flex items-center gap-2 text-[12.5px] font-medium data-[state=active]:bg-card data-[state=active]:shadow-soft"
          >
            <LayoutList className="h-3.5 w-3.5" strokeWidth={1.75} /> Resumen
          </TabsTrigger>
          <TabsTrigger
            value="edades"
            className="flex items-center gap-2 text-[12.5px] font-medium data-[state=active]:bg-card data-[state=active]:shadow-soft"
          >
            <Table2 className="h-3.5 w-3.5" strokeWidth={1.75} /> Por edades
          </TabsTrigger>
          <TabsTrigger
            value="facturas"
            className="flex items-center gap-2 text-[12.5px] font-medium data-[state=active]:bg-card data-[state=active]:shadow-soft"
          >
            <FileSpreadsheet className="h-3.5 w-3.5" strokeWidth={1.75} /> Facturas
          </TabsTrigger>
          <TabsTrigger
            value="soportes"
            className="flex items-center gap-2 text-[12.5px] font-medium data-[state=active]:bg-card data-[state=active]:shadow-soft"
          >
            <Mail className="h-3.5 w-3.5" strokeWidth={1.75} /> Soportes
          </TabsTrigger>
        </TabsList>

        <TabsContent value="resumen" className="mt-6">
          {cargandoResumen || !resumen ? (
            <Skeleton className="h-64 w-full" />
          ) : resumen.totales.facturas === 0 ? (
            <Vacio puedeGestionar={puedeGestionar} onImportar={() => setImportando(true)} />
          ) : (
            <ResumenEjecutivo resumen={resumen} />
          )}
        </TabsContent>

        <TabsContent value="edades" className="mt-6">
          {cargandoResumen || !resumen ? (
            <Skeleton className="h-64 w-full" />
          ) : (
            <MatrizEdades resumen={resumen} />
          )}
        </TabsContent>

        <TabsContent value="facturas" className="mt-6">
          {cargandoFacturas ? (
            <Skeleton className="h-64 w-full" />
          ) : (
            <TablaFacturas
              facturas={facturas}
              onAbonar={setAbonando}
              puedeAbonar={puedeAbonar}
            />
          )}
        </TabsContent>

        {/* La bandeja vive dentro de Cartera y no como pantalla aparte porque
            necesita las facturas para empatar cada comprobante contra un saldo. */}
        <TabsContent value="soportes" className="mt-6">
          <BandejaSoportes facturas={facturas} />
        </TabsContent>
      </Tabs>

      <AbonoDialog factura={abonando} onClose={() => setAbonando(null)} />
      <FacturaDialog
        abierto={creando}
        onClose={() => setCreando(false)}
        emisoras={emisoras}
      />
      <ImportarCarteraDialog
        abierto={importando}
        onClose={() => setImportando(false)}
        emisoras={emisoras}
      />
    </div>
  );
}

function Vacio({
  puedeGestionar,
  onImportar,
}: {
  puedeGestionar: boolean;
  onImportar: () => void;
}) {
  return (
    <div className="py-16 text-center">
      <p className="font-serif text-xl">Todavía no hay facturas cargadas</p>
      <p className="mx-auto mt-3 max-w-[52ch] text-muted-foreground">
        Si ya llevan la cartera en Excel, súbanla tal como está: se lee la hoja de detalle y
        quedan todas las facturas con su cliente y su saldo.
      </p>
      {puedeGestionar && (
        <Button className="mt-6" onClick={onImportar}>
          <Upload className="mr-2 h-4 w-4" />
          Importar desde Excel
        </Button>
      )}
    </div>
  );
}
