import { createHash } from 'crypto';
import { supabase, isSupabaseConfigured } from '../config/supabase';
import { CompiledSlide } from './slideService';

export type TemplateStatus = 'pending' | 'active' | 'flagged';

export interface TemplateStructure {
  ccliNumber: string;
  lineCount: number;
  linesPerSlide?: number;
  sections: Array<{ label?: string | null; start_line: number; end_line: number }>;
  slides: Array<{ start_line: number; end_line: number }>;
  sourceVersion?: string | null;
}

export interface CommunityTemplate extends TemplateStructure {
  id: string;
  score: number;
  upvotes: number;
  downvotes: number;
  usage_count: number;
  created_at: string;
  status: TemplateStatus;
}

function computeStructureHash(structure: TemplateStructure): string {
  const payload = {
    ccli: structure.ccliNumber,
    lineCount: structure.lineCount,
    linesPerSlide: structure.linesPerSlide ?? null,
    sections: structure.sections,
    slides: structure.slides,
    source: structure.sourceVersion ?? null,
  };
  const json = JSON.stringify(payload);
  return createHash('sha256').update(json).digest('hex');
}

export async function submitTemplate(structure: TemplateStructure, createdBy?: string): Promise<{ id: string | null; error?: string }> {
  if (!isSupabaseConfigured || !supabase) {
    return { id: null, error: 'Supabase not configured' };
  }

  // Basic validation: no lyrics allowed, only numeric indices
  const hasInvalid =
    structure.lineCount <= 0 ||
    structure.slides.some((s) => s.start_line < 0 || s.end_line < s.start_line) ||
    structure.sections.some((s) => s.start_line < 0 || s.end_line < s.start_line);
  if (hasInvalid) {
    return { id: null, error: 'Invalid structure payload' };
  }

  const structure_hash = computeStructureHash(structure);

  const { data, error } = await (supabase
    .from('community_templates') as ReturnType<typeof supabase.from>)
    .upsert(
      {
        ccli_number: structure.ccliNumber,
        line_count: structure.lineCount,
        lines_per_slide: structure.linesPerSlide ?? null,
        sections: structure.sections,
        slides: structure.slides,
        source_version: structure.sourceVersion ?? null,
        structure_hash,
        created_by: createdBy ?? null,
      },
      { onConflict: 'ccli_number,structure_hash' }
    )
    .select('id')
    .single();

  const id = (data as { id: string } | null)?.id ?? null;
  if (id) {
    // increment usage on every submit (works for insert or conflict)
    await incrementTemplateUsage(id);
  }

  return { id, error: error?.message };
}

export async function fetchTemplates(ccliNumber: string, lineCount?: number): Promise<CommunityTemplate[]> {
  if (!isSupabaseConfigured || !supabase) return [];

  const query = (supabase
    .from('template_stats') as ReturnType<typeof supabase.from>)
    .select('*')
    .eq('status', 'active')
    .eq('ccli_number', ccliNumber)
    .order('score', { ascending: false })
    .order('usage_count', { ascending: false })
    .order('created_at', { ascending: false });

  if (lineCount !== undefined) {
    query.eq('line_count', lineCount);
  }

  const { data, error } = await query;
  if (error || !data) {
    console.warn('[TemplateService] fetchTemplates error:', error);
    return [];
  }

  return data as unknown as CommunityTemplate[];
}

export function applyTemplateToLines(lines: string[], slides: Array<{ start_line: number; end_line: number }>): { slides: CompiledSlide[]; lineToSlideIndex: number[] } | null {
  if (slides.length === 0 || lines.length === 0) return null;
  const compiled: CompiledSlide[] = [];
  const lineToSlideIndex: number[] = new Array(lines.length);

  for (let idx = 0; idx < slides.length; idx++) {
    const slice = slides[idx];
    if (slice.start_line < 0 || slice.end_line >= lines.length || slice.end_line < slice.start_line) {
      return null; // invalid template for this lyric set
    }
    const segment = lines.slice(slice.start_line, slice.end_line + 1);
    compiled.push({
      lines: segment,
      slideText: segment.join('\n'),
      startLineIndex: slice.start_line,
      endLineIndex: slice.end_line,
    });
    for (let i = slice.start_line; i <= slice.end_line; i++) {
      lineToSlideIndex[i] = idx;
    }
  }

  return { slides: compiled, lineToSlideIndex };
}

export async function incrementTemplateUsage(templateId: string): Promise<void> {
  if (!isSupabaseConfigured || !supabase) return;
  const { error } = await supabase.rpc('increment_template_usage', { tmpl_id: templateId });
  if (error) {
    console.warn('[TemplateService] increment usage rpc error:', error.message);
  }
}

export async function voteTemplate(templateId: string, userId: string | null, vote: 1 | -1): Promise<{ success: boolean; error?: string }> {
  if (!isSupabaseConfigured || !supabase) return { success: false, error: 'Supabase not configured' };
  if (!userId) return { success: false, error: 'userId required for voting' };

  const { error } = await (supabase
    .from('template_votes') as ReturnType<typeof supabase.from>)
    .upsert({ template_id: templateId, user_id: userId, vote });

  return { success: !error, error: error?.message };
}

// Utility to compute structure hash for clients/tests
export function getStructureHash(structure: TemplateStructure): string {
  return computeStructureHash(structure);
}
