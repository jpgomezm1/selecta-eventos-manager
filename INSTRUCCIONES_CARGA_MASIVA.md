# 📤 Carga Masiva de Personal desde Excel

## 🎯 Descripción

Sistema de carga masiva de personal que permite importar múltiples empleados desde un archivo Excel (.xlsx), con validación automática, preview de datos y mapeo inteligente de roles y modalidades.

---

## ✨ Características

- ✅ **Carga desde Excel**: Soporta archivos .xlsx y .xls
- ✅ **Validación en tiempo real**: Detecta errores antes de guardar
- ✅ **Preview de datos**: Visualiza todos los registros antes de confirmar
- ✅ **Mapeo automático**: Convierte roles y modalidades del Excel al formato de la BD
- ✅ **Manejo de duplicados**: Detecta cédulas duplicadas y continúa con los demás
- ✅ **Plantilla descargable**: Ejemplo pre-configurado del formato correcto
- ✅ **Resumen de resultados**: Muestra cuántos registros son válidos/inválidos

---

## 📋 Formato del Archivo Excel

### **Columnas Requeridas:**

| Columna | Nombre en Excel | Tipo | Ejemplo | Descripción |
|---------|----------------|------|---------|-------------|
| A | `ID` | Número | 1, 2, 3... | Número secuencial (opcional, no se usa) |
| B | `NOMBRE` | Texto | "Juan Pérez García" | Nombre completo (mín 3 caracteres, debe tener apellido) |
| C | `CEDULA` | Número | 12345678 | Número de cédula (6-12 dígitos) |
| D | `ROL` | Texto | "MESERO" | Ver tabla de roles válidos abajo |
| E | `PRESTA SERVICIOS POR` | Texto | "HORA" | Ver tabla de modalidades válidas abajo |
| F | `VALOR` | Número | "$ 23.000" | Valor de la tarifa (acepta formato con $ y puntos) |

---

## 🏷️ Roles Válidos

Tu archivo Excel puede usar estos roles (no importan mayúsculas/minúsculas ni tildes):

| Rol en Excel | Se convierte en BD |
|-------------|-------------------|
| `COCINA` | Chef |
| `CONDUCTOR` | Otro |
| `COORDINACION EN HORARIO NO LABORAL` | Coordinador |
| `DECORACION` | Decorador |
| `DECORADOR` | Decorador |
| `DESMONTAJE` | Otro |
| `MESERO` | Mesero |
| `MONTAJE Y DESMONTAJE` | Otro |
| `TRANSPORTES` | Otro |
| `WEEDING PLANNER` | Coordinador |
| `CHEF` | Chef |
| `COORDINADOR` | Coordinador |
| `BARTENDER` | Bartender |
| `TECNICO DE SONIDO` | Técnico de Sonido |
| `FOTOGRAFO` | Fotógrafo |

---

## ⏰ Modalidades de Cobro Válidas

| Modalidad en Excel | Se convierte en BD |
|-------------------|-------------------|
| `HORA` | Por Hora |
| `POR HORA` | Por Hora |
| `JORNADA 10 HORAS` | Jornada 10h |
| `JORNADA 9 HORAS` | Jornada 9h |
| `JORNADA HASTA 10 HORAS` | Jornada hasta 10h |
| `JORNADA NOCTURNA` | Jornada Nocturna |
| `POR EVENTO` | Por Evento |
| `EVENTO` | Por Evento |

---

## 💰 Formato de Valores (Columna VALOR)

El sistema acepta múltiples formatos:

✅ **Formatos válidos:**
- `$ 23.000` (con símbolo y puntos de miles)
- `$23.000` (sin espacio)
- `23.000` (solo número con puntos)
- `23000` (solo número sin formato)

El sistema automáticamente:
- Quita símbolos de $
- Quita espacios
- Quita puntos de miles
- Convierte a número

---

## 🚀 Cómo Usar la Carga Masiva

### **Paso 1: Acceder al módulo**

1. Ve al menú **Personal**
2. Haz clic en el botón **"Carga Masiva"** (icono de Upload)

### **Paso 2: Descargar plantilla (opcional)**

1. En el diálogo, haz clic en **"Descargar Plantilla"**
2. Se descargará un archivo `plantilla_personal.xlsx` con 3 ejemplos
3. Úsalo como referencia para tu archivo

### **Paso 3: Preparar tu archivo**

1. Abre tu Excel con los datos del personal
2. Asegúrate de que las columnas tengan los nombres exactos:
   - `ID`, `NOMBRE`, `CEDULA`, `ROL`, `PRESTA SERVICIOS POR`, `VALOR`
3. La primera fila debe ser el encabezado
4. Los datos empiezan desde la fila 2

**Ejemplo:**

```
| ID | NOMBRE              | CEDULA   | ROL    | PRESTA SERVICIOS POR | VALOR     |
|----|---------------------|----------|--------|---------------------|-----------|
| 1  | Juan Pérez García   | 12345678 | MESERO | HORA                | $ 23.000  |
| 2  | María López Sánchez | 87654321 | COCINA | JORNADA 10 HORAS    | $ 180.000 |
```

### **Paso 4: Seleccionar archivo**

1. Haz clic en **"Haz clic para seleccionar archivo"** o arrastra el archivo
2. El sistema procesará automáticamente los datos
3. Espera unos segundos (depende del tamaño del archivo)

### **Paso 5: Revisar preview**

Verás un resumen con:

- **Total registros**: Cuántas filas se encontraron
- **Válidos**: Cuántos pasaron todas las validaciones ✅
- **Con errores**: Cuántos tienen problemas ❌

**Tabla de preview:**
- Fondo **verde**: Registro válido ✅
- Fondo **rojo**: Registro con errores ❌
- Los errores se muestran debajo del nombre

