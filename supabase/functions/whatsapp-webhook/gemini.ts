import { GoogleGenerativeAI } from "npm:@google/generative-ai";
import { ProductOption, ProductStep } from "./productService.ts";

const apiKey = Deno.env.get("GEMINI_API_KEY");
const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;

// Use 'gemini-pro' for better reasoning capabilities
const model = genAI ? genAI.getGenerativeModel({ model: "gemini-pro" }) : null;

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
        ACT AS: An expert Poke Bowl waiter.
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
    currentSelections: string[], // Names of what user JUST picked or currently has
    nextStepLabel: string,
    remainingCount: number | 'varios'
): Promise<string> {
    if (!model) return `✅ Llevas: ${currentSelections.join(', ')}. Siguiente: ${nextStepLabel}.`;

    const prompt = `
    ACT AS: A friendly, cool, and professional Poke Bowl server named "Yoko Bot".
    TONE: Enthusiastic, helpful, concise. Use emojis 🥗🔥🥑.
    
    SITUATION:
    - User has selected: ${currentSelections.length > 0 ? currentSelections.join(', ') : 'Nothing yet'}.
    - Current Step Completed: ${stepLabel}.
    - Next Step: ${nextStepLabel}.
    - Remaining allowed choices in next step: ${remainingCount}.

    TASK: Write a short message (max 140 chars) confirming the selection and guiding to the next step.
    - Don't simply list items, acknowledge them nicely (e.g., "Great choice with the salmon!").
    - Invite them to choose the next step.
    
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
    Message: "${userText}"
    
    Intents:
    - START_BUILDER: User wants to order/build/buy a poke. Keywords: "quiero", "dame", "armar", "hambre", "poke".
    - MENU_QUERY: User asks to see the menu.
    - BURGER_QUERY: User asks about Sushi Burgers.
    - INFO: Hours, location, support.
    - CHAT: Casual greeting or confusing text.

    Output JSON: { "intent": "START_BUILDER", "size_preference": "mediano" | "grande" | null }
    `;

    try {
        const result = await model.generateContent(prompt);
        const text = result.response.text().replace(/```json/g, '').replace(/```/g, '').trim();
        return JSON.parse(text);
    } catch (e) {
        return { intent: 'unknown', entities: {} };
    }
}
