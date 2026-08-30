import api from './api';

/** POST /api/v1/calculator/sip-inflation */
export const calculateSIPInflation = async (payload) => {
  const { data } = await api.post('/calculator/sip-inflation', payload);
  return data;
};

/** POST /api/v1/calculator/sip */
export const calculateSIP = async (payload) => {
  const { data } = await api.post('/calculator/sip', payload);
  return data;
};

/** POST /api/v1/calculator/retirement */
export const calculateRetirement = async (payload) => {
  const { data } = await api.post('/calculator/retirement', payload);
  return data;
};

/** POST /api/v1/calculator/loan */
export const calculateLoan = async (payload) => {
  const { data } = await api.post('/calculator/loan', payload);
  return data;
};
