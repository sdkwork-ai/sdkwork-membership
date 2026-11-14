import { appApiPath } from './paths';
import type { ApiRequestOptions, HttpClient } from '../http/client';

import type { AppMembershipDailyRewardResponse, AppMembershipDailyRewardStatusResponse, AppMembershipInfoResponse, AppMembershipPackageGroupItem, AppMembershipPackageItem, AppMembershipPointsBalanceResponse, AppMembershipPrivilegeUsageResponse, AppMembershipPurchaseOutcome, AppMembershipStatusResponse, CommerceOperationCommand, MembershipAudience, MembershipCategory, MembershipFeatureAccessCheckCommand, MembershipFeatureAccessCheckResult, SdkWorkCommandData, SdkWorkPageDataBenefits, SdkWorkPageDataPackageGroups, SdkWorkPageDataPackages, SdkWorkPageDataPlans, SdkWorkPageDataPointsHistory, SdkWorkPageDataTeamSeatAssignments, TeamOrganizationBindCommand, TeamSeatAssignment, TeamSeatAssignmentCommand, TeamSeatPolicyCommand, TeamSeatReconciliation, TeamSubscriptionOverview } from '../types';


export class MembershipsTeamSeatsPolicyApi {
  private client: HttpClient;

  constructor(client: HttpClient) {
    this.client = client;
  }


/** Update the organization team subscription seat policy. */
  async update(body: TeamSeatPolicyCommand, requestOptions?: ApiRequestOptions): Promise<TeamSubscriptionOverview> {
    return this.client.request<TeamSubscriptionOverview>(appApiPath(`/memberships/team/seats/policy`), { ...(requestOptions?.signal !== undefined ? { signal: requestOptions.signal } : {}), ...(requestOptions?.timeout !== undefined ? { timeout: requestOptions.timeout } : {}), method: 'PATCH' as any, body, contentType: 'application/json', sdkworkUnwrapKind: 'item' });
  }
}

export interface MembershipsTeamSeatsListParams {
  page?: number;
  pageSize?: number;
}

export class MembershipsTeamSeatsApi {
  private client: HttpClient;
  public readonly policy: MembershipsTeamSeatsPolicyApi;

  constructor(client: HttpClient) {
    this.client = client;
    this.policy = new MembershipsTeamSeatsPolicyApi(client);
  }


/** Organization seat assignments (one row per active seat). */
  async list(params?: MembershipsTeamSeatsListParams, requestOptions?: ApiRequestOptions): Promise<SdkWorkPageDataTeamSeatAssignments> {
    const query = buildQueryString([
      { name: 'page', value: params?.page, style: 'form', explode: true, allowReserved: false },
      { name: 'page_size', value: params?.pageSize, style: 'form', explode: true, allowReserved: false },
    ]);
    return this.client.request<SdkWorkPageDataTeamSeatAssignments>(appendQueryString(appApiPath(`/memberships/team/seats`), query), { ...(requestOptions?.signal !== undefined ? { signal: requestOptions.signal } : {}), ...(requestOptions?.timeout !== undefined ? { timeout: requestOptions.timeout } : {}), method: 'GET' as any, sdkworkUnwrapKind: 'page' });
  }

/** Assign the lowest free seat to an active organization member. */
  async create(body: TeamSeatAssignmentCommand, requestOptions?: ApiRequestOptions): Promise<TeamSeatAssignment> {
    return this.client.request<TeamSeatAssignment>(appApiPath(`/memberships/team/seats`), { ...(requestOptions?.signal !== undefined ? { signal: requestOptions.signal } : {}), ...(requestOptions?.timeout !== undefined ? { timeout: requestOptions.timeout } : {}), method: 'POST' as any, body, contentType: 'application/json', sdkworkUnwrapKind: 'item' });
  }

/** Reconcile seat assignments with the active organization roster. */
  async reconcile(requestOptions?: ApiRequestOptions): Promise<TeamSeatReconciliation> {
    return this.client.request<TeamSeatReconciliation>(appApiPath(`/memberships/team/seats/reconcile`), { ...(requestOptions?.signal !== undefined ? { signal: requestOptions.signal } : {}), ...(requestOptions?.timeout !== undefined ? { timeout: requestOptions.timeout } : {}), method: 'POST' as any, sdkworkUnwrapKind: 'item' });
  }

/** Revoke the active seat assignment of an organization member. */
  async delete(userId: string, requestOptions?: ApiRequestOptions): Promise<void> {
    return this.client.request<void>(appApiPath(`/memberships/team/seats/${serializePathParameter(userId, { name: 'userId', style: 'simple', explode: false })}`), { ...(requestOptions?.signal !== undefined ? { signal: requestOptions.signal } : {}), ...(requestOptions?.timeout !== undefined ? { timeout: requestOptions.timeout } : {}), method: 'DELETE' as any });
  }
}

