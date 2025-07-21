import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, getDocs, query, where, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { useAuth } from '../contexts/AuthContext';
import { db, auth } from '../firebase';
import { Zap, Eye, EyeOff } from 'lucide-react';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, userData } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // First try normal login
      try {
        await login(email, password);
        // Navigation will be handled by useEffect in App.tsx based on user role
      } catch (loginError) {
        // If login fails, check if this is a pending player account
        const pendingPlayerQuery = query(
          collection(db, 'players'),
          where('email', '==', email),
          where('password', '==', password),
          where('status', '==', 'pending')
        );
        const pendingPlayerSnapshot = await getDocs(pendingPlayerQuery);
        
        if (pendingPlayerSnapshot.docs.length > 0) {
          // Found a pending player account, activate it
          const playerData = pendingPlayerSnapshot.docs[0].data();
          
          // Create Firebase Auth account
          const userCredential = await createUserWithEmailAndPassword(auth, email, password);
          const user = userCredential.user;
          
          // Create user document in Firestore
          await setDoc(doc(db, 'users', user.uid), {
            uid: user.uid,
            email: user.email,
            name: playerData.name,
            role: 'player',
            createdAt: new Date(),
            activatedAt: new Date()
          });
          
          // Delete the pending player record
          await deleteDoc(pendingPlayerSnapshot.docs[0].ref);
          
          // The auth state change will handle navigation
        } else {
          throw loginError; // Re-throw the original login error
        }
      }
    } catch (err) {
      setError('Invalid email or password. If you are a new player, please contact your administrator.');
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    if (userData) {
      // Let the ProtectedRoute handle the redirection
      navigate('/');
    }
  }, [userData, navigate]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-cyberpunk-black via-cyberpunk-violet to-cyberpunk-black flex items-center justify-center">
      {/* Animated Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-cyberpunk-pink rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-pulse"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-cyberpunk-blue rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-pulse animation-delay-2000"></div>
      </div>

      <div className="relative z-10 w-full max-w-md">
        <div className="bg-cyberpunk-black/20 backdrop-blur-lg rounded-2xl p-8 border border-cyberpunk-pink/20">
          <div className="text-center mb-8">
            <div className="flex justify-center mb-4">
              <Zap className="w-12 h-12 text-cyberpunk-blue" />
            </div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-cyberpunk-blue to-cyberpunk-pink bg-clip-text text-transparent mb-2">
              vjac.co
            </h1>
            <p className="text-cyberpunk-yellow">Welcome back to your dashboard</p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Email Address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 bg-white/5 border border-purple-500/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:border-transparent transition-all"
                placeholder="Enter your email"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 bg-white/5 border border-purple-500/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:border-transparent transition-all pr-12"
                  placeholder="Enter your password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-cyan-400 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-cyan-500 to-purple-500 hover:from-cyan-600 hover:to-purple-600 text-white font-medium py-3 px-4 rounded-lg transition-all duration-200 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-purple-500/20">
            
          </div>
        </div>
      </div>
    </div>
  );
}