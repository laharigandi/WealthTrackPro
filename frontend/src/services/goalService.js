import api from './api';

export const getGoals = async () => {
  const response = await api.get('/goals');
  return response.data;
};

export const createGoal = async (data) => {
  const response = await api.post('/goals', data);
  return response.data;
};

export const getGoalById = async (id) => {
  const response = await api.get(`/goals/${id}`);
  return response.data;
};

export const updateGoal = async (id, data) => {
  const response = await api.patch(`/goals/${id}`, data);
  return response.data;
};

export const deleteGoal = async (id) => {
  const response = await api.delete(`/goals/${id}`);
  return response.data;
};

export const simulateGoal = async (id, data) => {
  const response = await api.post(`/goals/${id}/simulate`, data);
  return response.data;
};
