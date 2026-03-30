import { useEffect, useState } from "react";
import { useAuth } from "@/lib/use-auth";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface AuthPopupProps {
  onClose?: () => void;
  onSignedIn?: () => void;
}

export function AuthPopup({ onClose, onSignedIn }: AuthPopupProps) {
  const { isAuthed, authLoading, authError, signIn, signUp } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    if (isAuthed) {
      /* eslint-disable-next-line react-hooks/set-state-in-effect -- syncing with auth state */
      setEmail("");
      setPassword("");
      onSignedIn?.();
    }
  }, [isAuthed, onSignedIn]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await signIn(email, password);
      setEmail("");
      setPassword("");
      onClose?.();
    } catch {
      // authError handled by useAuth
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await signUp(email, password);
      setEmail("");
      setPassword("");
    } catch {
      // authError handled by useAuth
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose?.()}>
      <DialogContent size="sm" className="w-72 p-4">
        <DialogHeader>
          <DialogTitle>Sign In to Sync</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSignIn} className="space-y-3">
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            required
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            required
          />
          {authError && (
            <p
              className={`text-xs ${authError.includes("Check your email") ? "text-green-500" : "text-red-500"}`}
            >
              {authError}
            </p>
          )}
          <div className="flex gap-2">
            <Button
              type="submit"
              variant="default"
              disabled={authLoading}
              className="flex-1 text-xs"
            >
              {authLoading ? "..." : "Sign In"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={handleSignUp}
              disabled={authLoading}
              className="flex-1 text-xs"
            >
              {authLoading ? "..." : "Sign Up"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
