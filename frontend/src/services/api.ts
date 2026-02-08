import axios from 'axios';

const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000',
    headers: {
        'Content-Type': 'application/json',
    },
});

export const uploadReceipt = async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);

    const response = await api.post('/api/receipts/upload', formData, {
        headers: {
            'Content-Type': 'multipart/form-data',
        },
    });

    return response.data;
};

import type { Ingredient, ValidationPayload, Recipe } from '../types';

export const getIngredients = async (search?: string) => {
    const params = search ? { search } : {};
    const response = await api.get<Ingredient[]>('/api/ingredients', { params });
    return response.data;
};

export const validateReceipt = async (receiptId: string, payload: ValidationPayload) => {
    const response = await api.put(`/api/receipts/${receiptId}/validate`, payload);
    return response.data;
};

export const getRecipes = async () => {
    const response = await api.get<Recipe[]>('/api/recipes');
    return response.data;
};

export default api;
