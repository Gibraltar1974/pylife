import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { adminDb } from '@/lib/firebase-admin';

let stripeClient: Stripe | null = null;
function getStripe() {
  if (!stripeClient) {
    let key = process.env.STRIPE_SECRET_KEY;
    if (key?.startsWith('pk_') && process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.startsWith('sk_')) {
      key = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
    }
    if (!key) {
      throw new Error('STRIPE_SECRET_KEY is missing.');
    }
    stripeClient = new Stripe(key, { apiVersion: '2026-04-22.dahlia' });
  }
  return stripeClient;
}

export async function POST(request: Request) {
  try {
    const { sessionId, userId } = await request.json();

    if (!sessionId || !userId) {
      return NextResponse.json({ error: 'Missing sessionId or userId' }, { status: 400 });
    }

    if (!adminDb) {
      return NextResponse.json(
        { error: 'El servidor no tiene configurado Firebase Admin (Falta FIREBASE_PRIVATE_KEY)' },
        { status: 503 }
      );
    }

    const stripe = getStripe();
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    // Verificar que la sesión corresponde a un pago completado
    if (session.payment_status !== 'paid') {
      return NextResponse.json({ error: 'El pago no ha sido completado.' }, { status: 400 });
    }

    // Verificar que no se haya procesado antes usando Firestore
    const paymentRef = adminDb.collection('payments').doc(session.id);
    const paymentDoc = await paymentRef.get();

    if (paymentDoc.exists) {
      // Ya se acreditaron los puntos por este pago
      return NextResponse.json({ message: 'Pago ya fue procesado anteriormente.' }, { status: 200 });
    }

    // Usar una transacción para asegurar atomicidad
    await adminDb.runTransaction(async (transaction: any) => {
      const db = adminDb!;
      const userRef = db.collection('users').doc(userId);
      const userDoc = await transaction.get(userRef);

      let currentCredits = 5;
      if (userDoc.exists) {
        currentCredits = userDoc.data()?.credits || 0;
      }

      // Sumar 10 créditos (basado en el paquete de compra)
      transaction.set(userRef, { credits: currentCredits + 10 }, { merge: true });
      
      // Registrar que la sesión ya fue usada
      transaction.set(paymentRef, {
        userId,
        amount_total: session.amount_total,
        currency: session.currency,
        createdAt: new Date(),
        status: 'paid'
      });
    });

    return NextResponse.json({ success: true, message: 'Créditos actualizados exitosamente.' });
  } catch (error: any) {
    console.error('Error verifying payment:', error);
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}
