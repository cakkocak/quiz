import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Trash2, Check, ArrowLeft, Save, GripVertical, Image, Clock, Star } from 'lucide-react';
import { supabase, type Quiz, type Question, type Answer, COLOR_OPTIONS, getColor } from '@/lib/supabase';

type Props = {
  quizId?: string;
};

type QuestionDraft = {
  id: string;
  text: string;
  image_url: string;
  time_limit: number;
  points: number;
  position: number;
  answers: AnswerDraft[];
};

type AnswerDraft = {
  id: string;
  text: string;
  is_correct: boolean;
  position: number;
};

export default function QuizEditor({ quizId }: Props) {
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [coverColor, setCoverColor] = useState('blue');
  const [questions, setQuestions] = useState<QuestionDraft[]>([]);
  const [loading, setLoading] = useState(!!quizId);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const uid = () => crypto.randomUUID();

  const blankQuestion = useCallback((): QuestionDraft => ({
    id: uid(),
    text: '',
    image_url: '',
    time_limit: 20,
    points: 1000,
    position: 0,
    answers: [
      { id: uid(), text: '', is_correct: true, position: 0 },
      { id: uid(), text: '', is_correct: false, position: 1 },
      { id: uid(), text: '', is_correct: false, position: 2 },
      { id: uid(), text: '', is_correct: false, position: 3 },
    ],
  }), []);

  useEffect(() => {
    if (!quizId) {
      setQuestions([blankQuestion()]);
      return;
    }
    (async () => {
      setLoading(true);
      const [{ data: quiz }, { data: qs }] = await Promise.all([
        supabase.from('quizzes').select('*').eq('id', quizId).maybeSingle(),
        supabase.from('questions').select('*, answers(*)').eq('quiz_id', quizId).order('position'),
      ]);
      if (quiz) {
        setTitle(quiz.title);
        setDescription(quiz.description || '');
        setCoverColor(quiz.cover_color || 'blue');
      }
      if (qs && qs.length > 0) {
        const drafts: QuestionDraft[] = qs.map((q: Question, i: number) => ({
          id: q.id,
          text: q.text,
          image_url: q.image_url || '',
          time_limit: q.time_limit,
          points: q.points,
          position: i,
          answers: (q.answers || [])
            .sort((a: Answer, b: Answer) => a.position - b.position)
            .map((a: Answer) => ({
              id: a.id,
              text: a.text,
              is_correct: a.is_correct,
              position: a.position,
            })),
        }));
        setQuestions(drafts);
      } else {
        setQuestions([blankQuestion()]);
      }
      setLoading(false);
    })();
  }, [quizId, blankQuestion]);

  const addQuestion = () => {
    setQuestions((prev) => [...prev, { ...blankQuestion(), position: prev.length }]);
  };

  const removeQuestion = (idx: number) => {
    setQuestions((prev) => prev.filter((_, i) => i !== idx).map((q, i) => ({ ...q, position: i })));
  };

  const updateQuestion = (idx: number, patch: Partial<QuestionDraft>) => {
    setQuestions((prev) => prev.map((q, i) => (i === idx ? { ...q, ...patch } : q)));
  };

  const updateAnswer = (qIdx: number, aIdx: number, patch: Partial<AnswerDraft>) => {
    setQuestions((prev) =>
      prev.map((q, i) =>
        i === qIdx
          ? { ...q, answers: q.answers.map((a, j) => (j === aIdx ? { ...a, ...patch } : a)) }
          : q,
      ),
    );
  };

  const setCorrectAnswer = (qIdx: number, aIdx: number) => {
    setQuestions((prev) =>
      prev.map((q, i) =>
        i === qIdx
          ? { ...q, answers: q.answers.map((a, j) => ({ ...a, is_correct: j === aIdx })) }
          : q,
      ),
    );
  };

  const validate = (): string | null => {
    if (!title.trim()) return 'Please enter a quiz title';
    if (questions.length === 0) return 'Add at least one question';
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      if (!q.text.trim()) return `Question ${i + 1} is missing text`;
      const hasCorrect = q.answers.some((a) => a.is_correct && a.text.trim());
      if (!hasCorrect) return `Question ${i + 1} needs a correct answer with text`;
      const filledAnswers = q.answers.filter((a) => a.text.trim());
      if (filledAnswers.length < 2) return `Question ${i + 1} needs at least 2 answers`;
    }
    return null;
  };

  const handleSave = async () => {
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }
    setError('');
    setSaving(true);
    try {
      let id = quizId;
      if (quizId) {
        await supabase.from('quizzes').update({
          title: title.trim(),
          description: description.trim(),
          cover_color: coverColor,
        }).eq('id', quizId);
        await supabase.from('questions').delete().eq('quiz_id', quizId);
      } else {
        const { data, error: insertError } = await supabase.from('quizzes').insert({
          title: title.trim(),
          description: description.trim(),
          cover_color: coverColor,
        }).select().single();
        if (insertError) throw insertError;
        id = data.id;
      }

      for (let i = 0; i < questions.length; i++) {
        const q = questions[i];
        const { data: qData, error: qError } = await supabase.from('questions').insert({
          quiz_id: id,
          text: q.text.trim(),
          image_url: q.image_url || '',
          time_limit: q.time_limit,
          points: q.points,
          position: i,
        }).select().single();
        if (qError) throw qError;
        const filledAnswers = q.answers.filter((a) => a.text.trim());
        for (let j = 0; j < filledAnswers.length; j++) {
          await supabase.from('answers').insert({
            question_id: qData.id,
            text: filledAnswers[j].text.trim(),
            is_correct: filledAnswers[j].is_correct,
            position: j,
          });
        }
      }
      navigate('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save quiz');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-pulse text-slate-400">Loading quiz...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className={`bg-gradient-to-r ${getColor(coverColor).bg} px-6 py-8 rounded-b-3xl shadow-lg`}>
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-3 mb-6">
            <button
              onClick={() => navigate('/')}
              className="flex items-center gap-2 text-white/80 hover:text-white transition-colors text-sm font-medium"
            >
              <ArrowLeft className="w-4 h-4" /> Back to quizzes
            </button>
          </div>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Enter quiz title..."
            className="w-full bg-transparent text-white text-3xl font-bold placeholder-white/50 focus:outline-none mb-3"
          />
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Add a description..."
            className="w-full bg-transparent text-white/80 text-base placeholder-white/40 focus:outline-none"
          />
          <div className="flex items-center gap-2 mt-5">
            <span className="text-white/70 text-sm font-medium mr-2">Theme:</span>
            {COLOR_OPTIONS.map((c) => (
              <button
                key={c.name}
                onClick={() => setCoverColor(c.name)}
                className={`w-7 h-7 rounded-full ${c.solid} transition-all ${
                  coverColor === c.name ? 'ring-4 ring-white ring-offset-2 ring-offset-transparent scale-110' : 'hover:scale-110'
                }`}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Questions */}
      <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">
        {questions.map((q, qIdx) => (
          <div key={q.id} className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 bg-slate-50 border-b border-slate-200">
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-lg ${getColor(coverColor).solid} text-white flex items-center justify-center font-bold text-sm`}>
                  {qIdx + 1}
                </div>
                <span className="text-sm font-semibold text-slate-600">Question {qIdx + 1}</span>
              </div>
              {questions.length > 1 && (
                <button
                  onClick={() => removeQuestion(qIdx)}
                  className="text-slate-400 hover:text-rose-500 transition-colors p-1.5 hover:bg-rose-50 rounded-lg"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
            <div className="p-5 space-y-4">
              <textarea
                value={q.text}
                onChange={(e) => updateQuestion(qIdx, { text: e.target.value })}
                placeholder="Type your question here..."
                rows={2}
                className="w-full text-lg font-medium text-slate-800 placeholder-slate-300 focus:outline-none resize-none border-b-2 border-slate-100 focus:border-slate-300 pb-2 transition-colors"
              />
              <div className="flex items-center gap-4 flex-wrap">
                <label className="flex items-center gap-2 text-sm text-slate-500">
                  <Clock className="w-4 h-4" />
                  <select
                    value={q.time_limit}
                    onChange={(e) => updateQuestion(qIdx, { time_limit: Number(e.target.value) })}
                    className="border border-slate-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-200"
                  >
                    {[5, 10, 15, 20, 30, 45, 60, 90].map((s) => (
                      <option key={s} value={s}>{s}s</option>
                    ))}
                  </select>
                </label>
                <label className="flex items-center gap-2 text-sm text-slate-500">
                  <Star className="w-4 h-4" />
                  <select
                    value={q.points}
                    onChange={(e) => updateQuestion(qIdx, { points: Number(e.target.value) })}
                    className="border border-slate-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-200"
                  >
                    {[500, 1000, 2000].map((p) => (
                      <option key={p} value={p}>{p} pts</option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {q.answers.map((a, aIdx) => {
                  const answerColors = [
                    'border-amber-400 bg-amber-50',
                    'border-emerald-400 bg-emerald-50',
                    'border-sky-400 bg-sky-50',
                    'border-rose-400 bg-rose-50',
                  ];
                  return (
                    <div
                      key={a.id}
                      className={`relative rounded-xl border-2 ${answerColors[aIdx]} p-3 transition-all`}
                    >
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setCorrectAnswer(qIdx, aIdx)}
                          className={`flex-shrink-0 w-6 h-6 rounded-full border-2 transition-all flex items-center justify-center ${
                            a.is_correct
                              ? 'bg-emerald-500 border-emerald-500'
                              : 'border-slate-300 hover:border-slate-400'
                          }`}
                        >
                          {a.is_correct && <Check className="w-4 h-4 text-white" />}
                        </button>
                        <input
                          value={a.text}
                          onChange={(e) => updateAnswer(qIdx, aIdx, { text: e.target.value })}
                          placeholder={`Answer ${aIdx + 1}`}
                          className="flex-1 bg-transparent text-slate-700 placeholder-slate-400 focus:outline-none text-sm font-medium"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
              <p className="text-xs text-slate-400 flex items-center gap-1">
                <Check className="w-3 h-3 text-emerald-500" />
                Click the circle to mark the correct answer
              </p>
            </div>
          </div>
        ))}

        <button
          onClick={addQuestion}
          className="w-full py-4 rounded-2xl border-2 border-dashed border-slate-300 text-slate-500 hover:border-slate-400 hover:text-slate-600 transition-colors flex items-center justify-center gap-2 font-medium"
        >
          <Plus className="w-5 h-5" /> Add Question
        </button>

        {error && (
          <div className="bg-rose-50 border border-rose-200 text-rose-600 rounded-xl px-4 py-3 text-sm font-medium">
            {error}
          </div>
        )}

        <div className="flex items-center justify-end gap-3 pb-8">
          <button
            onClick={() => navigate('/')}
            className="px-5 py-2.5 rounded-xl text-slate-600 font-medium hover:bg-slate-100 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-2.5 rounded-xl bg-slate-800 text-white font-semibold hover:bg-slate-900 transition-colors flex items-center gap-2 disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Saving...' : quizId ? 'Save Changes' : 'Create Quiz'}
          </button>
        </div>
      </div>
    </div>
  );
}
