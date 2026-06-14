"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState } from "react"
import { ChevronDownIcon, MenuIcon, XIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Sheet, SheetClose, SheetContent } from "@/components/ui/sheet"
import { cn } from "@/lib/utils"

type NavLink = {
  href: string
  label: string
}

type NavDropdown = {
  label: string
  items: NavLink[]
  isActive: (pathname: string) => boolean
}

const topLevelLinks: NavLink[] = [
  { href: "/dashboard", label: "Home" },
  { href: "/calendar", label: "Calendar" },
  { href: "/clients", label: "Clients" },
]

const dropdownMenus: NavDropdown[] = [
  {
    label: "Contacts",
    items: [
      { href: "/contacts/professionals", label: "All Professionals" },
      { href: "/contacts/organisations", label: "All Organisations" },
    ],
    isActive: (pathname) => pathname.startsWith("/contacts"),
  },
  {
    label: "Practice",
    items: [
      { href: "/practice", label: "Practice Details" },
      { href: "/practitioner", label: "My Practitioner Profile" },
    ],
    isActive: (pathname) =>
      pathname.startsWith("/practice") || pathname.startsWith("/practitioner"),
  },
  {
    label: "Settings",
    items: [
      { href: "/settings/professions", label: "Professions" },
      { href: "/settings/appointment-types", label: "Appointment Types" },
      { href: "/settings/email-templates", label: "Email Templates" },
      { href: "/settings/assessments", label: "Assessments" },
      { href: "/funding/claim-types", label: "Claim Types" },
      { href: "/funding/approval-types", label: "Funding Approval Types" },
    ],
    isActive: (pathname) =>
      pathname.startsWith("/settings") ||
      pathname.startsWith("/funding/claim-types") ||
      pathname.startsWith("/funding/approval-types"),
  },
  {
    label: "Admin",
    items: [
      { href: "/clients", label: "All Clients" },
      { href: "/appointments", label: "All Appointments" },
      { href: "/session-notes", label: "All Session Notes" },
      { href: "/funding/claims", label: "All Claims" },
      { href: "/funding/approvals", label: "All Funding Approvals" },
    ],
    isActive: (pathname) =>
      pathname.startsWith("/appointments") ||
      pathname.startsWith("/session-notes") ||
      pathname.startsWith("/funding/claims") ||
      pathname.startsWith("/funding/approvals"),
  },
]

const profileLink: NavLink = {
  href: "/practitioner",
  label: "Profile",
}

function isLinkActive(pathname: string, href: string): boolean {
  if (href === "/dashboard") {
    return pathname === "/dashboard"
  }

  return pathname === href || pathname.startsWith(`${href}/`)
}

function activeNavClass(active: boolean) {
  return cn(active && "bg-muted text-foreground")
}

function NavLinkButton({ href, label }: NavLink) {
  const pathname = usePathname()
  const active = isLinkActive(pathname, href)

  return (
    <Button
      variant="ghost"
      size="sm"
      asChild
      className={activeNavClass(active)}
    >
      <Link href={href}>{label}</Link>
    </Button>
  )
}

function NavDropdownMenu({ menu }: { menu: NavDropdown }) {
  const pathname = usePathname()
  const active = menu.isActive(pathname)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={cn("gap-1", activeNavClass(active))}
        >
          {menu.label}
          <ChevronDownIcon className="size-3.5 opacity-70" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {menu.items.map((item) => (
          <DropdownMenuItem key={item.href} asChild>
            <Link
              href={item.href}
              className={activeNavClass(isLinkActive(pathname, item.href))}
            >
              {item.label}
            </Link>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function mobileLinkClass(active: boolean) {
  return cn(
    "block rounded-lg px-3 py-2.5 text-sm hover:bg-muted",
    active && "bg-muted font-medium text-foreground"
  )
}

function MobileNav() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-expanded={open}
        aria-label={open ? "Close menu" : "Open menu"}
        onClick={() => setOpen((current) => !current)}
      >
        {open ? <XIcon /> : <MenuIcon />}
      </Button>
      <SheetContent
        side="right"
        showCloseButton={false}
        className="w-full max-w-full gap-0 p-0 sm:max-w-sm"
      >
        <nav className="flex flex-col overflow-y-auto px-4 py-4">
          {topLevelLinks.map((item) => (
            <SheetClose key={item.href} asChild>
              <Link
                href={item.href}
                className={mobileLinkClass(isLinkActive(pathname, item.href))}
              >
                {item.label}
              </Link>
            </SheetClose>
          ))}

          {dropdownMenus.map((menu) => (
            <div key={menu.label} className="mt-4">
              <p className="px-3 pb-1 text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                {menu.label}
              </p>
              {menu.items.map((item) => (
                <SheetClose key={item.href} asChild>
                  <Link
                    href={item.href}
                    className={mobileLinkClass(
                      isLinkActive(pathname, item.href)
                    )}
                  >
                    {item.label}
                  </Link>
                </SheetClose>
              ))}
            </div>
          ))}

          <div className="mt-4 border-t pt-4">
            <SheetClose asChild>
              <Link
                href={profileLink.href}
                className={mobileLinkClass(
                  isLinkActive(pathname, profileLink.href)
                )}
              >
                {profileLink.label}
              </Link>
            </SheetClose>
          </div>
        </nav>
      </SheetContent>
    </Sheet>
  )
}

export function AppNav() {
  const pathname = usePathname()
  const profileActive = isLinkActive(pathname, profileLink.href)

  return (
    <>
      <nav className="hidden flex-1 items-center gap-1 md:flex">
        {topLevelLinks.map((item) => (
          <NavLinkButton key={item.href} {...item} />
        ))}
        {dropdownMenus.map((menu) => (
          <NavDropdownMenu key={menu.label} menu={menu} />
        ))}
      </nav>

      <div className="hidden items-center md:flex">
        <Button
          variant="ghost"
          size="sm"
          asChild
          className={activeNavClass(profileActive)}
        >
          <Link href={profileLink.href}>{profileLink.label}</Link>
        </Button>
      </div>

      <div className="ml-auto md:hidden">
        <MobileNav />
      </div>
    </>
  )
}
