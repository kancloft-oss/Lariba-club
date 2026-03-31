import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, doc, setDoc, deleteDoc, updateDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../../firebase';
import { Plus, Edit2, Trash2, X, Calendar as CalendarIcon } from 'lucide-react';
import { Tariff } from '../../contexts/AuthContext';
import { TariffBadge } from '../TariffBadge';

export interface Event {
  id: string;
  title: string;
  description: string;
  date: string;
  tariffs: Tariff[];
  createdAt: string;
}

export default function AdminEvents() {
  const [events, setEvents] = useState<Event[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);
  
  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState('');
  const [selectedTariffs, setSelectedTariffs] = useState<Tariff[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'events'), (snapshot) => {
      const eventsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Event));
      // Sort by date descending
      eventsData.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setEvents(eventsData);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'events');
    });

    return unsubscribe;
  }, []);

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setDate('');
    setSelectedTariffs([]);
    setError('');
    setEditingEvent(null);
  };

  const handleOpenModal = (event?: Event) => {
    if (event) {
      setEditingEvent(event);
      setTitle(event.title);
      setDescription(event.description);
      setDate(event.date.split('T')[0]); // Assuming date is ISO string, get YYYY-MM-DD
      setSelectedTariffs(event.tariffs);
    } else {
      resetForm();
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    resetForm();
  };

  const handleTariffToggle = (tariff: Tariff) => {
    setSelectedTariffs(prev => 
      prev.includes(tariff) ? prev.filter(t => t !== tariff) : [...prev, tariff]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (selectedTariffs.length === 0) {
      setError('Пожалуйста, выберите хотя бы один тариф.');
      return;
    }

    try {
      if (editingEvent) {
        const eventRef = doc(db, 'events', editingEvent.id);
        await updateDoc(eventRef, {
          title,
          description,
          date: new Date(date).toISOString(),
          tariffs: selectedTariffs
        });
      } else {
        const newEventRef = doc(collection(db, 'events'));
        await setDoc(newEventRef, {
          title,
          description,
          date: new Date(date).toISOString(),
          tariffs: selectedTariffs,
          createdAt: new Date().toISOString()
        });
      }
      handleCloseModal();
    } catch (err: any) {
      try {
        const errorInfo = JSON.parse(err.message);
        setError('Ошибка доступа: ' + errorInfo.error);
      } catch {
        setError('Ошибка: ' + err.message);
      }
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Вы уверены, что хотите удалить это мероприятие?')) {
      try {
        await deleteDoc(doc(db, 'events', id));
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `events/${id}`);
      }
    }
  };

  return (
    <div className="space-y-6 pb-20 md:pb-0">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-2xl font-bold text-brand-white tracking-tight">Мероприятия</h2>
        <button
          onClick={() => handleOpenModal()}
          className="w-full sm:w-auto bg-brand-white text-brand-black px-5 py-2.5 rounded-xl flex items-center justify-center space-x-2 hover:bg-gray-200 transition-colors shadow-sm"
        >
          <Plus size={20} />
          <span className="font-medium">Добавить мероприятие</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {events.map((event) => (
          <div key={event.id} className="bg-[#111] rounded-3xl shadow-sm border border-zinc-800 overflow-hidden flex flex-col transition-all hover:shadow-md">
            <div className="p-6 flex-1 flex flex-col">
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center space-x-2 text-zinc-400 bg-brand-black px-3 py-1.5 rounded-lg w-fit">
                  <CalendarIcon size={16} />
                  <span className="text-sm font-medium">
                    {new Date(event.date).toLocaleDateString('ru-RU', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric'
                    })}
                  </span>
                </div>
                <div className="flex space-x-1">
                  <button onClick={() => handleOpenModal(event)} className="p-2 text-zinc-400 hover:text-brand-white bg-brand-black hover:bg-gray-200/50 rounded-lg transition-colors">
                    <Edit2 size={16} />
                  </button>
                  <button onClick={() => handleDelete(event.id)} className="p-2 text-zinc-400 hover:text-rose-600 bg-brand-black hover:bg-rose-50 rounded-lg transition-colors">
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
              
              <h3 className="text-xl font-bold text-brand-white mb-2">{event.title}</h3>
              <p className="text-zinc-400 text-sm flex-1 line-clamp-3 mb-6">{event.description}</p>
              
              <div className="mt-auto pt-4 border-t border-zinc-800/50">
                <p className="text-xs font-medium text-zinc-400 uppercase tracking-wider mb-2">Доступно для</p>
                <div className="flex flex-wrap gap-2">
                  {event.tariffs.map(t => (
                    <TariffBadge key={t} tariff={t} />
                  ))}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-end sm:items-center justify-center min-h-screen p-4 text-center sm:p-0">
            <div className="fixed inset-0 transition-opacity" aria-hidden="true" onClick={handleCloseModal}>
              <div className="absolute inset-0 bg-brand-white/40 backdrop-blur-sm"></div>
            </div>
            <div className="relative z-10 inline-block align-bottom bg-[#111] rounded-2xl text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full w-full">
              <div className="bg-[#111] px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="flex justify-between items-center mb-5">
                  <h3 className="text-xl font-bold text-brand-white tracking-tight">
                    {editingEvent ? 'Редактировать мероприятие' : 'Новое мероприятие'}
                  </h3>
                  <button onClick={handleCloseModal} className="text-zinc-400 hover:text-zinc-400 bg-zinc-800/50 p-1.5 rounded-full transition-colors">
                    <X size={20} />
                  </button>
                </div>
                {error && <div className="mb-5 p-3 bg-rose-900/20 text-sm text-rose-400 rounded-xl border border-rose-900/50">{error}</div>}
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-zinc-300 mb-1.5">Название</label>
                    <input type="text" required value={title} onChange={(e) => setTitle(e.target.value)} className="block w-full border border-zinc-800 bg-brand-black text-brand-white rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-brand-white focus:border-brand-white sm:text-sm transition-all" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-zinc-300 mb-1.5">Описание</label>
                    <textarea required value={description} onChange={(e) => setDescription(e.target.value)} rows={4} className="block w-full border border-zinc-800 bg-brand-black text-brand-white rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-brand-white focus:border-brand-white sm:text-sm transition-all resize-none" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-zinc-300 mb-1.5">Дата</label>
                    <input type="date" required value={date} onChange={(e) => setDate(e.target.value)} className="block w-full border border-zinc-800 bg-brand-black text-brand-white rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-brand-white focus:border-brand-white sm:text-sm transition-all" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-zinc-300 mb-2">Доступно для тарифов</label>
                    <div className="flex flex-wrap gap-3">
                      {['Moneycan', 'Lemoner', 'Richer'].map((t) => (
                        <label key={t} className="flex items-center cursor-pointer bg-brand-black px-3 py-2 rounded-lg border border-zinc-800 hover:bg-gray-200/50 transition-colors">
                          <input
                            type="checkbox"
                            checked={selectedTariffs.includes(t as Tariff)}
                            onChange={() => handleTariffToggle(t as Tariff)}
                            className="h-4 w-4 text-brand-white focus:ring-zinc-900 border-zinc-700 rounded cursor-pointer"
                          />
                          <span className="ml-2 text-sm font-medium text-zinc-300">{t}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  
                  <div className="mt-8 sm:flex sm:flex-row-reverse gap-3 pt-4 border-t border-zinc-800/50">
                    <button type="submit" className="w-full sm:w-auto inline-flex justify-center items-center rounded-xl border border-transparent px-6 py-2.5 bg-brand-white text-sm font-medium text-brand-black hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-zinc-900 transition-colors shadow-sm">
                      {editingEvent ? 'Сохранить' : 'Создать'}
                    </button>
                    <button type="button" onClick={handleCloseModal} className="mt-3 sm:mt-0 w-full sm:w-auto inline-flex justify-center items-center rounded-xl border border-zinc-800 px-6 py-2.5 bg-[#111] text-sm font-medium text-zinc-300 hover:bg-brand-black focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-zinc-900 transition-colors">
                      Отмена
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
