
"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  Bell,
  BriefcaseBusiness,
  CalendarDays,
  Check,
  ClipboardList,
  LayoutDashboard,
  LogOut,
  RefreshCw,
  UserRound,
  Users,
  X,
} from "lucide-react";

type Profile = {
  full_name: string;
  email: string;
  role: string;
};

type NotificationItem = {
  id: string;
  title: string;
  message: string;
  notification_type: string;
  read_at: string | null;
  created_at: string;
};

const links = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/dashboard/attendance", label: "Attendance", icon: CalendarDays },
  { href: "/dashboard/tasks", label: "My tasks", icon: ClipboardList },
  { href: "/dashboard/leave", label: "Leave requests", icon: BriefcaseBusiness },
  { href: "/dashboard/announcements", label: "Announcements", icon: Bell },
  { href: "/dashboard/profile", label: "My profile", icon: UserRound },
];

function getInitials(name: string) {
  return (
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("") || "E"
  );
}

function formatNotificationDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "";

  return date.toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function EmployeeAvatar({
  name,
  photoUrl,
  size = "h-11 w-11",
}: {
  name: string;
  photoUrl: string;
  size?: string;
}) {
  return (
    <div
      className={`shrink-0 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 p-[2px] ${size}`}
    >
      <div className="grid h-full w-full place-items-center overflow-hidden rounded-full bg-slate-100 text-sm font-bold text-blue-700">
        {photoUrl ? (
          <img
            src={photoUrl}
            alt={`${name}'s profile`}
            className="h-full w-full rounded-full object-cover"
          />
        ) : (
          <span>{getInitials(name)}</span>
        )}
      </div>
    </div>
  );
}

