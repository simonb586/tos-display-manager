import {useEffect, useRef, useState} from 'react';

// Keep loaded rows visible while a refresh runs. Only the latest request in the
// same role/context can publish data or errors. A stalled read remains retryable.
export default function useRefreshRequest(scope, timeoutMs = 20000) {
  const sequence = useRef(0);
  const clickLock = useRef(null);
  const currentScope = useRef(scope);
  currentScope.current = scope;
  const [refreshing, setRefreshing] = useState(false);
  useEffect(() => {
    clickLock.current = null;
    setRefreshing(false);
    return () => { sequence.current += 1; };
  }, [scope]);

  function start() {
    const id = ++sequence.current;
    const requestScope = currentScope.current;
    const isCurrent = () => id === sequence.current && requestScope === currentScope.current;
    setRefreshing(true);
    return {
      isCurrent,
      async wait(promise) {
        let timer;
        try {
          const value = await Promise.race([
            promise,
            new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Le chargement prend trop de temps. Réessayez.')), timeoutMs); })
          ]);
          if (!isCurrent()) throw new Error('refresh_superseded');
          return value;
        } finally { clearTimeout(timer); }
      },
      finish() { if (isCurrent()) setRefreshing(false); }
    };
  }
  function onClick(callback) {
    return event => {
      // React may batch several clicks before disabled is painted. Lock those
      // user events synchronously; programmatic/context loads can supersede.
      if (!event) return callback();
      if (clickLock.current) return;
      const token = {};
      clickLock.current = token;
      return Promise.resolve().then(() => callback()).finally(() => {
        if (clickLock.current === token) clickLock.current = null;
      });
    };
  }
  return {start, refreshing, onClick};
}
