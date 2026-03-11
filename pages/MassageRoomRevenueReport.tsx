import React, { useEffect, useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui';
import { db } from '../services/mockSupabase';
import { MassageBooking, MassageRoom } from '../types';
import { format, parseISO } from 'date-fns';
import { useSettings } from '../contexts/SettingsContext';

const MassageRoomRevenueReport = () => {
  const { currentOutlet } = useSettings();
  const [bookings, setBookings] = useState<MassageBooking[]>([]);
  const [rooms, setRooms] = useState<MassageRoom[]>([]);

  useEffect(() => {
    if (!currentOutlet) return;
    Promise.all([
      db.getMassageBookings(currentOutlet.id, false),
      db.getMassageRooms()
    ]).then(([bookings, rooms]) => {
      setBookings(bookings);
      setRooms(rooms);
    });
  }, [currentOutlet]);

  const reportData = useMemo(() => {
    const data: Record<string, Record<string, number>> = {}; // date -> room_id -> revenue

    bookings.forEach(booking => {
      if (booking.status !== 'completed') return;
      const date = format(parseISO(booking.date), 'yyyy-MM-dd');
      const roomId = booking.room_id || 'unassigned';
      
      if (!data[date]) data[date] = {};
      if (!data[date][roomId]) data[date][roomId] = 0;
      
      data[date][roomId] += booking.price;
    });

    return data;
  }, [bookings]);

  return (
    <Card className="p-6">
      <CardHeader>
        <CardTitle>Daily Revenue by Massage Room</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead>
              <tr>
                <th className="p-2">Date</th>
                {rooms.map(room => <th key={room.id} className="p-2">{room.name}</th>)}
                <th className="p-2">Unassigned</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(reportData).sort((a,b) => b[0].localeCompare(a[0])).map(([date, roomRevenue]) => (
                <tr key={date}>
                  <td className="p-2">{date}</td>
                  {rooms.map(room => (
                    <td key={room.id} className="p-2">{roomRevenue[room.id] || 0}</td>
                  ))}
                  <td className="p-2">{roomRevenue['unassigned'] || 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
};

export default MassageRoomRevenueReport;
