import { createClient } from '@/lib/supabase';

export interface BuilderState {
    stepIndex: number; // Índice del paso actual en el array de pasos del producto
    productSlug: string; // Slug del producto que se está armando (ej: 'poke-mediano')
    selections: Record<number, number[]>; // Mapa de stepId -> array de optionIds seleccionados
    totalPrice: number; // Precio parcial calculado
}

export interface SessionData {
    mode: 'NORMAL' | 'BUILDER';
    builderState?: BuilderState;
    lastInteraction: number;
}

export async function getSession(phone: string): Promise<SessionData> {
    const supabase = createClient();

    try {
        const { data, error } = await supabase
            .from('whatsapp_sessions')
            .select('state')
            .eq('phone', phone)
            .single();

        if (error || !data) {
            // Si no existe o hay error, retornamos sesión por defecto (NORMAL)
            return { mode: 'NORMAL', lastInteraction: Date.now() };
        }

        return data.state as SessionData;
    } catch (err) {
        console.error('Error getting session:', err);
        return { mode: 'NORMAL', lastInteraction: Date.now() };
    }
}

export async function updateSession(phone: string, newState: SessionData) {
    const supabase = createClient();

    try {
        const { error } = await supabase
            .from('whatsapp_sessions')
            .upsert({
                phone,
                state: newState,
                updated_at: new Date().toISOString()
            });

        if (error) throw error;
    } catch (err) {
        console.error('Error updating session:', err);
    }
}

export async function clearSession(phone: string) {
    await updateSession(phone, { mode: 'NORMAL', lastInteraction: Date.now() });
}
