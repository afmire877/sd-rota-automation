const { test } = require('node:test');
const assert = require('node:assert/strict');

const { createShiftEvent, resolveShiftDate } = require('../lib/shifts');

test('createShiftEvent builds start/end in Europe/London with a default summary', () => {
  const event = createShiftEvent('23 Jun 2026', '09:00', '17:30');

  assert.equal(event.summary, 'Sports Direct shift');
  assert.equal(event.start.timeZone, 'Europe/London');
  assert.equal(event.end.timeZone, 'Europe/London');

  // 23 Jun is BST (UTC+1), so 09:00 local => +01:00 offset.
  assert.equal(event.start.dateTime, '2026-06-23T09:00:00+01:00');
  assert.equal(event.end.dateTime, '2026-06-23T17:30:00+01:00');
});

test('createShiftEvent honours a custom summary', () => {
  const event = createShiftEvent('23 Jun 2026', '09:00', '17:30', 'Closing shift');
  assert.equal(event.summary, 'Closing shift');
});

test('createShiftEvent applies GMT offset outside British Summer Time', () => {
  const event = createShiftEvent('05 Jan 2026', '08:00', '16:00');
  // January is GMT (UTC+0).
  assert.equal(event.start.dateTime, '2026-01-05T08:00:00Z');
  assert.equal(event.end.dateTime, '2026-01-05T16:00:00Z');
});

test('resolveShiftDate maps a weekday to its date within the given week', () => {
  // Week containing Mon 22 Jun 2026. moment's default locale starts the week on
  // Sunday, so Sunday resolves to the 21st (the start of that week).
  assert.equal(resolveShiftDate('22 Jun 2026', 'Monday'), '22 Jun 2026');
  assert.equal(resolveShiftDate('22 Jun 2026', 'Wednesday'), '24 Jun 2026');
  assert.equal(resolveShiftDate('22 Jun 2026', 'Saturday'), '27 Jun 2026');
  assert.equal(resolveShiftDate('22 Jun 2026', 'Sunday'), '21 Jun 2026');
});
