import { NextRequest, NextResponse } from 'next/server';

const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN;

export async function GET(req: NextRequest) {
    const searchParams = req.nextUrl.searchParams;
    const mode = searchParams.get('hub.mode');
    const token = searchParams.get('hub.verify_token');
    const challenge = searchParams.get('hub.challenge');

    if (mode && token) {
        if (mode === 'subscribe' && token === VERIFY_TOKEN) {
            console.log('✅ WhatsApp Webhook Verified!');
            return new NextResponse(challenge, { status: 200 });
        } else {
            return new NextResponse('Forbidden', { status: 403 });
        }
    }

    return new NextResponse('Bad Request', { status: 400 });
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();

        // Check if it's a WhatsApp Status Update
        if (body.object) {
            if (
                body.entry &&
                body.entry[0].changes &&
                body.entry[0].changes[0].value.messages &&
                body.entry[0].changes[0].value.messages[0]
            ) {
                const message = body.entry[0].changes[0].value.messages[0];
                const from = message.from;
                const messageType = message.type;

                console.log(`📩 New ${messageType} message from ${from}`);

                // Handle text messages
                if (messageType === 'text') {
                    const text = message.text?.body;

                    if (text) {
                        // Import bot functions dynamically to avoid edge runtime issues
                        const { generateResponse, saveConversation } = await import('@/lib/whatsappBot');
                        const { sendWhatsAppText, sendWhatsAppButtons } = await import('@/lib/whatsapp');

                        // Generate intelligent response
                        const response = await generateResponse({
                            from,
                            text,
                            timestamp: Date.now()
                        });

                        // Send response
                        if (response.useButtons && response.buttons) {
                            await sendWhatsAppButtons(from, response.text, response.buttons);
                        } else {
                            await sendWhatsAppText(from, response.text);
                        }

                        // Save conversation (optional tracking)
                        await saveConversation(from, text, response.text);

                        console.log(`✅ Bot responded to ${from}`);
                    }
                }

                // Handle button clicks
                if (messageType === 'interactive') {
                    const buttonReply = message.interactive?.button_reply;

                    if (buttonReply) {
                        console.log(`🔘 Button clicked: ${buttonReply.title}`);

                        // Treat button click as text message
                        const { generateResponse } = await import('@/lib/whatsappBot');
                        const { sendWhatsAppText } = await import('@/lib/whatsapp');

                        const response = await generateResponse({
                            from,
                            text: buttonReply.title,
                            timestamp: Date.now()
                        });

                        await sendWhatsAppText(from, response.text);
                    }
                }
            }
        }

        return new NextResponse('EVENT_RECEIVED', { status: 200 });
    } catch (error) {
        console.error('❌ Webhook Error:', error);
        return new NextResponse('Internal Server Error', { status: 500 });
    }
}

