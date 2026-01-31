// Supabase Edge Function para webhook conversacional de WhatsApp
// Deploy: npx supabase functions deploy whatsapp-webhook

// import { serve } from "https://deno.land/std@0.168.0/http/server.ts"; // DEPRECATED
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
        const optionsList = currentStep.options.map(o => {
            const extra = o.price_extra || 0;
            const price = extra > 0 ? ` (+$${extra})` : '';
            const check = currentSelections.includes(o.id) ? '✅ ' : '• ';
            return `${check}${o.name}${price}`;
        }).join('\n');

        return {
            text: `${conversationalText}${extraCostMsg}\n\n*Elige para "${currentStep.label}":*\n${optionsList}\n\nEscribe tu elección o "Listo" para continuar. 👇`,
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
            currentStep.label || '',
            prevSelectedNames,
            nextStep.label || '',
            nextStep.max_selections || 'varios'
        );

        // Initial display for next step
        const optionsList = nextStep.options.map(o => {
            const extra = o.price_extra || 0;
            const price = extra > 0 ? ` (+$${extra})` : '';
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
        const { total, summary, items } = calculateOrderDetails(product, state.selections);

        // INSERT ORDER INTO DB
        const supabase = await import('./productService.ts').then(m => m.supabase);
        // Assuming current user is "Guest" or we need to find user by phone.
        // For now, simpler: Just insert with phone.
        const orderData = {
            customer_name: `WhatsApp User (${context.from.substring(0, 4)}...)`,
            phone: context.from,
            total: total,
            status: 'pending',
            items: items, // JSONB
            delivery_method: 'pickup', // Default to pickup for bot MVP
            payment_status: 'pending',
            created_at: new Date().toISOString()
        };

        const { error } = await supabase.from('orders').insert(orderData);
        if (error) console.error("Error inserting order:", error);

        return {
            text: `🥣 *Pedido Recibido*\n------------------\n${summary}\n------------------\n💰 *TOTAL: $${total}*\n\n✅ Tu orden ha sido enviada a cocina.\nTe avisaremos cuando esté lista.`,
            useButtons: true,
            buttons: ['Menú Principal']
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
    // Relaxed: Only triggers if "Armar" is explicit. "Quiero poke" is now handled by AI to decide if it's menu vs builder.
    if (lowerText.includes('armar') && lowerText.includes('poke')) {
        const response = {
            text: "¿De qué tamaño se te antoja tú Poke? 🥣",
            useButtons: true,
            buttons: ['Poke Mediano', 'Poke Grande']
        };
        await sendWhatsApp(from, response);
        await clearSession(from);
        return;
    }

    // 2. Check for Size Selection OR Specific Product Name
    // Pre-fetch all products to check if text matches a product name
    const prodService = await import('./productService.ts');
    const allProducts = await prodService.getAllProducts(); // Cache potential?

    // Find if user text matches a product EXACTLY or closely
    const matchedProduct = allProducts.find(p => lowerText === p.name.toLowerCase() || lowerText.includes(p.name.toLowerCase()));

    if (matchedProduct) {
        console.log(`🎯 Matched product: ${matchedProduct.name} (${matchedProduct.slug})`);
        // Only start builder if it makes sense (e.g. not a drink? For now assume all valid products can be built/added)
        // Check if it's "customizable" - for now we try to start builder.
        // If it fails (no steps), startBuilder handles the error gracefully.
        await startBuilder(from, matchedProduct.slug || matchedProduct.name);
        return;
    }

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
            // ... existing menu logic ...
            const categories = await getCategories();
            const catList = categories.map(c => `• ${c.name}`).join('\n');
            response = {
                text: `📜 *Categorías del Menú:*\n\n${catList}\n\nSelecciona una categoría o usa los botones para lo más popular:`,
                useButtons: true,
                buttons: ['Sushi Burgers', 'Armar un Poke']
            };
        } else if (lowerText.includes('burger')) {
            // SUSHI BURGER HANDLER - Show options with buttons
            const categories = await getCategories();
            const burgerCat = categories.find(c => c.slug === 'burgers');

            if (burgerCat) {
                const products = await getProductsByCategory(burgerCat.id);
                const list = products.map(p => `🍔 ${p.name} - $${p.base_price}`).join('\n');

                // Generate Buttons for the products (Max 3)
                const productButtons = products.slice(0, 3).map(p => p.name);

                response = {
                    text: `*Sushi Burgers Disponibles:*\n\n${list}\n\nSelecciona una para comenzar:`,
                    useButtons: true,
                    buttons: productButtons
                };
            } else {
                response = { text: "No encontré las burgers 🍔. Escribe 'Menu' para ver todo." };
            }

        } else {
            // Fallback / AI Sales Mode
            // 1. Get Menu Context & Products (for images)
            const prodService = await import('./productService.ts');
            const menuContext = await prodService.getMenuContext();
            const allProducts = await prodService.getAllProducts();

            // 2. ANALYZE INTENT
            const geminiResponse = await import('./gemini.ts').then(m => m.analyzeIntent(aggregatedText));
            console.log("🧠 Intent:", geminiResponse.intent);

            if (geminiResponse.intent === 'CATEGORY_FILTER' && geminiResponse.entities?.category_keyword) {
                const kw = geminiResponse.entities.category_keyword;
                const cats = await prodService.getCategories();
                // Fuzzy match
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
                    // Fallback to general sales response if category not found
                    const salesRes = await import('./gemini.ts').then(m => m.generateSalesResponse(aggregatedText, menuContext, allProducts));
                    response = { text: salesRes.text, useButtons: salesRes.suggested_actions && salesRes.suggested_actions.length > 0, buttons: salesRes.suggested_actions?.slice(0, 3) };
                }
            } else if (geminiResponse.intent === 'START_BUILDER') {
                const slug = geminiResponse.entities?.size_preference === 'grande' ? 'poke-grande' : 'poke-mediano';
                await startBuilder(from, slug);
                return;
            } else {
                // Default Sales
                const salesRes = await import('./gemini.ts').then(m => m.generateSalesResponse(aggregatedText, menuContext, allProducts));
                response = {
                    text: salesRes.text,
                    useButtons: salesRes.suggested_actions && salesRes.suggested_actions.length > 0,
                    buttons: salesRes.suggested_actions?.slice(0, 3)
                };
                if (salesRes.show_image_url) {
                    await sendWhatsAppImage(from, salesRes.show_image_url, "");
                }
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
Deno.serve(async (req) => {
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
