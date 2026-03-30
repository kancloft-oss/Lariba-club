import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, doc, setDoc, deleteDoc, updateDoc } from 'firebase/firestore';
import { createUserWithEmailAndPassword, getAuth, signOut } from 'firebase/auth';
import { initializeApp } from 'firebase/app';
import { db, auth, handleFirestoreError, OperationType } from '../../firebase';
import firebaseConfig from '../../../firebase-applet-config.json';
import { UserProfile, Tariff } from '../../contexts/AuthContext';
import { Plus, Edit2, Trash2, X, Search } from 'lucide-react';

// Initialize a secondary app for user creation to prevent logging out the admin
const secondaryApp = initializeApp(firebaseConfig, 'SecondaryApp');
const secondaryAuth = getAuth(secondaryApp);

export default function AdminUsers() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Form state
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [tariff, setTariff] = useState<Tariff>('Moneycan');
  const [paymentStatus, setPaymentStatus] = useState<'paid' | 'unpaid'>('unpaid');
  const [paymentDueDate, setPaymentDueDate] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'users'), (snapshot) => {
      const usersData = snapshot.docs.map(doc => doc.data() as UserProfile);
      setUsers(usersData.filter(u => u.role === 'resident'));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'users');
    });

    return unsubscribe;
  }, []);

  const resetForm = () => {
    setLogin('');
    setPassword('');
    setName('');
    setTariff('Moneycan');
    setPaymentStatus('unpaid');
    setPaymentDueDate('');
    setError('');
    setEditingUser(null);
  };

  const handleOpenModal = (user?: UserProfile) => {
    if (user) {
      setEditingUser(user);
      setLogin(user.login);
      setName(user.name);
      setTariff(user.tariff);
      setPaymentStatus(user.paymentStatus);
      setPaymentDueDate(user.paymentDueDate || '');
    } else {
      resetForm();
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    resetForm();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      if (editingUser) {
        const userRef = doc(db, 'users', editingUser.uid);
        await updateDoc(userRef, {
          name,
          tariff,
          paymentStatus,
          paymentDueDate: paymentDueDate || null
        });
      } else {
        const emailForAuth = login.toLowerCase() + '@lariba.local';
        const userCredential = await createUserWithEmailAndPassword(secondaryAuth, emailForAuth, password);
        const newUserUid = userCredential.user.uid;
        
        // Sign out from the secondary app immediately so it doesn't interfere
        await signOut(secondaryAuth);
        
        const newUser: UserProfile = {
          uid: newUserUid,
          login,
          name,
          role: 'resident',
          tariff,
          paymentStatus,
          paymentDueDate: paymentDueDate || undefined,
          createdAt: new Date().toISOString()
        };

        await setDoc(doc(db, 'users', newUserUid), newUser);
      }
      handleCloseModal();
    } catch (err: any) {
      if (err.code === 'auth/email-already-in-use') {
        setError('Пользователь с таким логином уже существует. Пожалуйста, придумайте другой логин.');
      } else if (err.code === 'auth/weak-password') {
        setError('Пароль слишком простой. Он должен содержать не менее 6 символов.');
      } else {
        try {
          const errorInfo = JSON.parse(err.message);
          setError('Ошибка доступа: ' + errorInfo.error);
        } catch {
          setError('Ошибка: ' + err.message);
        }
      }
    }
  };

  const handleDelete = async (uid: string) => {
    if (window.confirm('Вы уверены, что хотите удалить этого резидента?')) {
      try {
        await deleteDoc(doc(db, 'users', uid));
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `users/${uid}`);
      }
    }
  };

  const filteredUsers = users.filter(user => 
    user.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    user.login.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6 pb-20 md:pb-0">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-2xl font-bold text-zinc-900 tracking-tight">Резиденты</h2>
        <button
          onClick={() => handleOpenModal()}
          className="w-full sm:w-auto bg-zinc-900 text-white px-5 py-2.5 rounded-xl flex items-center justify-center space-x-2 hover:bg-zinc-800 transition-colors shadow-sm"
        >
          <Plus size={20} />
          <span className="font-medium">Добавить резидента</span>
        </button>
      </div>

      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Search className="h-5 w-5 text-zinc-400" />
        </div>
        <input
          type="text"
          placeholder="Поиск по имени или логину..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="block w-full pl-10 pr-3 py-3 border border-zinc-200 rounded-xl leading-5 bg-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-zinc-900 sm:text-sm transition-all shadow-sm"
        />
      </div>

      {/* Desktop Table View */}
      <div className="hidden md:block bg-white shadow-sm border border-zinc-200 rounded-2xl overflow-hidden">
        <table className="min-w-full divide-y divide-zinc-200">
          <thead className="bg-zinc-50/50">
            <tr>
              <th className="px-6 py-4 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wider">Имя</th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wider">Логин</th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wider">Тариф</th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wider">Статус оплаты</th>
              <th className="px-6 py-4 text-right text-xs font-semibold text-zinc-500 uppercase tracking-wider">Действия</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-zinc-100">
            {filteredUsers.map((user) => (
              <tr key={user.uid} className="hover:bg-zinc-50/50 transition-colors">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-medium text-zinc-900">{user.name}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-zinc-500">{user.login}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2.5 py-1 inline-flex text-xs leading-5 font-semibold rounded-full 
                    ${user.tariff === 'Richer' ? 'bg-purple-100 text-purple-700' : 
                      user.tariff === 'Lemoner' ? 'bg-yellow-100 text-yellow-700' : 
                      'bg-emerald-100 text-emerald-700'}`}>
                    {user.tariff}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex flex-col">
                    <span className={`px-2.5 py-1 inline-flex text-xs leading-5 font-semibold rounded-full w-fit
                      ${user.paymentStatus === 'paid' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                      {user.paymentStatus === 'paid' ? 'Оплачено' : 'Не оплачено'}
                    </span>
                    {user.paymentDueDate && (
                      <span className="text-xs text-zinc-500 mt-1.5">До: {new Date(user.paymentDueDate).toLocaleDateString()}</span>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <button onClick={() => handleOpenModal(user)} className="text-zinc-400 hover:text-zinc-900 transition-colors mr-3 p-1">
                    <Edit2 size={18} />
                  </button>
                  <button onClick={() => handleDelete(user.uid)} className="text-zinc-400 hover:text-rose-600 transition-colors p-1">
                    <Trash2 size={18} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile Card View */}
      <div className="md:hidden space-y-4">
        {filteredUsers.map((user) => (
          <div key={user.uid} className="bg-white p-5 rounded-2xl shadow-sm border border-zinc-200 flex flex-col gap-4">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-base font-bold text-zinc-900">{user.name}</h3>
                <p className="text-sm text-zinc-500 mt-0.5">{user.login}</p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => handleOpenModal(user)} className="p-2 text-zinc-400 hover:text-zinc-900 bg-zinc-50 rounded-lg">
                  <Edit2 size={16} />
                </button>
                <button onClick={() => handleDelete(user.uid)} className="p-2 text-zinc-400 hover:text-rose-600 bg-zinc-50 rounded-lg">
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
            
            <div className="flex flex-wrap gap-2 items-center">
              <span className={`px-2.5 py-1 text-xs font-semibold rounded-full 
                ${user.tariff === 'Richer' ? 'bg-purple-100 text-purple-700' : 
                  user.tariff === 'Lemoner' ? 'bg-yellow-100 text-yellow-700' : 
                  'bg-emerald-100 text-emerald-700'}`}>
                {user.tariff}
              </span>
              <span className={`px-2.5 py-1 text-xs font-semibold rounded-full 
                ${user.paymentStatus === 'paid' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                {user.paymentStatus === 'paid' ? 'Оплачено' : 'Не оплачено'}
              </span>
            </div>
            
            {user.paymentDueDate && (
              <div className="text-xs text-zinc-500 bg-zinc-50 p-2 rounded-lg inline-block w-fit">
                Срок оплаты: <span className="font-medium text-zinc-700">{new Date(user.paymentDueDate).toLocaleDateString()}</span>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-end sm:items-center justify-center min-h-screen p-4 text-center sm:p-0">
            <div className="fixed inset-0 transition-opacity" aria-hidden="true" onClick={handleCloseModal}>
              <div className="absolute inset-0 bg-zinc-900/40 backdrop-blur-sm"></div>
            </div>
            <div className="relative z-10 inline-block align-bottom bg-white rounded-2xl text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full w-full">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="flex justify-between items-center mb-5">
                  <h3 className="text-xl font-bold text-zinc-900 tracking-tight">
                    {editingUser ? 'Редактировать резидента' : 'Новый резидент'}
                  </h3>
                  <button onClick={handleCloseModal} className="text-zinc-400 hover:text-zinc-600 bg-zinc-100 p-1.5 rounded-full transition-colors">
                    <X size={20} />
                  </button>
                </div>
                {error && <div className="mb-5 p-3 bg-rose-50 text-sm text-rose-600 rounded-xl border border-rose-100">{error}</div>}
                <form onSubmit={handleSubmit} className="space-y-4">
                  {!editingUser && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-zinc-700 mb-1.5">Логин</label>
                        <input type="text" required value={login} onChange={(e) => setLogin(e.target.value)} className="block w-full border border-zinc-200 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-zinc-900 focus:border-zinc-900 sm:text-sm transition-all" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-zinc-700 mb-1.5">Пароль</label>
                        <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className="block w-full border border-zinc-200 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-zinc-900 focus:border-zinc-900 sm:text-sm transition-all" />
                      </div>
                    </div>
                  )}
                  <div>
                    <label className="block text-sm font-medium text-zinc-700 mb-1.5">Имя</label>
                    <input type="text" required value={name} onChange={(e) => setName(e.target.value)} className="block w-full border border-zinc-200 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-zinc-900 focus:border-zinc-900 sm:text-sm transition-all" />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-zinc-700 mb-1.5">Тариф</label>
                      <select value={tariff} onChange={(e) => setTariff(e.target.value as Tariff)} className="block w-full border border-zinc-200 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-zinc-900 focus:border-zinc-900 sm:text-sm transition-all bg-white">
                        <option value="Moneycan">Moneycan</option>
                        <option value="Lemoner">Lemoner</option>
                        <option value="Richer">Richer</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-zinc-700 mb-1.5">Статус оплаты</label>
                      <select value={paymentStatus} onChange={(e) => setPaymentStatus(e.target.value as 'paid' | 'unpaid')} className="block w-full border border-zinc-200 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-zinc-900 focus:border-zinc-900 sm:text-sm transition-all bg-white">
                        <option value="paid">Оплачено</option>
                        <option value="unpaid">Не оплачено</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-zinc-700 mb-1.5">Срок оплаты (до)</label>
                    <input type="date" value={paymentDueDate} onChange={(e) => setPaymentDueDate(e.target.value)} className="block w-full border border-zinc-200 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-zinc-900 focus:border-zinc-900 sm:text-sm transition-all" />
                  </div>
                  
                  <div className="mt-8 sm:flex sm:flex-row-reverse gap-3 pt-4 border-t border-zinc-100">
                    <button type="submit" className="w-full sm:w-auto inline-flex justify-center items-center rounded-xl border border-transparent px-6 py-2.5 bg-zinc-900 text-sm font-medium text-white hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-zinc-900 transition-colors shadow-sm">
                      {editingUser ? 'Сохранить' : 'Создать'}
                    </button>
                    <button type="button" onClick={handleCloseModal} className="mt-3 sm:mt-0 w-full sm:w-auto inline-flex justify-center items-center rounded-xl border border-zinc-200 px-6 py-2.5 bg-white text-sm font-medium text-zinc-700 hover:bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-zinc-900 transition-colors">
                      Отмена
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
