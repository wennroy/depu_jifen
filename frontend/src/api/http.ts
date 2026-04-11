import axios from 'axios';

const http = axios.create({
  baseURL: '/api',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

http.interceptors.request.use((config) => {
  const token = localStorage.getItem('depu_user_token');
  if (token) {
    config.headers['X-User-Token'] = token;
  }
  return config;
});

export default http;
