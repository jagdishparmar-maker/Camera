package com.example.gatems.data.session

import com.example.gatems.data.network.AuthResponse
import com.example.gatems.data.preferences.AuthPreferences
import io.ktor.client.HttpClient
import io.ktor.client.call.body
import io.ktor.client.engine.android.Android
import io.ktor.client.plugins.contentnegotiation.ContentNegotiation
import io.ktor.client.request.header
import io.ktor.client.request.post
import io.ktor.client.request.setBody
import io.ktor.http.ContentType
import io.ktor.http.content.TextContent
import io.ktor.http.HttpHeaders
import io.ktor.http.HttpStatusCode
import io.ktor.serialization.kotlinx.json.json
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.serialization.json.Json
import javax.inject.Inject
import javax.inject.Singleton

private const val USERS_COLLECTION = "users"

/**
 * Refreshes the PocketBase JWT via [auth-refresh] using a plain [HttpClient] so we never
 * recurse into the main client's 401 handling. Uses a [Mutex] so parallel 401s only refresh once.
 */
@Singleton
class SessionAuthCoordinator @Inject constructor(
    private val authPrefs: AuthPreferences,
    private val sessionEventBus: SessionEventBus,
) {
    private val mutex = Mutex()

    private val refreshJson = Json {
        ignoreUnknownKeys = true
        isLenient = true
        coerceInputValues = true
    }

    private val refreshClient = HttpClient(Android) {
        install(ContentNegotiation) {
            json(refreshJson)
        }
        expectSuccess = false
    }

    suspend fun refreshAccessToken(): String? = mutex.withLock {
        val base = authPrefs.getPbUrl().trimEnd('/')
        val token = authPrefs.getToken()
        if (token.isBlank()) return@withLock null

        val response = refreshClient.post(
            "$base/api/collections/$USERS_COLLECTION/auth-refresh",
        ) {
            header(HttpHeaders.Authorization, "Bearer $token")
            setBody(TextContent("{}", ContentType.Application.Json))
        }
        if (response.status != HttpStatusCode.OK) return@withLock null

        val body = response.body<AuthResponse>()
        authPrefs.saveAuth(
            token = body.token,
            userId = body.record.id,
            name = body.record.name,
            email = body.record.email,
        )
        body.token
    }

    suspend fun onRefreshFailed() {
        authPrefs.clearAuth()
        sessionEventBus.notifySessionExpired(
            "Your session expired. Please sign in again.",
        )
    }
}
