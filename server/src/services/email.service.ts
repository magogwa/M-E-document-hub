import nodemailer from 'nodemailer';
import { env } from '../config/env.js';
import { logError, logInfo } from '../libs/logger.js';

interface EmailMessage {
  to: string;
  subject: string;
  html: string;
}

function sendViaResend(message: EmailMessage): Promise<void> {
  return fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.EMAIL_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: env.EMAIL_FROM,
      to: [message.to],
      subject: message.subject,
      html: message.html
    })
  }).then(async (res) => {
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Resend error ${res.status}: ${body}`);
    }
  });
}

const smtpTransport = env.SMTP_HOST
  ? nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_SECURE,
      auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined
    })
  : null;

export async function sendEmail(message: EmailMessage): Promise<void> {
  try {
    if (env.EMAIL_API_KEY) {
      await sendViaResend(message);
      return;
    }
    if (smtpTransport) {
      await smtpTransport.sendMail({
        from: env.EMAIL_FROM,
        to: message.to,
        subject: message.subject,
        html: message.html
      });
      return;
    }
    logInfo(`[email:dev-mode] To: ${message.to} | Subject: ${message.subject}`);
  } catch (err) {
    logError('Email send failed:', err);
    throw new Error(
      'Email could not be sent. Please contact the administrator.'
    );
  }
}