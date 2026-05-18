import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '../../../lib/firebase-admin';

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Missing or invalid Authorization header' }, { status: 401 });
    }
    const idToken = authHeader.split('Bearer ')[1];
    let decodedToken;
    try {
      decodedToken = await adminAuth.verifyIdToken(idToken);
    } catch (e) {
      return NextResponse.json({ error: 'Unauthorized: Invalid token' }, { status: 401 });
    }

    const userId = decodedToken.uid;
    const userRef = adminDb.collection('users').doc(userId);
    
    let isAuthorized = false;
    await adminDb.runTransaction(async (t) => {
      const uDoc = await t.get(userRef);
      if (!uDoc.exists) {
        throw new Error('User not found');
      }
      const userData = uDoc.data();
      if (userData?.credits > 0) {
        t.update(userRef, { credits: userData.credits - 1 });
        isAuthorized = true;
      }
    });

    if (!isAuthorized) {
       return NextResponse.json({ 
         error: "Insufficient credits. Please acquire more.",
         requires_payment: true
       }, { status: 402 });
    }

    const body = await request.json();
    
    // === ESTRUCTURA PARA STRIPE ===
    // (Omitted the old comment block for brevity, now we use actual credits)
    
    const HUGGING_FACE_URL = 'https://sigmaexacta-pylife.hf.space/analyze';
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
        return NextResponse.json({ error: "Error 404: The Hugging Face Space was not found or the Token is invalid." }, { status: 404 });
      } else {
        return NextResponse.json({ error: "Error 404: The endpoint does not exist." }, { status: 404 });
      }
    }

    if (response.status === 401) {
      return NextResponse.json({ error: "Error 401: Unauthorized. Check the HF_TOKEN environment variable." }, { status: 401 });
    }

    const contentType = response.headers.get("content-type");
    if (contentType && contentType.indexOf("application/json") !== -1) {
      const data = await response.json();
      if (!response.ok) {
         return NextResponse.json({ error: data.detail || data.error || `Server Error HTTP ${response.status}` }, { status: response.status });
      }
      return NextResponse.json(data);
    } else {
      const textData = await response.text();
      if (response.status === 503 || textData.includes("Restarting")) {
        return NextResponse.json({ error: 'The API server is restarting (Error 503). Please wait.' }, { status: 503 });
      }
      return NextResponse.json({ error: `Invalid response (${response.status}). Expected JSON.` }, { status: response.status });
    }

  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}

