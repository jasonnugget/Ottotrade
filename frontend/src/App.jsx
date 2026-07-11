import { useState } from 'react';
import AppShell from './layout/AppShell.jsx';
import LoginPage from './LoginPage.jsx';

// AppShell renders the left sidebar (Home / Portfolio / Explore / Events / Guidance)
// and each tab's content from its own folder under features/. See features/*/ for
// the individual tabs.
export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  return isAuthenticated
    ? <AppShell />
    : <LoginPage onLogin={() => setIsAuthenticated(true)} />;
}
