import React, { useState } from 'react';
import { Chat } from './types';
import { useAuth } from '../../contexts/AuthContext';
import { Search, Plus, Users, MessageSquare, Shield } from 'lucide-react';
import CreateGroupModal from './CreateGroupModal';

interface ChatSidebarProps {
  chats: Chat[];
  selectedChatId?: string;
  onSelectChat: (chat: Chat) => void;
}

export default function ChatSidebar({ chats, selectedChatId, onSelectChat }: ChatSidebarProps) {
  const { userProfile } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  const filteredChats = chats.filter(chat => {
    const name = chat.name || 'Чат';
    return name.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const getChatIcon = (chat: Chat) => {
    if (chat.type === 'tariff') return <Shield size={20} className="text-brand-purple" />;
    if (chat.type === 'group') return <Users size={20} className="text-blue-500" />;
    return <MessageSquare size={20} className="text-zinc-500" />;
  };

  const formatTime = (isoString?: string) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="flex flex-col h-full bg-white">
      <div className="p-4 border-b border-zinc-100">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-zinc-900">Чаты</h2>
          {userProfile?.role === 'admin' && (
            <button 
              onClick={() => setIsCreateModalOpen(true)}
              className="p-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 rounded-full transition-colors"
              title="Создать группу"
            >
              <Plus size={20} />
            </button>
          )}
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
          <input 
            type="text" 
            placeholder="Поиск..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-zinc-100 border-transparent focus:bg-white focus:border-zinc-300 focus:ring-2 focus:ring-zinc-900 rounded-xl text-sm transition-all"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {filteredChats.length === 0 ? (
          <div className="p-4 text-center text-zinc-500 text-sm">Нет чатов</div>
        ) : (
          <div className="divide-y divide-zinc-50">
            {filteredChats.map(chat => (
              <button
                key={chat.id}
                onClick={() => onSelectChat(chat)}
                className={`w-full flex items-start p-4 transition-colors hover:bg-zinc-50 ${
                  selectedChatId === chat.id ? 'bg-zinc-50' : ''
                }`}
              >
                <div className="w-12 h-12 rounded-full bg-zinc-100 flex items-center justify-center flex-shrink-0 mr-3">
                  {getChatIcon(chat)}
                </div>
                <div className="flex-1 min-w-0 text-left">
                  <div className="flex justify-between items-baseline mb-1">
                    <h3 className="text-sm font-semibold text-zinc-900 truncate pr-2">
                      {chat.name || 'Чат'}
                    </h3>
                    <span className="text-xs text-zinc-400 flex-shrink-0">
                      {formatTime(chat.lastMessage?.createdAt || chat.updatedAt)}
                    </span>
                  </div>
                  <p className="text-sm text-zinc-500 truncate">
                    {chat.lastMessage ? (
                      <span className={chat.lastMessage.senderId === userProfile?.uid ? 'text-zinc-600' : ''}>
                        {chat.lastMessage.senderId === userProfile?.uid ? 'Вы: ' : ''}
                        {chat.lastMessage.text}
                      </span>
                    ) : (
                      <span className="italic">Нет сообщений</span>
                    )}
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {isCreateModalOpen && (
        <CreateGroupModal onClose={() => setIsCreateModalOpen(false)} />
      )}
    </div>
  );
}
