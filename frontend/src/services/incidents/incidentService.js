import api from '../api';

const incidentService = {
    /**
     * Create a new incident
     */
    createIncident: async (incidentData) => {
        const response = await api.post('/incidents', incidentData);
        return response.data;
    },

    /**
     * Get all incidents (handles both employee and admin depending on stored token role backend)
     */
    getIncidents: async (params) => {
        const response = await api.get('/incidents', { params });
        return response.data;
    },

    /**
     * Get a single incident by ID
     */
    getIncident: async (id) => {
        const response = await api.get(`/incidents/${id}`);
        return response.data;
    },

    /**
     * Add a response message to an existing incident
     */
    addResponse: async (id, message) => {
        const response = await api.post(`/incidents/${id}/responses`, { message });
        return response.data;
    },

    /**
     * Admin: Update incident status or assignment
     */
    updateIncident: async (id, updateData) => {
        const response = await api.patch(`/incidents/${id}`, updateData);
        return response.data;
    },
};

export default incidentService;
