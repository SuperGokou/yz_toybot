import { useEffect } from 'react';
import { GradientBlobs } from './components/GradientBlobs';
import { Sidebar } from './components/Sidebar';
import { ChatView } from './views/ChatView';
import { SettingsView } from './views/SettingsView';
import { RegisterView } from './views/RegisterView';
import { useStore } from './store/useStore';
import { api } from './api/client';

function App() {
  const { status, setStatus, currentView, setCurrentView } = useStore();

  // Fetch initial status
  useEffect(() => {
    async function fetchStatus() {
      try {
        const data = await api.getStatus();
        // Always mark as ready so the app loads
        setStatus({
          ...data,
          status: 'ready',
        });
      } catch (error) {
        console.error('Failed to fetch status:', error);
        // Set as ready even if API fails so app doesn't hang
        setStatus({
          status: 'ready',
          ownerRegistered: true,
          robotName: 'VV',
          personality: 'friendly',
          parentRegistered: false,
        });
      }
    }

    fetchStatus();
  }, [setStatus, setCurrentView]);

  // Loading state
  if (status.status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <GradientBlobs />
        <div className="relative z-10 text-center">
          <div className="w-16 h-16 border-4 border-orange border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-brown font-semibold">Loading KidBot...</p>
        </div>
      </div>
    );
  }

  // Parent registration view
  if (currentView === 'register') {
    return (
      <div className="min-h-screen">
        <GradientBlobs />
        <div className="relative z-10">
          <RegisterView />
        </div>
      </div>
    );
  }

  // Render current view
  const renderView = () => {
    switch (currentView) {
      case 'settings':
        return <SettingsView />;
      case 'chat':
      default:
        return <ChatView />;
    }
  };

  // Main app
  return (
    <div className="min-h-screen">
      <GradientBlobs />
      <div className="relative z-10">
        <Sidebar />
        {renderView()}
      </div>
    </div>
  );
}

export default App;
