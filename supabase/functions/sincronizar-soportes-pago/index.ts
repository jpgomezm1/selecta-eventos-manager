/**
 * Sincroniza los soportes de pago que llegan al buzón de AgentMail.
 *
 * Corre por cron (pg_cron cada 10 min) en vez de por webhook. La razón no es
 * solo que sea más simple:
 *
 *   - Un webhook que falla se pierde en silencio. Acá cada corrida vuelve a
 *     mirar la ventana completa, así que un correo que no entró hoy entra en la
 *     siguiente pasada. En una bandeja de cobranza, un soporte perdido es un
 *     pago que nadie registra.
 *   - No hay endpoint público sin autenticar. Esta función exige JWT y solo la
 *     llama el cron con la service role key.
 *   - Un secreto en vez de dos: no hace falta el `whsec_` de Svix.
 *   - Un solo camino de escritura hacia `soportes_pago`. Dos caminos
 *     escribiendo la misma tabla es justo el problema que se cerró en el
 *     inventario de menaje.
 *
 * Lo que lo hace exactamente-una-vez es el índice único parcial sobre
 * `message_id`: la ventana de consulta se solapa a propósito y los repetidos
 * chocan contra el índice en vez de duplicarse.
 *
 * Variables de entorno:
 *   AGENTMAIL_API_KEY    key de AgentMail (alcance inbox basta)
 *   AGENTMAIL_INBOX_ID   buzón a sincronizar (default selecta@agentmail.to)
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const API = "https://api.agentmail.to/v0";
const INBOX_DEFAULT = "selecta@agentmail.to";

/** Se relee una ventana que ya se leyó: cubre desorden de llegada y desfase de
 *  reloj. Lo repetido lo frena el índice único, así que sobra barato. */
const SOLAPE_MS = 60 * 60 * 1000;
/** Primera corrida, con la tabla vacía: hasta dónde mirar hacia atrás. */
const ARRANQUE_DIAS = 30;

const MAX_BYTES = 10 * 1024 * 1024;
const EXT_OK = ["pdf", "png", "jpg", "jpeg", "webp"];

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

interface AdjuntoMeta {
  attachment_id?: string;
  filename?: string;
  content_type?: string;
  content_disposition?: string;
}

interface MensajeLista {
  message_id: string;
  thread_id?: string;
  inbox_id?: string;
  timestamp?: string;
  subject?: string;
  preview?: string;
  from?: string | string[];
  attachments?: AdjuntoMeta[];
}

function encabezados(apiKey: string) {
  return { Authorization: `Bearer ${apiKey}` };
}

/** El `from` viene como string o como lista según el mensaje. */
function remitenteDe(m: { from?: string | string[] }): string | null {
  const f = Array.isArray(m.from) ? m.from[0] : m.from;
  return f ? String(f) : null;
}

/**
 * Elige el adjunto que parece un comprobante. Descarta los inline, que son las
 * firmas y los logos del pie del correo.
 */
function elegirAdjunto(adjuntos: AdjuntoMeta[]): AdjuntoMeta | null {
  return (
    adjuntos.find((a) => {
      if (a.content_disposition === "inline") return false;
      const ext = String(a.filename ?? "").split(".").pop()?.toLowerCase() ?? "";
      return EXT_OK.includes(ext);
    }) ?? null
  );
}

async function bajarAdjunto(
  apiKey: string,
  inboxId: string,
  messageId: string,
  attachmentId: string
): Promise<{ bytes: Uint8Array; filename: string; contentType: string } | null> {
  try {
    const meta = await fetch(
      `${API}/inboxes/${encodeURIComponent(inboxId)}/messages/${messageId}/attachments/${attachmentId}`,
      { headers: encabezados(apiKey) }
    );
    if (!meta.ok) {
      console.error("[soportes] adjunto:", meta.status, await meta.text());
      return null;
    }
    const info = await meta.json();
    if (!info?.download_url) return null;

    const archivo = await fetch(info.download_url);
    if (!archivo.ok) return null;
    const bytes = new Uint8Array(await archivo.arrayBuffer());

    if (bytes.byteLength > MAX_BYTES) {
      console.warn("[soportes] adjunto descartado por tamaño:", bytes.byteLength);
      return null;
    }
    return {
      bytes,
      filename: info.filename ?? `${attachmentId}.bin`,
      contentType: info.content_type ?? "application/octet-stream",
    };
  } catch (e) {
    console.error("[soportes] error bajando adjunto:", e);
    return null;
  }
}

/** El listado no trae el cuerpo, solo un preview. Para la bandeja sirve el
 *  texto completo, pero si esta llamada falla el preview alcanza. */
async function cuerpoDe(
  apiKey: string,
  inboxId: string,
  messageId: string
): Promise<string | null> {
  try {
    const r = await fetch(
      `${API}/inboxes/${encodeURIComponent(inboxId)}/messages/${messageId}`,
      { headers: encabezados(apiKey) }
    );
    if (!r.ok) return null;
    const m = await r.json();
    return m?.text ? String(m.text) : null;
  } catch {
    return null;
  }
}

/** Comparación en tiempo constante: no filtrar el secreto por el tiempo que
 *  tarda en fallar. */
function igualesEnTiempoConstante(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let dif = 0;
  for (let i = 0; i < a.length; i++) dif |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return dif === 0;
}

