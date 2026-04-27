-- Hardening de RLS para tablas de negocio.
-- Antes: todas las policies eran USING (true) o USING (auth.role()='authenticated') —
-- el frontend filtraba por rol pero la DB no, dejando un agujero ante llamadas API directas.
-- Ahora: policies basadas en has_role() alineadas con la matriz de UI definida en
-- src/App.tsx + src/components/Layout/navigation.ts.
--
-- Preservamos todas las policies anon que existen para el flujo de cotización pública
-- compartida (cotizacion_has_active_share). NO tocamos cotizacion_lugares (sin RLS por
-- decisión documentada en AUDIT_PASO_1.md), ni user_roles (policies propias correctas),
-- ni edge_function_calls (service-role only).
--
-- Convención: policy "<tabla>: rol" reemplaza la legacy con DROP IF EXISTS para
-- re-aplicabilidad.

-- ---------------------------------------------------------------------------
-- Helper: lista de roles que pueden hacer X. Se interpola en USING/WITH CHECK.
-- ---------------------------------------------------------------------------

-- ===========================================================================
-- 1) Clientes — admin + comercial
-- ===========================================================================

drop policy if exists "Auth users can CRUD clientes" on public.clientes;
create policy "clientes: rol crud" on public.clientes
  for all to authenticated
  using (public.has_role('admin') or public.has_role('comercial'))
  with check (public.has_role('admin') or public.has_role('comercial'));

drop policy if exists "Auth users can CRUD cliente_contactos" on public.cliente_contactos;
create policy "cliente_contactos: rol crud" on public.cliente_contactos
  for all to authenticated
  using (public.has_role('admin') or public.has_role('comercial'))
  with check (public.has_role('admin') or public.has_role('comercial'));

-- (Anon read clientes shared / Anon read contactos shared se mantienen — son para el flujo público.)

-- ===========================================================================
-- 2) Cotizaciones — admin/comercial CRUD; operaciones SELECT-only
-- ===========================================================================

-- cotizaciones
drop policy if exists "Cotizaciones accesibles para usuarios autenticados" on public.cotizaciones;
drop policy if exists "auth select cotizaciones" on public.cotizaciones;
drop policy if exists "auth insert cotizaciones" on public.cotizaciones;
drop policy if exists "auth update cotizaciones" on public.cotizaciones;
drop policy if exists "auth delete cotizaciones" on public.cotizaciones;
create policy "cotizaciones: rol select" on public.cotizaciones
  for select to authenticated
  using (public.has_role('admin') or public.has_role('comercial') or public.has_role('operaciones'));
create policy "cotizaciones: rol write" on public.cotizaciones
  for insert to authenticated
  with check (public.has_role('admin') or public.has_role('comercial'));
create policy "cotizaciones: rol update" on public.cotizaciones
  for update to authenticated
  using (public.has_role('admin') or public.has_role('comercial'))
  with check (public.has_role('admin') or public.has_role('comercial'));
create policy "cotizaciones: rol delete" on public.cotizaciones
  for delete to authenticated
  using (public.has_role('admin') or public.has_role('comercial'));

-- cotizacion_versiones
drop policy if exists "auth select cotizacion_versiones" on public.cotizacion_versiones;
drop policy if exists "auth insert cotizacion_versiones" on public.cotizacion_versiones;
drop policy if exists "auth update cotizacion_versiones" on public.cotizacion_versiones;
drop policy if exists "auth delete cotizacion_versiones" on public.cotizacion_versiones;
create policy "cotizacion_versiones: rol select" on public.cotizacion_versiones
  for select to authenticated
  using (public.has_role('admin') or public.has_role('comercial') or public.has_role('operaciones'));
create policy "cotizacion_versiones: rol insert" on public.cotizacion_versiones
  for insert to authenticated
  with check (public.has_role('admin') or public.has_role('comercial'));
create policy "cotizacion_versiones: rol update" on public.cotizacion_versiones
  for update to authenticated
  using (public.has_role('admin') or public.has_role('comercial'))
  with check (public.has_role('admin') or public.has_role('comercial'));
