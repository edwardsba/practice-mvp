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
    // TeleSage embeds literal HTML-style formatting tags in some item text — e.g.
    // "These feelings occurred <b>at times other than</b> when I was drinking..." and
    // "Was there a period when you did <u>NOT</u> have any of these feelings?" —
    // confirmed rendering as raw visible text in the app before this was added. These
    // aren't real markup to preserve any styling from, just noise to strip.
    .replace(/<\/?[a-z]+>/gi, "")
    // Ornate Arabic-style parentheses TeleSage's generator substitutes for plain ( )
    .replace(/[\uFD3E\u2768\u2772]/g, "(")
    .replace(/[\uFD3F\u2769\u2773]/g, ")")
    // En dash / em dash / various Unicode hyphens standardized to plain hyphen-minus
    .replace(/[\u2010\u2011\u2012\u2013\u2014]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
}
