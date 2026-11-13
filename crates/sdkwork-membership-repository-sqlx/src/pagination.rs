//! List pagination helpers aligned with `sdkwork-specs/PAGINATION_SPEC.md` and `API_SPEC.md` §16.

use sdkwork_utils_rust::{
    cursor_list_page_data, offset_list_page_data, offset_window_page_info, OffsetListPageParams,
    SdkWorkPageData, DEFAULT_LIST_PAGE_SIZE, MAX_LIST_PAGE_SIZE,
};

/// Parse standard list query parameters (`page`, `page_size`, optional `cursor`)
/// plus an optional catalog `category` filter and an optional catalog
/// `audience` filter.
///
/// `audience` is `None` for admin lists (no audience filter, legacy behaviour)
/// and `Some("personal")` / `Some("team")` for the app catalog reads.
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct MembershipListQuery {
    pub page: Option<i64>,
    pub page_size: Option<i64>,
    pub cursor: Option<String>,
    /// Optional catalog classification filter (`token` | `community`).
    pub category: Option<String>,
    /// Optional catalog audience filter (`personal` | `team`).
    pub audience: Option<String>,
}

impl MembershipListQuery {
    pub fn offset_params(&self) -> OffsetListPageParams {
        if self.cursor.is_some() {
            // Numeric offset cursors are treated as offset-mode continuation per PAGINATION_SPEC §2.4.
            let offset = self
                .cursor
                .as_deref()
                .and_then(|value| value.parse::<i64>().ok())
                .unwrap_or(0)
                .max(0);
            let page_size = self
                .page_size
                .unwrap_or(i64::from(DEFAULT_LIST_PAGE_SIZE))
                .clamp(1, i64::from(MAX_LIST_PAGE_SIZE));
            let page = offset / page_size + 1;
            OffsetListPageParams {
                page,
                page_size,
                offset,
            }
        } else {
            OffsetListPageParams::parse(self.page, self.page_size)
        }
    }
}

pub fn offset_page<T>(
    items: Vec<T>,
    total_items: i64,
    params: OffsetListPageParams,
) -> SdkWorkPageData<T> {
    offset_list_page_data(items, total_items, params)
}

/// SQL already applied `LIMIT page_size + 1 OFFSET offset`.
pub fn bounded_sql_page<T>(records: Vec<T>, page_size: usize, offset: usize) -> SdkWorkPageData<T> {
    let has_more = records.len() > page_size;
    let mut items = records;
    if has_more {
        items.truncate(page_size);
    }
    let next_cursor = has_more.then(|| offset.saturating_add(items.len()).to_string());
    SdkWorkPageData {
        items,
        page_info: offset_window_page_info(Some(page_size), next_cursor, has_more),
    }
}

/// Cursor-mode page for keyset lists (points history).
pub fn cursor_page<T>(
    items: Vec<T>,
    page_size: usize,
    next_cursor: Option<String>,
    has_more: bool,
) -> SdkWorkPageData<T> {
    cursor_list_page_data(items, page_size, next_cursor, has_more)
}

pub fn tenant_id_text(tenant_id: i64) -> String {
    tenant_id.to_string()
}

pub fn organization_id_text(organization_id: i64) -> String {
    organization_id.to_string()
}
