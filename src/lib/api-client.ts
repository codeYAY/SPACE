import { createClient } from "@/lib/supabase/client";

// Helper to fetch from Backend API with Auth Header
export async function fetchWithAuth(
  endpoint: string,
  options: RequestInit = {}
) {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const token = session?.access_token;

  const headers = {
    ...options.headers,
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

  // Ensure endpoint starts with / if not present
  const cleanEndpoint = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;

  const response = await fetch(`${apiUrl}${cleanEndpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    // Handle 401 Unauthorized - maybe redirect to login?
    if (response.status === 401) {
      console.error("Unauthorized access - redirecting to login");
      // window.location.href = '/login'; // Optional auto-redirect
    }
    throw new Error(`API Error: ${response.statusText}`);
  }

  return response.json();
}
