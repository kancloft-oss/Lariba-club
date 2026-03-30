import { initializeApp, getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

const appName = 'SecondaryApp_' + Date.now();
const secondaryApp = !getApps().find(app => app.name === appName) 
  ? initializeApp(firebaseConfig, appName) 
  : getApps().find(app => app.name === appName)!;

export const secondaryAuth = getAuth(secondaryApp);
