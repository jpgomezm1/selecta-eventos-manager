-- ===================================================================
-- Seed de datos de prueba para auditorías de UI/UX (responsive 375px).
-- Todos los registros se identifican con uno de estos marcadores:
--   • Prefijo "[QA-RESP] " en nombres
--   • Cédulas que empiezan con "QA-RESP-"
--   • Correos que terminan en "-qa-resp@selecta.testing"
-- Borrar en bloque con scripts/cleanup-test-data.sql.
-- ===================================================================

begin;

-- 1) Catálogo de personal (tarifas al cliente) — 6 roles ----------------
insert into public.personal_costos_catalogo (rol, modalidad_cobro, tarifa) values
  ('[QA-RESP] Mesero',             'jornada_10h',       180000),
  ('[QA-RESP] Bartender',          'jornada_10h',       220000),
  ('[QA-RESP] Chef',               'jornada_10h',       350000),
  ('[QA-RESP] Auxiliar de cocina', 'por_hora',           25000),
  ('[QA-RESP] Capitán',            'jornada_nocturna',  320000),
  ('[QA-RESP] Hostess',            'jornada_hasta_10h', 160000);

-- 2) Personal (empleados — costo a Selecta) — 8 personas ----------------
-- Nota: personal.rol tiene check constraint con valores fijos (Coordinador,
-- Mesero, Chef, Bartender, Decorador, Técnico de Sonido, Fotógrafo, Otro).
insert into public.personal (nombre_completo, numero_cedula, rol, modalidad_cobro, tarifa, tarifa_hora_extra) values
  ('[QA-RESP] Carlos Méndez',                     'QA-RESP-1001', 'Mesero',      'jornada_10h',       130000, null),
  ('[QA-RESP] Laura Ríos',                        'QA-RESP-1002', 'Mesero',      'jornada_10h',       130000, null),
  ('[QA-RESP] Andrés Quintero',                   'QA-RESP-1003', 'Bartender',   'jornada_10h',       170000, null),
  ('[QA-RESP] Sofía Patiño',                      'QA-RESP-1004', 'Chef',        'jornada_10h',       280000, null),
  ('[QA-RESP] Miguel Ángel Cárdenas Pérez Largo', 'QA-RESP-1005', 'Otro',        'por_hora',           18000,  22000),
  ('[QA-RESP] Valentina Restrepo',                'QA-RESP-1006', 'Coordinador', 'jornada_nocturna',  250000, null),
  ('[QA-RESP] Camila Hoyos',                      'QA-RESP-1007', 'Otro',        'jornada_hasta_10h', 110000,  14000),
  ('[QA-RESP] Daniel Echeverri',                  'QA-RESP-1008', 'Mesero',      'por_evento',         90000, null);

-- 3) Catálogo de menaje — 10 ítems --------------------------------------
insert into public.menaje_catalogo (nombre, categoria, unidad, stock_total, precio_alquiler, activo) values
  ('[QA-RESP] Plato presentación blanco', 'Vajilla',     'unidad', 200,  1500, true),
  ('[QA-RESP] Plato hondo',               'Vajilla',     'unidad', 200,  1200, true),
  ('[QA-RESP] Copa de vino tinto',        'Cristalería', 'unidad', 150,  1800, true),
  ('[QA-RESP] Copa de champaña',          'Cristalería', 'unidad', 100,  1900, true),
  ('[QA-RESP] Cubierto de mesa (set)',    'Cubertería',  'set',    200,  2500, true),
  ('[QA-RESP] Mesón redondo 1.80m',       'Mobiliario',  'unidad',  20, 45000, true),
  ('[QA-RESP] Silla Tiffany dorada',      'Mobiliario',  'unidad', 250, 12000, true),
  ('[QA-RESP] Mantel blanco redondo',     'Lencería',    'unidad',  60, 18000, true),
  ('[QA-RESP] Servilleta de tela',        'Lencería',    'unidad', 400,  1200, true),
  ('[QA-RESP] Calienta-platos eléctrico', 'Equipos',     'unidad',   8, 35000, false);

