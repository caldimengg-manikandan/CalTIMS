import api from '../api';

const supportService = {
    submitTicket: async (ticketData) => {
        const response = await api.post('/support/tickets', ticketData);
        return response.data;
    },

    sendOTP: async (email) => {
        const response = await api.post('/support/send-otp', { email });
        return response.data;
    },

    verifyOTP: async (email, otp) => {
        const response = await api.post('/support/verify-otp', { email, otp });
        return response.data;
    },

    getTickets: async (params = {}) => {
        const response = await api.get('/support/tickets', { params });
        return response.data;
    },

    trackTickets: async (email) => {
        const response = await api.post('/support/track-tickets', { email });
        return response.data;
    },

    updateTicketStatus: async (id, status) => {
        const response = await api.patch(`/support/tickets/${id}`, { status });
        return response.data;
    },

    deleteTicket: async (id) => {
        const response = await api.delete(`/support/tickets/${id}`);
        return response.data;
    },

    addTicketMessage: async (id, message, sender = 'user') => {
        const response = await api.post(`/support/tickets/${id}/messages`, { message, sender });
        return response.data;
    }
};

export default supportService;
