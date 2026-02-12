// Lightweight proxy to reuse backend slide compilation logic in the frontend build.
// If the backend module isn't available at build time, consider duplicating the minimal functions here.
import { parseLyricLines, compileSlides, mergeSlideConfig } from '@/../backend/src/services/slideService';
export { parseLyricLines, compileSlides, mergeSlideConfig };
