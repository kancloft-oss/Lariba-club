import React, { useState, useEffect, useRef } from 'react';
import { collection, query, onSnapshot, orderBy, addDoc, doc, updateDoc, getDocs } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../../firebase';
import { useAuth } from '../../contexts/AuthContext';
import { Chat, Message } from './types';
import { Send, ArrowLeft, MoreVertical, Users, Paperclip, Mic, Square, File as FileIcon, Image as ImageIcon, Video as VideoIcon } from 'lucide-react';
import GroupSettingsModal from './GroupSettingsModal';

interface ChatWindowProps {
  chat: Chat;
  onBack: () => void;
}

export default function ChatWindow({ chat, onBack }: ChatWindowProps) {
  const { userProfile } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [usersMap, setUsersMap] = useState<Record<string, {name: string, avatarUrl?: string}>>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Audio recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const snapshot = await getDocs(collection(db, 'users'));
        const map: Record<string, {name: string, avatarUrl?: string}> = {};
        snapshot.docs.forEach(doc => {
          map[doc.id] = { name: doc.data().name, avatarUrl: doc.data().avatarUrl };
        });
        setUsersMap(map);
      } catch (error) {
        console.error("Error fetching users for chat:", error);
      }
    };
    fetchUsers();
  }, []);

  useEffect(() => {
    if (!chat.id) return;

    const messagesRef = collection(db, 'chats', chat.id, 'messages');
    const q = query(messagesRef, orderBy('createdAt', 'asc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Message));
      setMessages(msgs);
      scrollToBottom();
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `chats/${chat.id}/messages`);
    });

    return unsubscribe;
  }, [chat.id]);

  const scrollToBottom = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  const uploadFileToStorage = async (file: File | Blob, type: 'image' | 'video' | 'audio' | 'file', name?: string) => {
    if (!userProfile) return null;
    const fileName = name || `${Date.now()}_${Math.random().toString(36).substring(7)}`;
    
    const formData = new FormData();
    formData.append('attachment', file, fileName);

    const response = await fetch('/api/upload-chat-attachment', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`Upload failed: ${await response.text()}`);
    }

    const data = await response.json();
    return { url: data.url, name: fileName, type, size: file.size };
  };

  const handleSendMessage = async (e?: React.FormEvent, attachmentData?: any) => {
    if (e) e.preventDefault();
    if ((!newMessage.trim() && !attachmentData) || !userProfile) return;

    const text = newMessage.trim();
    setNewMessage('');
    setIsSending(true);

    try {
      const messagesRef = collection(db, 'chats', chat.id, 'messages');
      const now = new Date().toISOString();
      
      const messageData: any = {
        senderId: userProfile.uid,
        createdAt: now,
        readBy: [userProfile.uid]
      };

      if (text) messageData.text = text;
      if (attachmentData) messageData.attachment = attachmentData;
      
      await addDoc(messagesRef, messageData);

      const chatRef = doc(db, 'chats', chat.id);
      await updateDoc(chatRef, {
        lastMessage: {
          text: attachmentData ? `[${attachmentData.type}]` : text,
          senderId: userProfile.uid,
          createdAt: now
        },
        updatedAt: now
      });

      scrollToBottom();
    } catch (error) {
      console.error("Error sending message:", error);
      alert("Ошибка отправки сообщения: " + (error instanceof Error ? error.message : String(error)));
      setNewMessage(text); // restore text on error
    } finally {
      setIsSending(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setIsSending(true);
    try {
      let type: 'image' | 'video' | 'audio' | 'file' = 'file';
      if (file.type.startsWith('image/')) type = 'image';
      else if (file.type.startsWith('video/')) type = 'video';
      else if (file.type.startsWith('audio/')) type = 'audio';

      const attachmentData = await uploadFileToStorage(file, type, file.name);
      await handleSendMessage(undefined, attachmentData);
    } catch (error) {
      console.error("Error uploading file:", error);
      alert("Ошибка загрузки файла: " + (error instanceof Error ? error.message : String(error)));
    } finally {
      setIsSending(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        setIsSending(true);
        try {
          const attachmentData = await uploadFileToStorage(audioBlob, 'audio', `audio_${Date.now()}.webm`);
          await handleSendMessage(undefined, attachmentData);
        } catch (error) {
          console.error("Error uploading audio:", error);
          alert("Ошибка загрузки аудио: " + (error instanceof Error ? error.message : String(error)));
        } finally {
          setIsSending(false);
        }
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } catch (error) {
      console.error("Error accessing microphone:", error);
      alert("Не удалось получить доступ к микрофону");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  };

  const formatMessageTime = (isoString?: string) => {
    if (!isoString) return '';
    return new Date(isoString).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  };

  const formatRecordingTime = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const renderAttachment = (attachment: NonNullable<Message['attachment']>) => {
    switch (attachment.type) {
      case 'image':
        return <img src={attachment.url} alt="attachment" className="max-w-full rounded-lg mt-1 max-h-64 object-contain" />;
      case 'video':
        return <video src={attachment.url} controls className="max-w-full rounded-lg mt-1 max-h-64" />;
      case 'audio':
        return <audio src={attachment.url} controls className="mt-1 max-w-[200px] sm:max-w-[250px]" />;
      case 'file':
      default:
        return (
          <a href={attachment.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 mt-1 p-2 bg-black/5 rounded-lg hover:bg-black/10 transition-colors">
            <FileIcon size={20} className="text-zinc-500 flex-shrink-0" />
            <span className="text-sm truncate underline">{attachment.name || 'Файл'}</span>
          </a>
        );
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#EFEAE2] relative">
      {/* Header */}
      <div className="bg-white px-4 py-3 flex items-center justify-between shadow-sm z-10">
        <div className="flex items-center">
          <button onClick={onBack} className="md:hidden mr-3 p-2 -ml-2 text-zinc-500 hover:text-zinc-900 rounded-full">
            <ArrowLeft size={20} />
          </button>
          <div className="w-10 h-10 rounded-full bg-zinc-100 flex items-center justify-center mr-3">
            <Users size={20} className="text-zinc-500" />
          </div>
          <div>
            <h3 className="font-bold text-zinc-900">{chat.name || 'Чат'}</h3>
            <p className="text-xs text-zinc-500">
              {chat.type === 'tariff' ? `Тариф: ${chat.tariff}` : chat.type === 'group' ? 'Группа' : 'Личный чат'}
            </p>
          </div>
        </div>
        {userProfile?.role === 'admin' && chat.type === 'group' && (
          <button 
            onClick={() => setIsSettingsOpen(true)}
            className="p-2 text-zinc-500 hover:text-zinc-900 rounded-full transition-colors"
          >
            <MoreVertical size={20} />
          </button>
        )}
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg, index) => {
          const isMine = msg.senderId === userProfile?.uid;
          const showAvatar = !isMine && (index === 0 || messages[index - 1].senderId !== msg.senderId);
          const senderInfo = usersMap[msg.senderId] || { name: 'Пользователь' };
          
          return (
            <div key={msg.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
              {!isMine && (
                <div className="w-8 flex-shrink-0 mr-2">
                  {showAvatar && (
                    senderInfo.avatarUrl ? (
                      <img src={senderInfo.avatarUrl} alt={senderInfo.name} className="w-8 h-8 rounded-full object-cover" title={senderInfo.name} />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-zinc-200 flex items-center justify-center text-xs font-bold text-zinc-500" title={senderInfo.name}>
                        {senderInfo.name.substring(0, 2).toUpperCase()}
                      </div>
                    )
                  )}
                </div>
              )}
              <div className={`max-w-[75%] rounded-2xl px-4 py-2 relative shadow-sm ${
                isMine 
                  ? 'bg-[#DCF8C6] text-zinc-900 rounded-tr-sm' 
                  : 'bg-white text-zinc-900 rounded-tl-sm'
              }`}>
                {!isMine && showAvatar && (
                  <div className="text-xs font-bold text-brand-purple mb-1">
                    {senderInfo.name}
                  </div>
                )}
                {msg.text && <p className="text-sm break-words whitespace-pre-wrap">{msg.text}</p>}
                {msg.attachment && renderAttachment(msg.attachment)}
                <div className="text-[10px] text-zinc-500 text-right mt-1 -mb-1 flex justify-end items-center gap-1">
                  {formatMessageTime(msg.createdAt)}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="bg-[#F0F2F5] p-3">
        {isRecording ? (
          <div className="flex items-center justify-between bg-white rounded-2xl px-4 py-2 shadow-sm">
            <div className="flex items-center gap-3 text-red-500 animate-pulse">
              <Mic size={20} />
              <span className="font-mono">{formatRecordingTime(recordingTime)}</span>
            </div>
            <button 
              onClick={stopRecording}
              className="p-2 bg-red-100 text-red-600 rounded-full hover:bg-red-200 transition-colors"
            >
              <Square size={18} className="fill-current" />
            </button>
          </div>
        ) : (
          <form onSubmit={handleSendMessage} className="flex items-end gap-2 bg-white rounded-2xl pl-2 pr-2 py-2 shadow-sm">
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleFileUpload} 
              className="hidden" 
              accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
            />
            <button 
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isSending}
              className="p-2.5 text-zinc-400 hover:text-zinc-600 transition-colors disabled:opacity-50 flex-shrink-0 mb-0.5"
            >
              <Paperclip size={20} />
            </button>
            <textarea
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Введите сообщение..."
              className="flex-1 max-h-32 bg-transparent border-none focus:ring-0 resize-none py-2.5 text-sm"
              rows={1}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage(e);
                }
              }}
            />
            {newMessage.trim() ? (
              <button 
                type="submit" 
                disabled={isSending}
                className="p-2.5 bg-brand-purple text-white rounded-xl hover:bg-brand-purple/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0 mb-0.5"
              >
                <Send size={18} className="ml-0.5" />
              </button>
            ) : (
              <button 
                type="button" 
                onClick={startRecording}
                disabled={isSending}
                className="p-2.5 text-zinc-400 hover:text-brand-purple transition-colors disabled:opacity-50 flex-shrink-0 mb-0.5"
              >
                <Mic size={20} />
              </button>
            )}
          </form>
        )}
      </div>

      {isSettingsOpen && (
        <GroupSettingsModal 
          chat={chat} 
          onClose={() => setIsSettingsOpen(false)} 
        />
      )}
    </div>
  );
}
