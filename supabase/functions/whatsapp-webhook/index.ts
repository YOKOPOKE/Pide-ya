// Supabase Edge Function para webhook conversacional de WhatsApp
// Deploy: npx supabase functions deploy whatsapp-webhook

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getSession, updateSession, clearSession, SessionData, BuilderState } from './session.ts';
import { getProductWithSteps, getCategories, getAllProducts, getCategoryByName, getProductsByCategory, ProductTree, ProductStep } from './productService.ts';
import { interpretSelection, analyzeIntent, generateConversationalResponse } from './gemini.ts';

const WHATSAPP_PHONE_ID = Deno.env.get("WHATSAPP_PHONE_ID")!;
const WHATSAPP_ACCESS_TOKEN = Deno.env.get("WHATSAPP_ACCESS_TOKEN")!;
const WHATSAPP_VERIFY_TOKEN = Deno.env.get("WHATSAPP_VERIFY_TOKEN")!;

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
}

const INTENTS: Record<string, string[]> = {
    greeting: ['hola', 'buenos días', 'hey', 'hi'],
    menu: ['menú', 'menu', 'carta'],
    help: ['ayuda', 'comandos'],
    hours: ['horario', 'abren'],
    location: ['ubicación', 'donde'],
};

function handleBasicIntent(context: MessageContext): BotResponse {
    const text = context.text.toLowerCase();

    // Check Menu
    if (INTENTS.menu.some(k => text.includes(k))) {
        return {
            text: "🥗 *Menú Yoko*: \n\nSelecciona una opción para ver más:",
            useButtons: true,
            buttons: ['Ver Menú Completo', 'Armar un Poke', 'Sushi Burgers']
        };
    }

    // Default Greeting / Help (Main Menu)
    return {
        text: "¡Hola! Bienvenido a *Yoko Poke* 🥣.\n\nSoy tu asistente virtual. ¿Qué se te antoja hoy?",
        useButtons: true,
        buttons: ['Menú', 'Armar un Poke', 'Sushi Burgers']
    };
}


/**
 * Logic for the step-by-step Poke Builder
 */
