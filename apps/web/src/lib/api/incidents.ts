import { api } from '../api';

export interface IncidentFinding {
  type: string;
  message: string;
  priority: string;
  referenceType?: string;
  referenceId?: string;
  locationId?: string | null;
}

export interface IncidentsReportResult {
  findings: IncidentFinding[];
  alertsCreated: number;
}

export const incidentsApi = {
  runReport: () =>
    api.get<IncidentsReportResult>('/incidents/report'),
};
