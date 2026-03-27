import { differenceInCalendarDays, addMonths, addDays } from 'date-fns';

const startDate = new Date(2026, 2, 1); // March 1, 2026
const durationMonths = 1;

const futureDate = addMonths(startDate, durationMonths);
const originalDay = startDate.getDate();
const futureDay = futureDate.getDate();

let endDate;
if (originalDay > futureDay) {
    endDate = futureDate;
} else {
    endDate = addDays(futureDate, -1);
}

const totalDays = differenceInCalendarDays(endDate, startDate) + 1;
const dailyRate = 1000 / totalDays;

console.log({
    startDate: startDate.toISOString(),
    futureDate: futureDate.toISOString(),
    endDate: endDate.toISOString(),
    totalDays,
    dailyRate
});
