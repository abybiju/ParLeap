#!/usr/bin/env python3
"""
Tokenize plain wake phrases into the sherpa-onnx KeywordSpotter keywords.txt format.

The gigaspeech KWS model is BPE-based and uppercase; each keywords.txt line must be the
phrase encoded into BPE pieces (e.g. "OPEN YOUR BIBLES" -> "▁OPEN ▁YOUR ▁B I B LE S").
Optionally append per-phrase " :<boost>" and " #<threshold>" and " @<original text>".

Build-time only (needs sentencepiece); the generated keywords.txt is what ships to the backend.

Usage:
  python3 backend/scripts/kws_text2token.py <bpe.model> <raw_phrases.txt> > keywords.txt

raw_phrases.txt: one phrase per line. Optional trailing tab-separated boost/threshold:
  OPEN YOUR BIBLES\t2.0\t0.25
Lines starting with '#' and blank lines are ignored.
"""
import sys

import sentencepiece as spm


def main() -> int:
    if len(sys.argv) != 3:
        sys.stderr.write("usage: kws_text2token.py <bpe.model> <raw_phrases.txt>\n")
        return 2
    sp = spm.SentencePieceProcessor()
    sp.load(sys.argv[1])
    with open(sys.argv[2], encoding="utf-8") as fh:
        for line in fh:
            line = line.rstrip("\n")
            if not line.strip() or line.lstrip().startswith("#"):
                continue
            parts = line.split("\t")
            phrase = parts[0].strip().upper()
            tokens = sp.encode(phrase, out_type=str)
            out = " ".join(tokens)
            if len(parts) > 1 and parts[1].strip():
                out += f" :{parts[1].strip()}"
            if len(parts) > 2 and parts[2].strip():
                out += f" #{parts[2].strip()}"
            out += f" @{phrase.replace(' ', '_')}"  # label must be space-free (parser splits on spaces)
            print(out)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
