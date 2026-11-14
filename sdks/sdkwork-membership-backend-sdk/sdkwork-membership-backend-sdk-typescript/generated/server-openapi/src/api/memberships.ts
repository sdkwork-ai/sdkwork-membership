import { backendApiPath } from './paths';
import type { ApiRequestOptions, HttpClient } from '../http/client';

import type { AdminMembershipCatalogMeta, AdminMembershipEntitlementItem, AdminMembershipMemberItem, AdminMembershipMemberStatusUpdate, AdminMembershipPackageGroupItem, AdminMembershipPackageGroupMutation, AdminMembershipPackageItem, AdminMembershipPackageMutation, AdminMembershipPlanItem, AdminMembershipPlanMutation, AdminTeamSubscriptionItem, MembershipCategory, PageInfo, TeamSubscriptionStatus } from '../types';


export interface MembershipsTeamSubscriptionsListParams {
  q?: string;
  status?: TeamSubscriptionStatus;
  planId?: string;
  organizationId?: string;
  page?: number;
  pageSize?: number;
  cursor?: string;
}

export class MembershipsTeamSubscriptionsApi {
  private client: HttpClient;

  constructor(client: HttpClient) {
    this.client = client;
  }


/** Organization (team) subscriptions list. */
  async list(params?: MembershipsTeamSubscriptionsListParams, requestOptions?: ApiRequestOptions): Promise<{ items: AdminTeamSubscriptionItem[]; pageInfo: PageInfo; }> {
    const query = buildQueryString([
      { name: 'q', value: params?.q, style: 'form', explode: true, allowReserved: false },
      { name: 'status', value: params?.status, style: 'form', explode: true, allowReserved: false },
      { name: 'plan_id', value: params?.planId, style: 'form', explode: true, allowReserved: false },
      { name: 'organization_id', value: params?.organizationId, style: 'form', explode: true, allowReserved: false },
      { name: 'page', value: params?.page, style: 'form', explode: true, allowReserved: false },
      { name: 'page_size', value: params?.pageSize, style: 'form', explode: true, allowReserved: false },
      { name: 'cursor', value: params?.cursor, style: 'form', explode: true, allowReserved: false },
    ]);
    return this.client.request<{ items: AdminTeamSubscriptionItem[]; pageInfo: PageInfo; }>(appendQueryString(backendApiPath(`/memberships/team_subscriptions`), query), { ...(requestOptions?.signal !== undefined ? { signal: requestOptions.signal } : {}), ...(requestOptions?.timeout !== undefined ? { timeout: requestOptions.timeout } : {}), method: 'GET' as any, sdkworkUnwrapKind: 'page' });
  }
}

export class MembershipsMetaCatalogApi {
  private client: HttpClient;

  constructor(client: HttpClient) {
    this.client = client;
  }


/** Membership catalog enum reference. */
  async retrieve(requestOptions?: ApiRequestOptions): Promise<AdminMembershipCatalogMeta> {
    return this.client.request<AdminMembershipCatalogMeta>(backendApiPath(`/memberships/meta/catalog`), { ...(requestOptions?.signal !== undefined ? { signal: requestOptions.signal } : {}), ...(requestOptions?.timeout !== undefined ? { timeout: requestOptions.timeout } : {}), method: 'GET' as any, sdkworkUnwrapKind: 'item' });
  }
}

export interface MembershipsEntitlementsListParams {
  planId?: string;
  membershipId?: string;
  status?: string;
  page?: number;
  pageSize?: number;
}

export class MembershipsEntitlementsApi {
  private client: HttpClient;

  constructor(client: HttpClient) {
    this.client = client;
  }


/** Membership entitlements list. */
  async list(params?: MembershipsEntitlementsListParams, requestOptions?: ApiRequestOptions): Promise<{ items: AdminMembershipEntitlementItem[]; pageInfo: PageInfo; }> {
    const query = buildQueryString([
      { name: 'plan_id', value: params?.planId, style: 'form', explode: true, allowReserved: false },
      { name: 'membership_id', value: params?.membershipId, style: 'form', explode: true, allowReserved: false },
      { name: 'status', value: params?.status, style: 'form', explode: true, allowReserved: false },
      { name: 'page', value: params?.page, style: 'form', explode: true, allowReserved: false },
      { name: 'page_size', value: params?.pageSize, style: 'form', explode: true, allowReserved: false },
    ]);
    return this.client.request<{ items: AdminMembershipEntitlementItem[]; pageInfo: PageInfo; }>(appendQueryString(backendApiPath(`/memberships/entitlements`), query), { ...(requestOptions?.signal !== undefined ? { signal: requestOptions.signal } : {}), ...(requestOptions?.timeout !== undefined ? { timeout: requestOptions.timeout } : {}), method: 'GET' as any, sdkworkUnwrapKind: 'page' });
  }
}

