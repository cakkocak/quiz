/*
# Create Quiz App Schema

## Overview
Creates the full schema for a Kahoot-style quiz application. This is a single-tenant app (no sign-in) where anyone can create quizzes, host live game sessions, and join games with a PIN code.

## New Tables

### quizzes
- `id` (uuid, primary key)
- `title` (text, not null) — the quiz name
- `description` (text) — optional description
- `cover_color` (text) — theme color for the quiz card
- `created_at` (timestamptz)

### questions
- `id` (uuid, primary key)
- `quiz_id` (uuid, FK → quizzes.id ON DELETE CASCADE)
- `text` (text, not null) — the question prompt
- `image_url` (text) — optional image
- `time_limit` (int, default 20) — seconds to answer
- `points` (int, default 1000) — max points for correct answer
- `position` (int, default 0) — question order
- `created_at` (timestamptz)

### answers
- `id` (uuid, primary key)
- `question_id` (uuid, FK → questions.id ON DELETE CASCADE)
- `text` (text, not null) — the answer choice
- `is_correct` (boolean, default false)
- `position` (int, default 0) — answer order
- `created_at` (timestamptz)

### game_sessions
- `id` (uuid, primary key)
- `quiz_id` (uuid, FK → quizzes.id)
- `pin_code` (text, not null, unique) — 6-digit game PIN
- `status` (text, default 'lobby') — lobby | active | completed
- `current_question_index` (int, default 0)
- `question_started_at` (timestamptz) — when current question was shown
- `created_at` (timestamptz)

### players
- `id` (uuid, primary key)
- `session_id` (uuid, FK → game_sessions.id ON DELETE CASCADE)
- `nickname` (text, not null)
- `score` (int, default 0)
- `joined_at` (timestamptz)

### player_answers
- `id` (uuid, primary key)
- `player_id` (uuid, FK → players.id ON DELETE CASCADE)
- `session_id` (uuid, FK → game_sessions.id ON DELETE CASCADE)
- `question_id` (uuid, FK → questions.id)
- `answer_id` (uuid, FK → answers.id)
- `is_correct` (boolean)
- `points_earned` (int, default 0)
- `answer_time_ms` (int) — how long the player took to answer
- `created_at` (timestamptz)

## Security
- RLS enabled on ALL tables.
- All tables allow anon + authenticated CRUD since this is a no-auth shared app.
- USIN(true) is acceptable because all quiz data is intentionally public/shared.
*/

-- Quizzes
CREATE TABLE IF NOT EXISTS quizzes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text DEFAULT '',
  cover_color text DEFAULT 'blue',
  created_at timestamptz DEFAULT now()
);
ALTER TABLE quizzes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_quizzes" ON quizzes;
CREATE POLICY "anon_select_quizzes" ON quizzes FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_quizzes" ON quizzes;
CREATE POLICY "anon_insert_quizzes" ON quizzes FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_quizzes" ON quizzes;
CREATE POLICY "anon_update_quizzes" ON quizzes FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_quizzes" ON quizzes;
CREATE POLICY "anon_delete_quizzes" ON quizzes FOR DELETE TO anon, authenticated USING (true);

-- Questions
CREATE TABLE IF NOT EXISTS questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id uuid NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
  text text NOT NULL,
  image_url text DEFAULT '',
  time_limit int NOT NULL DEFAULT 20,
  points int NOT NULL DEFAULT 1000,
  position int NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE questions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_questions" ON questions;
CREATE POLICY "anon_select_questions" ON questions FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_questions" ON questions;
CREATE POLICY "anon_insert_questions" ON questions FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_questions" ON questions;
CREATE POLICY "anon_update_questions" ON questions FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_questions" ON questions;
CREATE POLICY "anon_delete_questions" ON questions FOR DELETE TO anon, authenticated USING (true);

-- Answers
CREATE TABLE IF NOT EXISTS answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id uuid NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  text text NOT NULL,
  is_correct boolean NOT NULL DEFAULT false,
  position int NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE answers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_answers" ON answers;
CREATE POLICY "anon_select_answers" ON answers FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_answers" ON answers;
CREATE POLICY "anon_insert_answers" ON answers FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_answers" ON answers;
CREATE POLICY "anon_update_answers" ON answers FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_answers" ON answers;
CREATE POLICY "anon_delete_answers" ON answers FOR DELETE TO anon, authenticated USING (true);

-- Game sessions
CREATE TABLE IF NOT EXISTS game_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id uuid NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
  pin_code text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'lobby',
  current_question_index int NOT NULL DEFAULT 0,
  question_started_at timestamptz,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE game_sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_sessions" ON game_sessions;
CREATE POLICY "anon_select_sessions" ON game_sessions FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_sessions" ON game_sessions;
CREATE POLICY "anon_insert_sessions" ON game_sessions FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_sessions" ON game_sessions;
CREATE POLICY "anon_update_sessions" ON game_sessions FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_sessions" ON game_sessions;
CREATE POLICY "anon_delete_sessions" ON game_sessions FOR DELETE TO anon, authenticated USING (true);

-- Players
CREATE TABLE IF NOT EXISTS players (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES game_sessions(id) ON DELETE CASCADE,
  nickname text NOT NULL,
  score int NOT NULL DEFAULT 0,
  joined_at timestamptz DEFAULT now()
);
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_players" ON players;
CREATE POLICY "anon_select_players" ON players FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_players" ON players;
CREATE POLICY "anon_insert_players" ON players FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_players" ON players;
CREATE POLICY "anon_update_players" ON players FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_players" ON players;
CREATE POLICY "anon_delete_players" ON players FOR DELETE TO anon, authenticated USING (true);

-- Player answers
CREATE TABLE IF NOT EXISTS player_answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  session_id uuid NOT NULL REFERENCES game_sessions(id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  answer_id uuid REFERENCES answers(id) ON DELETE SET NULL,
  is_correct boolean,
  points_earned int NOT NULL DEFAULT 0,
  answer_time_ms int,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE player_answers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_player_answers" ON player_answers;
CREATE POLICY "anon_select_player_answers" ON player_answers FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_player_answers" ON player_answers;
CREATE POLICY "anon_insert_player_answers" ON player_answers FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_player_answers" ON player_answers;
CREATE POLICY "anon_update_player_answers" ON player_answers FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_player_answers" ON player_answers;
CREATE POLICY "anon_delete_player_answers" ON player_answers FOR DELETE TO anon, authenticated USING (true);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_questions_quiz_id ON questions(quiz_id);
CREATE INDEX IF NOT EXISTS idx_answers_question_id ON answers(question_id);
CREATE INDEX IF NOT EXISTS idx_sessions_quiz_id ON game_sessions(quiz_id);
CREATE INDEX IF NOT EXISTS idx_sessions_pin_code ON game_sessions(pin_code);
CREATE INDEX IF NOT EXISTS idx_players_session_id ON players(session_id);
CREATE INDEX IF NOT EXISTS idx_player_answers_session_id ON player_answers(session_id);
CREATE INDEX IF NOT EXISTS idx_player_answers_player_id ON player_answers(player_id);
