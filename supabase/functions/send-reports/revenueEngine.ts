
// Fix: Consolidating and verifying named exports from date-fns
import { 
  differenceInCalendarDays, 
  addDays, 
  isWithinInterval, 
  endOfMonth, 
  eachDayOfInterval, 
  format,
  addMonths,
  startOfDay,
  parseISO
} from 'npm:date-fns';
import { Member, Freeze, MemberStatus } from './types.ts';

const startOfMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth(), 1);
const min = (dates: Date[]) => new Date(Math.min(...dates.map(d => d.getTime())));
const max = (dates: Date[]) => new Date(Math.max(...dates.map(d => d.getTime())));

/**
 * Robust date parsing that treats YYYY-MM-DD as local time start-of-day.
 * This avoids the common issue where parseISO("2023-10-01") returns 
 * 2023-10-01 00:00:00 UTC, which might be the previous day in local time.
 */
const parseLocalDate = (dateStr: string | null | undefined): Date | null => {
  if (!dateStr) return null;
  try {
    // Handle ISO strings with T
    const cleanStr = dateStr.split('T')[0];
    const parts = cleanStr.split('-');
    if (parts.length !== 3) return null;
    
    const y = parseInt(parts[0]);
    const m = parseInt(parts[1]) - 1;
    const d = parseInt(parts[2]);
    
    const date = new Date(y, m, d);
    return isNaN(date.getTime()) ? null : startOfDay(date);
  } catch (e) {
    return null;
  }
};

export const RevenueEngine = {
  calculateDailyRate: (netAmount: number, startDate: Date, endDate: Date): number => {
    const totalDays = Math.max(1, differenceInCalendarDays(endDate, startDate) + 1);
    if (totalDays <= 0) return 0;
    return Number((netAmount / totalDays).toFixed(4));
  },

  calculateOriginalEndDate: (startDate: Date, durationMonths: number): Date => {
    const originalDay = startDate.getDate();
    
    const futureDate = addMonths(startDate, durationMonths);
    const futureDay = futureDate.getDate();

    // If date-fns clamped the date to the end of a shorter month
    // e.g., Jan 31st + 1 month becomes Feb 28th. (31 > 28)
    // The membership should end on the last day of that future month.
    if (originalDay > futureDay) {
        return futureDate;
    }

    // Otherwise, it's a normal month transition, so subtract one day for an inclusive period.
    // e.g., Jan 15th + 1 month becomes Feb 15th. We subtract one day to make the end date Feb 14th.
    return addDays(futureDate, -1);
  },

  checkFreezeOverlap: (newStart: Date, newEnd: Date, existingFreezes: Freeze[]): boolean => {
    return existingFreezes.some(f => {
      const fStart = parseLocalDate(f.start_date);
      const fEnd = parseLocalDate(f.end_date);
      if (!fStart || !fEnd) return false;
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
    // TENTATIVE memberships do not recognize revenue
    if (member.status === MemberStatus.TENTATIVE) return 0;

    const memStart = parseLocalDate(member.start_date);
    const memEnd = parseLocalDate(member.current_end_date);

    if (!memStart || !memEnd) return 0;

    // Intersection of Membership Period and Requested Period
    // Ensure we use startOfDay for consistent comparison
    const activeStart = startOfDay(max([memStart, periodStart]));
    const activeEnd = startOfDay(min([memEnd, periodEnd]));

    if (activeStart > activeEnd) return 0;

    let recognizedDays = 0;
    try {
      // We include the membership end date in the count (inclusive end date)
      const potentialDays = eachDayOfInterval({ 
        start: activeStart, 
        end: activeEnd 
      });
      
      potentialDays.forEach(day => {
        const dStr = format(day, 'yyyy-MM-dd');
        const isFrozen = freezes.some(freeze => {
          const fStart = parseLocalDate(freeze.start_date);
          const fEnd = parseLocalDate(freeze.end_date);
          if (!fStart || !fEnd) return false;
          const fsStr = format(fStart, 'yyyy-MM-dd');
          const feStr = format(fEnd, 'yyyy-MM-dd');
          return dStr >= fsStr && dStr <= feStr;
        });
        if (!isFrozen) recognizedDays++;
      });
    } catch (e) {
      console.error("Error in calculateRevenuePeriod:", e);
    }

    return recognizedDays * (member.daily_rate || 0);
  },

  /**
   * Calculates total active days for a membership, excluding freezes.
   */
  calculateTotalActiveDays: (
    member: Member,
    freezes: Freeze[]
  ): number => {
    const mStart = parseLocalDate(member.start_date);
    const mEnd = parseLocalDate(member.current_end_date);
    
    if (!mStart || !mEnd) return 0;
    if (mStart > mEnd) return 0;

    const potentialDays = eachDayOfInterval({ 
      start: mStart, 
      end: mEnd 
    });
    
    let activeDays = 0;
    potentialDays.forEach(day => {
      const dStr = format(day, 'yyyy-MM-dd');
      const isFrozen = freezes.some(freeze => {
        const fStart = parseLocalDate(freeze.start_date);
        const fEnd = parseLocalDate(freeze.end_date);
        if (!fStart || !fEnd) return false;
        const fsStr = format(fStart, 'yyyy-MM-dd');
        const feStr = format(fEnd, 'yyyy-MM-dd');
        return dStr >= fsStr && dStr <= feStr;
      });
      if (!isFrozen) activeDays++;
    });
    
    return activeDays;
  }
};
