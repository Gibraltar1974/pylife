'use client';

import React, { useState } from 'react';
import { signInWithPopup, createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { auth, googleProvider, microsoftProvider, appleProvider } from '../lib/firebase';
import { LogIn, Mail, Activity, AlertCircle } from 'lucide-react';
import { FirebaseError } from 'firebase/app';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleAuthError = (err: any) => {
    if (err instanceof FirebaseError) {
      if (err.code === 'auth/email-already-in-use') setError('El email ya está registrado.');
      else if (err.code === 'auth/wrong-password' || err.code === 'auth/user-not-found') setError('Credenciales inválidas.');
      else setError(err.message);
    } else {
      setError('Ocurrió un error inesperado');
    }
  };

  const signInWithGoogle = async () => {
    try {
      setError(''); setLoading(true);
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      handleAuthError(err);
    } finally { setLoading(false); }
  };

  const signInWithMicrosoft = async () => {
    try {
      setError(''); setLoading(true);
      await signInWithPopup(auth, microsoftProvider);
    } catch (err) {
      handleAuthError(err);
    } finally { setLoading(false); }
  };

  const signInWithApple = async () => {
    try {
      setError(''); setLoading(true);
      await signInWithPopup(auth, appleProvider);
    } catch (err) {
      handleAuthError(err);
    } finally { setLoading(false); }
  };

  const signInWithEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setError(''); setLoading(true);
      if (isSignUp) {
        await createUserWithEmailAndPassword(auth, email, password);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (err) {
      handleAuthError(err);
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-[#FAF9F6] text-[#1A1A1A] font-sans flex flex-col justify-center items-center p-6 selection:bg-[#1A1A1A] selection:text-white">
      <div className="w-full max-w-sm mb-12 text-center">
        <h1 className="font-serif italic text-4xl tracking-tight mb-2">Life Calculator.</h1>
        <p className="text-[10px] uppercase tracking-[0.2em] font-bold opacity-60">Structural Integrity Framework</p>
      </div>

      <div className="w-full max-w-sm bg-white/50 border border-black/10 p-8 shadow-xl">
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-900 text-[10px] uppercase tracking-widest font-bold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={signInWithEmail} className="space-y-4 mb-6">
          <h2 className="text-[10px] font-bold uppercase tracking-widest border-b border-black/10 pb-4">
            {isSignUp ? 'Create Account' : 'Sign In'}
          </h2>
          <div className="space-y-2">
            <input
              type="email"
              placeholder="Email address"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-white/50 border border-black/20 px-3 py-2 text-xs outline-none focus:border-[#1A1A1A] transition-colors"
            />
            <input
              type="password"
              placeholder="Password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-white/50 border border-black/20 px-3 py-2 text-xs outline-none focus:border-[#1A1A1A] transition-colors"
            />
          </div>
          <button 
            type="submit" 
            disabled={loading} 
            className="w-full bg-[#1A1A1A] text-white py-2.5 text-[10px] uppercase tracking-widest font-bold hover:bg-black/80 transition-colors flex items-center justify-center gap-2"
          >
            {isSignUp ? 'Register' : 'Log In'}
          </button>
          <div className="text-center pt-2">
            <button 
              type="button" 
              onClick={() => setIsSignUp(!isSignUp)}
              className="text-[10px] uppercase tracking-widest font-bold opacity-60 hover:opacity-100 transition-opacity"
            >
              {isSignUp ? 'Already have an account? Log In' : 'Need an account? Register'}
            </button>
          </div>
        </form>

        <div className="relative mb-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-black/10"></div>
          </div>
          <div className="relative flex justify-center text-[9px] uppercase tracking-widest font-bold">
            <span className="bg-[#FAF9F6] px-2 opacity-50">Or continue with</span>
          </div>
        </div>

        <div className="space-y-3">
          <button onClick={signInWithGoogle} disabled={loading} className="w-full border border-black/20 bg-white py-2.5 text-[10px] uppercase tracking-widest font-bold hover:bg-black/5 transition-colors flex items-center justify-center gap-3">
            <svg viewBox="0 0 24 24" className="w-4 h-4"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
            Google
          </button>
          <button onClick={signInWithMicrosoft} disabled={loading} className="w-full border border-black/20 bg-white py-2.5 text-[10px] uppercase tracking-widest font-bold hover:bg-black/5 transition-colors flex items-center justify-center gap-3">
            <svg viewBox="0 0 21 21" className="w-4 h-4"><rect x="1" y="1" width="9" height="9" fill="#f25022"/><rect x="11" y="1" width="9" height="9" fill="#7fba00"/><rect x="1" y="11" width="9" height="9" fill="#00a4ef"/><rect x="11" y="11" width="9" height="9" fill="#ffb900"/></svg>
            Microsoft
          </button>
          <button onClick={signInWithApple} disabled={loading} className="w-full border border-black/20 bg-[#1A1A1A] text-white py-2.5 text-[10px] uppercase tracking-widest font-bold hover:bg-black transition-colors flex items-center justify-center gap-3">
            <svg viewBox="0 0 384 512" className="w-4 h-4" fill="currentColor"><path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z"/></svg>
            Apple
          </button>
        </div>
      </div>
    </div>
  );
}
