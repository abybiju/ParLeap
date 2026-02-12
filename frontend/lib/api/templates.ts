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

export async function submitTemplate(payload: {
  ccliNumber: string;
  lineCount: number;
  slides: TemplateSlide[];
  sections?: Array<{ label?: string | null; start_line: number; end_line: number }>;
  linesPerSlide?: number;
  sourceVersion?: string;
  userId?: string | null;
}): Promise<{ success: boolean; id?: string; error?: string }> {
  const backend = getBackendHttpUrl();
  const res = await fetch(`${backend}/api/templates`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ccliNumber: payload.ccliNumber,
      lineCount: payload.lineCount,
      slides: payload.slides,
      sections: payload.sections ?? [],
      linesPerSlide: payload.linesPerSlide,
      sourceVersion: payload.sourceVersion,
      userId: payload.userId ?? null,
    }),
  });
  if (!res.ok) {
    const json = await res.json().catch(() => ({}));
    return { success: false, error: json.error || res.statusText };
  }
  const json = await res.json().catch(() => ({}));
  return { success: true, id: json.id };
}

export async function recordTemplateUsage(templateId: string): Promise<void> {
  const backend = getBackendHttpUrl();
  await fetch(`${backend}/api/templates/${templateId}/usage`, { method: 'POST' }).catch(() => {});
}
