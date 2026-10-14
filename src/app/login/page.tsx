"use client";
import { useState } from "react";
import type { FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Eye, EyeOff, LockKeyhole, Mail, UserRound } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [signup, setSignup] = useState(false); const [show, setShow] = useState(false);
  const [name, setName] = useState(""); const [email, setEmail] = useState(""); const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const [message, setMessage] = useState("");
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); setBusy(true); setError(""); setMessage("");
    try {
      const supabase = createClient();
      if (signup) {
        if (password.length < 8) throw new Error("Use a password with at least 8 characters.");
        const { data, error: e1 } = await supabase.auth.signUp({ email: email.trim(), password, options: { data: { full_name: name.trim() }, emailRedirectTo: `${window.location.origin}/auth/callback` } });
        if (e1) throw e1;
        if (data.session) { router.replace("/dashboard"); router.refresh(); }
        else { setSignup(false); setMessage("Account created. Check your email to confirm it, then sign in."); }
      } else {
        const { error: e1 } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (e1) throw e1;
        router.replace("/dashboard"); router.refresh();
      }
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to continue. Please try again."); }
    finally { setBusy(false); }
  }
  return <main className="flex min-h-screen items-center justify-center bg-slate-950 p-4"><div className="grid w-full max-w-5xl overflow-hidden rounded-3xl bg-white shadow-2xl md:grid-cols-2">
    <section className="hidden flex-col justify-between bg-gradient-to-br from-blue-700 via-blue-800 to-slate-950 p-10 text-white md:flex"><div><div className="mb-12 flex items-center gap-3"><span className="grid h-12 w-12 place-items-center rounded-xl bg-white/15 text-2xl font-bold">Z</span><div><b className="text-lg">Zentryx Logic</b><p className="text-sm text-blue-200">Employee workspace</p></div></div><h1 className="text-4xl font-bold leading-tight">One workspace.<br/>Your entire workday.</h1><p className="mt-5 max-w-sm leading-7 text-blue-100">Access attendance, assigned tasks, leave requests and company updates in one place.</p></div><p className="text-sm text-blue-200">AI · Software Development · Cloud · Digital Innovation</p></section>
    <section className="p-7 sm:p-10"><div className="mb-8 md:hidden"><b className="text-xl">Zentryx Logic</b><p className="text-sm text-slate-500">Employee Portal</p></div><p className="text-sm font-bold tracking-wide text-blue-700">EMPLOYEE WORKSPACE</p><h2 className="mt-2 text-3xl font-bold">{signup ? "Create your account" : "Welcome back"}</h2><p className="mt-2 text-sm text-slate-500">{signup ? "Register your employee account to get started." : "Sign in to access your workspace."}</p>
      <form onSubmit={submit} className="mt-8 space-y-5">{signup && <label className="block text-sm font-medium">Full name<div className="relative mt-2"><UserRound className="absolute left-3 top-3.5 text-slate-400" size={19}/><input value={name} onChange={e=>setName(e.target.value)} required autoComplete="name" placeholder="Your full name" className="w-full rounded-xl border border-slate-200 py-3 pl-10 pr-3 outline-none focus:border-blue-600"/></div></label>}
      <label className="block text-sm font-medium">Email address<div className="relative mt-2"><Mail className="absolute left-3 top-3.5 text-slate-400" size={19}/><input type="email" value={email} onChange={e=>setEmail(e.target.value)} required autoComplete="email" placeholder="you@company.com" className="w-full rounded-xl border border-slate-200 py-3 pl-10 pr-3 outline-none focus:border-blue-600"/></div></label>
      <label className="block text-sm font-medium">Password<div className="relative mt-2"><LockKeyhole className="absolute left-3 top-3.5 text-slate-400" size={19}/><input type={show?"text":"password"} value={password} onChange={e=>setPassword(e.target.value)} required minLength={8} autoComplete={signup?"new-password":"current-password"} placeholder="At least 8 characters" className="w-full rounded-xl border border-slate-200 py-3 pl-10 pr-12 outline-none focus:border-blue-600"/><button type="button" onClick={()=>setShow(!show)} aria-label={show?"Hide password":"Show password"} className="absolute right-3 top-3.5 text-slate-500">{show?<EyeOff size={19}/>:<Eye size={19}/>}</button></div></label>
      {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}{message && <p role="status" className="rounded-lg bg-blue-50 p-3 text-sm text-blue-700">{message}</p>}
      <button disabled={busy} className="w-full rounded-xl bg-blue-700 px-4 py-3.5 font-semibold text-white hover:bg-blue-800 disabled:opacity-60">{busy?"Please wait…":signup?"Create account":"Sign in"}</button></form>
      <p className="mt-6 text-center text-sm text-slate-600">{signup?"Already registered?":"New employee?"} <button type="button" onClick={()=>{setSignup(!signup);setError("");setMessage("");}} className="font-semibold text-blue-700 hover:underline">{signup?"Sign in":"Create account"}</button></p><p className="mt-8 text-center text-xs text-slate-400">Protected employee workspace · Zentryx Logic</p>
    </section></div></main>;
}
