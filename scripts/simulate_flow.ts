
// MOCK CONSTANTS
Deno.env.set("WHATSAPP_PHONE_ID", "test-phone-id");
Deno.env.set("WHATSAPP_ACCESS_TOKEN", "test-token");
Deno.env.set("WHATSAPP_VERIFY_TOKEN", "test-verify");
Deno.env.set("SUPABASE_URL", "https://xsolxbroqqjkoseksmny.supabase.co");
Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "mock-key-for-local-testing");
Deno.env.set("SUPABASE_ANON_KEY", "mock-key-for-local-testing");

import { processMessage } from "../supabase/functions/whatsapp-webhook/index.ts";

// MOCK FETCH to intercept WhatsApp API calls
const originalFetch = globalThis.fetch;
globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = input.toString();
    if (url.includes("graph.facebook.com")) {
        const body = init?.body ? JSON.parse(init.body as string) : {};

        // Print Bot Response to Console
        if (body.type === "text") {
            console.log(`\n🤖 BOT (Text): ${body.text.body}`);
        } else if (body.type === "interactive") {
            const interactive = body.interactive;
            console.log(`\n🤖 BOT (${interactive.type.toUpperCase()}):`);
            if (interactive.type === "button") {
                console.log(`   Header: ${interactive.header?.text || ''}`);
                console.log(`   Body: ${interactive.body.text}`);
                console.log(`   Buttons: ${interactive.action.buttons.map((b: any) => `[${b.reply.id}] ${b.reply.title}`).join(" | ")}`);
            } else if (interactive.type === "list") {
                console.log(`   Header: ${interactive.header?.text || ''}`);
                console.log(`   Body: ${interactive.body.text}`);
                console.log(`   Button: ${interactive.action.button}`);
                interactive.action.sections.forEach((s: any) => {
                    console.log(`   Section: ${s.title}`);
                    s.rows.forEach((r: any) => {
                        console.log(`      - [${r.id}] ${r.title} ${r.description || ''}`);
                    });
                });
            }
        }
        return new Response(JSON.stringify({ success: true }), { status: 200 });
    }
    return originalFetch(input, init);
};


// SIMULATION RUNNER
async function runSimulation() {
    console.log("🚀 Starting Simulation: Poke Builder");
    const user = "5215550001";

    const steps = [
        "Quiero armar un poke",
        "poke-mediano",
        "ARROZ BLANCO",         // Texto exacto (igual que en la lista)
        "POLLO AL GRILL",       // Texto exacto
        "✅ LISTO / SIGUIENTE",
        "listo",
        "Juan Perez"
    ];

    for (const input of steps) {
        console.log(`\n👤 USER: "${input}"`);
        await processMessage(user, input);
        await new Promise(r => setTimeout(r, 1000)); // Wait for logs
    }
}

runSimulation();
