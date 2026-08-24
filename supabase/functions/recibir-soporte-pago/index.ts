import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * Webhook de AgentMail: recibe los soportes de pago que los comerciales mandan
 * al buzón y los deja en la bandeja `soportes_pago`.
 *
 * Corre SIN JWT (`verify_jwt = false` en config.toml) porque quien llama es
 * AgentMail, no un usuario. Lo que autoriza es la firma Svix del webhook — sin
 * verificarla, cualquiera que descubra la URL puede inyectar comprobantes
 * falsos en la bandeja de cobranza.
 *
 * Dos cosas de la documentación de AgentMail que definen este código:
 *
 *  - EL ADJUNTO NO VIENE EN EL PAYLOAD. El webhook trae solo metadatos
 *    (`attachment_id`, `filename`, `content_type`, `size`) porque el payload
 *    está capado a 1 MB. Hay que pedir la URL de descarga a la API con la key
 *    y bajarlo aparte. Por eso se guardan `thread_id` y `attachment_id`: si la
 *    descarga falla, se puede reintentar sin haber perdido el correo.
 *
 *  - SVIX REINTENTA. Un webhook que responde error se reenvía con el mismo
 *    mensaje. La idempotencia va por el índice único sobre `message_id`: un
 *    reintento actualiza en vez de crear un soporte duplicado, que es el error
 *    caro acá (alguien concilia el mismo pago dos veces).
 *
 * NO lee el comprobante con IA. Eso pasa después, bajo demanda, cuando alguien
 * abre el soporte para conciliarlo: así el spam que llegue al buzón no quema
 * tokens y la llamada queda bajo el rate-limit por usuario que ya existe.
 *
 * Variables de entorno (secrets del proyecto Supabase):
 *   AGENTMAIL_WEBHOOK_SECRET  el `whsec_...` que devuelve webhooks.create
 *   AGENTMAIL_API_KEY         para bajar los adjuntos
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, svix-id, svix-timestamp, svix-signature",
};

