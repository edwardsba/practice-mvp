import { eq, and } from "drizzle-orm"
import { redirect } from "next/navigation"

import { db } from "@/lib/db"
import { createClient } from "@/lib/supabase/server"
import { practitionerProfiles, practices, users } from "@/db/schema"

export type PractitionerContext = {
  userId: string
  practiceId: string
  practitionerProfileId: string
  email: string
}

export async function getPractitionerContext(): Promise<PractitionerContext | null> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user?.email) {
    return null
  }

  const [dbUser] = await db
    .select()
    .from(users)
    .where(eq(users.email, user.email))
    .limit(1)

  if (!dbUser) {
    return null
  }

  const [profile] = await db
    .select()
    .from(practitionerProfiles)
    .where(
      and(
        eq(practitionerProfiles.userId, dbUser.userId),
        eq(practitionerProfiles.isActive, true)
      )
    )
    .limit(1)

  if (!profile) {
    return null
  }

  return {
    userId: dbUser.userId,
    practiceId: profile.practiceId,
    practitionerProfileId: profile.practitionerProfileId,
    email: user.email,
  }
}

export async function requirePractitionerContext(): Promise<PractitionerContext> {
  const context = await getPractitionerContext()
  if (!context) {
    redirect("/login")
  }
  return context
}

export async function getPracticeForContext(practiceId: string) {
  const [practice] = await db
    .select()
    .from(practices)
    .where(eq(practices.practiceId, practiceId))
    .limit(1)

  return practice ?? null
}
