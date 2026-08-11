export const fmt = n => Number(n || 0).toLocaleString('en-TZ');
export const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
export const now = new Date();
export const currentMonth = now.getMonth() + 1;
export const currentYear = now.getFullYear();
