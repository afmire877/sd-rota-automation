const SOURCE_PROPERTY = 'sdRotaShiftId';

function getShiftId(event) {
  return `${event.start.dateTime}|${event.end.dateTime}`;
}

function withSyncMetadata(event) {
  return {
    ...event,
    extendedProperties: {
      ...event.extendedProperties,
      private: {
        ...event.extendedProperties?.private,
        [SOURCE_PROPERTY]: getShiftId(event),
      },
    },
  };
}

async function syncShiftEvent(calendar, calendarId, event) {
  const resource = withSyncMetadata(event);
  const shiftId = resource.extendedProperties.private[SOURCE_PROPERTY];
  const response = await calendar.events.list({
    calendarId,
    privateExtendedProperty: [`${SOURCE_PROPERTY}=${shiftId}`],
    maxResults: 2,
    singleEvents: true,
  });
  const matches = response.data.items || [];

  if (matches.length > 0) {
    const updated = await calendar.events.update({
      calendarId,
      eventId: matches[0].id,
      resource,
    });
    return { action: 'updated', event: updated.data };
  }

  const inserted = await calendar.events.insert({ calendarId, resource });
  return { action: 'created', event: inserted.data };
}

module.exports = { getShiftId, syncShiftEvent, withSyncMetadata, SOURCE_PROPERTY };
