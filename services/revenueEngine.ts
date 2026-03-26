
// Fix: Consolidating and verifying named exports from date-fns
import { 
  differenceInCalendarDays, 
  addDays, 
  isWithinInterval, 
  endOfMonth, 
  eachDayOfInterval, 
  format,
  addMonths,
  startOfDay
} from 'date-fns';
import { Member, Freeze, MemberStatus } from '../types';

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
    // TENTATIVE memberships do not recognize revenue
    if (member.status === MemberStatus.TENTATIVE) return 0;

    const memStart = parseISO(member.start_date);
    const memEnd = parseISO(member.current_end_date);

    // Intersection of Membership Period and Requested Period
    // Ensure we use startOfDay for consistent comparison
    const activeStart = new Date(Math.max(startOfDay(memStart).getTime(), startOfDay(periodStart).getTime()));
    const activeEnd = new Date(Math.min(startOfDay(memEnd).getTime(), startOfDay(periodEnd).getTime()));

    if (activeStart > activeEnd) return 0;

    let recognizedDays = 0;
    try {
      const potentialDays = eachDayOfInterval({ start: startOfDay(activeStart), end: startOfDay(activeEnd) });
      
      potentialDays.forEach(day => {
        const dStr = format(day, 'yyyy-MM-dd');
        const isFrozen = freezes.some(freeze => {
          const fStart = parseISO(freeze.start_date);
          const fEnd = parseISO(freeze.end_date);
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
    if (!member.start_date || !member.current_end_date) return 0;
    
    const mStart = parseISO(member.start_date);
    const mEnd = parseISO(member.current_end_date);
    
    const potentialDays = eachDayOfInterval({ start: startOfDay(mStart), end: startOfDay(mEnd) });
    
    let activeDays = 0;
    potentialDays.forEach(day => {
      const dStr = format(day, 'yyyy-MM-dd');
      const isFrozen = freezes.some(freeze => {
        const fStart = parseISO(freeze.start_date);
        const fEnd = parseISO(freeze.end_date);
        const fsStr = format(fStart, 'yyyy-MM-dd');
        const feStr = format(fEnd, 'yyyy-MM-dd');
        return dStr >= fsStr && dStr <= feStr;
      });
      if (!isFrozen) activeDays++;
    });
    
    return activeDays;
  }
};
