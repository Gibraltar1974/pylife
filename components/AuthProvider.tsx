'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut } from 'firebase/auth';
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';

interface AuthContextType {
  user: User | null;
  credits: number;
  loading: boolean;
  signIn: () => Promise<void>;
  logOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [credits, setCredits] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        // Retrieve or create user doc
        const userRef = doc(db, 'users', currentUser.uid);
        const userDoc = await getDoc(userRef);
        if (!userDoc.exists()) {
          // Initialize new user with 10 credits
          await setDoc(userRef, {
            email: currentUser.email,
            credits: 10,
            createdAt: new Date().toISOString()
          });
          setCredits(10);
        } else {
          setCredits(userDoc.data().credits || 0);
        }

        // Listen for credit changes
        const unsubCredits = onSnapshot(userRef, (docSnap) => {
          if (docSnap.exists()) {
            setCredits(docSnap.data().credits || 0);
          }
        });
        
        setLoading(false);
        return () => unsubCredits();
      } else {
        setCredits(0);
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const signIn = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error('Sign-in error', error);
      throw error;
    }
  };

  const logOut = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Sign-out error', error);
    }
  };

  return (
    <AuthContext.Provider value={{ user, credits, loading, signIn, logOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
