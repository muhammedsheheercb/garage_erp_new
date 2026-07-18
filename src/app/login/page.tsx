"use client"

import { useState } from "react"
import { signIn } from "next-auth/react"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Wrench, Eye, EyeOff } from "lucide-react"
import { toast } from "sonner"

export default function LoginPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      })

      if (result?.error) {
        toast.error("Invalid email or password")
        return
      }

      toast.success("Logged in successfully")
      const from = searchParams.get("from") || "/"
      router.push(from)
      router.refresh()
    } catch (error) {
      toast.error("Something went wrong. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex flex-col lg:flex-row min-h-screen bg-[#1c1c1c] text-white font-sans selection:bg-[#e32400] selection:text-white">
      {/* Left side - Image */}
      <div className="relative w-full h-[40vh] lg:w-1/2 lg:h-screen">
        <img
          src="https://images.unsplash.com/photo-1611760399750-bf3b95ac8f0a?q=80&w=687&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D"
          alt="Garage Background"
          className="absolute inset-0 h-full w-full object-cover"
        />
        {/* Subtle gradient to make bottom text readable */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent z-10" />

        <div className="absolute bottom-8 left-8 lg:bottom-24 lg:left-16 z-20">
          <h1 className="text-3xl lg:text-[42px] font-semibold leading-tight tracking-tight mb-2 drop-shadow-md">
            Journey Beyond
          </h1>
          <p className="text-base lg:text-lg text-white/90 mb-6 lg:mb-8 drop-shadow-md">
            Explore the advanced Garage ERP system.
          </p>
          <button className="bg-white text-black px-6 lg:px-8 py-2 lg:py-3 font-semibold text-sm hover:bg-gray-200 transition-colors">
            Explore
          </button>
        </div>
      </div>

      {/* Right side - Login Form */}
      <div className="flex w-full flex-col lg:w-1/2 min-h-[60vh] lg:h-screen px-6 sm:px-12 lg:px-24 py-12 lg:py-16 bg-[#1a1a1a] relative overflow-y-auto">



        <div className="w-full max-w-[440px] mx-auto mt-auto mb-auto relative z-10 flex flex-col">
          {/* Brand / Logo */}
          <div className="flex items-center gap-2 mb-16">
            <Wrench className="h-6 w-6 text-white" />
            <span className="font-bold text-xl uppercase tracking-widest font-serif">Garage ERP</span>
          </div>

          <h2 className="text-4xl font-medium mb-10 tracking-tight">
            PLEASE LOG IN
          </h2>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Custom Input: Email */}
            <div className="bg-[#2a2a2a] border border-[#3a3a3a] px-4 py-3 focus-within:border-[#e32400] transition-colors group">
              <label className="block text-[13px] text-gray-400 font-medium mb-1" htmlFor="email">
                Email
              </label>
              <input
                id="email"
                type="email"
                placeholder="John Doe"
                required
                className="w-full bg-transparent text-white text-base placeholder:text-transparent focus:placeholder:text-gray-500 focus:outline-none"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isLoading}
              />
            </div>

            {/* Custom Input: Password */}
            <div className="bg-[#2a2a2a] border border-[#3a3a3a] px-4 py-3 focus-within:border-[#e32400] transition-colors group relative">
              <label className="block text-[13px] text-gray-400 font-medium mb-1" htmlFor="password">
                Password
              </label>
              <div className="flex items-center">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="********"
                  required
                  className="w-full bg-transparent text-white text-base placeholder:text-transparent focus:placeholder:text-gray-500 focus:outline-none tracking-widest font-mono pr-8"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isLoading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 mt-2 text-gray-400 hover:text-white transition-colors"
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            {/* Login Button */}
            <button
              type="submit"
              className="w-full bg-[#e32400] hover:bg-[#d02000] text-white font-semibold py-4 text-[15px] transition-colors mt-2"
              disabled={isLoading}
            >
              {isLoading ? "LOGGING IN..." : "LOG IN"}
            </button>


          </form>

          {/* Footer */}
          <div className="mt-12 flex items-center justify-between text-xs font-medium text-[#e32400]">
            <a href="#" className="hover:underline">Sign up</a>
            <div className="h-[1px] flex-1 bg-[#3a3a3a] mx-4 relative">
              {/* Red line indicator mimicking the screenshot */}
              <div className="absolute top-0 left-0 h-[1px] w-full bg-[#e32400]/40"></div>
            </div>
            <span className="text-gray-500">Memberstack</span>
          </div>
        </div>
      </div>
    </div>
  )
}
