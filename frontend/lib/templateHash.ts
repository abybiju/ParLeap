export type TemplateStructure = {
  ccliNumber: string;
  lineCount: number;
  slides: Array<{ start_line: number; end_line: number }>;
  sections?: Array<{ label?: string | null; start_line: number; end_line: number }>;
  linesPerSlide?: number;
  sourceVersion?: string;
};

export function getStructureHash(structure: TemplateStructure): string {
  const payload = {
    ccli: structure.ccliNumber,
    lineCount: structure.lineCount,
    linesPerSlide: structure.linesPerSlide ?? null,
    sections: structure.sections ?? [],
    slides: structure.slides,
    source: structure.sourceVersion ?? null,
  };
  return JSON.stringify(payload);
}
