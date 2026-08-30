import api from './api';

/** GET /api/v1/report/wealth */
export const getWealthReport = async () => {
  const { data } = await api.get('/report/wealth');
  return data;
};
