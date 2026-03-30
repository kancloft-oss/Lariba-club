import { useState, useEffect } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../../firebase';
import { useAuth } from '../../contexts/AuthContext';
import { Event } from '../admin/AdminEvents';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import { Calendar as CalendarIcon } from 'lucide-react';

export default function ResidentEvents() {
  const { userProfile } = useAuth();
  const [events, setEvents] = useState<Event[]>([]);
  const [date, setDate] = useState(new Date());

  useEffect(() => {
    if (!userProfile) return;

    const unsubscribe = onSnapshot(collection(db, 'events'), (snapshot) => {
      const eventsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Event));
      const filteredEvents = eventsData.filter(event => event.tariffs.includes(userProfile.tariff));
      setEvents(filteredEvents);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'events');
    });

    return unsubscribe;
  }, [userProfile]);

  const tileContent = ({ date, view }: { date: Date; view: string }) => {
    if (view === 'month') {
      const dayEvents = events.filter(event => {
        const eventDate = new Date(event.date);
        return eventDate.toDateString() === date.toDateString();
      });
      return (
        <div className="flex flex-col items-center mt-1">
          {dayEvents.map(event => (
            <div key={event.id} className="w-1.5 h-1.5 bg-zinc-900 rounded-full mb-0.5" title={event.title} />
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6 pb-20 md:pb-0">
      <h2 className="text-2xl font-bold text-zinc-900 tracking-tight">Календарь мероприятий</h2>
      
      <div className="bg-white rounded-3xl shadow-sm border border-zinc-200 p-6">
        <Calendar
          onChange={(value) => setDate(value as Date)}
          value={date}
          tileContent={tileContent}
          className="w-full border-none"
        />
      </div>

      <div className="space-y-4">
        <h3 className="text-lg font-bold text-zinc-900">Мероприятия на {date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}</h3>
        {events.filter(event => new Date(event.date).toDateString() === date.toDateString()).length === 0 ? (
          <p className="text-sm text-zinc-500">Нет мероприятий на эту дату.</p>
        ) : (
          events.filter(event => new Date(event.date).toDateString() === date.toDateString()).map(event => (
            <div key={event.id} className="bg-white p-4 rounded-2xl shadow-sm border border-zinc-200">
              <h4 className="font-bold text-zinc-900">{event.title}</h4>
              <p className="text-sm text-zinc-600 mt-1">{event.description}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
