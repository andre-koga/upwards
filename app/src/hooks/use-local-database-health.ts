import { useEffect, useState } from "react";
import {
  getLocalDatabaseHealth,
  subscribeLocalDatabaseHealth,
  type LocalDatabaseHealth,
} from "@/lib/db/health";

export function useLocalDatabaseHealth(): LocalDatabaseHealth {
  const [health, setHealth] = useState(getLocalDatabaseHealth);
  useEffect(() => subscribeLocalDatabaseHealth(setHealth), []);
  return health;
}
