"use client";

import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAuthForm } from "@/lib/hooks/use-auth-form";
import { AuthCard } from "@/components/auth/auth-card";

export function UpdatePasswordForm(
  props: React.ComponentPropsWithoutRef<"div">,
) {
  const [password, setPassword] = useState("");
  const { error, isLoading, run } = useAuthForm();
  const router = useRouter();

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    await run(async () => {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      router.push("/");
    });
  };

  return (
    <AuthCard
      title="Reset Your Password"
      description="Please enter your new password below."
      {...props}
    >
      <form onSubmit={handleUpdatePassword}>
        <div className="flex flex-col gap-6">
          <div className="grid gap-2">
            <Label htmlFor="password">New password</Label>
            <Input
              id="password"
              type="password"
              placeholder="New password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? "Saving..." : "Save new password"}
          </Button>
        </div>
      </form>
    </AuthCard>
  );
}
