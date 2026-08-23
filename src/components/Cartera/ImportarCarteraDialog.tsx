import { useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { FileSpreadsheet, Loader2, Upload } from "lucide-react";
import * as XLSX from "xlsx";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { importarCartera } from "@/integrations/supabase/apiCartera";
import type { EmpresaEmisora, FilaImportacion } from "@/types/cartera";
import { fechaCorta, money } from "./formato";

/**
 * Carga inicial de la cartera desde el Excel que ya usa el cliente.
 *
 * Lee la hoja «Detalle Facturas» tal como viene —los encabezados están en la
 * fila 3, no en la 1— y no le pide al cliente que reformatee nada: son 128
 * facturas que ya existen en un archivo y volver a teclearlas no le agrega
 * información a nadie.
 *
 * El importador es idempotente por (emisora, número): subir el mismo archivo
 * dos veces no duplica, informa cuántas ya estaban.
 *
 * OJO con la columna «Saldo»: la planilla trae el saldo PENDIENTE, no el valor
 * original. Por eso entra como `valor_total` y las importadas nacen sin abonos
 * — los abonos viejos ya están descontados en ese número.
 */

interface Props {
  abierto: boolean;
  onClose: () => void;
  emisoras: EmpresaEmisora[];
}

/** Encabezados de su planilla, normalizados. */
const COL = {
  cliente: ["cliente"],
  documento: ["nit", "documento", "cedula"],
  numero: ["referencia", "factura", "numero"],
  fecha: ["fecha doc.", "fecha doc", "fecha", "fecha emision"],
  saldo: ["saldo", "valor", "total"],
};

function normalizar(s: unknown): string {
  return String(s ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

/** Convierte la fecha venga como venga: serial de Excel, Date o texto ISO. */
function aISO(v: unknown): string | null {
  if (v instanceof Date) {
    const m = String(v.getMonth() + 1).padStart(2, "0");
    const d = String(v.getDate()).padStart(2, "0");
    return `${v.getFullYear()}-${m}-${d}`;
  }
  if (typeof v === "number") {
    const p = XLSX.SSF.parse_date_code(v);
    if (!p) return null;
    return `${p.y}-${String(p.m).padStart(2, "0")}-${String(p.d).padStart(2, "0")}`;
  }
  const t = String(v ?? "").trim();
  const iso = t.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return iso[0];
  const dmy = t.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}`;
  return null;
}

function leerHoja(hoja: XLSX.WorkSheet): FilaImportacion[] {
  const matriz = XLSX.utils.sheet_to_json<unknown[]>(hoja, { header: 1, raw: true });

  // La fila de encabezados no está en la 1: la planilla trae dos líneas de
  // título arriba. Se busca la primera fila que tenga "cliente".
  const iCab = matriz.findIndex((f) =>
    (f ?? []).some((c) => COL.cliente.includes(normalizar(c)))
  );
  if (iCab < 0) return [];

  const cabeceras = (matriz[iCab] ?? []).map(normalizar);
  const idx = (opciones: string[]) => cabeceras.findIndex((c) => opciones.includes(c));
  const iCli = idx(COL.cliente);
  const iDoc = idx(COL.documento);
  const iNum = idx(COL.numero);
  const iFec = idx(COL.fecha);
  const iSal = idx(COL.saldo);

  const filas: FilaImportacion[] = [];
  for (const cruda of matriz.slice(iCab + 1)) {
    if (!cruda || cruda.every((c) => c === null || c === undefined || c === "")) continue;

    const cliente = String(cruda[iCli] ?? "").trim();
    // El NIT viene como número desde el export ("890903995.0").
    const documento = String(cruda[iDoc] ?? "").split(".")[0].trim();
    const numero = String(cruda[iNum] ?? "").trim();
    const fecha = aISO(cruda[iFec]);
    const saldo = Number(String(cruda[iSal] ?? "").replace(/[^\d.-]/g, ""));

    // Filas de totales o de encabezado repetido: no son facturas.
    if (!cliente || !numero) continue;

    const errores: string[] = [];
    if (!documento || !/^\d+$/.test(documento)) errores.push("NIT o cédula inválido");
    if (!fecha) errores.push("Fecha ilegible");
    if (!Number.isFinite(saldo) || saldo <= 0) errores.push("Saldo inválido");

    filas.push({ cliente, documento, numero, fecha: fecha ?? "", saldo: saldo || 0, errores });
  }
  return filas;
}

export default function ImportarCarteraDialog({ abierto, onClose, emisoras }: Props) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [emisora, setEmisora] = useState(emisoras[0]?.nombre ?? "");
  const [nombreArchivo, setNombreArchivo] = useState("");
  const [filas, setFilas] = useState<FilaImportacion[]>([]);

  const validas = filas.filter((f) => f.errores.length === 0);
  const invalidas = filas.filter((f) => f.errores.length > 0);
  const total = validas.reduce((s, f) => s + f.saldo, 0);

  const elegirArchivo = async (archivo: File) => {
    try {
      const wb = XLSX.read(await archivo.arrayBuffer());
      // «Detalle Facturas» si existe; si no, la primera hoja que parezca tenerlo.
      const nombre =
        wb.SheetNames.find((n) => normalizar(n).includes("detalle")) ?? wb.SheetNames[0];
      const leidas = leerHoja(wb.Sheets[nombre]);
      setNombreArchivo(archivo.name);
      setFilas(leidas);
      if (leidas.length === 0) {
        toast({
          title: "No se encontraron facturas",
          description: `La hoja "${nombre}" no tiene una columna Cliente reconocible.`,
          variant: "destructive",
        });
      }
    } catch (e) {
      toast({
        title: "No se pudo leer el archivo",
        description: e instanceof Error ? e.message : "Formato no reconocido",
        variant: "destructive",
      });
    }
  };

  const aplicar = useMutation({
    mutationFn: () =>
      importarCartera(
        emisora,
        validas.map((f) => ({
          cliente: f.cliente,
          documento: f.documento,
          numero: f.numero,
          fecha: f.fecha,
          saldo: f.saldo,
        }))
      ),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ["cartera-facturas"] });
      qc.invalidateQueries({ queryKey: ["cartera-resumen"] });
      toast({
        title: `${r.facturas_creadas} facturas importadas`,
        description:
          `${r.clientes_creados} clientes nuevos` +
          (r.facturas_repetidas > 0 ? ` · ${r.facturas_repetidas} ya estaban y se saltaron` : ""),
      });
      setFilas([]);
      setNombreArchivo("");
      onClose();
    },
    onError: (e: Error) =>
      toast({ title: "No se pudo importar", description: e.message, variant: "destructive" }),
  });

  return (
    <Dialog open={abierto} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Importar cartera desde Excel</DialogTitle>
          <DialogDescription>
            Sube el archivo tal como lo tienes. Se lee la hoja «Detalle Facturas» y se importa
            el <strong>saldo pendiente</strong> de cada factura. Subir el mismo archivo dos veces
            no duplica nada.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 sm:grid-cols-[200px_minmax(0,1fr)] sm:items-end">
          <div>
            <Label className="text-xs text-muted-foreground">Empresa que factura</Label>
            <select
              value={emisora}
              onChange={(e) => setEmisora(e.target.value)}
              className="h-10 w-full rounded-md border border-input bg-background px-2 text-sm"
            >
              {emisoras.map((e) => (
                <option key={e.id} value={e.nombre}>
                  {e.nombre}
                </option>
              ))}
            </select>
          </div>
          <div>
            <input
              ref={inputRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void elegirArchivo(f);
                e.target.value = "";
              }}
            />
            <Button variant="outline" className="w-full" onClick={() => inputRef.current?.click()}>
              <Upload className="mr-2 h-4 w-4" />
              {nombreArchivo || "Elegir archivo…"}
            </Button>
          </div>
        </div>

        {filas.length > 0 && (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary">{validas.length} listas</Badge>
              {invalidas.length > 0 && (
                <Badge variant="destructive">{invalidas.length} con problemas</Badge>
              )}
              <span className="text-sm tabular-nums text-muted-foreground">
                · {money(total)} a importar
              </span>
            </div>

            <div className="max-h-80 overflow-y-auto rounded-md border border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Factura</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>NIT</TableHead>
                    <TableHead>Fecha</TableHead>
                    <TableHead className="text-right">Saldo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filas.slice(0, 200).map((f, i) => (
                    <TableRow key={`${f.numero}-${i}`} className={f.errores.length ? "bg-destructive/5" : undefined}>
                      <TableCell className="font-medium">{f.numero}</TableCell>
                      <TableCell className="max-w-[16rem] truncate">{f.cliente}</TableCell>
                      <TableCell className="tabular-nums">{f.documento || "—"}</TableCell>
                      <TableCell className="tabular-nums">{fechaCorta(f.fecha)}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {money(f.saldo)}
                        {f.errores.length > 0 && (
                          <div className="text-xs text-destructive">{f.errores.join(" · ")}</div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {invalidas.length > 0 && (
              <p className="text-sm text-muted-foreground">
                Las filas con problemas se ignoran. Se importan solo las {validas.length} válidas.
              </p>
            )}
          </>
        )}

        {filas.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-10 text-muted-foreground">
            <FileSpreadsheet className="h-8 w-8" strokeWidth={1.5} />
            <p className="text-sm">Elige un archivo para ver qué se va a importar.</p>
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button disabled={validas.length === 0 || aplicar.isPending} onClick={() => aplicar.mutate()}>
            {aplicar.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Importar {validas.length} facturas
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
