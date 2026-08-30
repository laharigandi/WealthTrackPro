import api from './api';

export const getTransactions = async () => {
  const response = await api.get('/transactions');
  return response.data;
};

export const createTransaction = async (data) => {
  const response = await api.post('/transactions', data);
  return response.data;
};
