import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    // === ESTRUCTURA PARA STRIPE ===
    // Aquí es donde validarás si el usuario tiene una suscripción activa o créditos
    // antes de hacer la llamada a Hugging Face (que cuesta dinero).
    
    /*
    import Stripe from 'stripe';
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
    
    // 1. Obtener el ID del usuario (de Firebase, NextAuth, etc.)
    const userId = "user_123"; 
    
    // 2. Buscar en tu base de datos el 'stripeCustomerId' de este usuario
    const customerId = "cus_123"; 
    
    // 3. Verificar en Stripe si tiene una suscripción activa
    const subscriptions = await stripe.subscriptions.list({
       customer: customerId,
       status: 'active',
    });
    
    if (subscriptions.data.length === 0) {
       // El usuario no ha pagado. 
       // Podemos devolver un 402 (Payment Required) para que el frontend muestre un modal de pago.
       return NextResponse.json({ 
         error: "Payment required. Por favor adquiere una suscripción.",
         requires_payment: true
       }, { status: 402 });
    }
    */
    // ================================

    const HUGGING_FACE_URL = 'https://sigmaexacta-pylife.hf.space/analyze';
    
    // El token ahora se lee de las variables de entorno del servidor
    // en lugar de pedírselo al usuario en la interfaz.
    const HF_TOKEN = process.env.HF_TOKEN;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (HF_TOKEN) {
      headers['Authorization'] = `Bearer ${HF_TOKEN}`;
    }

    const response = await fetch(HUGGING_FACE_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify(body)
    });

    const isHtml = (response.headers.get("content-type") || "").includes("text/html");

    if (response.status === 404) {
      if (isHtml) {
        return NextResponse.json(
          { error: "Error 404: The Hugging Face Space was not found or the Token is invalid. (Private spaces return 404 HTML if the token is missing/wrong. Make sure HF_TOKEN is valid and the space is running)." },
          { status: 404 }
        );
      } else {
        return NextResponse.json(
          { error: "Error 404: The Space is reachable, but the endpoint '/analyze' does not exist in your Python app. Check your @app.post() path." },
          { status: 404 }
        );
      }
    }

    if (response.status === 401) {
      return NextResponse.json(
        { error: "Error 401: Unauthorized. Check the HF_TOKEN environment variable." },
        { status: 401 }
      );
    }

    const contentType = response.headers.get("content-type");
    if (contentType && contentType.indexOf("application/json") !== -1) {
      const data = await response.json();
      if (!response.ok) {
         return NextResponse.json(
           { error: data.detail || data.error || `Server Error HTTP ${response.status}` },
           { status: response.status }
         );
      }
      return NextResponse.json(data);
    } else {
      const textData = await response.text();
      if (response.status === 503 || textData.includes("Restarting")) {
        return NextResponse.json(
          { error: 'The API server is restarting (Error 503). Please wait.' },
          { status: 503 }
        );
      }
      return NextResponse.json(
        { error: `Invalid response (${response.status}). Expected JSON.` },
        { status: response.status }
      );
    }

  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}
