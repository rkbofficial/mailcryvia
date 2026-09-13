import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';

const EVENT_MAP = {
  campaigns:   [['campaigns'], ['overview'], ['analytics-overview'], ['analytics-campaigns']],
  contacts:    [['contacts'], ['overview'], ['lists'], ['list-contacts']],
  lists:       [['lists'], ['list-contacts']],
  templates:   [['templates']],
  automations: [['automations']],
  analytics:   [['analytics-overview'], ['analytics-campaigns'], ['analytics-automations'], ['overview']],
  billing:     [['billing'], ['my-requests'], ['payment-status'], ['plans']],
  settings:    [['settings'], ['payment-info'], ['admin-pay-info'], ['admin-gw-settings'], ['payment-status']],
  admin:       [['admin-stats'], ['admin-revenue'], ['admin-users'], ['admin-subs'], ['admin-plans'], ['admin-pay-reqs'], ['plans'], ['billing']],
};

export function useRealtime() {
  const qc = useQueryClient();
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    if (!isAuthenticated) return;

    const base = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? 'http://localhost:4000' : '');
    const es = new EventSource(`${base}/api/events/stream`, { withCredentials: true });

    Object.entries(EVENT_MAP).forEach(([event, keys]) => {
      es.addEventListener(event, () => {
        keys.forEach(key => qc.invalidateQueries({ queryKey: key }));
      });
    });

    es.onerror = () => {};

    return () => es.close();
  }, [qc, isAuthenticated]);
}