export class MembershipsTeamSubscriptionApi {
  private client: HttpClient;

  constructor(client: HttpClient) {
    this.client = client;
  }


/** Current organization team subscription overview. */
  async retrieve(requestOptions?: ApiRequestOptions): Promise<TeamSubscriptionOverview> {
    return this.client.request<TeamSubscriptionOverview>(appApiPath(`/memberships/team/subscription`), { ...(requestOptions?.signal !== undefined ? { signal: requestOptions.signal } : {}), ...(requestOptions?.timeout !== undefined ? { timeout: requestOptions.timeout } : {}), method: 'GET' as any, sdkworkUnwrapKind: 'item' });
  }

/** Bind the caller's unbound team subscription to an organization. */
  async bind(body: TeamOrganizationBindCommand, requestOptions?: ApiRequestOptions): Promise<TeamSubscriptionOverview> {
    return this.client.request<TeamSubscriptionOverview>(appApiPath(`/memberships/team/subscription/bind`), { ...(requestOptions?.signal !== undefined ? { signal: requestOptions.signal } : {}), ...(requestOptions?.timeout !== undefined ? { timeout: requestOptions.timeout } : {}), method: 'POST' as any, body, contentType: 'application/json', sdkworkUnwrapKind: 'item' });
  }
}

export class MembershipsAccessChecksApi {
  private client: HttpClient;

  constructor(client: HttpClient) {
    this.client = client;
  }


/** Check whether the current member level grants access to a feature. */
  async create(body: MembershipFeatureAccessCheckCommand, requestOptions?: ApiRequestOptions): Promise<MembershipFeatureAccessCheckResult> {
    return this.client.request<MembershipFeatureAccessCheckResult>(appApiPath(`/memberships/access/checks`), { ...(requestOptions?.signal !== undefined ? { signal: requestOptions.signal } : {}), ...(requestOptions?.timeout !== undefined ? { timeout: requestOptions.timeout } : {}), method: 'POST' as any, body, contentType: 'application/json', sdkworkUnwrapKind: 'item' });
  }
}

export class MembershipsPrivilegesSpeedUpsApi {
  private client: HttpClient;

  constructor(client: HttpClient) {
    this.client = client;
  }


/** Memberships privileges speed Ups create. */
  async create(body: CommerceOperationCommand, requestOptions?: ApiRequestOptions): Promise<SdkWorkCommandData> {
    return this.client.request<SdkWorkCommandData>(appApiPath(`/memberships/privileges/speed_ups`), { ...(requestOptions?.signal !== undefined ? { signal: requestOptions.signal } : {}), ...(requestOptions?.timeout !== undefined ? { timeout: requestOptions.timeout } : {}), method: 'POST' as any, body, contentType: 'application/json', sdkworkUnwrapKind: 'item' });
  }
}

export class MembershipsPrivilegesUsageApi {
  private client: HttpClient;

  constructor(client: HttpClient) {
    this.client = client;
  }


/** Memberships privileges usage retrieve. */
  async retrieve(requestOptions?: ApiRequestOptions): Promise<AppMembershipPrivilegeUsageResponse> {
    return this.client.request<AppMembershipPrivilegeUsageResponse>(appApiPath(`/memberships/privileges/usage`), { ...(requestOptions?.signal !== undefined ? { signal: requestOptions.signal } : {}), ...(requestOptions?.timeout !== undefined ? { timeout: requestOptions.timeout } : {}), method: 'GET' as any, sdkworkUnwrapKind: 'item' });
  }
}

export class MembershipsPrivilegesApi {
  public readonly usage: MembershipsPrivilegesUsageApi;
  public readonly speedUps: MembershipsPrivilegesSpeedUpsApi;

  constructor(client: HttpClient) {
    this.usage = new MembershipsPrivilegesUsageApi(client);
    this.speedUps = new MembershipsPrivilegesSpeedUpsApi(client);
  }

}

export class MembershipsPointsDailyRewardsStatusApi {
  private client: HttpClient;