export default function PortalShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [photoUrl, setPhotoUrl] = useState("");
  const [checking, setChecking] = useState(true);
  const [problem, setProblem] = useState("");

  const [userId, setUserId] = useState("");
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notificationLoading, setNotificationLoading] = useState(false);
  const [notificationError, setNotificationError] = useState("");
  const [updatingNotificationId, setUpdatingNotificationId] = useState("");

  const loadNotifications = useCallback(async (recipientId: string) => {
    const supabase = createClient();

    setNotificationLoading(true);
    setNotificationError("");

    try {
      const [listResult, countResult] = await Promise.all([
        supabase
          .from("notifications")
          .select(
            "id,title,message,notification_type,read_at,created_at"
          )
          .eq("recipient_id", recipientId)
          .order("created_at", { ascending: false })
          .limit(10),

        supabase
          .from("notifications")
          .select("id", { count: "exact", head: true })
          .eq("recipient_id", recipientId)
          .is("read_at", null),
      ]);

      if (listResult.error) throw listResult.error;
      if (countResult.error) throw countResult.error;

      setNotifications((listResult.data ?? []) as NotificationItem[]);
      setUnreadCount(countResult.count ?? 0);
    } catch (error) {
      setNotificationError(
        error instanceof Error
          ? error.message
          : "Unable to load notifications."
      );
    } finally {
      setNotificationLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    const supabase = createClient();

    async function load() {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (!active) return;

      if (authError || !user) {
        router.replace("/login");
        return;
      }

      setUserId(user.id);

      const { data, error: profileError } = await supabase
        .from("profiles")
        .select("full_name,email,role")
        .eq("id", user.id)
        .maybeSingle();

      if (!active) return;

      if (profileError) {
        setProblem(profileError.message);
      }

      const currentProfile: Profile = data ?? {
        full_name: user.user_metadata?.full_name ?? "Employee",
        email: user.email ?? "",
        role: "employee",
      };

      setProfile(currentProfile);

      const avatarPath = user.user_metadata?.avatar_path;

      if (typeof avatarPath === "string" && avatarPath) {
        const { data: signedImage, error: imageError } =
          await supabase.storage
            .from("employee-photos")
            .createSignedUrl(avatarPath, 3600);

        if (!active) return;

        if (!imageError && signedImage?.signedUrl) {
          setPhotoUrl(signedImage.signedUrl);
        } else {
          setPhotoUrl("");
          setProblem(
            imageError?.message ??
              "Could not load your profile photo. You can try again from My Profile."
          );
        }
      } else {
        const metadataPhoto =
          user.user_metadata?.avatar_url ??
          user.user_metadata?.picture ??
          "";

        setPhotoUrl(
          typeof metadataPhoto === "string" ? metadataPhoto : ""
        );
      }

      if (active) {
        setChecking(false);
        void loadNotifications(user.id);
      }
    }

    load().catch((error) => {
      if (active) {
        setProblem(
          error instanceof Error
            ? error.message
            : "Unable to load your account."
        );
        setChecking(false);
      }
    });

    return () => {
      active = false;
    };
  }, [router, loadNotifications]);

  async function markAsRead(notification: NotificationItem) {
    if (!userId || notification.read_at || updatingNotificationId) {
      return;
    }

    setUpdatingNotificationId(notification.id);
    setNotificationError("");

    try {
      const supabase = createClient();

      const { error } = await supabase
        .from("notifications")
        .update({ read_at: new Date().toISOString() })
        .eq("id", notification.id)
        .eq("recipient_id", userId)
        .is("read_at", null);

      if (error) throw error;

      setNotifications((current) =>
        current.map((item) =>
          item.id === notification.id
            ? { ...item, read_at: new Date().toISOString() }
            : item
        )
      );

      setUnreadCount((count) => Math.max(0, count - 1));
    } catch (error) {
      setNotificationError(
        error instanceof Error
          ? error.message
          : "Unable to mark notification as read."
      );
    } finally {
      setUpdatingNotificationId("");
    }
  }

  async function signOut() {
    const supabase = createClient();
    const { error } = await supabase.auth.signOut();

    if (error) {
      setProblem(error.message);
      return;
    }

    router.replace("/login");
    router.refresh();
  }

  if (checking) {
    return (
      <main className="grid min-h-screen place-items-center text-slate-600">
        Loading your secure workspace…
      </main>
    );
  }

  const employeeName = profile?.full_name ?? "Employee";

  return (
    <div className="min-h-screen md:flex">
      <aside className="w-full bg-slate-950 p-5 text-white md:fixed md:inset-y-0 md:flex md:w-64 md:flex-col">
        <Link
          href="/dashboard"
          className="mb-7 flex items-center gap-3"
        >
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-blue-600 text-xl font-bold">
            Z
          </span>

          <span>
            <b className="block">Zentryx Logic</b>
            <small className="text-slate-400">
              Employee workspace
            </small>
          </span>
        </Link>

        <nav className="flex flex-wrap gap-2 md:flex-col">
          {links.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm ${
                pathname === href
                  ? "bg-blue-600 text-white"
                  : "text-slate-300 hover:bg-slate-800"
              }`}
            >
              <Icon size={18} />
              {label}
            </Link>
          ))}

          {profile?.role === "admin" && (
            <Link
              href="/admin"
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm ${
                pathname.startsWith("/admin")
                  ? "bg-blue-600 text-white"
                  : "text-slate-300 hover:bg-slate-800"
              }`}
            >
              <Users size={18} />
              Admin console
            </Link>
          )}
        </nav>

        <div className="mt-6 border-t border-slate-800 pt-5 md:mt-auto">
          <div className="flex min-w-0 items-center gap-3">
            <EmployeeAvatar
              name={employeeName}
              photoUrl={photoUrl}
              size="h-12 w-12"
            />

            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">
                {employeeName}
              </p>

              <p className="truncate text-xs text-slate-400">
                {profile?.email}
              </p>

              <p className="mt-1 text-xs capitalize text-blue-300">
                {profile?.role ?? "employee"}
              </p>
            </div>
          </div>

          <button
            onClick={signOut}
            className="mt-4 flex items-center gap-2 rounded-lg px-2 py-2 text-sm text-slate-300 hover:bg-slate-800"
          >
            <LogOut size={16} />
            Sign out
          </button>
        </div>
      </aside>

      <main className="min-w-0 flex-1 p-4 sm:p-7 md:ml-64">
        <header className="mb-7 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm text-slate-500">
              Zentryx Logic / Workspace
            </p>

            <h1 className="mt-1 text-2xl font-bold text-slate-900">
              {links.find((item) => item.href === pathname)?.label ??
                (pathname.startsWith("/admin")
                  ? "Admin console"
                  : "Workspace")}
            </h1>
          </div>

          <div className="flex shrink-0 items-center gap-3">
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  const opening = !notificationsOpen;
                  setNotificationsOpen(opening);

                  if (opening && userId) {
                    void loadNotifications(userId);
                  }
                }}
                aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ""}`}
                aria-expanded={notificationsOpen}
                className="relative grid h-10 w-10 place-items-center rounded-xl border border-slate-200 bg-white text-slate-700 transition hover:bg-slate-50"
              >
                <Bell size={20} />

                {unreadCount > 0 && (
                  <span className="absolute -right-1.5 -top-1.5 grid min-h-5 min-w-5 place-items-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white ring-2 ring-white">
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </span>
                )}
              </button>

              {notificationsOpen && (
                <>
                  <button
                    type="button"
                    aria-label="Close notifications"
                    className="fixed inset-0 z-40 cursor-default"
                    onClick={() => setNotificationsOpen(false)}
                  />

                  <section className="absolute right-0 z-50 mt-3 w-[min(360px,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-slate-200 bg-white text-slate-900 shadow-2xl">
                    <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                      <div>
                        <h2 className="font-semibold">Notifications</h2>
                        <p className="text-xs text-slate-500">
                          {unreadCount} unread
                        </p>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            if (userId) {
                              void loadNotifications(userId);
                            }
                          }}
                          disabled={notificationLoading}
                          aria-label="Refresh notifications"
                          className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 disabled:opacity-50"
                        >
                          <RefreshCw
                            size={16}
                            className={
                              notificationLoading ? "animate-spin" : ""
                            }
                          />
                        </button>

                        <button
                          type="button"
                          onClick={() => setNotificationsOpen(false)}
                          aria-label="Close notifications"
                          className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    </div>

                    {notificationError && (
                      <p className="m-3 rounded-lg bg-red-50 p-3 text-xs text-red-700">
                        {notificationError}
                      </p>
                    )}

                    <div className="max-h-[min(440px,65vh)] overflow-y-auto">
                      {notificationLoading && notifications.length === 0 ? (
                        <p className="p-6 text-center text-sm text-slate-500">
                          Loading notifications…
                        </p>
                      ) : notifications.length === 0 ? (
                        <div className="px-5 py-10 text-center">
                          <Bell
                            size={28}
                            className="mx-auto mb-3 text-slate-300"
                          />
                          <p className="text-sm font-medium">
                            You&apos;re all caught up
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            New task and announcement notifications will appear here.
                          </p>
                        </div>
                      ) : (
                        notifications.map((notification) => (
                          <div
                            key={notification.id}
                            className={`border-b border-slate-100 p-4 last:border-b-0 ${
                              notification.read_at
                                ? "bg-white"
                                : "bg-blue-50/70"
                            }`}
                          >
                            <div className="flex items-start gap-3">
                              <span
                                className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${
                                  notification.read_at
                                    ? "bg-slate-300"
                                    : "bg-blue-600"
                                }`}
                              />

                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-semibold">
                                  {notification.title}
                                </p>

                                <p className="mt-1 whitespace-pre-wrap break-words text-sm text-slate-600">
                                  {notification.message}
                                </p>

                                <p className="mt-2 text-xs text-slate-400">
                                  {formatNotificationDate(
                                    notification.created_at
                                  )}
                                </p>

                                {!notification.read_at && (
                                  <button
                                    type="button"
                                    disabled={
                                      updatingNotificationId ===
                                      notification.id
                                    }
                                    onClick={() =>
                                      void markAsRead(notification)
                                    }
                                    className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-blue-700 hover:text-blue-900 disabled:opacity-50"
                                  >
                                    <Check size={14} />
                                    {updatingNotificationId ===
                                    notification.id
                                      ? "Updating…"
                                      : "Mark as read"}
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>

                    <div className="border-t border-slate-100 px-4 py-3">
                      <p className="text-center text-xs text-slate-500">
                        Showing your 10 most recent notifications
                      </p>
                    </div>
                  </section>
                </>
              )}
            </div>

            <EmployeeAvatar
              name={employeeName}
              photoUrl={photoUrl}
              size="h-10 w-10"
            />

            <span className="rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-600">
              {profile?.role ?? "employee"}
            </span>
          </div>
        </header>

        {problem && (
          <p className="mb-4 break-words rounded-xl bg-amber-50 p-3 text-sm text-amber-800">
            Profile notice: {problem}
          </p>
        )}

        {children}
      </main>
    </div>
  );
}
