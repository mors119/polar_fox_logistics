import type {
  MailPort,
  SendHtmlMailInput,
  SendMailInput,
} from '../../../application/ports/mail.port';

export class GmailAdapter implements MailPort {
  public send(input: SendMailInput): void {
    GmailApp.sendEmail(input.to, input.subject, input.body);
  }

  public sendHtml(input: SendHtmlMailInput): void {
    GmailApp.sendEmail(input.to, input.subject, input.body, {
      htmlBody: input.htmlBody,
    });
  }
}