  constructor(client: HttpClient) {
    this.client = client;
  }


/** Memberships points daily Rewards status retrieve. */
  async retrieve(requestOptions?: ApiRequestOptions): Promise<AppMembershipDailyRewardStatusResponse> {
    return this.client.request<AppMembershipDailyRewardStatusResponse>(appApiPath(`/memberships/points/daily_rewards/status`), { ...(requestOptions?.signal !== undefined ? { signal: requestOptions.signal } : {}), ...(requestOptions?.timeout !== undefined ? { timeout: requestOptions.timeout } : {}), method: 'GET' as any, sdkworkUnwrapKind: 'item' });
  }
}

export class MembershipsPointsDailyRewardsApi {
  private client: HttpClient;
  public readonly status: MembershipsPointsDailyRewardsStatusApi;

  constructor(client: HttpClient) {
    this.client = client;
    this.status = new MembershipsPointsDailyRewardsStatusApi(client);
  }


/** Memberships points daily Rewards create. */
  async create(body: CommerceOperationCommand, requestOptions?: ApiRequestOptions): Promise<AppMembershipDailyRewardResponse> {
    return this.client.request<AppMembershipDailyRewardResponse>(appApiPath(`/memberships/points/daily_rewards`), { ...(requestOptions?.signal !== undefined ? { signal: requestOptions.signal } : {}), ...(requestOptions?.timeout !== undefined ? { timeout: requestOptions.timeout } : {}), method: 'POST' as any, body, contentType: 'application/json', sdkworkUnwrapKind: 'item' });
  }
}

export interface MembershipsPointsHistoryListParams {
  page?: number;
  pageSize?: number;
  cursor?: string;
}

export class MembershipsPointsHistoryApi {
  private client: HttpClient;

  constructor(client: HttpClient) {
    this.client = client;
  }


/** Memberships points history list. */
  async list(params?: MembershipsPointsHistoryListParams, requestOptions?: ApiRequestOptions): Promise<SdkWorkPageDataPointsHistory> {
    const query = buildQueryString([
      { name: 'page', value: params?.page, style: 'form', explode: true, allowReserved: false },
      { name: 'page_size', value: params?.pageSize, style: 'form', explode: true, allowReserved: false },
      { name: 'cursor', value: params?.cursor, style: 'form', explode: true, allowReserved: false },
    ]);
    return this.client.request<SdkWorkPageDataPointsHistory>(appendQueryString(appApiPath(`/memberships/points/history`), query), { ...(requestOptions?.signal !== undefined ? { signal: requestOptions.signal } : {}), ...(requestOptions?.timeout !== undefined ? { timeout: requestOptions.timeout } : {}), method: 'GET' as any, sdkworkUnwrapKind: 'page' });
  }
}

export class MembershipsPointsBalanceApi {
  private client: HttpClient;

  constructor(client: HttpClient) {
    this.client = client;
  }


/** Memberships points balance retrieve. */
  async retrieve(requestOptions?: ApiRequestOptions): Promise<AppMembershipPointsBalanceResponse> {
    return this.client.request<AppMembershipPointsBalanceResponse>(appApiPath(`/memberships/points/balance`), { ...(requestOptions?.signal !== undefined ? { signal: requestOptions.signal } : {}), ...(requestOptions?.timeout !== undefined ? { timeout: requestOptions.timeout } : {}), method: 'GET' as any, sdkworkUnwrapKind: 'item' });
  }
}

export class MembershipsPointsApi {
  public readonly balance: MembershipsPointsBalanceApi;
  public readonly history: MembershipsPointsHistoryApi;
  public readonly dailyRewards: MembershipsPointsDailyRewardsApi;

  constructor(client: HttpClient) {
    this.balance = new MembershipsPointsBalanceApi(client);
    this.history = new MembershipsPointsHistoryApi(client);
    this.dailyRewards = new MembershipsPointsDailyRewardsApi(client);
  }

}

export class MembershipsPurchasesApi {
  private client: HttpClient;