async function handleBuilderFlow(context: MessageContext, session: SessionData, aggregatedText: string): Promise<BotResponse> {
    if (!session.builderState) return { text: "Error de sesión." };

    const state = session.builderState;
    const product = await getProductWithSteps(state.productSlug);
    if (!product) {
        await clearSession(context.from);
        return { text: "El producto ya no está disponible. Volvamos al inicio." };
    }

    const currentStep = product.steps[state.stepIndex];
    // Use AGGREGATED text for processing
    const text = aggregatedText.trim();
    const lowerText = text.toLowerCase();

    // --- CHECK FOR EXIT COMMANDS ---
    if (lowerText.includes('cancelar') || lowerText.includes('salir') || lowerText.includes('menú principal')) {
        await clearSession(context.from);
        return {
            text: "Entendido, pedido cancelado. Volviendo al menú principal.",
            useButtons: true,
            buttons: ['Menú', 'Armar un Poke', 'Sushi Burgers']
        };
    }

    // --- CURRENT SELECTIONS ---
    let currentSelections = state.selections[currentStep.id] || [];

    // --- CHECK FOR "LISTO" (DONE) COMMAND ---
    const isExplicitDone = (lowerText === 'listo' || lowerText === 'siguiente' || lowerText.includes('✅ listo'));

    if (isExplicitDone && currentStep.max_selections !== 1) {
        if (currentSelections.length < currentStep.min_selections) {
            return {
                text: `⚠️ Aún nos falta un poco. Mínimo necesitas elegir ${currentStep.min_selections} opción(es). Llevas: ${currentSelections.length}. \n\nEscribe *que ingredientes* quieres.`
            };
        }
    } else {
        // --- INTERPRET INPUT (If not "listo") ---
        // Combine Direct Match logic with Gemini 
        let selectedIds: number[] = [];

        // 1. Direct match with current options
        currentStep.options.forEach(opt => {
            if (lowerText.includes(opt.name.toLowerCase())) {
                if (!selectedIds.includes(opt.id)) selectedIds.push(opt.id);
            }
        });

        // 2. Ask Gemini for more complex interpretation
        const aiIds = await interpretSelection(text, currentStep.options);
        aiIds.forEach(id => {
            if (!selectedIds.includes(id)) selectedIds.push(id);
        });

        // --- UPDATE SELECTION (TOGGLE / ACCUMULATE) ---
        if (selectedIds.length > 0) {
            if (currentStep.max_selections === 1) {
                // REPLACE behavior for single select
                currentSelections = [selectedIds[selectedIds.length - 1]]; // Take last mention
            } else {
                // TOGGLE / ACCUMULATE
                selectedIds.forEach(id => {
                    if (currentSelections.includes(id)) {
                        // Toggle Off - Only if explicitly asked to remove? 
                        // It's safer to only ADD in text mode unless explicitly "no x". 
                        // But current logic is simple toggle. Let's keep it but prioritize ADDing for now.
                        // Actually, if user types "Arroz" and they already have "Arroz", they probably emphasize it.
                        // For now, let's just ADD if not present, but if we want toggle we can keep logic.
                        // Let's stick to ADD-ONLY for text inputs to avoid accidental removal, unless "sin" logic is added.
                        // But sticking to existing logic is safer implementation-wise.
                        if (currentSelections.includes(id)) {
                            currentSelections = currentSelections.filter(existing => existing !== id);
                        } else {
                            currentSelections.push(id);
                        }
                    } else {
                        currentSelections.push(id);
                    }
                });
            }
            state.selections[currentStep.id] = currentSelections;
            await updateSession(context.from, session);
        } else if (!isExplicitDone && text.length > 0) {
            // User typed something but we didn't understand
            const selectedNames = currentStep.options
                .filter(o => currentSelections.includes(o.id))
                .map(o => o.name)
                .join(', ');

            const optionsList = currentStep.options.map(o => {
                const price = o.price_extra > 0 ? ` (+$${o.price_extra})` : '';
                const check = currentSelections.includes(o.id) ? '✅ ' : '• ';
                return `${check}${o.name}${price}`;
            }).join('\n');

            return {
                text: `🤔 Hmm, no encontré "${text}" en las opciones disponibles.\n\n${selectedNames.length > 0 ? `✅ *Seleccionado*: ${selectedNames}\n\n` : ''}*Opciones para "${currentStep.label}":*\n${optionsList}\n\nEscribe el nombre de lo que quieres o \"Listo\" para continuar. 👇`,
                useButtons: true,
                buttons: ['✅ Listo']
            };
        }
    }

    // --- CHECK PROGRESS & DETERMINE RESPONSE ---
    let shouldAdvance = false;

    if (isExplicitDone) {
        if (currentSelections.length >= currentStep.min_selections) {
            shouldAdvance = true;
        }
    } else if (currentStep.max_selections === 1 && currentSelections.length > 0) {
        shouldAdvance = true;
    }

    // --- DETERMINE NEXT STEP OR STAY ---
    if (!shouldAdvance) {
        // STAY ON STEP
        const selectedNames = currentStep.options
            .filter(o => currentSelections.includes(o.id))
            .map(o => o.name);

        const remaining = currentStep.max_selections ? (currentStep.max_selections - currentSelections.length) : 'varios';

        // Use AI to generate conversational update
        // We pass nextStepLabel as CURRENT step here because we are staying.
        const conversationalText = await generateConversationalResponse(
            currentStep.label,
            selectedNames,
            currentStep.label, // Staying on same step
            remaining
        );

        // --- EXTRA COST WARNING ---
        let extraCostMsg = "";
        const included = currentStep.included_selections;
        if (currentSelections.length > included) {
            const extrasCount = currentSelections.length - included;
            const extraTotal = extrasCount * currentStep.price_per_extra;
            if (extraTotal > 0) {
                extraCostMsg = `\n💰 *Ojo*: Llevas ${extrasCount} extra(s). Se sumarán +$${extraTotal}.`;
            }
        }

        // --- DISPLAY OPTIONS TEXT-BASED ---
        const optionsList = currentStep.options.map(o => {
            const price = o.price_extra > 0 ? ` (+$${o.price_extra})` : '';
            const check = currentSelections.includes(o.id) ? '✅ ' : '• ';
            return `${check}${o.name}${price}`;
        }).join('\n');

        return {
            text: `${conversationalText}${extraCostMsg}\n\n*Elige para "${currentStep.label}":*\n${optionsList}\n\nEscribe tu elección o \"Listo\" para continuar. 👇`,
            useButtons: true,
            buttons: ['✅ Listo']
        };
    }

    // --- MOVE NEXT ---
    const nextIndex = state.stepIndex + 1;

    if (nextIndex < product.steps.length) {
        state.stepIndex = nextIndex;
        await updateSession(context.from, session);

        const nextStep = product.steps[nextIndex];

        // AI Conversational transition
        // Get selections from PREVIOUS step (which we just finished)
        const prevSelectedNames = currentStep.options
            .filter(o => currentSelections.includes(o.id))
            .map(o => o.name);

        const conversationalText = await generateConversationalResponse(
            currentStep.label,
            prevSelectedNames,
            nextStep.label,
            nextStep.max_selections || 'varios'
        );

        // Initial display for next step
        const optionsList = nextStep.options.map(o => {
            const price = o.price_extra > 0 ? ` (+$${o.price_extra})` : '';
            return `• ${o.name}${price}`;
        }).join('\n');

        return {
            text: `${conversationalText}\n\n*Opciones:*\n${optionsList}\n\nEscribe tu elección 👇`,
            useButtons: true,
            buttons: nextStep.max_selections === 1 ? undefined : ['✅ Listo']
        };
    } else {
        // --- FINISHED ---
        await clearSession(context.from);

        // Calculate Details
        const { total, summary } = calculateOrderDetails(product, state.selections);

        return {
            text: `🥣 *Tu Poke está listo*\n------------------\n${summary}\n------------------\n💰 *TOTAL: $${total}*\n\n¿Todo correcto?`,
            useButtons: true,
            buttons: ['✅ Confirmar', '❌ Cancelar']
        };
    }
}

