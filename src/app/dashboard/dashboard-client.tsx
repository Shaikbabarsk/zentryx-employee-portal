
"use client";


import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Clock,
  CheckSquare,
  CalendarDays,
  LogOut,
  UserCircle,
  LoaderCircle,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Profile = {
  full_name: string | null;
  email: string | null;
  role: string | null;
  department: string | null;
  job_title: string | null;
};

export default function DashboardPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadProfile() {
      const supabase = createClient();

      const { data: authData, error: authError } =
        await supabase.auth.getUser();

      if (authError || !authData.user) {
        router.replace("/login");
        return;
      }

      const { data, error: profileError } = await supabase
        .from("profiles")
        .select("full_name, email, role, department, job_title")
        .eq("id", authData.user.id)
        .maybeSingle();

      if (!active) return;

      if (profileError) {
        setError(profileError.message);
      } else {
        setProfile({
          full_name:
            data?.full_name ??
            authData.user.user_metadata?.full_name ??
            "Employee",
          email: data?.email ?? authData.user.email ?? "",
          role: data?.role ?? "employee",
          department: data?.department ?? null,
          job_title: data?.job_title ?? null,
        });
      }

      setLoading(false);
    }

    loadProfile().catch((err: unknown) => {
      if (!active) return;
      setError(
        err instanceof Error ? err.message : "Unable to load your profile."
      );
      setLoading(false);
    });

    return () => {
      active = false;
    };
  }, [router]);

  async function handleSignOut() {
    setSigningOut(true);
    const supabase = createClient();
    const { error: signOutError } = await supabase.auth.signOut();

    if (signOutError) {
      setError(signOutError.message);
      setSigningOut(false);
      return;
    }

    router.replace("/login");
    router.refresh();
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="flex items-center gap-3 text-slate-600">
          <LoaderCircle className="animate-spin" size={22} />
          <span>Loading your employee portal...</span>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-4">
          <div>
            <p className="text-xl font-bold tracking-tight text-blue-900">
              Zentryx Logic
            </p>
            <p className="text-xs text-slate-500">Employee Portal</p>
          </div>

          <button
            onClick={handleSignOut}
            disabled={signingOut}
            className="flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium hover:bg-slate-50 disabled:opacity-50"
          >
            <LogOut size={16} />
            {signingOut ? "Signing out..." : "Sign out"}
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-5 py-10">
        <div className="mb-8">
          <p className="text-sm font-medium text-blue-700">
            EMPLOYEE WORKSPACE
          </p>
          <h1 className="mt-2 text-3xl font-bold">
            Welcome, {profile?.full_name || "Employee"}!
          </h1>
          <p className="mt-2 text-slate-500">
            Manage your attendance, tasks and leave requests in one place.
          </p>
        </div>

        {error && (
          <div
            role="alert"
            className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
          >
            {error}
          </div>
        )}

        <section className="mb-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <UserCircle className="mb-4 text-blue-700" size={25} />
            <p className="text-sm text-slate-500">Account</p>
            <p className="mt-1 font-semibold capitalize">
              {profile?.role ?? "Employee"}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <Clock className="mb-4 text-emerald-700" size={25} />
            <p className="text-sm text-slate-500">Attendance</p>
            <p className="mt-1 font-semibold">Check in / Check out</p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <CheckSquare className="mb-4 text-amber-700" size={25} />
            <p className="text-sm text-slate-500">My tasks</p>
            <p className="mt-1 font-semibold">Task management</p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <CalendarDays className="mb-4 text-purple-700" size={25} />
            <p className="text-sm text-slate-500">Leave</p>
            <p className="mt-1 font-semibold">Leave requests</p>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 lg:col-span-2">
            <div className="mb-5 flex items-center gap-3">
              <LayoutDashboard className="text-blue-700" size={22} />
              <h2 className="text-lg font-semibold">Employee overview</h2>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl bg-slate-50 p-4">
                <p className="text-sm text-slate-500">Department</p>
                <p className="mt-1 font-medium">
                  {profile?.department || "Not assigned yet"}
                </p>
              </div>
              <div className="rounded-xl bg-slate-50 p-4">
                <p className="text-sm text-slate-500">Job title</p>
                <p className="mt-1 font-medium">
                  {profile?.job_title || "Not assigned yet"}
                </p>
              </div>
            </div>
            <p className="mt-5 text-sm text-slate-500">
              Your attendance and task actions can be connected to the database
              next.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6">
            <h2 className="text-lg font-semibold">Account details</h2>
            <p className="mt-4 break-all text-sm text-slate-500">Email</p>
            <p className="mt-1 break-all font-medium">
              {profile?.email || "Not available"}
            </p>
            <p className="mt-5 text-sm text-slate-500">
              Need help? Contact your portal administrator.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
