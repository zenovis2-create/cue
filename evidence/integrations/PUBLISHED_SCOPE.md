# Published checkpoint scope

This checkpoint includes the current application/daemon source, migrations, tests,
required native helper and license notices, integration documentation, historical
Markdown review summaries, the two model-alias evidence inputs required by tests,
and recent root/grouped regression reports and logs.

Local forensic backups/preimages, temporary databases, caches, screenshots, raw
provider/ledger dumps and most older generated artifacts are deliberately not
part of this checkpoint. They were retained locally, not deleted or rewritten.
Some links in historical review summaries therefore refer to local-only evidence;
a summary is not a substitute for those underlying artifacts or a new independent
verification. Optional historical evidence-generation scripts may need those
artifacts and an explicitly authorized environment.

Latest completed validation is recorded in
[`release/20260926-regression-repair/RESULTS.md`](release/20260926-regression-repair/RESULTS.md):
unfiltered root `npm test`, 309 files passed, 2,261 tests passed, 10 existing skips,
exit 0. That is a local Windows regression result, not a release, fresh-clone CI
result, live provider qualification, or completion of the outstanding acceptance
and measurement gates. No credentials or local runtime databases are intended
for publication.
