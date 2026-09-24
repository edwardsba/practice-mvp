"use client"

import { DynamicList } from "@/components/intake-interview/dynamic-list"
import {
  NumberField,
  TextAreaField,
  TextField,
  YesNoField,
} from "@/components/intake-interview/fields"
import type { GroupMembership, SocialSupportFields } from "@/lib/intake-interview/types"

function emptyGroup(): GroupMembership {
  return { id: "", name: "", detail: "" }
}

export function SocialSupportGroup({
  value,
  onChange,
}: {
  value: SocialSupportFields
  onChange: (value: SocialSupportFields) => void
}) {
  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <p className="text-sm font-medium">Family support</p>
        <YesNoField
          name="family_support"
          label="Is family a source of support?"
          value={value.familySupport.hasSupport}
          onChange={(hasSupport) =>
            onChange({
              ...value,
              familySupport: { ...value.familySupport, hasSupport },
            })
          }
        />
        {value.familySupport.hasSupport ? (
          <>
            <TextField
              id="family_support_quality"
              label="Quality of family support"
              value={value.familySupport.quality}
              onChange={(quality) =>
                onChange({
                  ...value,
                  familySupport: { ...value.familySupport, quality },
                })
              }
            />
            <TextAreaField
              id="family_support_detail"
              label="Detail"
              value={value.familySupport.detail}
              onChange={(detail) =>
                onChange({
                  ...value,
                  familySupport: { ...value.familySupport, detail },
                })
              }
            />
          </>
        ) : null}
      </section>

      <section className="space-y-3">
        <p className="text-sm font-medium">Pets</p>
        <NumberField
          id="pet_count"
          label="Number of pets"
          value={value.pets.petCount}
          min={0}
          onChange={(petCount) =>
            onChange({ ...value, pets: { ...value.pets, petCount } })
          }
        />
        {value.pets.petCount != null && value.pets.petCount > 0 ? (
          <>
            <TextField
              id="pet_types"
              label="Types of pets"
              value={value.pets.types}
              onChange={(types) =>
                onChange({ ...value, pets: { ...value.pets, types } })
              }
            />
            <TextAreaField
              id="pet_significance"
              label="Significance / support"
              value={value.pets.significance}
              onChange={(significance) =>
                onChange({ ...value, pets: { ...value.pets, significance } })
              }
            />
          </>
        ) : null}
      </section>

      <section className="space-y-3">
        <p className="text-sm font-medium">Friendships</p>
        <YesNoField
          name="has_close_friends"
          label="Close friendships?"
          value={value.friendships.hasCloseFriends}
          onChange={(hasCloseFriends) =>
            onChange({
              ...value,
              friendships: { ...value.friendships, hasCloseFriends },
            })
          }
        />
        {value.friendships.hasCloseFriends ? (
          <>
            <NumberField
              id="friend_count"
              label="Approximate number of close friends"
              value={value.friendships.approximateCount}
              min={0}
              onChange={(approximateCount) =>
                onChange({
                  ...value,
                  friendships: { ...value.friendships, approximateCount },
                })
              }
            />
            <TextField
              id="friend_quality"
              label="Quality of friendships"
              value={value.friendships.quality}
              onChange={(quality) =>
                onChange({
                  ...value,
                  friendships: { ...value.friendships, quality },
                })
              }
            />
            <TextAreaField
              id="friend_detail"
              label="Detail"
              value={value.friendships.detail}
              onChange={(detail) =>
                onChange({
                  ...value,
                  friendships: { ...value.friendships, detail },
                })
              }
            />
          </>
        ) : null}
      </section>

      <section className="space-y-3">
        <p className="text-sm font-medium">Religious engagement</p>
        <YesNoField
          name="religious_engaged"
          label="Religiously or spiritually engaged?"
          value={value.religiousEngagement.engaged}
          onChange={(engaged) =>
            onChange({
              ...value,
              religiousEngagement: { ...value.religiousEngagement, engaged },
            })
          }
        />
        {value.religiousEngagement.engaged ? (
          <>
            <TextField
              id="religious_tradition"
              label="Tradition / community"
              value={value.religiousEngagement.tradition}
              onChange={(tradition) =>
                onChange({
                  ...value,
                  religiousEngagement: {
                    ...value.religiousEngagement,
                    tradition,
                  },
                })
              }
            />
            <TextAreaField
              id="religious_detail"
              label="Detail"
              value={value.religiousEngagement.detail}
              onChange={(detail) =>
                onChange({
                  ...value,
                  religiousEngagement: { ...value.religiousEngagement, detail },
                })
              }
            />
          </>
        ) : null}
        <YesNoField
          name="suicide_protective_belief"
          label="Does this belief system include a prohibition against suicide, or otherwise function as protective against suicide?"
          value={value.religiousEngagement.suicideProtectiveBelief}
          onChange={(suicideProtectiveBelief) =>
            onChange({
              ...value,
              religiousEngagement: {
                ...value.religiousEngagement,
                suicideProtectiveBelief,
              },
            })
          }
        />
        {value.religiousEngagement.suicideProtectiveBelief ? (
          <TextAreaField
            id="suicide_protective_detail"
            label="Protective-belief detail"
            value={value.religiousEngagement.suicideProtectiveBeliefDetail}
            onChange={(suicideProtectiveBeliefDetail) =>
              onChange({
                ...value,
                religiousEngagement: {
                  ...value.religiousEngagement,
                  suicideProtectiveBeliefDetail,
                },
              })
            }
          />
        ) : null}
      </section>

      <section className="space-y-3">
        <p className="text-sm font-medium">Group membership</p>
        <p className="text-xs text-muted-foreground">
          Clubs, teams, peer groups, recovery fellowships, and similar.
        </p>
        <DynamicList
          items={value.groups}
          onChange={(groups) => onChange({ ...value, groups })}
          createEmpty={emptyGroup}
          isEmpty={(item) => !item.name.trim()}
          renderRow={(item, _index, update) => (
            <div className="grid gap-3 rounded-md border p-3 sm:grid-cols-2">
              <TextField
                id={`${item.id}_name`}
                label="Group"
                value={item.name}
                onChange={(name) => update({ ...item, name })}
              />
              <TextField
                id={`${item.id}_detail`}
                label="Detail"
                value={item.detail}
                onChange={(detail) => update({ ...item, detail })}
              />
            </div>
          )}
        />
      </section>
    </div>
  )
}
