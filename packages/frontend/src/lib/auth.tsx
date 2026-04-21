'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { signInWithEmailAndPassword, signOut, onIdTokenChanged, User as FirebaseUser } from 'firebase/auth';
import { auth } from './firebase';
import { api } from './api';

interface UserProfile {
  id: string;
  email: string;
  fullName: string;
  role: string;
}

interface AuthContextType {
  user: UserProfile | null;
  firebaseUser: FirebaseUser | null;
  token: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Synchronize Firebase auth state
  useEffect(() => {
    const unsubscribe = onIdTokenChanged(auth, async (fUser) => {
      setFirebaseUser(fUser);
      
      if (fUser) {
        const idToken = await fUser.getIdToken();
        setToken(idToken);
        
        try {
          // Fetch the user's profile from the backend using the token
          const res = await api.get<{ data: UserProfile }>('/auth/me', idToken);
          setUser(res.data);
        } catch (error) {
          console.error("Failed to load user profile", error);
          setUser(null);
        }
      } else {
        setToken(null);
        setUser(null);
      }
      
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email, password);
    // onIdTokenChanged will automatically handle the rest
  }, []);

  const logout = useCallback(async () => {
    await signOut(auth);
    // onIdTokenChanged will automatically handle the rest
  }, []);

  return (
    <AuthContext.Provider value={{ user, firebaseUser, token, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