  constructor(client: HttpClient) {
    this.client = client;
  }


/** Memberships purchases create. */
  async create(body: CommerceOperationCommand, requestOptions?: ApiRequestOptions): Promise<AppMembershipPurchaseOutcome> {
    return this.client.request<AppMembershipPurchaseOutcome>(appApiPath(`/memberships/purchases`), { ...(requestOptions?.signal !== undefined ? { signal: requestOptions.signal } : {}), ...(requestOptions?.timeout !== undefined ? { timeout: requestOptions.timeout } : {}), method: 'POST' as any, body, contentType: 'application/json', sdkworkUnwrapKind: 'item' });
  }

/** Memberships purchases renew. */
  async renew(body: CommerceOperationCommand, requestOptions?: ApiRequestOptions): Promise<AppMembershipPurchaseOutcome> {
    return this.client.request<AppMembershipPurchaseOutcome>(appApiPath(`/memberships/purchases/renew`), { ...(requestOptions?.signal !== undefined ? { signal: requestOptions.signal } : {}), ...(requestOptions?.timeout !== undefined ? { timeout: requestOptions.timeout } : {}), method: 'POST' as any, body, contentType: 'application/json', sdkworkUnwrapKind: 'item' });
  }

/** Memberships purchases upgrade. */
  async upgrade(body: CommerceOperationCommand, requestOptions?: ApiRequestOptions): Promise<AppMembershipPurchaseOutcome> {
    return this.client.request<AppMembershipPurchaseOutcome>(appApiPath(`/memberships/purchases/upgrade`), { ...(requestOptions?.signal !== undefined ? { signal: requestOptions.signal } : {}), ...(requestOptions?.timeout !== undefined ? { timeout: requestOptions.timeout } : {}), method: 'POST' as any, body, contentType: 'application/json', sdkworkUnwrapKind: 'item' });
  }
}

export interface MembershipsPackagesListParams {
  category?: MembershipCategory;
  audience?: MembershipAudience;
  status?: string;
  page?: number;
  pageSize?: number;
  packageGroupId?: string;
  planId?: string;
  cursor?: string;
}

export interface MembershipsPackagesRetrieveParams {
  audience?: MembershipAudience;
}

export class MembershipsPackagesApi {
  private client: HttpClient;

  constructor(client: HttpClient) {
    this.client = client;
  }


/** Memberships packages list. */
  async list(params?: MembershipsPackagesListParams, requestOptions?: ApiRequestOptions): Promise<SdkWorkPageDataPackages> {
    const query = buildQueryString([
      { name: 'category', value: params?.category, style: 'form', explode: true, allowReserved: false },
      { name: 'audience', value: params?.audience, style: 'form', explode: true, allowReserved: false },
      { name: 'status', value: params?.status, style: 'form', explode: true, allowReserved: false },
      { name: 'page', value: params?.page, style: 'form', explode: true, allowReserved: false },
      { name: 'page_size', value: params?.pageSize, style: 'form', explode: true, allowReserved: false },
      { name: 'package_group_id', value: params?.packageGroupId, style: 'form', explode: true, allowReserved: false },
      { name: 'plan_id', value: params?.planId, style: 'form', explode: true, allowReserved: false },
      { name: 'cursor', value: params?.cursor, style: 'form', explode: true, allowReserved: false },
    ]);
    return this.client.request<SdkWorkPageDataPackages>(appendQueryString(appApiPath(`/memberships/packages`), query), { ...(requestOptions?.signal !== undefined ? { signal: requestOptions.signal } : {}), ...(requestOptions?.timeout !== undefined ? { timeout: requestOptions.timeout } : {}), method: 'GET' as any, skipAuth: true, sdkworkUnwrapKind: 'page' });
  }

/** Memberships packages retrieve. */
  async retrieve(packageId: string, params?: MembershipsPackagesRetrieveParams, requestOptions?: ApiRequestOptions): Promise<AppMembershipPackageItem> {
    const query = buildQueryString([
      { name: 'audience', value: params?.audience, style: 'form', explode: true, allowReserved: false },
    ]);
    return this.client.request<AppMembershipPackageItem>(appendQueryString(appApiPath(`/memberships/packages/${serializePathParameter(packageId, { name: 'packageId', style: 'simple', explode: false })}`), query), { ...(requestOptions?.signal !== undefined ? { signal: requestOptions.signal } : {}), ...(requestOptions?.timeout !== undefined ? { timeout: requestOptions.timeout } : {}), method: 'GET' as any, skipAuth: true, sdkworkUnwrapKind: 'item' });
  }
}

export interface MembershipsPackageGroupsPackagesListParams {
  audience?: MembershipAudience;
  status?: string;
  page?: number;
  pageSize?: number;
  planId?: string;
  recommendedOnly?: boolean;
  cursor?: string;
}

export class MembershipsPackageGroupsPackagesApi {
  private client: HttpClient;

