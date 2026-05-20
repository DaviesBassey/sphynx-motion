import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';

/**
 * Next.js Secure Proxy Gateway
 * Enforces architectural isolation between client and protected backend.
 */
export async function POST(req: Request) {
  const { userId, getToken } = auth();

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // 1. Ingestion Hardening: Payload size check (Max 5MB for multimodal data)
    const clonedReq = req.clone();
    const blob = await clonedReq.blob();
    if (blob.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: 'Payload exceeds 5MB isolation limit' }, { status: 413 });
    }

    const body = await req.json();
    const token = await getToken();
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';

    // 2. Proxied Execution to Protected FastAPI Runtime
    const response = await fetch(`${backendUrl}/api/v1/portfolio/analyze`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(data, { status: response.status });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('[Proxy Gateway Error]:', error);
    return NextResponse.json({ error: 'Internal pipeline fault' }, { status: 500 });
  }
}
