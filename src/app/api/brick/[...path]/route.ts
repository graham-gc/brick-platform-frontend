import { NextRequest, NextResponse } from 'next/server';

const BACKEND_BASE_URL = (process.env.API_BASE_URL || 'http://localhost:8080/api/brick')
  .replace(/\/+$/, '');

type RouteParameters = {
  params: Promise<{ path: string[] }>;
};

async function proxyRequest(
  request: NextRequest,
  { params }: RouteParameters,
  method: 'GET' | 'POST'
) {
  const { path } = await params;
  const incomingUrl = new URL(request.url);
  const targetUrl = `${BACKEND_BASE_URL}/${path.join('/')}${incomingUrl.search}`;

  try {
    const body = method === 'POST' ? await request.text() : undefined;
    const response = await fetch(targetUrl, {
      method,
      headers: {
        'Content-Type': request.headers.get('content-type') || 'application/json',
      },
      body: body || undefined,
      cache: 'no-store',
    });
    const responseBody = await response.text();

    return new NextResponse(responseBody, {
      status: response.status,
      headers: {
        'Content-Type': response.headers.get('content-type') || 'application/json',
      },
    });
  } catch {
    return NextResponse.json(
      { success: false, message: 'Unable to connect to the backend service', data: null },
      { status: 502 }
    );
  }
}

export async function GET(request: NextRequest, context: RouteParameters) {
  return proxyRequest(request, context, 'GET');
}

export async function POST(request: NextRequest, context: RouteParameters) {
  return proxyRequest(request, context, 'POST');
}
