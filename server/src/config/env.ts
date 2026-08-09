import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),

  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(10),
  SUPABASE_ANON_KEY: z.string().min(10),

  DATABASE_URL: z.string().optional(),

  CLIENT_URL: z.string().url().default('http://localhost:5173'),
  CORS_ORIGIN: z.string().optional(),

  JWT_SECRET: z.string().optional(),

  EMAIL_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().default('M&E Document Hub <onboarding@resend.dev>'),
  EMAIL_TO_DEV: z.string().optional(),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_SECURE: z.boolean({ coerce: true }).default(false),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),

  APP_NAME: z.string().default('M&E Document Hub'),

  MAX_FILE_SIZE_MB: z.coerce.number().int().positive().default(25),
  BUCKET_NAME: z.string().default('documents'),
  MAX_BUCKET_SIZE_MB: z.coerce.number().int().positive().default(5120),

  SETUP_ADMIN_EMAIL: z.string().email().optional(),
  SETUP_ADMIN_PASSWORD: z.string().min(8).optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment variables:');
  for (const issue of parsed.error.issues) {
    console.error(`  - ${issue.path.join('.')}: ${issue.message}`);
  }
  process.exit(1);
}

export const env = parsed.data;