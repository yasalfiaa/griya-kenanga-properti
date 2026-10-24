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
  const [isLoading, setIsLoading] = useState(isSupabaseConfigured);

  // Dengan Supabase aktif: jangan pernah default ke "pura-pura login"
  // dengan profil mock (mock Ratna dsb.). currentUser harus null sampai
  // sesi Supabase Auth yang asli (JWT) terverifikasi — sebab semua fungsi
  // SQL (fn_create_contract, fn_create_mayar_payment_session, dst.) bergantung
  // pada auth.uid(); tanpa JWT asli aksi apa pun akan gagal dengan
  // "Unauthenticated: sesi login tidak ditemukan."
  //
  // Tanpa Supabase konfigur: mode demo lokal memakai profil mock disimpan.
  const [currentUser, setCurrentUser] = useState<Profile | null>(() => {
    if (!isSupabaseConfigured) {
      const saved = localStorage.getItem('griya_user_id');
      if (saved) {
        const found = (MOCK_PROFILES as unknown as Profile[]).find(p => p.id === saved);
        if (found) return found;
      }
      return (MOCK_PROFILES as unknown as Profile[])[0] || null;
    }
    return null;
  });

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setIsLoading(false);
      return;
    }

    const loadProfile = async (userId: string): Promise<boolean> => {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (data) {
        setCurrentUser(data as Profile);
        localStorage.setItem('griya_user_id', data.id);
        await dataStore.loadFromSupabase();
        return true;
      }

      // Sesinya valid tapi profil tidak ada → tidak dianggap login
      setCurrentUser(null);
      localStorage.removeItem('griya_user_id');
      return false;
    };

    // 1. Pulihkan sesi yang tersimpan (refresh halaman / origin berubah)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        loadProfile(session.user.id).finally(() => setIsLoading(false));
      } else {
        setCurrentUser(null); // eksplisit: tidak ada sesi → tampilan login
        setIsLoading(false);
      }
    });

    // 2. Reaksi terhadap perubahan status otentikasi (login/logout/refresh token)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (session?.user) {
          await loadProfile(session.user.id);
          setIsLoading(false);
        } else if (event === 'SIGNED_OUT' || event === 'INITIAL_SESSION') {
          setCurrentUser(null);
          localStorage.removeItem('griya_user_id');
          setIsLoading(false);
        }
      }
    );

    return () => subscription.unsubscribe();
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

          // Penting: jangan dianggap login sukses di sisi UI bila profil
          // belum tersedia — aksi yang memakai auth.uid() akan gagal.
          setIsLoading(false);
          return {
            success: false,
            message: 'Akun terautentikasi, tetapi profil belum tersedia. Silakan daftar ulang atau hubungi Pengelola.',
          };
        }
      }

      // Kasus 2 (hanya mode tanpa Supabase / demo lokal): fallback ke mock
      // profil. Dengan Supabase aktif, login TANPA password tidak boleh
      // dianggap sebagai sesi nyata (JWT), sebab aksi transaksional
      // akan selalu gagal "Unauthenticated: sesi login tidak ditemukan".
      if (!isSupabaseConfigured) {
        const mockProfile = (MOCK_PROFILES as unknown as Profile[]).find(
          p => p.email.toLowerCase() === cleanEmail
        );
        if (mockProfile) {
          setCurrentUser(mockProfile);
          localStorage.setItem('griya_user_id', mockProfile.id);
          setIsLoading(false);
          return { success: true };
        }
      }

      setIsLoading(false);
      return {
        success: false,
        message: isSupabaseConfigured
          ? 'Login tanpa kata sandi didukung pada mode demo lokal saja. Silakan masukkan kata sandi.'
          : 'Akun dengan email tersebut tidak ditemukan.',
      };
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
