import {useCallback, useEffect, useRef, useState} from 'react';
import useRefreshRequest from './useRefreshRequest';
import {DASHBOARD_TIMEOUT_MS, loadDashboardSummary} from '../services/dashboardService';

// No shared cache. Values belong only to this mounted user/role/client scope.
export default function useDashboardSummary(scope, enabled = true) {
  const controls = useRefreshRequest(scope, DASHBOARD_TIMEOUT_MS);
  const flight = useRef(null);
  const currentScope = useRef(scope);
  currentScope.current = scope;
  const [state, setState] = useState({scope, value:null, error:''});
  const refresh = useCallback(() => {
    if (!enabled) return Promise.resolve();
    if (flight.current?.scope === scope) return flight.current.promise;
    flight.current?.controller.abort();
    const holder = {scope, controller:new AbortController()};
    flight.current = holder;
    const request = controls.start();
    holder.promise = (async () => {
      try {
        const value = await request.wait(loadDashboardSummary({signal:holder.controller.signal}));
        if (request.isCurrent() && currentScope.current === scope) setState({scope, value, error:''});
      } catch (error) {
        if (request.isCurrent() && currentScope.current === scope) {
          setState(previous => ({scope, value:previous.scope === scope ? previous.value : null,
            error:error.message || 'Indicateurs indisponibles. Réessayez.'}));
        }
      } finally {
        holder.controller.abort();
        if (flight.current === holder) flight.current = null;
        request.finish();
      }
    })();
    return holder.promise;
  }, [scope, enabled]);
  useEffect(() => {
    refresh();
    const updated = () => refresh();
    window.addEventListener('tos-terrain-data-updated', updated);
    window.addEventListener('tos-reports-updated', updated);
    return () => {
      flight.current?.controller.abort();
      flight.current = null;
      window.removeEventListener('tos-terrain-data-updated', updated);
      window.removeEventListener('tos-reports-updated', updated);
    };
  }, [refresh]);
  const value = state.scope === scope ? state.value : null;
  const error = state.scope === scope ? state.error : '';
  return {value, error, loading:enabled && !value && !error, refreshing:controls.refreshing,
    refresh:controls.onClick(refresh)};
}
