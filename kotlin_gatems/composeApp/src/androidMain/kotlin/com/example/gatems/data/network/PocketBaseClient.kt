package com.example.gatems.data.network

import com.example.gatems.BuildConfig
import com.example.gatems.data.session.SessionAuthCoordinator
import io.ktor.client.HttpClient
import io.ktor.client.engine.android.Android
import io.ktor.client.plugins.HttpSend
import io.ktor.client.plugins.contentnegotiation.ContentNegotiation
import io.ktor.client.plugins.defaultRequest
import io.ktor.client.plugins.logging.LogLevel
import io.ktor.client.plugins.logging.Logger
import io.ktor.client.plugins.logging.Logging
import io.ktor.client.plugins.plugin
import io.ktor.client.request.header
import io.ktor.client.statement.bodyAsText
import io.ktor.http.HttpHeaders
import io.ktor.http.HttpStatusCode
import io.ktor.serialization.kotlinx.json.json
import kotlinx.serialization.json.Json
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class PocketBaseClient @Inject constructor(
    private val sessionAuth: SessionAuthCoordinator,
) {

    // Default URL comes from local.properties → BuildConfig at build time.
    // Can be overridden at runtime (e.g. from Settings screen via AuthPreferences).
    private var _baseUrl: String = BuildConfig.POCKETBASE_URL
    private var _token: String = ""

    val baseUrl: String get() = _baseUrl

    fun init(baseUrl: String, token: String = "") {
        _baseUrl = baseUrl.trimEnd('/')
        _token = token
    }

    fun setToken(token: String) {
        _token = token
    }

    fun clearToken() {
        _token = ""
    }

    val isAuthenticated: Boolean get() = _token.isNotBlank()

    /** Non-blank bearer token for OkHttp (realtime); null if logged out. */
    fun bearerAuthorizationOrNull(): String? =
        _token.takeIf { it.isNotBlank() }?.let { "Bearer $it" }

    val httpClient: HttpClient = HttpClient(Android) {
        install(ContentNegotiation) {
            json(Json {
                ignoreUnknownKeys = true
                isLenient = true
                coerceInputValues = true
            })
        }
        install(Logging) {
            logger = object : Logger {
                override fun log(message: String) {
                    android.util.Log.d("GateMsHttp", message)
                }
            }
            level = LogLevel.HEADERS
        }
        defaultRequest {
            if (_token.isNotBlank()) {
                header(HttpHeaders.Authorization, "Bearer $_token")
            }
        }
        engine {
            connectTimeout = 15_000
            socketTimeout  = 30_000
        }
    }.also { client ->
        client.plugin(HttpSend).intercept { request ->
            val url = request.url.toString()
            if (url.contains("auth-with-password") || url.contains("auth-refresh")) {
                return@intercept execute(request)
            }
            val call = execute(request)
            if (call.response.status != HttpStatusCode.Unauthorized) {
                return@intercept call
            }
            try {
                call.response.bodyAsText()
            } catch (_: Exception) {
            }
            if (_token.isBlank()) {
                return@intercept execute(request)
            }
            val newToken = sessionAuth.refreshAccessToken()
            if (newToken != null) {
                setToken(newToken)
                return@intercept execute(request)
            }
            sessionAuth.onRefreshFailed()
            clearToken()
            execute(request)
        }
    }
}