  constructor(client: HttpClient) {
    this.client = client;
  }


/** Memberships package Groups packages list. */
  async list(packageGroupId: string, params?: MembershipsPackageGroupsPackagesListParams, requestOptions?: ApiRequestOptions): Promise<SdkWorkPageDataPackages> {
    const query = buildQueryString([
      { name: 'audience', value: params?.audience, style: 'form', explode: true, allowReserved: false },
      { name: 'status', value: params?.status, style: 'form', explode: true, allowReserved: false },
      { name: 'page', value: params?.page, style: 'form', explode: true, allowReserved: false },
      { name: 'page_size', value: params?.pageSize, style: 'form', explode: true, allowReserved: false },
      { name: 'plan_id', value: params?.planId, style: 'form', explode: true, allowReserved: false },
      { name: 'recommended_only', value: params?.recommendedOnly, style: 'form', explode: true, allowReserved: false },
      { name: 'cursor', value: params?.cursor, style: 'form', explode: true, allowReserved: false },
    ]);
    return this.client.request<SdkWorkPageDataPackages>(appendQueryString(appApiPath(`/memberships/package_groups/${serializePathParameter(packageGroupId, { name: 'packageGroupId', style: 'simple', explode: false })}/packages`), query), { ...(requestOptions?.signal !== undefined ? { signal: requestOptions.signal } : {}), ...(requestOptions?.timeout !== undefined ? { timeout: requestOptions.timeout } : {}), method: 'GET' as any, skipAuth: true, sdkworkUnwrapKind: 'page' });
  }
}

export interface MembershipsPackageGroupsListParams {
  category?: MembershipCategory;
  audience?: MembershipAudience;
  status?: string;
  page?: number;
  pageSize?: number;
  planId?: string;
  recommendedOnly?: boolean;
  cursor?: string;
}

export interface MembershipsPackageGroupsRetrieveParams {
  audience?: MembershipAudience;
}

export class MembershipsPackageGroupsApi {
  private client: HttpClient;
  public readonly packages: MembershipsPackageGroupsPackagesApi;

  constructor(client: HttpClient) {
    this.client = client;
    this.packages = new MembershipsPackageGroupsPackagesApi(client);
  }


/** Memberships package Groups list. */
  async list(params?: MembershipsPackageGroupsListParams, requestOptions?: ApiRequestOptions): Promise<SdkWorkPageDataPackageGroups> {
    const query = buildQueryString([
      { name: 'category', value: params?.category, style: 'form', explode: true, allowReserved: false },
      { name: 'audience', value: params?.audience, style: 'form', explode: true, allowReserved: false },
      { name: 'status', value: params?.status, style: 'form', explode: true, allowReserved: false },
      { name: 'page', value: params?.page, style: 'form', explode: true, allowReserved: false },
      { name: 'page_size', value: params?.pageSize, style: 'form', explode: true, allowReserved: false },
      { name: 'plan_id', value: params?.planId, style: 'form', explode: true, allowReserved: false },
      { name: 'recommended_only', value: params?.recommendedOnly, style: 'form', explode: true, allowReserved: false },
      { name: 'cursor', value: params?.cursor, style: 'form', explode: true, allowReserved: false },
    ]);
    return this.client.request<SdkWorkPageDataPackageGroups>(appendQueryString(appApiPath(`/memberships/package_groups`), query), { ...(requestOptions?.signal !== undefined ? { signal: requestOptions.signal } : {}), ...(requestOptions?.timeout !== undefined ? { timeout: requestOptions.timeout } : {}), method: 'GET' as any, skipAuth: true, sdkworkUnwrapKind: 'page' });
  }

/** Memberships package Groups retrieve. */
  async retrieve(packageGroupId: string, params?: MembershipsPackageGroupsRetrieveParams, requestOptions?: ApiRequestOptions): Promise<AppMembershipPackageGroupItem> {
    const query = buildQueryString([
      { name: 'audience', value: params?.audience, style: 'form', explode: true, allowReserved: false },
    ]);
    return this.client.request<AppMembershipPackageGroupItem>(appendQueryString(appApiPath(`/memberships/package_groups/${serializePathParameter(packageGroupId, { name: 'packageGroupId', style: 'simple', explode: false })}`), query), { ...(requestOptions?.signal !== undefined ? { signal: requestOptions.signal } : {}), ...(requestOptions?.timeout !== undefined ? { timeout: requestOptions.timeout } : {}), method: 'GET' as any, skipAuth: true, sdkworkUnwrapKind: 'item' });
  }
}

