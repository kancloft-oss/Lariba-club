import React, { createContext, useContext, useEffect, useState } from 'react';
import { User as FirebaseUser, onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from '../firebase';

export type UserRole = 'admin' | 'resident';
export type Tariff = 'Moneycan' | 'Lemoner' | 'Richer' | 'None';

export interface UserProfile {
  uid: string;
  login: string;
  name: string;
  role: UserRole;
  tariff: Tariff;
  guildId?: string;
  paymentStatus: 'paid' | 'unpaid';
  paymentDueDate?: string;
  createdAt: string;
  avatarUrl?: string;
}

interface AuthContextType {
  currentUser: FirebaseUser | null;
  userProfile: UserProfile | null;
  loading: boolean;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        try {
          const docRef = doc(db, 'users', user.uid);
          const docSnap = await getDoc(docRef);
          
          if (docSnap.exists()) {
            setUserProfile(docSnap.data() as UserProfile);
          } else {
            // Auto-create profile for the first admin
            const isAdminEmail = user.email === 'admin@lariba.local' || (user.email === 'kancloft@gmail.com' && user.emailVerified);
            if (isAdminEmail) {
              const newProfile: UserProfile = {
                uid: user.uid,
                login: user.email === 'admin@lariba.local' ? 'Admin' : user.email!,
                name: user.displayName || 'Admin',
                role: 'admin',
                tariff: 'None',
                paymentStatus: 'paid',
                createdAt: new Date().toISOString()
              };
              await setDoc(docRef, newProfile);
              setUserProfile(newProfile);
            } else {
              // If no profile exists and it's not the admin, log them out
              await signOut(auth);
              setUserProfile(null);
            }
          }
        } catch (error) {
          handleFirestoreError(error, OperationType.GET, `users/${user.uid}`);
        }
      } else {
        setUserProfile(null);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const logout = () => signOut(auth);

  const value = {
    currentUser,
    userProfile,
    loading,
    logout
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}
