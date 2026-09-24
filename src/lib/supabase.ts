import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  realtime: {
    params: { eventsPerSecond: 20 },
  },
});

export type Quiz = {
  id: string;
  title: string;
  description: string;
  cover_color: string;
  created_at: string;
};

export type Question = {
  id: string;
  quiz_id: string;
  text: string;
  image_url: string;
  time_limit: number;
  points: number;
  position: number;
  created_at: string;
  answers?: Answer[];
};

export type Answer = {
  id: string;
  question_id: string;
  text: string;
  is_correct: boolean;
  position: number;
};

export type GameSession = {
  id: string;
  quiz_id: string;
  pin_code: string;
  status: 'lobby' | 'active' | 'completed';
  current_question_index: number;
  question_started_at: string | null;
  created_at: string;
};

export type Player = {
  id: string;
  session_id: string;
  nickname: string;
  score: number;
  joined_at: string;
};

export type PlayerAnswer = {
  id: string;
  player_id: string;
  session_id: string;
  question_id: string;
  answer_id: string | null;
  is_correct: boolean | null;
  points_earned: number;
  answer_time_ms: number | null;
  created_at: string;
};

export type QuizWithQuestions = Quiz & {
  questions: Question[];
};

export const COLOR_OPTIONS = [
  { name: 'blue', bg: 'from-blue-500 to-blue-700', solid: 'bg-blue-600', text: 'text-blue-600', light: 'bg-blue-50', border: 'border-blue-500' },
  { name: 'emerald', bg: 'from-emerald-500 to-emerald-700', solid: 'bg-emerald-600', text: 'text-emerald-600', light: 'bg-emerald-50', border: 'border-emerald-500' },
  { name: 'rose', bg: 'from-rose-500 to-rose-700', solid: 'bg-rose-600', text: 'text-rose-600', light: 'bg-rose-50', border: 'border-rose-500' },
  { name: 'amber', bg: 'from-amber-500 to-amber-600', solid: 'bg-amber-500', text: 'text-amber-600', light: 'bg-amber-50', border: 'border-amber-500' },
  { name: 'cyan', bg: 'from-cyan-500 to-cyan-700', solid: 'bg-cyan-600', text: 'text-cyan-600', light: 'bg-cyan-50', border: 'border-cyan-500' },
  { name: 'violet', bg: 'from-violet-500 to-violet-700', solid: 'bg-violet-600', text: 'text-violet-600', light: 'bg-violet-50', border: 'border-violet-500' },
];

export function getColor(name: string) {
  return COLOR_OPTIONS.find((c) => c.name === name) || COLOR_OPTIONS[0];
}

export function generatePinCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}
