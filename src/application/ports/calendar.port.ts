export interface CalendarEventInput {
  readonly calendarId: string;
  readonly title: string;
  readonly startAt: Date;
  readonly endAt: Date;
  readonly description?: string;
}

export interface CalendarEventUpdate {
  readonly title?: string;
  readonly startAt?: Date;
  readonly endAt?: Date;
  readonly description?: string;
}

export interface CalendarPort {
  createEvent(input: CalendarEventInput): string;
  updateEvent(eventId: string, update: CalendarEventUpdate): void;
  deleteEvent(eventId: string): void;
}