export interface MembershipsPlansListParams {
  category?: MembershipCategory;
  audience?: MembershipAudience;
  status?: string;
  page?: number;
  pageSize?: number;
  cursor?: string;
}

export class MembershipsPlansApi {
  private client: HttpClient;

  constructor(client: HttpClient) {
    this.client = client;
  }


/** Memberships plans list. */
  async list(params?: MembershipsPlansListParams, requestOptions?: ApiRequestOptions): Promise<SdkWorkPageDataPlans> {
    const query = buildQueryString([
      { name: 'category', value: params?.category, style: 'form', explode: true, allowReserved: false },
      { name: 'audience', value: params?.audience, style: 'form', explode: true, allowReserved: false },
      { name: 'status', value: params?.status, style: 'form', explode: true, allowReserved: false },
      { name: 'page', value: params?.page, style: 'form', explode: true, allowReserved: false },
      { name: 'page_size', value: params?.pageSize, style: 'form', explode: true, allowReserved: false },
      { name: 'cursor', value: params?.cursor, style: 'form', explode: true, allowReserved: false },
    ]);
    return this.client.request<SdkWorkPageDataPlans>(appendQueryString(appApiPath(`/memberships/plans`), query), { ...(requestOptions?.signal !== undefined ? { signal: requestOptions.signal } : {}), ...(requestOptions?.timeout !== undefined ? { timeout: requestOptions.timeout } : {}), method: 'GET' as any, skipAuth: true, sdkworkUnwrapKind: 'page' });
  }
}

export interface MembershipsBenefitsListParams {
  page?: number;
  pageSize?: number;
  planId?: string;
  cursor?: string;
}

export class MembershipsBenefitsApi {
  private client: HttpClient;

  constructor(client: HttpClient) {
    this.client = client;
  }


/** Memberships benefits list. */
  async list(params?: MembershipsBenefitsListParams, requestOptions?: ApiRequestOptions): Promise<SdkWorkPageDataBenefits> {
    const query = buildQueryString([
      { name: 'page', value: params?.page, style: 'form', explode: true, allowReserved: false },
      { name: 'page_size', value: params?.pageSize, style: 'form', explode: true, allowReserved: false },
      { name: 'plan_id', value: params?.planId, style: 'form', explode: true, allowReserved: false },
      { name: 'cursor', value: params?.cursor, style: 'form', explode: true, allowReserved: false },
    ]);
    return this.client.request<SdkWorkPageDataBenefits>(appendQueryString(appApiPath(`/memberships/benefits`), query), { ...(requestOptions?.signal !== undefined ? { signal: requestOptions.signal } : {}), ...(requestOptions?.timeout !== undefined ? { timeout: requestOptions.timeout } : {}), method: 'GET' as any, skipAuth: true, sdkworkUnwrapKind: 'page' });
  }
}

export class MembershipsCurrentStatusApi {
  private client: HttpClient;

  constructor(client: HttpClient) {
    this.client = client;
  }


/** Memberships current status retrieve. */
  async retrieve(requestOptions?: ApiRequestOptions): Promise<AppMembershipStatusResponse> {
    return this.client.request<AppMembershipStatusResponse>(appApiPath(`/memberships/current/status`), { ...(requestOptions?.signal !== undefined ? { signal: requestOptions.signal } : {}), ...(requestOptions?.timeout !== undefined ? { timeout: requestOptions.timeout } : {}), method: 'GET' as any, sdkworkUnwrapKind: 'item' });
  }
}

export class MembershipsCurrentApi {
  private client: HttpClient;
  public readonly status: MembershipsCurrentStatusApi;

  constructor(client: HttpClient) {
    this.client = client;
    this.status = new MembershipsCurrentStatusApi(client);
  }


/** Memberships current retrieve. */
  async retrieve(requestOptions?: ApiRequestOptions): Promise<AppMembershipInfoResponse> {
    return this.client.request<AppMembershipInfoResponse>(appApiPath(`/memberships/current`), { ...(requestOptions?.signal !== undefined ? { signal: requestOptions.signal } : {}), ...(requestOptions?.timeout !== undefined ? { timeout: requestOptions.timeout } : {}), method: 'GET' as any, sdkworkUnwrapKind: 'item' });
  }
}

