package com.example.gatems.data.paging

import androidx.paging.PagingSource
import androidx.paging.PagingState
import com.example.gatems.data.model.Vehicle
import com.example.gatems.data.network.PocketBaseApi

private const val COLLECTION = "vehicles"
private const val EXPAND     = "Checked_In_By,Checked_Out_By"

/**
 * Paging 3 source backed by PocketBase's `?page=&perPage=&filter=&sort=` endpoint.
 *
 * Each page request translates directly to one REST call; we let the server do filtering
 * and sorting so the on-device memory footprint stays O(visible window) instead of O(all
 * records). [filter] and [search] are the two things that change between invalidations;
 * when they do, the ViewModel creates a fresh source (via Pager's `pagingSourceFactory`).
 *
 * @param filter  PocketBase filter DSL (or null to include everything). Example:
 *                `status != "CheckedOut" && Type = "Inward"`.
 * @param search  Optional free-text query. Combined with [filter] using `&&`.
 * @param sort    Sort expression, defaults to newest-first by `created`.
 * @param perPage Page size per REST call.
 */
class VehiclesPagingSource(
    private val api: PocketBaseApi,
    private val filter: String? = null,
    private val search: String? = null,
    private val sort: String = "-created",
    private val perPage: Int = 25,
) : PagingSource<Int, Vehicle>() {

    override fun getRefreshKey(state: PagingState<Int, Vehicle>): Int? {
        // Anchor to the closest loaded page; PocketBase is 1-indexed.
        val anchor = state.anchorPosition ?: return null
        val closest = state.closestPageToPosition(anchor) ?: return null
        return closest.prevKey?.plus(1) ?: closest.nextKey?.minus(1)
    }

    override suspend fun load(params: LoadParams<Int>): LoadResult<Int, Vehicle> {
        val page = params.key ?: 1
        return try {
            val effectiveFilter = combineFilterAndSearch(filter, search)
            val response = api.getList<Vehicle>(
                collection = COLLECTION,
                page       = page,
                perPage    = params.loadSize.coerceAtMost(perPage * 3).coerceAtLeast(perPage),
                sort       = sort,
                filter     = effectiveFilter,
                expand     = EXPAND,
            )
            LoadResult.Page(
                data    = response.items,
                prevKey = if (page <= 1) null else page - 1,
                nextKey = if (page >= response.totalPages) null else page + 1,
            )
        } catch (e: Exception) {
            LoadResult.Error(e)
        }
    }

    private fun combineFilterAndSearch(filter: String?, search: String?): String? {
        val parts = listOfNotNull(filter?.takeIf { it.isNotBlank() }, search?.takeIf { it.isNotBlank() })
        if (parts.isEmpty()) return null
        return parts.joinToString(" && ") { "($it)" }
    }
}
