"use client";
import Link from "next/link";
export default function Sidebar() { return <nav className="flex flex-wrap gap-3"><Link href="/dashboard">Overview</Link><Link href="/dashboard/attendance">Attendance</Link><Link href="/dashboard/tasks">Tasks</Link><Link href="/dashboard/leave">Leave</Link><Link href="/dashboard/announcements">Announcements</Link><Link href="/dashboard/profile">Profile</Link><Link href="/admin">Admin</Link></nav>; }
