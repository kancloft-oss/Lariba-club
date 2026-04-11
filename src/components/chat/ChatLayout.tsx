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

    const chatsRef = collection(db, 'chats');
    let unsubscribes: (() => void)[] = [];

    const handleChatsUpdate = (snapshot: any, source: string) => {
      // We will combine results from multiple queries
      // For simplicity in this fix, we'll just re-fetch or manage state carefully.
      // Actually, it's easier to use a single state update function.
    };

    if (userProfile.role === 'admin') {
      const q = query(chatsRef, orderBy('updatedAt', 'desc'));
      const unsub = onSnapshot(q, (snapshot) => {
        const allChats = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Chat));
        setChats(allChats);
        if (selectedChat) {
          const updatedSelected = allChats.find(c => c.id === selectedChat.id);
          if (updatedSelected) setSelectedChat(updatedSelected);
        }
      }, (error) => handleFirestoreError(error, OperationType.LIST, 'chats'));
      unsubscribes.push(unsub);
    } else {
      // For residents, we need two queries:
      // 1. Chats where they are a participant
      // 2. Tariff chat for their tariff
      
      let participantChats: Chat[] = [];
      let tariffChats: Chat[] = [];

      const updateCombinedChats = () => {
        const combined = [...participantChats, ...tariffChats];
        // Remove duplicates just in case, though unlikely
        const unique = Array.from(new Map(combined.map(item => [item.id, item])).values());
        // Sort by updatedAt desc
        unique.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
        setChats(unique);
        
        if (selectedChat) {
          const updatedSelected = unique.find(c => c.id === selectedChat.id);
          if (updatedSelected) setSelectedChat(updatedSelected);
        }
      };

      const qParticipants = query(chatsRef, where('participants', 'array-contains', userProfile.uid));
      const unsubParticipants = onSnapshot(qParticipants, (snapshot) => {
        participantChats = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Chat));
        updateCombinedChats();
      }, (error) => handleFirestoreError(error, OperationType.LIST, 'chats_participants'));
      unsubscribes.push(unsubParticipants);

      if (userProfile.tariff) {
        const tariffChatRef = doc(db, 'chats', `tariff_${userProfile.tariff}`);
        const unsubTariff = onSnapshot(tariffChatRef, (docSnap) => {
          if (docSnap.exists()) {
            tariffChats = [{ id: docSnap.id, ...docSnap.data() } as Chat];
          } else {
            tariffChats = [];
          }
          updateCombinedChats();
        }, (error) => handleFirestoreError(error, OperationType.GET, `chats/tariff_${userProfile.tariff}`));
        unsubscribes.push(unsubTariff);
      }
    }

    return () => unsubscribes.forEach(unsub => unsub());
  }, [userProfile, selectedChat?.id]);

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
