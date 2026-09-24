import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Users, Check, Clock, Trophy, AlertCircle, Gamepad2 } from 'lucide-react';
import { supabase, type GameSession, type Question, type Answer, type Player } from '@/lib/supabase';

type Phase = 'join' | 'nickname' | 'waiting' | 'question' | 'answered' | 'results' | 'final';

export default function PlayerView() {
  const navigate = useNavigate();
  const [phase, setPhase] = useState<Phase>('join');
  const [pin, setPin] = useState('');
  const [nickname, setNickname] = useState('');
  const [session, setSession] = useState<GameSession | null>(null);
  const [player, setPlayer] = useState<Player | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentQ, setCurrentQ] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [errorFade, setErrorFade] = useState(false);
  const [questionStartTime, setQuestionStartTime] = useState<number>(0);
  const [leaderboard, setLeaderboard] = useState<Player[]>([]);
  const [lastCorrect, setLastCorrect] = useState<boolean | null>(null);
  const [lastPoints, setLastPoints] = useState(0);
  const [playerCount, setPlayerCount] = useState(0);
  const answeredRef = useRef(false);

  // Find session by PIN
  const handlePinSubmit = async () => {
    setError('');
    if (pin.length !== 6) {
      setError('PIN must be 6 digits');
      return;
    }
    const { data, error: queryError } = await supabase
      .from('game_sessions')
      .select('*')
      .eq('pin_code', pin)
      .maybeSingle();
    if (queryError || !data) {
      setError('Game not found. Check the PIN and try again.');
      setErrorFade(true);
      setTimeout(() => setErrorFade(false), 300);
      return;
    }
    if (data.status === 'completed') {
      setError('This game has already ended.');
      return;
    }
    setSession(data);
    // Load quiz questions
    const { data: qs } = await supabase
      .from('questions')
      .select('*, answers(*)')
      .eq('quiz_id', data.quiz_id)
      .order('position');
    if (qs) {
      setQuestions(qs.map((q: Question) => ({
        ...q,
        answers: (q.answers || []).sort((a: Answer, b: Answer) => a.position - b.position),
      })));
    }
    setPhase('nickname');
  };

  // Join session
  const handleJoin = async () => {
    if (!session) return;
    setError('');
    if (nickname.trim().length < 1) {
      setError('Enter a nickname');
      return;
    }
    const { data, error: insertError } = await supabase
      .from('players')
      .insert({ session_id: session.id, nickname: nickname.trim() })
      .select()
      .single();
    if (insertError) {
      setError('Failed to join. Try a different nickname.');
      return;
    }
    setPlayer(data);
    setPhase('waiting');
  };

  // Subscribe to session changes
  useEffect(() => {
    if (!session || !player) return;

    const channel = supabase
      .channel(`player-${session.id}-${player.id}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'game_sessions', filter: `id=eq.${session.id}` },
        (payload) => {
          const updated = payload.new as GameSession;
          setSession(updated);
          if (updated.status === 'completed') {
            fetchLeaderboard();
            setPhase('final');
          } else if (updated.status === 'active' && (phase === 'waiting' || phase === 'results')) {
            const qIdx = updated.current_question_index;
            setCurrentQ(qIdx);
            setTimeLeft(questions[qIdx]?.time_limit || 20);
            setQuestionStartTime(updated.question_started_at ? new Date(updated.question_started_at).getTime() : Date.now());
            setSelectedAnswer(null);
            setLastCorrect(null);
            answeredRef.current = false;
            setPhase('question');
          }
        },
      )
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'players', filter: `session_id=eq.${session.id}` },
        async () => {
          const { data } = await supabase.from('players').select('*').eq('session_id', session.id);
          if (data) setPlayerCount(data.length);
        },
      )
      .subscribe();

    (async () => {
      const { data } = await supabase.from('players').select('*').eq('session_id', session.id);
      if (data) setPlayerCount(data.length);
    })();

    return () => { supabase.removeChannel(channel); };
  }, [session, player, phase, questions]);

  // Timer
  useEffect(() => {
    if (phase !== 'question' || timeLeft <= 0) return;
    const interval = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          clearInterval(interval);
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [phase, timeLeft]);

  // Auto-submit when time runs out
  useEffect(() => {
    if (phase === 'question' && timeLeft === 0 && !answeredRef.current) {
      submitAnswer(null);
    }
  }, [phase, timeLeft]);

  const fetchLeaderboard = async () => {
    if (!session) return;
    const { data } = await supabase.from('players').select('*').eq('session_id', session.id).order('score', { ascending: false });
    if (data) setLeaderboard(data);
  };

  const submitAnswer = async (answerId: string | null) => {
    if (!session || !player || !questions[currentQ] || answeredRef.current) return;
    answeredRef.current = true;

    const question = questions[currentQ];
    const answer = answerId ? question.answers?.find((a) => a.id === answerId) : null;
    const isCorrect = answer?.is_correct || false;

    const elapsed = Date.now() - questionStartTime;
    const answerTimeMs = Math.min(elapsed, question.time_limit * 1000);

    let pointsEarned = 0;
    if (isCorrect) {
      const remainingRatio = Math.max(0, 1 - answerTimeMs / (question.time_limit * 1000));
      pointsEarned = Math.round(question.points * (0.5 + remainingRatio * 0.5));
    }

    await supabase.from('player_answers').insert({
      player_id: player.id,
      session_id: session.id,
      question_id: question.id,
      answer_id: answerId,
      is_correct: isCorrect,
      points_earned: pointsEarned,
      answer_time_ms: answerTimeMs,
    });

    if (isCorrect && pointsEarned > 0) {
      const newScore = player.score + pointsEarned;
      await supabase.from('players').update({ score: newScore }).eq('id', player.id);
      setPlayer({ ...player, score: newScore });
    }

    setLastCorrect(isCorrect);
    setLastPoints(pointsEarned);
    setSelectedAnswer(answerId);
    setPhase('answered');
  };

  const handleAnswerClick = (answerId: string) => {
    if (answeredRef.current) return;
    submitAnswer(answerId);
  };

  // Wait for results phase to show leaderboard
  useEffect(() => {
    if (phase === 'answered') {
      const timeout = setTimeout(() => {
        fetchLeaderboard();
        setPhase('results');
      }, 4000);
      return () => clearTimeout(timeout);
    }
  }, [phase]);

  // JOIN PHASE
  if (phase === 'join') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex flex-col items-center justify-center p-6">
        <button onClick={() => navigate('/')} className="absolute top-6 left-6 flex items-center gap-2 text-white/60 hover:text-white transition-colors text-sm">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>

        <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-cyan-400 to-emerald-400 flex items-center justify-center shadow-2xl mb-6">
          <Gamepad2 className="w-10 h-10 text-white" />
        </div>
        <h1 className="text-3xl font-bold text-white mb-2">Join a Game</h1>
        <p className="text-white/40 text-sm mb-8">Enter the 6-digit game PIN</p>

        <div className="w-full max-w-xs">
          <input
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
            onKeyDown={(e) => e.key === 'Enter' && handlePinSubmit()}
            placeholder="000000"
            inputMode="numeric"
            autoFocus
            className={`w-full text-center text-4xl font-bold tracking-[0.5em] bg-white/10 text-white placeholder-white/20 rounded-2xl py-4 focus:outline-none border-2 transition-all ${
              error ? 'border-rose-500' : 'border-white/10 focus:border-cyan-400'
            } ${errorFade ? 'animate-[shake_0.4s_ease]' : ''}`}
          />
          {error && (
            <p className="text-rose-400 text-sm text-center mt-3 flex items-center justify-center gap-1.5">
              <AlertCircle className="w-4 h-4" /> {error}
            </p>
          )}
          <button
            onClick={handlePinSubmit}
            className="w-full mt-4 py-3.5 rounded-xl bg-gradient-to-r from-cyan-500 to-emerald-500 text-white font-bold hover:from-cyan-600 hover:to-emerald-600 transition-all shadow-lg"
          >
            Enter
          </button>
        </div>
      </div>
    );
  }

  // NICKNAME PHASE
  if (phase === 'nickname') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex flex-col items-center justify-center p-6">
        <button onClick={() => { setPhase('join'); setSession(null); }} className="absolute top-6 left-6 flex items-center gap-2 text-white/60 hover:text-white transition-colors text-sm">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>

        <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-cyan-400 to-emerald-400 flex items-center justify-center shadow-2xl mb-6">
          <Users className="w-10 h-10 text-white" />
        </div>
        <h1 className="text-3xl font-bold text-white mb-2">Joining Game</h1>
        <p className="text-white/40 text-sm mb-8">Enter your nickname</p>

        <div className="w-full max-w-xs">
          <input
            value={nickname}
            onChange={(e) => setNickname(e.target.value.slice(0, 15))}
            onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
            placeholder="Your nickname"
            autoFocus
            className={`w-full text-center text-2xl font-semibold bg-white/10 text-white placeholder-white/20 rounded-2xl py-4 focus:outline-none border-2 transition-all ${
              error ? 'border-rose-500' : 'border-white/10 focus:border-cyan-400'
            }`}
          />
          {error && (
            <p className="text-rose-400 text-sm text-center mt-3 flex items-center justify-center gap-1.5">
              <AlertCircle className="w-4 h-4" /> {error}
            </p>
          )}
          <button
            onClick={handleJoin}
            className="w-full mt-4 py-3.5 rounded-xl bg-gradient-to-r from-cyan-500 to-emerald-500 text-white font-bold hover:from-cyan-600 hover:to-emerald-600 transition-all shadow-lg"
          >
            Join Game
          </button>
        </div>
      </div>
    );
  }

  // WAITING PHASE
  if (phase === 'waiting') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex flex-col items-center justify-center p-6">
        <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-cyan-400 to-emerald-400 flex items-center justify-center shadow-2xl mb-6 animate-pulse">
          <Clock className="w-10 h-10 text-white" />
        </div>
        <h1 className="text-2xl font-bold text-white mb-2">You're in, {player?.nickname}!</h1>
        <p className="text-white/40 text-sm mb-8 text-center max-w-xs">
          Waiting for the host to start the game. Get ready!
        </p>
        <div className="flex items-center gap-2 bg-white/10 rounded-full px-4 py-2">
          <Users className="w-4 h-4 text-cyan-400" />
          <span className="text-white text-sm font-medium">{playerCount} players in lobby</span>
        </div>
      </div>
    );
  }

  // QUESTION PHASE
  if (phase === 'question' && questions[currentQ]) {
    const question = questions[currentQ];
    const answerColors = [
      { bg: 'bg-amber-400', hover: 'hover:bg-amber-500', icon: 'bg-amber-500' },
      { bg: 'bg-emerald-400', hover: 'hover:bg-emerald-500', icon: 'bg-emerald-500' },
      { bg: 'bg-sky-400', hover: 'hover:bg-sky-500', icon: 'bg-sky-500' },
      { bg: 'bg-rose-400', hover: 'hover:bg-rose-500', icon: 'bg-rose-500' },
    ];

    return (
      <div className="min-h-screen bg-slate-900 flex flex-col">
        {/* Top bar */}
        <div className="flex items-center justify-between px-6 py-4">
          <span className="text-white/60 text-sm font-medium">
            Question {currentQ + 1} of {questions.length}
          </span>
          <div className={`w-14 h-14 rounded-full ${timeLeft <= 5 ? 'bg-rose-500 animate-pulse' : 'bg-emerald-500'} flex items-center justify-center shadow-lg`}>
            <span className="text-2xl font-bold text-white tabular-nums">{timeLeft}</span>
          </div>
        </div>

        {/* Question */}
        <div className="flex-1 flex flex-col items-center justify-center px-6 py-4">
          <h2 className="text-xl sm:text-2xl font-bold text-white text-center mb-8 max-w-lg">
            {question.text}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-lg">
            {question.answers?.map((a, i) => {
              const c = answerColors[i] || answerColors[0];
              return (
                <button
                  key={a.id}
                  onClick={() => handleAnswerClick(a.id)}
                  className={`${c.bg} ${c.hover} rounded-2xl p-4 flex items-center gap-3 shadow-lg transition-all hover:scale-105 active:scale-95 text-left`}
                >
                  <div className={`w-9 h-9 rounded-lg ${c.icon} flex items-center justify-center text-white font-bold text-base flex-shrink-0`}>
                    {String.fromCharCode(65 + i)}
                  </div>
                  <span className="text-white font-semibold text-sm">{a.text}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // ANSWERED PHASE (waiting for others)
  if (phase === 'answered') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex flex-col items-center justify-center p-6">
        {lastCorrect ? (
          <>
            <div className="w-24 h-24 rounded-full bg-emerald-500 flex items-center justify-center shadow-2xl mb-4 animate-[bounce_0.5s_ease]">
              <Check className="w-14 h-14 text-white" strokeWidth={3} />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Correct!</h2>
            <p className="text-emerald-400 text-lg font-semibold">+{lastPoints.toLocaleString()} points</p>
          </>
        ) : (
          <>
            <div className="w-24 h-24 rounded-full bg-rose-500/20 border-2 border-rose-500/40 flex items-center justify-center shadow-2xl mb-4">
              <span className="text-5xl">!</span>
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Not quite right</h2>
            <p className="text-white/40 text-sm">Better luck next time!</p>
          </>
        )}
        <p className="text-white/30 text-sm mt-8">Waiting for other players...</p>
      </div>
    );
  }

  // RESULTS PHASE (mini leaderboard between questions)
  if (phase === 'results') {
    const sorted = [...leaderboard].sort((a, b) => b.score - a.score);
    const myRank = sorted.findIndex((p) => p.id === player?.id) + 1;
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex flex-col items-center justify-center p-6">
        <Trophy className="w-12 h-12 text-amber-400 mb-3" />
        <h2 className="text-xl font-bold text-white mb-1">Leaderboard</h2>
        <p className="text-white/40 text-sm mb-6">You're ranked #{myRank}</p>

        <div className="w-full max-w-md space-y-2">
          {sorted.slice(0, 5).map((p, i) => (
            <div
              key={p.id}
              className={`flex items-center gap-3 rounded-xl px-4 py-3 transition-all ${
                p.id === player?.id ? 'bg-cyan-500/20 border border-cyan-400/40' : 'bg-white/5'
              }`}
            >
              <span className={`text-lg font-bold w-8 ${i === 0 ? 'text-amber-400' : i === 1 ? 'text-slate-300' : i === 2 ? 'text-orange-400' : 'text-white/40'}`}>
                {i + 1}
              </span>
              <span className={`text-sm font-medium flex-1 ${p.id === player?.id ? 'text-cyan-300' : 'text-white'}`}>
                {p.nickname}
              </span>
              <span className="text-white/60 text-sm tabular-nums">{p.score.toLocaleString()}</span>
            </div>
          ))}
        </div>
        <p className="text-white/30 text-sm mt-6">Get ready for the next question...</p>
      </div>
    );
  }

  // FINAL PHASE
  if (phase === 'final') {
    const sorted = [...leaderboard].sort((a, b) => b.score - a.score);
    const myRank = sorted.findIndex((p) => p.id === player?.id) + 1;
    const myScore = player?.score || 0;

    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 flex flex-col items-center justify-center p-6">
        <Trophy className="w-16 h-16 text-amber-400 mb-3" />
        <h1 className="text-3xl font-bold text-white mb-1">Game Over!</h1>
        <p className="text-white/40 mb-6">You finished #{myRank} with {myScore.toLocaleString()} points</p>

        <div className="w-full max-w-md space-y-2 mb-6">
          {sorted.slice(0, 10).map((p, i) => (
            <div
              key={p.id}
              className={`flex items-center gap-3 rounded-xl px-4 py-3 ${
                p.id === player?.id ? 'bg-cyan-500/20 border border-cyan-400/40' : 'bg-white/5'
              }`}
            >
              <span className={`text-lg font-bold w-8 ${i === 0 ? 'text-amber-400' : i === 1 ? 'text-slate-300' : i === 2 ? 'text-orange-400' : 'text-white/40'}`}>
                {i + 1}
              </span>
              <span className={`text-sm font-medium flex-1 ${p.id === player?.id ? 'text-cyan-300' : 'text-white'}`}>
                {p.nickname}
              </span>
              <span className="text-white/60 text-sm tabular-nums">{p.score.toLocaleString()}</span>
            </div>
          ))}
        </div>

        <button
          onClick={() => navigate('/join')}
          className="px-6 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-emerald-500 text-white font-bold hover:from-cyan-600 hover:to-emerald-600 transition-all shadow-lg"
        >
          Play Another Game
        </button>
      </div>
    );
  }

  return null;
}
