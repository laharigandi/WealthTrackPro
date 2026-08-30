import api from './api';

export const getMarketOverview = async () => {
  const response = await api.get('/market/quotes');
  return response.data;
};

export const getMarketQuote = async (symbol) => {
  const response = await api.get('/market/search', { params: { symbol } });
  return response.data;
};

export const getMarketQuotes = async (symbols) => {
  const response = await api.get('/market/quotes', {
    params: { symbols: Array.isArray(symbols) ? symbols.join(',') : symbols }
  });
  return response.data;
};

export const searchMarketSymbol = async (symbol) => {
  const response = await api.get('/market/search', { params: { symbol } });
  return response.data;
};
