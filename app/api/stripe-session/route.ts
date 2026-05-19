import { NextResponse } from 'next/server';
import Stripe from 'stripe';

// Inicialización perezosa (lazy) de Stripe para no bloquear el inicio de la app
// si la clave secreta aún no está configurada por el usuario.
let stripeClient: Stripe | null = null;

function getStripe() {
  if (!stripeClient) {
    let key = process.env.STRIPE_SECRET_KEY;
    
    // Auto-correct if user accidentally swapped them in the settings
    if (key?.startsWith('pk_') && process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.startsWith('sk_')) {
      key = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
    }

    if (!key) {
      throw new Error('STRIPE_SECRET_KEY environment variable is missing.');
    }
    stripeClient = new Stripe(key, { apiVersion: '2026-04-22.dahlia' });
  }
  return stripeClient;
}

export async function POST(request: Request) {
  try {
    const stripe = getStripe();
    const origin = request.headers.get('origin');
    const appUrl = origin || process.env.APP_URL || 'http://localhost:3000';

    // Crear una sesión de pago de Stripe (Checkout Session)
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: 'Fatigue Analysis Credits',
              description: 'Access to advanced fatigue life assessments via Bosch PyLife',
            },
            unit_amount: 500, // $5.00
          },
          quantity: 1,
        },
      ],
      mode: 'payment', // Puede ser 'subscription' si quieres cobros mensuales
      client_reference_id: request.headers.get('x-user-id') || undefined,
      success_url: `${appUrl}?payment=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}?payment=canceled`,
    });

    return NextResponse.json({ url: session.url });
  } catch (error: any) {
    if (error.message.includes('STRIPE_SECRET_KEY')) {
      return NextResponse.json(
        { error: 'Stripe is not fully configured yet. Missing Secret Key.' },
        { status: 503 }
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