create policy "cotizacion_versiones: rol delete" on public.cotizacion_versiones
  for delete to authenticated
  using (public.has_role('admin') or public.has_role('comercial'));

-- cotizacion_share_tokens — solo admin + comercial los crean/revocan.
-- Anon read activo se mantiene.
drop policy if exists "Auth users manage share tokens" on public.cotizacion_share_tokens;
create policy "cotizacion_share_tokens: rol crud" on public.cotizacion_share_tokens
  for all to authenticated
  using (public.has_role('admin') or public.has_role('comercial'))
  with check (public.has_role('admin') or public.has_role('comercial'));

-- cotizacion_platos
drop policy if exists "Items de cotizacion (platos) accesibles" on public.cotizacion_platos;
drop policy if exists "auth select cotizacion_platos" on public.cotizacion_platos;
drop policy if exists "auth insert cotizacion_platos" on public.cotizacion_platos;
drop policy if exists "auth update cotizacion_platos" on public.cotizacion_platos;
drop policy if exists "auth delete cotizacion_platos" on public.cotizacion_platos;
create policy "cotizacion_platos: rol select" on public.cotizacion_platos
  for select to authenticated
  using (public.has_role('admin') or public.has_role('comercial') or public.has_role('operaciones'));
create policy "cotizacion_platos: rol write" on public.cotizacion_platos
  for insert to authenticated
  with check (public.has_role('admin') or public.has_role('comercial'));
create policy "cotizacion_platos: rol update" on public.cotizacion_platos
  for update to authenticated
  using (public.has_role('admin') or public.has_role('comercial'))
  with check (public.has_role('admin') or public.has_role('comercial'));
create policy "cotizacion_platos: rol delete" on public.cotizacion_platos
  for delete to authenticated
  using (public.has_role('admin') or public.has_role('comercial'));

-- cotizacion_personal_items
drop policy if exists "auth select cotizacion_personal_items" on public.cotizacion_personal_items;
drop policy if exists "auth insert cotizacion_personal_items" on public.cotizacion_personal_items;
drop policy if exists "auth update cotizacion_personal_items" on public.cotizacion_personal_items;
drop policy if exists "auth delete cotizacion_personal_items" on public.cotizacion_personal_items;
create policy "cotizacion_personal_items: rol select" on public.cotizacion_personal_items
  for select to authenticated
  using (public.has_role('admin') or public.has_role('comercial') or public.has_role('operaciones'));
create policy "cotizacion_personal_items: rol insert" on public.cotizacion_personal_items
  for insert to authenticated
  with check (public.has_role('admin') or public.has_role('comercial'));
create policy "cotizacion_personal_items: rol update" on public.cotizacion_personal_items
  for update to authenticated
  using (public.has_role('admin') or public.has_role('comercial'))
  with check (public.has_role('admin') or public.has_role('comercial'));
create policy "cotizacion_personal_items: rol delete" on public.cotizacion_personal_items
  for delete to authenticated
  using (public.has_role('admin') or public.has_role('comercial'));

-- cotizacion_transporte_items
drop policy if exists "Items de cotizacion (transporte) accesibles" on public.cotizacion_transporte_items;
drop policy if exists "auth select cotizacion_transporte_items" on public.cotizacion_transporte_items;
drop policy if exists "auth insert cotizacion_transporte_items" on public.cotizacion_transporte_items;
drop policy if exists "auth update cotizacion_transporte_items" on public.cotizacion_transporte_items;
drop policy if exists "auth delete cotizacion_transporte_items" on public.cotizacion_transporte_items;
create policy "cotizacion_transporte_items: rol select" on public.cotizacion_transporte_items
  for select to authenticated
  using (public.has_role('admin') or public.has_role('comercial') or public.has_role('operaciones'));
create policy "cotizacion_transporte_items: rol write" on public.cotizacion_transporte_items
  for insert to authenticated
  with check (public.has_role('admin') or public.has_role('comercial'));
create policy "cotizacion_transporte_items: rol update" on public.cotizacion_transporte_items
  for update to authenticated
  using (public.has_role('admin') or public.has_role('comercial'))
  with check (public.has_role('admin') or public.has_role('comercial'));