export class MembershipsApi {
  public readonly current: MembershipsCurrentApi;
  public readonly benefits: MembershipsBenefitsApi;
  public readonly plans: MembershipsPlansApi;
  public readonly packageGroups: MembershipsPackageGroupsApi;
  public readonly packages: MembershipsPackagesApi;
  public readonly purchases: MembershipsPurchasesApi;
  public readonly points: MembershipsPointsApi;
  public readonly privileges: MembershipsPrivilegesApi;
  public readonly accessChecks: MembershipsAccessChecksApi;
  public readonly teamSubscription: MembershipsTeamSubscriptionApi;
  public readonly teamSeats: MembershipsTeamSeatsApi;

  constructor(client: HttpClient) {
    this.current = new MembershipsCurrentApi(client);
    this.benefits = new MembershipsBenefitsApi(client);
    this.plans = new MembershipsPlansApi(client);
    this.packageGroups = new MembershipsPackageGroupsApi(client);
    this.packages = new MembershipsPackagesApi(client);
    this.purchases = new MembershipsPurchasesApi(client);
    this.points = new MembershipsPointsApi(client);
    this.privileges = new MembershipsPrivilegesApi(client);
    this.accessChecks = new MembershipsAccessChecksApi(client);
    this.teamSubscription = new MembershipsTeamSubscriptionApi(client);
    this.teamSeats = new MembershipsTeamSeatsApi(client);
  }

}

export function createMembershipsApi(client: HttpClient): MembershipsApi {
  return new MembershipsApi(client);
}

function appendQueryString(path: string, rawQueryString: string): string {
  const query = rawQueryString.replace(/^\?+/, '');
  if (!query) {
    return path;
  }
  return path.includes('?') ? `${path}&${query}` : `${path}?${query}`;
}

interface PathParameterSpec {
  name: string;
  style: string;
  explode: boolean;
}

function serializePathParameter(value: unknown, spec: PathParameterSpec): string {
  if (value === undefined || value === null) {
    return '';
  }

  const style = spec.style || 'simple';
  if (Array.isArray(value)) {
    return serializePathArray(spec.name, value, style, spec.explode);
  }
  if (typeof value === 'object') {
    return serializePathObject(spec.name, value as Record<string, unknown>, style, spec.explode);
  }
  return pathPrefix(spec.name, style, false) + encodePathValue(serializePathPrimitive(value));
}

function serializePathArray(name: string, values: unknown[], style: string, explode: boolean): string {
  const serialized = values
    .filter((item) => item !== undefined && item !== null)
    .map((item) => encodePathValue(serializePathPrimitive(item)));
  if (serialized.length === 0) {
    return pathPrefix(name, style, false);
  }
  if (style === 'matrix') {
    return explode
      ? serialized.map((item) => `;${name}=${item}`).join('')
      : `;${name}=${serialized.join(',')}`;
  }
  return pathPrefix(name, style, false) + serialized.join(explode ? '.' : ',');
}

function serializePathObject(name: string, value: Record<string, unknown>, style: string, explode: boolean): string {
  const entries = Object.entries(value).filter(([, entryValue]) => entryValue !== undefined && entryValue !== null);
  if (entries.length === 0) {
    return pathPrefix(name, style, true);
  }
  if (style === 'matrix') {
    return explode
      ? entries.map(([key, entryValue]) => `;${encodePathValue(key)}=${encodePathValue(serializePathPrimitive(entryValue))}`).join('')
      : `;${name}=${entries.flatMap(([key, entryValue]) => [encodePathValue(key), encodePathValue(serializePathPrimitive(entryValue))]).join(',')}`;
  }
  const serialized = explode
    ? entries.map(([key, entryValue]) => `${encodePathValue(key)}=${encodePathValue(serializePathPrimitive(entryValue))}`).join(style === 'label' ? '.' : ',')
    : entries.flatMap(([key, entryValue]) => [encodePathValue(key), encodePathValue(serializePathPrimitive(entryValue))]).join(',');
  return pathPrefix(name, style, true) + serialized;
}

function pathPrefix(name: string, style: string, _objectValue: boolean): string {
  if (style === 'label') return '.';
  if (style === 'matrix') return `;${name}`;
  return '';
}

function encodePathValue(value: string): string {
  return encodeURIComponent(value);
}

function serializePathPrimitive(value: unknown): string {
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (typeof value === 'object') {
    return JSON.stringify(value);
  }
  return String(value);
}
interface QueryParameterSpec {
  name: string;
  value: unknown;
  style: string;
  explode: boolean;
  allowReserved: boolean;
  contentType?: string;
}

function buildQueryString(parameters: QueryParameterSpec[]): string {
  const pairs: string[] = [];
  for (const parameter of parameters) {
    appendSerializedParameter(pairs, parameter);
  }
  return pairs.join('&');
}

