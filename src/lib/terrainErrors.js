export function terrainErrorMessage(error, operation = 'save') {
  const code = String(error?.code || error?.statusCode || error?.status || '');
  const detail = String(error?.message || error || '');
  if (/Stock insuffisant|Associez le visuel à son article|Quantités de stock à renseigner|Choisissez un type de problème/.test(detail)) return detail;
  if (code === '42501' || code === '403' || /row.level security|permission|denied|not authorized/i.test(detail)) {
    return operation === 'save'
      ? 'Vous n’avez pas l’autorisation d’effectuer cette intervention.'
      : 'Vous n’avez pas l’autorisation d’accéder à ce contexte Terrain.';
  }
  if (/^22|^23/.test(code) || /context|phase_required|introuvable/i.test(detail)) {
    return 'Le contexte de l’intervention est invalide. Sélectionnez à nouveau le support et son EDT.';
  }
  if (/fetch|network|réseau|timeout|offline/i.test(detail)) {
    return 'La connexion au serveur est interrompue. Vérifiez votre connexion et réessayez.';
  }
  return operation === 'save'
    ? 'L’intervention n’a pas pu être enregistrée. Veuillez réessayer.'
    : 'Le contexte Terrain n’a pas pu être chargé. Veuillez réessayer.';
}