create policy "cotizacion_transporte_items: rol delete" on public.cotizacion_transporte_items
  for delete to authenticated
  using (public.has_role('admin') or public.has_role('comercial'));

-- cotizacion_menaje_items
drop policy if exists "Authenticated users full access" on public.cotizacion_menaje_items;
create policy "cotizacion_menaje_items: rol select" on public.cotizacion_menaje_items
  for select to authenticated
  using (public.has_role('admin') or public.has_role('comercial') or public.has_role('operaciones'));
create policy "cotizacion_menaje_items: rol write" on public.cotizacion_menaje_items
  for insert to authenticated
  with check (public.has_role('admin') or public.has_role('comercial'));
create policy "cotizacion_menaje_items: rol update" on public.cotizacion_menaje_items
  for update to authenticated
  using (public.has_role('admin') or public.has_role('comercial'))
  with check (public.has_role('admin') or public.has_role('comercial'));
create policy "cotizacion_menaje_items: rol delete" on public.cotizacion_menaje_items
  for delete to authenticated
  using (public.has_role('admin') or public.has_role('comercial'));

-- cotizacion_personal_asignaciones
drop policy if exists "Authenticated users full access" on public.cotizacion_personal_asignaciones;
create policy "cotizacion_personal_asignaciones: rol select" on public.cotizacion_personal_asignaciones
  for select to authenticated
  using (public.has_role('admin') or public.has_role('comercial') or public.has_role('operaciones'));
create policy "cotizacion_personal_asignaciones: rol write" on public.cotizacion_personal_asignaciones
  for insert to authenticated
  with check (public.has_role('admin') or public.has_role('comercial') or public.has_role('operaciones'));
create policy "cotizacion_personal_asignaciones: rol update" on public.cotizacion_personal_asignaciones
  for update to authenticated
  using (public.has_role('admin') or public.has_role('comercial') or public.has_role('operaciones'))
  with check (public.has_role('admin') or public.has_role('comercial') or public.has_role('operaciones'));
create policy "cotizacion_personal_asignaciones: rol delete" on public.cotizacion_personal_asignaciones
  for delete to authenticated
  using (public.has_role('admin') or public.has_role('comercial') or public.has_role('operaciones'));

-- ===========================================================================
-- 3) Catálogos — todos auth lectura, admin write
-- ===========================================================================

drop policy if exists "Catalogo de platos accesible para usuarios autenticados" on public.platos_catalogo;
create policy "platos_catalogo: select all auth" on public.platos_catalogo
  for select to authenticated using (true);
create policy "platos_catalogo: rol write" on public.platos_catalogo
  for insert to authenticated with check (public.has_role('admin'));
create policy "platos_catalogo: rol update" on public.platos_catalogo
  for update to authenticated
  using (public.has_role('admin')) with check (public.has_role('admin'));
create policy "platos_catalogo: rol delete" on public.platos_catalogo
  for delete to authenticated using (public.has_role('admin'));

drop policy if exists "Catalogo de costos de personal accesible" on public.personal_costos_catalogo;
create policy "personal_costos_catalogo: select all auth" on public.personal_costos_catalogo
  for select to authenticated using (true);
create policy "personal_costos_catalogo: rol write" on public.personal_costos_catalogo
  for insert to authenticated with check (public.has_role('admin'));
create policy "personal_costos_catalogo: rol update" on public.personal_costos_catalogo
  for update to authenticated
  using (public.has_role('admin')) with check (public.has_role('admin'));
create policy "personal_costos_catalogo: rol delete" on public.personal_costos_catalogo
  for delete to authenticated using (public.has_role('admin'));

drop policy if exists "Tarifas de transporte accesibles para usuarios autenticados" on public.transporte_tarifas;
create policy "transporte_tarifas: select all auth" on public.transporte_tarifas
  for select to authenticated using (true);
create policy "transporte_tarifas: rol write" on public.transporte_tarifas
  for insert to authenticated with check (public.has_role('admin'));
