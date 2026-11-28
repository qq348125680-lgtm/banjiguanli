declare module './domain.mjs' {
 export const attendanceStatuses: readonly string[];
 export function displayError(error: unknown): string;
 export function sanitizeList(items: Array<Record<string,unknown>>): Array<{id:string;student_no:string;name:string}>;
 export function statusTone(status:string):string;
 export function dateToday():string;
 export function isReady(config:{url?:string;key?:string}):boolean;
}