function jsonResponse(body: Record<string, unknown>, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/** Comparación en tiempo constante: comparar firmas con === filtra por timing. */
function igualesEnTiempoConstante(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let dif = 0;
  for (let i = 0; i < a.length; i++) dif |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return dif === 0;
}

function base64ABytes(b64: string): Uint8Array {
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

/**
 * Verificación Svix, implementada a mano.
 *
 * El algoritmo está documentado y es corto; traer la librería `svix` a Deno
 * agrega una dependencia npm a una edge function por menos de 30 líneas.
 *
 * Se firma exactamente `{svix-id}.{svix-timestamp}.{body crudo}` con
 * HMAC-SHA256 y la clave que va después de `whsec_`, en base64.
 */
async function firmaValida(
  secreto: string,
  svixId: string,
  svixTimestamp: string,
  svixSignature: string,
  cuerpoCrudo: string
): Promise<boolean> {
  // Ventana de 5 minutos: sin esto, una petición capturada se puede reenviar
  // para siempre.
  const ahora = Math.floor(Date.now() / 1000);
  const ts = Number(svixTimestamp);
  if (!Number.isFinite(ts) || Math.abs(ahora - ts) > 300) return false;

  const clave = await crypto.subtle.importKey(
    "raw",
    base64ABytes(secreto.replace(/^whsec_/, "")),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const firmado = `${svixId}.${svixTimestamp}.${cuerpoCrudo}`;
  const mac = await crypto.subtle.sign("HMAC", clave, new TextEncoder().encode(firmado));
  const esperada = btoa(String.fromCharCode(...new Uint8Array(mac)));

  // El header trae varias firmas separadas por espacio ("v1,xxx v1,yyy"):
  // durante una rotación de secreto conviven la vieja y la nueva.
  return svixSignature
    .split(" ")
    .map((p) => p.split(",")[1] ?? "")
    .some((f) => f && igualesEnTiempoConstante(f, esperada));
}

const EXT_OK = ["pdf", "png", "jpg", "jpeg", "webp"];
const MAX_BYTES = 10 * 1024 * 1024;

/** Baja un adjunto de AgentMail. Devuelve null si no se pudo. */
async function bajarAdjunto(
  apiKey: string,
  threadId: string,
  attachmentId: string
): Promise<{ bytes: Uint8Array; filename: string; contentType: string } | null> {
  try {
    const meta = await fetch(
      `https://api.agentmail.to/v0/threads/${threadId}/attachments/${attachmentId}`,
      { headers: { Authorization: `Bearer ${apiKey}` } }
    );
    if (!meta.ok) {
      console.error("[soporte-pago] AgentMail respondió", meta.status, await meta.text());
      return null;
    }
    const info = await meta.json();
    if (!info?.download_url) return null;

    const archivo = await fetch(info.download_url);
    if (!archivo.ok) return null;
    const bytes = new Uint8Array(await archivo.arrayBuffer());

    if (bytes.byteLength > MAX_BYTES) {
      console.warn("[soporte-pago] adjunto descartado por tamaño:", bytes.byteLength);
      return null;
    }
    return {
      bytes,
      filename: info.filename ?? `${attachmentId}.bin`,
      contentType: info.content_type ?? "application/octet-stream",
    };
  } catch (e) {
    console.error("[soporte-pago] error bajando adjunto:", e);
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  const secreto = Deno.env.get("AGENTMAIL_WEBHOOK_SECRET");
  const apiKey = Deno.env.get("AGENTMAIL_API_KEY");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!secreto || !supabaseUrl || !serviceRoleKey) {
    // Sin secreto no se puede verificar nada: es preferible perder correos a
    // dejar la bandeja de cobranza abierta.
    console.error("[soporte-pago] faltan variables de entorno");
    return jsonResponse({ error: "Función no configurada" }, 500);
  }

  // El cuerpo se lee CRUDO: la firma es sobre los bytes exactos, así que
  // parsear antes de verificar invalidaría la comparación.
  const cuerpoCrudo = await req.text();
  const svixId = req.headers.get("svix-id") ?? "";
  const svixTs = req.headers.get("svix-timestamp") ?? "";
  const svixSig = req.headers.get("svix-signature") ?? "";

  if (!svixId || !svixTs || !svixSig) {
    return jsonResponse({ error: "Faltan headers de firma" }, 401);
  }
  if (!(await firmaValida(secreto, svixId, svixTs, svixSig, cuerpoCrudo))) {
    console.warn("[soporte-pago] firma inválida, svix-id:", svixId);
    return jsonResponse({ error: "Firma inválida" }, 401);
  }

  let evento: Record<string, unknown>;
  try {
    evento = JSON.parse(cuerpoCrudo);
  } catch {
    return jsonResponse({ error: "Cuerpo no es JSON válido" }, 400);
  }

  const tipo = String(evento.event_type ?? "");
  if (tipo !== "message.received") {
    // Se responde 200 a propósito: un evento que no nos interesa no es un
    // error, y devolver 4xx haría que Svix lo reintente para siempre.
    return jsonResponse({ ok: true, ignorado: tipo }, 200);
  }

  const msg = (evento.message ?? {}) as Record<string, unknown>;
  const messageId = msg.message_id ? String(msg.message_id) : null;
  const threadId = msg.thread_id ? String(msg.thread_id) : null;
  const remitente = Array.isArray(msg.from_) ? String(msg.from_[0] ?? "") : (msg.from_ as string) ?? null;
  const adjuntos = Array.isArray(msg.attachments) ? (msg.attachments as Record<string, unknown>[]) : [];

  const admin = createClient(supabaseUrl, serviceRoleKey);

  // El primer adjunto utilizable es el comprobante; los demás suelen ser
  // firmas y logos del pie del correo.
  const candidato = adjuntos.find((a) => {
    if (a.inline) return false;
    const ext = String(a.filename ?? "").split(".").pop()?.toLowerCase() ?? "";
    return EXT_OK.includes(ext);
  });

  let archivoUrl: string | null = null;
  let archivoNombre: string | null = candidato ? String(candidato.filename ?? "") : null;
  const attachmentId = candidato ? String(candidato.attachment_id ?? "") : null;

  if (candidato && apiKey && threadId && attachmentId) {
    const bajado = await bajarAdjunto(apiKey, threadId, attachmentId);
    if (bajado) {
      const hoy = new Date().toISOString().slice(0, 10);
      const ruta = `${hoy}/${crypto.randomUUID()}-${bajado.filename.replace(/[^\w.-]/g, "_")}`;
      const { error: upErr } = await admin.storage
        .from("soportes-pago")
        .upload(ruta, bajado.bytes, { contentType: bajado.contentType, upsert: false });
      if (upErr) {
        // Perder el adjunto no debe hacer que se pierda el aviso de que
        // alguien pagó: el soporte entra igual y queda el attachment_id para
        // reintentar la descarga.
        console.error("[soporte-pago] falló la subida:", upErr.message);
      } else {
        archivoUrl = ruta;
        archivoNombre = bajado.filename;
      }
    }
  } else if (candidato && !apiKey) {
    console.warn("[soporte-pago] hay adjunto pero falta AGENTMAIL_API_KEY");
  }

  const fila = {
    message_id: messageId,
    thread_id: threadId,
    inbox_id: msg.inbox_id ? String(msg.inbox_id) : null,
    attachment_id: attachmentId,
    remitente,
    asunto: msg.subject ? String(msg.subject) : null,
    cuerpo: String(msg.text ?? msg.preview ?? "").slice(0, 4000) || null,
    archivo_url: archivoUrl,
    archivo_nombre: archivoNombre,
    recibido_at: msg.timestamp ? String(msg.timestamp) : new Date().toISOString(),
  };

  // upsert por message_id: un reintento de Svix actualiza en vez de duplicar.
  const { data, error } = messageId
    ? await admin.from("soportes_pago").upsert(fila, { onConflict: "message_id" }).select("id").single()
    : await admin.from("soportes_pago").insert(fila).select("id").single();

  if (error) {
    console.error("[soporte-pago] falló el insert:", error.message);
    // 500 para que Svix reintente: el correo existe y todavía se puede salvar.
    return jsonResponse({ error: "No se pudo registrar el soporte" }, 500);
  }

  return jsonResponse({ ok: true, id: data.id, con_adjunto: Boolean(archivoUrl) }, 200);
});
