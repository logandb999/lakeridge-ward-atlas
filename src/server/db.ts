import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { jsonb, pgTable, text, timestamp } from 'drizzle-orm/pg-core';

export const properties = pgTable('properties', {
  id: text('id').primaryKey(),
  address: text('address').notNull(),
  data: jsonb('data').$type<Record<string, unknown>>().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

let database: ReturnType<typeof drizzle> | undefined;

export function getDatabase() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not configured');
  database ??= drizzle(neon(process.env.DATABASE_URL));
  return database;
}
