"use client"

import { useState } from "react"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { CheckboxOption } from "@/lib/crisis-plans/fields"
import type {
  EmergencyContactInput,
  EmergencyContactRow,
  MultiSelectSectionJson,
} from "@/lib/crisis-plans/types"

export function FormCheckboxField({
  id,
  name,
  label,
  defaultChecked = false,
}: {
  id: string
  name: string
  label: string
  defaultChecked?: boolean
}) {
  const [checked, setChecked] = useState(defaultChecked)

  return (
    <div className="flex items-start gap-3">
      <Checkbox
        id={id}
        checked={checked}
        onCheckedChange={(value) => setChecked(value === true)}
      />
      <input type="hidden" name={name} value={checked ? "on" : ""} />
      <Label htmlFor={id} className="cursor-pointer font-normal leading-snug">
        {label}
      </Label>
    </div>
  )
}

export function MultiSelectSectionFields({
  prefix,
  options,
  value,
  includeOther = true,
}: {
  prefix: string
  options: CheckboxOption[]
  value: MultiSelectSectionJson
  includeOther?: boolean
}) {
  const [otherItems, setOtherItems] = useState<string[]>(
    value.other.length > 0 ? value.other : []
  )

  return (
    <div className="space-y-4">
      <div className="grid gap-3">
        {options.map((option) => (
          <FormCheckboxField
            key={option.key}
            id={`${prefix}_${option.key}`}
            name={`${prefix}_${option.key}`}
            label={option.label}
            defaultChecked={value.selected.includes(option.key)}
          />
        ))}
      </div>

      {includeOther ? (
        <div className="space-y-3 border-t pt-4">
          <p className="text-sm font-medium">Other</p>
          {otherItems.map((item, index) => (
            <div key={index} className="flex gap-2">
              <Input
                name={`${prefix}_other`}
                value={item}
                onChange={(e) =>
                  setOtherItems((items) =>
                    items.map((row, i) => (i === index ? e.target.value : row))
                  )
                }
                placeholder="Custom item"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  setOtherItems((items) => items.filter((_, i) => i !== index))
                }
              >
                Remove
              </Button>
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setOtherItems((items) => [...items, ""])}
          >
            Add other
          </Button>
        </div>
      ) : null}
    </div>
  )
}

export function EmergencyContactsFormFields({
  initialContacts,
  onChange,
}: {
  initialContacts: EmergencyContactRow[] | EmergencyContactInput[]
  onChange: (contacts: EmergencyContactInput[]) => void
}) {
  const [contacts, setContacts] = useState<EmergencyContactInput[]>(
    initialContacts.map((contact) => ({
      contactId:
        "contactId" in contact && contact.contactId
          ? contact.contactId
          : undefined,
      role: contact.role ?? "",
      name: contact.name ?? "",
      phone: contact.phone ?? "",
      email: contact.email ?? "",
    }))
  )

  function updateContacts(next: EmergencyContactInput[]) {
    setContacts(next)
    onChange(next)
  }

  function updateRow(index: number, field: keyof EmergencyContactInput, value: string) {
    updateContacts(
      contacts.map((contact, i) =>
        i === index ? { ...contact, [field]: value } : contact
      )
    )
  }

  function addRow() {
    updateContacts([
      ...contacts,
      { role: "", name: "", phone: "", email: "" },
    ])
  }

  function removeRow(index: number) {
    updateContacts(contacts.filter((_, i) => i !== index))
  }

  return (
    <div className="space-y-4">
      {contacts.length === 0 ? (
        <p className="text-sm text-muted-foreground">No emergency contacts added.</p>
      ) : (
        contacts.map((contact, index) => (
          <div
            key={contact.contactId ?? `new-${index}`}
            className="grid gap-3 rounded-lg border p-4 sm:grid-cols-2"
          >
            <div className="space-y-2">
              <Label htmlFor={`contact_role_${index}`}>Role</Label>
              <Input
                id={`contact_role_${index}`}
                value={contact.role}
                onChange={(e) => updateRow(index, "role", e.target.value)}
                placeholder="e.g. Partner"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`contact_name_${index}`}>Name</Label>
              <Input
                id={`contact_name_${index}`}
                value={contact.name}
                onChange={(e) => updateRow(index, "name", e.target.value)}
                placeholder="Full name"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`contact_phone_${index}`}>Phone</Label>
              <Input
                id={`contact_phone_${index}`}
                value={contact.phone}
                onChange={(e) => updateRow(index, "phone", e.target.value)}
                placeholder="Phone number"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`contact_email_${index}`}>Email</Label>
              <Input
                id={`contact_email_${index}`}
                value={contact.email}
                onChange={(e) => updateRow(index, "email", e.target.value)}
                placeholder="Email address"
              />
            </div>
            <div className="sm:col-span-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => removeRow(index)}
              >
                Remove contact
              </Button>
            </div>
          </div>
        ))
      )}
      <Button type="button" variant="outline" size="sm" onClick={addRow}>
        Add contact
      </Button>
    </div>
  )
}
