"use client";

import { useEffect, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";
import { Camera, UserRound, Upload } from "lucide-react";

export default function ProfilePage() {
  const [id, setId] = useState("");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [department, setDepartment] = useState("General");
  const [jobTitle, setJobTitle] = useState("Employee");
  const [role, setRole] = useState("employee");

  const [photoUrl, setPhotoUrl] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadProfile() {
      const supabase = createClient();
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError) throw authError;
      if (!user || !active) return;

      setId(user.id);
      setEmail(user.email ?? "");

      const { data, error: profileError } = await supabase
        .from("profiles")
        .select("full_name,department,job_title,role")
        .eq("id", user.id)
        .maybeSingle();

      if (profileError) throw profileError;
      if (!active) return;

      if (data) {
        setName(data.full_name ?? "");
        setDepartment(data.department ?? "General");
        setJobTitle(data.job_title ?? "Employee");
        setRole(data.role ?? "employee");
      } else {
        setName(user.user_metadata?.full_name ?? "");
      }

      const path = user.user_metadata?.avatar_path;

      if (typeof path === "string" && path) {
        const { data: signedImage, error: imageError } =
          await supabase.storage
            .from("employee-photos")
            .createSignedUrl(path, 3600);

        if (!active) return;

        if (!imageError && signedImage?.signedUrl) {
          setPhotoUrl(signedImage.signedUrl);
          setPreviewUrl(signedImage.signedUrl);
        }
      }
    }

    loadProfile().catch((e) => {
      if (active) {
        setError(
          e instanceof Error ? e.message : "Could not load profile."
        );
      }
    });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!previewUrl.startsWith("blob:")) return;

    return () => URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  function choosePhoto(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";

    if (!file) return;

    setMessage("");
    setError("");

    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];

    if (!allowedTypes.includes(file.type)) {
      setError("Please select a JPG, PNG, or WebP image.");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError("Your photo must be 5 MB or smaller.");
      return;
    }

    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  }

  async function uploadPhoto() {
    if (!id || !selectedFile) return;

    setPhotoBusy(true);
    setError("");
    setMessage("");

    try {
      const supabase = createClient();
      const path = `${id}/avatar`;

      const { error: uploadError } = await supabase.storage
        .from("employee-photos")
        .upload(path, selectedFile, {
          upsert: true,
          contentType: selectedFile.type,
          cacheControl: "3600",
        });

      if (uploadError) throw uploadError;

      const { error: metadataError } = await supabase.auth.updateUser({
        data: { avatar_path: path },
      });

      if (metadataError) {
        throw new Error(
          `Photo uploaded, but the profile could not be updated: ${metadataError.message}`
        );
      }

      const { data: signedImage, error: signedUrlError } =
        await supabase.storage
          .from("employee-photos")
          .createSignedUrl(path, 3600);

      if (signedUrlError) throw signedUrlError;

      setPhotoUrl(signedImage.signedUrl);
      setPreviewUrl(signedImage.signedUrl);
      setSelectedFile(null);
      setMessage("Profile photo updated successfully.");
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Could not upload your photo."
      );
    } finally {
      setPhotoBusy(false);
    }
  }

  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!id) {
      setError("Your account is still loading. Please try again.");
      return;
    }

    setBusy(true);
    setError("");
    setMessage("");

    try {
      const { error: updateError } = await createClient()
        .from("profiles")
        .update({
          full_name: name.trim(),
          department: department.trim(),
          job_title: jobTitle.trim(),
        })
        .eq("id", id);

      if (updateError) throw updateError;

      setMessage("Profile details updated.");
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Could not update profile."
      );
    } finally {
      setBusy(false);
    }
  }

  const initials =
    name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "E";

  return (
    <section className="max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-center gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900">My profile</h2>
          <p className="mt-1 text-sm text-slate-500">
            Manage your employee details and profile picture.
          </p>
        </div>
      </div>

      <div className="my-7 flex flex-col items-center gap-4 rounded-2xl bg-slate-50 p-6 sm:flex-row">
        <div className="rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 p-[3px]">
          <div className="grid h-28 w-28 place-items-center overflow-hidden rounded-full bg-blue-100 text-2xl font-bold text-blue-700">
            {previewUrl || photoUrl ? (
              <img
                src={previewUrl || photoUrl}
                alt="Your profile"
                className="h-full w-full object-cover"
              />
            ) : (
              <span>{initials || <UserRound size={36} />}</span>
            )}
          </div>
        </div>

        <div className="flex-1 text-center sm:text-left">
          <h3 className="font-semibold text-slate-900">
            {name || "Your name"}
          </h3>
          <p className="mt-1 text-sm text-slate-500">
            {photoUrl ? "Your profile picture" : "No profile picture uploaded yet"}
          </p>

          <div className="mt-4 flex flex-wrap justify-center gap-2 sm:justify-start">
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-100">
              <Camera size={16} />
              {previewUrl || photoUrl ? "Choose another photo" : "Choose photo"}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={choosePhoto}
                className="hidden"
              />
            </label>

            {selectedFile && (
              <button
                type="button"
                onClick={uploadPhoto}
                disabled={photoBusy}
                className="inline-flex items-center gap-2 rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-60"
              >
                <Upload size={16} />
                {photoBusy ? "Uploading..." : "Save photo"}
              </button>
            )}
          </div>

          <p className="mt-3 text-xs text-slate-500">
            JPG, PNG, or WebP · Maximum 5 MB
          </p>
        </div>
      </div>

      <form onSubmit={save} className="space-y-4">
        <label className="block text-sm font-medium text-slate-700">
          Full name
          <input
            required
            maxLength={100}
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-2 w-full rounded-xl border border-slate-200 p-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          />
        </label>

        <label className="block text-sm font-medium text-slate-700">
          Email address
          <input
            disabled
            value={email}
            className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-slate-500"
          />
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-medium text-slate-700">
            Department
            <input
              maxLength={100}
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              className="mt-2 w-full rounded-xl border border-slate-200 p-3 outline-none focus:border-blue-500"
            />
          </label>

          <label className="block text-sm font-medium text-slate-700">
            Job title
            <input
              maxLength={100}
              value={jobTitle}
              onChange={(e) => setJobTitle(e.target.value)}
              className="mt-2 w-full rounded-xl border border-slate-200 p-3 outline-none focus:border-blue-500"
            />
          </label>
        </div>

        <p className="text-sm text-slate-500">
          Account role:{" "}
          <span className="font-semibold capitalize">{role}</span>{" "}
          (managed by an administrator)
        </p>

        <button
          disabled={busy}
          className="rounded-xl bg-blue-700 px-5 py-3 font-semibold text-white hover:bg-blue-800 disabled:opacity-60"
        >
          {busy ? "Saving..." : "Save profile details"}
        </button>
      </form>

      {message && (
        <p className="mt-4 rounded-lg bg-green-50 p-3 text-sm text-green-800">
          {message}
        </p>
      )}

      {error && (
        <p className="mt-4 break-words rounded-lg bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      )}
    </section>
  );
}