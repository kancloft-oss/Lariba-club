import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import fs from 'fs';

const firebaseConfig = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));
const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

async function test() {
  try {
    const chatsRef = collection(db, 'chats');
    const snapshot = await getDocs(chatsRef);
    console.log('Chats:', snapshot.docs.map(d => d.id));
  } catch (e) {
    console.error('Error:', e.message);
  }
}

test();
