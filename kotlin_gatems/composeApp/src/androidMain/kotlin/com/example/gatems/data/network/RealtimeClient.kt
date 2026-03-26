package com.example.gatems.data.network

import android.util.Log
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.flow.flowOn
import kotlinx.serialization.KSerializer
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.serializer
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.Response
import okhttp3.sse.EventSource
import okhttp3.sse.EventSourceListener
import okhttp3.sse.EventSources
import java.util.concurrent.TimeUnit
import javax.inject.Inject
import javax.inject.Singleton

private const val TAG = "GateMsRealtime"

@Serializable
private data class RealtimeMessage(
    val action: String = "",
    val record: JsonObject = JsonObject(emptyMap()),
)

enum class RealtimeAction { CREATE, UPDATE, DELETE, UNKNOWN }

data class RealtimeEvent<T>(
    val action: RealtimeAction,
    val record: T,
)

@Singleton
class RealtimeClient @Inject constructor(private val pbClient: PocketBaseClient) {

    private val json = Json { ignoreUnknownKeys = true; isLenient = true; coerceInputValues = true }

    private val okHttp = OkHttpClient.Builder()
        .readTimeout(0, TimeUnit.MILLISECONDS) // SSE: no read timeout
        .build()

    /**
     * Subscribe to a PocketBase collection for live changes.
     *
     * Emits [RealtimeEvent] for each create / update / delete. Call this in a ViewModel
     * via [kotlinx.coroutines.CoroutineScope.launch] and collect; the flow stays active
     * until the coroutine is cancelled.
     *
     * @param collection PocketBase collection name (e.g. "vehicles")
     * @param recordId   Optional record ID for single-record subscriptions. Defaults to "*" (all).
     * @param serializer KSerializer for T — pass `Vehicle.serializer()` etc.
     */
    fun <T> subscribe(
        collection: String,
        serializer: KSerializer<T>,
        recordId: String = "*",
    ): Flow<RealtimeEvent<T>> = callbackFlow {
        val topic = if (recordId == "*") collection else "$collection/$recordId"
        val url   = "${pbClient.baseUrl}/api/realtime"

        var clientId: String?   = null
        var subscribed: Boolean = false

        val listener = object : EventSourceListener() {
            override fun onOpen(eventSource: EventSource, response: Response) {
                Log.d(TAG, "SSE connected: $topic")
            }

            override fun onEvent(
                eventSource: EventSource,
                id: String?,
                type: String?,
                data: String,
            ) {
                try {
                    when (type) {
                        "PB_CONNECT" -> {
                            // PocketBase sends clientId on connection; follow with a subscriptions POST
                            val connectData = json.parseToJsonElement(data) as? JsonObject
                            clientId = connectData?.get("clientId")
                                ?.toString()?.removeSurrounding("\"")
                            if (clientId != null && !subscribed) {
                                subscribed = true
                                sendSubscription(clientId!!, topic)
                            }
                        }
                        else -> {
                            val msg    = json.decodeFromString<RealtimeMessage>(data)
                            val action = when (msg.action) {
                                "create" -> RealtimeAction.CREATE
                                "update" -> RealtimeAction.UPDATE
                                "delete" -> RealtimeAction.DELETE
                                else     -> RealtimeAction.UNKNOWN
                            }
                            val record = json.decodeFromJsonElement(serializer, msg.record)
                            trySend(RealtimeEvent(action, record))
                        }
                    }
                } catch (e: Exception) {
                    Log.w(TAG, "SSE parse error on $topic: ${e.message}")
                }
            }

            override fun onFailure(
                eventSource: EventSource,
                t: Throwable?,
                response: Response?,
            ) {
                Log.w(TAG, "SSE failure on $topic: ${t?.message}")
                // Flow will be closed when the coroutine is cancelled
            }

            override fun onClosed(eventSource: EventSource) {
                Log.d(TAG, "SSE closed: $topic")
            }
        }

        val request = Request.Builder().url(url).build()
        val eventSource = EventSources.createFactory(okHttp).newEventSource(request, listener)

        awaitClose {
            eventSource.cancel()
            Log.d(TAG, "SSE cancelled: $topic")
        }
    }.flowOn(Dispatchers.IO)

    /** Convenience helper that infers the serializer from the reified type. */
    inline fun <reified T> subscribe(
        collection: String,
        recordId: String = "*",
    ): Flow<RealtimeEvent<T>> = subscribe(collection, serializer(), recordId)

    // ── Internal ──────────────────────────────────────────────────────────────

    private fun sendSubscription(clientId: String, topic: String) {
        Thread {
            try {
                val body = """{"clientId":"$clientId","subscriptions":["$topic"]}"""
                val mediaType = "application/json".toMediaType()
                val reqBody   = body.toRequestBody(mediaType)
                val request   = Request.Builder()
                    .url("${pbClient.baseUrl}/api/realtime")
                    .post(reqBody)
                    .build()
                okHttp.newCall(request).execute().close()
                Log.d(TAG, "Subscription POST sent for $topic")
            } catch (e: Exception) {
                Log.w(TAG, "Subscription POST failed for $topic: ${e.message}")
            }
        }.start()
    }
}