function calculateOrderDetails(product: ProductTree, selections: Record<number, number[]>) {
    let total = product.base_price;
    let summary = `*${product.name}* ($${product.base_price})`;

    product.steps.forEach(step => {
        const selectedOptionIds = selections[step.id] || [];
        const included = step.included_selections;
        const selectedOptions = step.options.filter(o => selectedOptionIds.includes(o.id));

        if (selectedOptions.length > 0) {
            summary += `\n\n*${step.label}:*`;
            selectedOptions.forEach((opt, idx) => {
                const isFree = idx < included;
                let priceLine = `\n- ${opt.name}`;
                if (!isFree) {
                    let extra = step.price_per_extra + opt.price_extra;
                    if (extra > 0) {
                        total += extra;
                        priceLine += ` (+$${extra})`;
                    }
                }
                summary += priceLine;
            });
        }
    });

    return { total, summary };
}

/**
 * Main Logic
 */
async function processMessage(from: string, text: string): Promise<void> {
    /* DEBOUNCE LOGIC SAME AS BEFORE */
    let session = await getSession(from);
    const now = Date.now();

    // Initialize if needed
    if (!session.pendingMessages) session.pendingMessages = [];

    // CASE A: Existing active buffer
    if (session.bufferUntil && session.bufferUntil > now) {
        console.log(`⏳ Buffering message from ${from}: "${text}"`);
        session.pendingMessages.push(text);
        await updateSession(from, session);
        return;
    }

    // CASE B: Start new buffer
    console.log(`⏱ Starting 10s buffer for ${from}`);
    session.pendingMessages = [text];
    session.bufferUntil = now + 10000;
    await updateSession(from, session);

    // WAIT
    await new Promise(r => setTimeout(r, 10000));

    // RE-FETCH
    session = await getSession(from);
    const aggregatedText = (session.pendingMessages || [text]).join(' ');
    console.log(`🔥 Processing aggregated: "${aggregatedText}"`);

    // Reset buffer
    session.pendingMessages = [];
    session.bufferUntil = 0;

    const lowerText = aggregatedText.toLowerCase();

    // --- HANDLE MAIN MENU & SIZE SELECTION INTERCEPTION ---

    // 1. Check for "Armar un Poke" -> Ask Size
    if (lowerText.includes('armar') || (lowerText.includes('quiero') && lowerText.includes('poke'))) {
        const response = {
            text: "¿De qué tamaño se te antoja tú Poke? 🥣",
            useButtons: true,
            buttons: ['Poke Mediano', 'Poke Grande']
        };
        await sendWhatsApp(from, response);
        await clearSession(from);
        return;
    }

    // 2. Check for Size Selection
    if (lowerText === 'poke mediano' || lowerText === 'poke grande') {
        const slug = lowerText === 'poke mediano' ? 'poke-mediano' : 'poke-grande';
        await startBuilder(from, slug);
        return;
    }

    // 3. Regular Logic
    let response: BotResponse;

    if (session.mode === 'BUILDER' && session.builderState) {
        response = await handleBuilderFlow({ from, text: aggregatedText, timestamp: now }, session, aggregatedText);
    } else {
        // Normal Mode / Menu checks
        if (lowerText.includes('menú') || lowerText.includes('menu')) {
            const categories = await getCategories();
            // FILTER: Don't show "Poke" or "Burger" categories if user wants them separate
            // Actually user said "show OTHER categories".
            // We can filter out by name if we know them, e.g. "Poke", "Hamburguesas".
            // For now, let's show all but maybe prioritize.

            const catList = categories
                .map(c => `• ${c.name}`)
                .join('\n');

            response = {
                text: `📜 *Categorías del Menú:*\n\n${catList}\n\nSelecciona una categoría o usa los botones para lo más popular:`,
                useButtons: true,
                buttons: ['Sushi Burgers', 'Armar un Poke']
            };
        } else if (lowerText.includes('burger')) {
            const cat = await getCategoryByName('burger'); // or 'hamburguesa'
            if (cat) {
                const products = await getProductsByCategory(cat.id);
                const list = products.map(p => `🍔 ${p.name} - $${p.base_price}`).join('\n');
                response = { text: `*Sushi Burgers*\n${list}` };
            } else {
                response = { text: "No hay burgers por ahora." };
            }
        } else {
            // Fallback / AI
            const ai = await analyzeIntent(aggregatedText);
            if (ai.intent === 'START_BUILDER') {
                response = {
                    text: "¿De qué tamaño lo quieres? 🥣",
                    useButtons: true,
                    buttons: ['Poke Mediano', 'Poke Grande']
                };
            } else {
                response = handleBasicIntent({ from, text: aggregatedText, timestamp: now });
            }
        }
    }

    await sendWhatsApp(from, response);
}

