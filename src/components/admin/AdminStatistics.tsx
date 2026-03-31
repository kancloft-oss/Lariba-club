import React, { useState, useEffect, useMemo } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../../firebase';
import { UserProfile } from '../../contexts/AuthContext';
import { Download, Users, DollarSign, RefreshCw, Calendar } from 'lucide-react';
import * as XLSX from 'xlsx';

export default function AdminStatistics() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [dateRange, setDateRange] = useState<'month' | 'half-year' | 'year' | 'all'>('all');

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'users'), (snapshot) => {
      const usersData = snapshot.docs.map(doc => doc.data() as UserProfile);
      setUsers(usersData.filter(u => u.role === 'resident'));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'users');
    });

    return unsubscribe;
  }, []);

  const filteredUsers = useMemo(() => {
    const now = new Date();
    let startDate = new Date(0);
    if (dateRange === 'month') startDate.setMonth(now.getMonth() - 1);
    else if (dateRange === 'half-year') startDate.setMonth(now.getMonth() - 6);
    else if (dateRange === 'year') startDate.setFullYear(now.getFullYear() - 1);
    
    return users.filter(user => new Date(user.createdAt) >= startDate);
  }, [users, dateRange]);

  const stats = useMemo(() => {
    const totalResidents = filteredUsers.length;
    const tariffCounts = filteredUsers.reduce((acc, user) => {
      acc[user.tariff] = (acc[user.tariff] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    const paidResidents = filteredUsers.filter(u => u.paymentStatus === 'paid').length;
    const unpaidResidents = filteredUsers.filter(u => u.paymentStatus === 'unpaid').length;
    const upcomingPayments = filteredUsers.filter(u => u.paymentDueDate && new Date(u.paymentDueDate) <= new Date(Date.now() + 7 * 24 * 60 * 60 * 1000));

    return { totalResidents, tariffCounts, paidResidents, unpaidResidents, upcomingPayments };
  }, [filteredUsers]);

  const exportToExcel = () => {
    const ws = XLSX.utils.json_to_sheet(filteredUsers);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Residents');
    XLSX.writeFile(wb, 'residents_statistics.xlsx');
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-zinc-900">Статистика</h2>
        <div className="flex gap-2">
          <select value={dateRange} onChange={(e) => setDateRange(e.target.value as any)} className="border border-zinc-200 rounded-xl px-4 py-2 bg-white">
            <option value="all">Все время</option>
            <option value="month">Месяц</option>
            <option value="half-year">Полгода</option>
            <option value="year">Год</option>
          </select>
          <button onClick={exportToExcel} className="bg-zinc-900 text-white px-4 py-2 rounded-xl flex items-center gap-2 hover:bg-zinc-800">
            <Download size={18} />
            Экспорт в Excel
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-zinc-200">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-zinc-100 rounded-full text-zinc-900"><Users size={24} /></div>
            <div>
              <p className="text-sm text-zinc-500">Всего резидентов</p>
              <p className="text-2xl font-bold">{stats.totalResidents}</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-zinc-200">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-emerald-100 rounded-full text-emerald-700"><DollarSign size={24} /></div>
            <div>
              <p className="text-sm text-zinc-500">Оплачено</p>
              <p className="text-2xl font-bold">{stats.paidResidents}</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-zinc-200">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-rose-100 rounded-full text-rose-700"><RefreshCw size={24} /></div>
            <div>
              <p className="text-sm text-zinc-500">Не оплачено</p>
              <p className="text-2xl font-bold">{stats.unpaidResidents}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-zinc-200">
          <h3 className="text-lg font-bold mb-4">Резиденты по тарифам</h3>
          <div className="grid grid-cols-2 gap-4">
            {Object.entries(stats.tariffCounts).map(([tariff, count]) => (
              <div key={tariff} className="bg-zinc-50 p-4 rounded-xl">
                <p className="text-sm text-zinc-500">{tariff}</p>
                <p className="text-xl font-bold">{count}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-zinc-200">
          <h3 className="text-lg font-bold mb-4">Скоро заканчивается оплата</h3>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {stats.upcomingPayments.map(user => (
              <div key={user.uid} className="flex justify-between items-center p-3 bg-zinc-50 rounded-xl">
                <p className="text-sm font-medium">{user.name}</p>
                <p className="text-sm text-zinc-500">{user.paymentDueDate}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
