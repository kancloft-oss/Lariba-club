import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, doc, setDoc, deleteDoc, updateDoc, getDocs } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../../firebase';
import { Plus, Edit2, Trash2, X, Users, Shield, Trophy, Calendar } from 'lucide-react';
import { UserProfile } from '../../contexts/AuthContext';

export interface Guild {
  id: string;
  name: string;
  score: number;
  createdAt: string;
}

export default function AdminGuilds() {
  const [guilds, setGuilds] = useState<Guild[]>([]);
  const [richerUsers, setRicherUsers] = useState<UserProfile[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isMembersModalOpen, setIsMembersModalOpen] = useState(false);
  const [editingGuild, setEditingGuild] = useState<Guild | null>(null);
  
  const [currentMonthId] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  
  const [guildMonthlyScores, setGuildMonthlyScores] = useState<Record<string, number>>({});
  
  // Form state
  const [name, setName] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const unsubscribeGuilds = onSnapshot(collection(db, 'guilds'), (snapshot) => {
      const guildsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Guild));
      setGuilds(guildsData);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'guilds');
    });

    const unsubscribeUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
      const usersData = snapshot.docs.map(doc => doc.data() as UserProfile);
      setRicherUsers(usersData.filter(u => u.tariff === 'Richer'));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'users');
    });

    return () => {
      unsubscribeGuilds();
      unsubscribeUsers();
    };
  }, []);

  useEffect(() => {
    const fetchMonthlyScores = async () => {
      const scores: Record<string, number> = {};
      for (const guild of guilds) {
        const monthlyScoreRef = doc(db, 'guilds', guild.id, 'monthly_scores', currentMonthId);
        const monthlyDoc = await getDocs(collection(db, 'guilds', guild.id, 'monthly_scores'));
        const currentMonthDoc = monthlyDoc.docs.find(d => d.id === currentMonthId);
        scores[guild.id] = currentMonthDoc?.data().score || 0;
      }
      setGuildMonthlyScores(scores);
    };

    if (guilds.length > 0) {
      fetchMonthlyScores();
    }
  }, [guilds, currentMonthId]);

  const resetForm = () => {
    setName('');
    setError('');
    setEditingGuild(null);
  };

  const handleOpenModal = (guild?: Guild) => {
    if (guild) {
      setEditingGuild(guild);
      setName(guild.name);
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
      if (editingGuild) {
        const guildRef = doc(db, 'guilds', editingGuild.id);
        await updateDoc(guildRef, {
          name
        });
      } else {
        const newGuildRef = doc(collection(db, 'guilds'));
        await setDoc(newGuildRef, {
          name,
          score: 0,
          createdAt: new Date().toISOString()
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
    if (window.confirm('Вы уверены, что хотите удалить эту гильдию? Участники будут исключены из нее.')) {
      try {
        await deleteDoc(doc(db, 'guilds', id));
        // Unassign members
        const members = richerUsers.filter(u => u.guildId === id);
        for (const member of members) {
          await updateDoc(doc(db, 'users', member.uid), { guildId: null });
        }
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `guilds/${id}`);
      }
    }
  };

  const handleAssignMember = async (userId: string, guildId: string | null) => {
    try {
      await updateDoc(doc(db, 'users', userId), { guildId });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${userId}`);
    }
  };

  return (
    <div className="space-y-6 pb-20 md:pb-0">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-2xl font-bold text-zinc-900 tracking-tight">Управление гильдиями</h2>
        <button
          onClick={() => handleOpenModal()}
          className="w-full sm:w-auto bg-zinc-900 text-white px-5 py-2.5 rounded-xl flex items-center justify-center space-x-2 hover:bg-zinc-800 transition-colors shadow-sm"
        >
          <Plus size={20} />
          <span className="font-medium">Добавить гильдию</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {guilds.map((guild) => {
          const members = richerUsers.filter(u => u.guildId === guild.id);
          const monthlyScore = guildMonthlyScores[guild.id] || 0;
          return (
            <div key={guild.id} className="bg-white rounded-2xl shadow-sm border border-zinc-200 overflow-hidden flex flex-col">
              <div className="p-6 flex-1">
                <div className="flex justify-between items-start mb-6">
                  <div className="flex items-center space-x-3">
                    <div className="w-12 h-12 bg-zinc-100 rounded-xl flex items-center justify-center">
                      <Shield className="w-6 h-6 text-zinc-600" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-zinc-900 leading-tight">{guild.name}</h3>
                      <div className="flex flex-col mt-1">
                        <div className="flex items-center text-sm font-medium text-amber-600">
                          <Trophy size={14} className="mr-1" />
                          {monthlyScore.toFixed(1)} очков (мес)
                        </div>
                        <div className="flex items-center text-[10px] font-medium text-zinc-500 mt-0.5">
                          Всего: {guild.score.toFixed(1)}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="flex space-x-1">
                    <button onClick={() => { setEditingGuild(guild); setIsMembersModalOpen(true); }} className="p-2 text-zinc-400 hover:text-zinc-900 bg-zinc-100 hover:bg-zinc-200 rounded-lg transition-colors" title="Управление участниками">
                      <Users size={18} />
                    </button>
                    <button onClick={() => handleOpenModal(guild)} className="p-2 text-zinc-400 hover:text-zinc-900 bg-zinc-100 hover:bg-zinc-200 rounded-lg transition-colors" title="Редактировать">
                      <Edit2 size={18} />
                    </button>
                    <button onClick={() => handleDelete(guild.id)} className="p-2 text-zinc-400 hover:text-rose-600 bg-zinc-100 hover:bg-rose-50 rounded-lg transition-colors" title="Удалить">
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
                
                <div>
                  <div className="flex justify-between items-center mb-3">
                    <h4 className="text-sm font-bold text-zinc-900">Участники</h4>
                    <span className="text-xs font-medium text-zinc-500 bg-zinc-100 px-2 py-1 rounded-md">{members.length}/12</span>
                  </div>
                  <div className="bg-zinc-50 rounded-xl p-3 max-h-48 overflow-y-auto border border-zinc-200">
                    {members.length === 0 ? (
                      <p className="text-sm text-zinc-500 italic text-center py-4">Нет участников</p>
                    ) : (
                      <ul className="space-y-2">
                        {members.map(member => (
                          <li key={member.uid} className="flex justify-between items-center text-sm bg-white p-2 rounded-lg border border-zinc-200 shadow-sm">
                            <span className="font-medium text-zinc-900 truncate pr-2">{member.name}</span>
                            <button 
                              onClick={() => handleAssignMember(member.uid, null)}
                              className="text-xs font-medium text-rose-600 hover:text-rose-700 bg-rose-50 px-2 py-1 rounded-md transition-colors whitespace-nowrap border border-rose-100"
                            >
                              Удалить
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Guild Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-end sm:items-center justify-center min-h-screen p-4 text-center sm:p-0">
            <div className="fixed inset-0 transition-opacity" aria-hidden="true" onClick={handleCloseModal}>
              <div className="absolute inset-0 bg-brand-white/40 backdrop-blur-sm"></div>
            </div>
            <div className="relative z-10 inline-block align-bottom bg-white rounded-2xl text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full w-full">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="flex justify-between items-center mb-5">
                  <h3 className="text-xl font-bold text-zinc-900 tracking-tight">
                    {editingGuild ? 'Редактировать гильдию' : 'Новая гильдия'}
                  </h3>
                  <button onClick={handleCloseModal} className="text-zinc-400 hover:text-zinc-600 bg-zinc-100 p-1.5 rounded-full transition-colors">
                    <X size={20} />
                  </button>
                </div>
                {error && <div className="mb-5 p-3 bg-rose-50 text-sm text-rose-600 rounded-xl border border-rose-100">{error}</div>}
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-zinc-700 mb-1.5">Название</label>
                    <input type="text" required value={name} onChange={(e) => setName(e.target.value)} className="block w-full border border-zinc-200 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-zinc-900 focus:border-zinc-900 sm:text-sm transition-all" />
                  </div>
                  <div className="bg-zinc-50 p-4 rounded-xl border border-zinc-200">
                    <p className="text-xs text-zinc-500 flex items-center">
                      <Trophy size={14} className="mr-2 text-amber-500" />
                      Очки гильдии теперь рассчитываются автоматически на основе достижений участников.
                    </p>
                  </div>
                  <div className="mt-8 sm:flex sm:flex-row-reverse gap-3 pt-4 border-t border-zinc-100">
                    <button type="submit" className="w-full sm:w-auto inline-flex justify-center items-center rounded-xl border border-transparent px-6 py-2.5 bg-zinc-900 text-sm font-medium text-white hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-zinc-900 transition-colors shadow-sm">
                      {editingGuild ? 'Сохранить' : 'Создать'}
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

      {/* Members Modal */}
      {isMembersModalOpen && editingGuild && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-end sm:items-center justify-center min-h-screen p-4 text-center sm:p-0">
            <div className="fixed inset-0 transition-opacity" aria-hidden="true" onClick={() => { setIsMembersModalOpen(false); setEditingGuild(null); }}>
              <div className="absolute inset-0 bg-brand-white/40 backdrop-blur-sm"></div>
            </div>
            <div className="relative z-10 inline-block align-bottom bg-[#111] rounded-2xl text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-2xl sm:w-full w-full">
              <div className="bg-[#111] px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="flex justify-between items-center mb-5">
                  <h3 className="text-xl font-bold text-brand-white tracking-tight">
                    Участники: {editingGuild.name}
                  </h3>
                  <button onClick={() => { setIsMembersModalOpen(false); setEditingGuild(null); }} className="text-zinc-400 hover:text-zinc-400 bg-zinc-800/50 p-1.5 rounded-full transition-colors">
                    <X size={20} />
                  </button>
                </div>
                
                <div className="mt-4">
                  <h4 className="text-sm font-bold text-brand-white mb-3">Доступные резиденты (Richer)</h4>
                  <div className="bg-brand-black/50 rounded-xl p-2 sm:p-4 max-h-[60vh] overflow-y-auto border border-zinc-800">
                    <ul className="space-y-2">
                      {richerUsers.map(user => (
                        <li key={user.uid} className="p-3 sm:p-4 bg-[#111] rounded-xl border border-zinc-800/50 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                          <div>
                            <p className="text-sm font-bold text-brand-white">{user.name}</p>
                            <p className="text-xs font-medium text-zinc-400 mt-0.5">@{user.login}</p>
                          </div>
                          <div className="w-full sm:w-auto">
                            {user.guildId === editingGuild.id ? (
                              <button 
                                onClick={() => handleAssignMember(user.uid, null)}
                                className="w-full sm:w-auto px-4 py-2 bg-rose-900/20 text-rose-400 rounded-lg text-sm font-medium hover:bg-rose-900/40 transition-colors border border-rose-900/50"
                              >
                                Удалить
                              </button>
                            ) : (
                              <button 
                                onClick={() => handleAssignMember(user.uid, editingGuild.id)}
                                disabled={richerUsers.filter(u => u.guildId === editingGuild.id).length >= 12}
                                className="w-full sm:w-auto px-4 py-2 bg-brand-white text-brand-black rounded-lg text-sm font-medium hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                              >
                                {user.guildId ? 'Переместить сюда' : 'Добавить'}
                              </button>
                            )}
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