### **Paso 6: Guardar**

1. Si estás conforme, haz clic en **"Guardar X registros"**
2. El sistema guardará **solo los registros válidos**
3. Los registros con errores se omitirán automáticamente
4. Verás un mensaje con el resultado:
   - "✅ X registros guardados exitosamente"
   - Si hay duplicados: "Y fallaron por cédula duplicada"

---

## ⚠️ Validaciones Automáticas

El sistema valida cada registro y muestra errores si:

| Error | Causa |
|-------|-------|
| **Nombre inválido** | Menos de 3 caracteres o falta apellido |
| **Cédula inválida** | Menos de 6 o más de 12 dígitos, o contiene letras |
| **Rol no reconocido** | El rol no está en la tabla de mapeo |
| **Modalidad no reconocida** | La modalidad no está en la tabla de mapeo |
| **Tarifa inválida** | Valor es 0 o no se pudo convertir a número |
| **Cédula duplicada** | Ya existe un empleado con esa cédula en la BD |

---

## 🎨 Interpretación de la Preview

### **Badge verde con check ✅**
```
✅ OK
Juan Pérez García
CC: 12345678
Mesero | Por Hora
$23,000
```
→ Este registro se guardará sin problemas

### **Badge rojo con X ❌**
```
❌ Error
María López
• Nombre inválido (debe tener nombre y apellido)
• Rol no reconocido: "AYUDANTE"
CC: 87654321
```
→ Este registro NO se guardará, corrige los errores en el Excel

---

## 🔧 Solución de Problemas

### **"No se pudo procesar el archivo Excel"**
**Causa:** El archivo está corrupto o no es un Excel válido
**Solución:**
- Verifica que sea .xlsx o .xls
- Intenta abrir y guardar el archivo de nuevo en Excel
- Usa la plantilla descargable como base

### **"Rol no reconocido"**
**Causa:** El rol en tu Excel no coincide con ninguno de la tabla de mapeo
**Solución:**
- Revisa la tabla de "Roles Válidos" arriba
- Usa exactamente uno de esos nombres (mayúsculas no importan)
- Ejemplo: Usa "MESERO" en vez de "AYUDANTE DE MESERO"

### **"Modalidad no reconocida"**
**Causa:** La modalidad no coincide con la tabla
**Solución:**
- Usa exactamente: `HORA`, `JORNADA 10 HORAS`, `JORNADA 9 HORAS`, etc.
- No uses abreviaciones

### **"Cédula duplicada"**
**Causa:** Ya existe un empleado con esa cédula en la base de datos
**Solución:**
- Ve a la lista de Personal y busca esa cédula
- Si es el mismo empleado, edítalo manualmente en vez de volver a crearlo
- Si es un error, corrige la cédula en el Excel

### **"Todos los registros tienen errores"**
**Causa:** Probablemente las columnas no tienen los nombres correctos
**Solución:**
- Verifica que tu Excel tenga exactamente estas columnas en la fila 1:
  - `ID`, `NOMBRE`, `CEDULA`, `ROL`, `PRESTA SERVICIOS POR`, `VALOR`
- Descarga la plantilla y compara tu archivo

---

## 📊 Límites y Recomendaciones

| Aspecto | Límite/Recomendación |
|---------|---------------------|
| **Registros por archivo** | Máximo 200 (recomendado) |
| **Tamaño de archivo** | Máximo 5 MB |
| **Tiempo de procesamiento** | ~1-3 segundos por cada 50 registros |
| **Formato recomendado** | .xlsx (Excel 2007+) |

**💡 Tip:** Si tienes más de 200 empleados, divide el archivo en varios archivos más pequeños.

---

## 🎯 Casos de Uso

### **Caso 1: Importar personal nuevo de un evento grande**
1. Prepara tu Excel con los 71 empleados
2. Usa la carga masiva
3. Revisa que no haya errores
4. Guarda todos de una vez

### **Caso 2: Migrar de otro sistema**
1. Exporta los datos de tu sistema anterior a Excel
2. Ajusta las columnas para que coincidan con el formato requerido
3. Mapea los roles a los válidos de Selecta
4. Importa con carga masiva

### **Caso 3: Actualización masiva**
❌ **No usar para actualizaciones**
La carga masiva solo sirve para **crear** nuevos empleados, no para actualizar existentes.

Para actualizar, usa la opción de edición individual en la lista de Personal.

---

## 🐛 Debugging

Si algo no funciona, abre la **Consola del Navegador** (F12) y busca:
- Mensajes de error en rojo
- Warnings sobre roles o modalidades no reconocidas
- Errores de inserción en la BD

Luego reporta el problema con esa información.

---

## 📝 Ejemplo Completo

**Archivo Excel: `personal_nuevo.xlsx`**

```excel
| ID | NOMBRE                    | CEDULA    | ROL                              | PRESTA SERVICIOS POR | VALOR      |
|----|---------------------------|-----------|----------------------------------|---------------------|-----------|
| 1  | Carlos Rodríguez Martínez | 11223344  | COORDINACION EN HORARIO NO LABORAL| POR EVENTO          | $ 250.000 |
| 2  | Laura Gómez Pérez         | 55667788  | MESERO                           | HORA                | $ 23.000  |
| 3  | Andrés Silva Torres       | 99887766  | COCINA                           | JORNADA 10 HORAS    | $ 180.000 |
| 4  | Sofía Ramírez Luna        | 44332211  | DECORADOR                        | POR EVENTO          | $ 200.000 |
```

**Resultado después de la carga:**
- ✅ 4 registros válidos
- ✅ 4 guardados exitosamente
- Tiempo: ~2 segundos

---

**Última actualización:** 2025-09-30
**Versión:** 1.0
**Estado:** ✅ Operativo