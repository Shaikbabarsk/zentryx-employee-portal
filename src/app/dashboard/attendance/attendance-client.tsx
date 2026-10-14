"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  localDateString,
  formatDateTime,
  formatDate,
} from "@/lib/utils";

type AttendanceRow = {
  id: string;
  attendance_date: string;
  check_in: string | null;
  check_out: string | null;
};

export default function AttendancePage() {
  const [today, setToday] = useState<AttendanceRow | null>(null);
  const [history, setHistory] = useState<AttendanceRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  const load = useCallback(async () => {
    const supabase = createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      setToday(null);
      setHistory([]);
      throw new Error("Please sign in again.");
    }

    const todayDate = localDateString();

    const [
      { data: todayRecord, error: todayError },
      { data: historyRecords, error: historyError },
    ] = await Promise.all([
      supabase
        .from("attendance")
        .select("id, attendance_date, check_in, check_out")
        .eq("employee_id", user.id)
        .eq("attendance_date", todayDate)
        .maybeSingle(),

      supabase
        .from("attendance")
        .select("id, attendance_date, check_in, check_out")
        .eq("employee_id", user.id)
        .order("attendance_date", { ascending: false })
        .limit(30),
    ]);

    if (todayError || historyError) {
      throw new Error(
        todayError?.message ||
          historyError?.message ||
          "Could not load attendance."
      );
    }

    setToday(todayRecord);
    setHistory(historyRecords ?? []);
  }, []);

  useEffect(() => {
    let active = true;

    async function initialLoad() {
      try {
        await load();
      } catch (error) {
        if (active) {
          setErr(
            error instanceof Error
              ? error.message
              : "Could not load attendance."
          );
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void initialLoad();

    return () => {
      active = false;
    };
  }, [load]);

  async function punch(kind: "in" | "out") {
    if (busy) return;

    setBusy(true);
    setErr("");
    setMsg("");

    try {
      const supabase = createClient();

      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        throw new Error("Your session has expired. Please sign in again.");
      }

      const { error: actionError } = await supabase.rpc(
        "record_attendance",
        { p_action: kind }
      );

      if (actionError) {
        throw new Error(actionError.message);
      }

      setMsg(
        kind === "in"
          ? "Check-in recorded successfully."
          : "Check-out recorded successfully."
      );

      await load();
    } catch (error) {
      setErr(
        error instanceof Error
          ? error.message
          : "Could not record attendance."
      );
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-sm text-slate-500">
        Loading attendance...
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="text-lg font-bold">Today's attendance</h2>

        <p className="mt-1 text-sm text-slate-500">
          One attendance record per employee per day.
        </p>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl bg-slate-50 p-4">
            <p className="text-sm text-slate-500">Check-in</p>
            <p className="mt-1 font-semibold">
              {formatDateTime(today?.check_in)}
            </p>
          </div>

          <div className="rounded-xl bg-slate-50 p-4">
            <p className="text-sm text-slate-500">Check-out</p>
            <p className="mt-1 font-semibold">
              {formatDateTime(today?.check_out)}
            </p>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-3">
          <button
            type="button"
            disabled={busy || !!today?.check_in}
            onClick={() => void punch("in")}
            className="rounded-xl bg-blue-700 px-5 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? "Saving..." : "Check in"}
          </button>

          <button
            type="button"
            disabled={busy || !today?.check_in || !!today?.check_out}
            onClick={() => void punch("out")}
            className="rounded-xl border border-slate-300 px-5 py-3 font-semibold disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? "Saving..." : "Check out"}
          </button>
        </div>

        {msg && (
          <p
            role="status"
            className="mt-4 rounded-lg bg-green-50 p-3 text-sm text-green-800"
          >
            {msg}
          </p>
        )}

        {err && (
          <p
            role="alert"
            className="mt-4 break-words rounded-lg bg-red-50 p-3 text-sm text-red-700"
          >
            {err}
          </p>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="text-lg font-bold">Attendance history</h2>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-slate-500">
              <tr>
                <th className="py-3 pr-4">Date</th>
                <th className="py-3 pr-4">Check-in</th>
                <th className="py-3">Check-out</th>
              </tr>
            </thead>

            <tbody>
              {history.map((record) => (
                <tr
                  key={record.id}
                  className="border-t border-slate-100"
                >
                  <td className="py-3 pr-4">
                    {formatDate(record.attendance_date)}
                  </td>
                  <td className="py-3 pr-4">
                    {formatDateTime(record.check_in)}
                  </td>
                  <td className="py-3">
                    {formatDateTime(record.check_out)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {history.length === 0 && (
            <p className="py-5 text-sm text-slate-500">
              No attendance records yet.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}