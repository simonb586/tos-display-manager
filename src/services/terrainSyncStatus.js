import { supabase, supabaseConfigured } from '../lib/supabaseClient';
import { normalize } from '../lib/utils';

const isPending = status => ['attente', 'pending', 'queued', 'a synchroniser']
  .some(value => normalize(status).includes(value));
const isFailure = status => ['erreur', 'echec', 'failed', 'error']
  .some(value => normalize(status).includes(value));

export async function loadTerrainSyncStatus() {
  if (!supabaseConfigured || !supabase) return 'État global non centralisé';

  const { data, error } = await supabase
    .from('terrain_sync_diagnostics')
    .select('id,reference,created_at,statut')
    .order('created_at', { ascending: false })
    .limit(1000);

  if (error) return 'État global non centralisé';

  const rows = data || [];
  const currentByOperation = [...new Map(rows.map(row => [row.reference || row.id, row])).values()];
  const pending = currentByOperation.filter(row => isPending(row.statut)).length;
  if (pending) return `${pending.toLocaleString('fr-CA')} en attente`;

  const failures = currentByOperation.filter(row => isFailure(row.statut)).length;
  if (failures) return `${failures.toLocaleString('fr-CA')} erreur${failures > 1 ? 's' : ''}`;

  const lastSync = rows.find(row => row.created_at);
  if (lastSync) {
    const time = new Intl.DateTimeFormat('fr-CA', { hour: '2-digit', minute: '2-digit' })
      .format(new Date(lastSync.created_at));
    return `Dernière synchro : ${time}`;
  }

  return 'Aucune synchronisation enregistrée';
}
