
// Fix: Consolidating and verifying named exports from date-fns
import { 
  differenceInCalendarDays, 
  addDays, 
  isWithinInterval, 
  endOfMonth, 
  eachDayOfInterval, 
  format,
  addMonths
} from 'date-fns';
import { Member, Freeze } from '../types';

// Fix: Local implementations for missing date-fns members to resolve environment-specific import errors
const parseISO = (dateString: string) => new Date(dateString);
const startOfMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth(), 1);
const min = (dates: Date[]) => new Date(Math.min(...dates.map(d => d.getTime())));
const max = (dates: Date[]) => new Date(Math.max(...dates.map(d => d.getTime())));

export const RevenueEngine = {
  calculateDailyRate: (netAmount: number, startDate: Date, endDate: Date): number => {
    const totalDays = differenceInCalendarDays(endDate, startDate) + 1;
    if (totalDays <= 0) return 0;
    return Number((netAmount / totalDays).toFixed(4));
  },

  calculateOriginalEndDate: (startDate: Date, durationMonths: number): Date => {
    return addDays(addMonths(startDate, durationMonths), -1);
  },

  checkFreezeOverlap: (newStart: Date, newEnd: Date, existingFreezes: Freeze[]): boolean => {
    return existingFreezes.some(f => {
      const fStart = parseISO(f.start_date);
      const fEnd = parseISO(f.end_date);
      return (
        isWithinInterval(newStart, { start: fStart, end: fEnd }) ||
        isWithinInterval(newEnd, { start: fStart, end: fEnd }) ||
        isWithinInterval(fStart, { start: newStart, end: newEnd })
      );
    });
  },

  /**
   * Calculates revenue earned strictly within a date range (inclusive).
   */
  calculateRevenuePeriod: (
    member: Member, 
    freezes: Freeze[], 
    periodStart: Date,
    periodEnd: Date
  ): number => {
    const memStart = parseISO(member.start_date);
    const memEnd = parseISO(member.current_end_date);

    // Intersection of Membership Period and Requested Period
    const activeStart = max([memStart, periodStart]);
    const activeEnd = min([memEnd, periodEnd]);

    if (activeStart > activeEnd) return 0;

    const potentialDays = eachDayOfInterval({ start: activeStart, end: activeEnd });
    
    let recognizedDays = 0;
    potentialDays.forEach(day => {
      const isFrozen = freezes.some(freeze => 
        isWithinInterval(day, { 
          start: parseISO(freeze.start_date), 
          end: parseISO(freeze.end_date) 
        })
      );
      if (!isFrozen) recognizedDays++;
    });

    return recognizedDays * member.daily_rate;
  }
};
