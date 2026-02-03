// Supabase Edge Function para webhook conversacional de WhatsApp
// Deploy: npx supabase functions deploy whatsapp-webhook

// import { serve } from "https://deno.land/std@0.168.0/http/server.ts"; // DEPRECATED
import { getSession, updateSession, clearSession, SessionData, BuilderState, CheckoutState } from './session.ts';
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
        text: "¡Konnichiwa! 🎌 Bienvenido a *Yoko Poke* 🥣\n\nSoy *POKI*, tu asistente personal 🤖✨.\n\nEstoy aquí para tomar tu orden volando 🚀. Puedes pedirme lo que quieras por chat o ordenar muy rapido en nuestra pagina \n🌐 https://yokopoke.mx\n\n¿Qué se te antoja probar hoy? 🥢",
        useButtons: false
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
    if (lowerText.includes('cancelar') || lowerText.includes('salir') || lowerText.includes('menú principal') || lowerText === 'menu' || lowerText === 'menú') {
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

    // If user says "Listo", they want to advance - respect that choice
    // No minimum validation when explicitly done
    if (!isExplicitDone) {
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
                        // Toggle logic kept but prioritize ADD
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
                const extra = o.price_extra || 0;
                const price = extra > 0 ? ` (+$${extra})` : '';
                const check = currentSelections.includes(o.id) ? '✅ ' : '• ';
                return `${check}${o.name}${price}`;
            }).join('\n');

            return {
                text: `🤔 Hmm, no encontré "${text}" en las opciones disponibles.\n\n${selectedNames.length > 0 ? `✅ *Seleccionado*: ${selectedNames}\n\n` : ''}*Opciones para "${currentStep.label}":*\n${optionsList}\n\nEscribe el nombre de lo que quieres o "Listo" para continuar. 👇`,
                useButtons: true,
                buttons: ['✅ Listo']
            };
        }
    }

    // --- CHECK PROGRESS & DETERMINE RESPONSE ---
    let shouldAdvance = false;

    if (isExplicitDone) {
        // User explicitly wants to advance - always allow it
        shouldAdvance = true;
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
            currentStep.label || '',
            selectedNames,
            currentStep.label || '', // Staying on same step
            remaining
        );

        // --- EXTRA COST WARNING ---
        let extraCostMsg = "";
        const included = currentStep.included_selections || 0;
        if (currentSelections.length > included) {
            const extrasCount = currentSelections.length - included;
            const extraTotal = extrasCount * (currentStep.price_per_extra || 0);
            if (extraTotal > 0) {
                extraCostMsg = `\n💰 *Ojo*: Llevas ${extrasCount} extra(s). Se sumarán +$${extraTotal}.`;
            }
        }

        // --- DISPLAY OPTIONS TEXT-BASED ---
        // Calculate remaining included slots
        const stepIncluded = currentStep.included_selections || 0;
        const currentCount = currentSelections.length;
        const remainingIncluded = Math.max(0, stepIncluded - currentCount);

        const optionsList = currentStep.options.map(o => {
            // Price logic:
            // If we have remaining included slots, price is 0 (unless option has specific surcharge).
            // If no remaining included slots, add price_per_extra + option surcharge.

            /* 
               COMPLEXITY: 
               If I select this option NOW, will it be free or extra?
               It depends on whether I have slots left.
               BUT visual list is static for all options.
               So, "Next selection price".
            */

            let displayPrice = "";
            let baseExtra = currentStep.price_per_extra || 0;
            let optExtra = o.price_extra || 0;

            // Logic: Is this option ALREADY selected?
            const isSelected = currentSelections.includes(o.id);
            const selectionIndex = currentSelections.indexOf(o.id);

            if (!isSelected) {
                // Potential selection
                if (remainingIncluded > 0) {
                    // Still within included limit. Only option-specific surcharge applies.
                    if (optExtra > 0) displayPrice = ` (+$${optExtra})`;
                } else {
                    // Exceeded limit. Base extra + Option extra applies.
                    const totalExtra = baseExtra + optExtra;
                    if (totalExtra > 0) displayPrice = ` (+$${totalExtra})`;
                }
            } else {
                // Already selected - check if it's within included slots or extra
                if (selectionIndex >= stepIncluded) {
                    // This is an extra selection beyond included limit
                    const totalExtra = baseExtra + optExtra;
                    if (totalExtra > 0) displayPrice = ` (+$${totalExtra})`;
                } else if (optExtra > 0) {
                    // Within included but has option surcharge
                    displayPrice = ` (+$${optExtra})`;
                }
            }

            const check = isSelected ? '✅ ' : '• ';
            return `${check}${o.name}${displayPrice}`;
        }).join('\n');

        return {
            text: `${conversationalText}${extraCostMsg}\n\n*Elige para "${currentStep.label}":* (Incluye: ${stepIncluded})\n${optionsList}\n\nEscribe tu elección o "Listo" para continuar. 👇`,
            useButtons: false // User requested NO buttons during builder
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
            currentStep.label || '',
            prevSelectedNames,
            nextStep.label || '',
            nextStep.max_selections || 'varios'
        );

        // Initial display for next step
        // New Step: remaining included is full count
        const nextIncluded = nextStep.included_selections || 0;

        const optionsList = nextStep.options.map(o => {
            let displayPrice = "";
            let baseExtra = nextStep.price_per_extra || 0;
            let optExtra = o.price_extra || 0;

            if (nextIncluded > 0) {
                // First selection is included
                if (optExtra > 0) displayPrice = ` (+$${optExtra})`;
            } else {
                // Zero included (e.g. strict paid add-ons)
                const totalExtra = baseExtra + optExtra;
                if (totalExtra > 0) displayPrice = ` (+$${totalExtra})`;
            }
            return `• ${o.name}${displayPrice}`;
        }).join('\n');

        return {
            text: `${conversationalText}\n\n*Opciones de ${nextStep.label}:* (Incluye: ${nextIncluded})\n${optionsList}\n\nEscribe tu elección 👇`,
            useButtons: false // No buttons
        };
    } else {
        // --- ALL STEPS FINISHED - START CHECKOUT ---
        const { total, summary, items } = calculateOrderDetails(product, state.selections);

        // Transition to CHECKOUT mode
        session.mode = 'CHECKOUT';
        session.checkoutState = {
            productSlug: state.productSlug,
            selections: state.selections,
            totalPrice: total,
            checkoutStep: 'COLLECT_NAME'
        };
        delete session.builderState;
        await updateSession(context.from, session);

        return {
            text: `🎉 ¡Excelente! Tu ${product.name} está casi listo.\n\nAntes de enviarlo a cocina, necesito algunos datos:\n\n👤 *¿Cuál es tu nombre?*`,
            useButtons: false
        };
    }
}

