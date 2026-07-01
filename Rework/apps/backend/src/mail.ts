import nodemailer from "nodemailer";

// Functional port of tools/SendMail.java (JavaMail + config.properties'
// mail.* keys) using nodemailer + env vars instead.
//
// Legacy mapping: mail.username/mail.password -> SMTP_USER/SMTP_PASSWORD,
// mail.senderAdress -> MAIL_FROM, mail.smtp.host/port -> SMTP_HOST/SMTP_PORT.
//
// If SMTP_HOST isn't configured (e.g. local dev without real mail
// credentials), falls back to nodemailer's jsonTransport, which doesn't
// send anything but still builds/validates the message and logs it - lets
// callers exercise the full code path without a live SMTP server.
function createTransport() {
  if (process.env.SMTP_HOST) {
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT ?? 587),
      secure: process.env.SMTP_SECURE === "true",
      auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD } : undefined,
    });
  }
  return nodemailer.createTransport({ jsonTransport: true });
}

export async function sendMail(to: string, subject: string, text: string) {
  const transport = createTransport();
  const from = process.env.MAIL_FROM ?? "no-reply@schuetzenmanager.local";
  const info = await transport.sendMail({ from, to, subject, text });
  if (!process.env.SMTP_HOST) {
    console.log(`[mail] SMTP_HOST nicht gesetzt, Mail wurde nicht verschickt: ${JSON.stringify((info as { message?: unknown }).message ?? info)}`);
  }
  return info;
}