create policy "transporte_tarifas: rol update" on public.transporte_tarifas
  for update to authenticated
  using (public.has_role('admin')) with check (public.has_role('admin'));
create policy "transporte_tarifas: rol delete" on public.transporte_tarifas
  for delete to authenticated using (public.has_role('admin'));

drop policy if exists "Auth CRUD on lugares_catalogo" on public.lugares_catalogo;
create policy "lugares_catalogo: select all auth" on public.lugares_catalogo
  for select to authenticated using (true);
create policy "lugares_catalogo: rol write" on public.lugares_catalogo
  for insert to authenticated with check (public.has_role('admin'));
create policy "lugares_catalogo: rol update" on public.lugares_catalogo
  for update to authenticated
  using (public.has_role('admin')) with check (public.has_role('admin'));
create policy "lugares_catalogo: rol delete" on public.lugares_catalogo
  for delete to authenticated using (public.has_role('admin'));

-- ===========================================================================
-- 4) Personal — admin + operaciones
-- ===========================================================================

drop policy if exists "Personal accesible para usuarios autenticados" on public.personal;
create policy "personal: rol crud" on public.personal
  for all to authenticated
  using (public.has_role('admin') or public.has_role('operaciones'))
  with check (public.has_role('admin') or public.has_role('operaciones'));

-- ===========================================================================
-- 5) Menaje — admin + operaciones (catalogo lectura todos auth)
-- ===========================================================================

drop policy if exists "menaje_catalogo_select" on public.menaje_catalogo;
drop policy if exists "menaje_catalogo_write" on public.menaje_catalogo;
create policy "menaje_catalogo: select all auth" on public.menaje_catalogo
  for select to authenticated using (true);
create policy "menaje_catalogo: rol write" on public.menaje_catalogo
  for insert to authenticated
  with check (public.has_role('admin') or public.has_role('operaciones'));
create policy "menaje_catalogo: rol update" on public.menaje_catalogo
  for update to authenticated
  using (public.has_role('admin') or public.has_role('operaciones'))
  with check (public.has_role('admin') or public.has_role('operaciones'));
create policy "menaje_catalogo: rol delete" on public.menaje_catalogo
  for delete to authenticated
  using (public.has_role('admin') or public.has_role('operaciones'));

drop policy if exists "menaje_reservas_crud" on public.menaje_reservas;
create policy "menaje_reservas: rol crud" on public.menaje_reservas
  for all to authenticated
  using (public.has_role('admin') or public.has_role('operaciones'))
  with check (public.has_role('admin') or public.has_role('operaciones'));

drop policy if exists "menaje_reserva_items_crud" on public.menaje_reserva_items;
create policy "menaje_reserva_items: rol crud" on public.menaje_reserva_items
  for all to authenticated
  using (public.has_role('admin') or public.has_role('operaciones'))
  with check (public.has_role('admin') or public.has_role('operaciones'));

drop policy if exists "menaje_movimientos_crud" on public.menaje_movimientos;
create policy "menaje_movimientos: rol crud" on public.menaje_movimientos
  for all to authenticated
  using (public.has_role('admin') or public.has_role('operaciones'))
  with check (public.has_role('admin') or public.has_role('operaciones'));

drop policy if exists "menaje_mov_items_crud" on public.menaje_mov_items;
create policy "menaje_mov_items: rol crud" on public.menaje_mov_items
  for all to authenticated
  using (public.has_role('admin') or public.has_role('operaciones'))
  with check (public.has_role('admin') or public.has_role('operaciones'));

-- ===========================================================================
-- 6) Inventario / Recetario — admin + cocina (catalogo ingredientes lectura todos auth)
-- ===========================================================================

drop policy if exists "Authenticated users full access" on public.inventario_movimientos;
create policy "inventario_movimientos: rol crud" on public.inventario_movimientos
  for all to authenticated
  using (public.has_role('admin') or public.has_role('cocina'))
  with check (public.has_role('admin') or public.has_role('cocina'));