export class MembershipsMembersStatusApi {
  private client: HttpClient;

  constructor(client: HttpClient) {
    this.client = client;
  }


/** Membership member status update. */
  async update(id: string, body: AdminMembershipMemberStatusUpdate, requestOptions?: ApiRequestOptions): Promise<AdminMembershipMemberItem> {
    return this.client.request<AdminMembershipMemberItem>(backendApiPath(`/memberships/members/${serializePathParameter(id, { name: 'id', style: 'simple', explode: false })}/status`), { ...(requestOptions?.signal !== undefined ? { signal: requestOptions.signal } : {}), ...(requestOptions?.timeout !== undefined ? { timeout: requestOptions.timeout } : {}), method: 'PATCH' as any, body, contentType: 'application/json', sdkworkUnwrapKind: 'item' });
  }
}

export interface MembershipsMembersListParams {
  userId?: string;
  planId?: string;
  status?: string;
  page?: number;
  pageSize?: number;
}

export class MembershipsMembersApi {
  private client: HttpClient;
  public readonly status: MembershipsMembersStatusApi;

  constructor(client: HttpClient) {
    this.client = client;
    this.status = new MembershipsMembersStatusApi(client);
  }


/** Membership members list. */
  async list(params?: MembershipsMembersListParams, requestOptions?: ApiRequestOptions): Promise<{ items: AdminMembershipMemberItem[]; pageInfo: PageInfo; }> {
    const query = buildQueryString([
      { name: 'user_id', value: params?.userId, style: 'form', explode: true, allowReserved: false },
      { name: 'plan_id', value: params?.planId, style: 'form', explode: true, allowReserved: false },
      { name: 'status', value: params?.status, style: 'form', explode: true, allowReserved: false },
      { name: 'page', value: params?.page, style: 'form', explode: true, allowReserved: false },
      { name: 'page_size', value: params?.pageSize, style: 'form', explode: true, allowReserved: false },
    ]);
    return this.client.request<{ items: AdminMembershipMemberItem[]; pageInfo: PageInfo; }>(appendQueryString(backendApiPath(`/memberships/members`), query), { ...(requestOptions?.signal !== undefined ? { signal: requestOptions.signal } : {}), ...(requestOptions?.timeout !== undefined ? { timeout: requestOptions.timeout } : {}), method: 'GET' as any, sdkworkUnwrapKind: 'page' });
  }

/** Membership member detail. */
  async retrieve(id: string, requestOptions?: ApiRequestOptions): Promise<AdminMembershipMemberItem> {
    return this.client.request<AdminMembershipMemberItem>(backendApiPath(`/memberships/members/${serializePathParameter(id, { name: 'id', style: 'simple', explode: false })}`), { ...(requestOptions?.signal !== undefined ? { signal: requestOptions.signal } : {}), ...(requestOptions?.timeout !== undefined ? { timeout: requestOptions.timeout } : {}), method: 'GET' as any, sdkworkUnwrapKind: 'item' });
  }
}

export interface MembershipsPackagesListParams {
  category?: MembershipCategory;
  packageGroupId?: string;
  planId?: string;
  status?: string;
  page?: number;
  pageSize?: number;
}

export class MembershipsPackagesApi {
  private client: HttpClient;