function calculateOrderDetails(product: ProductTree, selections: Record<number, number[]>) {
    let total = product.base_price;
    let summary = `*${product.name}* ($${product.base_price})`;
    const itemsJson: any = {
        name: product.name,
        productType: product.type || 'bowl',
        base_price: product.base_price
    };

    product.steps.forEach(step => {
        const selectedOptionIds = selections[step.id] || [];
        const included = step.included_selections || 0;
        const selectedOptions = step.options.filter(o => selectedOptionIds.includes(o.id));

        if (selectedOptions.length > 0) {
            summary += `\n\n*${step.label}:*`;

            // Map for JSON Item
            const stepKey = (step.label?.toLowerCase() || step.name) || '';
            if (stepKey.includes('base')) itemsJson.base = selectedOptions[0];
            else if (stepKey.includes('prot')) itemsJson.proteins = selectedOptions;
            else if (stepKey.includes('salsa')) itemsJson.sauce = selectedOptions[0];
            else {
                if (!itemsJson.extras) itemsJson.extras = [];
                itemsJson.extras.push(...selectedOptions);
            }

            selectedOptions.forEach((opt, idx) => {
                const isFree = idx < included;
                let priceLine = `\n- ${opt.name}`;
                if (!isFree) {
                    const extra = (step.price_per_extra || 0) + (opt.price_extra || 0);
                    if (extra > 0) {
                        total += extra;
                        priceLine += ` (+$${extra})`;
                    }
                }
                summary += priceLine;
            });
        }
    });

    return { total, summary, items: [itemsJson] };
}

/**
 * Main Logic
 */
