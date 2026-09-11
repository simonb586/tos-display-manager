import React, { useEffect, useState } from 'react';
import {
  CheckCircle2,
  Cloud,
  CloudOff,
  LogOut,
  RefreshCw
} from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import TerrainApp from './TerrainApp';
import BrandLogo from './BrandLogo';
import BusinessTable from './BusinessTable';
import InteractiveMap from './InteractiveMap';
import {canSeeTable} from '../services/roleVisibilityService';

export default function InstallerTerrainShell({
  dataStore,
  role,
  session,
  profile,
  onLogout,
  permission
}) {
  const [online, setOnline] = useState(navigator.onLine);
  const [loggingOut, setLoggingOut] = useState(false);
  const [view,setView]=useState('terrain');
  const [mapRows,setMapRows]=useState(null);

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
          <div className="installer-shell-logo"><BrandLogo/></div>
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

        {canSeeTable(permission,'Infrastructures')&&<nav><button onClick={()=>setView('terrain')}>Terrain</button><button onClick={()=>setView('infrastructures')}>Infrastructures</button></nav>}
        <div hidden={view!=='terrain'}><TerrainApp
          dataStore={dataStore}
          role={role}
          session={session}
        /></div>
        {view==='infrastructures'&&<><div hidden={mapRows!==null}><BusinessTable name="Infrastructures" dataStore={dataStore} role={role} rolePermission={permission} onOpenMap={(id,context)=>setMapRows(context?.mapRows||dataStore?.Infrastructures?.rows||[])}/></div>{mapRows!==null&&<><button onClick={()=>setMapRows(null)}>Tableau</button><InteractiveMap role={role} dataStore={{Infrastructures:{rows:mapRows}}}/></>}</>}
      </main>
    </div>
  );
}
