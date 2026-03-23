import React, { useState, useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardContent, Button } from './ui';
import { X, Snowflake, Calendar, AlertCircle, CheckCircle2, Users, Search } from 'lucide-react';
import { Member } from '../types';
import { format, differenceInCalendarDays, parse, addDays, startOfDay } from 'date-fns';
import { db } from '../services/mockSupabase';
import toast from 'react-hot-toast';

const parseISO = (dateString: string) => {
  if (!dateString) return new Date();
  
  // Try standard YYYY-MM-DD
  let d = new Date(dateString);
  if (!isNaN(d.getTime())) return d;
  
  // Try DD-MM-YYYY, DD.MM.YYYY, DD/MM/YYYY
  const cleanDate = dateString.replace(/[\.\/]/g, '-');
  try {
    // Try to parse as DD-MM-YYYY
    const parts = cleanDate.split('-');
    if (parts.length === 3) {
      const day = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      let year = parseInt(parts[2], 10);
      if (year < 100) year += 2000; // Handle 2-digit years
      const parsed = new Date(year, month, day);
      if (!isNaN(parsed.getTime())) return parsed;
    }
  } catch (e) {}

  return new Date();
};

interface BulkFreezeModalProps {
  isOpen: boolean;
  onClose: () => void;
  members: Member[];
  onSuccess: () => void;
}

