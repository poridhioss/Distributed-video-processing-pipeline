import { Routes, Route } from 'react-router-dom';
import VideoList from './components/VideoList';
import VideoUpload from './components/VideoUpload';
import VideoPlayer from './components/VideoPlayer';
import './styles/App.css';

function App() {
  return (
    <div className="app">
      <Routes>
        <Route path="/" element={<VideoList />} />
        <Route path="/upload" element={<VideoUpload />} />
        <Route path="/watch/:videoId" element={<VideoPlayer />} />
      </Routes>
    </div>
  );
}

export default App;
