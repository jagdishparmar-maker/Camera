package com.example.gatems.data.network

/**
 * Lifecycle of the PocketBase SSE realtime stream exposed by [RealtimeClient].
 *
 * - [IDLE]         — no active subscription yet (initial state, or all subscribers gone).
 * - [CONNECTING]   — first connection attempt in progress.
 * - [LIVE]         — SSE open AND subscriptions acknowledged (PB_CONNECT received).
 * - [RECONNECTING] — connection dropped; backoff loop is attempting to re-open.
 * - [DISCONNECTED] — user is logged out or the stream was explicitly stopped.
 */
enum class RealtimeStatus { IDLE, CONNECTING, LIVE, RECONNECTING, DISCONNECTED }
