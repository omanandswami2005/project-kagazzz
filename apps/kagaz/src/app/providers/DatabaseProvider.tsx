/**
 * Database provider (P0-10): opens the encrypted database, wires the
 * diagnostic log sink (14-observability §5), and runs the launch-time
 * temp wipe ([SEC] 10-security §3.3) — the app's bootstrap sequence.
 */
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import type { DbConnection } from '@/infrastructure/database/connection';
import { openDatabase } from '@/infrastructure/database/database.service';
import { createFileStorage, cleanupTempFiles } from '@/infrastructure/filesystem';
import { DiagnosticSink, log, setDiagnosticSink } from '@/core/logging';

const logger = log('database');

/** Bootstrap status exposed to the shell. */
export type DatabaseStatus = 'opening' | 'ready' | 'error';

/** What DatabaseContext exposes. */
export interface DatabaseContextValue {
  status: DatabaseStatus;
  db: DbConnection | null;
}

const DatabaseContext = createContext<DatabaseContextValue | null>(null);

/** Boot dependencies — injectable for tests. */
export interface DatabaseProviderProps {
  children: ReactNode;
  open?: typeof openDatabase;
}

/** Opens the DB once and provides it app-wide. */
export function DatabaseProvider({
  children,
  open = openDatabase,
}: DatabaseProviderProps): ReactNode {
  const [value, setValue] = useState<DatabaseContextValue>({
    status: 'opening',
    db: null,
  });

  useEffect(() => {
    let cancelled = false;
    void (async (): Promise<void> => {
      try {
        const db = await open(undefined, (migration) => {
          logger.info({
            event: 'db.migration.applied',
            version: migration.version,
            name: migration.name,
          });
        });

        // Diagnostic stream goes live as soon as the encrypted DB exists.
        const sink = new DiagnosticSink(db);
        await sink.pruneOnLaunch();
        setDiagnosticSink(sink);

        // [SEC] §3.3: temp/ must not survive across sessions.
        await cleanupTempFiles(createFileStorage());

        if (!cancelled) {
          setValue({ status: 'ready', db });
        }
        logger.info({ event: 'db.open.success' });
      } catch (error) {
        logger.fatal({
          event: 'db.open.failed',
          err: { message: String(error) },
        });
        if (!cancelled) {
          setValue({ status: 'error', db: null });
        }
      }
    })();
    return (): void => {
      cancelled = true;
    };
  }, [open]);

  return (
    <DatabaseContext.Provider value={value}>
      {children}
    </DatabaseContext.Provider>
  );
}

/** Access the database bootstrap state; throws outside the provider. */
export function useDatabase(): DatabaseContextValue {
  const ctx = useContext(DatabaseContext);
  if (!ctx) {
    throw new Error('useDatabase must be used inside <DatabaseProvider>');
  }
  return ctx;
}
