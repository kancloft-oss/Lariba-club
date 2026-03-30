import React, { useState } from 'react';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../firebase';
import { useNavigate } from 'react-router-dom';

export default function Login() {
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    // Map login to a hidden email for Firebase Auth
    const email = login.toLowerCase() + '@lariba.local';
    
    try {
      await signInWithEmailAndPassword(auth, email, password);
      navigate('/');
    } catch (err: any) {
      if (err.code === 'auth/operation-not-allowed') {
        setError('Ошибка: В Firebase Console не включен вход по Email/Password. Пожалуйста, включите его в разделе Authentication > Sign-in method.');
        return;
      }
      // If it's the admin credentials and login fails, bootstrap the admin account
      if (login === 'Admin' && password === '1122334455Qw') {
        try {
          await createUserWithEmailAndPassword(auth, email, password);
          navigate('/');
        } catch (createErr: any) {
          if (createErr.code === 'auth/operation-not-allowed') {
            setError('Ошибка: В Firebase Console не включен вход по Email/Password. Пожалуйста, включите его в разделе Authentication > Sign-in method.');
          } else {
            setError('Ошибка входа: ' + createErr.message);
          }
        }
      } else {
        setError('Неверный логин или пароль');
      }
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8 bg-white p-8 sm:p-10 rounded-3xl shadow-sm border border-zinc-200">
        <div className="text-center">
          <div className="w-16 h-16 bg-zinc-900 text-white rounded-2xl flex items-center justify-center text-2xl font-bold mx-auto mb-6 shadow-sm">
            L
          </div>
          <h2 className="text-3xl font-bold text-zinc-900 tracking-tight">
            LARIBA Business Club
          </h2>
          <p className="mt-3 text-sm text-zinc-500">
            Войдите в свой аккаунт
          </p>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleLogin}>
          {error && (
            <div className="p-4 bg-rose-50 text-sm text-rose-600 rounded-xl border border-rose-100 text-center font-medium">
              {error}
            </div>
          )}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1.5 ml-1">Логин</label>
              <input
                type="text"
                required
                className="appearance-none block w-full px-4 py-3 border border-zinc-200 placeholder-zinc-400 text-zinc-900 rounded-xl focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-zinc-900 sm:text-sm transition-all bg-zinc-50/50 focus:bg-white"
                placeholder="Введите логин"
                value={login}
                onChange={(e) => setLogin(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1.5 ml-1">Пароль</label>
              <input
                type="password"
                required
                className="appearance-none block w-full px-4 py-3 border border-zinc-200 placeholder-zinc-400 text-zinc-900 rounded-xl focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-zinc-900 sm:text-sm transition-all bg-zinc-50/50 focus:bg-white"
                placeholder="Введите пароль"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          <div>
            <button
              type="submit"
              className="w-full flex justify-center py-3 px-4 border border-transparent rounded-xl shadow-sm text-sm font-medium text-white bg-zinc-900 hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-zinc-900 transition-colors"
            >
              Войти
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
