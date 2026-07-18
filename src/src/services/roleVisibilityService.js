import { supabase, supabaseConfigured } from '../lib/supabaseClient';

const DEFAULTS = {
  Administrateur: { visible_tables: ['*'], visible_columns: {} },
  Coordonnateur: {
    visible_tables: [
      'Infrastructures',
      'Campagnes et visuels',
      'Répertoire des affiches',
      'Enjeux des cadres et supports',
      'Liste des arrêts',
      'Photos',
      'Bons de travail',
      'Historique des campagnes',
      'Suivi des EDT',
      'Clients'
    ],
    visible_columns: {}
  },
  Installateur: {
    visible_tables: [
      'Infrastructures',
      'Liste des arrêts',
      'Photos',
      'Bons de travail',
      'Enjeux des cadres et supports'
    ],
    visible_columns: {}
  },
  'Client-Admin': {
    visible_tables: [
      'Infrastructures',
      'Campagnes et visuels',
      'Photos',
      'Bons de travail',
      'Historique des campagnes',
      'Suivi des EDT'
    ],
    visible_columns: {}
  },
  Client: {
    visible_tables: [
      'Infrastructures',
      'Campagnes et visuels',
      'Photos'
    ],
    visible_columns: {}
  }
};

export async function getRoleVisibility(role) {
  const fallback = DEFAULTS[role] || { visible_tables: [], visible_columns: {} };

  if (!supabaseConfigured || !supabase) return fallback;

  const { data, error } = await supabase
    .from('role_ui_permissions')
    .select('*')
    .eq('role', role)
    .maybeSingle();

  if (error) {
    console.warn('[TDM] Permissions d’interface non disponibles:', error.message);
    return fallback;
  }

  return data || fallback;
}

export async function listRoleVisibility() {
  if (!supabaseConfigured || !supabase) {
    return Object.entries(DEFAULTS).map(([role, value]) => ({ role, ...value }));
  }

  const { data, error } = await supabase
    .from('role_ui_permissions')
    .select('*')
    .order('role');

  if (error) throw error;
  return data || [];
}

export async function saveRoleVisibility(permission) {
  if (!supabaseConfigured || !supabase) {
    throw new Error('Supabase n’est pas configuré.');
  }

  const payload = {
    role: permission.role,
    visible_tables: permission.visible_tables || [],
    visible_columns: permission.visible_columns || {},
    updated_at: new Date().toISOString()
  };

  const { data, error } = await supabase
    .from('role_ui_permissions')
    .upsert(payload, { onConflict: 'role' })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export function canSeeTable(permission, tableName) {
  const tables = permission?.visible_tables || [];
  return tables.includes('*') || tables.includes(tableName);
}

export function columnsForTable(permission, tableName, allColumns) {
  const configured = permission?.visible_columns?.[tableName];
  if (!Array.isArray(configured) || !configured.length) return allColumns;
  return allColumns.filter(column => configured.includes(column));
}