export const BulkFreezeModal: React.FC<BulkFreezeModalProps> = ({ isOpen, onClose, members, onSuccess }) => {
  const [step, setStep] = useState<'selection' | 'config'>('selection');
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [freezeForm, setFreezeForm] = useState({
    start_date: format(new Date(), 'yyyy-MM-dd'),
    end_date: '',
    reason: ''
  });
  const [isLoading, setIsLoading] = useState(false);

  const filteredMembers = useMemo(() => {
    return members.filter(m => {
      const matchesSearch = m.guest_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            m.membership_number.toLowerCase().includes(searchTerm.toLowerCase());
      
      let isEligible = true;
      if (freezeForm.start_date && freezeForm.end_date && m.current_end_date) {
        const freezeStart = startOfDay(parseISO(freezeForm.start_date));
        const freezeEnd = startOfDay(parseISO(freezeForm.end_date));
        const memberStart = startOfDay(parseISO(m.start_date));
        const memberEnd = startOfDay(parseISO(m.current_end_date));

        // Only include if the membership period overlaps with the freeze period
        const startsAfterFreeze = memberStart > freezeEnd;
        const endsBeforeFreeze = memberEnd < freezeStart;

        if (startsAfterFreeze || endsBeforeFreeze) {
          isEligible = false;
        }
      }

      return matchesSearch && isEligible;
    });
  }, [members, searchTerm, freezeForm.start_date, freezeForm.end_date]);

  const toggleMember = (id: string) => {
    setSelectedMemberIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const selectAll = () => {
    if (selectedMemberIds.length === filteredMembers.length) {
      setSelectedMemberIds([]);
    } else {
      setSelectedMemberIds(filteredMembers.map(m => m.id));
    }
  };

  const totalDays = useMemo(() => {
    if (!freezeForm.start_date || !freezeForm.end_date) return 0;
    const start = parseISO(freezeForm.start_date);
    const end = parseISO(freezeForm.end_date);
    return Math.max(0, differenceInCalendarDays(end, start) + 1);
  }, [freezeForm.start_date, freezeForm.end_date]);

  const handleBulkFreeze = async () => {
    if (selectedMemberIds.length === 0 || totalDays <= 0 || !freezeForm.reason) {
      toast.error("Please select members, valid dates, and provide a reason.");
      return;
    }

    const freezeStart = startOfDay(parseISO(freezeForm.start_date));
    const freezeEnd = startOfDay(parseISO(freezeForm.end_date));
    
    const eligibleSelectedIds = selectedMemberIds.filter(id => {
      const member = members.find(m => m.id === id);
      if (!member || !member.current_end_date) return false;
      
      const memberStart = startOfDay(parseISO(member.start_date));
      const memberEnd = startOfDay(parseISO(member.current_end_date));
      
      const startsAfterFreeze = memberStart > freezeEnd;
      const endsBeforeFreeze = memberEnd < freezeStart;
      
      return !startsAfterFreeze && !endsBeforeFreeze;
    });

    if (eligibleSelectedIds.length === 0) {
      toast.error("None of the selected members are eligible for this freeze period (already expired).");
      return;
    }

    if (eligibleSelectedIds.length < selectedMemberIds.length) {
      toast.error(`${selectedMemberIds.length - eligibleSelectedIds.length} members were excluded because their membership expires before the freeze start date.`, { duration: 5000 });
    }

    setIsLoading(true);
    try {
      await db.bulkFreezeMembers(
        eligibleSelectedIds,
        freezeForm.start_date,
        freezeForm.end_date,
        totalDays,
        freezeForm.reason
      );
      toast.success(`Successfully applied maintenance freeze to ${eligibleSelectedIds.length} members.`);
      onSuccess();
      onClose();
    } catch (error) {
      console.error("Bulk freeze failed:", error);
      toast.error("Bulk freeze operation failed.");
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[500] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300">
      <Card className="w-full max-w-2xl rounded-[3rem] shadow-[0_50px_100px_-20px_rgba(0,0,0,0.4)] overflow-hidden bg-white border border-white/20 flex flex-col max-h-[90vh]">
        <CardHeader className="bg-[#0f172a] text-white p-8 relative flex flex-col items-center text-center shrink-0">
          <div className="w-12 h-12 bg-indigo-500/20 rounded-2xl flex items-center justify-center mb-4 border border-indigo-500/30">
            <Snowflake className="w-6 h-6 text-indigo-400" />
          </div>
          <CardTitle className="text-xl font-black uppercase tracking-tight leading-none mb-1">Bulk Maintenance Freeze</CardTitle>
          <p className="text-[9px] font-black text-indigo-400 uppercase tracking-widest">Global Portfolio Suspension Protocol</p>
          <button onClick={onClose} className="absolute top-6 right-6 p-2 rounded-full bg-white/5 hover:bg-white/10 transition-all active:scale-90 shadow-lg border border-white/5">
            <X className="w-4 h-4 text-slate-400"/>
          </button>
        </CardHeader>

        <CardContent className="p-0 flex-1 overflow-hidden flex flex-col">
          <div className="flex border-b border-slate-100 shrink-0">
            <button 
              onClick={() => setStep('selection')}
              className={`flex-1 py-4 text-[10px] font-black uppercase tracking-widest transition-all ${step === 'selection' ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50/30' : 'text-slate-400 hover:text-slate-600'}`}
            >
              1. Member Selection ({selectedMemberIds.length})
            </button>
            <button 
              onClick={() => selectedMemberIds.length > 0 && setStep('config')}
              disabled={selectedMemberIds.length === 0}
              className={`flex-1 py-4 text-[10px] font-black uppercase tracking-widest transition-all ${step === 'config' ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50/30' : selectedMemberIds.length === 0 ? 'text-slate-200 cursor-not-allowed' : 'text-slate-400 hover:text-slate-600'}`}
            >
              2. Freeze Configuration
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
            {step === 'selection' ? (
              <div className="space-y-6">
                <div className="flex items-center gap-4">
                  <div className="relative flex-1">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input 
                      placeholder="Search members..." 
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full h-12 pl-12 pr-4 rounded-xl bg-slate-50 border border-slate-100 focus:border-indigo-500 focus:bg-white transition-all text-xs font-bold"
                    />
                  </div>
                  <Button 
                    variant="outline" 
                    onClick={selectAll}
                    className="h-12 px-6 rounded-xl text-[10px] font-black uppercase tracking-widest border-slate-200 text-slate-600 hover:bg-slate-50"
                  >
                    {selectedMemberIds.length === filteredMembers.length ? 'Deselect All' : 'Select All'}
                  </Button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {filteredMembers.map(member => (
                    <div 
                      key={member.id}
                      onClick={() => toggleMember(member.id)}
                      className={`p-4 rounded-2xl border-2 cursor-pointer transition-all flex items-center gap-4 ${selectedMemberIds.includes(member.id) ? 'border-indigo-600 bg-indigo-50/50 shadow-md' : 'border-slate-100 bg-white hover:border-indigo-200'}`}
                    >
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-xs ${selectedMemberIds.includes(member.id) ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-400'}`}>
                        {selectedMemberIds.includes(member.id) ? <CheckCircle2 className="w-5 h-5" /> : member.guest_name.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] font-black text-slate-900 uppercase truncate">{member.guest_name}</p>
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">{member.membership_number}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[11px] font-bold text-slate-600 ml-1">Commencement Date</label>
                    <div className="relative group">
                      <input 
                        type="date" 
                        value={freezeForm.start_date} 
                        onChange={e => setFreezeForm({...freezeForm, start_date: e.target.value})} 
                        className="w-full h-16 pl-6 pr-14 rounded-2xl border-2 border-slate-100 focus:border-indigo-600 bg-white font-black text-sm uppercase tracking-wider transition-all appearance-none cursor-pointer"
                      />
                      <Calendar className="absolute right-6 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[11px] font-bold text-slate-600 ml-1">Termination Date</label>
                    <div className="relative group">
                      <input 
                        type="date" 
                        value={freezeForm.end_date} 
                        onChange={e => setFreezeForm({...freezeForm, end_date: e.target.value})} 
                        className="w-full h-16 pl-6 pr-14 rounded-2xl border-2 border-slate-100 focus:border-indigo-600 bg-white font-black text-sm uppercase tracking-wider transition-all appearance-none cursor-pointer"
                      />
                      <Calendar className="absolute right-6 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[11px] font-bold text-slate-600 ml-1">Reason / Note (Required)</label>
                  <textarea 
                    value={freezeForm.reason} 
                    onChange={e => setFreezeForm({...freezeForm, reason: e.target.value})} 
                    placeholder="Enter reason for bulk suspension (e.g. Facility Maintenance, Public Holiday)..."
                    className="w-full h-32 p-6 rounded-2xl border-2 border-slate-100 focus:border-indigo-600 bg-white font-bold text-xs transition-all resize-none"
                  />
                </div>

                <div className="bg-indigo-50 p-6 rounded-2xl border border-indigo-100 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-white shadow-sm flex items-center justify-center text-indigo-600">
                      <Users className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest leading-none mb-1">Impact Analysis</p>
                      <p className="text-sm font-black text-indigo-900">{selectedMemberIds.length} Portfolios Affected</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest leading-none mb-1">Extension Span</p>
                    <p className="text-sm font-black text-indigo-900">+{totalDays} Days</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="p-8 bg-slate-50 border-t border-slate-100 shrink-0">
            {step === 'selection' ? (
              <Button 
                onClick={() => setStep('config')}
                disabled={selectedMemberIds.length === 0}
                className="w-full h-16 rounded-[1.8rem] font-black uppercase text-xs tracking-[0.2em] shadow-xl active:scale-95 transition-all bg-indigo-600 hover:bg-indigo-700 text-white"
              >
                Proceed to Configuration
              </Button>
            ) : (
              <div className="flex gap-4">
                <Button 
                  variant="outline"
                  onClick={() => setStep('selection')}
                  className="flex-1 h-16 rounded-[1.8rem] font-black uppercase text-xs tracking-[0.2em] border-slate-200 text-slate-600"
                >
                  Back to Selection
                </Button>
                <Button 
                  onClick={handleBulkFreeze}
                  isLoading={isLoading}
                  disabled={totalDays <= 0 || !freezeForm.reason || isLoading}
                  className="flex-[2] h-16 rounded-[1.8rem] font-black uppercase text-xs tracking-[0.2em] shadow-xl active:scale-95 transition-all bg-indigo-600 hover:bg-indigo-700 text-white"
                >
                  Commit Bulk Protocol
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
