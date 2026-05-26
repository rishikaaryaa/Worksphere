const API_BASE = '/api';

const API = {
  getToken() { return localStorage.getItem('office_auth_token'); },
  setSession(token, user) { localStorage.setItem('office_auth_token', token); localStorage.setItem('office_user', JSON.stringify(user)); },
  getSavedUser() { const u = localStorage.getItem('office_user'); return u ? JSON.parse(u) : null; },
  clearSession() { localStorage.removeItem('office_auth_token'); localStorage.removeItem('office_user'); },

  async request(endpoint, options = {}) {
    const url = `${API_BASE}${endpoint}`;
    const headers = { 'Content-Type': 'application/json', ...options.headers };
    const token = this.getToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const config = { ...options, headers };
    try {
      const response = await fetch(url, config);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Server error occurred');
      return data;
    } catch (error) { console.error(`API Error on ${endpoint}:`, error); throw error; }
  },

  async login(email, password) { const data = await this.request('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }); this.setSession(data.token, data.user); return data; },
  async signup(name, email, password) { return await this.request('/auth/signup', { method: 'POST', body: JSON.stringify({ name, email, password }) }); },
  async getProfile() { try { const data = await this.request('/auth/me'); localStorage.setItem('office_user', JSON.stringify(data)); return data; } catch (e) { this.clearSession(); throw e; } },
  async logout() { try { await this.request('/auth/logout', { method: 'POST' }); } catch (e) { console.warn('Logout failed:', e); } finally { this.clearSession(); } },
  async forgotPassword(email) { return await this.request('/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) }); },
  async resetPassword(email, otp, newPassword) { return await this.request('/auth/reset-password', { method: 'POST', body: JSON.stringify({ email, otp, newPassword }) }); },
  async getWorkList() { return await this.request('/work'); },
  async submitWork(clientName, clientEmail, notes) { return await this.request('/work', { method: 'POST', body: JSON.stringify({ clientName, clientEmail, notes }) }); },
  async deleteWork(id) { return await this.request(`/work/${id}`, { method: 'DELETE' }); },
  async getUsers() { return await this.request('/users'); },
  async createUser(name, email, password, role) { return await this.request('/users', { method: 'POST', body: JSON.stringify({ name, email, password, role }) }); },
  async deleteUser(id) { return await this.request(`/users/${id}`, { method: 'DELETE' }); },
  async changeUserPassword(id, newPassword) { return await this.request(`/users/${id}/change-password`, { method: 'POST', body: JSON.stringify({ newPassword }) }); },
  async getLogs() { return await this.request('/logs'); },
  async getSimulatedEmails(email) {
    try {
      const headers = {};
      let url = `${API_BASE}/debug/emails`;
      if (email) {
        url += `?email=${encodeURIComponent(email)}`;
      } else {
        const token = this.getToken();
        if (token) headers['Authorization'] = `Bearer ${token}`;
      }
      const res = await fetch(url, { headers });
      return await res.json();
    } catch (e) { console.error('Failed to fetch emails:', e); return []; }
  },
  async clearSimulatedEmails(email) {
    try {
      const headers = {};
      let url = `${API_BASE}/debug/emails/clear`;
      if (email) {
        url += `?email=${encodeURIComponent(email)}`;
      } else {
        const token = this.getToken();
        if (token) headers['Authorization'] = `Bearer ${token}`;
      }
      await fetch(url, { method: 'POST', headers });
      return true;
    } catch (e) { console.error('Failed to clear emails:', e); return false; }
  }
};
window.API = API;
