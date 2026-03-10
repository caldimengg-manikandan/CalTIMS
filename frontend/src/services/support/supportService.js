import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api/v1';

const supportService = {
    submitTicket: async (ticketData) => {
        const response = await axios.post(`${API_URL}/support/tickets`, ticketData);
        return response.data;
    },

    sendOTP: async (email) => {
        const response = await axios.post(`${API_URL}/support/send-otp`, { email });
        return response.data;
    },

    verifyOTP: async (email, otp) => {
        const response = await axios.post(`${API_URL}/support/verify-otp`, { email, otp });
        return response.data;
    },

    getTickets: async (params = {}) => {
        const token = localStorage.getItem('token');
        const response = await axios.get(`${API_URL}/support/tickets`, {
            params,
            headers: { Authorization: `Bearer ${token}` }
        });
        return response.data;
    },

    updateTicketStatus: async (id, status) => {
        const token = localStorage.getItem('token');
        const response = await axios.patch(`${API_URL}/support/tickets/${id}`, { status }, {
            headers: { Authorization: `Bearer ${token}` }
        });
        return response.data;
    },

    deleteTicket: async (id) => {
        const token = localStorage.getItem('token');
        const response = await axios.delete(`${API_URL}/support/tickets/${id}`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        return response.data;
    },
    trackTickets: async (email) => {
        const response = await axios.post(`${API_URL}/support/track-tickets`, { email });
        return response.data;
    },
    addTicketMessage: async (id, message, sender = 'user') => {
        const response = await axios.post(`${API_URL}/support/tickets/${id}/messages`, { message, sender });
        return response.data;
    }
};

export default supportService;
