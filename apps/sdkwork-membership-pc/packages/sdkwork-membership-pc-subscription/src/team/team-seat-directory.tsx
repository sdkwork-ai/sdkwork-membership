import { useEffect, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Search,
  ShieldAlert,
  UserMinus,
  UserPlus,
} from "lucide-react";
import {
  Button,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  EmptyState,
  Input,
  LoadingBlock,
  StatusNotice,
} from "@sdkwork/ui-pc-react";

import { resolveTeamPlanErrorCopy } from "./team-plan-error-copy";
import {
  joinTeamSeatDirectory,
  type SdkworkTeamSeatDirectoryRow,
} from "./team-roster-composition";
import {
  normalizeSdkworkTeamError,
  type SdkworkTeamSeatAssignment,
  type SdkworkTeamSubscriptionError,
  type SdkworkTeamSubscriptionOverview,
} from "./team-subscription-port";
import {
  formatSdkworkTeamCopy,
  useSdkworkTeamSurfaceRuntime,
  useSdkworkTeamTranslate,
  type SdkworkTeamNotify,
} from "./team-surface-context";

export interface SdkworkTeamSeatDirectoryProps {
  /**
   * Whether the caller may manage organization seats (IAM owner/admin).
   *
   * The container already withholds the directory for a plain member; the flag
   * also keeps the member-removal reconciliation action hidden, so a caller who
   * cannot manage seats never sees a seat-management control.
   */
  canManageSeats: boolean;
  /** Called after a seat mutation so the container refreshes the snapshot. */
  onSeatChanged: () => void;
  /** Toast sink for the reconciliation result. */
  onNotify: SdkworkTeamNotify;
  /** IAM organization id the roster is read from. */
  organizationId: string;
  overview: SdkworkTeamSubscriptionOverview;
  /** Membership-owned seat assignment rows for the current subscription. */
  seatAssignments: readonly SdkworkTeamSeatAssignment[];
}

const SEAT_PAGE_SIZE = 10;
const SEARCH_DEBOUNCE_MILLIS = 300;

const ROLE_COPY: Record<string, { fallback: string; key: string }> = {
  admin: { fallback: "管理员", key: "token_plan.team.role_admin" },
  member: { fallback: "成员", key: "token_plan.team.role_member" },
  owner: { fallback: "所有者", key: "token_plan.team.role_owner" },
};

/**
 * Organization seat directory: searchable, IAM-paginated roster joined with the
 * membership seat map.
 *
 * The IAM roster is the member directory (identity, role, and `q` search); the
 * membership seat assignments are the licensing facts. Rows are joined by user
 * id so an unassigned member renders an Assign action and an assigned member
 * renders its seat number. Mutations keep the current page, refresh only the
 * page, and ask the container to refresh the derived counts; failures render the
 * typed problem reason instead of a raw backend message.
 */
