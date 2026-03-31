import React from 'react';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import { Event } from '../admin/AdminEvents';

interface ResidentCalendarProps {
  events: Event[];
}

export default function ResidentCalendar({ events }: ResidentCalendarProps) {
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

  return (
    <div className="bg-white rounded-3xl p-4 shadow-sm border border-zinc-200">
      <Calendar
        tileContent={tileContent}
        className="w-full border-none text-zinc-900 font-sans"
        formatShortWeekday={(locale, date) => 
          date.toLocaleDateString(locale, { weekday: 'narrow' })
        }
      />
    </div>
  );
}
