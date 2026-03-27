import { differenceInCalendarDays, addMonths, addDays, startOfDay } from 'date-fns';

const safeParseDate = (dateStr) => {
  if (!dateStr) return null;
  if (dateStr.match(/^\d{4}-\d{2}-\d{2}/)) {
    try {
      const parts = dateStr.split('T')[0].split('-');
      const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
      if (!isNaN(d.getTime())) return startOfDay(d);
    } catch (e) {}
  }
  return new Date(dateStr);
};

const RevenueEngine = {
  calculateDailyRate: (netAmount, startDate, endDate) => {
    const totalDays = differenceInCalendarDays(endDate, startDate) + 1;
    if (totalDays <= 0) return 0;
    return Number((netAmount / totalDays).toFixed(4));
  },

  calculateOriginalEndDate: (startDate, durationMonths) => {
    const originalDay = startDate.getDate();
    const futureDate = addMonths(startDate, durationMonths);
    const futureDay = futureDate.getDate();

    if (originalDay > futureDay) {
        return futureDate;
    }
    return addDays(futureDate, -1);
  }
};

const start = safeParseDate("2026-03-01");
const end = RevenueEngine.calculateOriginalEndDate(start, 1);
const daily = RevenueEngine.calculateDailyRate(1000, start, end);

console.log({
  start: start.toISOString(),
  end: end.toISOString(),
  daily
});
