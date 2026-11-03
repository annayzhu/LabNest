# 软件测试用模拟序列

These files are simulated for software tests (PRD v1.0 §10, Q281). They are not real
constructs, sequencing results or lab records. Regenerate them with
`npx tsx src/lib/plasmid/test-samples/write-samples.ts`; `samples.test.ts` checks that the
committed files match a rebuild.

| Case | Files | Expected |
| --- | --- | --- |
| A01 | A01-multi-record.fasta, A01-construct.gb, A01-plain.seq, A01-fasta-like.seq | Sequences and lengths exact; FASTA records stay separate |
| A02 | A02-limited.dna, A02-compressed-only.dna | Sequence, topology, features and primers read; history, properties, alignable sequences and an unknown block listed as not read; a file without a readable DNA packet is refused |
| A03 | A03-mixed/ | Two files parse; the truncated .ab1, binary .seq and non-DNA .seq fail one by one |
| A04 | A04-origin-features.gb | Origin-crossing and minus-strand joins extract and translate to the planned proteins; GenBank round trip keeps them |
| A07 | A07-flag-variants.fasta | 22 aa 3×FLAG and three standard FLAGs are told apart |
| A08 | A08-flag-after-stop.fasta | FLAG found in frame but after a stop codon: fusion check fails |
| A09 | A09-flag-other-frame.fasta | FLAG found only in another frame: fusion check fails |
| A10 | A10-reference.gb, A10-read-F.ab1 | Signal peptide → 3×FLAG → mature chain: order, frame, gaps and junction coverage checked separately |
| A11 | A11-read-Q31.ab1 | One high-quality difference at the R31 codon, matching the reference's known-variant note |
| A12 | A12-read-R.ab1 | Reverse read: position, complement bases, quality and trace (channel order TACG) map consistently |
| A13 | A13-read-low-tail.ab1 | Low-quality tails and N are never high-confidence differences or support; PBAS1 hand edit reported |
| A14 | A14-run/ | The .ab1, its trimmed .seq export and the ZIP copies form one evidence group |
| A15 | A15-read-insert-only.ab1 | Only part of the reference is covered: never a full-sequence check |
| A16 | A16-read-origin.ab1 | A read across the circular origin covers each position once |
| F06 | F06-read-indels.ab1 | A 1 bp deletion and a 3 bp insertion at high quality |
| A19 | A19-vendor-catalog.csv | Kept as an attachment; no construct is inferred from it |
