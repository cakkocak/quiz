import { BrowserRouter, Routes, Route } from 'react-router-dom';
import QuizList from '@/components/QuizList';
import QuizEditor from '@/components/QuizEditor';
import HostView from '@/components/HostView';
import PlayerView from '@/components/PlayerView';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<QuizList />} />
        <Route path="/create" element={<QuizEditor />} />
        <Route path="/edit/:quizId" element={<QuizEditorWrapper />} />
        <Route path="/host/:quizId" element={<HostViewWrapper />} />
        <Route path="/join" element={<PlayerView />} />
      </Routes>
      <!-- Google tag (gtag.js) -->
      <script async src="https://www.googletagmanager.com/gtag/js?id=G-WXJGB5P4QK"></script>
      <script>
        window.dataLayer = window.dataLayer || [];
        function gtag(){dataLayer.push(arguments);}
        gtag('js', new Date());

        gtag('config', 'G-WXJGB5P4QK');
      </script>
    </BrowserRouter>
  );
}

import { useParams } from 'react-router-dom';

function QuizEditorWrapper() {
  const { quizId } = useParams();
  return <QuizEditor quizId={quizId} />;
}

function HostViewWrapper() {
  const { quizId } = useParams();
  return <HostView quizId={quizId!} />;
}

export default App;
