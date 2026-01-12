import { GoogleGenerativeAI } from "@google/generative-ai";
import { ProductOption } from "./productService";

const apiKey = process.env.GEMINI_API_KEY;
const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;

// Modelo ligero para rapidez
const model = genAI ? genAI.getGenerativeModel({ model: "gemini-1.5-flash" }) : null;

export async function interpretSelection(
    userText: string,
    availableOptions: ProductOption[]
): Promise<number[]> {
    if (!model) {
        console.error("Gemini API Key not found");
        return [];
    }

    try {
        const optionsList = availableOptions.map(o => `${o.id}: ${o.name}`).join("\n");
        const prompt = `
        Actúa como un asistente de pedidos de Poke bowls estrictamente lógico.
        El usuario dice: "${userText}"
        Las opciones disponibles son (ID: Nombre):
        ${optionsList}

        Tu tarea es identificar qué IDs de opciones corresponden a lo que el usuario pidió.
        - Si el usuario menciona algo que coincide claramente, devuelve el ID.
        - Se flexible (ej: "arrocito" = "Arroz Gohan").
        - Si pide multiples cosas, devuelve todos los IDs.
        - Si no coincide nada, devuelve lista vacía.
        - Responde SOLO con un array JSON de números. Ej: [101, 104]
        `;

        const result = await model.generateContent(prompt);
        const response = result.response;
        const text = response.text();

        // Limpiar bloques de código si existen
        const cleanText = text.replace(/```json/g, '').replace(/```/g, '').trim();
        const ids = JSON.parse(cleanText);

        return Array.isArray(ids) ? ids : [];
    } catch (error) {
        console.error("Error interpreting selection with Gemini:", error);
        return [];
    }
}

export async function analyzeIntent(
    userText: string
): Promise<{ intent: string, entities: any }> {
    if (!model) return { intent: 'unknown', entities: {} };

    // Prompt simple para detectar intención de inicio de flujo
    const prompt = `
    Analiza el siguiente mensaje de un usuario en un contexto de restaurante de Poke Bowls.
    Mensaje: "${userText}"
    
    Categorías posibles:
    - START_BUILDER: El usuario quiere pedir, ordenar, armar, o comprar un poke. (Ej: "quiero un poke", "dame un bowl", "hambre")
    - INFO: Pregunta horarios, ubicación, menú general.
    - STATUS: Pregunta por su pedido.
    - OTHER: Conversación casual o no relacionada.

    Si es START_BUILDER, intenta extraer el tamaño si se menciona (chico/mediano/grande).
    
    Salida JSON esperada: { "intent": "START_BUILDER", "size_preference": "mediano" | null }
    `;

    try {
        const result = await model.generateContent(prompt);
        const text = result.response.text().replace(/```json/g, '').replace(/```/g, '').trim();
        return JSON.parse(text);
    } catch (e) {
        return { intent: 'unknown', entities: {} };
    }
}