drop policy if exists "Authenticated users full access" on public.inventario_mov_items;
create policy "inventario_mov_items: rol crud" on public.inventario_mov_items
  for all to authenticated
  using (public.has_role('admin') or public.has_role('cocina'))
  with check (public.has_role('admin') or public.has_role('cocina'));

drop policy if exists "Allow all for authenticated" on public.ingredientes_catalogo;
create policy "ingredientes_catalogo: select all auth" on public.ingredientes_catalogo
  for select to authenticated using (true);
create policy "ingredientes_catalogo: rol write" on public.ingredientes_catalogo
  for insert to authenticated
  with check (public.has_role('admin') or public.has_role('cocina'));
create policy "ingredientes_catalogo: rol update" on public.ingredientes_catalogo
  for update to authenticated
  using (public.has_role('admin') or public.has_role('cocina'))
  with check (public.has_role('admin') or public.has_role('cocina'));
create policy "ingredientes_catalogo: rol delete" on public.ingredientes_catalogo
  for delete to authenticated
  using (public.has_role('admin') or public.has_role('cocina'));

drop policy if exists "Allow all for authenticated" on public.ingrediente_proveedores;
create policy "ingrediente_proveedores: select all auth" on public.ingrediente_proveedores
  for select to authenticated using (true);
create policy "ingrediente_proveedores: rol write" on public.ingrediente_proveedores
  for insert to authenticated
  with check (public.has_role('admin') or public.has_role('cocina'));
create policy "ingrediente_proveedores: rol update" on public.ingrediente_proveedores
  for update to authenticated
  using (public.has_role('admin') or public.has_role('cocina'))
  with check (public.has_role('admin') or public.has_role('cocina'));
create policy "ingrediente_proveedores: rol delete" on public.ingrediente_proveedores
  for delete to authenticated
  using (public.has_role('admin') or public.has_role('cocina'));

drop policy if exists "Allow all for authenticated" on public.plato_ingredientes;
create policy "plato_ingredientes: select all auth" on public.plato_ingredientes
  for select to authenticated using (true);
create policy "plato_ingredientes: rol write" on public.plato_ingredientes
  for insert to authenticated
  with check (public.has_role('admin') or public.has_role('cocina'));
create policy "plato_ingredientes: rol update" on public.plato_ingredientes
  for update to authenticated
  using (public.has_role('admin') or public.has_role('cocina'))
  with check (public.has_role('admin') or public.has_role('cocina'));
create policy "plato_ingredientes: rol delete" on public.plato_ingredientes
  for delete to authenticated
  using (public.has_role('admin') or public.has_role('cocina'));

-- ===========================================================================
-- 7) Eventos — todos auth lectura, write admin/comercial/operaciones según concern
-- ===========================================================================

drop policy if exists "Eventos accesible para usuarios autenticados" on public.eventos;
drop policy if exists "auth all eventos" on public.eventos;
create policy "eventos: select all auth" on public.eventos
  for select to authenticated using (true);
create policy "eventos: rol write" on public.eventos
  for insert to authenticated
  with check (public.has_role('admin') or public.has_role('comercial') or public.has_role('operaciones'));
create policy "eventos: rol update" on public.eventos
  for update to authenticated
  using (public.has_role('admin') or public.has_role('comercial') or public.has_role('operaciones'))
  with check (public.has_role('admin') or public.has_role('comercial') or public.has_role('operaciones'));
create policy "eventos: rol delete" on public.eventos
  for delete to authenticated
  using (public.has_role('admin'));

drop policy if exists "Evento_personal accesible para usuarios autenticados" on public.evento_personal;
create policy "evento_personal: select all auth" on public.evento_personal
  for select to authenticated using (true);
create policy "evento_personal: rol write" on public.evento_personal
  for insert to authenticated
  with check (public.has_role('admin') or public.has_role('operaciones'));
create policy "evento_personal: rol update" on public.evento_personal
  for update to authenticated
  using (public.has_role('admin') or public.has_role('operaciones'))
  with check (public.has_role('admin') or public.has_role('operaciones'));
create policy "evento_personal: rol delete" on public.evento_personal
  for delete to authenticated
  using (public.has_role('admin') or public.has_role('operaciones'));

