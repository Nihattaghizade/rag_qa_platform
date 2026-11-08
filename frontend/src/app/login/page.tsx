"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck, Loader2 } from "lucide-react";
import { apiRequest, UserDTO } from "@/lib/api";
import { useAppStore } from "@/store/useAppStore";

interface AuthResponse {
  access_token: string;
  user: UserDTO;
}

export default function LoginPage() {
  const router = useRouter();
  const setAuth = useAppStore((s) => s.setAuth);

  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [unlockInputs, setUnlockInputs] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setEmail("");
    setPassword("");
    setFullName("");
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("mode") === "register") {
        setIsRegister(true);
      }
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const endpoint = isRegister ? "/auth/register" : "/auth/login";
      const body = isRegister
        ? { email: email.trim(), password, full_name: fullName.trim() }
        : { email: email.trim(), password };

      const res = await apiRequest<AuthResponse>(endpoint, {
        method: "POST",
        body: JSON.stringify(body),
      });

      setAuth(res.access_token, res.user);
      router.push("/files");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 shadow-xl">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center">
            <ShieldCheck className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">
              {isRegister ? "Create Tenant Workspace" : "Sign In to Workspace"}
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Multi-Tenant Document Intelligence Platform
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} autoComplete="off" className="space-y-4">
          <input
            type="text"
            name="prevent_autofill_username"
            autoComplete="username"
            className="hidden"
            tabIndex={-1}
            readOnly
          />
          <input
            type="password"
            name="prevent_autofill_password"
            autoComplete="new-password"
            className="hidden"
            tabIndex={-1}
            readOnly
          />

          {isRegister && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Full Name
              </label>
              <input
                type="text"
                name="rag_tenant_fullname_field"
                autoComplete="off"
                required
                readOnly={!unlockInputs}
                onFocus={() => setUnlockInputs(true)}
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                placeholder="Enter your full name"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Work Email
            </label>
            <input
              type="email"
              name="rag_tenant_email_field"
              autoComplete="off"
              required
              readOnly={!unlockInputs}
              onFocus={() => setUnlockInputs(true)}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
              placeholder="name@company.com"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Password
            </label>
            <input
              type="password"
              name="rag_tenant_password_field"
              autoComplete="new-password"
              required
              minLength={8}
              readOnly={!unlockInputs}
              onFocus={() => setUnlockInputs(true)}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
              placeholder="Minimum 8 characters"
            />
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-600 dark:text-red-300">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-sm font-semibold text-white flex items-center justify-center gap-2 shadow-md shadow-emerald-600/20 transition"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            <span>{isRegister ? "Create Tenant Account" : "Sign In"}</span>
          </button>
        </form>

        <div className="mt-6 text-center">
          <button
            type="button"
            onClick={() => {
              setIsRegister(!isRegister);
              setEmail("");
              setPassword("");
              setFullName("");
              setError(null);
            }}
            className="text-xs font-medium text-emerald-600 dark:text-emerald-400 hover:underline"
          >
            {isRegister
              ? "Already have an account? Sign in"
              : "Need a new tenant workspace? Register here"}
          </button>
        </div>
      </div>
    </div>
  );
}