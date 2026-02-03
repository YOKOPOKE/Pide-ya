import { GoogleGenerativeAI } from "npm:@google/generative-ai";
import { ProductOption, ProductStep } from "./productService.ts";

const apiKey = Deno.env.get("GEMINI_API_KEY");
const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;

// Use 'gemini-3-pro-preview' for maximum reasoning and sales capability (User Request - 2026)
const model = genAI ? genAI.getGenerativeModel({ model: "gemini-3-pro-preview" }) : null;

/**
 * Interprets user selection using advanced logic (Slang, context, implicit)
 */
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
        ACT AS: An expert, persuasive Poke Bowl waiter who wants to sell.
        CONTEXT: The user is selecting ingredients for a specific step.
        USER INPUT: "${userText}"
        AVAILABLE OPTIONS (ID: Name):
        ${optionsList}

        TASK: Identify which Option IDs the user intends to select.
        RULES:
        1. Handle synonyms/slang (e.g. "arrocito" -> "Arroz", "palta" -> "Aguacate").
        2. Handle explicit mentions perfectly.
        3. If user says "everything" or "all", return IDs for all options (respecting logic if implicit).
        4. If user says "none" or "skip", return empty list [].
        5. Ignore unrelated text.
        
        OUTPUT: Return ONLY a JSON array of numbers. Example: [101, 102].
        `;

        const result = await model.generateContent(prompt);
        const text = result.response.text();
        const cleanText = text.replace(/```json/g, '').replace(/```/g, '').trim();
        const ids = JSON.parse(cleanText);

        return Array.isArray(ids) ? ids : [];
    } catch (error) {
        console.error("Error interpreting selection:", error);
        return [];
    }
}

/**
 * Generates a friendly, conversational response based on the current context.
 */
export async function generateConversationalResponse(
    stepLabel: string,
    currentSelections: string[], // Names of what user JUST picked
    nextStepLabel: string,
    remainingCount: { included: number, absolute: number | 'varios' },
    fullSummary?: string // NEW: Summary of all previous steps
): Promise<string> {
    if (!model) return `✅ Llevas: ${currentSelections.join(', ')}. Siguiente: ${nextStepLabel}.`;

    const prompt = `
    ACT AS: "Yoko Bot", a world-class sales waiter at Yoko Poke.
    TONE: Enthusiastic but Professional. "Human-like". Short.
    USE EMOJIS: MINIMAL. Only basic ones like 🥗, ✅, 🔥. No emoji spam.
    GOAL: Make the user feel great about their choice and excited for the next one.
    
    SITUATION:
    - User has selected: ${currentSelections.length > 0 ? currentSelections.join(', ') : 'Nothing yet'}.
    - Current Step Completed: ${stepLabel}.
    - Next Step: ${nextStepLabel}.
    - Remaining allowed choices in next step: Included: ${remainingCount.included} (Total allowed: ${remainingCount.absolute}).
    - Full Order Summary So Far: ${fullSummary || 'N/A'}.
    
    GUIDANCE:
    - Briefly acknowledge what they have so far (e.g. "Excellent with the Base and Protein!").
    - If user has NOT reached included limit: "Te falta elegir X más (incluidos)."
    - If user HAS reached included limit but can add more: "¡Listo! ¿Quieres agregar algo más (costo extra) o seguimos?" DO NOT say "Te faltan X". Allow them to stop.

    TASK: Write a short message (max 160 chars) confirming the selection and guiding to the next step.
    - If they picked a premium item, compliment it ("¡Uff, gran elección con el Salmón! 🐟").
    - Create craving for the next step ("Ahora, vamos a darle color con los *${nextStepLabel}*").
    - Be concise but "selling".
    
    OUTPUT: The message string only.
    `;

    try {
        const result = await model.generateContent(prompt);
        return result.response.text().trim();
    } catch (e) {
        return `✅ Listo, agregamos: ${currentSelections.join(', ')}.\nAhora vamos con *${nextStepLabel}*.`;
    }
}

export async function analyzeIntent(
    userText: string
): Promise<{ intent: string, entities: any }> {
    if (!model) return { intent: 'unknown', entities: {} };

    // Robust Intent Prompt
    const prompt = `
    Analyze the user's message in a Poke Restaurant Bot context.
    The user might be hungry, asking questions, or just chatting.
    Message: "${userText}"
    
    Intents:
    - START_BUILDER: User EXPLICITLY wants to BUILD/CUSTOMIZE. Keywords: "armar", "personalizar", "sushi burger" (always builder), "mediano", "grande".
    - MENU_QUERY: General menu, "what do you have", "show menu".
    - CATEGORY_FILTER: User asks for specific category. Keywords: "bebidas", "postres", "ver entradas", "tienes refrescos".
    - INFO: Hours, location.
    - CHAT: Casual greeting.

    Output JSON: { "intent": "START_BUILDER" | "MENU_QUERY" | "CATEGORY_FILTER" | "INFO" | "CHAT", "size_preference": "mediano" | "grande" | null, "category_keyword": "bebida" | "postre" | null }
    `;

    try {
        const result = await model.generateContent(prompt);
        const text = result.response.text().replace(/```json/g, '').replace(/```/g, '').trim();
        return JSON.parse(text);
    } catch (e) {
        return { intent: 'unknown', entities: {} };
    }
}



export interface SalesResponse {
    text: string;
    show_image_url?: string;
    suggested_actions?: string[];
}

/**
 * Generates a conversational response AND determines if an image should be shown.
 */
export async function generateSalesResponse(
    userText: string,
    menuContext: string,
    productList: any[] // Pass full products to find images
): Promise<SalesResponse> {
    if (!model) return { text: "¡Hola! ¿En qué te puedo ayudar hoy? 🥗" };

    const productImagesContext = productList
        .filter(p => p.image_url)
        .map(p => `Product: "${p.name}" -> ImageURL: "${p.image_url}"`)
        .join("\n");

    // Sales Prompt
    const prompt = `
    ACT AS: "Yoko Bot", the best waiter at Yoko Poke.
    GOAL: SELL. Be helpful, persuasive, and VISUAL.
    
    MENU AVAILABLE:
    ${menuContext}
    
    IMAGES AVAILABLE (Use these URLs if explicitly asked or if recommending a specific hero product):
    ${productImagesContext}
    
    USER MESSAGE: "${userText}"
    
    INSTRUCTIONS:
    1. Answer the user's question using the Menu.
    2. If the user asks about a specific product (e.g. "How is the burger?", "Show me the poke"), YOU MUST RETURN ITS IMAGE URL in the JSON.
    3. If you recommend a specific product strongly, also include its image.
    4. Keep text under 200 chars. Use minimal emojis (🥗, 🔥).
    5. return JSON ONLY.
    
    OUTPUT FORMAT:
    {
      "text": "Your friendly response here",
      "show_image_url": "https://... (or null)",
      "suggested_actions": ["Ver Menú", "Pedir Ahora"]
    }
    `;

    try {
        const result = await model.generateContent(prompt);
        const text = result.response.text().replace(/```json/g, '').replace(/```/g, '').trim();
        return JSON.parse(text);
    } catch (e) {
        console.error("Gemini Sales Error:", e);
        return { text: "¡Hola! Se me antojó un Poke. ¿Quieres ver el menú o armar uno? 🥗" };
    }
}
