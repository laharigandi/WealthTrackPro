import api from './api';

export const loginUser = async (credentials) => {
  const payload = {
    email: credentials.email ? credentials.email.trim() : '',
    password: credentials.password,
  };
  const response = await api.post('/auth/login', payload);
  return response.data;
};

export const registerUser = async (userData) => {
  const payload = {
    name: userData.name ? userData.name.trim() : '',
    email: userData.email ? userData.email.trim() : '',
    password: userData.password,
  };
  const response = await api.post('/auth/register', payload);
  return response.data;
};