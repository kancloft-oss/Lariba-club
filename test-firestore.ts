import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc } from 'firebase/firestore';
import fs from 'fs';

const firebaseConfig = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));
const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

async function test() {
  try {
    const messagesRef = collection(db, 'chats', 'test-chat-id', 'messages');
    const now = new Date().toISOString();
    
    const messageData = {
      senderId: 'test-uid',
      createdAt: now,
      readBy: ['test-uid'],
      attachment: {
        url: 'https://example.com/test.jpg',
        name: 'test.jpg',
        type: 'image',
        size: 1234
      }
    };
    
    await addDoc(messagesRef, messageData);
    console.log('Success');
  } catch (e) {
    console.error('Error:', e.message);
  }
}

test();
