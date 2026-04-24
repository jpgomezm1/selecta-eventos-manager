-- Captura el estado actual del bucket `facturas` y sus policies.
-- Originalmente fue creado a mano desde el Supabase Dashboard durante el MVP;
-- esta migration lo hace reproducible y verificable.
--
-- Idempotente: usa ON CONFLICT / DROP POLICY IF EXISTS para poder reaplicarse
-- sin romper un entorno que ya lo tenga.

insert into storage.buckets (id, name, public)
values ('facturas', 'facturas', false)
on conflict (id) do nothing;

drop policy if exists "Auth read facturas" on storage.objects;
drop policy if exists "Auth upload facturas" on storage.objects;
drop policy if exists "Auth delete facturas" on storage.objects;

create policy "Auth read facturas"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'facturas');

create policy "Auth upload facturas"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'facturas');

create policy "Auth delete facturas"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'facturas');

-- NOTA: las policies no aíslan por usuario. Cualquier user autenticado puede
-- leer/subir/borrar cualquier factura. Esto es consistente con el modelo
-- "app interna single-tenant" del proyecto. Cuando se migre a multi-tenant
-- habrá que agregar filtros por owner en `using` / `with check`.
