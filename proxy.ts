import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"
export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const { pathname } = request.nextUrl
  const isPublic =
    pathname === "/login" ||
    pathname.startsWith("/q/") ||
    pathname === "/api/assessments/submit" ||
    pathname.startsWith("/api/cron/")
  const isApi = pathname.startsWith("/api/")
  if (!user && !isPublic) {
    // API callers (fetch + FormData) cannot follow a login redirect — they'd get
    // the HTML login page and fail to parse JSON. Let the route return 401 itself.
    if (isApi) {
      return supabaseResponse
    }
    const url = request.nextUrl.clone()
    url.pathname = "/login"
    return NextResponse.redirect(url)
  }
  if (user && pathname === "/login") {
    const url = request.nextUrl.clone()
    url.pathname = "/dashboard"
    return NextResponse.redirect(url)
  }
  return supabaseResponse
}
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}
