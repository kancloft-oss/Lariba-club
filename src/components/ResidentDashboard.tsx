import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { LogOut, Home, Calendar, CheckSquare, Shield } from 'lucide-react';
import ResidentHome from './resident/ResidentHome';
import ResidentEvents from './resident/ResidentEvents';
import ResidentTracker from './resident/ResidentTracker';
import ResidentGuild from './resident/ResidentGuild';
import { TariffBadge } from './TariffBadge';

export default function ResidentDashboard() {
  const { userProfile, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<'home' | 'events' | 'tracker' | 'guild'>('home');

  const isRicher = userProfile?.tariff === 'Richer';

  const navItems = [
    { id: 'home', label: 'Главная', icon: Home },
    { id: 'events', label: 'События', icon: Calendar },
    { id: 'tracker', label: 'Коды', icon: CheckSquare },
    ...(isRicher ? [{ id: 'guild', label: 'Гильдия', icon: Shield }] : []),
  ] as const;

  return (
    <div className="min-h-screen bg-white flex flex-col md:flex-row pb-16 md:pb-0 font-sans">
      {/* Desktop Sidebar (hidden on mobile) */}
      <div className="hidden md:flex w-64 bg-white border-r border-zinc-200 flex-col fixed h-full z-10">
        <div className="p-6">
          <img src="/logo.svg" alt="Laribaclub" className="h-12 w-auto rounded-xl shadow-sm" />
          <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider mt-3 ml-1">Клуб</p>
        </div>
        
        <div className="px-6 pb-4">
          <div className="bg-zinc-100 rounded-xl p-4">
            <p className="text-sm font-medium text-zinc-900 truncate mb-2">{userProfile?.name}</p>
            {userProfile?.tariff && <TariffBadge tariff={userProfile.tariff} />}
          </div>
        </div>

        <nav className="flex-1 px-4 space-y-1 mt-4">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id as any)}
                className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-all duration-200 ${
                  isActive 
                    ? 'bg-zinc-900 text-white shadow-md' 
                    : 'text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900'
                }`}
              >
                <Icon size={20} className={isActive ? 'text-white' : 'text-zinc-500'} />
                <span className="font-medium text-sm">{item.label}</span>
              </button>
            );
          })}
        </nav>
        <div className="p-4 border-t border-zinc-200">
          <button
            onClick={logout}
            className="w-full flex items-center space-x-3 px-4 py-3 text-red-600 hover:bg-red-50 rounded-xl transition-colors"
          >
            <LogOut size={20} />
            <span className="font-medium text-sm">Выйти</span>
          </button>
        </div>
      </div>

      {/* Mobile Header */}
      <div className="md:hidden bg-white/80 backdrop-blur-md border-b border-zinc-200 p-4 sticky top-0 z-20 flex justify-between items-center">
        <div>
          <img src="/logo.svg" alt="Laribaclub" className="h-8 w-auto rounded-lg shadow-sm mb-1" />
          <p className="text-[10px] font-medium text-zinc-500 uppercase tracking-wider ml-0.5">Клуб</p>
        </div>
        <button onClick={logout} className="p-2 text-zinc-500 hover:text-zinc-900 bg-zinc-100 rounded-full">
          <LogOut size={18} />
        </button>
      </div>

      {/* Main Content */}
      <div className="flex-1 md:ml-64 p-4 md:p-8 overflow-y-auto w-full max-w-5xl mx-auto">
        {activeTab === 'home' && <ResidentHome />}
        {activeTab === 'events' && <ResidentEvents />}
        {activeTab === 'tracker' && <ResidentTracker />}
        {activeTab === 'guild' && isRicher && <ResidentGuild />}
      </div>

      {/* Mobile Bottom Nav */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-zinc-200 flex justify-around items-center p-2 z-30 pb-safe shadow-[0_-4px_20px_rgba(0,0,0,0.05)]">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id as any)}
              className={`flex flex-col items-center justify-center w-16 h-14 rounded-xl transition-all ${
                isActive ? 'text-zinc-900' : 'text-zinc-500 hover:text-zinc-900'
              }`}
            >
              <div className={`p-1.5 rounded-full transition-all duration-300 ${isActive ? 'bg-zinc-100' : ''}`}>
                <Icon size={22} strokeWidth={isActive ? 2.5 : 2} />
              </div>
              <span className={`text-[10px] mt-0.5 font-medium ${isActive ? 'text-zinc-900' : 'text-zinc-500'}`}>
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
