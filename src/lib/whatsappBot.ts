import { createClient } from '@/lib/supabase';
import { getSession, updateSession, clearSession, SessionData, BuilderState } from './whatsappSession';
import { getProductWithSteps, ProductTree, ProductStep } from './productService';
import { interpretSelection, analyzeIntent } from './gemini';

// Types
export interface MessageContext {
    from: string;
    text: string;
    timestamp: number;
}

export interface BotResponse {
    text: string;
    useButtons?: boolean;
    buttons?: string[];
    useList?: boolean;
    listItems?: { id: string; title: string; description?: string }[];
}

/**
 * Main Handler that routes between Normal Chat and Builder Mode
 */
export async function generateResponse(context: MessageContext): Promise<BotResponse> {
    const session = await getSession(context.from);

    // 1. Check if user is in Builder Mode
    if (session.mode === 'BUILDER' && session.builderState) {
        return handleBuilderFlow(context, session);
    }

    // 2. Normal Mode Processing
    const aiAnalysis = await analyzeIntent(context.text);

    if (aiAnalysis.intent === 'START_BUILDER') {
        // Init Builder Session
        // Default to 'poke-mediano' for now, or use intelligence if detected
        const initialSlug = 'poke-mediano'; // Could logic verify size_preference

        const newSession: SessionData = {
            mode: 'BUILDER',
            lastInteraction: Date.now(),
            builderState: {
                productSlug: initialSlug,
                stepIndex: 0,
                selections: {},
                totalPrice: 0
            }
        };
        await updateSession(context.from, newSession);

        // Fetch first step to greet
        const product = await getProductWithSteps(initialSlug);
        if (!product) return { text: "Lo siento, tuve un problema accediendo al menú. Intenta más tarde." };

        const firstStep = product.steps[0];

        return {
            text: `¡Excelente elección! Vamos a armar tu *${product.name}* 🥗.\n\nPrimero: *${firstStep.label}*\n(Elige hasta ${firstStep.max_selections || 'varios'})`,
            useButtons: true,
            buttons: firstStep.options.slice(0, 3).map(o => o.name) // WhatsApp limit 3 buttons
        };
    }

    // Fallback to basic keywords if AI wasn't decisive or explicitly OTHER
    return handleBasicIntent(context);
}

/**
 * Logic for the step-by-step Poke Builder
 */
