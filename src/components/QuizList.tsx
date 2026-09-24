import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Play, Users, FileText, Trash2, Search, Zap, Trophy, Gamepad2 } from 'lucide-react';
import { supabase, type Quiz, type Question, getColor } from '@/lib/supabase';

export default function QuizList() {
  const navigate = useNavigate();
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [questionCounts, setQuestionCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from('quizzes')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) {
        setLoading(false);
        return;
      }
      setQuizzes(data || []);
      const counts: Record<string, number> = {};
      for (const q of data || []) {
        const { count } = await supabase
          .from('questions')
          .select('id', { count: 'exact', head: true })
          .eq('quiz_id', q.id);
        counts[q.id] = count || 0;
      }
      setQuestionCounts(counts);
      setLoading(false);
    })();
  }, []);

  const handleDelete = async (id: string) => {
    await supabase.from('quizzes').delete().eq('id', id);
    setQuizzes((prev) => prev.filter((q) => q.id !== id));
  };

  const filtered = quizzes.filter((q) =>
    q.title.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100">
      {/* Hero Header */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 px-6 py-16 rounded-b-[2.5rem] shadow-2xl relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-10 left-20 w-64 h-64 rounded-full bg-cyan-400 blur-3xl" />
          <div className="absolute bottom-0 right-10 w-72 h-72 rounded-full bg-emerald-400 blur-3xl" />
        </div>
        <div className="max-w-6xl mx-auto relative">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-cyan-400 to-emerald-400 flex items-center justify-center shadow-lg">
              <Zap className="w-7 h-7 text-white" fill="white" />
            </div>
            <h1 className="text-3xl font-bold text-white tracking-tight">QuizWiz</h1>
          </div>
          <p className="text-slate-300 text-lg mb-8 max-w-xl">
            Create engaging quizzes, host live game sessions, and watch players compete in real-time.
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={() => navigate('/create')}
              className="flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-white text-slate-900 font-semibold hover:bg-slate-100 transition-all hover:scale-105 shadow-lg"
            >
              <Plus className="w-5 h-5" /> Create Quiz
            </button>
            <button
              onClick={() => navigate('/join')}
              className="flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-white/10 backdrop-blur text-white font-semibold hover:bg-white/20 transition-all border border-white/20"
            >
              <Gamepad2 className="w-5 h-5" /> Join a Game
            </button>
          </div>
        </div>
      </div>

      {/* Quiz Grid */}
      <div className="max-w-6xl mx-auto px-6 py-10">
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <h2 className="text-xl font-bold text-slate-800">Your Quizzes</h2>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search quizzes..."
              className="pl-9 pr-4 py-2 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-slate-200 w-64"
            />
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white rounded-2xl h-48 animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-20 h-20 rounded-3xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
              <FileText className="w-10 h-10 text-slate-300" />
            </div>
            <h3 className="text-lg font-semibold text-slate-600 mb-1">
              {search ? 'No quizzes found' : 'No quizzes yet'}
            </h3>
            <p className="text-slate-400 text-sm mb-6">
              {search ? 'Try a different search term' : 'Create your first quiz to get started'}
            </p>
            {!search && (
              <button
                onClick={() => navigate('/create')}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-800 text-white font-semibold hover:bg-slate-900 transition-colors"
              >
                <Plus className="w-4 h-4" /> Create Quiz
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {filtered.map((quiz) => {
              const color = getColor(quiz.cover_color);
              return (
                <div
                  key={quiz.id}
                  className="group bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden hover:shadow-xl transition-all hover:-translate-y-1"
                >
                  <div className={`h-28 bg-gradient-to-br ${color.bg} relative flex items-center justify-center`}>
                    <span className="text-white/90 text-4xl font-bold opacity-30">
                      {quiz.title.charAt(0).toUpperCase()}
                    </span>
                    <div className="absolute top-3 right-3 flex items-center gap-1.5 bg-white/20 backdrop-blur rounded-full px-2.5 py-1">
                      <FileText className="w-3 h-3 text-white" />
                      <span className="text-white text-xs font-semibold">{questionCounts[quiz.id] || 0}</span>
                    </div>
                  </div>
                  <div className="p-5">
                    <h3 className="font-bold text-slate-800 text-lg mb-1 truncate">{quiz.title}</h3>
                    <p className="text-slate-400 text-sm mb-4 line-clamp-2 min-h-[2.5rem]">
                      {quiz.description || 'No description'}
                    </p>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => navigate(`/host/${quiz.id}`)}
                        className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl ${color.solid} text-white font-semibold text-sm hover:opacity-90 transition-opacity`}
                      >
                        <Play className="w-4 h-4" fill="white" /> Host
                      </button>
                      <button
                        onClick={() => navigate(`/edit/${quiz.id}`)}
                        className="px-3 py-2.5 rounded-xl bg-slate-100 text-slate-600 font-semibold text-sm hover:bg-slate-200 transition-colors"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(quiz.id)}
                        className="px-3 py-2.5 rounded-xl bg-slate-100 text-slate-400 hover:text-rose-500 hover:bg-rose-50 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Feature badges */}
      <div className="max-w-6xl mx-auto px-6 pb-12">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { icon: Zap, title: 'Live Games', desc: 'Host real-time quiz sessions with PIN codes', color: 'text-amber-500' },
            { icon: Trophy, title: 'Leaderboards', desc: 'Track scores and rank players instantly', color: 'text-emerald-500' },
            { icon: Users, title: 'Multiplayer', desc: 'Multiple players join and compete', color: 'text-cyan-500' },
          ].map((f) => (
            <div key={f.title} className="flex items-center gap-3 bg-white rounded-xl border border-slate-200 p-4">
              <div className={`w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center ${f.color}`}>
                <f.icon className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-semibold text-slate-700 text-sm">{f.title}</h4>
                <p className="text-slate-400 text-xs">{f.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
