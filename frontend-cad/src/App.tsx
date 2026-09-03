import { useState } from 'react';
import Landing from './components/Landing';
import CadWorkspace from './components/CadWorkspace';
import './index.css';

function App() {
  const [started, setStarted] = useState(false);

  return (
    <div className="w-full h-full">
      {!started ? (
        <Landing onStart={() => setStarted(true)} />
      ) : (
        <CadWorkspace />
      )}
    </div>
  );
}

export default App;
