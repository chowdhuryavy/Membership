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

const safeParseDate = (dateString: string): Date => {
    if (!dateString) return new Date();
    try {
        const parts = dateString.split('-');
        if (parts.length === 3) {
            return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
        }
        return parseISO(dateString);
    } catch (e) {
        return new Date();
    }
};

const startDate = safeParseDate("2026-03-01");
const endDate = calculateOriginalEndDate(startDate, 1);
const totalDays = differenceInCalendarDays(endDate, startDate) + 1;
const dailyRate = Number((1000 / totalDays).toFixed(4));

console.log("Start Date:", startDate);
console.log("End Date:", endDate);
console.log("Total Days:", totalDays);
console.log("Daily Rate:", dailyRate);
