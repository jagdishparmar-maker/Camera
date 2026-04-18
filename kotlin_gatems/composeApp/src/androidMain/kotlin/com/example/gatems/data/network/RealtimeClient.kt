package com.example.gatems.data.network

import android.util.Log
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.flow.flowOn
import kotlinx.coroutines.isActive
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
import java.util.concurrent.atomic.AtomicInteger
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

    // ── Status ────────────────────────────────────────────────────────────────

    private val _status = MutableStateFlow(RealtimeStatus.IDLE)
    /** Observable health of the SSE stream. Consumers use this to render the "Live / Reconnecting" pill. */
    val status: StateFlow<RealtimeStatus> = _status.asStateFlow()

    /**
     * Number of currently-active `subscribe` collectors. When zero we flip to [RealtimeStatus.IDLE]
     * to avoid showing a "connecting" indicator in screens that aren't listening.
     */
    private val activeSubscribers = AtomicInteger(0)

    private fun markSubscriberStart() {
        if (activeSubscribers.incrementAndGet() == 1 && _status.value == RealtimeStatus.IDLE) {
            _status.value = RealtimeStatus.CONNECTING
        }
    }

    private fun markSubscriberStop() {
        if (activeSubscribers.decrementAndGet() <= 0) {
            activeSubscribers.set(0)
            _status.value = RealtimeStatus.IDLE
        }
    }

    // ── Subscribe ─────────────────────────────────────────────────────────────

    /**
     * Subscribe to a PocketBase collection for live changes.
     *
     * Emits [RealtimeEvent] for each create / update / delete. The underlying SSE connection
     * is re-established automatically with exponential backoff (1s → 30s) if it drops, and
     * [status] is updated accordingly so the UI can show a "Reconnecting…" pill.
     *
     * The flow stays active until the collecting coroutine is cancelled.
     */
    fun <T> subscribe(
        collection: String,
        serializer: KSerializer<T>,
        recordId: String = "*",
    ): Flow<RealtimeEvent<T>> = callbackFlow {
        val topic = if (recordId == "*") collection else "$collection/$recordId"
        markSubscriberStart()

        // Exponential backoff between reconnect attempts (ms).
        var backoff = 1_000L
        val maxBackoff = 30_000L

        while (isActive) {
            val eventSource = openEventSource(topic, serializer) { backoff = 1_000L }
            if (eventSource == null) {
                // Could not even build the request (e.g. base URL blank). Pause then retry.
                _status.value = RealtimeStatus.RECONNECTING
                delay(backoff)
                backoff = (backoff * 2).coerceAtMost(maxBackoff)
                continue
            }

            // Wait here until the listener signals the connection ended (or coroutine cancels).
            val closedNormally = try {
                awaitListenerEnd(topic)
            } catch (_: Throwable) {
                false
            }

            eventSource.cancel()

            if (!isActive) break

            _status.value = RealtimeStatus.RECONNECTING
            Log.d(TAG, "SSE $topic ended (normally=$closedNormally); reconnecting in ${backoff}ms")
            delay(backoff)
            backoff = (backoff * 2).coerceAtMost(maxBackoff)
        }

        awaitClose {
            markSubscriberStop()
            Log.d(TAG, "SSE cancelled: $topic")
        }
    }.flowOn(Dispatchers.IO)

    /** Convenience helper that infers the serializer from the reified type. */
    inline fun <reified T> subscribe(
        collection: String,
        recordId: String = "*",
    ): Flow<RealtimeEvent<T>> = subscribe(collection, serializer(), recordId)

    // ── Internal ──────────────────────────────────────────────────────────────

    /**
     * Channel-of-lifecycle used by [awaitListenerEnd] to block the reconnect loop until the
     * current EventSource dies. We create one per connection attempt so we can rearm cleanly.
     */
    @Volatile private var currentLifecycle: kotlinx.coroutines.CompletableDeferred<Boolean>? = null

    private suspend fun awaitListenerEnd(topic: String): Boolean {
        val lifecycle = currentLifecycle
            ?: return false.also { Log.w(TAG, "No lifecycle for $topic — immediate reconnect") }
        return lifecycle.await()
    }

    /**
     * Open the EventSource, wire up the listener, and return it. Messages arriving on the
     * listener are forwarded to [forwardChannel] via [forwardEvent]. When the connection
     * terminates (success or failure), the installed [currentLifecycle] is completed so the
     * reconnect loop wakes up.
     */
    private fun <T> kotlinx.coroutines.channels.ProducerScope<RealtimeEvent<T>>.openEventSource(
        topic: String,
        serializer: KSerializer<T>,
        onFirstEventReset: () -> Unit,
    ): EventSource? {
        val url = "${pbClient.baseUrl}/api/realtime"
        if (url.isBlank() || pbClient.baseUrl.isBlank()) return null

        if (_status.value != RealtimeStatus.LIVE) _status.value = RealtimeStatus.CONNECTING

        val lifecycle = kotlinx.coroutines.CompletableDeferred<Boolean>()
        currentLifecycle = lifecycle

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
                            val connectData = json.parseToJsonElement(data) as? JsonObject
                            val clientId = connectData?.get("clientId")
                                ?.toString()?.removeSurrounding("\"")
                            if (clientId != null) {
                                sendSubscription(clientId, topic)
                                _status.value = RealtimeStatus.LIVE
                                onFirstEventReset()
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
                if (!lifecycle.isCompleted) lifecycle.complete(false)
            }

            override fun onClosed(eventSource: EventSource) {
                Log.d(TAG, "SSE closed: $topic")
                if (!lifecycle.isCompleted) lifecycle.complete(true)
            }
        }

        val request = Request.Builder()
            .url(url)
            .apply {
                pbClient.bearerAuthorizationOrNull()?.let { header("Authorization", it) }
            }
            .build()
        return EventSources.createFactory(okHttp).newEventSource(request, listener)
    }

    private fun sendSubscription(clientId: String, topic: String) {
        Thread {
            try {
                val body = """{"clientId":"$clientId","subscriptions":["$topic"]}"""
                val mediaType = "application/json".toMediaType()
                val reqBody   = body.toRequestBody(mediaType)
                val request   = Request.Builder()
                    .url("${pbClient.baseUrl}/api/realtime")
                    .apply {
                        pbClient.bearerAuthorizationOrNull()?.let { header("Authorization", it) }
                    }
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
