import { useState } from 'react';
import BubbleApp from './bubblemap/BubbleApp.jsx';
import LoginPage from './LoginPage.jsx';

// The bubble-map dashboard is the primary experience (portfolio tracker folded into
// the Robinhood-style side panel). The original detailed tracker lives in git history.
export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  return isAuthenticated
    ? <BubbleApp />
    : <LoginPage onLogin={() => setIsAuthenticated(true)} />;
}