-- evento_requerimiento_*: select libre; write según concern
drop policy if exists "auth all er_platos" on public.evento_requerimiento_platos;
create policy "evento_requerimiento_platos: select all auth" on public.evento_requerimiento_platos
  for select to authenticated using (true);
create policy "evento_requerimiento_platos: rol write" on public.evento_requerimiento_platos
  for all to authenticated
  using (public.has_role('admin') or public.has_role('comercial') or public.has_role('operaciones'))
  with check (public.has_role('admin') or public.has_role('comercial') or public.has_role('operaciones'));

drop policy if exists "auth all er_pers" on public.evento_requerimiento_personal;
create policy "evento_requerimiento_personal: select all auth" on public.evento_requerimiento_personal
  for select to authenticated using (true);
create policy "evento_requerimiento_personal: rol write" on public.evento_requerimiento_personal
  for all to authenticated
  using (public.has_role('admin') or public.has_role('operaciones'))
  with check (public.has_role('admin') or public.has_role('operaciones'));

drop policy if exists "auth all er_trans" on public.evento_requerimiento_transporte;
create policy "evento_requerimiento_transporte: select all auth" on public.evento_requerimiento_transporte
  for select to authenticated using (true);
create policy "evento_requerimiento_transporte: rol write" on public.evento_requerimiento_transporte
  for all to authenticated
  using (public.has_role('admin') or public.has_role('operaciones'))
  with check (public.has_role('admin') or public.has_role('operaciones'));

drop policy if exists "auth_full" on public.evento_requerimiento_menaje;
create policy "evento_requerimiento_menaje: select all auth" on public.evento_requerimiento_menaje
  for select to authenticated using (true);
create policy "evento_requerimiento_menaje: rol write" on public.evento_requerimiento_menaje
  for all to authenticated
  using (public.has_role('admin') or public.has_role('operaciones'))
  with check (public.has_role('admin') or public.has_role('operaciones'));

-- Orden de compra: cocina + admin (es para insumos del evento)
drop policy if exists "auth_full" on public.evento_orden_compra;
create policy "evento_orden_compra: select all auth" on public.evento_orden_compra
  for select to authenticated using (true);
create policy "evento_orden_compra: rol write" on public.evento_orden_compra
  for all to authenticated
  using (public.has_role('admin') or public.has_role('cocina'))
  with check (public.has_role('admin') or public.has_role('cocina'));

drop policy if exists "auth_full" on public.evento_orden_compra_items;
create policy "evento_orden_compra_items: select all auth" on public.evento_orden_compra_items
  for select to authenticated using (true);
create policy "evento_orden_compra_items: rol write" on public.evento_orden_compra_items
  for all to authenticated
  using (public.has_role('admin') or public.has_role('cocina'))
  with check (public.has_role('admin') or public.has_role('cocina'));

-- ===========================================================================
-- 8) Transporte órdenes — admin + operaciones
-- ===========================================================================

drop policy if exists "transporte_ordenes_crud" on public.transporte_ordenes;
create policy "transporte_ordenes: rol crud" on public.transporte_ordenes
  for all to authenticated
  using (public.has_role('admin') or public.has_role('operaciones'))
  with check (public.has_role('admin') or public.has_role('operaciones'));

-- ===========================================================================
-- 9) Pagos — admin + operaciones (área financiera/operativa)
-- ===========================================================================

drop policy if exists "Registro de pagos accesible para usuarios autenticados" on public.registro_pagos;
create policy "registro_pagos: rol crud" on public.registro_pagos
  for all to authenticated
  using (public.has_role('admin') or public.has_role('operaciones'))
  with check (public.has_role('admin') or public.has_role('operaciones'));

drop policy if exists "Registro pago eventos accesible para usuarios autenticados" on public.registro_pago_eventos;
create policy "registro_pago_eventos: rol crud" on public.registro_pago_eventos
  for all to authenticated
  using (public.has_role('admin') or public.has_role('operaciones'))
  with check (public.has_role('admin') or public.has_role('operaciones'));
