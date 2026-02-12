import { getBackendHttpUrl } from '../utils/backendUrl';

export type TemplateSlide = { start_line: number; end_line: number };

export interface CommunityTemplate {
  id: string;
  ccli_number: string;
  line_count: number;
  slides: TemplateSlide[];
  lines_per_slide?: number | null;
  score?: number;
  usage_count?: number;
  created_at?: string;
}

export async function fetchTemplates(ccliNumber: string, lineCount?: number): Promise<CommunityTemplate[]> {
  const backend = getBackendHttpUrl();
  const params = new URLSearchParams({ ccli: ccliNumber });
  if (lineCount !== undefined) params.set('lineCount', String(lineCount));
  const res = await fetch(`${backend}/api/templates?${params.toString()}`);
  if (!res.ok) return [];
  const json = await res.json().catch(() => ({ templates: [] }));
  return (json.templates as CommunityTemplate[]) || [];
}
