import { supabase } from "@/integrations/supabase/client";

export async function uploadFactura(file: File, movimientoId: string): Promise<string> {
  const date = new Date().toISOString().slice(0, 10);
  const ext = file.name.split(".").pop() || "jpg";
  const path = `facturas/${date}/${movimientoId}.${ext}`;

  const { error } = await supabase.storage
    .from("facturas")
    .upload(path, file, { upsert: true });

  if (error) throw new Error(`Error subiendo factura: ${error.message}`);
  return path;
}

export async function getFacturaSignedUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from("facturas")
    .createSignedUrl(path, 3600); // 1 hour

  if (error) throw new Error(`Error obteniendo URL de factura: ${error.message}`);
  return data.signedUrl;
}
