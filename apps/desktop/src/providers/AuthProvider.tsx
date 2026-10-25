import React, { createContext, useContext, useEffect, useState } from 'react';
import { api, Profile } from '@/api/client';

export interface LocalUser {
  id: string;
  email: string;
  displayName: string;
}

interface AuthContextType {
  user: LocalUser | null;
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
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchProfile = async () => {
    try {
      const res = await api.getMe();
      setProfile(res.profile);
    } catch {
      setProfile({
        id: 'local-user',
        email: 'local@desktop.app',
        displayName: 'KetchUp ユーザー',
        avatarUrl: '',
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Tokyo',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }
  };

  useEffect(() => {
    fetchProfile().finally(() => {
      setIsLoading(false);
    });
  }, []);

  const localUser: LocalUser = {
    id: profile?.id || 'local-user',
    email: profile?.email || 'local@desktop.app',
    displayName: profile?.displayName || 'KetchUp ユーザー',
  };

  return (
    <AuthContext.Provider
      value={{
        user: localUser,
        profile,
        token: null,
        isLoading,
        signInWithGoogle: async () => {},
        signOut: async () => {},
        refreshProfile: fetchProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
export const supabaseClient = null;
