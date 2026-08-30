import api from './api';

export const getPortfolio = async () => {
  const response = await api.get('/portfolio');
  return response.data;
};

export const createPortfolioItem = async (data) => {
  const response = await api.post('/portfolio', data);
  return response.data;
};

export const updatePortfolioItem = async (id, data) => {
  const response = await api.patch(`/portfolio/${id}`, data);
  return response.data;
};

export const deletePortfolioItem = async (id) => {
  const response = await api.delete(`/portfolio/${id}`);
  return response.data;
};
