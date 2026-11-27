import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

const selectClassName = cn(
  "flex h-9 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm shadow-xs transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30"
)

const MONTH_OPTIONS = [
  { value: "01", label: "Jan" },
  { value: "02", label: "Feb" },
  { value: "03", label: "Mar" },
  { value: "04", label: "Apr" },
  { value: "05", label: "May" },
  { value: "06", label: "Jun" },
  { value: "07", label: "Jul" },
  { value: "08", label: "Aug" },
  { value: "09", label: "Sep" },
  { value: "10", label: "Oct" },
  { value: "11", label: "Nov" },
  { value: "12", label: "Dec" },
]

function parseMedicareExpiryParts(value: string | null | undefined) {
  const raw = value?.trim()
  if (!raw) return { month: "", year: "" }
  const match = /^(\d{4})-(\d{2})$/.exec(raw)
  if (!match) return { month: "", year: "" }
  return { month: match[2], year: match[1] }
}

function buildYearOptions() {
  const current = new Date().getFullYear()
  const years: string[] = []
  for (let year = current; year <= current + 15; year += 1) {
    years.push(String(year))
  }
  return years
}

export function MedicareFields({
  medicareCardNumber,
  medicareIrn,
  medicareExpiry,
}: {
  medicareCardNumber?: string | null
  medicareIrn?: string | null
  medicareExpiry?: string | null
}) {
  const expiryParts = parseMedicareExpiryParts(medicareExpiry)
  const yearOptions = buildYearOptions()

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
        <div className="space-y-2">
          <Label htmlFor="medicare_card_number">Medicare card no.</Label>
          <Input
            id="medicare_card_number"
            name="medicare_card_number"
            inputMode="numeric"
            maxLength={10}
            placeholder="10 digits"
            defaultValue={medicareCardNumber ?? ""}
          />
        </div>
        <div className="space-y-2 sm:w-24">
          <Label htmlFor="medicare_irn">IRN</Label>
          <Input
            id="medicare_irn"
            name="medicare_irn"
            maxLength={2}
            placeholder="1"
            defaultValue={medicareIrn ?? ""}
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label>Card expiry</Label>
        <div className="grid gap-3 sm:grid-cols-2">
          <select
            id="medicare_expiry_month"
            name="medicare_expiry_month"
            defaultValue={expiryParts.month}
            className={selectClassName}
            aria-label="Medicare card expiry month"
          >
            <option value="">Month</option>
            {MONTH_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <select
            id="medicare_expiry_year"
            name="medicare_expiry_year"
            defaultValue={expiryParts.year}
            className={selectClassName}
            aria-label="Medicare card expiry year"
          >
            <option value="">Year</option>
            {yearOptions.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  )
}