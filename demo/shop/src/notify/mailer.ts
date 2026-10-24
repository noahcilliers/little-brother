export interface Mail {
  to: string;
  subject: string;
  html: string;
}

/** Outbound mail. The notifications workstream replaces this stub. */
export function sendMail(_mail: Mail): Promise<void> {
  return Promise.reject(new Error("mailer not configured"));
}
