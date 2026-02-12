import { getBackendHttpUrl } from './utils/backendUrl';
import { TemplateStructure } from './templateHash';

export async function upsertCommunityTemplate(structure: TemplateStructure): Promise<void> {
  const backend = getBackendHttpUrl();
  const payload = {
    ccliNumber: structure.ccliNumber,
    lineCount: structure.lineCount,
    slides: structure.slides,
    sections: structure.sections ?? [],
    linesPerSlide: structure.linesPerSlide,
    sourceVersion: structure.sourceVersion,
  };
  // fire-and-forget
  fetch(`${backend}/api/templates`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }).catch(() => {});
}
