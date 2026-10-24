import React, { createContext, useContext, useEffect, useState } from 'react';
import { createClient, SupabaseClient, User } from '@supabase/supabase-js';
import { api, Profile } from '@/api/client';

// Optional Supabase configuration from environment
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://mock.supabase.co';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'mock-anon-key';

let supabaseClient: SupabaseClient | null = null;
try {
  supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
} catch (e) {
  console.warn('Supabase client failed to initialize, using local auth mock', e);
}

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  token: string | null;
  isLoading: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  token: null,
  isLoading: true,
  signInWithGoogle: async () => {},
  signOut: async () => {},
  refreshProfile: async () => {},
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchProfile = async () => {
    try {
      const res = await api.getMe();
      setProfile(res.profile);
    } catch (e) {
      // In local dev without backend, set default mock profile
      setProfile({
        id: '00000000-0000-0000-0000-000000000001',
        email: 'developer@example.com',
        displayName: 'Ketchup Pro User',
        avatarUrl: '',
        timezone: 'Asia/Tokyo',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }
  };

  useEffect(() => {
    const initAuth = async () => {
      if (supabaseClient && SUPABASE_URL !== 'https://mock.supabase.co') {
        const { data: { session } } = await supabaseClient.auth.getSession();
        if (session) {
          setUser(session.user);
          setToken(session.access_token);
          api.setToken(session.access_token);
        }

        supabaseClient.auth.onAuthStateChange((_event, session) => {
          if (session) {
            setUser(session.user);
            setToken(session.access_token);
            api.setToken(session.access_token);
          } else {
            setUser(null);
            setToken(null);
            api.setToken(null);
          }
        });
      } else {
        // Dev mock user
        setUser({
          id: '00000000-0000-0000-0000-000000000001',
          email: 'developer@example.com',
          app_metadata: {},
          user_metadata: { full_name: 'Ketchup Pro User' },
          aud: 'authenticated',
          created_at: new Date().toISOString(),
        } as User);
        setToken('dev-token');
        api.setToken('dev-token');
      }

      await fetchProfile();
      setIsLoading(false);
    };

    initAuth();
  }, []);

  const signInWithGoogle = async () => {
    if (supabaseClient && SUPABASE_URL !== 'https://mock.supabase.co') {
      await supabaseClient.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin,
        },
      });
    } else {
      alert('ローカル開発モードで動作しています。既にゲストログイン状態です。');
    }
  };

  const signOut = async () => {
    if (supabaseClient && SUPABASE_URL !== 'https://mock.supabase.co') {
      await supabaseClient.auth.signOut();
    }
    setUser(null);
    setToken(null);
    api.setToken(null);
    setProfile(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        token,
        isLoading,
        signInWithGoogle,
        signOut,
        refreshProfile: fetchProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
export { supabaseClient };
