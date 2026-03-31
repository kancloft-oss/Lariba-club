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
    <div className="space-y-6 pb-20 md:pb-0">
      <h2 className="text-2xl font-bold text-zinc-900 tracking-tight">Предстоящие мероприятия</h2>
      
      <div className="space-y-4">
        {events.length === 0 ? (
          <div className="bg-white rounded-3xl shadow-sm border border-zinc-200 p-8 text-center">
            <CalendarIcon className="w-12 h-12 text-zinc-300 mx-auto mb-4" />
            <p className="text-zinc-500">Пока нет доступных мероприятий для вашего тарифа.</p>
          </div>
        ) : (
          events.map(event => (
            <div key={event.id} className="bg-white p-6 rounded-3xl shadow-sm border border-zinc-200 hover:border-zinc-300 transition-colors">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                <div className="space-y-3 flex-1">
                  <h3 className="text-xl font-bold text-zinc-900">{event.title}</h3>
                  <p className="text-zinc-600">{event.description}</p>
                  
                  <div className="flex flex-wrap gap-4 pt-2">
                    <div className="flex items-center text-sm text-zinc-500 bg-zinc-50 px-3 py-1.5 rounded-lg">
                      <CalendarIcon className="w-4 h-4 mr-2" />
                      {new Date(event.date).toLocaleDateString('ru-RU', { 
                        day: 'numeric', 
                        month: 'long',
                        year: 'numeric'
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
