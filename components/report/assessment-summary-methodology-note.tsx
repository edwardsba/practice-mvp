export function AssessmentSummaryMethodologyNote() {
  return (
    <details className="no-print rounded-md border p-3 text-sm">
      <summary className="cursor-pointer font-medium text-muted-foreground">
        How assessment summaries are calculated
      </summary>
      <div className="mt-3 space-y-3 text-muted-foreground">
        <p>
          For PHQ-9, GAD-7, and ASSIST, the report generates an automated
          summary paragraph per tool: the score range, mean and median (with
          severity band), how consistent or variable the scores were, and
          whether there was a trend across the referral period.
        </p>

        <div>
          <p className="font-medium text-foreground">
            Variability (standard deviation) thresholds
          </p>
          <table className="mt-1 w-full border-collapse text-xs">
            <thead>
              <tr>
                <th className="border-b p-1 text-left">Tool</th>
                <th className="border-b p-1 text-left">Consistent</th>
                <th className="border-b p-1 text-left">Some fluctuation</th>
                <th className="border-b p-1 text-left">
                  Considerable fluctuation
                </th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="p-1">PHQ-9</td>
                <td className="p-1">SD ≤ 2</td>
                <td className="p-1">2 &lt; SD ≤ 4</td>
                <td className="p-1">SD &gt; 4</td>
              </tr>
              <tr>
                <td className="p-1">GAD-7</td>
                <td className="p-1">SD ≤ 2</td>
                <td className="p-1">2 &lt; SD ≤ 4</td>
                <td className="p-1">SD &gt; 4</td>
              </tr>
              <tr>
                <td className="p-1">ASSIST</td>
                <td className="p-1">SD ≤ 3</td>
                <td className="p-1">3 &lt; SD ≤ 6</td>
                <td className="p-1">SD &gt; 6</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div>
          <p className="font-medium text-foreground">Trend classification</p>
          <p>
            A linear trend (steady rise or fall) is used when a straight-line
            fit explains at least 50% of the variation in scores (R² ≥ 0.5).
            Otherwise, if the middle of the referral period differs from the
            average of the first and last score by at least one standard
            deviation, it&apos;s described as a temporary dip or peak. If
            neither applies, scores are described as stable/flat.
          </p>
        </div>

        <div>
          <p className="font-medium text-foreground">ASQ</p>
          <p>
            The ASQ does not use the numeric method above. It reports whichever
            of Negative screen / Non-acute positive screen / Acute positive
            screen applied at each administration, since a lifetime-history
            item (e.g. a past suicide attempt) can produce a non-acute
            positive screen indefinitely without indicating current risk.
          </p>
        </div>

        <p className="text-xs italic">
          These thresholds are configured in{" "}
          <code>lib/assessment-summary/config.ts</code> and can be adjusted
          there if clinical review suggests different cut-offs.
        </p>
      </div>
    </details>
  )
}