async function processMessage(from: string, text: string): Promise<void> {
    /* DEBOUNCE LOGIC WITH FAST PASS EXCEPTION */
    let session = await getSession(from);
    const now = Date.now();
    const lowerText = text.toLowerCase();

    // ⚡ FAST PASS & BUILDER CHECK
    // Priority 1: Instant Keywords (Sales, Greetings & Colloquial)
    // Pass session to verify if we are in BUILDER mode (to avoid hijacking context)
    const instantResponse = await handleInstantKeywords(from, lowerText, session);
    if (instantResponse) {
        console.log(`⚡ Fast Pass: Keyword Match for ${from}`);
        await sendWhatsApp(from, instantResponse);

        // Reset Strategies if needed (e.g. for Armar Poke)
        if (lowerText.includes('armar') && lowerText.includes('poke')) {
            await clearSession(from);
        }

        // Clean buffer leftovers
        if (session.bufferUntil) {
            session.pendingMessages = [];
            session.bufferUntil = 0;
            await updateSession(from, session);
        }
        return;
    }

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
    console.log(`⏱ Starting 5s buffer for ${from}`);
    session.pendingMessages = [text];
    session.bufferUntil = now + 5000;
    await updateSession(from, session);

    // WAIT
    await new Promise(r => setTimeout(r, 5000));

    // RE-FETCH
    session = await getSession(from);
    if (!session.pendingMessages || session.pendingMessages.length === 0) return;

    const aggregatedText = (session.pendingMessages || [text]).join(' ');
    console.log(`🔥 Processing aggregated: "${aggregatedText}"`);

    // Reset buffer
    session.pendingMessages = [];
    session.bufferUntil = 0;

    // --- BUILDER FLOW (Buffered) ---
    if (session.mode === 'BUILDER' && session.builderState) {
        console.log(`🏗 Processing Builder Flow for ${from} (Buffered)`);
        const response = await handleBuilderFlow({ from, text: aggregatedText, timestamp: now }, session, aggregatedText);
        await sendWhatsApp(from, response);
        return;
    }

    // --- CHECKOUT FLOW ---
    if (session.mode === 'CHECKOUT' && session.checkoutState) {
        console.log(`💳 Processing Checkout Flow for ${from}`);
        const { handleCheckoutFlow } = await import('./checkout.ts');
        const response = await handleCheckoutFlow(from, aggregatedText, session);

        // Clear session if checkout completed or cancelled
        if (response.text.includes('ORDEN CONFIRMADA') || response.text.includes('cancelada')) {
            await clearSession(from);
        } else {
            await updateSession(from, session);
        }

        await sendWhatsApp(from, response);
        return;
    }

    // AI SALES / FALLBACK logic
    const prodService = await import('./productService.ts');
    const menuContext = await prodService.getMenuContext();
    const allProducts = await prodService.getAllProducts();

    // ANALYZE INTENT
    const geminiResponse = await import('./gemini.ts').then(m => m.analyzeIntent(aggregatedText));
    console.log("🧠 Intent:", geminiResponse.intent);

    let response: BotResponse;

    if (geminiResponse.intent === 'START_BUILDER') {
        const slug = geminiResponse.entities?.size_preference === 'grande' ? 'poke-grande' : 'poke-mediano';
        await startBuilder(from, slug);
        return;
    } else if (geminiResponse.intent === 'CATEGORY_FILTER' && geminiResponse.entities?.category_keyword) {
        const kw = geminiResponse.entities.category_keyword;
        const cats = await prodService.getCategories();
        const match = cats.find(c => c.name.toLowerCase().includes(kw.toLowerCase()) || (c.slug && c.slug.includes(kw.toLowerCase())));
        if (match) {
            const products = await prodService.getProductsByCategory(match.id);
            const list = products.slice(0, 5).map(p => `• ${p.name} ($${p.base_price})`).join('\n');
            response = {
                text: `📂 *${match.name} found:*\n\n${list}\n\n¿Te sirvo algo de aquí?`,
                useButtons: true,
                buttons: products.slice(0, 3).map(p => p.name)
            };
        } else {
            const salesRes = await import('./gemini.ts').then(m => m.generateSalesResponse(aggregatedText, menuContext, allProducts));
            response = { text: salesRes.text, useButtons: salesRes.suggested_actions && salesRes.suggested_actions.length > 0, buttons: salesRes.suggested_actions?.slice(0, 3) };
        }
    } else {
        const salesRes = await import('./gemini.ts').then(m => m.generateSalesResponse(aggregatedText, menuContext, allProducts));
        response = {
            text: salesRes.text,
            useButtons: salesRes.suggested_actions && salesRes.suggested_actions.length > 0,
            buttons: salesRes.suggested_actions?.slice(0, 3)
        };
        if (salesRes.show_image_url) await sendWhatsAppImage(from, salesRes.show_image_url, "");
    }

    await sendWhatsApp(from, response);
}

/**
 * FAST PASS HELPER
 */