  constructor(client: HttpClient) {
    this.client = client;
  }


/** Membership packages list. */
  async list(params?: MembershipsPackagesListParams, requestOptions?: ApiRequestOptions): Promise<{ items: AdminMembershipPackageItem[]; pageInfo: PageInfo; }> {
    const query = buildQueryString([
      { name: 'category', value: params?.category, style: 'form', explode: true, allowReserved: false },
      { name: 'package_group_id', value: params?.packageGroupId, style: 'form', explode: true, allowReserved: false },
      { name: 'plan_id', value: params?.planId, style: 'form', explode: true, allowReserved: false },
      { name: 'status', value: params?.status, style: 'form', explode: true, allowReserved: false },
      { name: 'page', value: params?.page, style: 'form', explode: true, allowReserved: false },
      { name: 'page_size', value: params?.pageSize, style: 'form', explode: true, allowReserved: false },
    ]);
    return this.client.request<{ items: AdminMembershipPackageItem[]; pageInfo: PageInfo; }>(appendQueryString(backendApiPath(`/memberships/packages`), query), { ...(requestOptions?.signal !== undefined ? { signal: requestOptions.signal } : {}), ...(requestOptions?.timeout !== undefined ? { timeout: requestOptions.timeout } : {}), method: 'GET' as any, sdkworkUnwrapKind: 'page' });
  }

/** Membership package create. */
  async create(body: AdminMembershipPackageMutation, requestOptions?: ApiRequestOptions): Promise<AdminMembershipPackageItem> {
    return this.client.request<AdminMembershipPackageItem>(backendApiPath(`/memberships/packages`), { ...(requestOptions?.signal !== undefined ? { signal: requestOptions.signal } : {}), ...(requestOptions?.timeout !== undefined ? { timeout: requestOptions.timeout } : {}), method: 'POST' as any, body, contentType: 'application/json', sdkworkUnwrapKind: 'item' });
  }

/** Membership package update. */
  async update(id: string, body: AdminMembershipPackageMutation, requestOptions?: ApiRequestOptions): Promise<AdminMembershipPackageItem> {
    return this.client.request<AdminMembershipPackageItem>(backendApiPath(`/memberships/packages/${serializePathParameter(id, { name: 'id', style: 'simple', explode: false })}`), { ...(requestOptions?.signal !== undefined ? { signal: requestOptions.signal } : {}), ...(requestOptions?.timeout !== undefined ? { timeout: requestOptions.timeout } : {}), method: 'PUT' as any, body, contentType: 'application/json', sdkworkUnwrapKind: 'item' });
  }

/** Membership package delete. */
  async delete(id: string, requestOptions?: ApiRequestOptions): Promise<void> {
    return this.client.request<void>(backendApiPath(`/memberships/packages/${serializePathParameter(id, { name: 'id', style: 'simple', explode: false })}`), { ...(requestOptions?.signal !== undefined ? { signal: requestOptions.signal } : {}), ...(requestOptions?.timeout !== undefined ? { timeout: requestOptions.timeout } : {}), method: 'DELETE' as any });
  }
}

export interface MembershipsPackageGroupsListParams {
  category?: MembershipCategory;
  status?: string;
  page?: number;
  pageSize?: number;
}

export class MembershipsPackageGroupsApi {
  private client: HttpClient;

  constructor(client: HttpClient) {
    this.client = client;
  }


/** Membership package groups list. */
  async list(params?: MembershipsPackageGroupsListParams, requestOptions?: ApiRequestOptions): Promise<{ items: AdminMembershipPackageGroupItem[]; pageInfo: PageInfo; }> {
    const query = buildQueryString([
      { name: 'category', value: params?.category, style: 'form', explode: true, allowReserved: false },
      { name: 'status', value: params?.status, style: 'form', explode: true, allowReserved: false },
      { name: 'page', value: params?.page, style: 'form', explode: true, allowReserved: false },
      { name: 'page_size', value: params?.pageSize, style: 'form', explode: true, allowReserved: false },
    ]);
    return this.client.request<{ items: AdminMembershipPackageGroupItem[]; pageInfo: PageInfo; }>(appendQueryString(backendApiPath(`/memberships/package_groups`), query), { ...(requestOptions?.signal !== undefined ? { signal: requestOptions.signal } : {}), ...(requestOptions?.timeout !== undefined ? { timeout: requestOptions.timeout } : {}), method: 'GET' as any, sdkworkUnwrapKind: 'page' });
  }

/** Membership package group create. */
  async create(body: AdminMembershipPackageGroupMutation, requestOptions?: ApiRequestOptions): Promise<AdminMembershipPackageGroupItem> {
    return this.client.request<AdminMembershipPackageGroupItem>(backendApiPath(`/memberships/package_groups`), { ...(requestOptions?.signal !== undefined ? { signal: requestOptions.signal } : {}), ...(requestOptions?.timeout !== undefined ? { timeout: requestOptions.timeout } : {}), method: 'POST' as any, body, contentType: 'application/json', sdkworkUnwrapKind: 'item' });
  }

/** Membership package group update. */
  async update(id: string, body: AdminMembershipPackageGroupMutation, requestOptions?: ApiRequestOptions): Promise<AdminMembershipPackageGroupItem> {
    return this.client.request<AdminMembershipPackageGroupItem>(backendApiPath(`/memberships/package_groups/${serializePathParameter(id, { name: 'id', style: 'simple', explode: false })}`), { ...(requestOptions?.signal !== undefined ? { signal: requestOptions.signal } : {}), ...(requestOptions?.timeout !== undefined ? { timeout: requestOptions.timeout } : {}), method: 'PUT' as any, body, contentType: 'application/json', sdkworkUnwrapKind: 'item' });
  }

/** Membership package group delete. */
  async delete(id: string, requestOptions?: ApiRequestOptions): Promise<void> {
    return this.client.request<void>(backendApiPath(`/memberships/package_groups/${serializePathParameter(id, { name: 'id', style: 'simple', explode: false })}`), { ...(requestOptions?.signal !== undefined ? { signal: requestOptions.signal } : {}), ...(requestOptions?.timeout !== undefined ? { timeout: requestOptions.timeout } : {}), method: 'DELETE' as any });
  }
}

