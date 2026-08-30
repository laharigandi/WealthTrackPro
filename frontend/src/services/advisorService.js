import api from './api';

/** GET /api/v1/advisor/rebalancing */
export const getRebalancingAdvice = async () => {
  const { data } = await api.get('/advisor/rebalancing');
  return data;
};
