import { apiRequest } from './api.js';

export async function fetchHealth() {
  return apiRequest('/health');
}

export async function fetchReadiness() {
  return apiRequest('/health/ready');
}

export async function fetchDatabaseHealth() {
  return apiRequest('/health/db');
}