export function SdkworkTeamSeatDirectory({
  canManageSeats,
  onNotify,
  onSeatChanged,
  organizationId,
  overview,
  seatAssignments,
}: SdkworkTeamSeatDirectoryProps) {
  const { port } = useSdkworkTeamSurfaceRuntime();
  const copy = useSdkworkTeamTranslate();
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const [reloadToken, setReloadToken] = useState(0);
  const [rows, setRows] = useState<SdkworkTeamSeatDirectoryRow[]>([]);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<SdkworkTeamSubscriptionError | null>(null);
  const [pendingUserId, setPendingUserId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<SdkworkTeamSubscriptionError | null>(null);
  const [revokeTarget, setRevokeTarget] = useState<SdkworkTeamSeatDirectoryRow | null>(null);
  const [isReconciling, setIsReconciling] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearchQuery(searchInput.trim());
      setPage(1);
    }, SEARCH_DEBOUNCE_MILLIS);
    return () => { window.clearTimeout(timer) };
  }, [searchInput]);

  useEffect(() => {
    let active = true;
    setIsLoading(true);
    setLoadError(null);

    void port.listRosterPage({
      organizationId,
      page,
      pageSize: SEAT_PAGE_SIZE,
      ...(searchQuery ? { q: searchQuery } : {}),
    })
      .then((result) => {
        if (!active) {
          return;
        }
        // Re-join the freshly searched roster with the current seat map.
        setRows(joinTeamSeatDirectory(result.items, seatAssignments));
        setTotal(result.total);
        setHasMore(result.hasMore);
      })
      .catch((error: unknown) => {
        if (active) {
          setLoadError(normalizeSdkworkTeamError(error));
        }
      })
      .finally(() => {
        if (active) {
          setIsLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [organizationId, page, port, reloadToken, searchQuery, seatAssignments]);

  const isStrictAtCapacity = overview.seatsAvailable === 0 && overview.seatPolicy === "strict";
  const seatsFullCopy = formatSdkworkTeamCopy(
    copy(
      "token_plan.team.seat_capacity_exceeded",
      "{{seats}} 个坐席已全部分配，请先购买更多坐席再分配。",
    ),
    { seats: String(overview.seatsPurchased) },
  );
  const totalPages = total > 0 ? Math.max(1, Math.ceil(total / SEAT_PAGE_SIZE)) : 1;
  const canGoBack = page > 1;
  const canGoForward = hasMore || page < totalPages;

  function handleAssign(row: SdkworkTeamSeatDirectoryRow): void {
    setActionError(null);
    setPendingUserId(row.userId);

    void port.assignSeat(row.userId)
      .then(() => {
        setReloadToken((token) => token + 1);
        onSeatChanged();
      })
      .catch((error: unknown) => {
        setActionError(normalizeSdkworkTeamError(error));
      })
      .finally(() => {
        setPendingUserId(null);
      });
  }

  function handleRevoke(row: SdkworkTeamSeatDirectoryRow): void {
    setActionError(null);
    setPendingUserId(row.userId);

    void port.revokeSeat(row.userId)
      .then(() => {
        setRevokeTarget(null);
        setReloadToken((token) => token + 1);
        onSeatChanged();
      })
      .catch((error: unknown) => {
        setActionError(normalizeSdkworkTeamError(error));
      })
      .finally(() => {
        setPendingUserId(null);
      });
  }

  /**
   * Revokes every seat whose user IAM no longer reports as an active member.
   *
   * The endpoint owns the membership decision (it calls the IAM directory port)
   * and runs once per click; the directory then re-reads its page and asks the
   * container to refresh the overview. `revokedCount` is surfaced in a toast so
   * a sweep that found nothing reads as "already consistent", not as a failure.
   */
  function handleReconcile(): void {
    if (isReconciling) {
      return;
    }
    setActionError(null);
    setIsReconciling(true);

    void port.reconcileSeats()
      .then((result) => {
        setReloadToken((token) => token + 1);
        onSeatChanged();
        onNotify(
          result.revokedCount > 0
            ? formatSdkworkTeamCopy(
              copy(
                "token_plan.team.reconcile_success",
                "已回收 {{revoked}} 个已离职成员的坐席。",
              ),
              { revoked: String(result.revokedCount) },
            )
            : copy("token_plan.team.reconcile_none", "所有坐席均与组织有效成员一致。"),
          "success",
        );
      })
      .catch((error: unknown) => {
        setActionError(normalizeSdkworkTeamError(error));
      })
      .finally(() => {
        setIsReconciling(false);
      });
  }

  const actionErrorCopy = actionError ? resolveTeamPlanErrorCopy(actionError.reason) : null;

  return (
    <section
      className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6 dark:border-white/10 dark:bg-zinc-950"
      data-team-seat-directory
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold tracking-tight text-slate-950 dark:text-white">
            {copy("token_plan.team.seat_management_title", "坐席分配")}
          </h2>
          <p className="mt-1 max-w-xl text-sm leading-6 text-slate-500 dark:text-slate-400">
            {copy(
              "token_plan.team.seat_management_desc",
              "每位成员最多持有一个坐席，回收后坐席可分配给其他成员。",
            )}
          </p>
        </div>

        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
          {canManageSeats ? (
            <Button
              data-team-seat-reconcile
              disabled={isReconciling || isLoading}
              loading={isReconciling}
              onClick={handleReconcile}
              size="sm"
              type="button"
              variant="ghost"
            >
              <RefreshCw aria-hidden="true" className="h-3.5 w-3.5" />
              {isReconciling
                ? copy("token_plan.team.reconcile_saving", "校准中…")
                : copy("token_plan.team.reconcile_seats", "校准坐席")}
            </Button>
          ) : null}
          <div className="relative w-full sm:w-64">
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
            />
            <Input
              aria-label={copy("token_plan.team.search_placeholder", "搜索成员")}
              className="h-9 pl-9 text-sm"
              onChange={(event) => { setSearchInput(event.target.value) }}
              placeholder={copy("token_plan.team.search_placeholder", "搜索成员")}
              type="search"
              value={searchInput}
            />
          </div>
        </div>
      </div>

      {isStrictAtCapacity ? (
        <div className="mt-4">
          <StatusNotice tone="warning">{seatsFullCopy}</StatusNotice>
        </div>
      ) : null}

      {actionError && actionErrorCopy ? (
        <div className="mt-4">
          <StatusNotice
            title={formatSdkworkTeamCopy(
              copy(actionErrorCopy.key, actionErrorCopy.fallback),
              { seats: String(overview.seatsPurchased) },
            )}
            tone="danger"
          />
        </div>
      ) : null}

      {isLoading ? (
        <div className="mt-4">
          <LoadingBlock label={copy("token_plan.team.loading", "正在加载团队订阅…")} />
        </div>
      ) : null}

      {!isLoading && loadError ? (
        <div className="mt-4">
          <StatusNotice
            title={copy("token_plan.team.members_load_failed", "组织成员加载失败。")}
            tone="danger"
          >
            <div className="flex justify-end">
              <Button
                onClick={() => { setReloadToken((token) => token + 1) }}
                size="sm"
                type="button"
                variant="ghost"
              >
                {copy("token_plan.team.retry", "重试")}
              </Button>
            </div>
          </StatusNotice>
        </div>
      ) : null}

      {!isLoading && !loadError && rows.length === 0 ? (
        <div className="mt-4">
          <EmptyState description={copy("token_plan.team.empty_members", "未找到组织成员。")} />
        </div>
      ) : null}

      {!isLoading && !loadError && rows.length > 0 ? (
        <>
          <div className="-mx-1 mt-4 overflow-x-auto">
            <table className="w-full min-w-[36rem] border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs font-semibold uppercase tracking-[0.12em] text-slate-500 dark:border-white/10 dark:text-slate-400">
                  <th className="px-2 py-2.5 font-semibold" scope="col">
                    {copy("token_plan.team.member", "成员")}
                  </th>
                  <th className="px-2 py-2.5 font-semibold" scope="col">
                    {copy("token_plan.team.role", "角色")}
                  </th>
                  <th className="px-2 py-2.5 font-semibold" scope="col">
                    {copy("token_plan.team.seat_no", "坐席")}
                  </th>
                  <th className="px-2 py-2.5 text-right font-semibold" scope="col">
                    {copy("token_plan.team.manage_seats", "管理坐席")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const roleCopy = ROLE_COPY[row.membershipKind] ?? ROLE_COPY.member;
                  const isAssigned = row.isAssigned;
                  const isPending = pendingUserId === row.userId;
                  const assignDisabled = isPending || (!isAssigned && isStrictAtCapacity);

                  return (
                    <tr
                      className="border-b border-slate-100 last:border-0 dark:border-white/5"
                      data-seat-state={isAssigned ? "active" : "unassigned"}
                      key={row.membershipId || row.userId}
                    >
                      <td className="px-2 py-3">
                        <div className="min-w-0">
                          <p className="truncate font-medium text-slate-950 dark:text-white">
                            {row.name}
                          </p>
                          {row.email ? (
                            <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                              {row.email}
                            </p>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-2 py-3 text-slate-600 dark:text-slate-300">
                        {copy(roleCopy.key, roleCopy.fallback)}
                      </td>
                      <td className="px-2 py-3">
                        {isAssigned && row.seatNo !== undefined ? (
                          <span className="inline-flex items-center rounded-md bg-sky-500/10 px-2 py-1 text-xs font-semibold tabular-nums text-sky-600 dark:text-sky-400">
                            #{row.seatNo}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-500 dark:text-slate-400">
                            {copy("token_plan.team.seat_state_unassigned", "未分配")}
                          </span>
                        )}
                      </td>
                      <td className="px-2 py-3">
                        <div className="flex justify-end">
                          {isAssigned ? (
                            <Button
                              disabled={isPending}
                              loading={isPending}
                              onClick={() => { setRevokeTarget(row) }}
                              size="sm"
                              type="button"
                              variant="ghost"
                            >
                              <UserMinus aria-hidden="true" className="h-3.5 w-3.5" />
                              {copy("token_plan.team.revoke_seat", "回收")}
                            </Button>
                          ) : (
                            <Button
                              disabled={assignDisabled}
                              loading={isPending}
                              onClick={() => { handleAssign(row) }}
                              size="sm"
                              type="button"
                              variant="secondary"
                            >
                              <UserPlus aria-hidden="true" className="h-3.5 w-3.5" />
                              {copy("token_plan.team.assign_seat", "分配坐席")}
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex items-center justify-between gap-3">
            <span className="text-xs tabular-nums text-slate-500 dark:text-slate-400">
              {formatSdkworkTeamCopy(copy("common.pagination.page", "第 {{page}} 页"), {
                page: String(page),
              })}
            </span>
            <div className="flex items-center gap-2">
              <Button
                aria-label={copy("common.pagination.previous", "上一页")}
                disabled={!canGoBack || isLoading}
                onClick={() => { setPage((current) => Math.max(1, current - 1)) }}
                size="sm"
                type="button"
                variant="ghost"
              >
                <ChevronLeft aria-hidden="true" className="h-4 w-4" />
              </Button>
              <Button
                aria-label={copy("common.pagination.next", "下一页")}
                disabled={!canGoForward || isLoading}
                onClick={() => { setPage((current) => current + 1) }}
                size="sm"
                type="button"
                variant="ghost"
              >
                <ChevronRight aria-hidden="true" className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </>
      ) : null}

      <Dialog
        onOpenChange={(open) => {
          if (!open) {
            setRevokeTarget(null);
          }
        }}
        open={revokeTarget !== null}
      >
        <DialogContent className="w-[min(92vw,28rem)]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldAlert aria-hidden="true" className="h-4 w-4 text-amber-500" />
              {copy("token_plan.team.confirm_revoke_title", "确认回收该坐席？")}
            </DialogTitle>
            <DialogDescription>
              {formatSdkworkTeamCopy(
                copy(
                  "token_plan.team.confirm_revoke_desc",
                  "{{name}} 将失去订阅权益，直到重新分配坐席。",
                ),
                { name: revokeTarget?.name ?? "" },
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4">
            <DialogClose asChild>
              <Button type="button" variant="ghost">
                {copy("cancel", "取消")}
              </Button>
            </DialogClose>
            <Button
              disabled={pendingUserId !== null}
              loading={pendingUserId !== null && pendingUserId === revokeTarget?.userId}
              onClick={() => {
                if (revokeTarget) {
                  handleRevoke(revokeTarget);
                }
              }}
              type="button"
              variant="danger"
            >
              {copy("token_plan.team.confirm_revoke_action", "回收坐席")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
