import type { IngredienteCatalogo } from "@/types/cotizador";
import { supabase } from "@/integrations/supabase/client";

export interface GeneratedRecipe {
  nombre: string;
  categoria: "Bebida" | "Entrada" | "Fuerte" | "Guarnición" | "Pasaboca" | null;
  tipo_menu: "Menu General" | "Armalo a tu Gusto";
  porciones_receta: number;
  tiempo_preparacion: string;
  temperatura_coccion: string;
  rendimiento: string;
  notas: string;
  ingredientes: Array<{
    ingrediente_id: string;
    nombre: string;
    cantidad: number;
    unidad: string;
  }>;
}

export async function generateRecipeFromDescription(
  description: string,
  ingredientesDisponibles: IngredienteCatalogo[]
): Promise<GeneratedRecipe> {
  const catalogoStr = ingredientesDisponibles
    .map((i) => `- id: "${i.id}", nombre: "${i.nombre}", unidad: "${i.unidad}"`)
    .join("\n");

  const systemPrompt = `Eres un chef experto colombiano. El usuario describe un plato y debes generar una receta estructurada usando SOLO los ingredientes disponibles en el catálogo.

Catálogo de ingredientes disponibles:
${catalogoStr}

Responde SOLO con JSON válido (sin markdown, sin backticks) con esta estructura exacta:
{
  "nombre": "string",
  "categoria": "Bebida" | "Entrada" | "Fuerte" | "Guarnición" | "Pasaboca" | null,
  "tipo_menu": "Menu General" | "Armalo a tu Gusto",
  "porciones_receta": number,
  "tiempo_preparacion": "string (ej: 45 minutos)",
  "temperatura_coccion": "string (ej: 180°C)",
  "rendimiento": "string (ej: 10 porciones)",
  "notas": "string",
  "ingredientes": [
    {
      "ingrediente_id": "id del catálogo",
      "nombre": "nombre del ingrediente",
      "cantidad": number,
      "unidad": "unidad del catálogo"
    }
  ]
}

Reglas:
- Usa SOLO ingredientes del catálogo proporcionado (por su id exacto)
- Las cantidades deben estar en la unidad base del ingrediente del catálogo
- Si un ingrediente necesario NO existe en el catálogo, omítelo de la lista y menciónalo en "notas" indicando qué falta
- porciones_receta es el número de porciones que rinde la receta
- Si el usuario menciona cantidad de personas, úsala como porciones_receta`;

  const { data, error } = await supabase.functions.invoke("generate-recipe", {
    body: {
      model: "claude-sonnet-4-20250514",
      max_tokens: 2048,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: description,
        },
      ],
    },
  });

  if (error) {
    throw new Error(`Error al llamar la función: ${error.message}`);
  }

  const text = data?.content?.[0]?.text;
  if (!text) {
    throw new Error("Respuesta vacía de la API");
  }

  try {
    return JSON.parse(text) as GeneratedRecipe;
  } catch {
    throw new Error("La API no retornó JSON válido. Intenta de nuevo con una descripción más clara.");
  }
}