Deno.serve(async (req) => {
  if (req.method !== "POST" && req.method !== "GET") {
    return json({ error: "Method not allowed" }, 405);
  }

  // `verify_jwt` deja pasar cualquier JWT válido del proyecto, y la anon key
  // viaja en el bundle del frontend: sin esto, cualquiera podría disparar la
  // sincronización a repetición y quemar la cuota de AgentMail. Solo el cron,
  // que llama con la service role key, tiene por qué entrar acá.
  const servicio = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!servicio || !igualesEnTiempoConstante(token, servicio)) {
    return json({ error: "Solo el cron puede disparar la sincronización" }, 403);
  }

  const apiKey = Deno.env.get("AGENTMAIL_API_KEY");
  if (!apiKey) {
    // Falla cerrada: sin key no hay nada que sincronizar y es mejor gritarlo
    // que quedarse corriendo en silencio sin traer nada.
    return json({ error: "Falta AGENTMAIL_API_KEY" }, 500);
  }
  const inboxId = Deno.env.get("AGENTMAIL_INBOX_ID") ?? INBOX_DEFAULT;

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } }
  );

  // ---------------------------------------------------------------- desde
  const { data: ultimo } = await admin
    .from("soportes_pago")
    .select("recibido_at")
    .order("recibido_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const desde = ultimo?.recibido_at
    ? new Date(new Date(ultimo.recibido_at).getTime() - SOLAPE_MS)
    : new Date(Date.now() - ARRANQUE_DIAS * 24 * 60 * 60 * 1000);

  // ---------------------------------------------------------------- listar
  const mensajes: MensajeLista[] = [];
  let pageToken: string | null = null;
  let vueltas = 0;

  do {
    const q = new URLSearchParams({
      limit: "100",
      ascending: "true",
      after: desde.toISOString(),
    });
    if (pageToken) q.set("page_token", pageToken);

    const r = await fetch(
      `${API}/inboxes/${encodeURIComponent(inboxId)}/messages?${q}`,
      { headers: encabezados(apiKey) }
    );
    if (!r.ok) {
      const detalle = await r.text();
      console.error("[soportes] listado:", r.status, detalle);
      return json({ error: "AgentMail rechazó el listado", status: r.status, detalle }, 502);
    }
    const body = await r.json();
    mensajes.push(...((body?.messages ?? []) as MensajeLista[]));
    pageToken = body?.next_page_token ?? null;
    vueltas += 1;
  } while (pageToken && vueltas < 10);

  if (mensajes.length === 0) {
    return json({ ok: true, desde: desde.toISOString(), revisados: 0, nuevos: 0 });
  }

  // Los ya guardados se descartan antes de gastar llamadas en cuerpo y adjunto.
  const ids = mensajes.map((m) => m.message_id).filter(Boolean);
  const { data: existentes } = await admin
    .from("soportes_pago")
    .select("message_id")
    .in("message_id", ids);
  const yaEstan = new Set((existentes ?? []).map((e) => e.message_id));

  const nuevos = mensajes.filter((m) => m.message_id && !yaEstan.has(m.message_id));

  // ---------------------------------------------------------------- guardar
  let guardados = 0;
  let conAdjunto = 0;
  const fallidos: string[] = [];

  for (const m of nuevos) {
    const candidato = elegirAdjunto(m.attachments ?? []);
    const attachmentId = candidato?.attachment_id ?? null;

    let archivoUrl: string | null = null;
    let archivoNombre: string | null = candidato?.filename ?? null;

    if (attachmentId) {
      const bajado = await bajarAdjunto(apiKey, inboxId, m.message_id, attachmentId);
      if (bajado) {
        const hoy = new Date().toISOString().slice(0, 10);
        const ruta = `${hoy}/${crypto.randomUUID()}-${bajado.filename.replace(/[^\w.-]/g, "_")}`;
        const { error: upErr } = await admin.storage
          .from("soportes-pago")
          .upload(ruta, bajado.bytes, { contentType: bajado.contentType, upsert: false });
        if (upErr) {
          // Perder el archivo no debe hacer que se pierda el aviso de que
          // alguien pagó: el soporte entra igual y queda el attachment_id
          // para reintentar la descarga.
          console.error("[soportes] falló la subida:", upErr.message);
        } else {
          archivoUrl = ruta;
          archivoNombre = bajado.filename;
          conAdjunto += 1;
        }
      }
    }

    const texto = await cuerpoDe(apiKey, inboxId, m.message_id);

    const { error } = await admin.from("soportes_pago").upsert(
      {
        message_id: m.message_id,
        thread_id: m.thread_id ?? null,
        inbox_id: m.inbox_id ?? inboxId,
        attachment_id: attachmentId,
        remitente: remitenteDe(m),
        asunto: m.subject ?? null,
        cuerpo: (texto ?? m.preview ?? "").slice(0, 4000) || null,
        archivo_url: archivoUrl,
        archivo_nombre: archivoNombre,
        recibido_at: m.timestamp ?? new Date().toISOString(),
      },
      { onConflict: "message_id" }
    );

    if (error) {
      // Un correo que falle no debe tumbar la corrida entera: los demás se
      // guardan y este vuelve a intentarse en la siguiente pasada.
      console.error("[soportes] falló el guardado de", m.message_id, error.message);
      fallidos.push(m.message_id);
    } else {
      guardados += 1;
    }
  }

  return json({
    ok: true,
    desde: desde.toISOString(),
    revisados: mensajes.length,
    nuevos: guardados,
    con_adjunto: conAdjunto,
    fallidos,
  });
});
