import { createHash } from 'crypto';
import { getSupabaseClient, isSupabaseConfigured } from '../config/supabase';
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
  ccli_number: string;
  line_count: number;
  lines_per_slide?: number | null;
  source_version?: string | null;
  score: number;
  upvotes: number;
  downvotes: number;
  usage_count: number;
  created_at: string;
  status: TemplateStatus;
}

interface TemplateStatsRow {
  template_id?: string;
  id?: string;
  ccli_number?: string;
  line_count?: number;
  sections?: unknown;
  slides?: unknown;
  lines_per_slide?: number | null;
  source_version?: string | null;
  status?: TemplateStatus;
  usage_count?: number;
  created_at?: string;
  score?: number;
  upvotes?: number;
  downvotes?: number;
}

function normalizeSections(sections: unknown): Array<{ label?: string | null; start_line: number; end_line: number }> {
  if (!Array.isArray(sections)) return [];
  const normalized: Array<{ label?: string | null; start_line: number; end_line: number }> = [];
  for (const s of sections) {
    if (!s || typeof s !== 'object') continue;
    const section = s as { label?: unknown; start_line?: unknown; end_line?: unknown };
    if (typeof section.start_line !== 'number' || typeof section.end_line !== 'number') continue;
    if (section.start_line < 0 || section.end_line < section.start_line) continue;
    normalized.push({
      label: typeof section.label === 'string' ? section.label : null,
      start_line: section.start_line,
      end_line: section.end_line,
    });
  }
  return normalized;
}

function normalizeSlides(rawSlides: unknown, lineCount: number): Array<{ start_line: number; end_line: number }> {
  const fromIndexed = (arr: unknown[]) =>
    arr
      .map((s) => {
        if (!s || typeof s !== 'object') return null;
        const slide = s as { start_line?: unknown; end_line?: unknown };
        if (typeof slide.start_line !== 'number' || typeof slide.end_line !== 'number') return null;
        if (slide.start_line < 0 || slide.end_line < slide.start_line || slide.end_line >= lineCount) return null;
        return { start_line: slide.start_line, end_line: slide.end_line };
      })
      .filter((s): s is { start_line: number; end_line: number } => s !== null);

  const fromLineCounts = (arr: unknown[]) => {
    let cursor = 0;
    const slides: Array<{ start_line: number; end_line: number }> = [];
    for (const s of arr) {
      if (!s || typeof s !== 'object') return [];
      const slide = s as { line_count?: unknown };
      if (typeof slide.line_count !== 'number' || slide.line_count <= 0) return [];
      const start = cursor;
      const end = cursor + slide.line_count - 1;
      if (end >= lineCount) return [];
      slides.push({ start_line: start, end_line: end });
      cursor = end + 1;
    }
    return slides;
  };

  // Legacy payload: { slides: [...] }
  if (rawSlides && typeof rawSlides === 'object' && !Array.isArray(rawSlides)) {
    const legacy = rawSlides as { slides?: unknown };
    if (Array.isArray(legacy.slides)) {
      const normalized = normalizeSlides(legacy.slides, lineCount);
      if (normalized.length > 0) return normalized;
    }
    return [];
  }

  if (!Array.isArray(rawSlides)) return [];
  if (rawSlides.length === 0) return [];

  const indexed = fromIndexed(rawSlides);
  if (indexed.length > 0) return indexed;

  const lineCountBased = fromLineCounts(rawSlides);
  if (lineCountBased.length > 0) return lineCountBased;

  return [];
}

const MAX_TEMPLATES_PER_CCLI = 3;

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

export async function countTemplatesByCcli(ccliNumber: string): Promise<number> {
  const supabase = getSupabaseClient();
  if (!isSupabaseConfigured() || !supabase) return 0;
  const { count, error } = await (supabase
    .from('community_templates') as ReturnType<typeof supabase.from>)
    .select('*', { count: 'exact', head: true })
    .eq('ccli_number', ccliNumber)
    .eq('status', 'active');
  if (error) return 0;
  return count ?? 0;
}

export async function submitTemplate(
  structure: TemplateStructure,
  createdBy?: string
): Promise<{ id: string | null; error?: string; limitReached?: boolean }> {
  const supabase = getSupabaseClient();
  if (!isSupabaseConfigured() || !supabase) {
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

  // Check if this exact format already exists (upsert = update, does not add a 4th)
  const { data: existing } = await (supabase
    .from('community_templates') as ReturnType<typeof supabase.from>)
    .select('id')
    .eq('ccli_number', structure.ccliNumber)
    .eq('structure_hash', structure_hash)
    .eq('status', 'active')
    .maybeSingle();

  if (!existing) {
    const count = await countTemplatesByCcli(structure.ccliNumber);
    if (count >= MAX_TEMPLATES_PER_CCLI) {
      return {
        id: null,
        error: 'This song already has 3 community formats. Your format was saved to your song only.',
        limitReached: true,
      };
    }
  }

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
    await incrementTemplateUsage(id);
  }

  return { id, error: error?.message };
}

export async function fetchTemplates(ccliNumber: string, lineCount?: number): Promise<CommunityTemplate[]> {
  const supabase = getSupabaseClient();
  if (!isSupabaseConfigured() || !supabase) return [];

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

  const rows = data as unknown as TemplateStatsRow[];
  return rows
    .map((row): CommunityTemplate | null => {
      const id = row.template_id ?? row.id;
      if (!id || typeof id !== 'string') return null;
      if (!row.ccli_number || typeof row.ccli_number !== 'string') return null;
      if (typeof row.line_count !== 'number' || row.line_count <= 0) return null;

      const slides = normalizeSlides(row.slides, row.line_count);
      if (slides.length === 0) return null;

      return {
        id,
        ccliNumber: row.ccli_number,
        lineCount: row.line_count,
        linesPerSlide: typeof row.lines_per_slide === 'number' ? row.lines_per_slide : undefined,
        sections: normalizeSections(row.sections),
        slides,
        sourceVersion: typeof row.source_version === 'string' ? row.source_version : null,
        ccli_number: row.ccli_number,
        line_count: row.line_count,
        lines_per_slide: row.lines_per_slide ?? null,
        source_version: row.source_version ?? null,
        status: row.status ?? 'active',
        usage_count: row.usage_count ?? 0,
        created_at: row.created_at ?? new Date().toISOString(),
        score: row.score ?? 0,
        upvotes: row.upvotes ?? 0,
        downvotes: row.downvotes ?? 0,
      };
    })
    .filter((tpl): tpl is CommunityTemplate => tpl !== null);
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
  const supabase = getSupabaseClient();
  if (!isSupabaseConfigured() || !supabase) return;
  const { error } = await supabase.rpc('increment_template_usage', { tmpl_id: templateId });
  if (error) {
    console.warn('[TemplateService] increment usage rpc error:', error.message);
  }
}

export async function voteTemplate(templateId: string, userId: string | null, vote: 1 | -1): Promise<{ success: boolean; error?: string }> {
  const supabase = getSupabaseClient();
  if (!isSupabaseConfigured() || !supabase) return { success: false, error: 'Supabase not configured' };
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
