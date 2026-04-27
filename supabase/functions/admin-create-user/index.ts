import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const VALID_ROLES = ["admin", "comercial", "operaciones", "cocina"] as const;
type Role = (typeof VALID_ROLES)[number];

type Body = {
  email?: string;
  password?: string;
  role?: string;
};

function jsonResponse(body: Record<string, unknown>, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return jsonResponse({ error: "Supabase env vars not configured" }, 500);
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return jsonResponse({ error: "Missing Authorization header" }, 401);
  }

  // 1) Identificar al caller via su JWT.
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user: caller }, error: callerErr } = await userClient.auth.getUser();
  if (callerErr || !caller) {
    return jsonResponse({ error: "Invalid or expired JWT" }, 401);
  }

  // 2) Validar que el caller es admin (consulta directa con service_role).
  const admin = createClient(supabaseUrl, serviceRoleKey);
  const { data: callerRoles, error: rolesErr } = await admin
    .from("user_roles")
    .select("role")
    .eq("user_id", caller.id)
    .eq("role", "admin");

  if (rolesErr) {
    console.error("[admin-create-user] role check failed:", rolesErr.message);
    return jsonResponse({ error: "No se pudo validar permisos" }, 500);
  }
  if (!callerRoles || callerRoles.length === 0) {
    return jsonResponse({ error: "Solo administradores pueden crear usuarios" }, 403);
  }

  // 3) Parsear body.
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }

  const email = body.email?.trim().toLowerCase();
  const password = body.password;
  const role = body.role;

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return jsonResponse({ error: "Correo inválido" }, 400);
  }
  if (!password || password.length < 6) {
    return jsonResponse({ error: "La contraseña debe tener al menos 6 caracteres" }, 400);
  }
  if (!role || !VALID_ROLES.includes(role as Role)) {
    return jsonResponse({ error: "Rol inválido" }, 400);
  }

  // 4) Crear el usuario en auth con email confirmado (no requiere link de
  //    verificación — el admin le pasa la contraseña por canal interno).
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (createErr || !created.user) {
    const msg = createErr?.message ?? "No se pudo crear el usuario";
    const status = msg.toLowerCase().includes("already") ? 409 : 500;
    return jsonResponse({ error: msg }, status);
  }

  // 5) Asignar el rol pedido. Si falla, el user queda creado sin rol — el
  //    admin lo ve en la tabla y puede asignarlo manualmente.
  const { error: roleAssignErr } = await admin
    .from("user_roles")
    .insert({ user_id: created.user.id, role });

  if (roleAssignErr) {
    console.error("[admin-create-user] role assign failed:", roleAssignErr.message);
    return jsonResponse({
      ok: true,
      user_id: created.user.id,
      warning: "Usuario creado pero no se pudo asignar el rol. Asignalo manualmente.",
    }, 207);
  }

  return jsonResponse({ ok: true, user_id: created.user.id }, 200);
});
