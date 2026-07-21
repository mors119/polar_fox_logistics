import type {
  CalendarEventInput,
  CalendarEventUpdate,
  CalendarPort,
} from '../../../application/ports/calendar.port';

export class CalendarAdapter implements CalendarPort {
  public createEvent(input: CalendarEventInput): string {
    const calendar = this.getCalendar(input.calendarId);
    const event = calendar.createEvent(input.title, input.startAt, input.endAt, {
      description: input.description,
    });

    return event.getId();
  }

  public updateEvent(eventId: string, update: CalendarEventUpdate): void {
    const event = CalendarApp.getEventById(eventId);

    if (!event) {
      throw new Error(`Calendar event not found: ${eventId}`);
    }

    if (update.title) {
      event.setTitle(update.title);
    }

    if (update.description) {
      event.setDescription(update.description);
    }

    if (update.startAt && update.endAt) {
      event.setTime(update.startAt, update.endAt);
    }
  }

  public deleteEvent(eventId: string): void {
    const event = CalendarApp.getEventById(eventId);

    if (!event) {
      throw new Error(`Calendar event not found: ${eventId}`);
    }

    event.deleteEvent();
  }

  private getCalendar(calendarId: string): GoogleAppsScript.Calendar.Calendar {
    const calendar = CalendarApp.getCalendarById(calendarId);

    if (!calendar) {
      throw new Error(`Calendar not found: ${calendarId}`);
    }

    return calendar;
  }
}
