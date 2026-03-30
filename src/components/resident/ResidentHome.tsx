import React, { useState, useEffect, useRef } from 'react';
import { collection, onSnapshot, query, where, doc, updateDoc, getDocs, increment } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../../firebase';
import { useAuth } from '../../contexts/AuthContext';
import { Event } from '../admin/AdminEvents';
import { Code } from '../admin/AdminCodes';
import { Guild } from '../admin/AdminGuilds';
import { Calendar as CalendarIcon, Clock, CheckCircle2, Trophy, Camera, Shield } from 'lucide-react';

import { updateGuildScore } from '../../utils/guildScores';

export default function ResidentHome() {
  const { userProfile } = useAuth();
  const [events, setEvents] = useState<Event[]>([]);
  const [codes, setCodes] = useState<Code[]>([]);
  const [myGuild, setMyGuild] = useState<Guild | null>(null);
  const [guildRank, setGuildRank] = useState<number | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const changeMonth = (offset: number) => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + offset, 1));
  };

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDay = new Date(year, month, 1).getDay();
    const days = [];
    
    // Previous month days
    const prevMonthLastDay = new Date(year, month, 0).getDate();
    const startDay = firstDay === 0 ? 6 : firstDay - 1;
    for (let i = startDay - 1; i >= 0; i--) {
      days.push({ date: new Date(year, month - 1, prevMonthLastDay - i), isCurrentMonth: false });
    }
    
    // Current month days
    for (let i = 1; i <= daysInMonth; i++) {
      days.push({ date: new Date(year, month, i), isCurrentMonth: true });
    }
    
    // Next month days
    const remainingDays = 42 - days.length;
    for (let i = 1; i <= remainingDays; i++) {
      days.push({ date: new Date(year, month + 1, i), isCurrentMonth: false });
    }
    
    return days;
  };

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

    if (file.size > 1024 * 1024) {
      alert('Размер файла не должен превышать 1МБ');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64String = reader.result as string;
      try {
        await updateDoc(doc(db, 'users', userProfile.uid), {
          avatarUrl: base64String
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `users/${userProfile.uid}`);
      }
    };
    reader.readAsDataURL(file);
  };

  const isSameDay = (d1: Date, d2: Date) => {
    return d1.getFullYear() === d2.getFullYear() &&
           d1.getMonth() === d2.getMonth() &&
           d1.getDate() === d2.getDate();
  };

  const selectedDateEvents = events.filter(event => isSameDay(new Date(event.date), selectedDate));
  
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

  const getDayName = (date: Date) => {
    return date.toLocaleDateString('ru-RU', { weekday: 'short' }).toUpperCase();
  };

  return (
    <div className="max-w-md mx-auto pb-24 space-y-8 font-sans">
      
      {/* Profile Header */}
      <div className="bg-white rounded-3xl p-6 shadow-sm border border-zinc-100 flex items-center space-x-5">
        <div className="relative">
          <div className="w-20 h-20 rounded-full bg-zinc-100 border-2 border-white shadow-md overflow-hidden flex items-center justify-center">
            {userProfile?.avatarUrl ? (
              <img src={userProfile.avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
            ) : (
              <span className="text-2xl font-bold text-zinc-400">{userProfile?.name.charAt(0)}</span>
            )}
          </div>
          <label className="absolute bottom-0 right-0 w-7 h-7 bg-zinc-900 rounded-full flex items-center justify-center cursor-pointer shadow-lg border-2 border-white hover:bg-zinc-800 transition-colors">
            <Camera size={12} className="text-white" />
            <input type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
          </label>
        </div>
        <div className="flex-1">
          <h2 className="text-xl font-bold text-zinc-900 leading-tight">{userProfile?.name}</h2>
          <p className="text-sm text-zinc-500 mt-0.5">@{userProfile?.login}</p>
          <div className="mt-2 inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold bg-zinc-100 text-zinc-700">
            {userProfile?.tariff}
          </div>
        </div>
      </div>

      {/* iOS Style Calendar */}
      <div className="bg-white rounded-3xl p-6 shadow-sm border border-zinc-100 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-zinc-900">
            {currentMonth.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' })}
          </h3>
          <div className="flex space-x-2">
            <button onClick={() => changeMonth(-1)} className="p-2 rounded-full hover:bg-zinc-100">{'<'}</button>
            <button onClick={() => changeMonth(1)} className="p-2 rounded-full hover:bg-zinc-100">{'>'}</button>
          </div>
        </div>
        
        <div className="grid grid-cols-7 gap-2 text-center text-xs font-semibold text-zinc-400 mb-2">
          {['ПН', 'ВТ', 'СР', 'ЧТ', 'ПТ', 'СБ', 'ВС'].map(day => <div key={day}>{day}</div>)}
        </div>

        <div className="grid grid-cols-7 gap-2">
          {getDaysInMonth(currentMonth).map((dayObj, i) => {
            const { date, isCurrentMonth } = dayObj;
            const isSelected = isSameDay(date, selectedDate);
            const isToday = isSameDay(date, new Date());
            const hasEvent = events.some(e => isSameDay(new Date(e.date), date));
            
            return (
              <button
                key={i}
                onClick={() => setSelectedDate(date)}
                className={`h-10 w-10 rounded-full flex items-center justify-center text-sm font-bold transition-all relative ${
                  isSelected 
                    ? 'bg-zinc-900 text-white' 
                    : isToday
                      ? 'bg-zinc-100 text-zinc-900'
                      : isCurrentMonth 
                        ? 'text-zinc-900 hover:bg-zinc-50'
                        : 'text-zinc-300'
                }`}
              >
                {date.getDate()}
                {hasEvent && (
                  <span className={`absolute bottom-1 w-1 h-1 rounded-full ${isSelected ? 'bg-white' : 'bg-rose-500'}`} />
                )}
              </button>
            );
          })}
        </div>

        {/* Events for selected date */}
        <div className="mt-6 space-y-3">
          {selectedDateEvents.length === 0 ? (
            <div className="bg-zinc-50 rounded-2xl p-4 text-center border border-zinc-100">
              <p className="text-sm font-medium text-zinc-500">Нет событий</p>
            </div>
          ) : (
            selectedDateEvents.map(event => (
              <div key={event.id} className="bg-zinc-50 p-4 rounded-2xl flex items-start space-x-4">
                <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center flex-shrink-0 shadow-sm">
                  <Clock size={18} className="text-rose-500" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-zinc-900">{event.title}</h4>
                  <p className="text-xs text-zinc-500 mt-1 line-clamp-2">{event.description}</p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Code Tracker & Guild Summary */}
      <div className="space-y-4 px-2">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-zinc-900">Мой прогресс</h3>
          <span className="text-sm font-bold text-zinc-900">{progress}%</span>
        </div>
        
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-zinc-100 space-y-5">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-3">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-colors ${progress === 100 ? 'bg-emerald-100' : 'bg-zinc-100'}`}>
                  <CheckCircle2 size={24} className={progress === 100 ? 'text-emerald-600' : 'text-zinc-500'} />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Общий прогресс</p>
                  <p className="text-xl font-bold text-zinc-900">
                    {completedCodesSum % 1 === 0 ? completedCodesSum : completedCodesSum.toFixed(1)} 
                    <span className="text-sm text-zinc-400 font-medium ml-1.5">из {totalCodes} кодов</span>
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
          <div className="space-y-3 pt-5 border-t border-zinc-100">
            {codes.map(code => (
              <div key={code.id} className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold text-zinc-900">{code.title}</p>
                  <p className="text-xs text-zinc-500">{code.completedCount} / {code.totalRequired}</p>
                </div>
                {code.completionHistory.includes(new Date().toISOString().split('T')[0]) ? (
                  <div className="px-4 py-2 rounded-xl text-xs font-bold bg-emerald-500 text-white">
                    Выполнено
                  </div>
                ) : (
                  <button 
                    onClick={() => handleMarkCompletion(code)}
                    disabled={code.completedCount >= code.totalRequired}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors ${
                      code.completedCount >= code.totalRequired 
                        ? 'bg-zinc-100 text-zinc-400' 
                        : 'bg-zinc-900 text-white hover:bg-zinc-800'
                    }`}
                  >
                    {code.completedCount >= code.totalRequired ? 'Готово' : 'Отметить'}
                  </button>
                )}
              </div>
            ))}
          </div>

          {myGuild && (
            <div className="pt-5 border-t border-zinc-100 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center">
                  <Shield size={20} className="text-amber-500" />
                </div>
                <div>
                  <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Моя гильдия</p>
                  <p className="text-sm font-bold text-zinc-900">{myGuild.name}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Рейтинг</p>
                <p className="text-lg font-bold text-zinc-900 flex items-center justify-end">
                  <Trophy size={16} className="text-amber-400 mr-1.5" />
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
