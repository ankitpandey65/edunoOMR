import Link from "next/link";
import { LoginForm } from "./LoginForm";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4">
      <div className="card w-full max-w-md p-8">
        <div className="mb-8 text-center">
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-400/90">
            Eduno
          </div>
          <h1 className="mt-2 text-2xl font-semibold text-white">Olympiad Console</h1>
          <p className="mt-2 text-sm text-slate-400">Sign in with your school or admin account</p>
        </div>
        <LoginForm />
        <p className="mt-6 text-center text-xs text-slate-500">
          Demo: <span className="text-slate-400">admin@eduno.local</span> / admin123 ·{" "}
          <span className="text-slate-400">school@demo.local</span> / school123
        </p>
        <p className="mt-4 text-center text-xs">
          <Link href="/register" className="mr-3 text-indigo-400/90 hover:underline">
            Register with OTP
          </Link>
          <Link href="/" className="text-sky-400/90 hover:underline">
            Back
          </Link>
        </p>
      </div>
    </div>
  );
}
