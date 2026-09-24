import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Copy, Check, Users, Play, ChevronRight, Trophy, RotateCcw, Eye, X, AlertCircle } from 'lucide-react';
import { supabase, type Quiz, type Question, type Answer, type Player, type GameSession, getColor, generatePinCode } from '@/lib/supabase';

type Props = { quizId: string };

type Phase = 'lobby' | 'question' | 'results' | 'final';

export default function HostView({ quizId }: Props) {
  const navigate = useNavigate();
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [session, setSession] = useState<GameSession | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [phase, setPhase] = useState<Phase>('lobby');
  const [currentQ, setCurrentQ] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);
  const [showCorrect, setShowCorrect] = useState(false);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [playerAnswers, setPlayerAnswers] = useState<Record<string, { answer_id: string | null; is_correct: boolean | null; nickname: string }>>({});

  // Load quiz and questions
  useEffect(() => {
    (async () => {
      const [{ data: q }, { data: qs }] = await Promise.all([
        supabase.from('quizzes').select('*').eq('id', quizId).maybeSingle(),
        supabase.from('questions').select('*, answers(*)').eq('quiz_id', quizId).order('position'),
      ]);
      if (q) setQuiz(q);
      if (qs) {
        const sorted = qs.map((q: Question) => ({
          ...q,
          answers: (q.answers || []).sort((a: Answer, b: Answer) => a.position - b.position),
        }));
        setQuestions(sorted);
      }
      setLoading(false);
    })();
  }, [quizId]);

  // Create session
  useEffect(() => {
    if (!quiz || session) return;
    (async () => {
      const pin = generatePinCode();
      const { data, error } = await supabase.from('game_sessions').insert({
        quiz_id: quizId,
        pin_code: pin,
        status: 'lobby',
      }).select().single();
      if (!error && data) setSession(data);
    })();
  }, [quiz, quizId, session]);

  // Subscribe to players
  useEffect(() => {
    if (!session) return;
    const channel = supabase
      .channel(`host-${session.id}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'players', filter: `session_id=eq.${session.id}` },
        async () => {
          const { data } = await supabase.from('players').select('*').eq('session_id', session.id).order('score', { ascending: false });
          if (data) setPlayers(data);
        },
      )
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'player_answers', filter: `session_id=eq.${session.id}` },
        async (payload) => {
          const pa = payload.new as { player_id: string; answer_id: string | null; is_correct: boolean | null };
          const { data: player } = await supabase.from('players').select('nickname').eq('id', pa.player_id).maybeSingle();
          setPlayerAnswers((prev) => ({
            ...prev,
            [pa.player_id]: { answer_id: pa.answer_id, is_correct: pa.is_correct, nickname: player?.nickname || 'Unknown' },
          }));
        },
      )
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'game_sessions', filter: `id=eq.${session.id}` },
        (payload) => setSession(payload.new as GameSession),
      )
      .subscribe();

    (async () => {
      const { data } = await supabase.from('players').select('*').eq('session_id', session.id).order('score', { ascending: false });
      if (data) setPlayers(data);
    })();

    return () => { supabase.removeChannel(channel); };
  }, [session]);

  // Timer
  useEffect(() => {
    if (phase !== 'question' || timeLeft <= 0) return;
    const interval = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          clearInterval(interval);
          setShowCorrect(true);
          setTimeout(() => setPhase('results'), 5000);
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [phase, timeLeft]);

  const startGame = async () => {
    if (!session || questions.length === 0) return;
    await supabase.from('game_sessions').update({
      status: 'active',
      current_question_index: 0,
      question_started_at: new Date().toISOString(),
    }).eq('id', session.id);
    setCurrentQ(0);
    setTimeLeft(questions[0].time_limit);
    setPhase('question');
    setShowCorrect(false);
    setPlayerAnswers({});
  };

  const nextQuestion = useCallback(async () => {
    if (!session) return;
    const nextIdx = currentQ + 1;
    if (nextIdx >= questions.length) {
      await supabase.from('game_sessions').update({ status: 'completed' }).eq('id', session.id);
      setPhase('final');
      return;
    }
    await supabase.from('game_sessions').update({
      current_question_index: nextIdx,
      question_started_at: new Date().toISOString(),
    }).eq('id', session.id);
    setCurrentQ(nextIdx);
    setTimeLeft(questions[nextIdx].time_limit);
    setShowCorrect(false);
    setPlayerAnswers({});
    setPhase('question');
  }, [session, currentQ, questions]);

  const endGame = async () => {
    if (session) {
      await supabase.from('game_sessions').update({ status: 'completed' }).eq('id', session.id);
    }
    navigate('/');
  };

  const copyPin = () => {
    if (session) {
      navigator.clipboard.writeText(session.pin_code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-pulse text-slate-400">Loading...</div>
      </div>
    );
  }

  if (!quiz) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-rose-400 mx-auto mb-3" />
          <p className="text-slate-500">Quiz not found</p>
          <button onClick={() => navigate('/')} className="mt-4 text-slate-600 underline">Go home</button>
        </div>
      </div>
    );
  }

  const color = getColor(quiz.cover_color);
  const question = questions[currentQ];
  const answeredCount = Object.keys(playerAnswers).length;

  // LOBBY PHASE
  if (phase === 'lobby') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex flex-col items-center justify-center p-6">
        <button onClick={endGame} className="absolute top-6 left-6 flex items-center gap-2 text-white/60 hover:text-white transition-colors text-sm">
          <ArrowLeft className="w-4 h-4" /> Exit
        </button>

        <div className="text-center mb-8">
          <p className="text-white/50 text-sm font-medium uppercase tracking-wider mb-2">Game PIN</p>
          <button
            onClick={copyPin}
            className="group flex items-center gap-3"
          >
            <h1 className="text-7xl sm:text-8xl font-bold text-white tracking-wider tabular-nums">
              {session?.pin_code || '------'}
            </h1>
            <span className="text-white/40 group-hover:text-white/70 transition-colors">
              {copied ? <Check className="w-6 h-6 text-emerald-400" /> : <Copy className="w-6 h-6" />}
            </span>
          </button>
          <p className="text-white/40 text-sm mt-2">Click to copy</p>
        </div>

        <div className="bg-white/5 backdrop-blur rounded-3xl border border-white/10 p-8 w-full max-w-md">
          <div className="flex items-center gap-3 mb-6">
            <div className={`w-10 h-10 rounded-xl ${color.solid} flex items-center justify-center`}>
              <Users className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-white font-bold text-lg">{quiz.title}</h2>
              <p className="text-white/40 text-sm">{questions.length} questions</p>
            </div>
          </div>

          <div className="space-y-2 mb-6 max-h-64 overflow-y-auto">
            {players.length === 0 ? (
              <p className="text-white/30 text-center py-8 text-sm">Waiting for players to join...</p>
            ) : (
              players.map((p, i) => (
                <div key={p.id} className="flex items-center gap-3 bg-white/5 rounded-xl px-4 py-2.5 animate-[fadeIn_0.3s_ease]">
                  <span className="text-white/40 text-sm w-6">{i + 1}.</span>
                  <span className="text-white font-medium text-sm">{p.nickname}</span>
                </div>
              ))
            )}
          </div>

          <div className="flex items-center justify-between text-white/40 text-sm mb-4">
            <span>{players.length} {players.length === 1 ? 'player' : 'players'}</span>
          </div>

          <button
            onClick={startGame}
            disabled={players.length === 0 || questions.length === 0}
            className="w-full py-3.5 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 text-white font-bold hover:from-emerald-600 hover:to-emerald-700 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg"
          >
            <Play className="w-5 h-5" fill="white" /> Start Game
          </button>
        </div>
      </div>
    );
  }

  // QUESTION PHASE
  if (phase === 'question' && question) {
    const totalSeconds = question.time_limit;
    const progress = totalSeconds > 0 ? ((totalSeconds - timeLeft) / totalSeconds) * 100 : 100;
    const answerColors = ['bg-amber-400', 'bg-emerald-400', 'bg-sky-400', 'bg-rose-400'];

    return (
      <div className="min-h-screen bg-slate-900 flex flex-col">
        {/* Top bar */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-800/50">
          <div className="flex items-center gap-3">
            <button onClick={endGame} className="text-white/50 hover:text-white transition-colors">
              <X className="w-5 h-5" />
            </button>
            <span className="text-white/60 text-sm font-medium">
              Question {currentQ + 1} of {questions.length}
            </span>
          </div>
          <div className="flex items-center gap-2 bg-white/10 rounded-full px-3 py-1.5">
            <Users className="w-4 h-4 text-white/60" />
            <span className="text-white text-sm font-medium">{answeredCount}/{players.length}</span>
          </div>
        </div>

        {/* Timer bar */}
        <div className="h-1.5 bg-slate-800">
          <div
            className={`h-full transition-all duration-1000 ease-linear ${
              timeLeft <= 5 ? 'bg-rose-500' : 'bg-emerald-500'
            }`}
            style={{ width: `${100 - progress}%` }}
          />
        </div>

        {/* Question */}
        <div className="flex-1 flex flex-col items-center justify-center px-6 py-8">
          <div className={`w-20 h-20 rounded-full ${timeLeft <= 5 ? 'bg-rose-500' : 'bg-emerald-500'} flex items-center justify-center mb-6 shadow-2xl ${timeLeft <= 5 ? 'animate-pulse' : ''}`}>
            <span className="text-4xl font-bold text-white tabular-nums">{timeLeft}</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold text-white text-center max-w-2xl mb-8">
            {question.text}
          </h2>

          {/* Answer preview grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-2xl">
            {question.answers?.map((a, i) => (
              <div
                key={a.id}
                className={`${answerColors[i]} rounded-2xl p-4 flex items-center gap-3 shadow-lg`}
              >
                <div className="w-8 h-8 rounded-lg bg-black/20 flex items-center justify-center text-white font-bold text-sm">
                  {String.fromCharCode(65 + i)}
                </div>
                <span className="text-white font-semibold text-sm truncate">{a.text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // RESULTS PHASE (between questions)
  if (phase === 'results' && question) {
    const correctAnswer = question.answers?.find((a) => a.is_correct);
    const correctCount = Object.values(playerAnswers).filter((pa) => pa.is_correct).length;
    const answerColors = ['bg-amber-400', 'bg-emerald-400', 'bg-sky-400', 'bg-rose-400'];

    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center px-6 py-8">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 bg-emerald-500/20 rounded-full px-4 py-1.5 mb-4">
            <Check className="w-4 h-4 text-emerald-400" />
            <span className="text-emerald-400 text-sm font-semibold">Correct Answer</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold text-white mb-4">{question.text}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-xl mx-auto">
            {question.answers?.map((a, i) => (
              <div
                key={a.id}
                className={`rounded-2xl p-4 flex items-center gap-3 transition-all ${
                  a.is_correct ? 'bg-emerald-500 ring-4 ring-emerald-300 shadow-2xl scale-105' : `${answerColors[i]} opacity-50`
                }`}
              >
                <div className="w-8 h-8 rounded-lg bg-black/20 flex items-center justify-center text-white font-bold text-sm">
                  {String.fromCharCode(65 + i)}
                </div>
                <span className="text-white font-semibold text-sm">{a.text}</span>
                {a.is_correct && <Check className="w-5 h-5 text-white ml-auto" />}
              </div>
            ))}
          </div>
          <p className="text-white/50 text-sm mt-6">
            {correctCount} of {players.length} answered correctly
          </p>
        </div>

        {/* Mini leaderboard */}
        <div className="bg-white/5 backdrop-blur rounded-2xl border border-white/10 p-5 w-full max-w-md mb-6">
          <h3 className="text-white/60 text-sm font-semibold mb-3 flex items-center gap-2">
            <Trophy className="w-4 h-4 text-amber-400" /> Current Standings
          </h3>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {[...players].sort((a, b) => b.score - a.score).slice(0, 5).map((p, i) => (
              <div key={p.id} className="flex items-center gap-3">
                <span className={`text-sm font-bold w-6 ${i === 0 ? 'text-amber-400' : i === 1 ? 'text-slate-300' : i === 2 ? 'text-orange-400' : 'text-white/40'}`}>
                  {i + 1}
                </span>
                <span className="text-white text-sm font-medium flex-1">{p.nickname}</span>
                <span className="text-white/60 text-sm tabular-nums">{p.score.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>

        <button
          onClick={nextQuestion}
          className="flex items-center gap-2 px-8 py-3.5 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 text-white font-bold hover:from-emerald-600 hover:to-emerald-700 transition-all shadow-lg"
        >
          {currentQ + 1 >= questions.length ? 'See Final Results' : 'Next Question'}
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>
    );
  }

  // FINAL PHASE
  if (phase === 'final') {
    const sorted = [...players].sort((a, b) => b.score - a.score);
    const podium = sorted.slice(0, 3);
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 flex flex-col items-center justify-center px-6 py-8">
        <div className="text-center mb-10">
          <Trophy className="w-16 h-16 text-amber-400 mx-auto mb-3" />
          <h1 className="text-3xl font-bold text-white mb-1">Game Over!</h1>
          <p className="text-white/40">{quiz.title}</p>
        </div>

        {/* Podium */}
        {podium.length > 0 && (
          <div className="flex items-end justify-center gap-3 mb-8">
            {podium[1] && (
              <div className="flex flex-col items-center">
                <div className="w-16 h-16 rounded-full bg-slate-300 flex items-center justify-center text-2xl font-bold text-slate-700 mb-2">
                  {podium[1].nickname.charAt(0).toUpperCase()}
                </div>
                <span className="text-white text-sm font-medium mb-1">{podium[1].nickname}</span>
                <span className="text-slate-300 text-xs">{podium[1].score.toLocaleString()}</span>
                <div className="w-24 h-24 bg-gradient-to-t from-slate-600 to-slate-400 rounded-t-xl flex items-center justify-center mt-2">
                  <span className="text-4xl font-bold text-white">2</span>
                </div>
              </div>
            )}
            {podium[0] && (
              <div className="flex flex-col items-center">
                <Trophy className="w-8 h-8 text-amber-400 mb-1" />
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-amber-300 to-amber-500 flex items-center justify-center text-3xl font-bold text-white mb-2 shadow-2xl shadow-amber-500/50">
                  {podium[0].nickname.charAt(0).toUpperCase()}
                </div>
                <span className="text-white font-semibold mb-1">{podium[0].nickname}</span>
                <span className="text-amber-400 text-sm font-semibold">{podium[0].score.toLocaleString()}</span>
                <div className="w-28 h-32 bg-gradient-to-t from-amber-600 to-amber-400 rounded-t-xl flex items-center justify-center mt-2 shadow-2xl">
                  <span className="text-5xl font-bold text-white">1</span>
                </div>
              </div>
            )}
            {podium[2] && (
              <div className="flex flex-col items-center">
                <div className="w-16 h-16 rounded-full bg-orange-400 flex items-center justify-center text-2xl font-bold text-white mb-2">
                  {podium[2].nickname.charAt(0).toUpperCase()}
                </div>
                <span className="text-white text-sm font-medium mb-1">{podium[2].nickname}</span>
                <span className="text-orange-400 text-xs">{podium[2].score.toLocaleString()}</span>
                <div className="w-24 h-16 bg-gradient-to-t from-orange-700 to-orange-500 rounded-t-xl flex items-center justify-center mt-2">
                  <span className="text-3xl font-bold text-white">3</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Full standings */}
        {sorted.length > 3 && (
          <div className="bg-white/5 backdrop-blur rounded-2xl border border-white/10 p-5 w-full max-w-md mb-6">
            {sorted.slice(3).map((p, i) => (
              <div key={p.id} className="flex items-center gap-3 py-1.5">
                <span className="text-white/40 text-sm w-6">{i + 4}</span>
                <span className="text-white text-sm font-medium flex-1">{p.nickname}</span>
                <span className="text-white/60 text-sm tabular-nums">{p.score.toLocaleString()}</span>
              </div>
            ))}
          </div>
        )}

        {players.length === 0 && (
          <p className="text-white/40 mb-6">No players joined this game</p>
        )}

        <div className="flex gap-3">
          <button
            onClick={() => { setPhase('lobby'); setSession(null); }}
            className="flex items-center gap-2 px-6 py-3 rounded-xl bg-white/10 text-white font-semibold hover:bg-white/20 transition-colors"
          >
            <RotateCcw className="w-4 h-4" /> Play Again
          </button>
          <button
            onClick={endGame}
            className="flex items-center gap-2 px-6 py-3 rounded-xl bg-slate-700 text-white font-semibold hover:bg-slate-600 transition-colors"
          >
            Back to Quizzes
          </button>
        </div>
      </div>
    );
  }

  return null;
}