export interface MembershipsPlansListParams {
  category?: MembershipCategory;
  status?: string;
  page?: number;
  pageSize?: number;
}

export class MembershipsPlansApi {
  private client: HttpClient;

  constructor(client: HttpClient) {
    this.client = client;
  }


/** Membership plans list. */
  async list(params?: MembershipsPlansListParams, requestOptions?: ApiRequestOptions): Promise<{ items: AdminMembershipPlanItem[]; pageInfo: PageInfo; }> {
    const query = buildQueryString([
      { name: 'category', value: params?.category, style: 'form', explode: true, allowReserved: false },
      { name: 'status', value: params?.status, style: 'form', explode: true, allowReserved: false },
      { name: 'page', value: params?.page, style: 'form', explode: true, allowReserved: false },
      { name: 'page_size', value: params?.pageSize, style: 'form', explode: true, allowReserved: false },
    ]);
    return this.client.request<{ items: AdminMembershipPlanItem[]; pageInfo: PageInfo; }>(appendQueryString(backendApiPath(`/memberships/plans`), query), { ...(requestOptions?.signal !== undefined ? { signal: requestOptions.signal } : {}), ...(requestOptions?.timeout !== undefined ? { timeout: requestOptions.timeout } : {}), method: 'GET' as any, sdkworkUnwrapKind: 'page' });
  }

/** Membership plan create. */
  async create(body: AdminMembershipPlanMutation, requestOptions?: ApiRequestOptions): Promise<AdminMembershipPlanItem> {
    return this.client.request<AdminMembershipPlanItem>(backendApiPath(`/memberships/plans`), { ...(requestOptions?.signal !== undefined ? { signal: requestOptions.signal } : {}), ...(requestOptions?.timeout !== undefined ? { timeout: requestOptions.timeout } : {}), method: 'POST' as any, body, contentType: 'application/json', sdkworkUnwrapKind: 'item' });
  }

/** Membership plan update. */
  async update(id: string, body: AdminMembershipPlanMutation, requestOptions?: ApiRequestOptions): Promise<AdminMembershipPlanItem> {
    return this.client.request<AdminMembershipPlanItem>(backendApiPath(`/memberships/plans/${serializePathParameter(id, { name: 'id', style: 'simple', explode: false })}`), { ...(requestOptions?.signal !== undefined ? { signal: requestOptions.signal } : {}), ...(requestOptions?.timeout !== undefined ? { timeout: requestOptions.timeout } : {}), method: 'PUT' as any, body, contentType: 'application/json', sdkworkUnwrapKind: 'item' });
  }

/** Membership plan delete. */
  async delete(id: string, requestOptions?: ApiRequestOptions): Promise<void> {
    return this.client.request<void>(backendApiPath(`/memberships/plans/${serializePathParameter(id, { name: 'id', style: 'simple', explode: false })}`), { ...(requestOptions?.signal !== undefined ? { signal: requestOptions.signal } : {}), ...(requestOptions?.timeout !== undefined ? { timeout: requestOptions.timeout } : {}), method: 'DELETE' as any });
  }
}

export class MembershipsApi {
  public readonly plans: MembershipsPlansApi;
  public readonly packageGroups: MembershipsPackageGroupsApi;
  public readonly packages: MembershipsPackagesApi;
  public readonly members: MembershipsMembersApi;
  public readonly entitlements: MembershipsEntitlementsApi;
  public readonly metaCatalog: MembershipsMetaCatalogApi;
  public readonly teamSubscriptions: MembershipsTeamSubscriptionsApi;

  constructor(client: HttpClient) {
    this.plans = new MembershipsPlansApi(client);
    this.packageGroups = new MembershipsPackageGroupsApi(client);
    this.packages = new MembershipsPackagesApi(client);
    this.members = new MembershipsMembersApi(client);
    this.entitlements = new MembershipsEntitlementsApi(client);
    this.metaCatalog = new MembershipsMetaCatalogApi(client);
    this.teamSubscriptions = new MembershipsTeamSubscriptionsApi(client);
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
