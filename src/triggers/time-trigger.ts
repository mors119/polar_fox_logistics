import { runDailyReport } from '../reports/daily-report';

export function handleTimeTrigger(): void {
  runDailyReport();
}
