import { LoginForm } from "@/modules/auth/components/login-form";

export default async function LoginPage() {
  return (
    <main className="min-h-screen flex items-center justify-center p-4 overflow-hidden">
      <LoginForm />
    </main>
  );
}