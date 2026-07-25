/* Probe analyzeReference/parseForProject on given strings. Usage: tsx probe-parser.ts "<text>" ... */
import { initBibleReferenceParser, analyzeReference, parseForProject } from '../src/services/bibleReferenceParser';

async function main(): Promise<void> {
  await initBibleReferenceParser();
  for (const s of process.argv.slice(2)) {
    const a = analyzeReference(s);
    const proj = parseForProject(s);
    console.log(
      JSON.stringify({
        book: a.book,
        score: +a.score.toFixed(3),
        jw: +a.jw.toFixed(3),
        dmAgree: a.dmAgree,
        exact: a.exact,
        hasNumber: a.hasNumber,
        ref: a.reference ? `${a.reference.book} ${a.reference.chapter}:${a.reference.verse}` : null,
        PROJECT: proj ? `${proj.book} ${proj.chapter}:${proj.verse}` : null,
        in: s.slice(0, 55),
      })
    );
  }
}
void main();
