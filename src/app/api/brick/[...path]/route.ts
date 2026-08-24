import { NextRequest, NextResponse } from 'next/server';

const BACKEND_BASE_URL = (process.env.API_BASE_URL || 'http://localhost:8080/api/brick')
  .replace(/\/+$/, '');
const REQUEST_ID_HEADER = 'X-Request-ID';
const SAFE_REQUEST_ID = /^[A-Za-z0-9._-]{1,100}$/;

type RouteParameters = {
  params: Promise<{ path: string[] }>;
};

async function proxyRequest(
  request: NextRequest,
  { params }: RouteParameters,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE'
) {
  const { path } = await params;
  const incomingUrl = new URL(request.url);
  const targetUrl = `${BACKEND_BASE_URL}/${path.join('/')}${incomingUrl.search}`;
  const incomingRequestId = request.headers.get(REQUEST_ID_HEADER);
  const requestId = incomingRequestId && SAFE_REQUEST_ID.test(incomingRequestId)
    ? incomingRequestId
    : crypto.randomUUID();

  try {
    const body = method === 'POST' || method === 'PUT' ? await request.text() : undefined;
    const response = await fetch(targetUrl, {
      method,
      headers: {
        'Content-Type': request.headers.get('content-type') || 'application/json',
        [REQUEST_ID_HEADER]: requestId,
      },
      body: body || undefined,
      cache: 'no-store',
    });
    const responseBody = await response.text();

    const responseHeaders = new Headers({
      'Content-Type': response.headers.get('content-type') || 'application/json',
      [REQUEST_ID_HEADER]: response.headers.get(REQUEST_ID_HEADER) || requestId,
    });

    return new NextResponse(responseBody, {
      status: response.status,
      headers: responseHeaders,
    });
  } catch (error) {
    console.error('Backend proxy request failed', {
      requestId,
      method,
      path: incomingUrl.pathname,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return NextResponse.json(
      { success: false, message: 'Unable to connect to the backend service', data: null },
      { status: 502, headers: { [REQUEST_ID_HEADER]: requestId } }
    );
  }
}

export async function GET(request: NextRequest, context: RouteParameters) {
  return proxyRequest(request, context, 'GET');
}

export async function POST(request: NextRequest, context: RouteParameters) {
  return proxyRequest(request, context, 'POST');
}

export async function PUT(request: NextRequest, context: RouteParameters) {
  return proxyRequest(request, context, 'PUT');
}

export async function DELETE(request: NextRequest, context: RouteParameters) {
  return proxyRequest(request, context, 'DELETE');
}
