import React, { useState, useEffect } from 'react';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../firebase';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function Login() {
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const navigate = useNavigate();
  const { userProfile } = useAuth();

  useEffect(() => {
    if (userProfile) {
      if (userProfile.role === 'admin') navigate('/admin');
      else if (userProfile.role === 'resident') navigate('/resident');
      else navigate('/');
    }
  }, [userProfile, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoggingIn(true);
    
    // Map login to a hidden email for Firebase Auth
    const email = login.toLowerCase() + '@lariba.local';
    
    try {
      await signInWithEmailAndPassword(auth, email, password);
      // Navigation is handled by useEffect when userProfile loads
    } catch (err: any) {
      if (err.code === 'auth/operation-not-allowed') {
        setError('Ошибка: В Firebase Console не включен вход по Email/Password. Пожалуйста, включите его в разделе Authentication > Sign-in method.');
        setIsLoggingIn(false);
        return;
      }
      // If it's the admin credentials and login fails, bootstrap the admin account
      if (login === 'Admin' && password === '1122334455Qw') {
        try {
          await createUserWithEmailAndPassword(auth, email, password);
          // Navigation is handled by useEffect when userProfile loads
        } catch (createErr: any) {
          if (createErr.code === 'auth/operation-not-allowed') {
            setError('Ошибка: В Firebase Console не включен вход по Email/Password. Пожалуйста, включите его в разделе Authentication > Sign-in method.');
          } else {
            setError('Ошибка входа: ' + createErr.message);
          }
          setIsLoggingIn(false);
        }
      } else {
        setError('Неверный логин или пароль');
        setIsLoggingIn(false);
      }
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-brand-black py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8 bg-[#111] p-8 sm:p-10 rounded-3xl shadow-sm border border-zinc-800">
        <div className="text-center">
          <img src="/logo.svg" alt="Laribaclub" className="w-48 mx-auto mb-6 rounded-2xl shadow-md" />
          <p className="mt-2 text-sm text-zinc-400">
            Войдите в свой аккаунт
          </p>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleLogin}>
          {error && (
            <div className="p-4 bg-rose-900/20 text-sm text-rose-400 rounded-xl border border-rose-900/50 text-center font-medium">
              {error}
            </div>
          )}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-1.5 ml-1">Логин</label>
              <input
                type="text"
                required
                className="appearance-none block w-full px-4 py-3 border border-zinc-800 placeholder-zinc-500 text-brand-white rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-white focus:border-brand-white sm:text-sm transition-all bg-brand-black/50 focus:bg-[#111]"
                placeholder="Введите логин"
                value={login}
                onChange={(e) => setLogin(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-1.5 ml-1">Пароль</label>
              <input
                type="password"
                required
                className="appearance-none block w-full px-4 py-3 border border-zinc-800 placeholder-zinc-500 text-brand-white rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-white focus:border-brand-white sm:text-sm transition-all bg-brand-black/50 focus:bg-[#111]"
                placeholder="Введите пароль"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={isLoggingIn}
              className="w-full flex justify-center py-3 px-4 border border-transparent rounded-xl shadow-sm text-sm font-medium text-brand-black bg-brand-white hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-brand-black focus:ring-brand-white transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {isLoggingIn ? 'Вход...' : 'Войти'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
