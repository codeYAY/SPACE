# Step 1: Install Dependencies
# npm install @supabase/ssr @supabase/supabase-js
# or
# pnpm add @supabase/ssr @supabase/supabase-js

# Step 2: Environment Variables (frontend/.env.local)
# NEXT_PUBLIC_MSTROHUB_SUPABASE_URL=https://your-project.supabase.co
# NEXT_PUBLIC_MSTROHUB_SUPABASE_ANON_KEY=your-anon-key
# NEXT_PUBLIC_API_URL=http://localhost:8000 (or your production API URL)

# Step 3: Create Supabase Client (lib/supabase/client.ts)
```typescript
import { createBrowserClient } from "@supabase/ssr";

// Create a standard client for authentication
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_MSTROHUB_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_MSTROHUB_SUPABASE_ANON_KEY!
  );
}
```

# Step 4: Create Auth Provider (components/auth-provider.tsx)
```typescript
'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/client';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  signOut: () => Promise<void>;
  getToken: () => Promise<string | null>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    // Check active session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setIsLoading(false);
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setIsLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [supabase]);

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
  };

  // Helper to get fresh access token
  const getToken = async () => {
    if (!session) return null;
    // Check if token is expired and refresh if needed
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? null;
  };

  return (
    <AuthContext.Provider value={{ user, session, isLoading, signOut, getToken }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
```

# Step 5: Create API Client Helper (lib/api-client.ts)
```typescript
import { createClient } from '@/lib/supabase/client';

// Helper to fetch from Backend API with Auth Header
export async function fetchWithAuth(endpoint: string, options: RequestInit = {}) {
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;

  const headers = {
    ...options.headers,
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
  
  const response = await fetch(`${apiUrl}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    // Handle 401 Unauthorized - maybe redirect to login?
    if (response.status === 401) {
      console.error('Unauthorized access - redirecting to login');
      // window.location.href = '/login'; // Optional auto-redirect
    }
    throw new Error(`API Error: ${response.statusText}`);
  }

  return response.json();
}
```

# Step 6: Use in Component (example-page.tsx)
```typescript
'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/components/auth-provider';
import { fetchWithAuth } from '@/lib/api-client';

export default function Dashboard() {
  const { user, isLoading } = useAuth();
  const [data, setData] = useState(null);

  useEffect(() => {
    if (user) {
      // Fetch protected data
      fetchWithAuth('/api/v1/protected-endpoint')
        .then(setData)
        .catch(console.error);
    }
  }, [user]);

  if (isLoading) return <div>Loading user...</div>;
  if (!user) return <div>Please log in</div>;

  return (
    <div>
      <h1>Welcome, {user.email}</h1>
      <pre>{JSON.stringify(data, null, 2)}</pre>
    </div>
  );
}
```

