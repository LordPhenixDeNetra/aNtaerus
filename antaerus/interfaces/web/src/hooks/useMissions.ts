import { useCallback, useEffect, useRef } from "react";

import {
  createMission,
  listMissions,
  reflectMission,
  recoverMission,
  runMission,
  type CreateMissionRequest,
  type Mission,
  type MissionStep,
  type ReflexionReport,
} from "@/lib/api";
import { useAppStore } from "@/store/useAppStore";

const POLLING_INTERVAL_MS = 10_000;

export type MissionsActionLoading = string | null;

export function useMissions() {
  const missions = useAppStore((state) => state.missions);
  const missionsTotal = useAppStore((state) => state.missionsTotal);
  const missionsLoading = useAppStore((state) => state.missionsLoading);
  const missionsLastError = useAppStore((state) => state.missionsLastError);
  const missionsFilter = useAppStore((state) => state.missionsFilter);
  const setMissions = useAppStore((state) => state.setMissions);
  const setMissionsLoading = useAppStore((state) => state.setMissionsLoading);
  const setMissionsError = useAppStore((state) => state.setMissionsError);
  const setMissionsFilter = useAppStore((state) => state.setMissionsFilter);
  const addOrUpdateMission = useAppStore((state) => state.addOrUpdateMission);
  const mergeMissionUpdate = useAppStore((state) => state.mergeMissionUpdate);

  const loadingActionRef = useRef<MissionsActionLoading>(null);
  const actionLoading = useAppStore(
    (state) => state as unknown as { missionActionLoading?: MissionsActionLoading },
  ).missionActionLoading ?? null;

  const refresh = useCallback(async () => {
    setMissionsLoading(true);
    setMissionsError(null);
    try {
      const resp = await listMissions({
        sessionId: missionsFilter.sessionId,
        status: missionsFilter.status,
        limit: missionsFilter.limit,
      });
      setMissions(resp.items, resp.total);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Erreur de chargement des missions.";
      setMissionsError(message);
    } finally {
      setMissionsLoading(false);
    }
  }, [
    missionsFilter.limit,
    missionsFilter.sessionId,
    missionsFilter.status,
    setMissions,
    setMissionsError,
    setMissionsLoading,
  ]);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, POLLING_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [refresh]);

  const create = useCallback(
    async (request: CreateMissionRequest): Promise<Mission | null> => {
      loadingActionRef.current = "create";
      try {
        const created = await createMission(request);
        addOrUpdateMission(created);
        return created;
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Impossible de creer la mission.";
        setMissionsError(message);
        return null;
      } finally {
        loadingActionRef.current = null;
      }
    },
    [addOrUpdateMission, setMissionsError],
  );

  const run = useCallback(
    async (mission: Mission, params?: { provider?: string; model?: string }) => {
      loadingActionRef.current = "run";
      mergeMissionUpdate({ missionId: mission.id, status: "running" });
      try {
        const updated = await runMission(mission.id, params);
        addOrUpdateMission(updated);
        return updated;
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Impossible de demarrer la mission.";
        mergeMissionUpdate({ missionId: mission.id, status: mission.status, error: message });
        setMissionsError(message);
        return null;
      } finally {
        loadingActionRef.current = null;
      }
    },
    [addOrUpdateMission, mergeMissionUpdate, setMissionsError],
  );

  const recover = useCallback(
    async (mission: Mission) => {
      loadingActionRef.current = "recover";
      try {
        const updated = await recoverMission(mission.id);
        addOrUpdateMission(updated);
        return updated;
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Impossible de recuperer la mission.";
        setMissionsError(message);
        return null;
      } finally {
        loadingActionRef.current = null;
      }
    },
    [addOrUpdateMission, setMissionsError],
  );

  const reflect = useCallback(
    async (
      mission: Mission,
      params?: { provider?: string; model?: string },
    ): Promise<ReflexionReport | null> => {
      loadingActionRef.current = "reflect";
      try {
        const report = await reflectMission(mission.id, params);
        addOrUpdateMission({ ...mission, reflexionReport: report });
        return report;
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Impossible de refleter la mission.";
        setMissionsError(message);
        return null;
      } finally {
        loadingActionRef.current = null;
      }
    },
    [addOrUpdateMission, setMissionsError],
  );

  const updateStep = useCallback(
    (missionId: string, stepId: string, patch: Partial<MissionStep>) => {
      const state = useAppStore.getState();
      const idx = state.missions.findIndex((m) => m.id === missionId);
      if (idx === -1) return;
      const missionsCopy = [...state.missions];
      const mission = { ...missionsCopy[idx] };
      const stepIdx = mission.steps.findIndex((step) => step.id === stepId);
      if (stepIdx === -1) return;
      const stepsCopy = [...mission.steps];
      stepsCopy[stepIdx] = { ...stepsCopy[stepIdx], ...patch };
      mission.steps = stepsCopy;
      missionsCopy[idx] = mission;
      state.setMissions(missionsCopy, state.missionsTotal);
    },
    [],
  );

  return {
    missions,
    missionsTotal,
    missionsLoading,
    missionsLastError,
    missionsFilter,
    actionLoading: loadingActionRef.current ?? actionLoading,
    refresh,
    create,
    run,
    recover,
    reflect,
    updateStep,
    setMissionsFilter,
    mergeMissionUpdate,
  };
}
