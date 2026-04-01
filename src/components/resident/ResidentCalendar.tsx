import React, { useState } from 'react';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import { Event } from '../admin/AdminEvents';
import { MapPin, Clock, ExternalLink } from 'lucide-react';

interface ResidentCalendarProps {
  events: Event[];
}

export default function ResidentCalendar({ events }: ResidentCalendarProps) {
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());
  const eventDates = events.map(event => new Date(event.date).toDateString());

  const tileContent = ({ date, view }: { date: Date; view: string }) => {
    if (view === 'month' && eventDates.includes(date.toDateString())) {
      return (
        <div className="flex justify-center mt-1">
          <div className="w-1.5 h-1.5 rounded-full bg-rose-500"></div>
        </div>
      );
    }
    return null;
  };

  const selectedEvents = events.filter(event => 
    selectedDate && new Date(event.date).toDateString() === selectedDate.toDateString()
  );

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-3xl p-4 shadow-sm border border-zinc-200">
        <Calendar
          onChange={(value) => setSelectedDate(value as Date)}
          value={selectedDate}
          tileContent={tileContent}
          next2Label={null}
          prev2Label={null}
          className="w-full border-none text-zinc-900 font-sans"
          formatShortWeekday={(locale, date) => 
            date.toLocaleDateString(locale, { weekday: 'narrow' })
          }
        />
      </div>

      {selectedDate && (
        <div className="space-y-4">
          <h4 className="text-sm font-bold text-zinc-900 uppercase tracking-wider px-2">
            События на {selectedDate.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}
          </h4>
          
          {selectedEvents.length > 0 ? (
            <div className="space-y-3">
              {selectedEvents.map(event => (
                <div key={event.id} className="bg-white rounded-2xl p-5 shadow-sm border border-zinc-200 space-y-3">
                  <div className="flex justify-between items-start">
                    <h5 className="font-bold text-zinc-900 text-lg leading-tight">{event.title}</h5>
                    <span className="px-3 py-1 bg-zinc-100 text-zinc-900 rounded-full text-[10px] font-bold uppercase tracking-wider">
                      {event.type}
                    </span>
                  </div>
                  
                  <p className="text-sm text-zinc-600 leading-relaxed">{event.description}</p>
                  
                  <div className="flex flex-wrap gap-4 pt-2">
                    <div className="flex items-center text-zinc-500 text-xs">
                      <Clock size={14} className="mr-1.5" />
                      {event.time}
                    </div>
                    <div className="flex items-center text-zinc-500 text-xs">
                      <MapPin size={14} className="mr-1.5" />
                      {event.location}
                    </div>
                  </div>

                  {event.link && (
                    <a 
                      href={event.link} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="inline-flex items-center space-x-2 text-zinc-900 font-bold text-sm hover:underline pt-2"
                    >
                      <span>Подробнее</span>
                      <ExternalLink size={14} />
                    </a>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-zinc-50 rounded-2xl p-8 text-center border border-dashed border-zinc-200">
              <p className="text-zinc-500 text-sm">На этот день событий не запланировано</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
