import { useState, useEffect } from 'react';
import { collection, onSnapshot, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../../firebase';
import { useAuth, UserProfile } from '../../contexts/AuthContext';
import { Guild } from '../admin/AdminGuilds';
import { Code } from '../admin/AdminCodes';
import { Shield, Trophy, Medal, Users, Calendar, ChevronDown, ChevronUp } from 'lucide-react';

interface MemberStats extends UserProfile {
  completedCodes: number;
  totalCodes: number;
}

interface MonthlyScore {
  id: string;
  score: number;
  monthId: string;
  lastUpdated: string;
}

export default function ResidentGuild() {
  const { userProfile } = useAuth();
  const [myGuild, setMyGuild] = useState<Guild | null>(null);
  const [allGuilds, setAllGuilds] = useState<Guild[]>([]);
  const [guildMembers, setGuildMembers] = useState<MemberStats[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [currentMonthId, setCurrentMonthId] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  
  const [selectedMonth, setSelectedMonth] = useState(currentMonthId);
  const [guildMonthlyScores, setGuildMonthlyScores] = useState<Record<string, number>>({});
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [availableMonths, setAvailableMonths] = useState<string[]>([]);

  useEffect(() => {
    if (!userProfile) return;

    let guildsUnsubscribe: () => void;
    let usersUnsubscribe: () => void;

    try {
      // 1. Fetch all guilds
      guildsUnsubscribe = onSnapshot(collection(db, 'guilds'), (snapshot) => {
        const guildsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Guild));
        setAllGuilds(guildsData);
        
        if (userProfile.guildId) {
          const currentGuild = guildsData.find(g => g.id === userProfile.guildId);
          setMyGuild(currentGuild || null);
        }
      }, (error) => {
        handleFirestoreError(error, OperationType.LIST, 'guilds');
      });

      // 2. Fetch monthly scores for selected month
      const fetchMonthlyScores = async () => {
        const scores: Record<string, number> = {};
        const monthsSet = new Set<string>();
        monthsSet.add(currentMonthId);

        for (const guild of allGuilds) {
          const monthlyScoreRef = doc(db, 'guilds', guild.id, 'monthly_scores', selectedMonth);
          const monthlyDoc = await getDoc(monthlyScoreRef);
          if (monthlyDoc.exists()) {
            scores[guild.id] = monthlyDoc.data().score;
          } else {
            scores[guild.id] = 0;
          }

          // Also fetch all available months for the history dropdown
          const allScoresQuery = collection(db, 'guilds', guild.id, 'monthly_scores');
          const allScoresSnapshot = await getDocs(allScoresQuery);
          allScoresSnapshot.docs.forEach(doc => {
            monthsSet.add(doc.data().monthId);
          });
        }
        setGuildMonthlyScores(scores);
        setAvailableMonths(Array.from(monthsSet).sort().reverse());
      };

      if (allGuilds.length > 0) {
        fetchMonthlyScores();
      }

      // 3. If user is in a guild, fetch members and their stats
      if (userProfile.guildId) {
        usersUnsubscribe = onSnapshot(
          query(collection(db, 'users'), where('guildId', '==', userProfile.guildId)),
          async (snapshot) => {
            const membersData = snapshot.docs.map(doc => doc.data() as UserProfile);
            
            const statsPromises = membersData.map(async (member) => {
              const codesQuery = query(collection(db, 'codes'), where('residentId', '==', member.uid));
              const codesSnapshot = await getDocs(codesQuery);
              const codes = codesSnapshot.docs.map(doc => doc.data() as Code);
              
              const completedCodesSum = codes.reduce((sum, c) => {
                const ratio = c.totalRequired > 0 ? c.completedCount / c.totalRequired : 0;
                return sum + Math.min(1, ratio);
              }, 0);

              return {
                ...member,
                completedCodes: completedCodesSum,
                totalCodes: codes.length
              };
            });
            
            const stats = await Promise.all(statsPromises);
            stats.sort((a, b) => b.completedCodes - a.completedCodes);
            setGuildMembers(stats);
            setLoading(false);
          }, (error) => {
            handleFirestoreError(error, OperationType.LIST, 'users');
          }
        );
      } else {
        setLoading(false);
      }
    } catch (err) {
      console.error("Error fetching guild data:", err);
      setLoading(false);
    }

    return () => {
      if (guildsUnsubscribe) guildsUnsubscribe();
      if (usersUnsubscribe) usersUnsubscribe();
    };
  }, [userProfile, allGuilds.length, selectedMonth]);

  const sortedGuildsByMonthly = [...allGuilds].sort((a, b) => {
    const scoreA = guildMonthlyScores[a.id] || 0;
    const scoreB = guildMonthlyScores[b.id] || 0;
    return scoreB - scoreA;
  });

  if (loading) return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-zinc-900"></div>
    </div>
  );

  const formatMonth = (monthId: string) => {
    const [year, month] = monthId.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1);
    return date.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' });
  };

  return (
    <div className="max-w-6xl mx-auto pb-20 md:pb-0 space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-2xl font-bold text-brand-white tracking-tight">Моя гильдия</h2>
        
        <div className="relative w-full sm:w-auto">
          <button 
            onClick={() => setIsHistoryOpen(!isHistoryOpen)}
            className="w-full sm:w-auto flex items-center justify-between space-x-2 bg-[#111] border border-zinc-800 px-4 py-2 rounded-xl text-sm font-bold text-brand-white shadow-sm hover:bg-brand-black transition-colors"
          >
            <div className="flex items-center">
              <Calendar size={16} className="mr-2 text-zinc-400" />
              <span>{formatMonth(selectedMonth)}</span>
            </div>
            {isHistoryOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
          
          {isHistoryOpen && (
            <div className="absolute right-0 mt-2 w-full sm:w-48 bg-[#111] border border-zinc-800 rounded-xl shadow-xl z-50 overflow-hidden">
              <div className="max-h-60 overflow-y-auto">
                {availableMonths.map(month => (
                  <button
                    key={month}
                    onClick={() => {
                      setSelectedMonth(month);
                      setIsHistoryOpen(false);
                    }}
                    className={`w-full text-left px-4 py-2.5 text-sm font-medium hover:bg-brand-black transition-colors ${selectedMonth === month ? 'bg-brand-white text-brand-black hover:bg-gray-200' : 'text-zinc-300'}`}
                  >
                    {formatMonth(month)}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
      
      {!userProfile?.guildId || !myGuild ? (
        <div className="bg-[#111] rounded-2xl shadow-sm border border-zinc-800 p-10 text-center flex flex-col items-center justify-center min-h-[300px]">
          <div className="w-16 h-16 bg-brand-black rounded-full flex items-center justify-center mb-4">
            <Shield className="h-8 w-8 text-zinc-400" />
          </div>
          <h3 className="text-lg font-bold text-brand-white">Нет гильдии</h3>
          <p className="mt-2 text-sm text-zinc-400 max-w-sm mx-auto">Вы еще не состоите ни в одной гильдии. Обратитесь к администратору для распределения.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* My Guild Info & Members */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-[#111] shadow-sm border border-zinc-800 rounded-2xl overflow-hidden">
              <div className="px-6 py-6 border-b border-zinc-800/50 bg-brand-white text-brand-black flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 bg-[#111]/10 rounded-xl flex items-center justify-center backdrop-blur-sm">
                    <Shield className="w-6 h-6 text-brand-black" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold tracking-tight">{myGuild.name}</h3>
                    <div className="flex items-center mt-1 space-x-3">
                      <p className="text-xs text-zinc-300 flex items-center">
                        <Users size={12} className="mr-1" />
                        {guildMembers.length} участников
                      </p>
                      <div className="h-1 w-1 rounded-full bg-zinc-600" />
                      <p className="text-xs text-emerald-400 font-bold">
                        {guildMembers.length > 0 
                          ? (guildMembers.reduce((sum, m) => sum + (m.completedCodes / m.totalCodes || 0), 0) / guildMembers.length * 100).toFixed(0) 
                          : 0}% прогресс
                      </p>
                    </div>
                  </div>
                </div>
                <div className="bg-[#111]/10 px-4 py-2 rounded-xl backdrop-blur-sm border border-white/10">
                  <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-0.5">Очки за {selectedMonth === currentMonthId ? 'этот месяц' : formatMonth(selectedMonth)}</p>
                  <p className="text-2xl font-bold text-brand-black flex items-center">
                    <Trophy size={20} className="mr-2 text-amber-400" />
                    {(guildMonthlyScores[myGuild.id] || 0).toFixed(1)}
                  </p>
                </div>
              </div>
              
              <ul className="divide-y divide-zinc-100">
                {guildMembers.map((member, index) => {
                  const isMe = member.uid === userProfile.uid;
                  const progress = member.totalCodes > 0 ? (member.completedCodes / member.totalCodes) * 100 : 0;
                  
                  return (
                    <li key={member.uid} className={`px-6 py-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all ${isMe ? 'bg-brand-black border-l-4 border-zinc-900' : 'hover:bg-brand-black/50 border-l-4 border-transparent'}`}>
                      <div className="flex items-center">
                        <div className={`flex-shrink-0 h-10 w-10 flex items-center justify-center rounded-xl font-bold mr-4 shadow-sm ${
                          index === 0 ? 'bg-amber-900/20 text-amber-400 ring-2 ring-amber-900/50' :
                          index === 1 ? 'bg-zinc-800 text-zinc-300' :
                          index === 2 ? 'bg-orange-900/20 text-orange-400' :
                          'bg-[#111] text-zinc-400 border border-zinc-800'
                        }`}>
                          {index + 1}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-brand-white flex items-center">
                            {member.name}
                            {isMe && <span className="ml-2 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-brand-white text-brand-black">Вы</span>}
                          </p>
                          <p className="text-xs font-medium text-zinc-400 mt-0.5">@{member.login}</p>
                        </div>
                      </div>
                      <div className="sm:text-right w-full sm:w-48 pl-14 sm:pl-0">
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Прогресс</span>
                          <p className="text-xs font-bold text-brand-white">
                            {progress.toFixed(0)}% <span className="text-zinc-400 font-medium ml-1">({member.completedCodes.toFixed(1)} / {member.totalCodes})</span>
                          </p>
                        </div>
                        <div className="w-full h-2 bg-zinc-800/50 rounded-full overflow-hidden shadow-inner">
                          <div 
                            className={`h-full rounded-full transition-all duration-1000 ease-out ${progress === 100 ? 'bg-emerald-500' : 'bg-brand-white'}`} 
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>

          {/* Global Rankings */}
          <div className="space-y-6">
            <div className="bg-[#111] shadow-sm border border-zinc-800 rounded-2xl overflow-hidden sticky top-24">
              <div className="px-6 py-5 border-b border-zinc-800/50 bg-brand-black/50">
                <h3 className="text-lg font-bold text-brand-white flex items-center">
                  <Trophy className="mr-2.5 text-amber-500" size={20} />
                  Рейтинг гильдий
                </h3>
                <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mt-1">
                  За {formatMonth(selectedMonth)}
                </p>
              </div>
              <ul className="divide-y divide-zinc-100">
                {sortedGuildsByMonthly.map((guild, index) => {
                  const isMyGuild = guild.id === myGuild.id;
                  const monthlyScore = guildMonthlyScores[guild.id] || 0;
                  return (
                    <li key={guild.id} className={`px-6 py-4 flex items-center justify-between transition-colors ${isMyGuild ? 'bg-brand-white text-brand-black' : 'hover:bg-brand-black/50'}`}>
                      <div className="flex items-center">
                        {index === 0 ? <Medal className={`mr-3 ${isMyGuild ? 'text-amber-600' : 'text-amber-500'}`} size={20} /> :
                         index === 1 ? <Medal className={`mr-3 ${isMyGuild ? 'text-zinc-500' : 'text-zinc-400'}`} size={20} /> :
                         index === 2 ? <Medal className={`mr-3 ${isMyGuild ? 'text-orange-600' : 'text-orange-500'}`} size={20} /> :
                         <span className={`w-5 text-center font-bold mr-3 ${isMyGuild ? 'text-zinc-500' : 'text-zinc-400'}`}>{index + 1}</span>}
                        <span className={`text-sm font-bold ${isMyGuild ? 'text-brand-black' : 'text-brand-white'}`}>
                          {guild.name}
                        </span>
                      </div>
                      <span className={`text-sm font-bold ${isMyGuild ? 'text-brand-black' : 'text-brand-white'}`}>
                        {monthlyScore.toFixed(1)}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
