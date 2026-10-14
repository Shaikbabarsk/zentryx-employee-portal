
"use client";

import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import {
  AlertCircle,
  Bell,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Clock,
  Megaphone,
  Users,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { formatDate, formatDateTime } from "@/lib/utils";

type Employee = {
  id: string;
  full_name: string;
  email: string;
  role: string;
  department: string | null;
  job_title: string | null;
};

type Leave = {
  id: string;
  employee_id: string;
  leave_type: string;
  start_date: string;
  end_date: string;
  reason: string;
  status: string;
  admin_comment: string | null;
};

type Task = {
  id: string;
  title: string;
  assigned_to: string;
  status: string;
  priority: string;
  due_date: string | null;
};

type Announcement = {
  id: string;
  title: string;
  content: string;
  category: string;
  created_at: string;
};

type Submission = {
  id: string;
  task_id: string;
  employee_id: string;
  progress_note: string;
  deliverable_url: string | null;
  status: string;
  admin_feedback: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
};

const inputClass =
  "mt-1 w-full rounded-xl border border-slate-200 bg-white p-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100";

const cardClass =
  "rounded-2xl border border-slate-200 bg-white p-5 sm:p-6";

function isOverdue(task: Task) {
  return (
    task.status !== "completed" &&
    task.due_date !== null &&
    task.due_date < new Date().toLocaleDateString("en-CA")
  );
}

function StatCard({
  label,
  value,
  detail,
  icon: Icon,
}: {
  label: string;
  value: number;
  detail: string;
  icon: typeof Users;
}) {
  return (
    <article className={cardClass}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-slate-500">{label}</p>
          <p className="mt-2 text-3xl font-bold text-slate-950">
            {value}
          </p>
          <p className="mt-1 text-xs text-slate-500">{detail}</p>
        </div>
        <span className="rounded-xl bg-blue-50 p-3 text-blue-700">
          <Icon size={22} />
        </span>
      </div>
    </article>
  );
}

export default function AdminPage() {
  const [allowed, setAllowed] = useState(false);
  const [ready, setReady] = useState(false);

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [leaves, setLeaves] = useState<Leave[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [news, setNews] = useState<Announcement[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [category, setCategory] = useState("general");

  const [taskTitle, setTaskTitle] = useState("");
  const [taskDescription, setTaskDescription] = useState("");
  const [assignee, setAssignee] = useState("");
  const [priority, setPriority] = useState("medium");
  const [due, setDue] = useState("");

  const [feedback, setFeedback] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const supabase = createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError) throw authError;

    if (!user) {
      setAllowed(false);
      setReady(true);
      return;
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) throw profileError;

    if (profile?.role !== "admin") {
      setAllowed(false);
      setReady(true);
      return;
    }

    setAllowed(true);

    const [employeeResult, leaveResult, taskResult, newsResult, submissionResult] =
      await Promise.all([
        supabase
          .from("profiles")
          .select("id,full_name,email,role,department,job_title")
          .order("full_name"),

        supabase
          .from("leave_requests")
          .select(
            "id,employee_id,leave_type,start_date,end_date,reason,status,admin_comment"
          )
          .order("created_at", { ascending: false }),

        supabase
          .from("tasks")
          .select("id,title,assigned_to,status,priority,due_date")
          .order("created_at", { ascending: false }),

        supabase
          .from("announcements")
          .select("id,title,content,category,created_at")
          .order("created_at", { ascending: false }),

        supabase
          .from("work_submissions")
          .select(
            "id,task_id,employee_id,progress_note,deliverable_url,status,admin_feedback,reviewed_by,reviewed_at,created_at"
          )
          .order("created_at", { ascending: false }),
      ]);

    const issue =
      employeeResult.error ||
      leaveResult.error ||
      taskResult.error ||
      newsResult.error ||
      submissionResult.error;

    if (issue) throw issue;

    setEmployees(employeeResult.data ?? []);
    setLeaves(leaveResult.data ?? []);
    setTasks(taskResult.data ?? []);
    setNews(newsResult.data ?? []);
    setSubmissions(submissionResult.data ?? []);

    setAssignee((old) => {
      if (old && employeeResult.data?.some((employee) => employee.id === old)) {
        return old;
      }
      return employeeResult.data?.find((employee) => employee.role !== "admin")?.id
        ?? employeeResult.data?.[0]?.id
        ?? "";
    });

    setReady(true);
  }, []);

  useEffect(() => {
    load().catch((e: unknown) => {
      setError(e instanceof Error ? e.message : "Could not load admin console.");
      setReady(true);
    });
  }, [load]);

  async function reviewLeave(
    id: string,
    status: "approved" | "rejected"
  ) {
    setBusy(true);
    setError("");
    setMessage("");

    try {
      const { error: updateError } = await createClient()
        .from("leave_requests")
        .update({
          status,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", id);

      if (updateError) throw updateError;

      setMessage(`Leave request ${status}.`);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not review leave request.");
    } finally {
      setBusy(false);
    }
  }

  async function publishAnnouncement(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");

    try {
      const supabase = createClient();
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError) throw authError;
      if (!user) throw new Error("Please sign in again.");

      const { error: insertError } = await supabase
        .from("announcements")
        .insert({
          title: title.trim(),
          content: content.trim(),
          category,
          created_by: user.id,
        });

      if (insertError) throw insertError;

      setTitle("");
      setContent("");
      setCategory("general");
      setMessage(
        "Announcement published. Employee notifications are created automatically."
      );

      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not publish announcement.");
    } finally {
      setBusy(false);
    }
  }

  async function assignTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");

    try {
      if (!assignee) throw new Error("Choose an employee first.");

      const supabase = createClient();
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError) throw authError;
      if (!user) throw new Error("Please sign in again.");

      const { error: insertError } = await supabase.from("tasks").insert({
        title: taskTitle.trim(),
        description: taskDescription.trim(),
        assigned_to: assignee,
        priority,
        due_date: due || null,
        created_by: user.id,
      });

      if (insertError) throw insertError;

      setTaskTitle("");
      setTaskDescription("");
      setDue("");
      setMessage(
        "Task assigned. An employee notification should be created automatically."
      );

      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not assign task.");
    } finally {
      setBusy(false);
    }
  }

  async function reviewSubmission(
    submission: Submission,
    status: "in_review" | "changes_requested" | "approved"
  ) {
    setBusy(true);
    setError("");
    setMessage("");

    try {
      const supabase = createClient();
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError) throw authError;
      if (!user) throw new Error("Please sign in again.");

      const { error: updateError } = await supabase
        .from("work_submissions")
        .update({
          status,
          admin_feedback: feedback[submission.id]?.trim() || null,
          reviewed_by: user.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", submission.id);

      if (updateError) throw updateError;

      setMessage(`Submission marked as ${status.replaceAll("_", " ")}.`);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not review submission.");
    } finally {
      setBusy(false);
    }
  }

  if (!ready) {
    return <p className="text-slate-500">Loading admin console...</p>;
  }

  if (!allowed) {
    return (
      <section className="rounded-2xl border border-amber-200 bg-amber-50 p-6">
        <h2 className="text-lg font-bold text-amber-900">
          Administrator access required
        </h2>
        <p className="mt-2 text-sm text-amber-800">
          Sign in with your administrator account to use this page.
        </p>
      </section>
    );
  }

  const pendingTasks = tasks.filter(
    (task) => task.status.toLowerCase() !== "completed"
  );

  const overdueTasks = tasks.filter(isOverdue);

  const pendingLeaves = leaves.filter(
    (leave) => leave.status.toLowerCase() === "pending"
  );

  const awaitingReview = submissions.filter((submission) =>
    ["submitted", "in_review"].includes(submission.status)
  );

  function employeeName(id: string) {
    return employees.find((employee) => employee.id === id)?.full_name
      ?? "Employee";
  }

  function taskTitleFor(id: string) {
    return tasks.find((task) => task.id === id)?.title ?? "Task";
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="flex gap-2 rounded-xl bg-red-50 p-3 text-sm text-red-700">
          <AlertCircle className="shrink-0" size={18} />
          <span>{error}</span>
        </div>
      )}

      {message && (
        <p className="rounded-xl bg-green-50 p-3 text-sm text-green-800">
          {message}
        </p>
      )}

      <section>
        <div className="mb-4">
          <p className="text-sm text-blue-700">Zentryx Logic</p>
          <h2 className="mt-1 text-2xl font-bold text-slate-950">
            Founder dashboard
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Your team's current workload and items requiring attention.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Employees"
            value={employees.filter((employee) => employee.role !== "admin").length}
            detail="Non-admin team members"
            icon={Users}
          />
          <StatCard
            label="Open tasks"
            value={pendingTasks.length}
            detail="Tasks not marked completed"
            icon={ClipboardList}
          />
          <StatCard
            label="Overdue tasks"
            value={overdueTasks.length}
            detail="Past due and not completed"
            icon={Clock}
          />
          <StatCard
            label="Awaiting review"
            value={awaitingReview.length}
            detail="Employee work submissions"
            icon={CheckCircle2}
          />
        </div>
      </section>

      <section className={cardClass}>
        <div className="flex items-center gap-2">
          <Users className="text-blue-700" size={21} />
          <h2 className="text-lg font-bold">Employees ({employees.length})</h2>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-slate-500">
              <tr>
                <th className="py-2 pr-4">Name</th>
                <th className="py-2 pr-4">Email</th>
                <th className="py-2 pr-4">Department</th>
                <th className="py-2">Role</th>
              </tr>
            </thead>
            <tbody>
              {employees.map((employee) => (
                <tr key={employee.id} className="border-t border-slate-100">
                  <td className="py-3 pr-4 font-medium">
                    {employee.full_name}
                  </td>
                  <td className="py-3 pr-4">{employee.email}</td>
                  <td className="py-3 pr-4">{employee.department ?? "—"}</td>
                  <td className="py-3 capitalize">{employee.role}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className={cardClass}>
        <div className="flex items-center gap-2">
          <CalendarDays className="text-blue-700" size={21} />
          <h2 className="text-lg font-bold">
            Leave approvals ({pendingLeaves.length} pending)
          </h2>
        </div>

        <div className="mt-4 space-y-3">
          {leaves.map((leave) => (
            <article key={leave.id} className="rounded-xl border border-slate-200 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">
                    {employeeName(leave.employee_id)} ·{" "}
                    <span className="capitalize">{leave.leave_type}</span>
                  </p>
                  <p className="mt-1 text-sm text-slate-600">
                    {formatDate(leave.start_date)} – {formatDate(leave.end_date)}
                  </p>
                  <p className="mt-1 text-sm text-slate-600">{leave.reason}</p>
                  <p className="mt-2 text-xs capitalize text-slate-500">
                    Status: {leave.status}
                  </p>
                </div>

                {leave.status === "pending" && (
                  <div className="flex gap-2">
                    <button
                      disabled={busy}
                      onClick={() => reviewLeave(leave.id, "approved")}
                      className="rounded-lg bg-green-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
                    >
                      Approve
                    </button>
                    <button
                      disabled={busy}
                      onClick={() => reviewLeave(leave.id, "rejected")}
                      className="rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
                    >
                      Reject
                    </button>
                  </div>
                )}
              </div>
            </article>
          ))}

          {leaves.length === 0 && (
            <p className="text-sm text-slate-500">No leave requests yet.</p>
          )}
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <form onSubmit={assignTask} className={cardClass}>
          <div className="flex items-center gap-2">
            <ClipboardList className="text-blue-700" size={21} />
            <h2 className="text-lg font-bold">Assign a task</h2>
          </div>

          <div className="mt-4 space-y-3">
            <label className="block text-sm font-medium">
              Employee
              <select
                required
                value={assignee}
                onChange={(event) => setAssignee(event.target.value)}
                className={inputClass}
              >
                <option value="">Choose an employee</option>
                {employees
                  .filter((employee) => employee.role !== "admin")
                  .map((employee) => (
                    <option key={employee.id} value={employee.id}>
                      {employee.full_name} ({employee.email})
                    </option>
                  ))}
              </select>
            </label>

            <label className="block text-sm font-medium">
              Task title
              <input
                required
                maxLength={150}
                value={taskTitle}
                onChange={(event) => setTaskTitle(event.target.value)}
                className={inputClass}
              />
            </label>

            <label className="block text-sm font-medium">
              Description
              <textarea
                rows={3}
                value={taskDescription}
                onChange={(event) => setTaskDescription(event.target.value)}
                className={inputClass}
              />
            </label>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-sm font-medium">
                Priority
                <select
                  value={priority}
                  onChange={(event) => setPriority(event.target.value)}
                  className={inputClass}
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </label>

              <label className="block text-sm font-medium">
                Due date
                <input
                  type="date"
                  min={new Date().toLocaleDateString("en-CA")}
                  value={due}
                  onChange={(event) => setDue(event.target.value)}
                  className={inputClass}
                />
              </label>
            </div>

            <button
              disabled={busy || employees.filter((employee) => employee.role !== "admin").length === 0}
              className="rounded-xl bg-blue-700 px-4 py-3 font-semibold text-white disabled:opacity-50"
            >
              Assign task
            </button>
          </div>
        </form>

        <form onSubmit={publishAnnouncement} className={cardClass}>
          <div className="flex items-center gap-2">
            <Megaphone className="text-blue-700" size={21} />
            <h2 className="text-lg font-bold">Publish announcement</h2>
          </div>

          <div className="mt-4 space-y-3">
            <label className="block text-sm font-medium">
              Category
              <select
                value={category}
                onChange={(event) => setCategory(event.target.value)}
                className={inputClass}
              >
                <option value="general">General</option>
                <option value="important">Important</option>
                <option value="hr">HR & policies</option>
                <option value="holiday">Holiday</option>
                <option value="event">Company event</option>
                <option value="it">IT & systems</option>
              </select>
            </label>

            <label className="block text-sm font-medium">
              Title
              <input
                required
                maxLength={150}
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                className={inputClass}
              />
            </label>

            <label className="block text-sm font-medium">
              Message
              <textarea
                required
                rows={5}
                value={content}
                onChange={(event) => setContent(event.target.value)}
                className={inputClass}
              />
            </label>

            <button
              disabled={busy}
              className="rounded-xl bg-blue-700 px-4 py-3 font-semibold text-white disabled:opacity-50"
            >
              Publish announcement
            </button>
          </div>
        </form>
      </section>

      <section className={cardClass}>
        <div className="flex items-center gap-2">
          <CheckCircle2 className="text-blue-700" size={21} />
          <h2 className="text-lg font-bold">
            Employee work submissions ({submissions.length})
          </h2>
        </div>

        <p className="mt-1 text-sm text-slate-500">
          Review progress notes and deliverables submitted for assigned tasks.
        </p>

        <div className="mt-4 space-y-4">
          {submissions.map((submission) => (
            <article
              key={submission.id}
              className="rounded-xl border border-slate-200 p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h3 className="font-semibold">
                    {taskTitleFor(submission.task_id)}
                  </h3>
                  <p className="mt-1 text-sm text-slate-600">
                    Submitted by {employeeName(submission.employee_id)}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {formatDateTime(submission.created_at)}
                  </p>
                </div>

                <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold capitalize text-blue-800">
                  {submission.status.replaceAll("_", " ")}
                </span>
              </div>

              <div className="mt-3 whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-sm text-slate-700">
                {submission.progress_note}
              </div>

              {submission.deliverable_url && (
                <p className="mt-3 break-all text-sm">
                  <a
                    href={submission.deliverable_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-blue-700 underline"
                  >
                    Open deliverable
                  </a>
                </p>
              )}

              {submission.admin_feedback && (
                <p className="mt-3 text-sm text-slate-600">
                  Previous feedback: {submission.admin_feedback}
                </p>
              )}

              <label className="mt-4 block text-sm font-medium">
                Feedback for employee
                <textarea
                  rows={2}
                  value={feedback[submission.id] ?? submission.admin_feedback ?? ""}
                  onChange={(event) =>
                    setFeedback((old) => ({
                      ...old,
                      [submission.id]: event.target.value,
                    }))
                  }
                  placeholder="Provide feedback or explain requested changes..."
                  className={inputClass}
                />
              </label>

              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  disabled={busy}
                  onClick={() => reviewSubmission(submission, "in_review")}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold disabled:opacity-50"
                >
                  In review
                </button>
                <button
                  disabled={busy}
                  onClick={() => reviewSubmission(submission, "changes_requested")}
                  className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900 disabled:opacity-50"
                >
                  Request changes
                </button>
                <button
                  disabled={busy}
                  onClick={() => reviewSubmission(submission, "approved")}
                  className="rounded-lg bg-green-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
                >
                  Approve work
                </button>
              </div>
            </article>
          ))}

          {submissions.length === 0 && (
            <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">
              No work submissions yet. They will appear here when employees
              submit their progress.
            </p>
          )}
        </div>
      </section>

      <section className={cardClass}>
        <div className="flex items-center gap-2">
          <ClipboardList className="text-blue-700" size={21} />
          <h2 className="text-lg font-bold">
            Task management ({tasks.length})
          </h2>
        </div>

        <div className="mt-4 space-y-3">
          {tasks.map((task) => (
            <article
              key={task.id}
              className="rounded-xl border border-slate-200 p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="font-semibold">{task.title}</h3>
                  <p className="mt-1 text-sm text-slate-500">
                    Assigned to {employeeName(task.assigned_to)}
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    {task.due_date
                      ? `Due ${formatDate(task.due_date)}`
                      : "No due date"}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2 text-xs font-semibold">
                  <span className="rounded-full bg-slate-100 px-3 py-1 capitalize">
                    {task.status.replaceAll("_", " ")}
                  </span>
                  <span className="rounded-full bg-blue-50 px-3 py-1 capitalize text-blue-800">
                    {task.priority} priority
                  </span>
                  {isOverdue(task) && (
                    <span className="rounded-full bg-red-50 px-3 py-1 text-red-700">
                      Overdue
                    </span>
                  )}
                </div>
              </div>
            </article>
          ))}

          {tasks.length === 0 && (
            <p className="text-sm text-slate-500">No tasks assigned yet.</p>
          )}
        </div>
      </section>

      <section className={cardClass}>
        <div className="flex items-center gap-2">
          <Bell className="text-blue-700" size={21} />
          <h2 className="text-lg font-bold">
            Recent announcements ({news.length})
          </h2>
        </div>

        <div className="mt-4 space-y-3">
          {news.map((announcement) => (
            <article
              key={announcement.id}
              className="rounded-xl border border-slate-200 p-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-semibold">{announcement.title}</h3>
                <span className="rounded-full bg-blue-50 px-3 py-1 text-xs capitalize text-blue-800">
                  {announcement.category}
                </span>
              </div>
              <p className="mt-2 whitespace-pre-wrap text-sm text-slate-600">
                {announcement.content}
              </p>
              <p className="mt-2 text-xs text-slate-400">
                {formatDateTime(announcement.created_at)}
              </p>
            </article>
          ))}

          {news.length === 0 && (
            <p className="text-sm text-slate-500">No announcements published yet.</p>
          )}
        </div>
      </section>

      <p className="text-xs text-slate-400">
        Data is loaded from Supabase. Overdue tasks are calculated from their
        due dates and current status.
      </p>
    </div>
  );
}
