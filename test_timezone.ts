import { addMonths, addDays, differenceInCalendarDays, parseISO } from 'date-fns';

const calculateOriginalEndDate = (startDate: Date, durationMonths: number): Date => {
    const originalDay = startDate.getDate();
    const futureDate = addMonths(startDate, durationMonths);
    const futureDay = futureDate.getDate();

    if (originalDay > futureDay) {
        return futureDate;
    }

    return addDays(futureDate, -1);
};

const startDateStr = "2026-03-01";
const start = parseISO(startDateStr);
const end = calculateOriginalEndDate(start, 1);
const totalDays = differenceInCalendarDays(end, start) + 1;
const dailyRate = Number((1000 / totalDays).toFixed(4));

console.log("Start Date:", start.toString());
console.log("End Date:", end.toString());
console.log("Total Days:", totalDays);
console.log("Daily Rate:", dailyRate);
