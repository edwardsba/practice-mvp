/**
 * Builds the standing DSM-5-TR exclusion-clause caveat for the SAGE-SR Diagnostic
 * Report — the piece both Core's and Personality's own section generators explicitly
 * deferred (see their docstrings). Neither Core nor Personality performs a completed
 * differential diagnosis: Core relays TeleSage's own "meets full diagnostic criteria"
 * determination from the client's self-report answers, and Personality independently
 * counts DSM-5-TR criteria against the client's self-report answers — neither one
 * checks the DSM-5-TR exclusion criteria that sit alongside those symptom counts
 * (e.g. whether the presentation is better explained by another medical condition,
 * substance use, or another mental disorder; the autism-spectrum exclusion for
 * Schizotypal/OCPD; Conduct-Disorder-before-15 for Antisocial). SAGE-SR as an
 * instrument doesn't assess most of these on its own.
 *
 * Per Ben's decision: this is a single static, generic paragraph — not assembled
 * per-report from the specific diagnoses that happen to appear elsewhere in it. A
 * fixed caveat carries far less risk of itself misstating something clinically than
 * a dynamically-generated one would (e.g. naming an exclusion that doesn't actually
 * apply to a particular diagnosis), and it reads once regardless of which sections
 * a given client's report includes.
 *
 * Deliberately a standalone fifth generator, matching Introduction/Background/Core/
 * Personality's own pattern (pure, synchronous, no DB access, no arguments needed
 * since the text never varies) — WHERE this caveat is placed in the assembled report
 * (end of Introduction vs. end of the whole report vs. somewhere else) is explicitly
 * not decided here; that's a report-shell layout decision, not a content decision,
 * and the shell doesn't exist yet. Whatever assembles the report picks one call site
 * for this string.
 */
export function buildSageSrExclusionClauseSection(): string {
  return (
    "The diagnoses and symptom patterns described in this report are based on the " +
    "client's self-reported answers to the SAGE-SR assessment, scored against DSM-5-TR " +
    "criteria. This report does not represent a completed differential diagnosis: it has " +
    "not been checked against DSM-5-TR's exclusion criteria, such as whether a " +
    "presentation is better explained by another medical condition, the effects of a " +
    "substance, or another mental disorder, and it does not incorporate clinical history, " +
    "collateral information, or examination findings outside this self-report instrument. " +
    "These findings should be reviewed and integrated with the treating clinician's own " +
    "assessment before any diagnosis is confirmed."
  )
}
