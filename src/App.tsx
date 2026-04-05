import { Player } from './components/Player';
import { InstallPrompt } from './components/InstallPrompt/InstallPrompt';

function App() {
  return (
    <div className="w-full h-full">
      <Player />
      <InstallPrompt />
    </div>
  );
}

export default App;
