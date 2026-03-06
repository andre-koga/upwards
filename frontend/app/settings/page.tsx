import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LogOut, Sun, User, Archive } from "lucide-react";
import { ThemeSwitcher } from "@/components/layout/theme-switcher";
import { Button } from "@/components/ui/button";
import Link from "next/link";

async function SettingsContent() {
  const supabase = await createClient();

  const { data, error } = await supabase.auth.getClaims();
  const uid = data?.claims?.sub;

  if (error || !uid) {
    redirect("/auth/login");
  }

  const email = data.claims?.email as string;

  // Ensure user record exists
  const { data: existingUser, error: userError } = await supabase
    .from("users")
    .select("id")
    .eq("id", uid)
    .maybeSingle();

  if (!existingUser && !userError) {
    await supabase.from("users").insert({ id: uid, email: email });
  }

  return (
    <div className="space-y-4 p-4">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground">
          Manage your account and preferences
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <User className="h-4 w-4" />
            Account
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div>
            <p className="text-sm text-muted-foreground">Email</p>
            <p className="font-medium">{email}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Sun className="h-4 w-4" />
            Appearance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <span className="text-sm">Theme</span>
            <ThemeSwitcher />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Archive className="h-4 w-4" />
            Archive
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            View and manage your archived activity groups and activities.
          </p>
          <Link href="/settings/archived">
            <Button
              variant="outline"
              className="w-full flex items-center gap-2"
            >
              <Archive className="h-4 w-4" />
              View Archived Items
            </Button>
          </Link>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <form action="/auth/sign-out" method="post">
            <Button
              type="submit"
              variant="destructive"
              className="w-full flex items-center gap-2"
            >
              <LogOut className="h-4 w-4" />
              Sign Out
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="text-center text-xs text-muted-foreground pt-4">
        <p>Upwards v1.0.0</p>
        <p className="mt-1">Built with Next.js & Supabase</p>
      </div>
    </div>
  );
}

export default async function SettingsPage() {
  return (
    <main className="flex-1">
      <Suspense
        fallback={
          <div className="flex items-center justify-center py-12">
            <p className="text-muted-foreground">Loading settings...</p>
          </div>
        }
      >
        <SettingsContent />
      </Suspense>
    </main>
  );
}
