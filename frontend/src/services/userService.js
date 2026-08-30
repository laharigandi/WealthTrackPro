import api from './api';

export const getProfile = async () => {
  const response = await api.get('/users/me');
  return response.data;
};

export const updateRiskProfile = async (riskProfile) => {
  const response = await api.patch('/users/me/risk-profile', { risk_profile: riskProfile });
  return response.data;
};

export const updateKYCStatus = async (kycStatus) => {
  const response = await api.patch('/users/me/kyc-status', { kyc_status: kycStatus });
  return response.data;
};