-- 4) Cliente + contacto principal ---------------------------------------
insert into public.clientes (id, nombre, telefono, correo, empresa, nit, tipo) values
  ('aaaa0001-0000-0000-0000-000000000001', '[QA-RESP] Eventos Catalina S.A.S', '+57 312 555 0001', 'catalina-qa-resp@selecta.testing', 'Eventos Catalina', '900.123.456-7', 'empresa');

insert into public.cliente_contactos (id, cliente_id, nombre, cargo, telefono, correo, es_principal) values
  ('bbbb0001-0000-0000-0000-000000000001', 'aaaa0001-0000-0000-0000-000000000001', '[QA-RESP] Catalina Vélez', 'Coordinadora de eventos', '+57 312 555 0001', 'catalina-qa-resp@selecta.testing', true),
  ('bbbb0002-0000-0000-0000-000000000001', 'aaaa0001-0000-0000-0000-000000000001', '[QA-RESP] María Fernanda López', 'Asistente',              '+57 312 555 0002', 'maria-qa-resp@selecta.testing',     false);

-- 5) Cotizaciones — 12 con estados variados -----------------------------
-- IDs hardcoded: cccc<NN>00-... donde NN es el índice de la cotización.
-- Estados válidos en BD: 'Pendiente por Aprobación', 'Enviada', 'Cotización Aprobada', 'Rechazada'.
-- "Cerrada" no es un estado real → uso 'Cotización Aprobada' con fecha_cierre seteada.
do $body$
declare
  v_cliente_id uuid := 'aaaa0001-0000-0000-0000-000000000001';
  v_contacto_id uuid := 'bbbb0001-0000-0000-0000-000000000001';
  v_pcc_mesero uuid;
  v_pcc_bartender uuid;
  v_pcc_chef uuid;
  v_pcc_capitan uuid;
  v_plato_ids uuid[];
  v_transporte_ids uuid[];
  v_menaje_ids uuid[];

  v_cot_id uuid;
  v_ver_id uuid;
  v_total_v numeric;
  spec record;
  i int := 0;
  j int;
  k int;
  num_versiones int;
  num_platos_por_ver int;
  cot_uuid_str text;
