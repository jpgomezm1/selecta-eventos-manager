# 📋 Instrucciones: Implementación de Modalidades de Cobro para Personal

## 🎯 Resumen de Cambios

Se ha implementado un sistema flexible de **modalidades de cobro** para el personal, permitiendo ahora 6 tipos diferentes de cobro en lugar de solo "por hora":

1. **Por Hora** - Cobro por cada hora trabajada
2. **Jornada 9 Horas** - Tarifa fija por jornada de 9 horas
3. **Jornada 10 Horas** - Tarifa fija por jornada de 10 horas
4. **Jornada hasta 10 Horas** - Tarifa fija hasta 10h, luego cobra horas extras
5. **Jornada Nocturna** - Tarifa fija para eventos nocturnos
6. **Por Evento** - Tarifa fija por evento completo

---

## 📝 Pasos de Implementación

### 1. **Base de Datos (Supabase)** ⚠️ IMPORTANTE

Ejecuta el script SQL en Supabase:

```bash
Archivo: sql_updates_modalidad_cobro_personal.sql
```

Este script:
- ✅ Agrega columna `modalidad_cobro` a `personal_costos_catalogo`
- ✅ Agrega columna `modalidad_cobro` a `personal`
- ✅ Renombra `tarifa_hora` a `tarifa` en `personal`
- ✅ Agrega columna `tarifa_hora_extra` para jornadas con horas extras
- ✅ Establece valores por defecto como `'por_hora'`

**Cómo ejecutarlo:**
1. Ve a tu proyecto de Supabase: https://supabase.com/dashboard
2. Entra a **SQL Editor**
3. Copia y pega el contenido de `sql_updates_modalidad_cobro_personal.sql`
4. Ejecuta el script (botón Run o Ctrl+Enter)
5. Verifica que no haya errores

---

### 2. **Archivos Modificados** ✅

Los siguientes archivos ya fueron actualizados en el código:

#### **Tipos TypeScript**
- `src/types/database.ts` - Tipos de Personal con modalidad_cobro
- `src/types/cotizador.ts` - Tipos para cotizador

#### **Utilidades**
- `src/lib/calcularPagoPersonal.ts` - **NUEVO** - Lógica de cálculo de pagos según modalidad

#### **Formularios**
- `src/components/Forms/PersonalForm.tsx` - Formulario con selector de modalidad
- `src/components/Forms/LiquidacionDialog.tsx` - Muestra modalidad en liquidaciones

#### **Páginas**
- `src/pages/Personal.tsx` - Lista con modalidad visible
- `src/pages/PersonalDetalle.tsx` - Detalle con modalidad
- `src/components/Eventos/PersonalPanel.tsx` - Panel de eventos

---

## 🔧 Uso de la Nueva Funcionalidad

### **A. Crear/Editar Personal**

Al crear o editar un empleado, ahora verás:

1. **Campo "Modalidad de Cobro"** - Selector desplegable con las 6 opciones
2. **Campo "Tarifa"** - El label cambia dinámicamente según la modalidad seleccionada:
   - Por Hora → "Ingrese el valor por hora trabajada"
   - Jornada 9h → "Ingrese el valor total de la jornada de 9 horas"
   - Por Evento → "Ingrese el valor fijo por evento"
   - etc.

3. **Campo "Tarifa Hora Extra"** - ⚡ Aparece SOLO si seleccionas "Jornada hasta 10 Horas"

### **B. Cálculo de Pagos**

El sistema ahora calcula automáticamente según la modalidad:

```typescript
// Ejemplo de uso
import { calcularPagoPersonal } from "@/lib/calcularPagoPersonal";

const pago = calcularPagoPersonal(
  'jornada_hasta_10h',  // modalidad
  200000,                // tarifa base
  12,                    // horas trabajadas
  25000                  // tarifa hora extra
);
// Resultado: 200000 + (2 * 25000) = 250000
```

**Lógica por modalidad:**

| Modalidad | Fórmula |
|-----------|---------|
| Por Hora | `tarifa × horas_trabajadas` |
| Jornada 9h | `tarifa` (fija) |
| Jornada 10h | `tarifa` (fija) |
| Jornada hasta 10h | Si ≤10h: `tarifa`, Si >10h: `tarifa + (horas_extra × tarifa_hora_extra)` |
| Jornada Nocturna | `tarifa` (fija) |
| Por Evento | `tarifa` (fija) |

---

## 📊 Visualización en el Sistema

### **Lista de Personal**
Ahora muestra dos líneas por empleado:
```
$180,000 COP
Jornada 10h
```

### **Detalle de Personal**
```
$180,000 - Jornada 10h
```

### **Diálogo de Liquidación**
Muestra la modalidad bajo la tarifa:
```
Tarifa: $180,000
        Jornada 10h
```

---

## 🚨 Consideraciones Importantes

### **Migración de Datos Existentes**

⚠️ **NOTA:** Todos los registros existentes de personal se marcarán automáticamente como `'por_hora'` al ejecutar el script SQL.

Si tienes empleados que NO cobran por hora:
1. Ve a **Personal** en el sistema
2. Edita cada empleado
3. Cambia la modalidad de cobro a la correcta
4. Ajusta la tarifa si es necesario

### **Compatibilidad con Cotizador**

El cotizador utiliza `personal_costos_catalogo`, que también tiene ahora `modalidad_cobro`. Asegúrate de:

1. Revisar los costos del catálogo en Supabase
2. Actualizar las modalidades según corresponda
3. Los precios en cotizaciones se calcularán según la modalidad del catálogo

---

## 🧪 Testing Recomendado

Después de ejecutar el script SQL, prueba:

1. ✅ **Crear nuevo personal** con cada modalidad
2. ✅ **Editar personal existente** y cambiar modalidad
3. ✅ **Asignar personal a evento** y verificar cálculo de pago
4. ✅ **Hacer liquidación** de evento y verificar montos
5. ✅ **Crear cotización** con personal de diferentes modalidades
6. ✅ **Ver detalle de personal** con historial de pagos

---

## 🔍 Verificación de Cambios en BD

Ejecuta estas queries en Supabase SQL Editor para verificar:

```sql
-- Ver estructura de tabla personal
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'personal'
ORDER BY ordinal_position;

-- Ver personal con modalidades
SELECT nombre_completo, rol, tarifa, modalidad_cobro, tarifa_hora_extra
FROM personal
LIMIT 10;

-- Ver personal_costos_catalogo
SELECT rol, tarifa, modalidad_cobro
FROM personal_costos_catalogo;
```

---

## 📞 Soporte

Si encuentras errores después de la migración:

1. **Error de columna no existe**: Asegúrate de ejecutar el script SQL completo
2. **Valores null**: Verifica que el script estableció valores por defecto
3. **Cálculos incorrectos**: Revisa que la modalidad esté correctamente asignada

---

## ✨ Mejoras Futuras Sugeridas

- [ ] Agregar reportes por modalidad de cobro
- [ ] Dashboard con estadísticas por tipo de contratación
- [ ] Exportar listado de personal con modalidades
- [ ] Histórico de cambios de modalidad por empleado
- [ ] Alertas cuando se exceden horas de jornadas

---

**Última actualización:** 2025-09-30
**Versión:** 1.0
**Estado:** ✅ Implementado y Listo para Producción