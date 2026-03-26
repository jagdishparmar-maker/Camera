package com.example.gatems.data.network

import com.example.gatems.BuildConfig
import io.ktor.client.HttpClient
import io.ktor.client.engine.android.Android
import io.ktor.client.plugins.contentnegotiation.ContentNegotiation
import io.ktor.client.plugins.defaultRequest
import io.ktor.client.plugins.logging.LogLevel
import io.ktor.client.plugins.logging.Logger
import io.ktor.client.plugins.logging.Logging
import io.ktor.client.request.header
import io.ktor.http.HttpHeaders
import io.ktor.serialization.kotlinx.json.json
import kotlinx.serialization.json.Json
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class PocketBaseClient @Inject constructor() {

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
    }
}
