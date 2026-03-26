package com.example.gatems.data.network

import android.content.Context
import android.net.Uri
import dagger.hilt.android.qualifiers.ApplicationContext
import io.ktor.client.call.body
import io.ktor.client.request.delete
import io.ktor.client.request.forms.MultiPartFormDataContent
import io.ktor.client.request.forms.formData
import io.ktor.client.request.get
import io.ktor.client.request.parameter
import io.ktor.client.request.patch
import io.ktor.client.request.post
import io.ktor.client.request.setBody
import io.ktor.http.ContentType
import io.ktor.http.Headers
import io.ktor.http.HttpHeaders
import io.ktor.http.contentType
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import java.io.File
import javax.inject.Inject
import javax.inject.Singleton

// ── PocketBase response wrappers ─────────────────────────────────────────────

@Serializable
data class ListResponse<T>(
    val page: Int = 1,
    val perPage: Int = 30,
    val totalItems: Int = 0,
    val totalPages: Int = 1,
    val items: List<T> = emptyList(),
)

@Serializable
data class AuthResponse(
    val token: String,
    val record: AuthRecord,
)

@Serializable
data class AuthRecord(
    val id: String = "",
    val email: String = "",
    val name: String = "",
)

// ── API client ────────────────────────────────────────────────────────────────

@Singleton
class PocketBaseApi @Inject constructor(
    @PublishedApi internal val client: PocketBaseClient,
    @ApplicationContext private val appContext: Context,
) {
    @PublishedApi internal val base  get() = client.baseUrl
    @PublishedApi internal val http  get() = client.httpClient

    // ── Auth ──────────────────────────────────────────────────────────────────

    suspend fun authWithPassword(
        collection: String,
        email: String,
        password: String,
    ): AuthResponse = http.post("$base/api/collections/$collection/auth-with-password") {
        contentType(ContentType.Application.Json)
        setBody(buildJsonObject {
            put("identity", email)
            put("password", password)
        })
    }.body()

    // ── Read ──────────────────────────────────────────────────────────────────

    /** Page through all records and return the full list (mirrors getFullList in database.ts). */
    suspend inline fun <reified T> getFullList(
        collection: String,
        sort: String? = null,
        filter: String? = null,
        expand: String? = null,
    ): List<T> {
        val all = mutableListOf<T>()
        var page = 1
        while (true) {
            val resp: ListResponse<T> = http.get("$base/api/collections/$collection/records") {
                parameter("page", page)
                parameter("perPage", 500)
                sort?.let   { parameter("sort", it) }
                filter?.let { parameter("filter", it) }
                expand?.let { parameter("expand", it) }
            }.body()
            all.addAll(resp.items)
            if (page >= resp.totalPages) break
            page++
        }
        return all
    }

    suspend inline fun <reified T> getOne(
        collection: String,
        id: String,
        expand: String? = null,
    ): T = http.get("$base/api/collections/$collection/records/$id") {
        expand?.let { parameter("expand", it) }
    }.body()

    // ── Write ─────────────────────────────────────────────────────────────────

    suspend inline fun <reified T> create(
        collection: String,
        body: JsonObject,
    ): T = http.post("$base/api/collections/$collection/records") {
        contentType(ContentType.Application.Json)
        setBody(body)
    }.body()

    suspend inline fun <reified T> update(
        collection: String,
        id: String,
        body: JsonObject,
    ): T = http.patch("$base/api/collections/$collection/records/$id") {
        contentType(ContentType.Application.Json)
        setBody(body)
    }.body()

    suspend fun delete(collection: String, id: String) {
        http.delete("$base/api/collections/$collection/records/$id")
    }

    // ── File upload helpers ───────────────────────────────────────────────────

    /** Create a record containing a photo (multipart/form-data). */
    suspend inline fun <reified T> createWithFile(
        collection: String,
        fields: Map<String, String?>,
        fileField: String,
        fileUri: String,
        mimeType: String,
        fileName: String,
    ): T {
        val fileBytes = resolveFileBytes(fileUri)
        return http.post("$base/api/collections/$collection/records") {
            setBody(MultiPartFormDataContent(formData {
                fields.forEach { (k, v) -> if (v != null) append(k, v) }
                if (fileBytes != null) {
                    append(
                        key   = fileField,
                        value = fileBytes,
                        headers = Headers.build {
                            append(HttpHeaders.ContentType, mimeType)
                            append(HttpHeaders.ContentDisposition, "filename=\"$fileName\"")
                        },
                    )
                }
            }))
        }.body()
    }

    /** Update a record, optionally replacing its photo. */
    suspend inline fun <reified T> updateWithFile(
        collection: String,
        id: String,
        fields: Map<String, String?>,
        fileField: String? = null,
        fileUri: String? = null,
        mimeType: String? = null,
        fileName: String? = null,
    ): T {
        val fileBytes = if (fileUri != null) resolveFileBytes(fileUri) else null
        return http.patch("$base/api/collections/$collection/records/$id") {
            setBody(MultiPartFormDataContent(formData {
                fields.forEach { (k, v) -> if (v != null) append(k, v) }
                if (fileBytes != null && fileField != null &&
                    mimeType != null && fileName != null
                ) {
                    append(
                        key   = fileField,
                        value = fileBytes,
                        headers = Headers.build {
                            append(HttpHeaders.ContentType, mimeType)
                            append(HttpHeaders.ContentDisposition, "filename=\"$fileName\"")
                        },
                    )
                }
            }))
        }.body()
    }

    // ── Health check ──────────────────────────────────────────────────────────

    suspend fun healthCheck(): Boolean = try {
        http.get("$base/api/health").status.value in 200..299
    } catch (_: Exception) {
        false
    }

    // ── Internal helpers ──────────────────────────────────────────────────────

    @PublishedApi internal fun resolveFileBytes(uri: String): ByteArray? = try {
        if (uri.isBlank()) return null
        val androidUri = Uri.parse(uri)
        when (androidUri.scheme) {
            "content" -> appContext.contentResolver.openInputStream(androidUri)?.use { it.readBytes() }
            "file"    -> File(androidUri.path ?: return null).takeIf { it.exists() }?.readBytes()
            else      -> File(uri).takeIf { it.exists() }?.readBytes()
        }
    } catch (_: Exception) {
        null
    }
}
