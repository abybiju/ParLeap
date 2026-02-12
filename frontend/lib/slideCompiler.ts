// Frontend wrapper that re-exports the backend slide helpers via the proxy.
// The proxy handles the relative path to the backend service so Next/tsc can resolve it.
import { parseLyricLines as parseLines, compileSlides, mergeSlideConfig } from '@/lib/slideServiceProxy';

export { parseLines as parseLyricLines, compileSlides, mergeSlideConfig };
