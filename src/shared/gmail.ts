export interface SendHtmlMailInput {
  readonly to: string;
  readonly subject: string;
  readonly body: string;
  readonly htmlBody: string;
}

export function sendHtmlMail(input: SendHtmlMailInput): void {
  GmailApp.sendEmail(input.to, input.subject, input.body, {
    htmlBody: input.htmlBody,
  });
}
