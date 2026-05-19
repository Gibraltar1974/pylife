'use client';

import React, { useState } from 'react';
import { useSignInWithEmailAndPassword, useCreateUserWithEmailAndPassword } from 'react-firebase-hooks/auth';
import { auth } from '../lib/firebase';
import { Activity } from 'lucide-react';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  
  const [signInWithEmailAndPassword, user, loading, error] = useSignInWithEmailAndPassword(auth);
  const [createUserWithEmailAndPassword, newUser, newLoading, newError] = useCreateUserWithEmailAndPassword(auth);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isRegistering) {
      createUserWithEmailAndPassword(email, password);
    } else {
      signInWithEmailAndPassword(email, password);
    }
  };

  const isLoading = loading || newLoading;
  const currentError = error || newError;

  return (
    <div className="min-h-screen bg-[#FAF9F6] text-[#1A1A1A] font-sans flex flex-col items-center justify-center selection:bg-[#1A1A1A] selection:text-white p-6">
      <div className="w-full max-w-sm border border-[#1A1A1A] bg-white/50 p-8">
        <h1 className="font-serif italic text-3xl tracking-tight mb-2 text-center">Life Calculator.</h1>
        <p className="text-[10px] uppercase tracking-[0.2em] font-bold opacity-60 text-center mb-8">Structural Integrity Framework</p>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <label className="text-[10px] uppercase tracking-tighter font-bold flex items-center opacity-70">
              Email
            </label>
            <input 
              type="email" 
              value={email} 
              onChange={e => setEmail(e.target.value)}
              className="w-full bg-white/50 border border-black/20 px-3 py-2 text-sm outline-none focus:border-[#1A1A1A] font-mono"
              required
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] uppercase tracking-tighter font-bold flex items-center opacity-70">
              Password
            </label>
            <input 
              type="password" 
              value={password} 
              onChange={e => setPassword(e.target.value)}
              className="w-full bg-white/50 border border-black/20 px-3 py-2 text-sm outline-none focus:border-[#1A1A1A] font-mono"
              required
            />
          </div>

          {currentError && (
             <div className="text-[10px] text-red-600 bg-red-50 p-2 border border-red-200">
               {currentError.message}
             </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-[#1A1A1A] text-white py-3 text-[11px] uppercase tracking-[0.3em] font-bold hover:bg-black/80 disabled:opacity-50 transition-all flex items-center justify-center gap-3 shrink-0"
          >
            {isLoading ? <Activity className="w-4 h-4 animate-spin" /> : (isRegistering ? 'Register' : 'Log In')}
          </button>
        </form>

        <div className="mt-6 text-center text-[10px] uppercase tracking-widest">
          <button type="button" onClick={() => setIsRegistering(!isRegistering)} className="opacity-60 hover:opacity-100 font-bold">
            {isRegistering ? 'Already have an account? Log In' : 'Need an account? Register'}
          </button>
        </div>
      </div>
    </div>
  );
}
