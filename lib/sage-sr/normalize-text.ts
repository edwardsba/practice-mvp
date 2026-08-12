/**
 * TeleSage's PDF generator encodes certain punctuation with non-standard Unicode
 * codepoints — confirmed by inspecting the actual text layer of every SAGE-SR report
 * type. Left un-normalized, these break any string matching against expected content
 * (e.g. "F40.01" reads fine, but "Alcohol Use Disorder ﴾Severe﴿" won't match a plain-
 * ASCII "(Severe)" lookup). Apply this to every string pulled from a SAGE-SR PDF before
 * any parsing logic touches it.
 */
export function normalizeSageSrText(input: string): string {
  return input
    // Ornate Arabic-style parentheses TeleSage's generator substitutes for plain ( )
    .replace(/[\uFD3E\u2768\u2772]/g, "(")
    .replace(/[\uFD3F\u2769\u2773]/g, ")")
    // En dash / em dash / various Unicode hyphens standardized to plain hyphen-minus
    .replace(/[\u2010\u2011\u2012\u2013\u2014]/g, "-")
    .trim()
}
