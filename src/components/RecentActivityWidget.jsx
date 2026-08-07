import React, { useEffect, useState } from 'react';
import { AlertTriangle, BarChart3, Camera, ClipboardList, History, MapPin } from 'lucide-react';
import { listRecentBusinessActivity } from '../services/activityLogService';
import { activityObjectLabel, formatActivityDate, formatActivityLabel, recentActivityTarget } from '../lib/recentActivity';

const iconFor = event => {
  const module = `${event.module || ''} ${event.action || ''}`.toLocaleLowerCase('fr-CA');
  if (module.includes('photo')) return Camera;
  if (module.includes('terrain') || module.includes('synchron')) return MapPin;
  if (module.includes('campagne') || module.includes('rapport')) return BarChart3;
  if (module.includes('enjeu')) return AlertTriangle;
  return ClipboardList;
};

export function ActivityEvent({ event, onNavigate, role, permission }) {
  const Icon = iconFor(event);
  const target = recentActivityTarget(event, role, permission);
  const title = formatActivityLabel(event);
  const object = activityObjectLabel(event);
  const details = [event.actor_email, event.status].filter(Boolean).join(' · ');
  const content = <>
    <Icon className="activity-event-icon" aria-hidden="true"/>
    <div className="activity-event-content">
      <strong className="activity-event-title" title={title}>{title}</strong>
      {object && <span className="activity-event-object" title={object}>{object}</span>}
      {details && <span className="activity-event-details" title={details}>{details}</span>}
    </div>
    <time className="activity-event-date" dateTime={event.occurred_at}>{formatActivityDate(event.occurred_at)}</time>
  </>;
  return <li className={`activity-event${target ? ' is-clickable' : ''}`}>
    {target
      ? <button type="button" className="activity-event-link" onClick={() => onNavigate(target)} aria-label={`${title} — ouvrir ${target}`}>{content}</button>
      : <div className="activity-event-row">{content}</div>}
  </li>;
}

export default function RecentActivityWidget({ onNavigate, role, permission }) {
  const [events, setEvents] = useState([]);
  const [message, setMessage] = useState('');
  const canOpenJournal = ['Administrateur', 'Coordonnateur'].includes(role);
  async function reload() { try { setEvents(await listRecentBusinessActivity()); setMessage(''); } catch (error) { setEvents([]); setMessage(error.message); } }
  useEffect(() => { reload(); window.addEventListener('tos-terrain-data-updated', reload); return () => window.removeEventListener('tos-terrain-data-updated', reload); }, []);
  return <article className="executive-panel executive-activity">
    <header><div><span className="eyebrow">Temps réel</span><h2>Activité récente</h2></div><History/></header>
    {message && <div className="executive-empty">{message}</div>}
    {!message && (events.length ? <ol>{events.map(event => <ActivityEvent key={event.id} event={event} onNavigate={onNavigate} role={role} permission={permission}/>)}</ol> : <div className="executive-empty">Aucune activité récente.</div>)}
    {canOpenJournal && <button type="button" className="activity-journal-link" onClick={() => onNavigate('Journal des événements')}>Voir tout le journal</button>}
  </article>;
}
