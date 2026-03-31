import { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../../firebase';
import { useAuth } from '../../contexts/AuthContext';
import { Event } from '../admin/AdminEvents';
import { Calendar as CalendarIcon } from 'lucide-react';

export default function ResidentEvents() {
  const { userProfile } = useAuth();
  const [events, setEvents] = useState<Event[]>([]);

  useEffect(() => {
    if (!userProfile) return;

    const q = query(collection(db, 'events'), orderBy('date', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const eventsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Event));
      const filteredEvents = eventsData.filter(event => event.tariffs.includes(userProfile.tariff));
      setEvents(filteredEvents);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'events');
    });

    return unsubscribe;
  }, [userProfile]);

  return (
    <div className="max-w-md mx-auto pb-24 space-y-6 font-sans">
      <h2 className="text-2xl font-bold text-zinc-900 tracking-tight">Предстоящие мероприятия</h2>
      
      <div className="space-y-4">
        {events.length === 0 ? (
          <div className="bg-white rounded-3xl shadow-sm border border-zinc-200 p-8 text-center">
            <CalendarIcon className="w-12 h-12 text-zinc-400 mx-auto mb-4" />
            <p className="text-zinc-500">Пока нет доступных мероприятий для вашего тарифа.</p>
          </div>
        ) : (
          events.map(event => (
            <div key={event.id} className="bg-white p-5 rounded-3xl shadow-sm border border-zinc-200 hover:border-zinc-300 transition-colors flex items-start space-x-4">
              <div className="w-14 h-14 rounded-2xl bg-zinc-50 flex flex-col items-center justify-center flex-shrink-0 shadow-sm border border-zinc-200">
                <span className="text-xs font-bold text-rose-600 uppercase">
                  {new Date(event.date).toLocaleDateString('ru-RU', { month: 'short' }).replace('.', '')}
                </span>
                <span className="text-xl font-bold text-zinc-900 leading-none mt-0.5">
                  {new Date(event.date).getDate()}
                </span>
              </div>
              <div className="flex-1 min-w-0 pt-1">
                <h3 className="text-lg font-bold text-zinc-900 truncate">{event.title}</h3>
                <p className="text-sm text-zinc-500 mt-1 line-clamp-2">{event.description}</p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