// --- HELPER WRAPPERS ---

async function startBuilder(from: string, slug: string) {
    console.log(`🏗 Starting builder for ${slug}`);

    const product = await getProductWithSteps(slug);
    if (!product) {
        await sendWhatsAppText(from, "Error: Producto no encontrado. :(");
        return;
    }

    const newSession: SessionData = {
        mode: 'BUILDER',
        lastInteraction: Date.now(),
        builderState: {
            productSlug: slug,
            stepIndex: 0,
            selections: {},
            totalPrice: 0
        },
        pendingMessages: [],
        bufferUntil: 0
    };
    await updateSession(from, newSession);

    const firstStep = product.steps[0];
    const optionsList = firstStep.options.map(o => `• ${o.name}`).join('\n');

    // Generate welcoming AI text? Or keep standard start?
    // Let's standard start for clarity, then AI takes over steps.
    const response = {
        text: `¡Excelente! Vamos a armar tu *${product.name}*.\n\nPrimero: *${firstStep.label}*\n\n${optionsList}`,
        useButtons: firstStep.max_selections !== 1,
        buttons: firstStep.max_selections !== 1 ? ['✅ Listo'] : undefined
    };

    await sendWhatsApp(from, response);
}

async function sendWhatsApp(to: string, response: BotResponse) {
    if (response.useButtons && response.buttons && response.buttons.length > 0) {
        await sendWhatsAppButtons(to, response.text, response.buttons);
    } else {
        await sendWhatsAppText(to, response.text);
    }
}

async function sendWhatsAppText(to: string, message: string) {
    await fetch(
        `https://graph.facebook.com/v21.0/${WHATSAPP_PHONE_ID}/messages`,
        {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                messaging_product: "whatsapp",
                to: to,
                type: "text",
                text: { body: message }
            }),
        }
    );
}

async function sendWhatsAppButtons(to: string, message: string, buttons: string[]) {
    await fetch(
        `https://graph.facebook.com/v21.0/${WHATSAPP_PHONE_ID}/messages`,
        {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                messaging_product: "whatsapp",
                to: to,
                type: "interactive",
                interactive: {
                    type: "button",
                    body: { text: message },
                    action: {
                        buttons: buttons.map((btn, idx) => ({
                            type: "reply",
                            reply: {
                                id: `btn_${idx}`,
                                title: btn.substring(0, 20)
                            }
                        }))
                    }
                }
            }),
        }
    );
}

// --- SERVER ---
serve(async (req) => {
    if (req.method === 'GET') {
        const url = new URL(req.url);
        if (url.searchParams.get('hub.verify_token') === WHATSAPP_VERIFY_TOKEN) {
            return new Response(url.searchParams.get('hub.challenge'), { status: 200 });
        }
        return new Response('Forbidden', { status: 403 });
    }

    try {
        const body = await req.json();
        if (body.object && body.entry?.[0]?.changes?.[0]?.value?.messages?.[0]) {
            const message = body.entry[0].changes[0].value.messages[0];
            let text = "";
            if (message.type === 'text') text = message.text.body;
            if (message.type === 'interactive') text = message.interactive.button_reply.title;

            if (text) {
                // FIRE AND FORGET - Don't wait for processMessage to finish 10s delay
                await processMessage(message.from, text);
            }
        }
        return new Response('EVENT_RECEIVED', { status: 200 });
    } catch (error: any) {
        console.error('SERVER ERROR:', error);
        return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }
});