begin
  select id into v_pcc_mesero    from public.personal_costos_catalogo where rol = '[QA-RESP] Mesero';
  select id into v_pcc_bartender from public.personal_costos_catalogo where rol = '[QA-RESP] Bartender';
  select id into v_pcc_chef      from public.personal_costos_catalogo where rol = '[QA-RESP] Chef';
  select id into v_pcc_capitan   from public.personal_costos_catalogo where rol = '[QA-RESP] Capitán';
  select array_agg(id) into v_plato_ids from (select id from public.platos_catalogo limit 8) s;
  select array_agg(id) into v_transporte_ids from (select id from public.transporte_tarifas limit 4) s;
  select array_agg(id) into v_menaje_ids from public.menaje_catalogo where nombre like '[QA-RESP]%' and activo = true;

  for spec in
    select * from (values
      ('[QA-RESP] Boda Catalina y Pablo',       'Pendiente por Aprobación',  120,  14, 'Juan Pablo', null::int),
      ('[QA-RESP] Cumpleaños 50 — Adriana',     'Pendiente por Aprobación',   60,  21, 'Juan Pablo', null),
      ('[QA-RESP] Lanzamiento producto Acme',   'Cotización Aprobada',       180,  -7, 'Tomás',      null),
      ('[QA-RESP] Cena corporativa Q1',         'Cotización Aprobada',        40,   7, 'Tomás',      null),
      ('[QA-RESP] Coctel inauguración galería', 'Enviada',                    90,  28, 'Juan Pablo', null),
      ('[QA-RESP] Bautizo Mateo',               'Rechazada',                  50, -30, 'Tomás',      null),
      ('[QA-RESP] Matrimonio Restrepo-García',  'Cotización Aprobada',       220, -21, 'Juan Pablo', null),
      ('[QA-RESP] Aniversario empresa Beta',    'Cotización Aprobada',       110, -60, 'Tomás',       -1),
      ('[QA-RESP] Quinceañera Daniela',         'Pendiente por Aprobación',  150,  45, 'Juan Pablo', null),
      ('[QA-RESP] Brunch día de la madre',      'Enviada',                    80,  10, 'Tomás',      null),
      ('[QA-RESP] Despedida soltera Lucía',     'Rechazada',                  25, -45, 'Juan Pablo', null),
      ('[QA-RESP] Evento puertas abiertas',     'Cotización Aprobada',       300, -90, 'Tomás',       -1)
    ) as t(nombre, estado, invitados, dias_offset, comercial, fecha_cierre_offset)
  loop
    i := i + 1;
    cot_uuid_str := 'cccc' || lpad(i::text, 2, '0') || '00-0000-0000-0000-000000000001';
    v_cot_id := cot_uuid_str::uuid;
    if i = 5 then num_versiones := 3; else num_versiones := 1; end if;

    insert into public.cotizaciones (
      id, nombre_cotizacion, cliente_nombre, numero_invitados, fecha_evento_estimada,
      estado, comercial_encargado, contacto_telefono, contacto_correo,
      hora_inicio, hora_fin, hora_montaje_inicio, hora_montaje_fin,
      cliente_id, contacto_id, ubicacion_evento,
      fecha_envio, fecha_cierre, motivo_rechazo, notas_rechazo, total_cotizado
    ) values (
      v_cot_id, spec.nombre, '[QA-RESP] Eventos Catalina S.A.S',
      spec.invitados, current_date + spec.dias_offset,
      spec.estado, spec.comercial, '+57 312 555 0001', 'catalina-qa-resp@selecta.testing',
      time '18:00', time '23:00', time '14:00', time '17:30',
      v_cliente_id, v_contacto_id, 'Carrera 43A # 9-22, Medellín',
      case when spec.estado in ('Cotización Aprobada', 'Rechazada', 'Enviada') then now() - interval '5 days' else null end,
      case when spec.fecha_cierre_offset is not null then now() + (spec.fecha_cierre_offset * interval '1 day')
           when spec.estado = 'Rechazada' then now() - interval '3 days'
           else null end,
      case when spec.estado = 'Rechazada' then 'Precio' else null end,
      case when spec.estado = 'Rechazada' then '[QA-RESP] El cliente buscó una alternativa más económica.' else null end,
      0
    );

    insert into public.cotizacion_lugares (cotizacion_id, nombre, ciudad, capacidad_estimada, precio_referencia, es_seleccionado, orden)
    values (v_cot_id, 'Forest Salón Eventos', 'Medellín', spec.invitados + 30, 1800000, true, 1);

    for j in 1..num_versiones loop
      v_ver_id := gen_random_uuid();
      v_total_v := 0;

      insert into public.cotizacion_versiones (id, cotizacion_id, nombre_opcion, version_index, total, estado, is_definitiva)
      values (
        v_ver_id, v_cot_id,
        case j when 1 then 'A' when 2 then 'B' else 'C' end, j, 0,
        case
          when spec.estado = 'Cotización Aprobada' and j = 1 then 'Cotización Aprobada'
          when spec.estado = 'Rechazada'           and j = 1 then 'Rechazada'
          when spec.estado = 'Enviada'             and j = 1 then 'Enviada'
          else 'Pendiente por Aprobación'
        end,
        case when spec.estado = 'Cotización Aprobada' and j = 1 then true else false end
      );

      num_platos_por_ver := 4 + (j - 1);
      for k in 1..num_platos_por_ver loop
        insert into public.cotizacion_platos (cotizacion_id, cotizacion_version_id, plato_id, cantidad, precio_unitario, subtotal)
        values (
          v_cot_id, v_ver_id,
          v_plato_ids[((k + j - 1) % array_length(v_plato_ids, 1)) + 1],
          spec.invitados, 18000 + k * 5000,
          spec.invitados * (18000 + k * 5000)
        );
        v_total_v := v_total_v + spec.invitados * (18000 + k * 5000);
      end loop;

      insert into public.cotizacion_personal_items (cotizacion_id, cotizacion_version_id, personal_costo_id, cantidad, tarifa_estimada_por_persona, subtotal)
      values
        (v_cot_id, v_ver_id, v_pcc_mesero,  greatest(2, spec.invitados / 20), 180000, greatest(2, spec.invitados/20) * 180000),
        (v_cot_id, v_ver_id, v_pcc_capitan, 1, 320000, 320000),
        (v_cot_id, v_ver_id, v_pcc_chef,    1, 350000, 350000);
      v_total_v := v_total_v + greatest(2, spec.invitados/20) * 180000 + 320000 + 350000;

      if j >= 2 then
        insert into public.cotizacion_personal_items (cotizacion_id, cotizacion_version_id, personal_costo_id, cantidad, tarifa_estimada_por_persona, subtotal)
        values (v_cot_id, v_ver_id, v_pcc_bartender, 1, 220000, 220000);
        v_total_v := v_total_v + 220000;
      end if;

      insert into public.cotizacion_transporte_items (cotizacion_id, cotizacion_version_id, transporte_id, cantidad, tarifa_unitaria, subtotal)
      values (v_cot_id, v_ver_id, v_transporte_ids[1 + ((j-1) % array_length(v_transporte_ids,1))], 1, 180000, 180000);
      v_total_v := v_total_v + 180000;

      for k in 1..3 loop
        insert into public.cotizacion_menaje_items (cotizacion_id, cotizacion_version_id, menaje_id, cantidad, precio_alquiler, subtotal)
        values (
          v_cot_id, v_ver_id, v_menaje_ids[((k + j) % array_length(v_menaje_ids,1)) + 1],
          spec.invitados, 1500, spec.invitados * 1500
        );
        v_total_v := v_total_v + spec.invitados * 1500;
      end loop;

      update public.cotizacion_versiones set total = v_total_v where id = v_ver_id;
      if j = 1 then
        update public.cotizaciones set total_cotizado = v_total_v where id = v_cot_id;
      end if;
    end loop;
  end loop;
