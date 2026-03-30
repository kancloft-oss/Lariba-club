import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, doc, setDoc, deleteDoc, updateDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../../firebase';
import { Plus, Trash2, X, CheckCircle2, Circle, Edit2, Filter, Shield } from 'lucide-react';
import { UserProfile } from '../../contexts/AuthContext';
import { Guild } from './AdminGuilds';

export interface Code {
  id: string;
  title: string;
  description: string;
  residentId: string;
  createdAt: string;
  deadline: string;
  frequencyType: 'daily' | 'everyOtherDay' | 'weekly' | 'once';
  schedule?: string[]; // e.g., ['1', '2', '3', '4', '5', '6', '0'] for weekly
  totalRequired: number;
  completedCount: number;
  completionHistory: string[]; // Array of ISO date strings
}

export default function AdminCodes() {
  const [codes, setCodes] = useState<Code[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [guilds, setGuilds] = useState<Guild[]>([]);
  const [selectedGuildId, setSelectedGuildId] = useState<string>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCode, setEditingCode] = useState<Code | null>(null);
  
  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [residentId, setResidentId] = useState('');
  const [deadline, setDeadline] = useState('');
  const [frequencyType, setFrequencyType] = useState<'daily' | 'everyOtherDay' | 'weekly' | 'once'>('once');
  const [schedule, setSchedule] = useState<string[]>([]);
  const [totalRequired, setTotalRequired] = useState(1);
  const [error, setError] = useState('');

  // Auto-calculate totalRequired
  useEffect(() => {
    if (!deadline) return;
    
    const start = new Date();
    const end = new Date(deadline);
    if (end < start) return;

    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    let count = 1;
    if (frequencyType === 'daily') {
      count = diffDays + 1;
    } else if (frequencyType === 'everyOtherDay') {
      count = Math.floor(diffDays / 2) + 1;
    } else if (frequencyType === 'weekly') {
      // Count days in schedule within the range
      let weeklyCount = 0;
      for (let i = 0; i <= diffDays; i++) {
        const d = new Date(start);
        d.setDate(d.getDate() + i);
        const dayOfWeek = d.getDay() === 0 ? '7' : d.getDay().toString(); // Adjust to 1-7 (Mon-Sun)
        if (schedule.includes(dayOfWeek)) {
          weeklyCount++;
        }
      }
      count = weeklyCount || 1;
    }
    setTotalRequired(count);
  }, [deadline, frequencyType, schedule]);

  useEffect(() => {
    const unsubscribeCodes = onSnapshot(collection(db, 'codes'), (snapshot) => {
      const codesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Code));
      codesData.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setCodes(codesData);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'codes');
    });

    const unsubscribeUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
      const usersData = snapshot.docs.map(doc => doc.data() as UserProfile);
      setUsers(usersData.filter(u => u.role === 'resident'));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'users');
    });

    const unsubscribeGuilds = onSnapshot(collection(db, 'guilds'), (snapshot) => {
      const guildsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Guild));
      setGuilds(guildsData);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'guilds');
    });

    return () => {
      unsubscribeCodes();
      unsubscribeUsers();
      unsubscribeGuilds();
    };
  }, []);

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setResidentId('');
    setDeadline('');
    setFrequencyType('once');
    setSchedule([]);
    setTotalRequired(1);
    setError('');
    setEditingCode(null);
  };

  const handleOpenModal = (code?: Code) => {
    if (code) {
      setEditingCode(code);
      setTitle(code.title);
      setDescription(code.description);
      setResidentId(code.residentId);
      setDeadline(code.deadline);
      setFrequencyType(code.frequencyType);
      setSchedule(code.schedule || []);
      setTotalRequired(code.totalRequired);
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

    if (!residentId || !deadline) {
      setError('Пожалуйста, выберите резидента и укажите дедлайн.');
      return;
    }

    try {
      if (editingCode) {
        await updateDoc(doc(db, 'codes', editingCode.id), {
          title,
          description,
          residentId,
          deadline,
          frequencyType,
          schedule,
          totalRequired,
        });
      } else {
        const newCodeRef = doc(collection(db, 'codes'));
        await setDoc(newCodeRef, {
          title,
          description,
          residentId,
          createdAt: new Date().toISOString(),
          deadline,
          frequencyType,
          schedule,
          totalRequired,
          completedCount: 0,
          completionHistory: []
        });
      }
      handleCloseModal();
    } catch (err: any) {
      try {
        const errorInfo = JSON.parse(err.message);
        setError('Ошибка доступа: ' + errorInfo.error);
      } catch {
        setError('Ошибка: ' + err.message);
      }
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'codes', id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `codes/${id}`);
    }
  };

  const getUserName = (uid: string) => {
    return users.find(u => u.uid === uid)?.name || 'Неизвестный пользователь';
  };

  const getUserGuildName = (uid: string) => {
    const user = users.find(u => u.uid === uid);
    if (!user?.guildId) return 'Без гильдии';
    return guilds.find(g => g.id === user.guildId)?.name || 'Неизвестная гильдия';
  };

  const filteredCodes = codes.filter(code => {
    if (selectedGuildId === 'all') return true;
    const user = users.find(u => u.uid === code.residentId);
    return user?.guildId === selectedGuildId;
  }).sort((a, b) => {
    const guildA = getUserGuildName(a.residentId);
    const guildB = getUserGuildName(b.residentId);
    return guildA.localeCompare(guildB);
  });

  return (
    <div className="space-y-6 pb-20 md:pb-0">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-2xl font-bold text-zinc-900 tracking-tight">Управление кодами</h2>
        <div className="flex flex-col sm:flex-row w-full sm:w-auto gap-3">
          <div className="relative w-full sm:w-64">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Shield size={16} className="text-zinc-400" />
            </div>
            <select
              value={selectedGuildId}
              onChange={(e) => setSelectedGuildId(e.target.value)}
              className="block w-full pl-10 pr-4 py-2.5 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-zinc-900 focus:border-zinc-900 sm:text-sm transition-all bg-white font-medium text-zinc-700"
            >
              <option value="all">Все гильдии</option>
              {guilds.map(guild => (
                <option key={guild.id} value={guild.id}>{guild.name}</option>
              ))}
            </select>
          </div>
          <button
            onClick={() => handleOpenModal()}
            className="w-full sm:w-auto bg-zinc-900 text-white px-5 py-2.5 rounded-xl flex items-center justify-center space-x-2 hover:bg-zinc-800 transition-colors shadow-sm"
          >
            <Plus size={20} />
            <span className="font-medium">Назначить код</span>
          </button>
        </div>
      </div>

      {/* Desktop Table View */}
      <div className="hidden md:block bg-white shadow-sm border border-zinc-200 rounded-2xl overflow-hidden">
        <table className="min-w-full divide-y divide-zinc-200">
          <thead className="bg-zinc-50/50">
            <tr>
              <th className="px-6 py-4 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wider">Резидент</th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wider">Гильдия</th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wider">Название кода</th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wider">Статус</th>
              <th className="px-6 py-4 text-right text-xs font-semibold text-zinc-500 uppercase tracking-wider">Действия</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-zinc-100">
            {filteredCodes.map((code) => (
              <tr key={code.id} className="hover:bg-zinc-50/50 transition-colors">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-medium text-zinc-900">{getUserName(code.residentId)}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center text-xs font-medium text-zinc-500">
                    <Shield size={12} className="mr-1.5 text-zinc-400" />
                    {getUserGuildName(code.residentId)}
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="text-sm font-medium text-zinc-900">{code.title}</div>
                  <div className="text-xs text-zinc-500 truncate max-w-xs mt-0.5">{code.description}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center space-x-2">
                    <div className="text-sm font-medium text-zinc-900">
                      {code.completedCount} / {code.totalRequired}
                    </div>
                    <span className={`px-2.5 py-1 inline-flex text-xs leading-5 font-semibold rounded-full 
                      ${code.completedCount >= code.totalRequired ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                      {code.completedCount >= code.totalRequired ? 'Выполнено' : 'В процессе'}
                    </span>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium flex justify-end gap-2">
                  <button onClick={() => handleOpenModal(code)} className="text-zinc-400 hover:text-zinc-900 transition-colors p-1">
                    <Edit2 size={18} />
                  </button>
                  <button onClick={() => handleDelete(code.id)} className="text-zinc-400 hover:text-rose-600 transition-colors p-1">
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
        {filteredCodes.map((code) => (
          <div key={code.id} className="bg-white p-5 rounded-2xl shadow-sm border border-zinc-200 flex flex-col gap-4">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-base font-bold text-zinc-900">{code.title}</h3>
                <div className="flex flex-col mt-1">
                  <p className="text-sm font-medium text-zinc-600">{getUserName(code.residentId)}</p>
                  <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider flex items-center mt-0.5">
                    <Shield size={10} className="mr-1" />
                    {getUserGuildName(code.residentId)}
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => handleOpenModal(code)} className="p-2 text-zinc-400 hover:text-zinc-900 bg-zinc-50 rounded-lg">
                  <Edit2 size={16} />
                </button>
                <button onClick={() => handleDelete(code.id)} className="p-2 text-zinc-400 hover:text-rose-600 bg-zinc-50 rounded-lg">
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
            
            <p className="text-sm text-zinc-500 leading-relaxed">{code.description}</p>
            
            <div className="flex items-center justify-between pt-3 border-t border-zinc-100">
              <div className="flex items-center space-x-2">
                <div className="text-sm font-medium text-zinc-900">
                  {code.completedCount} / {code.totalRequired}
                </div>
                <span className={`px-2.5 py-1 text-xs font-semibold rounded-full 
                  ${code.completedCount >= code.totalRequired ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                  {code.completedCount >= code.totalRequired ? 'Выполнено' : 'В процессе'}
                </span>
              </div>
            </div>
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
                    Назначить новый код
                  </h3>
                  <button onClick={handleCloseModal} className="text-zinc-400 hover:text-zinc-600 bg-zinc-100 p-1.5 rounded-full transition-colors">
                    <X size={20} />
                  </button>
                </div>
                {error && <div className="mb-5 p-3 bg-rose-50 text-sm text-rose-600 rounded-xl border border-rose-100">{error}</div>}
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-zinc-700 mb-1.5">Резидент</label>
                    <select required value={residentId} onChange={(e) => setResidentId(e.target.value)} className="block w-full border border-zinc-200 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-zinc-900 focus:border-zinc-900 sm:text-sm transition-all bg-white">
                      <option value="">Выберите резидента...</option>
                      {users.map(u => (
                        <option key={u.uid} value={u.uid}>{u.name} ({u.tariff})</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-zinc-700 mb-1.5">Название кода</label>
                    <input type="text" required value={title} onChange={(e) => setTitle(e.target.value)} className="block w-full border border-zinc-200 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-zinc-900 focus:border-zinc-900 sm:text-sm transition-all" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-zinc-700 mb-1.5">Описание</label>
                    <textarea required value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className="block w-full border border-zinc-200 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-zinc-900 focus:border-zinc-900 sm:text-sm transition-all resize-none" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-zinc-700 mb-1.5">Дедлайн</label>
                    <input type="date" required value={deadline} onChange={(e) => setDeadline(e.target.value)} className="block w-full border border-zinc-200 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-zinc-900 focus:border-zinc-900 sm:text-sm transition-all bg-white" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-zinc-700 mb-1.5">Тип разбивки</label>
                    <select required value={frequencyType} onChange={(e) => setFrequencyType(e.target.value as any)} className="block w-full border border-zinc-200 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-zinc-900 focus:border-zinc-900 sm:text-sm transition-all bg-white">
                      <option value="once">Разово</option>
                      <option value="daily">По дням</option>
                      <option value="everyOtherDay">Через день</option>
                      <option value="weekly">По неделям</option>
                    </select>
                  </div>
                  {frequencyType === 'weekly' && (
                    <div>
                      <label className="block text-sm font-medium text-zinc-700 mb-1.5">Дни недели</label>
                      <div className="flex gap-2">
                        {['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map((day, i) => (
                          <button
                            key={day}
                            type="button"
                            onClick={() => {
                              const dayStr = (i + 1).toString();
                              setSchedule(prev => prev.includes(dayStr) ? prev.filter(d => d !== dayStr) : [...prev, dayStr]);
                            }}
                            className={`px-3 py-2 rounded-lg text-xs font-bold ${schedule.includes((i + 1).toString()) ? 'bg-zinc-900 text-white' : 'bg-zinc-100 text-zinc-700'}`}
                          >
                            {day}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  <div>
                    <label className="block text-sm font-medium text-zinc-700 mb-1.5">Всего выполнений (авто)</label>
                    <input type="number" readOnly value={totalRequired} className="block w-full border border-zinc-200 rounded-xl px-4 py-2.5 bg-zinc-50 text-zinc-500 sm:text-sm transition-all" />
                  </div>
                  
                  <div className="mt-8 sm:flex sm:flex-row-reverse gap-3 pt-4 border-t border-zinc-100">
                    <button type="submit" className="w-full sm:w-auto inline-flex justify-center items-center rounded-xl border border-transparent px-6 py-2.5 bg-zinc-900 text-sm font-medium text-white hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-zinc-900 transition-colors shadow-sm">
                      Назначить код
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
