import { integer, pgTable, serial, text, timestamp, doublePrecision } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Define the 'users' table
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').unique(), // Firebase Auth UID (if integrated, otherwise can be empty)
  name: text('name'),
  email: text('email').unique().notNull(),
  mobile: text('mobile'),
  level: text('level').default('Beginner'),
  is_pro: integer('is_pro').default(0),
  is_admin: integer('is_admin').default(0),
  progress_json: text('progress_json'),
  onboarding_json: text('onboarding_json'),
});

// Define the 'chat_messages' table
export const chatMessages = pgTable('chat_messages', {
  id: serial('id').primaryKey(),
  user_email: text('user_email').notNull(),
  role: text('role').notNull(),
  text: text('text').notNull(),
  correction: text('correction'),
  translation: text('translation'),
  explanation: text('explanation'),
  timestamp: timestamp('timestamp').defaultNow(),
});

// Define the 'payments' table
export const payments = pgTable('payments', {
  id: serial('id').primaryKey(),
  user_id: integer('user_id').references(() => users.id, { onDelete: 'cascade' }),
  amount: doublePrecision('amount'),
  currency: text('currency'),
  status: text('status'),
  stripe_session_id: text('stripe_session_id'),
  date: text('date'),
});

// Define the 'plans' table
export const plans = pgTable('plans', {
  id: text('id').primaryKey(),
  name: text('name'),
  price: doublePrecision('price'),
  interval: text('interval'),
});

// Define the 'modules' table
export const modules = pgTable('modules', {
  id: text('id').primaryKey(),
  title: text('title'),
  icon: text('icon'),
  color: text('color'),
  count: text('count'),
  description: text('description'),
});

// Define the 'lessons' table
export const lessons = pgTable('lessons', {
  id: text('id').primaryKey(),
  module_id: text('module_id').references(() => modules.id, { onDelete: 'cascade' }),
  title: text('title'),
  duration: text('duration'),
  content_json: text('content_json'),
});

// Define the 'assessment_questions' table
export const assessmentQuestions = pgTable('assessment_questions', {
  id: serial('id').primaryKey(),
  question: text('question'),
  options_json: text('options_json'),
  answer: text('answer'),
});

// Define relations for Drizzle type-safety if needed
export const usersRelations = relations(users, ({ many }) => ({
  payments: many(payments),
}));

export const paymentsRelations = relations(payments, ({ one }) => ({
  user: one(users, {
    fields: [payments.user_id],
    references: [users.id],
  }),
}));

export const modulesRelations = relations(modules, ({ many }) => ({
  lessons: many(lessons),
}));

export const lessonsRelations = relations(lessons, ({ one }) => ({
  module: one(modules, {
    fields: [lessons.module_id],
    references: [modules.id],
  }),
}));
