// The lab works in Beijing time, whatever zone the server or the browser runs in (Q195). Timestamps read as
// "2026-10-31 19:33"; calendar dates stored at UTC midnight (expiry, opened on) are not timestamps and keep their day.

const beijing = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Shanghai",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

function read(value: Date | string) {
  const fields = Object.fromEntries(beijing.formatToParts(new Date(value)).map((part) => [part.type, part.value]));
  return { day: `${fields.year}-${fields.month}-${fields.day}`, time: `${fields.hour}:${fields.minute}` };
}

/** "2026-10-31 19:33" in Beijing time. */
export function labDateTime(value: Date | string) {
  const { day, time } = read(value);
  return `${day} ${time}`;
}

/** "2026-10-31", the Beijing day of a timestamp. */
export function labDate(value: Date | string) {
  return read(value).day;
}
