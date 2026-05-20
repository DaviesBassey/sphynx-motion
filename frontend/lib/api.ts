/**
 * Principal Architect Isolation Rule Verification:
 * Client-side code communicating only with protected backend runtime.
 */
export async function secureFetch(path: string, options: RequestInit = {}) {
  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

  // Internal infrastructure secrets (like STRIPE_SECRET_KEY) are NOT referenced here.
  // We use proxied requests to the backend tier.
  const response = await fetch(`${backendUrl}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (!response.ok) {
    throw new Error(`Backend error: ${response.statusText}`);
  }

  return response.json();
}
