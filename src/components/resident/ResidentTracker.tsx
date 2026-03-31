import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, doc, updateDoc, increment } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../../firebase';
import { useAuth } from '../../contexts/AuthContext';
import { Code } from '../admin/AdminCodes';
import { CheckCircle2, Circle, CheckSquare, Clock } from 'lucide-react';

import { updateGuildScore } from '../../utils/guildScores';

export default function ResidentTracker() {
  const { userProfile } = useAuth();
  const [codes, setCodes] = useState<Code[]>([]);

  useEffect(() => {
    if (!userProfile) return;

    const q = query(collection(db, 'codes'), where('residentId', '==', userProfile.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const codesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Code));
      codesData.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setCodes(codesData);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'codes');
    });

    return unsubscribe;
  }, [userProfile]);

  const toggleStatus = async (code: Code) => {
    const today = new Date().toISOString().split('T')[0];
    const guildId = userProfile?.guildId;
    
    if (code.completionHistory.includes(today)) {
      // Unmark
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
      // Mark
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

  const getNextCompletionDate = (code: Code) => {
    if (code.frequencyType === 'once') return null;
    
    const today = new Date();
    const lastCompletion = code.completionHistory.length > 0 
      ? new Date(code.completionHistory[code.completionHistory.length - 1])
      : new Date(code.createdAt);

    let nextDate = new Date(lastCompletion);
    
    if (code.frequencyType === 'daily') {
      nextDate.setDate(nextDate.getDate() + 1);
    } else if (code.frequencyType === 'everyOtherDay') {
      nextDate.setDate(nextDate.getDate() + 2);
    } else if (code.frequencyType === 'weekly' && code.schedule) {
      // Find next day in schedule
      for (let i = 1; i <= 7; i++) {
        nextDate.setDate(nextDate.getDate() + 1);
        const dayOfWeek = nextDate.getDay() === 0 ? '7' : nextDate.getDay().toString();
        if (code.schedule.includes(dayOfWeek)) break;
      }
    }
    
    return nextDate;
  };

  const pendingCodes = codes.filter(c => c.completedCount < c.totalRequired);
  const completedCodes = codes.filter(c => c.completedCount >= c.totalRequired);

  return (
    <div className="max-w-4xl mx-auto pb-20 md:pb-0 space-y-6">
      <h2 className="text-2xl font-bold text-zinc-900 tracking-tight">Мои коды</h2>
      
      {codes.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm border border-zinc-200 p-10 text-center flex flex-col items-center justify-center min-h-[300px]">
          <div className="w-16 h-16 bg-zinc-50 rounded-full flex items-center justify-center mb-4">
            <CheckSquare className="h-8 w-8 text-zinc-400" />
          </div>
          <h3 className="text-lg font-bold text-zinc-900">Нет назначенных кодов</h3>
          <p className="mt-2 text-sm text-zinc-500 max-w-sm mx-auto">У вас пока нет кодов для отслеживания. Они появятся здесь, когда администратор назначит их вам.</p>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Pending Codes */}
          <div>
            <h3 className="text-lg font-bold text-zinc-900 mb-4 flex items-center">
              <Clock className="mr-2.5 text-amber-500" size={20} />
              В процессе ({pendingCodes.length})
            </h3>
            <div className="bg-white shadow-sm border border-zinc-200 overflow-hidden rounded-2xl">
              <ul className="divide-y divide-zinc-200">
                {pendingCodes.length === 0 && (
                  <li className="px-6 py-8 text-center text-sm text-zinc-500 font-medium">Все коды выполнены! 🎉</li>
                )}
                {pendingCodes.map((code) => {
                  const today = new Date().toISOString().split('T')[0];
                  const isDoneToday = code.completionHistory.includes(today);
                  const nextDate = getNextCompletionDate(code);
                  const codeProgress = Math.round((code.completedCount / code.totalRequired) * 100);
                  
                  return (
                    <li key={code.id} className={`transition-all duration-300 ${isDoneToday ? 'bg-emerald-50/50 border-l-4 border-emerald-500' : 'hover:bg-zinc-50 border-l-4 border-transparent'}`}>
                      <div className="px-5 py-5 sm:px-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-start justify-between">
                            <div>
                              <p className="text-base font-bold text-zinc-900">{code.title}</p>
                              <p className="mt-1 text-sm text-zinc-500 leading-relaxed max-w-lg">{code.description}</p>
                            </div>
                            <div className="text-right flex-shrink-0 ml-4">
                              <p className={`text-xs font-bold ${isDoneToday ? 'text-emerald-700' : 'text-zinc-900'}`}>{codeProgress}%</p>
                            </div>
                          </div>

                          <div className="mt-3 w-full max-w-md h-1.5 bg-zinc-100 rounded-full overflow-hidden">
                            <div 
                              className={`h-full rounded-full transition-all duration-500 ${isDoneToday ? 'bg-emerald-500' : 'bg-zinc-900'}`}
                              style={{ width: `${codeProgress}%` }}
                            />
                          </div>
                          
                          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div className="space-y-1">
                              <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Детали</p>
                              <p className="text-xs font-medium text-amber-700 flex items-center">
                                <Clock size={12} className="mr-1" />
                                Дедлайн: {new Date(code.deadline).toLocaleDateString('ru-RU')}
                              </p>
                              <p className="text-xs font-medium text-zinc-500">
                                Прогресс: {code.completedCount} / {code.totalRequired}
                              </p>
                            </div>

                            {code.frequencyType !== 'once' && (
                              <div className="space-y-1">
                                <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Статус</p>
                                <p className={`text-xs font-bold flex items-center ${isDoneToday ? 'text-emerald-700' : 'text-zinc-500'}`}>
                                  {isDoneToday ? (
                                    <><CheckCircle2 size={12} className="mr-1" /> Выполнено сегодня</>
                                  ) : (
                                    <><Circle size={12} className="mr-1" /> Сегодня не выполнено</>
                                  )}
                                </p>
                                {nextDate && !isDoneToday && code.frequencyType !== 'daily' && (
                                  <p className="text-xs font-medium text-zinc-500">
                                    След. выполнение: {nextDate.toLocaleDateString('ru-RU')}
                                  </p>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                        {isDoneToday ? (
                          <div className="w-full sm:w-auto flex-shrink-0 border border-emerald-200 rounded-xl py-2.5 px-5 inline-flex items-center justify-center text-sm font-medium bg-emerald-50 text-emerald-700 shadow-sm">
                            Выполнено сегодня
                          </div>
                        ) : (
                          <button
                            onClick={() => toggleStatus(code)}
                            disabled={code.completedCount >= code.totalRequired}
                            className={`w-full sm:w-auto flex-shrink-0 border border-transparent rounded-xl py-2.5 px-5 inline-flex items-center justify-center text-sm font-medium transition-colors shadow-sm ${
                              code.completedCount >= code.totalRequired ? 'bg-zinc-100 text-zinc-500' : 'bg-zinc-900 text-white hover:bg-zinc-800'
                            }`}
                          >
                            {code.completedCount >= code.totalRequired ? 'Готово' : 'Отметить выполнение'}
                          </button>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>


          {/* Completed Codes */}
          <div>
            <h3 className="text-lg font-bold text-zinc-900 mb-4 flex items-center">
              <CheckCircle2 className="mr-2.5 text-emerald-500" size={20} />
              Выполненные ({completedCodes.length})
            </h3>
            <div className="bg-white shadow-sm border border-zinc-200 overflow-hidden rounded-2xl opacity-75 hover:opacity-100 transition-opacity">
              <ul className="divide-y divide-zinc-200">
                {completedCodes.length === 0 && (
                  <li className="px-6 py-8 text-center text-sm text-zinc-500 font-medium">Пока нет выполненных кодов.</li>
                )}
                {completedCodes.map((code) => (
                  <li key={code.id} className="bg-zinc-50/50">
                    <div className="px-5 py-5 sm:px-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="text-base font-bold text-zinc-900 line-through decoration-zinc-400">{code.title}</p>
                            <p className="mt-1 text-sm text-zinc-500 line-through decoration-zinc-400">{code.description}</p>
                          </div>
                          <div className="text-right flex-shrink-0 ml-4">
                            <p className="text-xs font-bold text-emerald-700">100%</p>
                          </div>
                        </div>

                        <div className="mt-3 w-full max-w-md h-1.5 bg-emerald-100 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-emerald-500 rounded-full"
                            style={{ width: '100%' }}
                          />
                        </div>
                      </div>
                      <div className="flex-shrink-0 flex flex-row sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-2">
                        <span className="px-3 py-1 inline-flex text-xs font-semibold rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                          Выполнено
                        </span>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
