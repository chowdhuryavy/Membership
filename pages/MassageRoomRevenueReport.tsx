import React, { useEffect, useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui';
import { db } from '../services/mockSupabase';
import { MassageBooking, MassageRoom } from '../types';
import { format, parseISO, startOfMonth, endOfMonth, isWithinInterval } from 'date-fns';
import { useSettings } from '../contexts/SettingsContext';
import { Building2 } from 'lucide-react';

import TabLoader from '../components/TabLoader';

interface MassageRoomRevenueReportProps {
  isEmbedded?: boolean;
  embeddedMonth?: string;
}

const MassageRoomRevenueReport = ({ isEmbedded, embeddedMonth }: MassageRoomRevenueReportProps) => {
  const { currentOutlet } = useSettings();
  const [bookings, setBookings] = useState<MassageBooking[]>([]);
  const [rooms, setRooms] = useState<MassageRoom[]>([]);
  const [reportMonth, setReportMonth] = useState(embeddedMonth || format(new Date(), 'yyyy-MM'));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (embeddedMonth) {
      setReportMonth(embeddedMonth);
    }
  }, [embeddedMonth]);

  useEffect(() => {
    if (!currentOutlet) return;
    setLoading(true);
    // Explicit artificial delay for smoother branding transition
    const dataPromise = Promise.all([
      db.getMassageBookings(currentOutlet.id, false),
      db.getMassageRooms(currentOutlet.id)
    ]);

    setTimeout(() => {
      dataPromise.then(([bookingsData, roomsData]) => {
        setBookings(bookingsData);
        setRooms(roomsData);
        setLoading(false);
      }).catch(() => setLoading(false));
    }, 600);
  }, [currentOutlet]);

  const reportData = useMemo(() => {
    const data: Record<string, Record<string, number>> = {}; // date -> room_id -> revenue
    
    const [year, month] = reportMonth.split('-').map(Number);
    const start = startOfMonth(new Date(year, month - 1));
    const end = endOfMonth(new Date(year, month - 1));

    bookings.forEach(booking => {
      if (booking.status !== 'completed') return;
      
      const bookingDate = parseISO(booking.date);
      if (!isWithinInterval(bookingDate, { start, end })) return;

      const dateStr = format(bookingDate, 'yyyy-MM-dd');
      const roomId = booking.room_id || 'unassigned';
      
      if (!data[dateStr]) data[dateStr] = {};
      if (!data[dateStr][roomId]) data[dateStr][roomId] = 0;
      
      data[dateStr][roomId] += booking.price;
    });

    return data;
  }, [bookings, reportMonth]);

  const sortedDates = useMemo(() => {
    return Object.keys(reportData).sort((a, b) => a.localeCompare(b));
  }, [reportData]);

  const totalsByRoom = useMemo(() => {
    const totals: Record<string, number> = {};
    rooms.forEach(room => totals[room.id] = 0);
    totals['unassigned'] = 0;

    Object.values(reportData).forEach(roomRevenue => {
      Object.entries(roomRevenue).forEach(([roomId, revenue]) => {
        totals[roomId] = (totals[roomId] || 0) + revenue;
      });
    });

    return totals;
  }, [reportData, rooms]);

  const grandTotal = useMemo(() => {
    return Object.values(totalsByRoom).reduce((sum: number, val: number) => sum + val, 0);
  }, [totalsByRoom]);

  const content = (
    <div className={`overflow-x-auto transition-opacity duration-300 ${loading ? 'opacity-50 pointer-events-none' : 'opacity-100'}`}>
      <table className={`w-full text-left border-collapse border-2 border-black ${isEmbedded ? 'text-[9px]' : 'text-sm'}`}>
        <thead>
          <tr className="bg-slate-950 text-white font-black uppercase tracking-widest">
            <th className="px-4 py-4 border border-black">Date</th>
            {rooms.map(room => (
              <th key={room.id} className="px-4 py-4 border border-black text-right">{room.name}</th>
            ))}
            <th className="px-4 py-4 border border-black text-right">Unassigned</th>
            <th className="px-4 py-4 border border-black text-right">Daily Total</th>
          </tr>
        </thead>
        <tbody>
          {sortedDates.length === 0 ? (
            <tr>
              <td colSpan={rooms.length + 3} className="px-6 py-12 text-center text-slate-400 font-medium border border-black italic">
                No revenue data found for this period.
              </td>
            </tr>
          ) : (
            sortedDates.map(date => {
              const roomRevenue = reportData[date];
              const dailyTotal = Object.values(roomRevenue).reduce((sum: number, val: number) => sum + val, 0);
              return (
                <tr key={date} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 border border-black font-black text-slate-600">{format(parseISO(date), 'dd MMM yyyy')}</td>
                  {rooms.map(room => (
                    <td key={room.id} className="px-4 py-3 border border-black text-right font-bold text-slate-700">
                      {roomRevenue[room.id] ? roomRevenue[room.id].toLocaleString() : '-'}
                    </td>
                  ))}
                  <td className="px-4 py-3 border border-black text-right font-bold text-slate-400">
                    {roomRevenue['unassigned'] ? roomRevenue['unassigned'].toLocaleString() : '-'}
                  </td>
                  <td className="px-4 py-3 border border-black text-right font-black text-indigo-600 bg-indigo-50/30">
                    {dailyTotal.toLocaleString()}
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
        {sortedDates.length > 0 && (
          <tfoot>
            <tr className="bg-slate-100 font-black">
              <td className="px-4 py-4 border border-black uppercase tracking-widest">Aggregate Totals</td>
              {rooms.map(room => (
                <td key={room.id} className="px-4 py-4 border border-black text-right text-slate-900">
                  {totalsByRoom[room.id].toLocaleString()}
                </td>
              ))}
              <td className="px-4 py-4 border border-black text-right text-slate-500">
                {totalsByRoom['unassigned'].toLocaleString()}
              </td>
              <td className="px-4 py-4 border border-black text-right text-indigo-700 text-base">
                {grandTotal.toLocaleString()}
              </td>
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );

  if (isEmbedded) {
    return content;
  }

  return (
    <div className="space-y-8 pb-20 animate-in fade-in duration-700">
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6 bg-white p-8 rounded-[2.5rem] border border-slate-200/60 shadow-xl no-print">
        <div className="flex items-center gap-6">
          <div className="w-14 h-14 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-2xl shadow-indigo-100">
            <Building2 className="w-7 h-7" />
          </div>
          <div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tighter uppercase leading-none">Massage Room Revenue</h1>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em] mt-2">Daily Revenue Audit by Room</p>
          </div>
        </div>
        <div className="flex items-center gap-3 bg-white border border-slate-200 px-5 py-3 rounded-2xl shadow-sm">
          <input 
            type="month" 
            value={reportMonth} 
            onChange={e => setReportMonth(e.target.value)} 
            className="text-[11px] font-black uppercase bg-transparent outline-none cursor-pointer text-slate-700" 
          />
        </div>
      </div>

      <Card className="rounded-[2.5rem] border-slate-200/60 shadow-2xl overflow-hidden bg-white relative">
        {loading && (
          <div className="absolute inset-0 z-[10] flex items-center justify-center bg-white/60 backdrop-blur-[2px] no-print">
            <TabLoader message="Synchronizing Spa Revenue Ledger..." />
          </div>
        )}
        <CardHeader className="bg-slate-950 text-white p-8 border-b border-slate-800 flex flex-row items-center justify-between no-print">
          <CardTitle className="text-[10px] font-black uppercase tracking-[0.3em]">
            Revenue Ledger for {format(new Date(reportMonth + '-01'), 'MMMM yyyy')}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-8">
          {content}
        </CardContent>
      </Card>
    </div>
  );
};

// Add Building2 icon import

export default MassageRoomRevenueReport;