async function handleInstantKeywords(from: string, text: string, session: any): Promise<BotResponse | null> {
    // 0. If in Builder Mode, DISABLE Fast Pass (except maybe "cancelar"? But Builder handles that internally)
    // We want Builder flows to go through the Buffer logic to handle "Arrachera, Pollo" sequences.
    if (session && session.mode === 'BUILDER') return null;

    // 1. Armar Poke / Quiero Poke -> Offer CHOICE (Classic vs House)
    const pokeTriggers = ['armar', 'crear', 'quiero', 'dame', 'un'];
    const lowerText = text.toLowerCase();

    // Check if user specifically asked for "Armar" (Builder direct)
    if (lowerText.includes('armar') && lowerText.includes('poke')) {
        return {
            text: "¿De qué tamaño armamos tu Poke Clásico? 🥣",
            useButtons: true,
            buttons: ['Poke Mediano', 'Poke Grande']
        };
    }

    // Check generic "Quiero un poke" -> Offer Choice
    if (
        (lowerText.includes('poke') && pokeTriggers.some(t => lowerText.includes(t))) ||
        lowerText === 'poke' ||
        lowerText === 'pokes'
    ) {
        return {
            text: "¿Cómo se te antoja tú Poke hoy? 🤔\n\n🥣 *Clásico*: Tú eliges cada ingrediente (Arroz, proteína, mix...).\n📄 *De la Casa*: Recetas especiales del chef listas para disfrutar.",
            useButtons: true,
            buttons: ['Armar Clásico', 'Pokes de la Casa']
        };
    }

    // 2. Handle Choice: "Armar Clásico" -> Size
    if (lowerText.includes('armar clásico') || lowerText.includes('armar clasico')) {
        return {
            text: "¡Va! ¿De qué tamaño lo quieres? 🥣",
            useButtons: true,
            buttons: ['Poke Mediano', 'Poke Grande']
        };
    }

    // 3. Handle Choice: "Pokes de la Casa" -> List Bowls
    if (lowerText.includes('pokes de la casa') || lowerText.includes('de la casa')) {
        const prodService = await import('./productService.ts');
        const categories = await prodService.getCategories();
        // Try finding "bowls" or "pokes" category
        const bowlCat = categories.find(c => c.slug === 'bowls' || c.name.toLowerCase().includes('pokes') || c.name.toLowerCase().includes('bowls'));

        if (bowlCat) {
            const products = await prodService.getProductsByCategory(bowlCat.id);
            const list = products.slice(0, 5).map(p => `🍲 ${p.name} - $${p.base_price}`).join('\n');
            return {
                text: `*Pokes de la Casa (Recetas del Chef):*\n\n${list}\n\nEscribe el nombre del que quieras pedir:`,
                useButtons: true,
                buttons: products.slice(0, 3).map(p => p.name)
            };
        }
    }

    // 4. Direct Size
    if (text === 'poke mediano' || text === 'poke grande') {
        const slug = text === 'poke mediano' ? 'poke-mediano' : 'poke-grande';
        await startBuilder(from, slug);
        return null;
    }

    // 5. Greetings + Colloquial
    const colloquial = ['bro', 'hermano', 'papi', 'bb', 'nn', 'buenas', 'que tal', 'qué tal', 'onda', 'pedir', 'ordenar', 'menu', 'menú'];
    if (
        INTENTS.greeting.some(k => text.includes(k)) ||
        colloquial.some(k => text.includes(k)) ||
        text.includes('hola')
    ) {
        return handleBasicIntent({ from, text, timestamp: 0 });
    }

    // 6. Burgers
    if (text.includes('burger') || text.includes('hamburguesa')) {
        const prodService = await import('./productService.ts');
        const categories = await prodService.getCategories();
        const burgerCat = categories.find(c => c.slug === 'burgers');
        if (burgerCat) {
            const products = await prodService.getProductsByCategory(burgerCat.id);
            const list = products.slice(0, 3).map(p => `🍔 ${p.name} - $${p.base_price}`).join('\n');
            return {
                text: `*Sushi Burgers:*\n\n${list}\n\nSelecciona una:`,
                useButtons: true,
                buttons: products.slice(0, 3).map(p => p.name)
            };
        }
    }

    return null;
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

async function sendWhatsAppImage(to: string, imageUrl: string, caption: string) {
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
                type: "image",
                image: {
                    link: imageUrl,
                    caption: caption
                }
            }),
        }
    );
}

// --- SERVER ---
Deno.serve(async (req: Request) => {
    console.log("🔔 INCOMING WEBHOOK REQUEST", req.method, req.url);
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
                // Use EdgeRuntime.waitUntil to keep the function alive while processing in background
                // Or just await it to be safe in this context since we return 200 anyway at end of try (wait, we return AFTER the block?)
                // Actually in Deno.serve we should return response quickly.
                // But let's just use EdgeRuntime.waitUntil if available or just let it float.
                // Given the lint error earlier, let's just await it. 10s delay is simulated inside processMessage buffering?
                // The buffering uses await new Promise, so awaiting processMessage BLOCKS the webhook response.
                // THAT IS BAD (Timeout).
                // So we MUST NOT await processMessage.
                // We'll use the background promise. Deno runtime usually keeps it alive if we don't return immediately? NO.
                // We need `EdgeRuntime.waitUntil` or similar.
                // Given I cannot use EdgeRuntime due to lint (it might be global), I will try accessing it via globalThis.
                const runtime = (globalThis as any).EdgeRuntime;
                if (runtime) {
                    runtime.waitUntil(processMessage(message.from, text));
                } else {
                    processMessage(message.from, text); // Floating promise
                }
            }
        }
        return new Response('EVENT_RECEIVED', { status: 200 });
    } catch (error: any) {
        console.error('SERVER ERROR:', error);
        return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }
});
