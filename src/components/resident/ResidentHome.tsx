import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, where, doc, updateDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../../firebase';
import { useAuth } from '../../contexts/AuthContext';
import { Event } from '../admin/AdminEvents';
import { Code } from '../admin/AdminCodes';
import { Guild } from '../admin/AdminGuilds';
import { CheckCircle2, Trophy, Camera, Shield } from 'lucide-react';
import { TariffBadge } from '../TariffBadge';
import ResidentCalendar from './ResidentCalendar';

import { updateGuildScore } from '../../utils/guildScores';

export default function ResidentHome() {
  const { userProfile } = useAuth();
  const [events, setEvents] = useState<Event[]>([]);
  const [codes, setCodes] = useState<Code[]>([]);
  const [myGuild, setMyGuild] = useState<Guild | null>(null);
  const [guildRank, setGuildRank] = useState<number | null>(null);

  // Fetch Events
  useEffect(() => {
    if (!userProfile) return;
    const unsubscribe = onSnapshot(collection(db, 'events'), (snapshot) => {
      const eventsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Event));
      const filteredEvents = eventsData.filter(event => event.tariffs.includes(userProfile.tariff));
      filteredEvents.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      setEvents(filteredEvents);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'events');
    });
    return unsubscribe;
  }, [userProfile]);

  // Fetch Codes
  useEffect(() => {
    if (!userProfile) return;
    const q = query(collection(db, 'codes'), where('residentId', '==', userProfile.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const codesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Code));
      setCodes(codesData);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'codes');
    });
    return unsubscribe;
  }, [userProfile]);

  // Fetch Guild & Ranking
  useEffect(() => {
    if (!userProfile?.guildId) return;
    
    const unsubscribe = onSnapshot(collection(db, 'guilds'), (snapshot) => {
      const guildsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Guild));
      guildsData.sort((a, b) => b.score - a.score);
      
      const currentGuild = guildsData.find(g => g.id === userProfile.guildId);
      if (currentGuild) {
        setMyGuild(currentGuild);
        setGuildRank(guildsData.findIndex(g => g.id === currentGuild.id) + 1);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'guilds');
    });
    return unsubscribe;
  }, [userProfile]);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !userProfile) return;

    if (file.size > 10 * 1024 * 1024) {
      alert('Размер файла не должен превышать 10МБ');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = async () => {
      const img = new Image();
      img.onload = async () => {
        const canvas = document.createElement('canvas');
        const maxSize = 200;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxSize) {
            height *= maxSize / width;
            width = maxSize;
          }
        } else {
          if (height > maxSize) {
            width *= maxSize / height;
            height = maxSize;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        
        canvas.toBlob(async (blob) => {
          if (!blob) return;

          try {
            const formData = new FormData();
            formData.append('avatar', blob, 'avatar.jpg');

            const response = await fetch('/api/upload-avatar', {
              method: 'POST',
              body: formData
            });

            if (!response.ok) {
              const errorText = await response.text();
              throw new Error(errorText || 'Upload failed');
            }

            const { url } = await response.json();

            await updateDoc(doc(db, 'users', userProfile.uid), {
              avatarUrl: url
            });
          } catch (err) {
            console.error('Avatar upload error:', err);
            alert('Ошибка при загрузке аватара');
          }
        }, 'image/jpeg', 0.7);
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  };

  const totalCodes = codes.length;
  const completedCodesSum = codes.filter(c => c.completedCount >= c.totalRequired).length;
  const progress = totalCodes > 0 ? Math.round((completedCodesSum / totalCodes) * 100) : 0;

  const handleMarkCompletion = async (code: Code) => {
    const today = new Date().toISOString().split('T')[0];
    const guildId = userProfile?.guildId;
    
    if (code.completionHistory.includes(today)) {
      // If already completed today, unmark it (toggle)
      try {
        await updateDoc(doc(db, 'codes', code.id), {
          completedCount: Math.max(0, code.completedCount - 1),
          completionHistory: code.completionHistory.filter(date => date !== today)
        });
        
        // Update guild score: decrement by 1 only if it was fully completed
        if (guildId && code.completedCount === code.totalRequired) {
          await updateGuildScore(guildId, -1);
        }
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `codes/${code.id}`);
      }
    } else {
      // Mark as completed
      if (code.completedCount >= code.totalRequired) return;
      
      try {
        await updateDoc(doc(db, 'codes', code.id), {
          completedCount: code.completedCount + 1,
          completionHistory: [...code.completionHistory, today]
        });

        // Update guild score: increment by 1 only if it reaches 100% completion
        if (guildId && code.completedCount + 1 === code.totalRequired) {
          await updateGuildScore(guildId, 1);
        }
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `codes/${code.id}`);
      }
    }
  };

  return (
    <div className="max-w-md mx-auto pb-24 space-y-8 font-sans">
      
      {/* Profile Header */}
      <div className="bg-white rounded-3xl p-6 shadow-sm border border-zinc-200 flex items-center space-x-5">
        <div className="relative">
          <div className="w-20 h-20 rounded-full bg-zinc-100 border-2 border-zinc-200 shadow-sm overflow-hidden flex items-center justify-center">
            {userProfile?.avatarUrl ? (
              <img src={userProfile.avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
            ) : (
              <span className="text-2xl font-bold text-zinc-500">{userProfile?.name.charAt(0)}</span>
            )}
          </div>
          <label className="absolute bottom-0 right-0 w-7 h-7 bg-zinc-900 rounded-full flex items-center justify-center cursor-pointer shadow-lg border-2 border-white hover:bg-zinc-800 transition-colors">
            <Camera size={12} className="text-white" />
            <input type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
          </label>
        </div>
        <div className="flex-1">
          <h2 className="text-xl font-bold text-zinc-900 leading-tight">{userProfile?.name}</h2>
          <p className="text-sm text-zinc-500 mt-0.5 mb-2">@{userProfile?.login}</p>
          {userProfile?.tariff && <TariffBadge tariff={userProfile.tariff} />}
        </div>
      </div>

      {/* Events Calendar */}
      <div className="space-y-4">
        <h3 className="text-lg font-bold text-zinc-900 px-2">Календарь событий</h3>
        <ResidentCalendar events={events} />
      </div>

      {/* Code Tracker & Guild Summary */}
      <div className="space-y-4 px-2">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-zinc-900">Мой прогресс</h3>
          <span className="text-sm font-bold text-zinc-900">{progress}%</span>
        </div>
        
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-zinc-200 space-y-5">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-3">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-colors ${progress === 100 ? 'bg-emerald-100' : 'bg-zinc-100'}`}>
                  <CheckCircle2 size={24} className={progress === 100 ? 'text-emerald-600' : 'text-zinc-400'} />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Общий прогресс</p>
                  <p className="text-xl font-bold text-zinc-900">
                    {completedCodesSum % 1 === 0 ? completedCodesSum : completedCodesSum.toFixed(1)} 
                    <span className="text-sm text-zinc-500 font-medium ml-1.5">из {totalCodes} кодов</span>
                  </p>
                </div>
              </div>
            </div>
            
            <div className="w-full h-3 bg-zinc-100 rounded-full overflow-hidden shadow-inner">
              <div 
                className={`h-full rounded-full transition-all duration-1000 ease-out ${progress === 100 ? 'bg-emerald-500' : 'bg-zinc-900'}`}
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          {/* Codes List */}
          <div className="space-y-3 pt-5 border-t border-zinc-200">
            {codes.length === 0 ? (
              <p className="text-sm text-zinc-500 text-center py-2">Нет назначенных кодов</p>
            ) : (
              codes.map(code => (
                <div key={code.id} className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-bold text-zinc-900">{code.title}</p>
                    <p className="text-xs text-zinc-500">{code.completedCount} / {code.totalRequired}</p>
                  </div>
                  {code.completionHistory.includes(new Date().toISOString().split('T')[0]) ? (
                    <div className="px-4 py-2 rounded-xl text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      Выполнено
                    </div>
                  ) : (
                    <button 
                      onClick={() => handleMarkCompletion(code)}
                      disabled={code.completedCount >= code.totalRequired}
                      className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors ${
                        code.completedCount >= code.totalRequired 
                          ? 'bg-zinc-100 text-zinc-500' 
                          : 'bg-zinc-900 text-white hover:bg-zinc-800'
                      }`}
                    >
                      {code.completedCount >= code.totalRequired ? 'Готово' : 'Отметить'}
                    </button>
                  )}
                </div>
              ))
            )}
          </div>

          {myGuild && (
            <div className="pt-5 border-t border-zinc-200 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center">
                  <Shield size={20} className="text-amber-600" />
                </div>
                <div>
                  <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Моя гильдия</p>
                  <p className="text-sm font-bold text-zinc-900">{myGuild.name}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Рейтинг</p>
                <p className="text-lg font-bold text-zinc-900 flex items-center justify-end">
                  <Trophy size={16} className="text-amber-500 mr-1.5" />
                  {guildRank} место
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
