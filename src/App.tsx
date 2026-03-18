import React, { useEffect } from 'react';
import { AppRouter } from './app/router';
import { useSettingsStore } from './store/useAppStore';

function App() {
  useEffect(() => {
    useSettingsStore.getState().reload();
  }, []);

  return <AppRouter />;
}

export default App;
