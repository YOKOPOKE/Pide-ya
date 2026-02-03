import { createClient } from '@/lib/supabase';
import { getSession, updateSession, clearSession, SessionData, BuilderState } from './whatsappSession';
import { getProductWithSteps, ProductTree, ProductStep } from './productService';
import { interpretSelection, analyzeIntent } from './gemini';
import { calculateProductTotal } from './pricing';

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

// Helper constant
const SESSION_TIMEOUT_MS = 2 * 60 * 60 * 1000; // 2 Hours

// --- Helper para Historial ---
async function getChatHistory(phone: string, limit = 15): Promise<string[]> {
    const supabase = createClient();
    const { data } = await supabase
        .from('chat_history')
        .select('message, sender')
        .eq('phone', phone)
        .order('created_at', { ascending: false })
        .limit(limit);

    if (!data) return [];

    // Convertir a formato texto cronológico (reverse)
    return data.reverse().map(row => `${row.sender === 'user' ? 'Usuario' : 'Bot'}: ${row.message}`);
}

/**
 * Main Handler that routes between Normal Chat and Builder Mode
 */
export async function generateResponse(context: MessageContext): Promise<BotResponse> {
    const session = await getSession(context.from);
    const now = Date.now();

    // 0. CHECK TIMEOUT (2 Hours)
    // Si pasaron horas sin hablar, reseteamos para saludar de nuevo como POKI.
    if (session.lastInteraction && (now - session.lastInteraction > SESSION_TIMEOUT_MS)) {
        await clearSession(context.from);
        // Force session reload implies mode becomes NORMAL
        session.mode = 'NORMAL';
        session.builderState = undefined;
        console.log(`⏰ Sesión expirada para ${context.from}. Reiniciando saludo.`);
    }

    // 1. Check if user is in Builder Mode
    if (session.mode === 'BUILDER' && session.builderState) {
        return handleBuilderFlow(context, session);
    }

    // 2. ⚡ FAST PASS: Basic Regex Checks (Instant Response)
    // Avoids AI latency for simple Greetings or "Menu" keywords
    const lowerText = context.text.toLowerCase();
    const isGreeting = INTENTS.greeting.some(k => lowerText.includes(k));
    const isMenu = INTENTS.menu.some(k => lowerText.includes(k));

    if (isGreeting || isMenu) {
        console.log("⚡ Fast Pass triggered for:", context.text);
        return handleBasicIntent(context);
    }

    // 3. Fetch History for Context
    const history = await getChatHistory(context.from);

    // 3. AI Analysis with Memory
    const aiAnalysis = await analyzeIntent(context.text, history);
    console.log("🧠 Elite AI Intent:", aiAnalysis);

    if (aiAnalysis.intent === 'START_BUILDER') {
        const defaultSlug = aiAnalysis.entities?.product_hint || 'poke-mediano';
        const initialSlug = defaultSlug.includes('grande') ? 'poke-grande' : 'poke-mediano';

        const product = await getProductWithSteps(initialSlug);

        if (!product) return { text: "No encontré ese tamaño de poke. ¿Pruebas el mediano?" };

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

        const firstStep = product.steps[0];
        return {
            text: `¡Vamos a armar tu *${product.name}*! 🥣\n\nPrimero: *${firstStep.label}*`,
            useButtons: true,
            buttons: firstStep.options.slice(0, 3).map(o => o.name)
        };
    }

    if (aiAnalysis.intent === 'ADD_TO_CART') {
        const productHint = aiAnalysis.entities?.product_hint;
        if (!productHint) return { text: "¿Qué producto te gustaría agregar?" };

        return {
            text: `✅ Entendido. He agregado *"${productHint}"* a tu pedido (Simulado).\n\n¿Deseas algo más?`,
            useButtons: true,
            buttons: ['Ver Carrito', 'Confirmar Pedido']
        };
    }

    if (aiAnalysis.intent === 'INFO') {
        return { text: "📍 Estamos en la Calle Principal #123. Abrimos de 12pm a 10pm. ⏰" };
    }

    // Fallback
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
    const selectedIds = await interpretSelection(context.text, currentStep.options);

    if (selectedIds.length === 0) {
        const optionsList = currentStep.options.map(o => `• ${o.name}`).join('\n');
        return {
            text: `Mmm, no estoy seguro de cuál opción es esa para *${currentStep.label}*. 🤔\n\nPor favor selecciona una de las siguientes:\n${optionsList}`,
            useButtons: true,
            buttons: currentStep.options.slice(0, 3).map(o => o.name)
        };
    }

    // --- UPDATE SELECTION ---
    let newSelectionsForStep: number[] = [];
    if (currentStep.max_selections === 1) {
        newSelectionsForStep = [selectedIds[0]];
    } else {
        newSelectionsForStep = [...selectedIds];
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
        state.stepIndex = nextIndex;
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
        await clearSession(context.from);

        // Calculate Final Price
        const total = calculateProductTotal(product, state.selections);

        // --- UPSELLING STRATEGY (Elite) ---
        const upsellMessage = "\n\n💡 *Sugerencia*: ¿Te gustaría agregar una **Coca-Cola** o un **Postre** para completar tu experiencia?";

        return {
            text: `¡Genial! Tu Poke *${product.name}* está listo. 🥣\n\n💰 *Total: $${total}*${upsellMessage}\n\n¿Confirmamos el pedido o deseas agregar algo más?`,
            useButtons: true,
            buttons: ['✅ Confirmar', 'Agregar Coca-Cola', 'Agregar Postre']
        };
    }
}

// --- BASIC HANDLER ---
const INTENTS = {
    menu: ['menú', 'menu', 'carta'],
    greeting: ['hola', 'buenas', 'hey', 'que tal', 'inicio']
};

function handleBasicIntent(context: MessageContext): BotResponse {
    const text = context.text.toLowerCase();

    // Explicit greeting or fallback
    return {
        text: `¡Hola! 👋 Soy *POKI* 🤖, el asistente virtual de Yoko Poke.\n\n✨ *Experiencia Visual*: Descubre nuestro menú interactivo con fotos irresistibles y ofertas exclusivas aquí:\n👉 https://yokopoke.mx\n\nO si prefieres, ¡puedo tomar tu orden directamente por aquí! ¿Qué se te antoja hoy? 🥣`,
        useButtons: true,
        buttons: ['Ver Menú', 'Armar un Poke']
    };
}

export async function saveConversation(from: string, userMessage: string, botResponse: string) {
    try {
        const supabase = createClient();
        await supabase.from('chat_history').insert({ phone: from, message: userMessage, sender: 'user' });
        await supabase.from('chat_history').insert({ phone: from, message: botResponse, sender: 'bot' });
    } catch (error) {
        console.error('Failed to save conversation:', error);
    }
}