end;
$body$;

-- 6) Eventos derivados de las 2 cotizaciones aprobadas + 1 cerrada -----
do $body$
declare
  v_evt_id uuid;
  v_pers_ids uuid[];
  v_pers_id uuid;
  v_cot_id uuid;
  v_ver_id uuid;
  v_pcc_mesero uuid;
  v_pcc_chef uuid;
  v_pcc_capitan uuid;
  v_orden_id uuid;
  v_ingr_ids uuid[];
  v_menaje_id uuid;
  v_transporte_id uuid;
  v_plato_ids uuid[];
  i int;
  k int;
begin
  select array_agg(id) into v_pers_ids from public.personal where numero_cedula like 'QA-RESP-%' order by 1;
  select id into v_pcc_mesero  from public.personal_costos_catalogo where rol = '[QA-RESP] Mesero';
  select id into v_pcc_chef    from public.personal_costos_catalogo where rol = '[QA-RESP] Chef';
  select id into v_pcc_capitan from public.personal_costos_catalogo where rol = '[QA-RESP] Capitán';
  select array_agg(id) into v_ingr_ids from (select id from public.ingredientes_catalogo limit 5) s;
  select id into v_menaje_id from public.menaje_catalogo where nombre like '[QA-RESP]%' and activo = true limit 1;
  select id into v_transporte_id from public.transporte_tarifas limit 1;
  select array_agg(id) into v_plato_ids from (select id from public.platos_catalogo limit 5) s;

  -- Evento 1: futuro próximo (cot #4 — Cena corporativa Q1) — confirmado
  v_cot_id := 'cccc0400-0000-0000-0000-000000000001';
  select id into v_ver_id from public.cotizacion_versiones where cotizacion_id = v_cot_id and is_definitiva limit 1;
  v_evt_id := 'eeee0001-0000-0000-0000-000000000001';
  insert into public.eventos (id, nombre_evento, ubicacion, fecha_evento, descripcion, estado_liquidacion, cotizacion_version_id)
  values (v_evt_id, '[QA-RESP] Cena corporativa Q1', 'Forest Salón Eventos, Medellín', current_date + 7, 'Cena formal con menú degustación.', 'pendiente', v_ver_id);

  -- Personal asignado al evento (4 personas) — sin horas registradas aún
  insert into public.evento_personal (evento_id, personal_id, hora_inicio, hora_fin, horas_trabajadas, pago_calculado, estado_pago)
  select v_evt_id, p, time '17:00', time '23:00', null, null, 'pendiente'
  from unnest(v_pers_ids[1:4]) p;

  -- Requerimientos de platos (5)
  for k in 1..5 loop
    insert into public.evento_requerimiento_platos (evento_id, plato_id, nombre, precio_unitario, cantidad, subtotal)
    values (v_evt_id, v_plato_ids[k], '[QA-RESP] Plato ' || k, 28000, 40, 1120000);
  end loop;

  -- Requerimientos de personal (3 roles)
  insert into public.evento_requerimiento_personal (evento_id, personal_costo_id, rol, tarifa_estimada_por_persona, cantidad, subtotal)
  values
    (v_evt_id, v_pcc_mesero,  'Mesero',  180000, 4, 720000),
    (v_evt_id, v_pcc_chef,    'Chef',    350000, 1, 350000),
    (v_evt_id, v_pcc_capitan, 'Capitán', 320000, 1, 320000);

  -- Requerimiento menaje
  insert into public.evento_requerimiento_menaje (evento_id, menaje_id, nombre, precio_alquiler, cantidad, subtotal)
  values (v_evt_id, v_menaje_id, '[QA-RESP] Menaje principal', 1500, 40, 60000);

  -- Requerimiento transporte
  insert into public.evento_requerimiento_transporte (evento_id, transporte_id, lugar, tarifa_unitaria, cantidad, subtotal)
  values (v_evt_id, v_transporte_id, 'Forest Salón', 180000, 1, 180000);

  -- Orden de compra (con algunos items insuficientes para forzar warning)
  v_orden_id := gen_random_uuid();
  insert into public.evento_orden_compra (id, evento_id, estado, total_estimado, notas)
  values (v_orden_id, v_evt_id, 'borrador', 0, '[QA-RESP] Orden de compra inicial');
  for k in 1..array_length(v_ingr_ids, 1) loop
    insert into public.evento_orden_compra_items (orden_id, ingrediente_id, nombre, unidad, cantidad_necesaria, cantidad_inventario, cantidad_comprar, costo_unitario, subtotal)
    values (v_orden_id, v_ingr_ids[k], '[QA-RESP] Insumo ' || k, 'gr', 5000, k * 500, 5000 - (k * 500), 12, (5000 - k * 500) * 12);
  end loop;

  -- Reserva de menaje activa
  insert into public.menaje_reservas (evento_id, fecha_inicio, fecha_fin, estado, notas)
  values (v_evt_id, current_date + 6, current_date + 8, 'confirmado', '[QA-RESP] Reserva confirmada para el evento');
  insert into public.menaje_reserva_items (reserva_id, menaje_id, cantidad)
  select r.id, m.id, 50
  from public.menaje_reservas r
  cross join lateral (select id from public.menaje_catalogo where nombre like '[QA-RESP]%' and activo = true limit 4) m
  where r.evento_id = v_evt_id;

  -- Orden de transporte enviada
  insert into public.transporte_ordenes (evento_id, estado, pickup_nombre, pickup_direccion, descripcion_carga, destino_direccion, hora_recepcion_inicio, hora_recogida_inicio, contacto_nombre, contacto_telefono, vehiculo, notas)
  values (
    v_evt_id, 'programado',
    'Bodega Selecta', 'Cra 50 # 12-34, Medellín',
    'Menaje, vajilla y mantelería para 40 invitados',
    'Forest Salón Eventos, Medellín',
    time '14:00', time '17:00',
    '[QA-RESP] Catalina Vélez', '+57 312 555 0001',
    'Camión NHR Furgón', '[QA-RESP] Confirmar acceso por puerta de servicio'
  );

  -- Evento 2: pasado (cot #7 — Matrimonio Restrepo-García) — con horas registradas
  v_cot_id := 'cccc0700-0000-0000-0000-000000000001';
  select id into v_ver_id from public.cotizacion_versiones where cotizacion_id = v_cot_id and is_definitiva limit 1;
  v_evt_id := 'eeee0002-0000-0000-0000-000000000001';
  insert into public.eventos (id, nombre_evento, ubicacion, fecha_evento, descripcion, estado_liquidacion, cotizacion_version_id)
  values (v_evt_id, '[QA-RESP] Matrimonio Restrepo-García', 'Forest Salón Eventos, Medellín', current_date - 14, 'Recepción de matrimonio con coctel + cena.', 'liquidado', v_ver_id);

  insert into public.evento_personal (evento_id, personal_id, hora_inicio, hora_fin, horas_trabajadas, pago_calculado, estado_pago, fecha_pago, metodo_pago)
  select v_evt_id, p, time '16:00', time '02:00', 10, 130000, 'pagado', current_date - 7, 'transferencia'
  from unnest(v_pers_ids[1:6]) p;
end;
$body$;

commit;

-- ===================================================================
-- Resumen de lo insertado:
-- ===================================================================
select '[QA-RESP] personal_costos_catalogo' tabla, count(*) registros
  from public.personal_costos_catalogo where rol like '[QA-RESP]%'
union all
select '[QA-RESP] personal',           count(*) from public.personal           where numero_cedula like 'QA-RESP-%'
union all
select '[QA-RESP] menaje_catalogo',    count(*) from public.menaje_catalogo    where nombre like '[QA-RESP]%'
union all
select '[QA-RESP] clientes',           count(*) from public.clientes           where nombre like '[QA-RESP]%'
union all
select '[QA-RESP] cliente_contactos',  count(*) from public.cliente_contactos  where nombre like '[QA-RESP]%'
union all
select '[QA-RESP] cotizaciones',       count(*) from public.cotizaciones       where nombre_cotizacion like '[QA-RESP]%'
union all
select '[QA-RESP] cot_versiones',      count(*) from public.cotizacion_versiones v where exists (select 1 from public.cotizaciones c where c.id = v.cotizacion_id and c.nombre_cotizacion like '[QA-RESP]%')
union all
select '[QA-RESP] eventos',            count(*) from public.eventos            where nombre_evento like '[QA-RESP]%'
union all
select '[QA-RESP] evento_personal',    count(*) from public.evento_personal ep where exists (select 1 from public.eventos e where e.id = ep.evento_id and e.nombre_evento like '[QA-RESP]%')
union all
select '[QA-RESP] reservas_menaje',    count(*) from public.menaje_reservas r  where exists (select 1 from public.eventos e where e.id = r.evento_id and e.nombre_evento like '[QA-RESP]%')
union all
select '[QA-RESP] transporte_ordenes', count(*) from public.transporte_ordenes t where exists (select 1 from public.eventos e where e.id = t.evento_id and e.nombre_evento like '[QA-RESP]%');
