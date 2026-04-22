import { supabase } from "@/integrations/supabase/client";

export interface Cliente {
  id: string;
  nombre: string;
  telefono: string | null;
  correo: string | null;
  empresa: string | null;
  nit: string | null;
  notas: string | null;
  tipo: 'persona_natural' | 'empresa';
  cedula: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface ClienteInsert {
  nombre: string;
  telefono?: string | null;
  correo?: string | null;
  empresa?: string | null;
  nit?: string | null;
  notas?: string | null;
  tipo?: 'persona_natural' | 'empresa';
  cedula?: string | null;
}

export interface ContactoCliente {
  id: string;
  cliente_id: string;
  nombre: string;
  cargo: string | null;
  telefono: string | null;
  correo: string | null;
  es_principal: boolean;
  created_at?: string;
}

export interface ContactoClienteInsert {
  cliente_id: string;
  nombre: string;
  cargo?: string | null;
  telefono?: string | null;
  correo?: string | null;
  es_principal?: boolean;
}

export async function searchClientes(term: string): Promise<Cliente[]> {
  if (!term || term.length < 2) return [];
  const pattern = `%${term}%`;
  const { data, error } = await supabase
    .from("clientes")
    .select("*")
    .or(`nombre.ilike.${pattern},empresa.ilike.${pattern},correo.ilike.${pattern}`)
    .order("nombre", { ascending: true })
    .limit(10);
  if (error) throw error;
  return (data ?? []) as Cliente[];
}

export async function getCliente(id: string): Promise<Cliente> {
  const { data, error } = await supabase
    .from("clientes")
    .select("*")
    .eq("id", id)
    .single();
  if (error) throw error;
  return data as Cliente;
}

export async function createCliente(input: ClienteInsert): Promise<Cliente> {
  const { data, error } = await supabase
    .from("clientes")
    .insert(input)
    .select("*")
    .single();
  if (error) {
    if (error.code === "42P01" || error.message?.includes("does not exist")) {
      throw new Error("La tabla de clientes no existe. Ejecuta la migración SQL.");
    }
    throw error;
  }
  return data as Cliente;
}

export async function deleteCliente(id: string): Promise<void> {
  const { error } = await supabase.from("clientes").delete().eq("id", id);
  if (error) throw error;
}

export async function updateCliente(id: string, input: Partial<ClienteInsert>): Promise<Cliente> {
  const { data, error } = await supabase
    .from("clientes")
    .update({ ...input, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return data as Cliente;
}

export async function listClientes(): Promise<Cliente[]> {
  const { data, error } = await supabase
    .from("clientes")
    .select("*")
    .order("nombre", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((d) => ({
    ...d,
    tipo: (d.tipo || 'persona_natural') as Cliente["tipo"],
    cedula: d.cedula || null,
  })) as Cliente[];
}

/** =====================
 *  CONTACTOS CRUD
 *  ===================== */

export async function listContactos(clienteId: string): Promise<ContactoCliente[]> {
  const { data, error } = await supabase
    .from("cliente_contactos")
    .select("*")
    .eq("cliente_id", clienteId)
    .order("es_principal", { ascending: false })
    .order("nombre", { ascending: true });
  if (error) throw error;
  return (data ?? []) as ContactoCliente[];
}

export async function createContacto(input: ContactoClienteInsert): Promise<ContactoCliente> {
  const { data, error } = await supabase
    .from("cliente_contactos")
    .insert(input)
    .select("*")
    .single();
  if (error) throw error;
  return data as ContactoCliente;
}

export async function updateContacto(id: string, input: Partial<ContactoClienteInsert>): Promise<ContactoCliente> {
  const { data, error } = await supabase
    .from("cliente_contactos")
    .update(input)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return data as ContactoCliente;
}

export async function deleteContacto(id: string): Promise<void> {
  const { error } = await supabase.from("cliente_contactos").delete().eq("id", id);
  if (error) throw error;
}
