
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
    const activeStart = startOfDay(max([memStart, periodStart]));
    const activeEnd = startOfDay(min([memEnd, periodEnd]));

    if (activeStart > activeEnd) return 0;

    // Total potential days in the intersection
    const totalPotentialDays = differenceInCalendarDays(activeEnd, activeStart) + 1;
    
    // Calculate frozen days within this intersection
    let frozenDays = 0;
    freezes.forEach(freeze => {
      const fStart = parseLocalDate(freeze.start_date);
      const fEnd = parseLocalDate(freeze.end_date);
      if (!fStart || !fEnd) return;

      // Intersection of Freeze Period and Active Period
      const intersectStart = max([fStart, activeStart]);
      const intersectEnd = min([fEnd, activeEnd]);

      if (intersectStart <= intersectEnd) {
        frozenDays += differenceInCalendarDays(intersectEnd, intersectStart) + 1;
      }
    });

    const recognizedDays = Math.max(0, totalPotentialDays - frozenDays);
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

    const totalPotentialDays = differenceInCalendarDays(mEnd, mStart) + 1;
    
    let frozenDays = 0;
    freezes.forEach(freeze => {
      const fStart = parseLocalDate(freeze.start_date);
      const fEnd = parseLocalDate(freeze.end_date);
      if (!fStart || !fEnd) return;

      const intersectStart = max([fStart, mStart]);
      const intersectEnd = min([fEnd, mEnd]);

      if (intersectStart <= intersectEnd) {
        frozenDays += differenceInCalendarDays(intersectEnd, intersectStart) + 1;
      }
    });
    
    return Math.max(0, totalPotentialDays - frozenDays);
  }
};
