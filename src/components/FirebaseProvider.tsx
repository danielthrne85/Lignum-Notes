import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, onAuthStateChanged } from 'firebase/auth';
import { auth, signInWithGoogle } from '../lib/firebase';
import { motion, AnimatePresence } from 'motion/react';
import { LogIn, Loader2 } from 'lucide-react';

interface FirebaseContextType {
  user: User | null;
  loading: boolean;
}

const FirebaseContext = createContext<FirebaseContextType>({ user: null, loading: true });

export const useFirebase = () => useContext(FirebaseContext);

export const FirebaseProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  if (loading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-zinc-50">
        <Loader2 className="w-8 h-8 text-zinc-400 animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-zinc-100/50 p-6">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white p-8 rounded-3xl shadow-2xl max-w-sm w-full text-center border border-zinc-100"
        >
          <div className="w-16 h-16 bg-blue-500 rounded-2xl flex items-center justify-center mx-auto mb-6 text-white shadow-lg shadow-blue-500/20">
            <LogIn size={32} />
          </div>
          <h1 className="text-2xl font-bold text-zinc-900 mb-2">Välkommen</h1>
          <p className="text-zinc-500 mb-8">Logga in för att synkronisera dina anteckningar.</p>
          <button 
            onClick={signInWithGoogle}
            className="w-full flex items-center justify-center gap-3 px-6 py-3 bg-zinc-900 hover:bg-zinc-800 text-white rounded-xl font-bold transition-all active:scale-95 shadow-lg shadow-zinc-900/10"
          >
            <img src="https://www.google.com/favicon.ico" className="w-5 h-5" alt="Google" />
            Logga in med Google
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <FirebaseContext.Provider value={{ user, loading }}>
      {children}
    </FirebaseContext.Provider>
  );
};
