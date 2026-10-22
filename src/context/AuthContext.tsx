import React, { createContext, useContext, useState, useEffect } from 'react';
import { Profile, RoleType } from '../types/database';
import { MOCK_PROFILES } from '../data/mock-data';
import { supabase, isSupabaseConfigured } from '../api/supabase';
import { dataStore } from '../api/data-service';

interface AuthContextType {
  currentUser: Profile | null;
  role: RoleType;
  isLoading: boolean;
  loginAs: (email: string, password?: string) => Promise<{ success: boolean; message?: string }>;
  logout: () => Promise<void>;
  switchRoleUser: (userId: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Ambil user tersimpan atau default ke Ratna (Pemilik)
  const [currentUser, setCurrentUser] = useState<Profile | null>(() => {
    const saved = localStorage.getItem('griya_user_id');
    if (saved) {
      const found = (MOCK_PROFILES as unknown as Profile[]).find(p => p.id === saved);
      if (found) return found;
    }
    return (MOCK_PROFILES as unknown as Profile[])[0] || null;
  });

  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isSupabaseConfigured) {
      // 1. Cek sesi aktif Supabase Auth
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session?.user) {
          supabase
            .from('profiles')
            .select('*')
            .eq('id', session.user.id)
            .maybeSingle()
            .then(({ data }) => {
              if (data) {
                setCurrentUser(data as Profile);
                localStorage.setItem('griya_user_id', data.id);
                dataStore.loadFromSupabase();
              }
            });
        }
      });

      // 2. Berlangganan perubahan status otentikasi
      const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
        if (session?.user) {
          const { data } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', session.user.id)
            .maybeSingle();

          if (data) {
            setCurrentUser(data as Profile);
            localStorage.setItem('griya_user_id', data.id);
            await dataStore.loadFromSupabase();
          }
        }
      });

      return () => subscription.unsubscribe();
    }
  }, []);

  const loginAs = async (
    email: string,
    password?: string
  ): Promise<{ success: boolean; message?: string }> => {
    setIsLoading(true);
    try {
      const cleanEmail = email.trim().toLowerCase();

      // Kasus 1: Login dengan password nyata via Supabase Auth
      if (isSupabaseConfigured && password) {
        const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password,
        });

        if (authErr) {
          setIsLoading(false);
          let message = authErr.message;
          if (authErr.message.includes('Invalid login credentials')) {
            message = 'Email atau kata sandi tidak sesuai.';
          } else if (authErr.message.includes('Email not confirmed')) {
            message = 'Email belum dikonfirmasi. Silakan periksa kotak masuk atau matikan Confirm Email di Supabase Dashboard.';
          }
          return { success: false, message };
        }

        if (authData.user) {
          // Ambil profil dari Supabase
          const { data: profileData } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', authData.user.id)
            .maybeSingle();

          if (profileData) {
            setCurrentUser(profileData as Profile);
            localStorage.setItem('griya_user_id', profileData.id);
            await dataStore.loadFromSupabase();
            setIsLoading(false);
            return { success: true };
          }
        }
      }

      // Kasus 2: Quick Demo Login (tanpa password atau bypass untuk akun uji coba)
      if (isSupabaseConfigured) {
        const { data: profileData } = await supabase
          .from('profiles')
          .select('*')
          .ilike('email', cleanEmail)
          .maybeSingle();

        if (profileData) {
          setCurrentUser(profileData as Profile);
          localStorage.setItem('griya_user_id', profileData.id);
          await dataStore.loadFromSupabase();
          setIsLoading(false);
          return { success: true };
        }
      }

      // Kasus 3: Fallback ke mock profiles lokal jika offline
      const mockProfile = (MOCK_PROFILES as unknown as Profile[]).find(
        p => p.email.toLowerCase() === cleanEmail
      );
      if (mockProfile) {
        setCurrentUser(mockProfile);
        localStorage.setItem('griya_user_id', mockProfile.id);
        setIsLoading(false);
        return { success: true };
      }

      setIsLoading(false);
      return { success: false, message: 'Akun dengan email tersebut tidak ditemukan.' };
    } catch (err: any) {
      setIsLoading(false);
      return { success: false, message: err?.message || 'Terjadi kesalahan sistem saat login' };
    }
  };

  const logout = async () => {
    if (isSupabaseConfigured) {
      try {
        await supabase.auth.signOut();
      } catch (e) {
        console.warn('Sign out warning:', e);
      }
    }
    localStorage.removeItem('griya_user_id');
    setCurrentUser(null);
  };

  const switchRoleUser = async (userId: string) => {
    setIsLoading(true);
    if (isSupabaseConfigured) {
      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (profileData) {
        setCurrentUser(profileData as Profile);
        localStorage.setItem('griya_user_id', profileData.id);
        await dataStore.loadFromSupabase();
        setIsLoading(false);
        return;
      }
    }

    const mockProfile = (MOCK_PROFILES as unknown as Profile[]).find(p => p.id === userId);
    if (mockProfile) {
      setCurrentUser(mockProfile);
      localStorage.setItem('griya_user_id', mockProfile.id);
    }
    setIsLoading(false);
  };

  const role: RoleType = currentUser?.peran || 'penyewa';

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        role,
        isLoading,
        loginAs,
        logout,
        switchRoleUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