async function handleBuilderFlow(context: MessageContext, session: SessionData): Promise<BotResponse> {
    if (!session.builderState) return { text: "Error de sesión." };

    const state = session.builderState;
    const product = await getProductWithSteps(state.productSlug);
    if (!product) {
        await clearSession(context.from);
        return { text: "El producto ya no está disponible. Volvamos al inicio." };
    }

    const currentStep = product.steps[state.stepIndex];

    // --- CHECK FOR EXIT COMMANDS ---
    if (context.text.toLowerCase().includes('cancelar') || context.text.toLowerCase().includes('salir')) {
        await clearSession(context.from);
        return { text: "Entendido, pedido cancelado. ¿En qué más puedo ayudarte?" };
    }

    // --- INTERPRET INPUT ---
    // User sent a message responding to the current step
    const selectedIds = await interpretSelection(context.text, currentStep.options);

    if (selectedIds.length === 0) {
        // AI didn't understand -> Show options again
        const optionsList = currentStep.options.map(o => `• ${o.name}`).join('\n');
        return {
            text: `No entendí bien tu elección para *${currentStep.label}*.\n\nPor favor elige de la lista:\n${optionsList}`,
            useButtons: true,
            buttons: currentStep.options.slice(0, 3).map(o => o.name)
        };
    }

    // --- UPDATE SELECTION ---
    const currentSelections = state.selections[currentStep.id] || [];
    // Simple logic: Add to existing? Or replace? 
    // For WhatsApp simplicity, let's assume "Replace" logic usually, or "Add" if explicitly said?
    // Let's assume the user states ALL they want for this step now.
    // Actually, safest is to Append if it's a multi-select, Replace if single.

    let newSelectionsForStep: number[] = [];
    if (currentStep.max_selections === 1) {
        newSelectionsForStep = [selectedIds[0]];
    } else {
        // If they just said one thing, maybe they want to add it?
        // But preventing duplicate adds is good. 
        // Let's just use the AI result as the "Current Valid Set" for this turn.
        newSelectionsForStep = [...selectedIds];
        // Merge with previous if needed? No, let's ask "Algo más?" if not satisfied.
        // Complex logic simplified: The AI extracts ALL items mentioned. 
        // If the user says "Salmon", we assume just Salmon.
    }

    // Check Limits
    if (currentStep.min_selections > newSelectionsForStep.length) {
        return {
            text: `Necesitas elegir al menos ${currentStep.min_selections} opción(es) para ${currentStep.label}.`,
            useButtons: false
        };
    }
    if (currentStep.max_selections && newSelectionsForStep.length > currentStep.max_selections) {
        return {
            text: `Solo puedes elegir máximo ${currentStep.max_selections} opciones. Por favor intenta de nuevo.`
        };
    }

    // Save Selection
    state.selections[currentStep.id] = newSelectionsForStep;

    // --- MOVE NEXT ---
    const nextIndex = state.stepIndex + 1;

    if (nextIndex < product.steps.length) {
        // Advance Step
        state.stepIndex = nextIndex;
        // Recalculate Total (simplified estimation)
        // Ideally we call a calculateTotal function similar to Builder.tsx

        await updateSession(context.from, session);

        const nextStep = product.steps[nextIndex];
        const buttons = nextStep.options.slice(0, 3).map(o => o.name);

        return {
            text: `¡Listo! Agregado.\n\nAhora vamos con: *${nextStep.label}*.\n(Elige ${nextStep.max_selections ? 'hasta ' + nextStep.max_selections : 'tu gusto'})`,
            useButtons: buttons.length > 0,
            buttons: buttons.length > 0 ? buttons : undefined
        };
    } else {
        // --- FINISHED ---
        await clearSession(context.from); // Or save as "COMPLETED_ORDER"

        // Calculate Final Price
        const total = calculateTotal(product, state.selections);

        return {
            text: `¡Genial! Tu Poke *${product.name}* está listo. 🥣\n\n💰 *Total: $${total}*\n\n¿Te gustaría confirmar el pedido? (Esta parte se conectaría con Stripe/Pago)`,
            useButtons: true,
            buttons: ['✅ Confirmar', '❌ Cancelar']
        };
    }
}

/**
 * Re-implementation of pricing logic
 */
function calculateTotal(product: ProductTree, selections: Record<number, number[]>) {
    let total = product.base_price;

    product.steps.forEach(step => {
        const selectedOptionIds = selections[step.id] || [];
        const included = step.included_selections;

        // Find the actual option objects
        const selectedOptions = step.options.filter(o => selectedOptionIds.includes(o.id));

        selectedOptions.forEach((opt, idx) => {
            const isFree = idx < included;
            if (!isFree) {
                total += step.price_per_extra;
                total += opt.price_extra;
            }
        });
    });

    return total;
}

// --- BASIC HANDLER (Old Logic) ---

const INTENTS = {
    greeting: ['hola', 'buenos días', 'hey'],
    menu: ['menú', 'menu', 'carta'],
    help: ['ayuda', 'comandos'],
    hours: ['horario', 'abren'],
    location: ['ubicación', 'donde'],
};

function handleBasicIntent(context: MessageContext): BotResponse {
    const text = context.text.toLowerCase();

    if (INTENTS.menu.some(k => text.includes(k))) {
        return {
            text: "🥗 *Menú Yoko*: \n\n1. Poke Mediano\n2. Poke Grande\n\nEscribe *'Quiero un poke'* para empezar a armarlo paso a paso.",
            useButtons: true,
            buttons: ['Quiero un Poke', 'Ver Horarios']
        };
    }

    // Default Greeting / Help
    return {
        text: "¡Hola! Soy el asistente virtual de Yoko Poke. 🤖\n\nPuedes pedirme:\n- Ver Menú\n- Horarios\n- *Armar un Poke*",
        useButtons: true,
        buttons: ['Ver Menú', 'Quiero armar un Poke']
    };
}

export async function saveConversation(from: string, message: string, response: string) {
    // Optional tracking implementation
}
