import React, { useState, useEffect } from 'react';
import { collection, query, onSnapshot, orderBy, where, or, addDoc, serverTimestamp, doc, setDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../../firebase';
import { useAuth } from '../../contexts/AuthContext';
import { Chat, Message } from './types';
import ChatSidebar from './ChatSidebar';
import ChatWindow from './ChatWindow';

export default function ChatLayout() {
  const { userProfile } = useAuth();
  const [chats, setChats] = useState<Chat[]>([]);
  const [selectedChat, setSelectedChat] = useState<Chat | null>(null);
  const [isMobileListOpen, setIsMobileListOpen] = useState(true);

  useEffect(() => {
    if (!userProfile) return;

    // We need to fetch chats where the user is a participant, OR it's a tariff chat matching the user's tariff, OR user is admin
    // Firestore OR queries are supported but might be complex. Let's fetch all chats and filter client-side for simplicity,
    // OR use a composite query if possible. Since it's a small club, client-side filtering after a broad query might be okay,
    // but let's try to be efficient.
    
    const chatsRef = collection(db, 'chats');
    
    const unsubscribe = onSnapshot(query(chatsRef, orderBy('updatedAt', 'desc')), (snapshot) => {
      const allChats = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Chat));
      
      const visibleChats = allChats.filter(chat => {
        if (userProfile.role === 'admin') return true;
        if (chat.type === 'tariff' && chat.tariff === userProfile.tariff) return true;
        if ((chat.type === 'direct' || chat.type === 'group') && chat.participants?.includes(userProfile.uid)) return true;
        return false;
      });

      setChats(visibleChats);
      
      // Update selected chat if it was updated
      if (selectedChat) {
        const updatedSelected = visibleChats.find(c => c.id === selectedChat.id);
        if (updatedSelected) {
          setSelectedChat(updatedSelected);
        }
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'chats');
    });

    return unsubscribe;
  }, [userProfile, selectedChat]);

  // Bootstrap tariff chats if admin
  useEffect(() => {
    if (userProfile?.role === 'admin') {
      const bootstrapTariffChats = async () => {
        const tariffs = ['Moneycan', 'Lemoner', 'Richer'];
        for (const tariff of tariffs) {
          const existing = chats.find(c => c.type === 'tariff' && c.tariff === tariff);
          if (!existing) {
            try {
              await setDoc(doc(db, 'chats', `tariff_${tariff}`), {
                type: 'tariff',
                name: `Чат ${tariff}`,
                tariff: tariff,
                participants: [],
                adminIds: [userProfile.uid],
                updatedAt: new Date().toISOString(),
                createdAt: new Date().toISOString()
              });
            } catch (e) {
              console.error("Failed to bootstrap tariff chat", e);
            }
          }
        }
      };
      // Only run if chats are loaded and we are missing some
      if (chats.length > 0 && tariffsMissing(chats)) {
        bootstrapTariffChats();
      }
    }
  }, [chats, userProfile]);

  const tariffsMissing = (currentChats: Chat[]) => {
    const tariffs = ['Moneycan', 'Lemoner', 'Richer'];
    return tariffs.some(t => !currentChats.find(c => c.type === 'tariff' && c.tariff === t));
  };

  const handleSelectChat = (chat: Chat) => {
    setSelectedChat(chat);
    setIsMobileListOpen(false);
  };

  return (
    <div className="flex h-[calc(100vh-120px)] md:h-[calc(100vh-64px)] bg-white rounded-2xl shadow-sm border border-zinc-200 overflow-hidden">
      <div className={`${!isMobileListOpen ? 'hidden md:flex' : 'flex'} w-full md:w-80 lg:w-96 flex-col border-r border-zinc-200`}>
        <ChatSidebar 
          chats={chats} 
          selectedChatId={selectedChat?.id} 
          onSelectChat={handleSelectChat} 
        />
      </div>
      <div className={`${isMobileListOpen ? 'hidden md:flex' : 'flex'} flex-1 flex-col bg-zinc-50/50`}>
        {selectedChat ? (
          <ChatWindow 
            chat={selectedChat} 
            onBack={() => setIsMobileListOpen(true)} 
          />
        ) : (
          <div className="flex-1 flex items-center justify-center text-zinc-400">
            <p>Выберите чат для начала общения</p>
          </div>
        )}
      </div>
    </div>
  );
}
