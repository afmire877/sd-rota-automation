const { test } = require('node:test');
const assert = require('node:assert/strict');

const { getShiftId, syncShiftEvent, withSyncMetadata } = require('../lib/calendar');

const event = {
  summary: 'Sports Direct shift',
  start: { dateTime: '2026-06-23T09:00:00+01:00', timeZone: 'Europe/London' },
  end: { dateTime: '2026-06-23T17:30:00+01:00', timeZone: 'Europe/London' },
};

test('withSyncMetadata adds a stable private shift identifier', () => {
  const resource = withSyncMetadata(event);
  assert.equal(resource.extendedProperties.private.sdRotaShiftId, getShiftId(event));
  assert.equal(event.extendedProperties, undefined);
});

test('syncShiftEvent inserts a shift not already in the calendar', async () => {
  const calls = [];
  const calendar = {
    events: {
      list: async options => {
        calls.push(['list', options]);
        return { data: { items: [] } };
      },
      insert: async options => {
        calls.push(['insert', options]);
        return { data: { id: 'new-event' } };
      },
    },
  };

  const result = await syncShiftEvent(calendar, 'calendar-id', event);
  assert.equal(result.action, 'created');
  assert.equal(
    calls[0][1].privateExtendedProperty[0],
    `sdRotaShiftId=${getShiftId(event)}`
  );
  assert.equal(
    calls[1][1].resource.extendedProperties.private.sdRotaShiftId,
    getShiftId(event)
  );
});

test('syncShiftEvent updates the matching shift instead of duplicating it', async () => {
  let inserted = false;
  const calendar = {
    events: {
      list: async () => ({ data: { items: [{ id: 'existing-event' }] } }),
      update: async options => ({ data: { id: options.eventId } }),
      insert: async () => {
        inserted = true;
      },
    },
  };

  const result = await syncShiftEvent(calendar, 'calendar-id', event);
  assert.deepEqual(result, { action: 'updated', event: { id: 'existing-event' } });
  assert.equal(inserted, false);
});
