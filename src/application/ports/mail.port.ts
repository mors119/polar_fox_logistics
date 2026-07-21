export interface SendMailInput {
  readonly to: string;
  readonly subject: string;
  readonly body: string;
}

export interface SendHtmlMailInput extends SendMailInput {
  readonly htmlBody: string;
}

export interface MailPort {
  send(input: SendMailInput): void;
  sendHtml(input: SendHtmlMailInput): void;
}
