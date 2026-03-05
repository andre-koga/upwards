"use client";

import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import { useState } from "react";
import { useAuthForm } from "@/lib/hooks/use-auth-form";
import { AuthCard } from "@/components/auth/auth-card";

export function ForgotPasswordForm(
  props: React.ComponentPropsWithoutRef<"div">,
) {
  const [email, setEmail] = useState("");
  const [success, setSuccess] = useState(false);
  const { error, isLoading, run } = useAuthForm();

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    await run(async () => {
      const supabase = createClient();
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/update-password`,
      });
      if (error) throw error;
      setSuccess(true);
    });
  };

  if (success) {
    return (
      <AuthCard
        title="Check Your Email"
        description="Password reset instructions sent"
        {...props}
      >
        <p className="text-sm text-muted-foreground">
          If you registered using your email and password, you will receive a
          password reset email.
        </p>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Reset Your Password"
      description="Type in your email and we'll send you a link to reset your password"
      {...props}
    >
      <form onSubmit={handleForgotPassword}>
        <div className="flex flex-col gap-6">
          <div className="grid gap-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="m@example.com"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? "Sending..." : "Send reset email"}
          </Button>
        </div>
        <div className="mt-4 text-center text-sm">
          Already have an account?{" "}
          <Link href="/auth/login" className="underline underline-offset-4">
            Login
          </Link>
        </div>
      </form>
    </AuthCard>
  );
}