function appendSerializedParameter(pairs: string[], parameter: QueryParameterSpec): void {
  if (parameter.value === undefined || parameter.value === null) {
    return;
  }

  if (parameter.contentType) {
    pairs.push(`${encodeQueryComponent(parameter.name)}=${encodeQueryValue(JSON.stringify(parameter.value), parameter.allowReserved)}`);
    return;
  }

  const style = parameter.style || 'form';
  if (style === 'deepObject') {
    appendDeepObjectParameter(pairs, parameter.name, parameter.value, parameter.allowReserved);
    return;
  }

  if (Array.isArray(parameter.value)) {
    appendArrayParameter(pairs, parameter.name, parameter.value, style, parameter.explode, parameter.allowReserved);
    return;
  }

  if (typeof parameter.value === 'object') {
    appendObjectParameter(pairs, parameter.name, parameter.value as Record<string, unknown>, style, parameter.explode, parameter.allowReserved);
    return;
  }

  pairs.push(`${encodeQueryComponent(parameter.name)}=${encodeQueryValue(serializePrimitive(parameter.value), parameter.allowReserved)}`);
}

function appendArrayParameter(
  pairs: string[],
  name: string,
  value: unknown[],
  style: string,
  explode: boolean,
  allowReserved: boolean,
): void {
  const values = value
    .filter((item) => item !== undefined && item !== null)
    .map((item) => serializePrimitive(item));
  if (values.length === 0) {
    return;
  }

  if (style === 'form' && explode) {
    for (const item of values) {
      pairs.push(`${encodeQueryComponent(name)}=${encodeQueryValue(item, allowReserved)}`);
    }
    return;
  }

  pairs.push(`${encodeQueryComponent(name)}=${encodeQueryValue(values.join(','), allowReserved)}`);
}

function appendObjectParameter(
  pairs: string[],
  name: string,
  value: Record<string, unknown>,
  style: string,
  explode: boolean,
  allowReserved: boolean,
): void {
  const entries = Object.entries(value).filter(([, entryValue]) => entryValue !== undefined && entryValue !== null);
  if (entries.length === 0) {
    return;
  }

  if (style === 'form' && explode) {
    for (const [key, entryValue] of entries) {
      pairs.push(`${encodeQueryComponent(key)}=${encodeQueryValue(serializePrimitive(entryValue), allowReserved)}`);
    }
    return;
  }

  const serialized = entries.flatMap(([key, entryValue]) => [key, serializePrimitive(entryValue)]).join(',');
  pairs.push(`${encodeQueryComponent(name)}=${encodeQueryValue(serialized, allowReserved)}`);
}

function appendDeepObjectParameter(
  pairs: string[],
  name: string,
  value: unknown,
  allowReserved: boolean,
): void {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    pairs.push(`${encodeQueryComponent(name)}=${encodeQueryValue(serializePrimitive(value), allowReserved)}`);
    return;
  }

  for (const [key, entryValue] of Object.entries(value as Record<string, unknown>)) {
    if (entryValue === undefined || entryValue === null) {
      continue;
    }
    pairs.push(`${encodeQueryComponent(`${name}[${key}]`)}=${encodeQueryValue(serializePrimitive(entryValue), allowReserved)}`);
  }
}

function serializePrimitive(value: unknown): string {
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (typeof value === 'object') {
    return JSON.stringify(value);
  }
  return String(value);
}

function encodeQueryComponent(value: string): string {
  return encodeURIComponent(value);
}

function encodeQueryValue(value: string, allowReserved: boolean): string {
  const encoded = encodeURIComponent(value);
  if (!allowReserved) {
    return encoded;
  }
  return encoded.replace(/%3A/gi, ':')
    .replace(/%2F/gi, '/')
    .replace(/%3F/gi, '?')
    .replace(/%23/gi, '#')
    .replace(/%5B/gi, '[')
    .replace(/%5D/gi, ']')
    .replace(/%40/gi, '@')
    .replace(/%21/gi, '!')
    .replace(/%24/gi, '$')
    .replace(/%26/gi, '&')
    .replace(/%27/gi, "'")
    .replace(/%28/gi, '(')
    .replace(/%29/gi, ')')
    .replace(/%2A/gi, '*')
    .replace(/%2B/gi, '+')
    .replace(/%2C/gi, ',')
    .replace(/%3B/gi, ';')
    .replace(/%3D/gi, '=');
}
