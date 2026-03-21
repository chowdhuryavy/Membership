import React, { useState, useEffect } from 'react';
import { X, Calendar, Trash2, Edit2, History, Users, AlertCircle } from 'lucide-react';
import { format, parseISO, differenceInCalendarDays } from 'date-fns';
import { useSettings } from '../contexts/SettingsContext';
import { db } from '../services/mockSupabase';
import { motion, AnimatePresence } from 'motion/react';

interface BulkFreezeBatch {
    batch_id: string;
    start_date: string;
    end_date: string;
    total_days: number;
    reason: string;
    member_count: number;
    created_at: string;
}

interface BulkFreezeHistoryModalProps {
    isOpen: boolean;
    onClose: () => void;
    onRefresh: () => void;
}

export const BulkFreezeHistoryModal: React.FC<BulkFreezeHistoryModalProps> = ({ isOpen, onClose, onRefresh }) => {
    const { formatMoney } = useSettings();
    const [history, setHistory] = useState<BulkFreezeBatch[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [editingBatch, setEditingBatch] = useState<BulkFreezeBatch | null>(null);
    const [isDeleting, setIsDeleting] = useState<string | null>(null);
    const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

    const fetchHistory = async () => {
        setIsLoading(true);
        try {
            const data = await db.getBulkFreezeHistory();
            setHistory(data.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()));
        } catch (error) {
            console.error('Failed to fetch bulk freeze history:', error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (isOpen) {
            fetchHistory();
        }
    }, [isOpen]);

    const handleDelete = async (batchId: string) => {
        setIsDeleting(batchId);
        try {
            await db.deleteBulkFreeze(batchId);
            setConfirmDelete(null);
            await fetchHistory();
            onRefresh();
        } catch (error) {
            console.error('Failed to delete bulk freeze:', error);
        } finally {
            setIsDeleting(null);
        }
    };

    const handleUpdate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingBatch) return;

        try {
            await db.updateBulkFreeze(editingBatch.batch_id, {
                start_date: editingBatch.start_date,
                end_date: editingBatch.end_date,
                total_days: editingBatch.total_days,
                reason: editingBatch.reason
            });
            setEditingBatch(null);
            await fetchHistory();
            onRefresh();
        } catch (error) {
            console.error('Failed to update bulk freeze:', error);
            alert('Failed to update bulk suspension.');
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div 
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                className="bg-white rounded-[32px] shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col"
            >
                {/* Header */}
                <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                    <div>
                        <div className="flex items-center gap-3 mb-1">
                            <div className="w-10 h-10 rounded-2xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-200">
                                <History className="w-5 h-5 text-white" />
                            </div>
                            <h2 className="text-2xl font-black text-slate-900 tracking-tight uppercase">Suspension History</h2>
                        </div>
                        <p className="text-slate-500 font-medium text-sm ml-13">Audit trail of global maintenance events</p>
                    </div>
                    <button 
                        onClick={onClose}
                        className="w-12 h-12 rounded-2xl hover:bg-white hover:shadow-xl transition-all flex items-center justify-center text-slate-400 hover:text-slate-900 group"
                    >
                        <X className="w-6 h-6 transition-transform group-hover:rotate-90" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-8">
                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center py-20 gap-4">
                            <div className="w-12 h-12 border-4 border-indigo-600/20 border-t-indigo-600 rounded-full animate-spin" />
                            <p className="text-slate-500 font-bold animate-pulse uppercase tracking-widest text-xs">Retrieving Audit Logs...</p>
                        </div>
                    ) : history.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 text-center">
                            <div className="w-20 h-20 rounded-[32px] bg-slate-50 flex items-center justify-center mb-6">
                                <History className="w-10 h-10 text-slate-300" />
                            </div>
                            <h3 className="text-xl font-black text-slate-900 mb-2 uppercase tracking-tight">No History Found</h3>
                            <p className="text-slate-500 max-w-xs font-medium">No global maintenance suspensions have been recorded yet.</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {history.map((batch) => (
                                <div key={batch.batch_id} className="group relative bg-white border-2 border-slate-100 rounded-[32px] p-6 transition-all hover:border-indigo-600/20 hover:shadow-xl hover:shadow-indigo-500/5">
                                    <div className="flex items-start justify-between gap-6">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-3 mb-4">
                                                <span className="px-3 py-1 bg-indigo-50 text-indigo-600 rounded-full text-[10px] font-black uppercase tracking-wider">
                                                    Maintenance Batch
                                                </span>
                                                <span className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">
                                                    {format(parseISO(batch.created_at), 'MMM dd, yyyy HH:mm')}
                                                </span>
                                            </div>

                                            <h4 className="text-lg font-black text-slate-900 mb-2 uppercase tracking-tight">
                                                {batch.reason || 'No Reason Provided'}
                                            </h4>

                                            <div className="grid grid-cols-3 gap-6">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center">
                                                        <Calendar className="w-5 h-5 text-slate-400" />
                                                    </div>
                                                    <div>
                                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Duration</p>
                                                        <p className="text-sm font-bold text-slate-700">
                                                            {format(parseISO(batch.start_date), 'dd MMM')} - {format(parseISO(batch.end_date), 'dd MMM yyyy')}
                                                        </p>
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center">
                                                        <History className="w-5 h-5 text-slate-400" />
                                                    </div>
                                                    <div>
                                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Total Days</p>
                                                        <p className="text-sm font-bold text-slate-700">{batch.total_days} Days Extension</p>
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center">
                                                        <Users className="w-5 h-5 text-slate-400" />
                                                    </div>
                                                    <div>
                                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Impact</p>
                                                        <p className="text-sm font-bold text-slate-700">{batch.member_count} Members Affected</p>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex flex-col gap-2">
                                            <button 
                                                onClick={() => setEditingBatch(batch)}
                                                className="w-10 h-10 rounded-xl bg-slate-50 text-slate-400 hover:bg-indigo-50 hover:text-indigo-600 transition-all flex items-center justify-center"
                                                title="Edit Batch"
                                            >
                                                <Edit2 className="w-4 h-4" />
                                            </button>
                                            <button 
                                                onClick={() => setConfirmDelete(batch.batch_id)}
                                                disabled={isDeleting === batch.batch_id}
                                                className="w-10 h-10 rounded-xl bg-slate-50 text-slate-400 hover:bg-red-50 hover:text-red-600 transition-all flex items-center justify-center disabled:opacity-50"
                                                title="Revoke Batch"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-8 bg-slate-50/50 border-t border-slate-100 flex justify-end">
                    <button 
                        onClick={onClose}
                        className="px-8 py-4 bg-white border-2 border-slate-200 rounded-2xl font-black text-sm uppercase tracking-widest text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-all"
                    >
                        Close History
                    </button>
                </div>

                {/* Confirm Delete Overlay */}
                <AnimatePresence>
                    {confirmDelete && (
                        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
                            <motion.div 
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.9 }}
                                className="bg-white rounded-[40px] shadow-2xl w-full max-w-md p-10 text-center"
                            >
                                <div className="w-20 h-20 bg-red-50 rounded-[32px] flex items-center justify-center mx-auto mb-6">
                                    <AlertCircle className="w-10 h-10 text-red-600" />
                                </div>
                                <h3 className="text-2xl font-black text-slate-900 mb-4 uppercase tracking-tight">Revoke Suspension?</h3>
                                <p className="text-slate-500 font-medium mb-8">
                                    This will remove the suspension for all affected members and recalculate their end dates. This action cannot be undone.
                                </p>
                                <div className="flex flex-col gap-3">
                                    <button 
                                        onClick={() => handleDelete(confirmDelete)}
                                        disabled={isDeleting !== null}
                                        className="w-full py-4 bg-red-600 text-white rounded-2xl font-black uppercase tracking-widest text-sm hover:bg-red-700 transition-all shadow-lg shadow-red-200 disabled:opacity-50"
                                    >
                                        {isDeleting ? 'Revoking...' : 'Yes, Revoke All'}
                                    </button>
                                    <button 
                                        onClick={() => setConfirmDelete(null)}
                                        className="w-full py-4 bg-slate-100 text-slate-600 rounded-2xl font-black uppercase tracking-widest text-sm hover:bg-slate-200 transition-all"
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </motion.div>
                        </div>
                    )}
                </AnimatePresence>
            </motion.div>

            {/* Edit Modal Overlay */}
            <AnimatePresence>
                {editingBatch && (
                    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/40 backdrop-blur-md">
                        <motion.div 
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                            className="bg-white rounded-[40px] shadow-2xl w-full max-w-lg p-10"
                        >
                            <h3 className="text-2xl font-black text-slate-900 mb-8 uppercase tracking-tight">Modify Batch Suspension</h3>
                            
                            <form onSubmit={handleUpdate} className="space-y-6">
                                <div className="grid grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Start Date</label>
                                        <input 
                                            type="date"
                                            value={editingBatch.start_date}
                                            onChange={(e) => {
                                                const start = e.target.value;
                                                const days = differenceInCalendarDays(parseISO(editingBatch.end_date), parseISO(start)) + 1;
                                                setEditingBatch({ ...editingBatch, start_date: start, total_days: days > 0 ? days : 0 });
                                            }}
                                            className="w-full px-6 py-4 rounded-2xl border-2 border-slate-100 focus:border-indigo-600 focus:ring-0 font-bold text-sm"
                                            required
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">End Date</label>
                                        <input 
                                            type="date"
                                            value={editingBatch.end_date}
                                            onChange={(e) => {
                                                const end = e.target.value;
                                                const days = differenceInCalendarDays(parseISO(end), parseISO(editingBatch.start_date)) + 1;
                                                setEditingBatch({ ...editingBatch, end_date: end, total_days: days > 0 ? days : 0 });
                                            }}
                                            className="w-full px-6 py-4 rounded-2xl border-2 border-slate-100 focus:border-indigo-600 focus:ring-0 font-bold text-sm"
                                            required
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Reason / Note</label>
                                    <textarea 
                                        value={editingBatch.reason}
                                        onChange={(e) => setEditingBatch({ ...editingBatch, reason: e.target.value })}
                                        className="w-full px-6 py-4 rounded-2xl border-2 border-slate-100 focus:border-indigo-600 focus:ring-0 font-bold text-sm h-32 resize-none"
                                        placeholder="Enter reason for modification..."
                                        required
                                    />
                                </div>

                                <div className="flex items-center gap-4 pt-4">
                                    <button 
                                        type="button"
                                        onClick={() => setEditingBatch(null)}
                                        className="flex-1 py-4 bg-slate-50 rounded-2xl font-black text-sm uppercase tracking-widest text-slate-400 hover:bg-slate-100 transition-all"
                                    >
                                        Cancel
                                    </button>
                                    <button 
                                        type="submit"
                                        className="flex-1 py-4 bg-indigo-600 rounded-2xl font-black text-sm uppercase tracking-widest text-white shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-all"
                                    >
                                        Save Changes
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
};
