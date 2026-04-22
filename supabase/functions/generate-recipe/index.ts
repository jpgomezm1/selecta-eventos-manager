import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Rate-limit: ventana de 60s por usuario+función. 20 llamadas/min para
// generación de recetas (texto corto), 5 llamadas/min si el body incluye
// imagen/PDF (scan de factura) porque consume muchos más tokens.
const WINDOW_SECONDS = 60;
const LIMIT_TEXT = 20;
const LIMIT_ATTACHMENT = 5;

type MessageContent = { type?: string };
type Message = { content?: string | MessageContent[] };

function hasAttachment(body: unknown): boolean {
  if (typeof body !== "object" || body === null) return false;
  const { messages } = body as { messages?: unknown };
  if (!Array.isArray(messages)) return false;
  return messages.some((m: Message) => {
    const content = m?.content;
    if (!Array.isArray(content)) return false;
    return content.some((c) => c?.type === "image" || c?.type === "document");
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: "ANTHROPIC_API_KEY not configured" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return new Response(
      JSON.stringify({ error: "Supabase env vars not configured" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // 1) Identificar al usuario vía su JWT. Aunque `verify_jwt = true` en la
  //    config de la función ya filtra anónimos, necesitamos el user_id para
  //    aplicar rate-limit por usuario.
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(
      JSON.stringify({ error: "Missing Authorization header" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user }, error: userError } = await userClient.auth.getUser();
  if (userError || !user) {
    return new Response(
      JSON.stringify({ error: "Invalid or expired JWT" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // 2) Parsear body para decidir el umbral.
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return new Response(
      JSON.stringify({ error: "Invalid JSON body" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const heavy = hasAttachment(body);
  const limit = heavy ? LIMIT_ATTACHMENT : LIMIT_TEXT;

  // 3) Rate-limit check. Cliente con service_role para bypasear RLS de
  //    edge_function_calls.
  const admin = createClient(supabaseUrl, serviceRoleKey);
  const cutoff = new Date(Date.now() - WINDOW_SECONDS * 1000).toISOString();

  const { count, error: countError } = await admin
    .from("edge_function_calls")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("function_name", "generate-recipe")
    .gte("called_at", cutoff);

  if (countError) {
    // Fail open: si la tabla o el query fallan, no bloqueamos al usuario real.
    // El log queda en los logs de la función para diagnóstico.
    console.error("[rate-limit] count failed:", countError.message);
  } else if ((count ?? 0) >= limit) {
    return new Response(
      JSON.stringify({
        error: "Rate limit exceeded",
        message: `Máximo ${limit} solicitudes por minuto (${heavy ? "escaneo de factura" : "generación de receta"}). Intenta de nuevo en unos segundos.`,
        retry_after_seconds: WINDOW_SECONDS,
      }),
      {
        status: 429,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
          "Retry-After": String(WINDOW_SECONDS),
        },
      }
    );
  }

  // 4) Registrar esta llamada (fire-and-forget; no bloqueamos al proxy si
  //    la inserción falla — el costo de perder un registro es menor que
  //    impedir una llamada legítima).
  admin
    .from("edge_function_calls")
    .insert({ user_id: user.id, function_name: "generate-recipe" })
    .then(
      () => {},
      (err: unknown) => console.error("[rate-limit] insert failed:", err)
    );

  // 5) Proxy a Anthropic.
  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(body),
    });

    const data = await response.text();
    return new Response(data, {
      status: response.status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
