"use client"
import { cn } from '@/lib/utils'
import { Show, SignInButton, SignUpButton, UserButton, useUser } from '@clerk/nextjs'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const Navbar = () => {
  const navItems=[
    {lable : "Library" ,herf : "/"},
    {lable : "Add New" ,herf: "/books/new"}
  ]
  const pathname=usePathname()
  const {user}=useUser()
  return (
    <header className='w-full fixed z-50  bg-[var(--bg-primary)]'>
        <div className='wrapper navbar-height py-4 flex justify-between items-center'>
          <Link href="/" className="flex gap-0.5 items-center" >
          <Image src="/assets/logo.png" alt='Bookfied' width={42} height={36}/>
          <span className='logo-text'>Bookfield</span>
          </Link>
          <nav className='w-fit flex gap-7.5 items-center'>
            {navItems.map(({lable,herf})=>{
              const isActive=pathname === herf ||
              (herf !== "/" && pathname.startsWith(herf));
              return (
                <Link href={herf} key={lable}
                className={cn('nav-link-active',
                  isActive ? 'nav-link-active':
                  'font-black hover:opacity-70'
                )}
                >
                  {lable}
                </Link>
              )
            })}
            <Show when="signed-out">
              <SignInButton mode="modal">
                <button type="button" className="nav-link-active hover:opacity-70">
                  Sign in
                </button>
              </SignInButton>
              {/* <SignUpButton mode="modal">
                <button type="button" className="rounded-full bg-[var(--text-primary)] px-4 py-2 text-sm font-semibold text-white hover:opacity-85">
                  Sign up
                </button>
              </SignUpButton> */}
            </Show>
            <Show when="signed-in">
              <div className='nav-user-link'>
                <UserButton />
              {user?.firstName && 
              <Link href="/subcriptions" className='nav-user-name px-2'>
                {user.firstName}
              </Link>}
              </div>
            </Show>
          </nav>
        </div>
    </header >
  )
}

export default Navbar