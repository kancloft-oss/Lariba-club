import { Tariff } from '../../contexts/AuthContext';

export interface Chat {
  id: string;
  type: 'direct' | 'group' | 'tariff';
  name?: string;
  tariff?: Tariff;
  participants?: string[];
  adminIds?: string[];
  lastMessage?: {
    text: string;
    senderId: string;
    createdAt: string;
  };
  updatedAt: string;
  createdAt: string;
}

export interface Message {
  id: string;
  text: string;
  senderId: string;
  createdAt: string;
  readBy?: string[];
  attachment?: {
    type: 'image' | 'video' | 'audio' | 'file';
    url: string;
    name?: string;
    size?: number;
  };
}
