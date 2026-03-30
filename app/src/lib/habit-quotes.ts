const HABIT_QUOTES = [
  "We are what we repeatedly do. Excellence, then, is not an act, but a habit.",
  "The secret of getting ahead is getting started.",
  "Small daily improvements over time lead to stunning results.",
  "Motivation is what gets you started. Habit is what keeps you going.",
  "Success is the sum of small efforts repeated day in and day out.",
  "Routine, in an intelligent man, is a sign of ambition.",
  "The chains of habit are too light to be felt until they are too heavy to be broken.",
  "First, make your habits. Then, your habits make you.",
  "Every day is a chance to begin again.",
  "Habits are the compound interest of self-improvement.",
  "You are what you do, not what you say you'll do.",
  "The best time to plant a tree was 20 years ago. The second best time is now.",
  "Don't let perfect be the enemy of good.",
  "Discipline is choosing between what you want now and what you want most.",
  "What you do every day matters more than what you do once in a while.",
  "Good habits are the key to all success.",
  "Consistency is the key to transformation.",
  "The only way to do great work is to love what you do.",
  "Success is not final, failure is not fatal: it is the courage to continue that counts.",
  "Your net worth to the world is usually determined by what remains after your bad habits are subtracted from your good ones.",
];

export function pickRandomHabitQuote(): string {
  const i = Math.floor(Math.random() * HABIT_QUOTES.length);
  return HABIT_QUOTES[i] ?? "";
}
