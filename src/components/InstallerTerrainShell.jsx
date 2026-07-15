import React, { useEffect, useState } from 'react';
import {
  CheckCircle2,
  Cloud,
  CloudOff,
  LogOut,
  RefreshCw,
  Smartphone
} from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import TerrainApp from './TerrainApp';

export default function InstallerTerrainShell({
  dataStore,
  role,
  session,
  profile,
  onLogout
}) {
  const [online, setOnline] = useState(navigator.onLine);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);

    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);

    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  async function logout() {
    setLoggingOut(true);

    try {
      await supabase.auth.signOut();
    } finally {
      onLogout?.();
      setLoggingOut(false);
    }
  }

  return (
    <div className="installer-shell">
      <header className="installer-shell-header">
        <div className="installer-shell-brand">
          <div className="installer-shell-logo">
            <Smartphone size={23}/>
          </div>
          <div>
            <strong>TOS Terrain</strong>
            <span>Application installateur</span>
          </div>
        </div>

        <div className="installer-shell-account">
          <div className={`installer-sync-state ${online ? 'online' : 'offline'}`}>
            {online ? <Cloud size={17}/> : <CloudOff size={17}/>}
            <span>{online ? 'En ligne' : 'Hors ligne'}</span>
          </div>

          <div className="installer-shell-user">
            <strong>{profile?.nom || session?.user?.email}</strong>
            <span>Installateur</span>
          </div>

          <button
            className="installer-shell-logout"
            disabled={loggingOut}
            onClick={logout}
          >
            {loggingOut ? <RefreshCw className="spin" size={17}/> : <LogOut size={17}/>}
            <span>Déconnexion</span>
          </button>
        </div>
      </header>

      <main className="installer-shell-main">
        <div className="installer-welcome-strip">
          <CheckCircle2 size={18}/>
          <span>Tu es connecté directement à ton espace terrain.</span>
        </div>

        <TerrainApp
          dataStore={dataStore}
          role={role}
          session={session}
        />
      </main>
    </div>
  );
}
