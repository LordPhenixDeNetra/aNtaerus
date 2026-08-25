import { useCallback, useEffect, useRef } from "react";

import {
  approveCuratorPatch,
  createInitiative,
  getLastCuratorReport,
  getSchedulerStatus,
  listCollectors,
  listCuratorPatches,
  listInitiatives,
  patchInitiative,
  rejectCuratorPatch,
  runAllCollectors as runAllCollectorsFetch,
  runCollector as runCollectorFetch,
  runCurator as runCuratorFetch,
  runInitiative,
  startScheduler as startSchedulerFetch,
  stopScheduler as stopSchedulerFetch,
  type CollectorInfo,
  type CollectorRunResult,
  type CreateInitiativeRequest,
  type CuratorPatch,
  type CuratorReport,
  type Initiative,
  type PatchInitiativeRequest,
  type SchedulerStatus,
} from "@/lib/api";
import { useAppStore } from "@/store/useAppStore";

const POLLING_INTERVAL_MS = 10_000;

export type ProactiveActionLoading = string | null;

export function useProactive() {
  const collectors = useAppStore((state) => state.collectors);
  const collectorsLoading = useAppStore((state) => state.collectorsLoading);
  const collectorsLastError = useAppStore((state) => state.collectorsLastError);
  const initiatives = useAppStore((state) => state.initiatives);
  const initiativesTotal = useAppStore((state) => state.initiativesTotal);
  const initiativesLoading = useAppStore((state) => state.initiativesLoading);
  const initiativesLastError = useAppStore(
    (state) => state.initiativesLastError,
  );
  const globalAutonomyLevel = useAppStore(
    (state) => state.globalAutonomyLevel,
  );
  const lastCuratorReport = useAppStore((state) => state.lastCuratorReport);
  const curatorPatches = useAppStore((state) => state.curatorPatches);

  const setCollectors = useAppStore((state) => state.setCollectors);
  const setCollectorsLoading = useAppStore(
    (state) => state.setCollectorsLoading,
  );
  const setCollectorsError = useAppStore((state) => state.setCollectorsError);
  const setInitiatives = useAppStore((state) => state.setInitiatives);
  const setInitiativesLoading = useAppStore(
    (state) => state.setInitiativesLoading,
  );
  const setInitiativesError = useAppStore(
    (state) => state.setInitiativesError,
  );
  const addOrUpdateInitiative = useAppStore(
    (state) => state.addOrUpdateInitiative,
  );
  const mergeInitiativeUpdate = useAppStore(
    (state) => state.mergeInitiativeUpdate,
  );
  const setGlobalAutonomyLevel = useAppStore(
    (state) => state.setGlobalAutonomyLevel,
  );
  const setLastCuratorReport = useAppStore(
    (state) => state.setLastCuratorReport,
  );
  const setCuratorPatches = useAppStore((state) => state.setCuratorPatches);
  const addOrUpdateCuratorPatch = useAppStore(
    (state) => state.addOrUpdateCuratorPatch,
  );

  const loadingActionRef = useRef<ProactiveActionLoading>(null);

  const refreshCollectors = useCallback(async () => {
    setCollectorsLoading(true);
    setCollectorsError(null);
    try {
      const result = await listCollectors();
      setCollectors(result);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Erreur de chargement des collecteurs.";
      setCollectorsError(message);
    } finally {
      setCollectorsLoading(false);
    }
  }, [setCollectors, setCollectorsError, setCollectorsLoading]);

  const refreshInitiatives = useCallback(async () => {
    setInitiativesLoading(true);
    setInitiativesError(null);
    try {
      const resp = await listInitiatives();
      setInitiatives(resp.items, resp.total);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Erreur de chargement des initiatives.";
      setInitiativesError(message);
    } finally {
      setInitiativesLoading(false);
    }
  }, [setInitiatives, setInitiativesError, setInitiativesLoading]);

  const refreshCurator = useCallback(async () => {
    try {
      const report = await getLastCuratorReport();
      setLastCuratorReport(report);
      if (report) {
        const patches = await listCuratorPatches({ reportId: report.id });
        setCuratorPatches(patches.items);
      }
    } catch {
      // curator est optionnel, ignore silencieusement
    }
  }, [setCuratorPatches, setLastCuratorReport]);

  const refreshAll = useCallback(async () => {
    await Promise.all([
      refreshCollectors(),
      refreshInitiatives(),
      refreshCurator(),
    ]);
  }, [refreshCollectors, refreshCurator, refreshInitiatives]);

  useEffect(() => {
    refreshAll();
    const interval = setInterval(refreshAll, POLLING_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [refreshAll]);

  const runCollector = useCallback(
    async (name: string): Promise<CollectorRunResult | null> => {
      loadingActionRef.current = `run-collector-${name}`;
      try {
        const result = await runCollectorFetch(name);
        await refreshCollectors();
        return result;
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : `Impossible de lancer le collecteur ${name}.`;
        setCollectorsError(message);
        return null;
      } finally {
        loadingActionRef.current = null;
      }
    },
    [refreshCollectors, setCollectorsError],
  );

  const runAllCollectors = useCallback(async () => {
    loadingActionRef.current = "run-all-collectors";
    try {
      const result = await runAllCollectorsFetch();
      await refreshCollectors();
      return result;
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Impossible de lancer les collecteurs.";
      setCollectorsError(message);
      return null;
    } finally {
      loadingActionRef.current = null;
    }
  }, [refreshCollectors, setCollectorsError]);

  const create = useCallback(
    async (request: CreateInitiativeRequest): Promise<Initiative | null> => {
      loadingActionRef.current = "create-initiative";
      try {
        const created = await createInitiative({
          ...request,
          autonomyLevel:
            request.autonomyLevel !== undefined
              ? request.autonomyLevel
              : globalAutonomyLevel,
        });
        addOrUpdateInitiative(created);
        return created;
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Impossible de creer l'initiative.";
        setInitiativesError(message);
        return null;
      } finally {
        loadingActionRef.current = null;
      }
    },
    [addOrUpdateInitiative, globalAutonomyLevel, setInitiativesError],
  );

  const run = useCallback(
    async (initiative: Initiative) => {
      loadingActionRef.current = `run-initiative-${initiative.id}`;
      mergeInitiativeUpdate({
        initiativeId: initiative.id,
        status: "running",
        updatedAt: new Date().toISOString(),
      });
      try {
        const updated = await runInitiative(initiative.id);
        addOrUpdateInitiative(updated);
        return updated;
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Impossible de lancer l'initiative.";
        mergeInitiativeUpdate({
          initiativeId: initiative.id,
          status: initiative.status,
          error: message,
          updatedAt: new Date().toISOString(),
        });
        setInitiativesError(message);
        return null;
      } finally {
        loadingActionRef.current = null;
      }
    },
    [addOrUpdateInitiative, mergeInitiativeUpdate, setInitiativesError],
  );

  const patch = useCallback(
    async (
      initiative: Initiative,
      patchReq: PatchInitiativeRequest,
    ): Promise<Initiative | null> => {
      loadingActionRef.current = `patch-initiative-${initiative.id}`;
      try {
        const updated = await patchInitiative(initiative.id, patchReq);
        addOrUpdateInitiative(updated);
        return updated;
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Impossible de mettre a jour l'initiative.";
        setInitiativesError(message);
        return null;
      } finally {
        loadingActionRef.current = null;
      }
    },
    [addOrUpdateInitiative, setInitiativesError],
  );

  const runCurator = useCallback(async (): Promise<CuratorReport | null> => {
    loadingActionRef.current = "run-curator";
    try {
      const report = await runCuratorFetch();
      setLastCuratorReport(report);
      const patches = await listCuratorPatches({ reportId: report.id });
      setCuratorPatches(patches.items);
      return report;
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Impossible de lancer le curator.";
      setInitiativesError(message);
      return null;
    } finally {
      loadingActionRef.current = null;
    }
  }, [setCuratorPatches, setInitiativesError, setLastCuratorReport]);

  const approvePatch = useCallback(
    async (patchId: string): Promise<CuratorPatch | null> => {
      loadingActionRef.current = `approve-patch-${patchId}`;
      try {
        const updated = await approveCuratorPatch(patchId);
        addOrUpdateCuratorPatch(updated);
        return updated;
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Impossible d'approuver le patch.";
        setInitiativesError(message);
        return null;
      } finally {
        loadingActionRef.current = null;
      }
    },
    [addOrUpdateCuratorPatch, setInitiativesError],
  );

  const rejectPatch = useCallback(
    async (patchId: string): Promise<CuratorPatch | null> => {
      loadingActionRef.current = `reject-patch-${patchId}`;
      try {
        const updated = await rejectCuratorPatch(patchId);
        addOrUpdateCuratorPatch(updated);
        return updated;
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Impossible de rejeter le patch.";
        setInitiativesError(message);
        return null;
      } finally {
        loadingActionRef.current = null;
      }
    },
    [addOrUpdateCuratorPatch, setInitiativesError],
  );

  const getScheduler = useCallback(async (): Promise<SchedulerStatus | null> => {
    try {
      return await getSchedulerStatus();
    } catch {
      return null;
    }
  }, []);

  const startScheduler = useCallback(async (): Promise<SchedulerStatus | null> => {
    loadingActionRef.current = "start-scheduler";
    try {
      return await startSchedulerFetch();
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Impossible de demarrer le scheduler.";
      setInitiativesError(message);
      return null;
    } finally {
      loadingActionRef.current = null;
    }
  }, [setInitiativesError]);

  const stopScheduler = useCallback(async (): Promise<SchedulerStatus | null> => {
    loadingActionRef.current = "stop-scheduler";
    try {
      return await stopSchedulerFetch();
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Impossible d'arreter le scheduler.";
      setInitiativesError(message);
      return null;
    } finally {
      loadingActionRef.current = null;
    }
  }, [setInitiativesError]);

  return {
    collectors,
    collectorsLoading,
    collectorsLastError,
    initiatives,
    initiativesTotal,
    initiativesLoading,
    initiativesLastError,
    globalAutonomyLevel,
    lastCuratorReport,
    curatorPatches,
    actionLoading: loadingActionRef.current,
    refreshCollectors,
    refreshInitiatives,
    refreshCurator,
    refreshAll,
    runCollector,
    runAllCollectors,
    create,
    run,
    patch,
    setGlobalAutonomyLevel,
    mergeInitiativeUpdate,
    runCurator,
    approvePatch,
    rejectPatch,
    getScheduler,
    startScheduler,
    stopScheduler,
  };
}

export type UseProactiveReturn = ReturnType<typeof useProactive>;

declare const _proactiveNeverUsed:
  | CollectorInfo
  | CollectorRunResult
  | SchedulerStatus
  | undefined;
